// Zigbee2MQTT drivers: Aqara T1 strip, Aqara T1M / T1 ceiling ring, Philips Hue gradient.
import { hex2rgb, isDark, segString } from "../helpers.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const STEP_MS = 350; // gap between Z2M writes when starting an effect

const deviceOf = (hass, entityId) => hass?.devices?.[hass?.entities?.[entityId]?.device_id];
const modelOf = (hass, entityId) => { const d = deviceOf(hass, entityId); return `${d?.model_id || ""} ${d?.model || ""}`; };

/** Z2M set topic from the device name (Z2M names HA devices after their friendly name). */
export const z2mTopic = (ctx) =>
  ctx.cfg.z2m_topic || (deviceOf(ctx.hass, ctx.entity)?.name ? `${ctx.cfg.z2m_base || "zigbee2mqtt"}/${deviceOf(ctx.hass, ctx.entity).name}/set` : null);

const ensureOn = async (ctx) => {
  if (!ctx.isOn()) { await ctx.mqtt(z2mTopic(ctx), { state: "ON", brightness: 200 }); await wait(STEP_MS); }
};
const z2mProblem = (ctx) => (z2mTopic(ctx) ? null : "Couldn't work out the Zigbee2MQTT topic. Set z2m_topic in the card config.");

/* ---------- Aqara (T1 strip + T1M ceiling ring share the segment/effect protocol) ---------- */
const aqaraPaint = async (ctx, colors) => {
  if (!colors.some((c) => !isDark(c))) return ctx.mqtt(z2mTopic(ctx), { state: "OFF" });
  if (!ctx.isOn()) await ctx.mqtt(z2mTopic(ctx), { state: "ON", brightness: 200 });
  return ctx.mqtt(z2mTopic(ctx), { segment_colors: colors.map((c, i) => ({ segment: i + 1, color: hex2rgb(c) })) });
};
const aqaraRun = (withSegments) => async (ctx, fx) => {
  const t = z2mTopic(ctx);
  await ensureOn(ctx);
  if (fx.colors?.length) { await ctx.mqtt(t, { effect_colors: fx.colors.slice(0, 8).map(hex2rgb) }); await wait(STEP_MS); }
  if (withSegments) { await ctx.mqtt(t, { effect_segments: segString(fx) }); await wait(STEP_MS); }
  await ctx.mqtt(t, { effect_speed: Number(fx.speed) || 50 }); await wait(STEP_MS);
  await ctx.mqtt(t, { effect: fx.type });
};

export const aqaraT1 = {
  id: "aqara_t1", label: "Aqara LED Strip T1 (Zigbee2MQTT)", beta: false,
  match: (hass, e) => /LGYCDD01LM|LED Strip T1/i.test(modelOf(hass, e)),
  segments: (ctx) => {
    if (Number(ctx.cfg.segments) > 0) return Number(ctx.cfg.segments);
    const dev = ctx.hass?.entities?.[ctx.entity]?.device_id;
    const len = dev && Object.values(ctx.hass.entities).find((x) => x.device_id === dev && /^number\..*_length$/.test(x.entity_id));
    const m = len ? parseFloat(ctx.hass.states[len.entity_id]?.state) : NaN;
    return Number.isFinite(m) && m > 0 ? Math.round(m * 5) : 10;
  },
  problem: z2mProblem,
  styles: () => [
    { id: "flicker", label: "Flicker" }, { id: "breathing", label: "Breathe" }, { id: "chasing", label: "Chase" },
    { id: "dash", label: "Dash" }, { id: "hopping", label: "Hop" }, { id: "flash", label: "Flash" },
    { id: "rainbow1", label: "Rainbow", colors: 0 }, { id: "rainbow2", label: "Rainbow flow", colors: 0 },
  ],
  caps: { colors: 8, speed: true, segments: true },
  paint: aqaraPaint,
  run: aqaraRun(true),
  setSpeed: (ctx, fx) => ctx.mqtt(z2mTopic(ctx), { effect_speed: Number(fx.speed) || 50 }),
  defaultEffects: () => [
    ["Woodfire", "flicker", ["#ff3a00", "#ff6a00", "#ff9500", "#b31b00", "#ffb347"], 55],
    ["Candlelight", "flicker", ["#ff8c1a", "#ffb04d", "#ff7a00"], 30],
    ["Ember glow", "breathing", ["#ff2a00", "#7a0f00"], 20],
    ["Ocean waves", "chasing", ["#0040ff", "#00b4ff", "#00ffd5", "#003080"], 25],
    ["Aurora", "chasing", ["#00ff9c", "#00d4ff", "#7a00ff", "#00ff5a"], 15],
    ["Lava lamp", "breathing", ["#ff0040", "#ff5a00", "#c000ff"], 15],
    ["Starry night", "dash", ["#0a1aff", "#ffffff", "#3a6bff"], 30],
    ["Sunset drift", "breathing", ["#ffb300", "#ff5500", "#8200dc"], 10],
    ["Rainbow", "rainbow1", [], 50],
    ["Rainbow flow", "rainbow2", [], 40],
    ["Disco", "hopping", ["#ff0000", "#00ff00", "#0000ff", "#ff00ff", "#ffff00", "#00ffff"], 85],
    ["Heartbeat", "breathing", ["#ff0022"], 75],
    ["Christmas", "chasing", ["#ff0000", "#00c000", "#ffffff"], 40],
    ["Police", "flash", ["#ff0000", "#0000ff"], 90],
  ],
};

