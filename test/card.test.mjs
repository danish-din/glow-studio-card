import { test } from "node:test";
import assert from "node:assert/strict";
import { GlowStudioCard } from "../src/card.js";
import { defaultLibrary } from "../src/defaults.js";
import { pickDriver } from "../src/drivers/index.js";

const mkHass = (lib, device = { name: "Bed Strip", model: "LED Strip T1", model_id: "LGYCDD01LM" }) => {
  const calls = [];
  return {
    calls,
    entities: { "light.strip": { entity_id: "light.strip", device_id: "d1" } },
    devices: { d1: device },
    states: {
      "light.strip": { state: "on", attributes: { brightness: 200, friendly_name: "Bed strip" } },
      ...(lib ? { "sensor.glow_studio_strip": { state: "1", attributes: lib } } : {}),
    },
    callService: async (domain, service, data) => { calls.push({ domain, service, data }); },
  };
};
const card = (hass, cfg = { entity: "light.strip" }) => {
  const c = new GlowStudioCard();
  c.setConfig(cfg);
  c._hass = hass; // bypass render (no DOM in tests)
  c._driver = pickDriver(hass, c._cfg);
  return c;
};
const z2m = (calls) => calls.filter((c) => c.data.topic === "zigbee2mqtt/Bed Strip/set").map((c) => JSON.parse(c.data.payload));
const settle = () => new Promise((r) => setTimeout(r, 20));

test("setConfig requires an entity and accepts legacy 'light'", () => {
  assert.throws(() => new GlowStudioCard().setConfig({}), /entity/);
  const c = new GlowStudioCard(); c.setConfig({ light: "light.strip" });
  assert.equal(c._cfg.entity, "light.strip");
  assert.equal(c._cfg.library_entity, "sensor.glow_studio_strip");
  assert.equal(c._cfg.library_topic, "glow_studio/strip/library");
});

test("the T1 is recognised and segments can be overridden", () => {
  assert.equal(card(mkHass())._driver.id, "aqara_t1");
  assert.equal(card(mkHass())._n, 10);
  assert.equal(card(mkHass(), { entity: "light.strip", segments: 7 })._n, 7);
});

test("unknown lights get no driver unless one is chosen", () => {
  const hass = mkHass(null, { name: "Bulb", model: "Bulb" });
  assert.equal(card(hass)._driver, null);
  assert.equal(card(hass, { entity: "light.strip", driver: "wled" })._driver.id, "wled");
});

test("setup publishes discovery, then a library seeded with the driver's effects", async () => {
  const h = mkHass();
  const c = card(h);
  assert.equal(c._lib(), null);
  const t = setTimeout; globalThis.setTimeout = (fn) => t(fn, 0);
  try { await c._setup(); } finally { globalThis.setTimeout = t; }
  assert.equal(h.calls[0].data.topic, "homeassistant/sensor/glow_studio_strip/library/config");
  assert.equal(JSON.parse(h.calls[0].data.payload).json_attributes_topic, "glow_studio/strip/library");
  const lib = JSON.parse(h.calls[1].data.payload);
  assert.equal(lib.patterns[0].colors.length, 10);
  assert.equal(lib.effects[0].name, "Woodfire");
  assert.ok(h.calls.every((x) => x.data.retain === true));
});

test("running an effect goes through the driver and is remembered", async () => {
  const h = mkHass(defaultLibrary(10));
  const c = card(h);
  const t = setTimeout; globalThis.setTimeout = (fn) => t(fn, 0);
  try { await c._runEffect({ id: "e0", name: "Woodfire", type: "flicker", colors: ["#ff3a00"], speed: 55, segments: "all" }); }
  finally { globalThis.setTimeout = t; }
  assert.deepEqual(z2m(h.calls).map((s) => Object.keys(s)[0]), ["effect_colors", "effect_segments", "effect_speed", "effect"]);
  const saved = JSON.parse(h.calls.at(-1).data.payload);
  assert.deepEqual(saved.active, { kind: "effect", id: "e0", name: "Woodfire" });
});

test("painting sends segment colours and remembers the design", async () => {
  const h = mkHass(defaultLibrary(10));
  const c = card(h);
  const colors = Array(10).fill("#ff0000");
  c._sendPaint(colors, 0);
  await settle();
  const seg = z2m(h.calls).find((s) => s.segment_colors);
  assert.equal(seg.segment_colors.length, 10);
  const saved = JSON.parse(h.calls.at(-1).data.payload);
  assert.deepEqual(saved.current, colors);
  assert.equal(saved.active.name, "Custom");
});

test("driver errors are caught and shown instead of thrown", async () => {
  const h = mkHass(defaultLibrary(10), { name: "Desk", manufacturer: "WLED" });
  const c = card(h);
  c._render = () => {};
  c._sendPaint(Array(10).fill("#ff0000"), 0);
  await settle();
  assert.match(c._error, /wled_topic/);
});
