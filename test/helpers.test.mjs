import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, hex2rgb, rgb2hex, mix, isDark, scaleColors, slugify, segString, detectSegments, detectTopic } from "../src/helpers.js";

test("hex2rgb / rgb2hex round-trip and clamping", () => {
  assert.deepEqual(hex2rgb("#ff5500"), { r: 255, g: 85, b: 0 });
  assert.equal(rgb2hex({ r: 255, g: 85, b: 0 }), "#ff5500");
  assert.equal(rgb2hex({ r: 300, g: -5, b: 12.6 }), "#ff000d");
  assert.deepEqual(hex2rgb("garbage"), { r: 0, g: 0, b: 0 });
});

test("mix interpolates between two colours", () => {
  assert.equal(mix("#000000", "#ffffff", 0), "#000000");
  assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mix("#000000", "#ff0000", 0.5), "#800000");
});

test("isDark treats near-black as off", () => {
  assert.equal(isDark("#000000"), true);
  assert.equal(isDark("#0a0a0a"), true);
  assert.equal(isDark("#ff5500"), false);
});

test("esc escapes HTML so names cannot inject markup", () => {
  assert.equal(esc(`<img src=x onerror="a">'&`), "&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;");
  assert.equal(esc(null), "");
});

test("scaleColors resamples to any segment count", () => {
  const ten = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  assert.deepEqual(scaleColors(ten, 10), ten);
  assert.deepEqual(scaleColors(ten, 5), ["a", "c", "e", "g", "i"]);
  assert.equal(scaleColors(ten, 25).length, 25);
  assert.equal(scaleColors(ten, 25)[24], "j");
});

test("slugify builds safe ids from entity ids", () => {
  assert.equal(slugify("light.Living Room-Strip"), "living_room_strip");
  assert.equal(slugify("light.bed_strip"), "bed_strip");
});

test("segString maps effect segment choices to Z2M syntax", () => {
  assert.equal(segString({ segments: "all" }), "");
  assert.equal(segString({}), "");
  assert.equal(segString({ segments: "odd" }), "odd");
  assert.equal(segString({ segments: "selected", selected: [0, 2, 4] }), "1,3,5");
  assert.equal(segString({ segments: "selected" }), "");
});

const hass = {
  entities: {
    "light.strip": { entity_id: "light.strip", device_id: "d1" },
    "number.strip_length": { entity_id: "number.strip_length", device_id: "d1" },
    "light.other": { entity_id: "light.other", device_id: "d2" },
  },
  devices: { d1: { name: "Bed Strip" }, d2: { name: "Other" } },
  states: { "number.strip_length": { state: "3" } },
};

test("detectSegments reads strip length (5 segments per metre)", () => {
  assert.equal(detectSegments(hass, "light.strip"), 15);
  assert.equal(detectSegments(hass, "light.other"), null);
  assert.equal(detectSegments(hass, "light.missing"), null);
  assert.equal(detectSegments(undefined, "light.strip"), null);
});

test("detectTopic uses the device (Z2M friendly) name", () => {
  assert.equal(detectTopic(hass, "light.strip"), "zigbee2mqtt/Bed Strip/set");
  assert.equal(detectTopic(hass, "light.strip", "z2m"), "z2m/Bed Strip/set");
  assert.equal(detectTopic(hass, "light.missing"), null);
});
