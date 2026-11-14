// Driver tests: exact payloads each strip family receives, detection and segment counts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDriver, styleInfo, DRIVERS } from "../src/drivers/index.js";
import { aqaraT1, aqaraT1M, hueGradient } from "../src/drivers/zigbee2mqtt.js";
import { wled, wledRanges, wledLedCount } from "../src/drivers/wled.js";
import { segmentLights } from "../src/drivers/lights.js";
import { editorSchema } from "../src/editor.js";

function mkCtx({ model = "", model_id = "", manufacturer = "", cfg = {}, on = true, effectList, extraEntities = {}, extraStates = {} } = {}) {
  const sent = [], calls = [];
  const hass = {
    entities: { "light.s": { entity_id: "light.s", device_id: "d1" }, ...extraEntities },
    devices: { d1: { name: "My Strip", model, model_id, manufacturer } },
    states: { "light.s": { state: on ? "on" : "off", attributes: effectList ? { effect_list: effectList } : {} }, ...extraStates },
  };
  const ctx = {
    hass, cfg, entity: "light.s", isOn: () => on,
    mqtt: async (topic, obj) => { sent.push({ topic, obj }); },
    call: async (domain, service, data) => { calls.push({ domain, service, data }); },
  };
  return { ctx, sent, calls };
}
const fast = async (p) => { const t = setTimeout; globalThis.setTimeout = (fn) => t(fn, 0); try { return await p(); } finally { globalThis.setTimeout = t; } };

test("auto-detection picks the right driver from the device", () => {
  const pick = (o, cfg = {}) => pickDriver(mkCtx(o).ctx.hass, { entity: "light.s", ...cfg })?.id;
  assert.equal(pick({ model: "LED Strip T1", model_id: "LGYCDD01LM" }), "aqara_t1");
  assert.equal(pick({ model: "Ceiling light T1M", model_id: "CL-L02D" }), "aqara_t1m");
  assert.equal(pick({ model_id: "HCXDD12LM" }), "aqara_t1m");
  assert.equal(pick({ model: "Hue gradient lightstrip", model_id: "929002994901" }), "hue_gradient");
  assert.equal(pick({ manufacturer: "WLED" }), "wled");
  assert.equal(pick({}, { segment_entities: ["light.a"] }), "segment_lights");
  assert.equal(pick({ model: "Bulb" }), undefined);
  assert.equal(pick({ model: "Bulb" }, { driver: "wled" }), "wled");
  assert.equal(pick({ model_id: "LGYCDD01LM" }, { driver: "auto" }), "aqara_t1");
  assert.equal(pick({}, { driver: "nope" }), undefined);
});

test("Aqara T1: segments from strip length, topic from device name, payload order", async () => {
  const { ctx, sent } = mkCtx({
    model_id: "LGYCDD01LM", on: false,
    extraEntities: { "number.s_length": { entity_id: "number.s_length", device_id: "d1" } },
    extraStates: { "number.s_length": { state: "3" } },
  });
  assert.equal(aqaraT1.segments(ctx), 15);
  assert.equal(aqaraT1.segments({ ...ctx, cfg: { segments: 7 } }), 7);
  assert.equal(aqaraT1.problem(ctx), null);
  await fast(() => aqaraT1.run(ctx, { type: "flicker", colors: ["#ff3a00"], speed: 55, segments: "odd" }));
  assert.ok(sent.every((m) => m.topic === "zigbee2mqtt/My Strip/set"));
  assert.deepEqual(sent.map((m) => Object.keys(m.obj)[0]), ["state", "effect_colors", "effect_segments", "effect_speed", "effect"]);
  assert.equal(sent[2].obj.effect_segments, "odd");
  sent.length = 0;
  await aqaraT1.paint(ctx, ["#ff0000", "#000000"]);
  assert.deepEqual(sent.at(-1).obj.segment_colors[1], { segment: 2, color: { r: 0, g: 0, b: 0 } });
  sent.length = 0;
  await aqaraT1.paint(ctx, ["#000000", "#000000"]);
  assert.deepEqual(sent, [{ topic: "zigbee2mqtt/My Strip/set", obj: { state: "OFF" } }]);
});

