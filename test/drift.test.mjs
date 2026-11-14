// Slow (drift) effects and the quick speed control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { driftVariables, driftMinutes, isDrift, DRIFT_DEFAULTS, DRIFT_STYLES } from "../src/drift.js";
import { styleInfo, allStyles } from "../src/drivers/index.js";
import { aqaraT1, hueGradient } from "../src/drivers/zigbee2mqtt.js";
import { wled } from "../src/drivers/wled.js";
import { segmentLights } from "../src/drivers/lights.js";
import { previewKind } from "../src/preview.js";
import { speedBar } from "../src/views.js";
import { GlowStudioCard } from "../src/card.js";
import { defaultLibrary } from "../src/defaults.js";
import { pickDriver } from "../src/drivers/index.js";

const ctxFor = (cfg = {}) => ({
  hass: { entities: { "light.s": { entity_id: "light.s", device_id: "d1" } }, devices: { d1: { name: "Bed Strip", model_id: "LGYCDD01LM" } }, states: { "light.s": { state: "on", attributes: {} } } },
  cfg, entity: "light.s",
});

test("drift helpers", () => {
  assert.ok(isDrift("drift") && isDrift("drift_flow") && !isDrift("flicker") && !isDrift(undefined));
  assert.equal(driftMinutes({}), 30);
  assert.equal(driftMinutes({ minutes: 0.2 }), 1);
  assert.equal(driftMinutes({ minutes: 999 }), 240);
  for (const [name, type, colors, minutes] of DRIFT_DEFAULTS) {
    assert.ok(isDrift(type), name);
    assert.ok(colors.length >= 2 && colors.length <= 8);
    assert.ok(minutes >= 5);
  }
});

test("drift variables carry what each strip type needs", () => {
  const fx = { type: "drift_flow", colors: ["#ff0000", "#0000ff"], minutes: 30 };
  const t1 = driftVariables(aqaraT1, ctxFor(), fx, 10);
  assert.deepEqual(t1, { driver: "aqara_t1", entity: "light.s", segments: 10, colors: fx.colors, minutes: 30, flow: true, topic: "zigbee2mqtt/Bed Strip/set" });
  assert.equal(driftVariables(hueGradient, ctxFor(), { ...fx, type: "drift" }, 5).flow, false);
  const w = driftVariables(wled, ctxFor({ wled_topic: "wled/desk/", leds: 60 }), fx, 20);
  assert.equal(w.topic, "wled/desk/api"); assert.equal(w.leds, 60);
  assert.equal(driftVariables(wled, ctxFor(), fx, 20).topic, "");
  const sl = driftVariables(segmentLights, ctxFor({ segment_entities: ["light.a"] }), { type: "drift" }, 1);
  assert.deepEqual(sl.segment_entities, ["light.a"]);
  assert.deepEqual(sl.colors, ["#ff5500", "#8200dc"], "falls back to a default palette");
});

test("every driver offers the slow styles; style info switches speed for minutes", () => {
  for (const d of [aqaraT1, hueGradient, wled, segmentLights]) {
    const ids = allStyles(d, ctxFor()).map((s) => s.id);
    assert.ok(ids.includes("drift") && ids.includes("drift_flow"), d.id);
  }
  assert.deepEqual(styleInfo(aqaraT1, ctxFor(), "drift"), { label: "Slow drift", colors: 8, speed: false, minutes: true, segments: false });
  assert.equal(styleInfo(aqaraT1, ctxFor(), "flicker").minutes, false);
  assert.equal(DRIFT_STYLES.length, 2);
});

test("preview animates drift slowly as a cross-fade or a flow", () => {
  assert.equal(previewKind("drift"), "rainbow1");
  assert.equal(previewKind("drift_flow"), "chasing");
});

