// Starter library: patterns are authored for 10 segments and resampled to the real strip; effects come from the driver.
import { scaleColors } from "./helpers.js";

export const RAINBOW = ["#ff0000", "#ff8000", "#ffff00", "#00ff00", "#00ffff", "#0040ff", "#8000ff", "#ff00c0"];
export const SWATCHES = ["#ffd8a8", "#ffe066", "#ffa600", "#ff5500", "#ff1a1a", "#ff2d8a", "#8200dc", "#41006e",
  "#2040ff", "#00b4ff", "#00ffd5", "#00d24a", "#ffffff", "#000000"];
export const SEG_SETS = { all: "All", odd: "Odd", even: "Even", "first-half": "Left half", "last-half": "Right half", selected: "Selected" };

const grad = (a, b, n = 10) => Array.from({ length: n }, (_, i) => {
  const A = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const B = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  return "#" + A.map((v, k) => Math.round(v + (B[k] - v) * i / (n - 1)).toString(16).padStart(2, "0")).join("");
});
const K = "#000000", P = "#8200dc", O = "#ff5500";

export const DEFAULT_PATTERNS = [
  ["Golden hour", grad("#ffc233", "#ff4d00")],
  ["Dusk", [K, "#41006e", O, "#ff7a00", "#ffa600", "#ffa600", "#ff7a00", O, "#41006e", K]],
  ["Sunset sky", [P, P, O, O, O, O, O, O, P, P]],
  ["Ocean", grad("#001a66", "#00e5ff")],
  ["Forest", grad("#0b3d0b", "#9be22d")],
  ["Candy", Array.from({ length: 10 }, (_, i) => (i % 2 ? "#8ad8ff" : "#ff4fa3"))],
  ["Neon", [...Array(5).fill("#ff00e6"), ...Array(5).fill("#00f0ff")]],
  ["Rainbow", ["#ff0000", "#ff6a00", "#ffd000", "#7aff00", "#00ff6a", "#00ffe1", "#0080ff", "#3a00ff", "#b000ff", "#ff00a8"]],
  ["Reading", Array(10).fill("#ffd8a8")],
  ["Night light", ["#3a1200", "#3a1200", ...Array(8).fill(K)]],
  ["Ice", grad("#ffffff", "#2a6bff")],
];

/** @param effects [[name, type, colors, speed], …] from the driver */
export const defaultLibrary = (segments, effects = []) => ({
  version: 1,
  patterns: DEFAULT_PATTERNS.map(([name, colors], i) => ({ id: `p${i}`, name, colors: scaleColors(colors, segments) })),
  effects: effects.map(([name, type, colors, speed], i) => ({ id: `e${i}`, name, type, colors, speed, segments: "all" })),
  active: null,
  current: scaleColors(DEFAULT_PATTERNS[2][1], segments),
});