test("Aqara T1: rainbow styles send no custom colours; missing topic is reported", async () => {
  const { ctx, sent } = mkCtx({ model_id: "LGYCDD01LM" });
  await fast(() => aqaraT1.run(ctx, { type: "rainbow1", colors: [], speed: 50 }));
  assert.ok(!sent.some((m) => "effect_colors" in m.obj));
  assert.equal(styleInfo(aqaraT1, ctx, "rainbow1").colors, 0);
  assert.equal(styleInfo(aqaraT1, ctx, "flicker").colors, 8);
  const noDev = { ...ctx, hass: { ...ctx.hass, entities: {} } };
  assert.match(aqaraT1.problem(noDev), /z2m_topic/);
  assert.equal(aqaraT1.problem({ ...noDev, cfg: { z2m_topic: "x/set" } }), null);
});

test("Aqara T1M: 26 or 20 segments, no effect_segments", async () => {
  assert.equal(aqaraT1M.segments(mkCtx({ model_id: "CL-L02D" }).ctx), 26);
  assert.equal(aqaraT1M.segments(mkCtx({ model_id: "HCXDD12LM" }).ctx), 20);
  const { ctx, sent } = mkCtx({ model_id: "CL-L02D" });
  await fast(() => aqaraT1M.run(ctx, { type: "flow1", colors: ["#0000ff"], speed: 30 }));
  assert.deepEqual(sent.map((m) => Object.keys(m.obj)[0]), ["effect_colors", "effect_speed", "effect"]);
  assert.equal(sent.at(-1).obj.effect, "flow1");
});

test("Hue gradient: up to 9 colour points, effect speed scaled 0–1", async () => {
  const { ctx, sent } = mkCtx({ model: "Hue gradient lightstrip" });
  assert.equal(hueGradient.segments(ctx), 5);
  assert.equal(hueGradient.segments({ ...ctx, cfg: { segments: 20 } }), 9);
  await hueGradient.paint(ctx, Array(12).fill("#ff0000"));
  assert.equal(sent[0].obj.gradient.length, 9);
  assert.equal(sent[0].obj.state, "ON");
  await fast(() => hueGradient.run(ctx, { type: "fireplace", colors: [], speed: 40 }));
  assert.deepEqual(sent.at(-1).obj, { effect: "fireplace", effect_speed: 0.4 });
  await hueGradient.paint(ctx, ["#000000"]);
  assert.deepEqual(sent.at(-1).obj, { state: "OFF" });
});

test("WLED: cells spread over the LED count as index ranges", () => {
  assert.deepEqual(wledRanges(["#ff0000", "#00ff00"], 10), [0, 5, "FF0000", 5, 10, "00FF00"]);
  assert.deepEqual(wledRanges(["#ff0000", "#00ff00", "#0000ff"], 2), [0, 1, "FF0000", 1, 2, "0000FF"]);
  const auto = mkCtx({ manufacturer: "WLED",
    extraEntities: { "sensor.s_led_count": { entity_id: "sensor.s_led_count", device_id: "d1" } },
    extraStates: { "sensor.s_led_count": { state: "144" } } }).ctx;
  assert.equal(wledLedCount(auto), 144);
  assert.equal(wledLedCount({ ...auto, cfg: { leds: 60 } }), 60);
  assert.equal(wledLedCount(mkCtx({}).ctx), 30);
  assert.equal(wled.segments({ ...auto, cfg: { segments: 500 } }), 144);
  assert.equal(wled.segments(auto), 20);
});

test("WLED: paint over MQTT JSON API; needs wled_topic", async () => {
  const { ctx, sent } = mkCtx({ manufacturer: "WLED", cfg: { wled_topic: "wled/bed/", leds: 4 } });
  assert.equal(wled.problem(ctx), null);
  await wled.paint(ctx, ["#ff0000", "#0000ff"]);
  assert.deepEqual(sent[0], { topic: "wled/bed/api", obj: { on: true, seg: [{ id: 0, fx: 0, i: [0, 2, "FF0000", 2, 4, "0000FF"] }] } });
  await wled.paint(ctx, ["#000000"]);
  assert.deepEqual(sent.at(-1).obj, { on: false });
  const bare = mkCtx({ manufacturer: "WLED" }).ctx;
  assert.match(wled.problem(bare), /wled_topic/);
  await assert.rejects(() => wled.paint(bare, ["#ff0000"]), /wled_topic/);
});

