import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLibrary, DEFAULT_PATTERNS, DEFAULT_EFFECTS, FX_TYPES } from "../src/defaults.js";
import { fxCss, fxStripHtml } from "../src/preview.js";

const HEX = /^#[0-9a-f]{6}$/;

test("default library scales patterns to the strip length", () => {
  for (const n of [5, 10, 13, 50]) {
    const lib = defaultLibrary(n);
    assert.equal(lib.patterns.length, DEFAULT_PATTERNS.length);
    lib.patterns.forEach((p) => { assert.equal(p.colors.length, n); p.colors.forEach((c) => assert.match(c, HEX)); });
    assert.equal(lib.current.length, n);
  }
});

test("default effects are valid T1 hardware effects", () => {
  const lib = defaultLibrary(10);
  assert.equal(lib.effects.length, DEFAULT_EFFECTS.length);
  const ids = new Set();
  for (const fx of lib.effects) {
    assert.ok(fx.type in FX_TYPES, fx.type);
    assert.ok(fx.colors.length <= 8, `${fx.name} has >8 colours`);
    assert.ok(fx.speed >= 1 && fx.speed <= 100);
    fx.colors.forEach((c) => assert.match(c, HEX));
    assert.ok(!ids.has(fx.id)); ids.add(fx.id);
  }
});

test("woodfire is a flicker in fire colours", () => {
  const wood = defaultLibrary(10).effects.find((e) => e.name === "Woodfire");
  assert.equal(wood.type, "flicker");
  assert.ok(wood.colors.every((c) => parseInt(c.slice(1, 3), 16) > parseInt(c.slice(5, 7), 16)));
});

test("preview css is generated for every effect type", () => {
  for (const type of Object.keys(FX_TYPES)) {
    const { css, anim, delay, cols } = fxCss({ type, colors: ["#ff0000", "#00ff00"], speed: 50 }, `x_${type}`);
    assert.match(css, /@keyframes fx_x_/);
    assert.ok(anim.includes("infinite"));
    assert.equal(typeof delay(3), "string");
    assert.ok(cols.length >= 2);
  }
});

test("preview scope is sanitised and strip has n segments", () => {
  const html = fxStripHtml({ type: "chasing", colors: ["#123456"], speed: 10 }, 'a"b<c', 12);
  assert.ok(!html.includes('a"b<c'));
  assert.equal((html.match(/<i /g) || []).length, 12);
  assert.ok(html.includes("--n:12"));
});
