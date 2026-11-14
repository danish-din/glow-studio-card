import { test } from "node:test";
import assert from "node:assert/strict";
import { GlowStudioCard } from "../src/card.js";
import { defaultLibrary } from "../src/defaults.js";

const mkHass = (lib) => {
  const calls = [];
  const hass = {
    calls,
    entities: { "light.strip": { entity_id: "light.strip", device_id: "d1" } },
    devices: { d1: { name: "Bed Strip" } },
    states: {
      "light.strip": { state: "on", attributes: { brightness: 200, friendly_name: "Bed strip" } },
      ...(lib ? { "sensor.glow_studio_strip": { state: "1", attributes: lib } } : {}),
    },
    callService: async (domain, service, data) => { calls.push({ domain, service, data }); },
  };
  return hass;
};
const card = (hass, cfg = { entity: "light.strip" }) => {
  const c = new GlowStudioCard();
  c.setConfig(cfg);
  c._hass = hass; // bypass render (no DOM in tests)
  return c;
};
const z2m = (calls) => calls.filter((c) => c.data.topic === "zigbee2mqtt/Bed Strip/set").map((c) => JSON.parse(c.data.payload));

test("setConfig requires an entity and accepts legacy 'light'", () => {
  assert.throws(() => new GlowStudioCard().setConfig({}), /entity/);
  const c = new GlowStudioCard(); c.setConfig({ light: "light.strip" });
  assert.equal(c._cfg.entity, "light.strip");
  assert.equal(c._cfg.library_entity, "sensor.glow_studio_strip");
  assert.equal(c._cfg.library_topic, "glow_studio/strip/library");
});

test("explicit config overrides auto-detection", () => {
  const c = card(mkHass(), { entity: "light.strip", z2m_topic: "z/x/set", segments: 7 });
  assert.equal(c._topic, "z/x/set");
  assert.equal(c._n, 7);
});

test("topic is auto-detected and segments default to 10", () => {
  const c = card(mkHass());
  assert.equal(c._topic, "zigbee2mqtt/Bed Strip/set");
  assert.equal(c._n, 10);
});

test("library is null until set up; setup publishes discovery then library", async () => {
  const h = mkHass();
  const c = card(h);
  assert.equal(c._lib(), null);
  await c._setup();
  assert.equal(h.calls[0].data.topic, "homeassistant/sensor/glow_studio_strip/library/config");
  const disc = JSON.parse(h.calls[0].data.payload);
  assert.equal(disc.json_attributes_topic, "glow_studio/strip/library");
  assert.equal(h.calls[0].data.retain, true);
  const lib = JSON.parse(h.calls[1].data.payload);
  assert.equal(lib.patterns[0].colors.length, 10);
  assert.equal(h.calls[1].data.retain, true);
});

test("running an effect writes colours, segments, speed, then effect", async () => {
  const h = mkHass(defaultLibrary(10));
  const c = card(h);
  const fx = { id: "e0", name: "Woodfire", type: "flicker", colors: ["#ff3a00", "#ff9500"], speed: 55, segments: "all" };
  await c._runEffect(fx);
  const sent = z2m(h.calls);
  assert.deepEqual(sent.map((s) => Object.keys(s)[0]), ["effect_colors", "effect_segments", "effect_speed", "effect"]);
  assert.deepEqual(sent[0].effect_colors[0], { r: 255, g: 58, b: 0 });
  assert.equal(sent[3].effect, "flicker");
  const saved = JSON.parse(h.calls.at(-1).data.payload);
  assert.deepEqual(saved.active, { kind: "effect", id: "e0", name: "Woodfire" });
  assert.equal(saved.version, 2);
});

test("rainbow effects skip custom colours; strip is switched on first when off", async () => {
  const h = mkHass(defaultLibrary(10));
  h.states["light.strip"].state = "off";
  const c = card(h);
  await c._runEffect({ id: "e8", name: "Rainbow", type: "rainbow1", colors: [], speed: 50, segments: "all" }, false);
  const sent = z2m(h.calls);
  assert.deepEqual(sent.map((s) => Object.keys(s)[0]), ["state", "effect_segments", "effect_speed", "effect"]);
  assert.equal(sent[0].state, "ON");
});

test("painting all-black turns the strip off instead of sending black segments", async () => {
  const h = mkHass(defaultLibrary(10));
  const c = card(h);
  c._sendPaint(Array(10).fill("#000000"), 0);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(z2m(h.calls), [{ state: "OFF" }]);
});

test("painting sends segment colours and remembers the current design", async () => {
  const h = mkHass(defaultLibrary(10));
  const c = card(h);
  const colors = Array(10).fill("#ff0000");
  c._sendPaint(colors, 0);
  await new Promise((r) => setTimeout(r, 20));
  const seg = z2m(h.calls).find((s) => s.segment_colors);
  assert.equal(seg.segment_colors.length, 10);
  assert.deepEqual(seg.segment_colors[9], { segment: 10, color: { r: 255, g: 0, b: 0 } });
  const saved = JSON.parse(h.calls.at(-1).data.payload);
  assert.deepEqual(saved.current, colors);
  assert.equal(saved.active.name, "Custom");
});
