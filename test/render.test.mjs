// DOM tests: render + user flows, using happy-dom as the browser.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

let defaultLibrary, aqaraT1;
const win = new Window();
before(async () => {
  for (const k of ["HTMLElement", "customElements", "document", "CustomEvent", "Event", "window"]) globalThis[k] = k === "window" ? win : win[k];
  globalThis.confirm = () => true;
  await import("../src/index.js");
  ({ defaultLibrary } = await import("../src/defaults.js"));
  ({ aqaraT1 } = await import("../src/drivers/zigbee2mqtt.js"));
});

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

const fullLib = () => defaultLibrary(10, aqaraT1.defaultEffects());
function mount({ lib = fullLib(), on = true } = {}) {
  const calls = [];
  const hass = {
    entities: { "light.strip": { entity_id: "light.strip", device_id: "d1" } },
    devices: { d1: { name: "Bed Strip", model: "LED Strip T1", model_id: "LGYCDD01LM" } },
    states: {
      "light.strip": { state: on ? "on" : "off", attributes: { brightness: 128, friendly_name: "Bed strip" } },
      ...(lib ? { "sensor.glow_studio_strip": { state: "1", attributes: lib } } : {}),
    },
    callService: async (domain, service, data) => {
      calls.push({ domain, service, data });
      if (data?.topic === "glow_studio/strip/library") {
        hass.states = { ...hass.states, "sensor.glow_studio_strip": { state: "x", attributes: JSON.parse(data.payload) } };
        el.hass = { ...hass };
      }
    },
  };
  const el = document.createElement("glow-studio-card");
  el.setConfig({ entity: "light.strip" });
  document.body.appendChild(el);
  el.hass = hass;
  const $ = (s) => el.shadowRoot.querySelector(s);
  const $$ = (s) => [...el.shadowRoot.querySelectorAll(s)];
  return { el, hass, calls, $, $$ };
}

test("registers the card and its editor", () => {
  assert.ok(customElements.get("glow-studio-card"));
  assert.ok(customElements.get("glow-studio-card-editor"));
  assert.ok(window.customCards.some((c) => c.type === "glow-studio-card"));
});

test("first run shows setup and creates the library", async () => {
  const { $, calls } = mount({ lib: null });
  assert.ok($(".setup"));
  $("[data-act=setup]").click();
  await tick(1700);
  assert.ok(calls.some((c) => c.data.topic.startsWith("homeassistant/sensor/glow_studio_strip")));
  assert.ok(calls.some((c) => c.data.topic === "glow_studio/strip/library"));
});

test("missing entity shows a clear message", () => {
  const el = document.createElement("glow-studio-card");
  el.setConfig({ entity: "light.nope" });
  el.hass = { states: {}, entities: {}, devices: {}, callService: async () => {} };
  assert.match(el.shadowRoot.textContent, /not found/);
});

test("paint tab renders 10 segments, swatches and brightness", () => {
  const { $$, $ } = mount();
  assert.equal($$(".main.strip i[data-seg]").length, 10);
  assert.ok($$("[data-color]").length >= 10);
  assert.equal($("[data-act=bri]").value, "50");
});

test("fill paints every segment and sends it to the strip", async () => {
  const { $, calls, el } = mount();
  $('[data-color="#2040ff"]').click();
  $("[data-act=fill]").click();
  await tick(30);
  assert.ok(el._paint.every((c) => c === "#2040ff"));
  const seg = calls.map((c) => c.data.payload && JSON.parse(c.data.payload)).find((p) => p?.segment_colors);
  assert.deepEqual(seg.segment_colors[0].color, { r: 32, g: 64, b: 255 });
});

test("select all + blend makes a gradient between the end colours", async () => {
  const { $, el } = mount();
  el._paint[0] = "#000000"; el._paint[9] = "#ffffff";
  $("[data-act=selall]").click();
  $("[data-act=blend]").click();
  await tick(30);
  assert.equal(el._paint[0], "#000000");
  assert.equal(el._paint[9], "#ffffff");
  assert.ok(el._paint[5] > "#7" && el._paint[5] < "#9");
});