test("WLED: effects run through HA with colours + speed over MQTT; starters follow the device's effect list", async () => {
  const list = ["Solid", "Fire 2012", "Candle", "Pacifica", "Rainbow", "Twinklefox"];
  const { ctx, sent, calls } = mkCtx({ manufacturer: "WLED", cfg: { wled_topic: "wled/bed" }, effectList: list });
  assert.deepEqual(wled.styles(ctx).map((s) => s.id), list.slice(1));
  await fast(() => wled.run(ctx, { type: "Fire 2012", colors: ["#ff0000", "#00ff00", "#0000ff", "#ffffff"], speed: 100 }));
  assert.deepEqual(sent[0].obj, { on: true, seg: [{ id: 0, sx: 255, col: [[255, 0, 0], [0, 255, 0], [0, 0, 255]] }] });
  assert.deepEqual(calls[0], { domain: "light", service: "turn_on", data: { entity_id: "light.s", effect: "Fire 2012" } });
  const names = wled.defaultEffects(ctx).map(([n, t]) => `${n}=${t}`);
  assert.deepEqual(names, ["Woodfire=Fire 2012", "Candlelight=Candle", "Ocean waves=Pacifica", "Starry night=Twinklefox", "Rainbow=Rainbow"]);
  const noMqtt = mkCtx({ manufacturer: "WLED", effectList: list });
  await fast(() => wled.run(noMqtt.ctx, { type: "Candle", colors: [], speed: 50 }));
  assert.equal(noMqtt.sent.length, 0);
  assert.equal(noMqtt.calls[0].data.effect, "Candle");
});

test("Segment lights: one HA call per segment, black switches it off", async () => {
  const { ctx, calls } = mkCtx({ cfg: { segment_entities: ["light.a", "light.b", "light.c"] }, effectList: ["Twinkle", "Wave"] });
  assert.equal(segmentLights.segments(ctx), 3);
  assert.equal(segmentLights.problem(ctx), null);
  await segmentLights.paint(ctx, ["#ff0000", "#000000"]);
  assert.deepEqual(calls.map((c) => [c.service, c.data.entity_id, c.data.rgb_color]), [
    ["turn_on", "light.a", [255, 0, 0]], ["turn_off", "light.b", undefined], ["turn_off", "light.c", undefined]]);
  await segmentLights.run(ctx, { type: "Wave" });
  assert.deepEqual(calls.at(-1).data, { entity_id: "light.s", effect: "Wave" });
  assert.deepEqual(segmentLights.defaultEffects(ctx).map((e) => e[0]), ["Twinkle", "Wave"]);
  assert.match(segmentLights.problem(mkCtx({}).ctx), /segment_entities/);
  assert.equal(styleInfo(segmentLights, ctx, "Wave").colors, 0);
});

test("every driver implements the full interface", () => {
  for (const d of DRIVERS) {
    for (const k of ["id", "label", "match", "segments", "problem", "styles", "paint", "run", "defaultEffects", "caps"]) assert.ok(k in d, `${d.id}.${k}`);
    assert.equal(typeof d.beta, "boolean");
  }
});

test("editor shows only the fields the strip type needs", () => {
  const names = (cfg, o = {}) => editorSchema({ entity: "light.s", ...cfg }, mkCtx(o).ctx.hass).map((s) => s.name);
  assert.ok(names({}, { model_id: "LGYCDD01LM" }).includes("z2m_topic"));
  assert.ok(!names({}, { model_id: "LGYCDD01LM" }).includes("wled_topic"));
  assert.ok(names({ driver: "wled" }).includes("wled_topic"));
  assert.ok(names({ driver: "wled" }).includes("leds"));
  assert.ok(names({ driver: "segment_lights" }).includes("segment_entities"));
  assert.ok(!names({ driver: "segment_lights" }).includes("segments"));
  assert.ok(names({}, { model: "Bulb" }).includes("segment_entities"), "unknown lights get offered segment lights");
});
