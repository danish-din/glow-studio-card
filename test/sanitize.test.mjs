// Security: the library comes from a retained MQTT topic that others may be able to write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeLibrary, hex } from "../src/sanitize.js";
import { fxStripHtml, fxCss } from "../src/preview.js";
import { patternsTab, speedBar } from "../src/views.js";

const EVIL = `red"><img src=x onerror="alert(1)">`;

test("hex only lets #rrggbb through", () => {
  assert.equal(hex("#AbCdEf"), "#abcdef");
  for (const bad of [EVIL, "red", "#fff", "#12345g", "url(x)", null, 5, "#123456;x:y"]) assert.equal(hex(bad), "#000000", String(bad));
  assert.equal(hex("nope", "#ffffff"), "#ffffff");
});

test("sanitizeLibrary strips hostile values from every field", () => {
  const lib = sanitizeLibrary({
    version: "9; drop", patterns: [{ id: "p1", name: "P", colors: [EVIL, "#ff0000"] }, { id: "" }, null, "x"],
    effects: [
      { id: "e1", name: "E", type: "flicker", colors: [EVIL, "#00ff00", "blue"], speed: EVIL, segments: EVIL, minutes: "999", hwColors: [EVIL], selected: [1, "2", -5, 9999, "x"] },
      { id: "e2" }, 7,
    ],
    active: { kind: "<script>", id: "p1" }, current: [EVIL, "#0000ff"],
  });
  assert.equal(lib.version, 1);
  assert.deepEqual(lib.patterns, [{ id: "p1", name: "P", colors: ["#000000", "#ff0000"] }]);
  assert.equal(lib.effects.length, 1);
  assert.deepEqual(lib.effects[0], { id: "e1", name: "E", type: "flicker", colors: ["#00ff00"], speed: 50, segments: "all", minutes: 240, hwColors: [], selected: [1, 2] });
  assert.equal(lib.active, null);
  assert.deepEqual(lib.current, ["#000000", "#0000ff"]);
  assert.equal(sanitizeLibrary({}), null);
  assert.equal(sanitizeLibrary(null), null);
});

test("even unsanitised values can't break out of the markup at output", () => {
  const html = fxStripHtml({ type: "flicker", colors: [EVIL], speed: EVIL }, "x", 3);
  assert.ok(!html.includes("<img") && !html.includes("onerror"));
  assert.ok(!fxCss({ type: "chasing", colors: [EVIL] }, "y").css.includes("onerror"));
  const pat = patternsTab({ naming: null, menu: null }, { patterns: [{ id: "p", name: "n", colors: [EVIL] }], active: null });
  assert.ok(!pat.includes("<img") && !pat.includes("onerror"));
  const bar = speedBar({ type: "flicker", speed: EVIL }, { speed: true });
  assert.ok(!bar.includes("<img"));
});