export const aqaraT1M = {
  id: "aqara_t1m", label: "Aqara Ceiling Light T1M / T1 ring (Zigbee2MQTT)", beta: true,
  match: (hass, e) => /CL-L02D|HCXDD12LM|Ceiling light T1/i.test(modelOf(hass, e)),
  segments: (ctx) => Number(ctx.cfg.segments) || (/HCXDD12LM/i.test(modelOf(ctx.hass, ctx.entity)) ? 20 : 26),
  problem: z2mProblem,
  styles: () => [
    { id: "flow1", label: "Flow" }, { id: "flow2", label: "Flow 2" }, { id: "fading", label: "Fade" },
    { id: "hopping", label: "Hop" }, { id: "breathing", label: "Breathe" }, { id: "rolling", label: "Roll" },
  ],
  caps: { colors: 8, speed: true, segments: false },
  paint: aqaraPaint,
  run: aqaraRun(false),
  setSpeed: (ctx, fx) => ctx.mqtt(z2mTopic(ctx), { effect_speed: Number(fx.speed) || 50 }),
  defaultEffects: () => [
    ["Woodfire", "fading", ["#ff3a00", "#ff6a00", "#ff9500", "#b31b00"], 60],
    ["Candlelight", "breathing", ["#ff8c1a", "#ffb04d"], 30],
    ["Ocean waves", "flow1", ["#0040ff", "#00b4ff", "#00ffd5"], 25],
    ["Aurora", "flow2", ["#00ff9c", "#00d4ff", "#7a00ff"], 15],
    ["Lava lamp", "fading", ["#ff0040", "#ff5a00", "#c000ff"], 15],
    ["Rainbow", "rolling", ["#ff0000", "#ffd000", "#00ff6a", "#0080ff", "#b000ff"], 40],
    ["Disco", "hopping", ["#ff0000", "#00ff00", "#0000ff", "#ff00ff"], 85],
    ["Heartbeat", "breathing", ["#ff0022"], 75],
  ],
};

/* ---------- Philips Hue gradient (1–9 colour points, Hue's own effects) ---------- */
const HUE_EFFECTS = ["candle", "fireplace", "colorloop", "sunrise", "sunset", "sparkle", "opal", "glisten", "underwater", "cosmos", "sunbeam", "enchant"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const hueGradient = {
  id: "hue_gradient", label: "Philips Hue gradient (Zigbee2MQTT)", beta: true,
  match: (hass, e) => /gradient/i.test(modelOf(hass, e)),
  segments: (ctx) => Math.min(9, Math.max(1, Number(ctx.cfg.segments) || 5)),
  problem: z2mProblem,
  styles: () => HUE_EFFECTS.map((id) => ({ id, label: id === "colorloop" ? "Colour loop" : cap(id), colors: 0 })),
  caps: { colors: 0, speed: true, segments: false },
  paint: async (ctx, colors) => {
    if (!colors.some((c) => !isDark(c))) return ctx.mqtt(z2mTopic(ctx), { state: "OFF" });
    return ctx.mqtt(z2mTopic(ctx), { state: "ON", gradient: colors.slice(0, 9) });
  },
  run: async (ctx, fx) => {
    await ensureOn(ctx);
    await ctx.mqtt(z2mTopic(ctx), { effect: fx.type, effect_speed: Math.max(0, Math.min(1, (Number(fx.speed) || 50) / 100)) });
  },
  setSpeed: (ctx, fx) => ctx.mqtt(z2mTopic(ctx), { effect_speed: Math.max(0, Math.min(1, (Number(fx.speed) || 50) / 100)) }),
  defaultEffects: () => [
    ["Woodfire", "fireplace", [], 55], ["Candlelight", "candle", [], 30], ["Sunrise", "sunrise", [], 20],
    ["Sunset", "sunset", [], 20], ["Ocean", "underwater", [], 30], ["Starry night", "cosmos", [], 30],
    ["Sparkle", "sparkle", [], 50], ["Opal", "opal", [], 30], ["Glisten", "glisten", [], 40],
    ["Enchant", "enchant", [], 40], ["Sunbeam", "sunbeam", [], 30], ["Colour loop", "colorloop", [], 50],
  ],
};