test("mirror toggles and save-as-pattern adds a named pattern", async () => {
  const { $, el } = mount();
  $("[data-act=mirror]").click();
  assert.equal(el._s.mirror, true);
  $("[data-act=save-pattern]").click();
  const input = $("[data-act=name-input]");
  input.value = "My test"; input.dispatchEvent(new Event("input"));
  $("[data-act=name-save]").click();
  await tick(30);
  assert.equal(el._lib().patterns.at(-1).name, "My test");
  assert.equal(el._s.tab, "patterns");
});

test("patterns: apply, rename, update and delete via the ⋯ menu", async () => {
  const { $, $$, el } = mount();
  $('[data-tab="patterns"]').click();
  assert.equal($$(".tile").length, fullLib().patterns.length);
  $('[data-apply-pattern="p3"]').click();
  await tick(30);
  assert.deepEqual(el._lib().active, { kind: "pattern", id: "p3", name: "Ocean" });
  $('[data-menu="p0"]').click();
  $('[data-pattern-act="rename"][data-id="p0"]').click();
  const input = $("[data-act=name-input]"); input.value = "Renamed"; input.dispatchEvent(new Event("input"));
  $("[data-act=name-save]").click();
  await tick(30);
  assert.equal(el._lib().patterns[0].name, "Renamed");
  $('[data-menu="p1"]').click();
  $('[data-pattern-act="overwrite"][data-id="p1"]').click();
  await tick(30);
  assert.deepEqual(el._lib().patterns[1].colors, el._paint);
  $('[data-menu="p2"]').click();
  $('[data-pattern-act="delete"][data-id="p2"]').click();
  await tick(30);
  assert.ok(!el._lib().patterns.some((p) => p.id === "p2"));
  $('[data-menu="p4"]').click();
  $('[data-pattern-act="edit"][data-id="p4"]').click();
  assert.equal(el._s.tab, "paint");
});

test("effects: run shows Stop; stop returns to the painted design", async () => {
  const { $, el } = mount();
  $('[data-tab="effects"]').click();
  $('[data-run-effect="e0"]').click();
  await tick(1600);
  assert.equal(el._lib().active.name, "Woodfire");
  assert.ok($("[data-act=stop]"));
  assert.ok($(".main.strip i[style*='animation']"), "live strip animates while an effect runs");
  $("[data-act=stop]").click();
  await tick(30);
  assert.equal(el._lib().active.name, "Custom");
});

test("effect editor: create, edit colours/style/speed/segments, save; duplicate and delete", async () => {
  const { $, $$, el } = mount();
  $('[data-tab="effects"]').click();
  $("[data-act=new-effect]").click();
  assert.ok($(".editor"));
  const name = $("[data-ed=name]"); name.value = "Mine"; name.dispatchEvent(new Event("input"));
  $('[data-ed-type="breathing"]').click();
  $('[data-ed-add="#2040ff"]').click();
  $('[data-ed-rm="0"]').click();
  const sp = $("[data-ed=speed]"); sp.value = "80"; sp.dispatchEvent(new Event("change"));
  $('[data-ed-seg="odd"]').click();
  $("[data-act=ed-save]").click();
  await tick(30);
  const mine = el._lib().effects.at(-1);
  assert.deepEqual({ name: mine.name, type: mine.type, speed: mine.speed, segments: mine.segments, colors: mine.colors },
    { name: "Mine", type: "breathing", speed: 72, segments: "odd", colors: ["#ff9500", "#2040ff"] });
  const count = el._lib().effects.length;
  $(`[data-menu="${mine.id}"]`).click();
  $(`[data-fx-act="dup"][data-id="${mine.id}"]`).click();
  await tick(30);
  assert.equal(el._lib().effects.length, count + 1);
  $(`[data-menu="${mine.id}"]`).click();
  $(`[data-fx-act="delete"][data-id="${mine.id}"]`).click();
  await tick(30);
  assert.equal(el._lib().effects.length, count);
  $('[data-menu="e0"]').click();
  $('[data-fx-act="edit"][data-id="e0"]').click();
  assert.equal($("[data-ed=name]").value, "Woodfire");
  $('[data-ed-type="rainbow1"]').click();
  assert.match($(".editor").textContent, /own colours/);
  $("[data-act=ed-cancel]").click();
  assert.equal($(".editor"), null);
  assert.equal($$(".tile").length, el._lib().effects.length);
});