test("speed bar: slider for hardware effects, minute chips for slow ones, nothing without speed", () => {
  assert.match(speedBar({ speed: 20 }, { speed: true, minutes: false }, [5, 30]), /value="20" data-fx-speed/);
  const chips = speedBar({ minutes: 30 }, { minutes: true }, [5, 30, 120]);
  assert.match(chips, /data-fx-min="30"/);
  assert.match(chips, /chip on" data-fx-min="30"/);
  assert.match(chips, /2 h/);
  assert.equal(speedBar({}, { speed: false, minutes: false }, [5]), "");
});

test("speed control setSpeed sends only the speed", async () => {
  const sent = [];
  const ctx = { ...ctxFor({ wled_topic: "wled/d" }), mqtt: async (topic, obj) => sent.push({ topic, obj }) };
  await aqaraT1.setSpeed(ctx, { speed: 7 });
  await hueGradient.setSpeed(ctx, { speed: 40 });
  await wled.setSpeed(ctx, { speed: 100 });
  await segmentLights.setSpeed(ctx, { speed: 5 });
  assert.deepEqual(sent.map((m) => m.obj), [{ effect_speed: 7 }, { effect_speed: 0.4 }, { seg: [{ id: 0, sx: 255 }] }]);
});

/* ---------- card integration ---------- */
function mkCard({ scriptState } = {}) {
  const lib = defaultLibrary(10, aqaraT1.defaultEffects());
  lib.effects.push({ id: "d0", name: "Slow sunset", type: "drift", colors: ["#ff0000", "#0000ff"], minutes: 30, speed: 50, segments: "all" });
  const calls = [];
  const hass = {
    entities: { "light.strip": { entity_id: "light.strip", device_id: "d1" } },
    devices: { d1: { name: "Bed Strip", model_id: "LGYCDD01LM" } },
    states: {
      "light.strip": { state: "on", attributes: { brightness: 200 } },
      "sensor.glow_studio_strip": { state: "1", attributes: lib },
      ...(scriptState ? { "script.glow_studio_drift": { state: scriptState, attributes: {} } } : {}),
    },
    callService: async (domain, service, data) => { calls.push({ domain, service, data }); },
  };
  const c = new GlowStudioCard();
  c.setConfig({ entity: "light.strip" });
  c._hass = hass; c._driver = pickDriver(hass, c._cfg); c._render = () => {};
  return { c, calls, lib };
}
const fastTimers = async (fn) => { const t = setTimeout; globalThis.setTimeout = (f) => t(f, 0); try { await fn(); } finally { globalThis.setTimeout = t; } };

test("slow effects start the drift script with the strip's details", async () => {
  const { c, calls } = mkCard({ scriptState: "off" });
  await c._runEffect(c._lib().effects.find((e) => e.id === "d0"));
  const run = calls.find((x) => x.domain === "script" && x.service === "turn_on");
  assert.equal(run.data.entity_id, "script.glow_studio_drift");
  assert.equal(run.data.variables.driver, "aqara_t1");
  assert.equal(run.data.variables.minutes, 30);
  assert.equal(run.data.variables.topic, "zigbee2mqtt/Bed Strip/set");
  assert.ok(!calls.some((x) => x.data?.topic === "zigbee2mqtt/Bed Strip/set"), "no hardware effect sent");
});

test("slow effects explain how to install the script when it's missing", async () => {
  const { c } = mkCard();
  await c._runEffect(c._lib().effects.find((e) => e.id === "d0"));
  assert.match(c._error, /drift script/);
});

test("hardware effects and painting stop a running drift first", async () => {
  const { c, calls } = mkCard({ scriptState: "on" });
  await fastTimers(() => c._runEffect(c._lib().effects[0]));
  assert.ok(calls.findIndex((x) => x.service === "turn_off" && x.domain === "script") <
            calls.findIndex((x) => x.data?.payload?.includes?.("effect")));
  calls.length = 0;
  c._sendPaint(Array(10).fill("#ff0000"), 0);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(calls[0].service, "turn_off");
});

test("quick speed change: hardware sends effect_speed and saves; slow re-runs with new minutes", async () => {
  let { c, calls, lib } = mkCard({ scriptState: "off" });
  lib.active = { kind: "effect", id: "e0", name: "Woodfire" };
  await c._changeSpeed({ speed: 5 });
  assert.ok(calls.some((x) => x.data?.payload === JSON.stringify({ effect_speed: 5 })));
  const saved = JSON.parse(calls.at(-1).data.payload);
  assert.equal(saved.effects.find((e) => e.id === "e0").speed, 5);
  ({ c, calls, lib } = mkCard({ scriptState: "on" }));
  lib.active = { kind: "effect", id: "d0", name: "Slow sunset" };
  await c._changeSpeed({ minutes: 120 });
  assert.equal(calls.find((x) => x.service === "turn_on" && x.domain === "script").data.variables.minutes, 120);
  assert.equal(JSON.parse(calls.at(-1).data.payload).effects.find((e) => e.id === "d0").minutes, 120);
});

test("setup adds the slow starters to the library", async () => {
  const { c, calls } = mkCard();
  c._hass.states = { ...c._hass.states }; delete c._hass.states["sensor.glow_studio_strip"];
  await fastTimers(() => c._setup());
  const lib = JSON.parse(calls.at(-1).data.payload);
  const slow = lib.effects.filter((e) => isDrift(e.type));
  assert.equal(slow.length, DRIFT_DEFAULTS.length);
  assert.ok(slow.every((e) => e.minutes >= 5));
});

test("slowEquivalent: travelling styles flow, others drift; keeps id, name and colours", async () => {
  const { slowEquivalent } = await import("../src/drift.js");
  const candle = { id: "e1", name: "Candlelight", type: "flicker", colors: ["#ff8c1a", "#ffb04d"], speed: 1 };
  assert.deepEqual(slowEquivalent(candle, 30), { ...candle, type: "drift", minutes: 30 });
  assert.equal(slowEquivalent({ type: "chasing", colors: ["#000000", "#ffffff"] }, 5).type, "drift_flow");
  assert.equal(slowEquivalent({ type: "Pacifica", colors: [] }, 5).type, "drift");
  assert.equal(slowEquivalent({ type: "rainbow2", colors: [] }, 60).colors.length, 5, "rainbow gets a rainbow palette");
  assert.deepEqual(slowEquivalent({ type: "breathing", colors: ["#ff0022"] }, 15).colors, ["#ff0022", "#000000"], "one colour breathes to dark");
  assert.deepEqual(slowEquivalent({ type: "drift_flow", minutes: 5 }, 120), { type: "drift_flow", minutes: 120 });
});

test("speed bar and editor offer 'Slower' minutes for hardware effects", () => {
  const html = speedBar({ speed: 1 }, { speed: true, minutes: false }, [5, 30]);
  assert.match(html, /Slower:/);
  assert.match(html, /data-fx-slow="30"/);
});

test("making a running effect slow converts and saves it, then starts the drift script", async () => {
  const { c, calls, lib } = mkCard({ scriptState: "off" });
  lib.active = { kind: "effect", id: "e1", name: "Candlelight" };
  await c._makeSlow(30);
  const run = calls.find((x) => x.domain === "script" && x.service === "turn_on");
  assert.equal(run.data.variables.minutes, 30);
  assert.deepEqual(run.data.variables.colors, ["#ff8c1a", "#ffb04d", "#ff7a00"]);
  const saved = JSON.parse(calls.at(-1).data.payload).effects.find((e) => e.id === "e1");
  assert.deepEqual([saved.name, saved.type, saved.minutes], ["Candlelight", "drift", 30]);
});

test("without the drift script, making slow reports it and leaves the library alone", async () => {
  const { c, calls, lib } = mkCard();
  lib.active = { kind: "effect", id: "e1", name: "Candlelight" };
  await c._makeSlow(30);
  assert.match(c._error, /drift script/);
  assert.ok(!calls.some((x) => x.data?.topic?.endsWith("/library")));
});
