// DOM tests: render + user flows, using happy-dom as the browser.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

let defaultLibrary;
const win = new Window();
before(async () => {
  for (const k of ["HTMLElement", "customElements", "document", "CustomEvent", "Event", "window"]) globalThis[k] = k === "window" ? win : win[k];
  globalThis.confirm = () => true;
  await import("../src/index.js");
  ({ defaultLibrary } = await import("../src/defaults.js"));
});

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

function mount({ lib = defaultLibrary(10), on = true } = {}) {
  const calls = [];
  const hass = {
    entities: { "light.strip": { entity_id: "light.strip", device_id: "d1" } },
    devices: { d1: { name: "Bed Strip" } },
    states: {
      "light.strip": { state: on ? "on" : "off", attributes: { brightness: 128, friendly_name: "Bed strip" } },
      ...(lib ? { "sensor.strip_studio_strip": { state: "1", attributes: lib } } : {}),
    },
    callService: async (domain, service, data) => {
      calls.push({ domain, service, data });
      if (data?.topic === "strip_studio/strip/library") {
        hass.states = { ...hass.states, "sensor.strip_studio_strip": { state: "x", attributes: JSON.parse(data.payload) } };
        el.hass = { ...hass };
      }
    },
  };
  const el = document.createElement("strip-studio-card");
  el.setConfig({ entity: "light.strip" });
  document.body.appendChild(el);
  el.hass = hass;
  const $ = (s) => el.shadowRoot.querySelector(s);
  const $$ = (s) => [...el.shadowRoot.querySelectorAll(s)];
  return { el, hass, calls, $, $$ };
}

test("registers the card and its editor", () => {
  assert.ok(customElements.get("strip-studio-card"));
  assert.ok(customElements.get("strip-studio-card-editor"));
  assert.ok(window.customCards.some((c) => c.type === "strip-studio-card"));
});

test("first run shows setup and creates the library", async () => {
  const { $, calls } = mount({ lib: null });
  assert.ok($(".setup"));
  $("[data-act=setup]").click();
  await tick(1700);
  assert.ok(calls.some((c) => c.data.topic.startsWith("homeassistant/sensor/strip_studio_strip")));
  assert.ok(calls.some((c) => c.data.topic === "strip_studio/strip/library"));
});

test("missing entity shows a clear message", () => {
  const el = document.createElement("strip-studio-card");
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
  assert.equal(el._mirror, true);
  $("[data-act=save-pattern]").click();
  const input = $("[data-act=name-input]");
  input.value = "My test"; input.dispatchEvent(new Event("input"));
  $("[data-act=name-save]").click();
  await tick(30);
  assert.equal(el._lib().patterns.at(-1).name, "My test");
  assert.equal(el._tab, "patterns");
});

test("patterns: apply, rename, update and delete via the ⋯ menu", async () => {
  const { $, $$, el } = mount();
  $('[data-tab="patterns"]').click();
  assert.equal($$(".tile").length, defaultLibrary(10).patterns.length);
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
  assert.equal(el._tab, "paint");
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
    { name: "Mine", type: "breathing", speed: 80, segments: "odd", colors: ["#ff9500", "#2040ff"] });
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
  const lib = defaultLibrary(10);
  lib.patterns[0].name = '<img src=x onerror="window.pwned=1">';
  const { $, $$ } = mount({ lib });
  $('[data-tab="patterns"]').click();
  assert.equal($$(".tile img").length, 0);
  assert.equal(window.pwned, undefined);
});

test("editor emits config-changed without empty keys", () => {
  const ed = document.createElement("strip-studio-card-editor");
  ed.setConfig({ entity: "light.strip" });
  ed.hass = { states: {} };
  let got;
  ed.addEventListener("config-changed", (e) => { got = e.detail.config; });
  ed.querySelector("ha-form").dispatchEvent(new CustomEvent("value-changed", { detail: { value: { entity: "light.x", title: "" } } }));
  assert.deepEqual(got, { entity: "light.x" });
});