test("power and brightness call the light services", async () => {
  const { $, calls } = mount();
  $("[data-act=power]").click();
  const bri = $("[data-act=bri]"); bri.value = "40"; bri.dispatchEvent(new Event("change"));
  await tick(5);
  assert.ok(calls.some((c) => c.domain === "light" && c.service === "toggle"));
  assert.ok(calls.some((c) => c.service === "turn_on" && c.data.brightness_pct === 40));
});

test("XSS: a hostile pattern name is rendered as text", () => {
  const lib = fullLib();
  lib.patterns[0].name = '<img src=x onerror="window.pwned=1">';
  const { $, $$ } = mount({ lib });
  $('[data-tab="patterns"]').click();
  assert.equal($$(".tile img").length, 0);
  assert.equal(window.pwned, undefined);
});

test("editor emits config-changed without empty keys", () => {
  const ed = document.createElement("glow-studio-card-editor");
  ed.setConfig({ entity: "light.strip" });
  ed.hass = { states: {} };
  let got;
  ed.addEventListener("config-changed", (e) => { got = e.detail.config; });
  ed.querySelector("ha-form").dispatchEvent(new CustomEvent("value-changed", { detail: { value: { entity: "light.x", title: "" } } }));
  assert.deepEqual(got, { entity: "light.x" });
});

test("unknown light shows guidance instead of the studio", () => {
  const el = document.createElement("glow-studio-card");
  el.setConfig({ entity: "light.bulb" });
  el.hass = { states: { "light.bulb": { state: "on", attributes: {} } }, entities: {}, devices: {}, callService: async () => {} };
  assert.match(el.shadowRoot.textContent, /isn't recognised/);
});

test("drivers with long effect lists get a dropdown in the editor", async () => {
  const effects = Array.from({ length: 20 }, (_, i) => `Effect ${i}`);
  const el = document.createElement("glow-studio-card");
  el.setConfig({ entity: "light.w", driver: "wled", wled_topic: "wled/w" });
  const lib = defaultLibrary(10, [["Mine", "Effect 3", ["#ff0000"], 50]]);
  el.hass = {
    states: { "light.w": { state: "on", attributes: { effect_list: effects, brightness: 100 } }, "sensor.glow_studio_w": { state: "1", attributes: lib } },
    entities: {}, devices: {}, callService: async () => {},
  };
  el.shadowRoot.querySelector('[data-tab="effects"]').click();
  el.shadowRoot.querySelector("[data-act=new-effect]").click();
  const sel = el.shadowRoot.querySelector("[data-ed-type-select]");
  assert.ok(sel, "select rendered");
  sel.value = "Effect 7"; sel.dispatchEvent(new Event("change"));
  assert.equal(el._s.editing.type, "Effect 7");
  assert.ok(el._s.editing.colors.length <= 3, "WLED takes up to 3 colours");
});

test("editing hides the live strip/speed bar and says changes apply on Save", async () => {
  const lib = defaultLibrary(10, aqaraT1.defaultEffects());
  lib.active = { kind: "effect", id: "e0", name: "Woodfire" };
  const { $, el } = mount({ lib });
  $('[data-tab="effects"]').click();
  assert.ok($("[data-fx-speed]"), "live speed bar visible while not editing");
  $('[data-menu="e0"]').click();
  $('[data-fx-act="edit"][data-id="e0"]').click();
  assert.equal($("[data-fx-speed]"), null, "live speed bar hidden while editing");
  assert.match($(".editbanner").textContent, /Editing Woodfire.*Save/s);
  assert.equal(el.shadowRoot.querySelectorAll(".main.strip").length, 1, "only the preview strip shows");
  assert.ok($(".power svg"), "power button is an icon, not a font glyph");
});
