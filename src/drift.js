// Slow effects ("drift"): colour changes over minutes to hours. Hardware effect engines can't go that slow,
// so these run in Home Assistant via the Glow Studio drift script (blueprints/script/glow_studio/…).
import { z2mTopic } from "./drivers/zigbee2mqtt.js";
import { wledLedCount } from "./drivers/wled.js";

export const DRIFT_SCRIPT = "script.glow_studio_drift";
export const DRIFT_STYLES = [
  { id: "drift", label: "Slow drift", colors: 8, minutes: true },
  { id: "drift_flow", label: "Slow flow", colors: 8, minutes: true },
];
export const MINUTE_CHOICES = [5, 15, 30, 60, 120];
export const isDrift = (type) => typeof type === "string" && type.startsWith("drift");

export const DRIFT_DEFAULTS = [
  ["Slow sunset", "drift", ["#ffb300", "#ff5500", "#c2185b", "#41006e"], 30],
  ["Ocean drift", "drift_flow", ["#001a66", "#0060c0", "#00b4ff", "#00ffd5"], 20],
  ["Aurora drift", "drift_flow", ["#00ff9c", "#00d4ff", "#7a00ff", "#00ff5a"], 30],
  ["Ember drift", "drift", ["#ff3a00", "#b31b00", "#ff8c1a", "#7a0f00"], 15],
  ["Calm night", "drift", ["#1a0a40", "#2a1a6e", "#0a2a5a", "#3a1255"], 60],
];

const SLOW_RAINBOW = ["#ff0000", "#ffd000", "#00ff6a", "#0080ff", "#b000ff"];

/**
 * The slow version of a hardware effect, used when the user asks for "slower than the strip can go":
 * travelling styles (chase, dash, flows) become Slow flow; everything else a whole-strip Slow drift.
 * Keeps the effect's id, name and colours.
 */
export function slowEquivalent(fx, minutes) {
  if (isDrift(fx.type)) return { ...fx, minutes };
  const travels = /chas|dash|flow|rainbow2|roll|wave|run|scan|comet|meteor|wipe/i.test(fx.type);
  const rainbow = /rainbow|colou?r ?loop/i.test(fx.type);
  const colors = fx.colors?.length >= 2 ? fx.colors
    : fx.colors?.length === 1 ? [fx.colors[0], "#000000"]
    : rainbow ? SLOW_RAINBOW : ["#ff5500", "#8200dc"];
  return { ...fx, type: travels ? "drift_flow" : "drift", colors: colors.slice(0, 8), minutes };
}

/** Minutes for one full colour cycle (stored on the effect; older effects fall back to 30). */
export const driftMinutes = (fx) => Math.max(1, Math.min(240, Number(fx.minutes) || 30));

/* ---------- one speed slider for everything ----------
 * Hardware effects: 30–100% on the slider = the strip's own speed 1–100.
 * Below 30% = slower than the strip can go: the same effect runs as a slow drift, from a 1-minute cycle
 * at 29% to a 2-hour cycle at 1% (logarithmic, so the low end isn't all crammed together).
 * Slow-only effects (drift with no hardware original) use the whole slider: 100% = 1 min … 1% = 2 h. */
export const HW_FLOOR = 30;
const MAX_MIN = 120;
const LN_MAX = Math.log(MAX_MIN);
const clampV = (v) => Math.max(1, Math.min(100, Math.round(Number(v) || 1)));
const lowToMinutes = (v) => Math.max(1, Math.round(MAX_MIN ** ((HW_FLOOR - 1 - v) / (HW_FLOOR - 2))));
const minutesToLow = (m) => Math.round(HW_FLOOR - 1 - ((HW_FLOOR - 2) * Math.log(Math.max(1, m))) / LN_MAX);
const fullToMinutes = (v) => Math.max(1, Math.round(MAX_MIN ** ((100 - v) / 99)));
const minutesToFull = (m) => Math.round(100 - (99 * Math.log(Math.max(1, m))) / LN_MAX);
const hwFromSlider = (v) => Math.max(1, Math.min(100, Math.round(1 + ((v - HW_FLOOR) * 99) / (100 - HW_FLOOR))));
const sliderFromHw = (s) => Math.round(HW_FLOOR + (((Number(s) || 50) - 1) * (100 - HW_FLOOR)) / 99);

/** Where the speed slider sits for this effect (1–100). */
export function sliderFor(fx) {
  if (!isDrift(fx.type)) return sliderFromHw(fx.speed);
  return fx.hwType ? Math.min(HW_FLOOR - 1, Math.max(1, minutesToLow(driftMinutes(fx)))) : Math.max(1, minutesToFull(driftMinutes(fx)));
}

/** The effect after moving the slider to v: may switch between the strip's effect and its slow version. */
export function applySlider(fx, v) {
  v = clampV(v);
  if (isDrift(fx.type) && !fx.hwType) return { ...fx, minutes: fullToMinutes(v) };
  if (v >= HW_FLOOR) {
    if (!isDrift(fx.type)) return { ...fx, speed: hwFromSlider(v) };
    const { hwType, hwColors, minutes, ...rest } = fx;
    return { ...rest, type: hwType, colors: hwColors || fx.colors, speed: hwFromSlider(v) };
  }
  if (isDrift(fx.type)) return { ...fx, minutes: lowToMinutes(v) };
  return { ...slowEquivalent(fx, lowToMinutes(v)), hwType: fx.type, hwColors: fx.colors || [], speed: 1 };
}

/** Text next to the slider. */
export function speedLabel(fx) {
  if (!isDrift(fx.type)) return `${sliderFor(fx)}%`;
  const m = driftMinutes(fx);
  return `${sliderFor(fx)}% · ${m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`} cycle`;
}

/** Variables the drift script needs to drive this strip without knowing about the card. */
export function driftVariables(driver, ctx, fx, segments) {
  const base = {
    driver: driver.id, entity: ctx.entity, segments,
    colors: (fx.colors?.length ? fx.colors : ["#ff5500", "#8200dc"]).slice(0, 8),
    minutes: driftMinutes(fx), flow: fx.type === "drift_flow",
  };
  if (driver.id === "wled") return { ...base, topic: ctx.cfg.wled_topic ? `${ctx.cfg.wled_topic.replace(/\/+$/, "")}/api` : "", leds: wledLedCount(ctx) };
  if (driver.id === "segment_lights") return { ...base, segment_entities: ctx.cfg.segment_entities || [] };
  return { ...base, topic: z2mTopic(ctx) || "" };
}
