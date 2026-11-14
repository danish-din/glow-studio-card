import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLibrary, DEFAULT_PATTERNS } from "../src/defaults.js";
import { fxCss, fxStripHtml, previewKind } from "../src/preview.js";
import { DRIVERS } from "../src/drivers/index.js";

const HEX = /^#[0-9a-f]{6}$/;

test("default library scales patterns to the strip length", () => {
  for (const n of [5, 10, 13, 50]) {
    const lib = defaultLibrary(n);
    assert.equal(lib.patterns.length, DEFAULT_PATTERNS.length);
    lib.patterns.forEach((p) => { assert.equal(p.colors.length, n); p.colors.forEach((c) => assert.match(c, HEX)); });
    assert.equal(lib.current.length, n);
    assert.deepEqual(lib.effects, []);
  }
});

test("default library takes the driver's starter effects", () => {
  const lib = defaultLibrary(10, [["Woodfire", "flicker", ["#ff0000"], 55]]);
  assert.deepEqual(lib.effects[0], { id: "e0", name: "Woodfire", type: "flicker", colors: ["#ff0000"], speed: 55, segments: "all" });
});

test("every fixed-list driver ships valid starter effects for its own styles", () => {
  const ctx = { hass: { states: {}, entities: {}, devices: {} }, cfg: {}, entity: "light.x" };
  for (const d of DRIVERS.filter((x) => ["aqara_t1", "aqara_t1m", "hue_gradient"].includes(x.id))) {
    const styles = new Set(d.styles(ctx).map((s) => s.id));
    const fx = d.defaultEffects(ctx);
    assert.ok(fx.length >= 6, `${d.id} has starters`);
    for (const [name, type, colors, speed] of fx) {
      assert.ok(styles.has(type), `${d.id}: ${name} uses unknown style ${type}`);
      assert.ok(colors.length <= d.caps.colors || colors.length === 0, `${d.id}: ${name} too many colours`);
      colors.forEach((c) => assert.match(c, HEX));
      assert.ok(speed >= 1 && speed <= 100);
    }
  }
});

test("preview maps brand effect names to sensible animations", () => {
  const cases = { flicker: "flicker", "Fire 2012": "flicker", candle: "flicker", fading: "flicker", Breathe: "breathing",
    rainbow1: "rainbow1", rainbow2: "rainbow2", rolling: "rainbow2", colorloop: "rainbow1", hopping: "hopping",
    Strobe: "flash", Twinklefox: "dash", cosmos: "dash", Pacifica: "chasing" };
  for (const [name, kind] of Object.entries(cases)) assert.equal(previewKind(name), kind, name);
});

test("preview css is generated for every animation kind, with or without colours", () => {
  for (const type of ["flicker", "breathing", "chasing", "dash", "hopping", "flash", "rainbow1", "rainbow2", "Pacifica", "underwater", "cosmos", "opal"]) {
    for (const colors of [["#ff0000", "#00ff00"], []]) {
      const { css, anim, delay, cols } = fxCss({ type, colors, speed: 50 }, `x_${type}`);
      assert.match(css, /@keyframes fx_x_/);
      assert.ok(anim.includes("infinite"));
      assert.equal(typeof delay(3), "string");
      assert.ok(cols.length >= 1);
    }
  }
});

test("preview scope is sanitised and strip has n segments", () => {
  const html = fxStripHtml({ type: "chasing", colors: ["#123456"], speed: 10 }, 'a"b<c', 12);
  assert.ok(!html.includes('a"b<c'));
  assert.equal((html.match(/<i /g) || []).length, 12);
  assert.ok(html.includes("--n:12"));
});
