// The shared library lives in a retained MQTT topic that anything able to call mqtt.publish (or reach the broker)
// can overwrite, so treat it as untrusted: validate on read, and still escape/check at every output.
import { SEG_SETS } from "./defaults.js";

const HEX = /^#[0-9a-f]{6}$/i;

/** A CSS-safe colour: exactly #rrggbb, else the fallback. */
export const hex = (c, fallback = "#000000") => (typeof c === "string" && HEX.test(c) ? c.toLowerCase() : fallback);

const str = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");
const num = (v, min, max, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
};
const colourList = (list, max) => (Array.isArray(list) ? list.filter((c) => typeof c === "string" && HEX.test(c)).slice(0, max).map((c) => c.toLowerCase()) : []);
const paintList = (list) => (Array.isArray(list) ? list.slice(0, 500).map((c) => hex(c)) : null);

function effect(e) {
  if (!e || typeof e !== "object") return null;
  const out = {
    id: str(e.id, 40), name: str(e.name, 60), type: str(e.type, 60),
    colors: colourList(e.colors, 8),
    speed: num(e.speed, 1, 100, 50),
    segments: Object.prototype.hasOwnProperty.call(SEG_SETS, e.segments) ? e.segments : "all",
  };
  if (!out.id || !out.type) return null;
  if (e.minutes !== undefined) out.minutes = num(e.minutes, 1, 240, 30);
  if (Array.isArray(e.selected)) out.selected = e.selected.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < 500).slice(0, 500);
  if (e.hwType !== undefined) out.hwType = str(e.hwType, 60);
  if (e.hwColors !== undefined) out.hwColors = colourList(e.hwColors, 8);
  return out;
}

function pattern(p) {
  if (!p || typeof p !== "object" || !str(p.id, 40)) return null;
  return { id: str(p.id, 40), name: str(p.name, 60), colors: paintList(p.colors) || [] };
}

/** Clean library, or null when the sensor isn't a library at all. */
export function sanitizeLibrary(a) {
  if (!a || !Array.isArray(a.patterns)) return null;
  const active = a.active && typeof a.active === "object" && ["pattern", "effect"].includes(a.active.kind)
    ? { kind: a.active.kind, id: a.active.id == null ? null : str(a.active.id, 40), name: str(a.active.name, 60) }
    : null;
  return {
    version: Math.floor(num(a.version, 1, Number.MAX_SAFE_INTEGER, 1)),
    patterns: a.patterns.map(pattern).filter(Boolean),
    effects: (Array.isArray(a.effects) ? a.effects : []).map(effect).filter(Boolean),
    active,
    current: paintList(a.current),
  };
}
