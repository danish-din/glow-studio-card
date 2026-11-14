// Pure helpers — no DOM, unit-tested in test/helpers.test.mjs

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const hex2rgb = (h) => {
  const n = parseInt(String(h).replace("#", ""), 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
export const rgb2hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");

export const mix = (a, b, t) => {
  const x = hex2rgb(a), y = hex2rgb(b);
  return rgb2hex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
};

export const isDark = (h) => { const { r, g, b } = hex2rgb(h); return r + g + b < 40; };

export const uid = () => Math.random().toString(36).slice(2, 9);

/** Resample a colour list to n segments (nearest neighbour keeps hard edges crisp). */
export const scaleColors = (colors, n) =>
  Array.from({ length: n }, (_, i) => colors[Math.min(colors.length - 1, Math.floor((i * colors.length) / n))]);

export const slugify = (s) => String(s).toLowerCase().replace(/^[a-z_]+\./, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Zigbee2MQTT effect_segments string for an effect ("" = whole strip). */
export const segString = (fx) => {
  if (fx.segments === "selected") return (fx.selected || []).map((i) => i + 1).join(",");
  return !fx.segments || fx.segments === "all" ? "" : fx.segments;
};

/** Segments = strip length (m) × 5, read from the Z2M "length" number entity on the same device. */
export const detectSegments = (hass, entityId) => {
  const dev = hass?.entities?.[entityId]?.device_id;
  if (!dev) return null;
  const len = Object.values(hass.entities).find(
    (e) => e.device_id === dev && e.entity_id.startsWith("number.") && /_length$/.test(e.entity_id));
  const metres = len ? parseFloat(hass.states[len.entity_id]?.state) : NaN;
  return Number.isFinite(metres) && metres > 0 ? Math.round(metres * 5) : null;
};

/** Z2M set topic from the device name (Z2M names HA devices after their friendly name). */
export const detectTopic = (hass, entityId, base = "zigbee2mqtt") => {
  const dev = hass?.entities?.[entityId]?.device_id;
  const name = dev ? hass.devices?.[dev]?.name : null;
  return name ? `${base}/${name}/set` : null;
};
