// WLED driver: paint via WLED's MQTT JSON API (per-LED "i" ranges), effects via HA's WLED light + colours/speed over MQTT.
import { hex2rgb, isDark } from "../helpers.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const deviceOf = (hass, e) => hass?.devices?.[hass?.entities?.[e]?.device_id];

/** Total LEDs: config `leds`, else the WLED integration's "LED count" sensor, else 30. */
export const wledLedCount = (ctx) => {
  if (Number(ctx.cfg.leds) > 0) return Number(ctx.cfg.leds);
  const dev = ctx.hass?.entities?.[ctx.entity]?.device_id;
  const s = dev && Object.values(ctx.hass.entities).find((x) => x.device_id === dev && /^sensor\..*led_count$/.test(x.entity_id));
  const v = s ? parseInt(ctx.hass.states[s.entity_id]?.state, 10) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 30;
};

/** Spread n painted cells over the LED count as [start, stop, "RRGGBB", ...] ranges. */
export const wledRanges = (colors, leds) => {
  const out = [];
  colors.forEach((c, i) => {
    const start = Math.round((i * leds) / colors.length), stop = Math.round(((i + 1) * leds) / colors.length);
    if (stop > start) out.push(start, stop, c.replace("#", "").toUpperCase());
  });
  return out;
};

const apiTopic = (ctx) => (ctx.cfg.wled_topic ? `${ctx.cfg.wled_topic.replace(/\/+$/, "")}/api` : null);
const effectList = (ctx) => ctx.hass.states[ctx.entity]?.attributes?.effect_list || [];

// Prefer these WLED effects for the starter library (first one the device has wins).
const WANT = [
  ["Woodfire", ["Fire 2012", "Fire Flicker"], ["#ff3a00", "#ff9500", "#b31b00"], 55],
  ["Candlelight", ["Candle", "Candle Multi"], ["#ff8c1a", "#ffb04d", "#ff7a00"], 30],
  ["Ocean waves", ["Pacifica", "Lake", "Waves"], ["#0040ff", "#00b4ff", "#00ffd5"], 25],
  ["Aurora", ["Aurora", "Colorwaves"], ["#00ff9c", "#00d4ff", "#7a00ff"], 15],
  ["Lava lamp", ["Plasma", "Noise Pal", "Lava"], ["#ff0040", "#ff5a00", "#c000ff"], 15],
  ["Starry night", ["Twinklefox", "Twinkle", "Starburst"], ["#0a1aff", "#ffffff", "#3a6bff"], 30],
  ["Breathe", ["Breathe"], ["#ff2a00", "#7a0f00", "#000000"], 20],
  ["Rainbow", ["Rainbow", "Colorloop"], [], 50],
  ["Fireworks", ["Fireworks", "Fireworks Starburst"], ["#ff0000", "#00ff00", "#0000ff"], 60],
  ["Disco", ["Rain", "Dancing Shadows", "Juggle"], ["#ff0000", "#00ff00", "#ff00ff"], 85],
];

export const wled = {
  id: "wled", label: "WLED", beta: true,
  match: (hass, e) => /wled/i.test(deviceOf(hass, e)?.manufacturer || "") || /^light\.wled/.test(e),
  segments: (ctx) => Math.max(1, Math.min(wledLedCount(ctx), Number(ctx.cfg.segments) || 20)),
  problem: (ctx) => (apiTopic(ctx) ? null : "Painting needs WLED's MQTT topic: enable MQTT in WLED (Sync settings) and set wled_topic, e.g. wled/bedroom."),
  styles: (ctx) => effectList(ctx).filter((n) => n !== "Solid").map((n) => ({ id: n, label: n })),
  caps: { colors: 3, speed: true, segments: false },
  paint: async (ctx, colors) => {
    const t = apiTopic(ctx); if (!t) throw new Error("wled_topic not set");
    if (!colors.some((c) => !isDark(c))) return ctx.mqtt(t, { on: false });
    return ctx.mqtt(t, { on: true, seg: [{ id: 0, fx: 0, i: wledRanges(colors, wledLedCount(ctx)) }] });
  },
  run: async (ctx, fx) => {
    const t = apiTopic(ctx);
    if (t) {
      const seg = { id: 0, sx: Math.round(((Number(fx.speed) || 50) / 100) * 255) };
      if (fx.colors?.length) seg.col = fx.colors.slice(0, 3).map((c) => { const { r, g, b } = hex2rgb(c); return [r, g, b]; });
      await ctx.mqtt(t, { on: true, seg: [seg] });
      await wait(150);
    }
    await ctx.call("light", "turn_on", { entity_id: ctx.entity, effect: fx.type });
  },
  defaultEffects: (ctx) => {
    const have = new Set(effectList(ctx));
    return WANT.map(([name, options, colors, speed]) => {
      const type = options.find((o) => have.has(o));
      return type ? [name, type, colors, speed] : null;
    }).filter(Boolean);
  },
};
