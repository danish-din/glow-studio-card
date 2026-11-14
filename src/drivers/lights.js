// Generic driver: any integration that exposes each segment as its own HA light (govee2mqtt, WLED segments, Tuya…).
import { hex2rgb, isDark } from "../helpers.js";

const list = (ctx) => (Array.isArray(ctx.cfg.segment_entities) ? ctx.cfg.segment_entities : []);

export const segmentLights = {
  id: "segment_lights", label: "Segment lights (any brand)", beta: true,
  match: (_hass, _e, cfg) => Array.isArray(cfg?.segment_entities) && cfg.segment_entities.length > 0,
  segments: (ctx) => Math.max(1, list(ctx).length),
  problem: (ctx) => (list(ctx).length ? null : "Add segment_entities: the light for each segment, in order along the strip."),
  styles: (ctx) => (ctx.hass.states[ctx.entity]?.attributes?.effect_list || []).map((n) => ({ id: n, label: n })),
  caps: { colors: 0, speed: false, segments: false },
  paint: (ctx, colors) => Promise.all(list(ctx).map((e, i) => {
    const c = colors[i] || "#000000";
    if (isDark(c)) return ctx.call("light", "turn_off", { entity_id: e });
    const { r, g, b } = hex2rgb(c);
    return ctx.call("light", "turn_on", { entity_id: e, rgb_color: [r, g, b] });
  })),
  run: (ctx, fx) => ctx.call("light", "turn_on", { entity_id: ctx.entity, effect: fx.type }),
  setSpeed: async () => {}, // generic lights expose no effect speed
  defaultEffects: (ctx) => (ctx.hass.states[ctx.entity]?.attributes?.effect_list || []).slice(0, 12).map((n) => [n, n, [], 50]),
};
