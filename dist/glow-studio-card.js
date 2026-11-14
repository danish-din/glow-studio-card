// src/helpers.js
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var hex2rgb = (h) => {
  const n = parseInt(String(h).replace("#", ""), 16) || 0;
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
};
var clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
var rgb2hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");
var mix = (a, b, t) => {
  const x = hex2rgb(a), y = hex2rgb(b);
  return rgb2hex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
};
var isDark = (h) => {
  const { r, g, b } = hex2rgb(h);
  return r + g + b < 40;
};
var uid = () => Math.random().toString(36).slice(2, 9);
var scaleColors = (colors, n) => Array.from({ length: n }, (_, i) => colors[Math.min(colors.length - 1, Math.floor(i * colors.length / n))]);
var slugify = (s) => String(s).toLowerCase().replace(/^[a-z_]+\./, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
var segString = (fx) => {
  if (fx.segments === "selected") return (fx.selected || []).map((i) => i + 1).join(",");
  return !fx.segments || fx.segments === "all" ? "" : fx.segments;
};

// src/defaults.js
var RAINBOW = ["#ff0000", "#ff8000", "#ffff00", "#00ff00", "#00ffff", "#0040ff", "#8000ff", "#ff00c0"];
var SWATCHES = [
  "#ffd8a8",
  "#ffe066",
  "#ffa600",
  "#ff5500",
  "#ff1a1a",
  "#ff2d8a",
  "#8200dc",
  "#41006e",
  "#2040ff",
  "#00b4ff",
  "#00ffd5",
  "#00d24a",
  "#ffffff",
  "#000000"
];
var SEG_SETS = { all: "All", odd: "Odd", even: "Even", "first-half": "Left half", "last-half": "Right half", selected: "Selected" };
var grad = (a, b, n = 10) => Array.from({ length: n }, (_, i) => {
  const A = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const B = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  return "#" + A.map((v, k) => Math.round(v + (B[k] - v) * i / (n - 1)).toString(16).padStart(2, "0")).join("");
});
var K = "#000000";
var P = "#8200dc";
var O = "#ff5500";
var DEFAULT_PATTERNS = [
  ["Golden hour", grad("#ffc233", "#ff4d00")],
  ["Dusk", [K, "#41006e", O, "#ff7a00", "#ffa600", "#ffa600", "#ff7a00", O, "#41006e", K]],
  ["Sunset sky", [P, P, O, O, O, O, O, O, P, P]],
  ["Ocean", grad("#001a66", "#00e5ff")],
  ["Forest", grad("#0b3d0b", "#9be22d")],
  ["Candy", Array.from({ length: 10 }, (_, i) => i % 2 ? "#8ad8ff" : "#ff4fa3")],
  ["Neon", [...Array(5).fill("#ff00e6"), ...Array(5).fill("#00f0ff")]],
  ["Rainbow", ["#ff0000", "#ff6a00", "#ffd000", "#7aff00", "#00ff6a", "#00ffe1", "#0080ff", "#3a00ff", "#b000ff", "#ff00a8"]],
  ["Reading", Array(10).fill("#ffd8a8")],
  ["Night light", ["#3a1200", "#3a1200", ...Array(8).fill(K)]],
  ["Ice", grad("#ffffff", "#2a6bff")]
];
var defaultLibrary = (segments, effects = []) => ({
  version: 1,
  patterns: DEFAULT_PATTERNS.map(([name, colors], i) => ({ id: `p${i}`, name, colors: scaleColors(colors, segments) })),
  effects: effects.map(([name, type, colors, speed], i) => ({ id: `e${i}`, name, type, colors, speed, segments: "all" })),
  active: null,
  current: scaleColors(DEFAULT_PATTERNS[2][1], segments)
});

// src/preview.js
function previewKind(type = "", name = "") {
  const s = `${type} ${name}`.toLowerCase();
  if (/^drift_flow/.test(type)) return "chasing";
  if (/^drift/.test(type)) return "rainbow1";
  if (/rainbow|colou?r ?loop|rolling/.test(s)) return /flow|cycle|runner|rolling|rainbow2/.test(s) ? "rainbow2" : "rainbow1";
  if (/flicker|fire|candle|fading|fade|ember|flame/.test(s)) return "flicker";
  if (/breath|pulse|heart|lava|plasma|opal/.test(s)) return "breathing";
  if (/hop|disco|random|juggle|\brain\b/.test(s)) return "hopping";
  if (/flash|strobe|blink|police/.test(s)) return "flash";
  if (/dash|twinkle|sparkle|star|glisten|cosmos|firework|enchant/.test(s)) return "dash";
  return "chasing";
}
function fallbackPalette(kind, s) {
  if (kind.startsWith("rainbow") || /loop|disco|firework/.test(s)) return RAINBOW;
  if (/fire|candle|ember|flame|sun/.test(s)) return ["#ff3a00", "#ff9500", "#b31b00", "#ffb347"];
  if (/ocean|under|water|lake|pacifica|wave/.test(s)) return ["#0040ff", "#00b4ff", "#00ffd5"];
  if (/cosmos|star|night|enchant|aurora/.test(s)) return ["#1a1aff", "#7a00ff", "#00d4ff", "#ffffff"];
  if (/sparkle|glisten|opal/.test(s)) return ["#ffffff", "#ffd8a8", "#8ad8ff"];
  return ["#ff5500", "#ffa600", "#ff2d8a"];
}
function fxCss(fx, scope) {
  const kind = previewKind(fx.type, fx.name);
  const s = `${fx.type} ${fx.name}`.toLowerCase();
  const cols = fx.colors?.length ? fx.colors : fallbackPalette(kind, s);
  const dur = String(fx.type).startsWith("drift") ? 4 : 0.5 + (100 - (Number(fx.speed) || 50)) / 100 * 5;
  const d = (x) => x.toFixed(2);
  const name = `fx_${String(scope).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stops = cols.map((c, k) => `${Math.round(k / cols.length * 100)}%{background:${c};box-shadow:0 0 14px ${c}}`).join("") + `100%{background:${cols[0]};box-shadow:0 0 14px ${cols[0]}}`;
  let anim = `${name} ${d(dur * cols.length)}s linear infinite`;
  let delay = (i) => `${-i * 0.35}s`;
  let extra = "";
  switch (kind) {
    case "flicker":
      extra = `@keyframes ${name}_f{0%,100%{opacity:1}20%{opacity:.55}35%{opacity:.95}55%{opacity:.7}70%{opacity:1}85%{opacity:.6}}`;
      anim = `${name} ${d(dur * 1.6)}s steps(${cols.length}) infinite, ${name}_f ${d(dur / 2.5)}s ease-in-out infinite`;
      delay = (i) => `${-(i * 7919 % 13) / 5}s`;
      break;
    case "breathing":
      extra = `@keyframes ${name}_f{0%,100%{opacity:.25}50%{opacity:1}}`;
      anim = `${name} ${d(dur * cols.length * 2)}s linear infinite, ${name}_f ${d(dur * 1.2)}s ease-in-out infinite`;
      delay = () => "0s";
      break;
    case "hopping":
      anim = `${name} ${d(dur * cols.length)}s steps(${cols.length}) infinite`;
      delay = () => "0s";
      break;
    case "flash":
      extra = `@keyframes ${name}_f{0%,49%{opacity:1}50%,100%{opacity:.08}}`;
      anim = `${name} ${d(dur * cols.length)}s steps(${cols.length}) infinite, ${name}_f ${d(dur / 2)}s infinite`;
      delay = () => "0s";
      break;
    case "dash":
      extra = `@keyframes ${name}_f{0%,60%{opacity:.1}70%,90%{opacity:1}100%{opacity:.1}}`;
      anim = `${name} ${d(dur * cols.length)}s linear infinite, ${name}_f ${d(dur)}s linear infinite`;
      delay = (i) => `${-(i * dur) / 10}s`;
      break;
    case "rainbow1":
      anim = `${name} ${d(dur * 2)}s linear infinite`;
      delay = () => "0s";
      break;
    default:
      break;
  }
  return { css: `@keyframes ${name}{${stops}}${extra}`, anim, delay, cols, kind };
}
function fxStripHtml(fx, scope, n, cls = "mini") {
  const { css, anim, delay, cols } = fxCss(fx, scope);
  const segs = Array.from({ length: n }, (_, i) => {
    const c = cols[Math.floor(i * cols.length / n)];
    return `<i style="background:${c};animation:${anim};animation-delay:${delay(i)}"></i>`;
  }).join("");
  return `<style>${css}</style><div class="${cls} strip" style="--n:${n}">${segs}</div>`;
}

// src/styles.js
var STYLES = `
:host{--ss-bg:rgba(20,14,38,.55);--ss-line:rgba(255,255,255,.08);--ss-text:var(--primary-text-color,#eee);--ss-mute:var(--secondary-text-color,#aaa);--ss-acc:#ff7a1a;--ss-acc2:#8a4dff}
section{display:block;position:relative;z-index:1}
ha-card{padding:16px 16px 18px;overflow:visible;background:var(--ha-card-background,var(--ss-bg))}
header{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.title{flex:1;display:flex;flex-direction:column}.title span{font-size:1.25em;font-weight:700;letter-spacing:.02em}
.title small{color:var(--ss-mute);font-size:.8em}
button{font:inherit;color:inherit;cursor:pointer;border:none;background:none}
.power{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.06);font-size:1.15em;transition:.25s}
.power.on{background:linear-gradient(135deg,var(--ss-acc),#ff3d6e);box-shadow:0 0 18px #ff6a2a88}
.strip{display:grid;grid-template-columns:repeat(var(--n,10),1fr);gap:clamp(1px,calc(50px / var(--n,10)),5px)}
.strip i{display:block;border-radius:7px;background:#000;transition:background .25s,box-shadow .25s,transform .12s}
.main.strip{height:58px;padding:8px;border-radius:16px;background:rgba(0,0,0,.35);border:1px solid var(--ss-line);touch-action:none;user-select:none}
.main.strip i{height:100%}.main.strip i[data-seg]{cursor:pointer}
.main.strip i[data-seg]:active{transform:scale(.92)}
.main.strip i.sel{outline:2px solid #fff;outline-offset:2px}
.mini.strip{height:18px;gap:3px}.mini.strip i{height:100%;border-radius:4px}
.bri{display:flex;align-items:center;gap:10px;margin:14px 2px 6px;color:var(--ss-mute)}
.bri b{min-width:38px;text-align:right;font-weight:600;color:var(--ss-text);font-size:.85em}
input[type=range]{flex:1;width:100%;accent-color:var(--ss-acc);height:22px}
nav{display:flex;gap:4px;padding:4px;border-radius:14px;background:rgba(0,0,0,.25);margin:10px 0 14px}
nav button{flex:1;padding:9px 4px;border-radius:10px;color:var(--ss-mute);font-weight:600;font-size:.92em;transition:.2s}
nav button.act{background:rgba(255,255,255,.1);color:var(--ss-text);box-shadow:inset 0 0 0 1px var(--ss-line)}
.swatches{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.swatches.small .sw{width:24px;height:24px}
.sw{width:32px;height:32px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(255,255,255,.15);display:grid;place-items:center;font-size:.9em;color:#fff;transition:transform .15s;position:relative}
.sw:hover{transform:scale(1.1)}.sw.cur{box-shadow:0 0 0 2px #fff,0 0 12px rgba(255,255,255,.4)}
.sw.custom{background:conic-gradient(red,#ff0,lime,cyan,blue,#f0f,red);overflow:hidden;cursor:pointer}
.sw.custom input{position:absolute;inset:0;opacity:0;cursor:pointer}
.sw.custom span{width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 2px #fff;display:grid;place-items:center;font-size:.8em;pointer-events:none}
.sw.rm{cursor:pointer;font-weight:700;text-shadow:0 0 3px #000}
.hint{color:var(--ss-mute);font-size:.82em;margin:6px 2px 10px}
.row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.row.end{justify-content:flex-end;margin-top:14px}
.chip{padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.07);font-size:.86em;box-shadow:inset 0 0 0 1px var(--ss-line);transition:.2s}
.chip:hover{background:rgba(255,255,255,.13)}.chip.on{background:rgba(138,77,255,.35);box-shadow:inset 0 0 0 1px #8a4dff}
.chip.pri,.wide.pri{background:linear-gradient(135deg,var(--ss-acc),#ff3d6e);color:#fff;box-shadow:0 4px 14px #ff5a2a44}
.chip.stop{background:rgba(255,60,60,.18);box-shadow:inset 0 0 0 1px #ff5a5a88}
.wide{width:100%;padding:11px;border-radius:12px;font-weight:600;margin-top:6px}
.name input,.namebox{flex:1;min-width:120px;padding:8px 12px;border-radius:10px;border:1px solid var(--ss-line);background:rgba(0,0,0,.3);color:var(--ss-text);font:inherit}
.namebox{width:100%;box-sizing:border-box;margin:12px 0 4px;font-size:1.05em;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:8px}
.tile{position:relative;border-radius:14px;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px var(--ss-line);transition:.2s}
.tile:hover{background:rgba(255,255,255,.07)}.tile.act{box-shadow:inset 0 0 0 2px var(--ss-acc),0 0 16px #ff6a2a33}
.tile .hit{display:flex;flex-direction:column;gap:8px;width:100%;padding:12px 12px 10px;text-align:left}
.tile .hit span{font-weight:600;font-size:.92em;padding-right:22px}.tile .hit em{font-style:normal;color:var(--ss-mute);font-size:.75em;margin-top:-6px}
.dots{position:absolute;top:34px;right:6px;width:26px;height:26px;border-radius:8px;color:var(--ss-mute)}
.dots:hover{background:rgba(255,255,255,.1)}
.menu{position:absolute;z-index:5;right:6px;top:62px;min-width:160px;padding:6px;border-radius:12px;background:#1d1530;box-shadow:0 10px 30px #0009,inset 0 0 0 1px var(--ss-line);display:flex;flex-direction:column}
.menu button{text-align:left;padding:9px 10px;border-radius:8px;font-size:.88em}.menu button:hover{background:rgba(255,255,255,.08)}
.menu .danger{color:#ff7a7a}
.editor h4{margin:14px 2px 8px;font-size:.85em;color:var(--ss-mute);text-transform:uppercase;letter-spacing:.06em}
.editor h4 small{text-transform:none;letter-spacing:0;margin-left:6px;color:var(--ss-text)}
.tile .row.name{padding:0 10px 10px}
@media (prefers-reduced-motion:reduce){.strip i{animation:none!important}}
.setup{text-align:center;padding:10px 4px;position:relative;z-index:1}.setup p{color:var(--ss-mute);margin:6px 0 14px}
.warn{color:#ffb347;font-size:.85em;margin:8px 2px}
.speedbar{margin:10px 2px 0}.row.speedbar{align-items:center;gap:6px}.row.speedbar .hint{margin:0 4px 0 0}
.row.slower{align-items:center;gap:6px;margin:8px 0 0}.row.slower .hint{margin:0 2px 0 0}.row.slower .chip{padding:5px 10px;font-size:.8em}
`;

// src/drivers/zigbee2mqtt.js
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
var STEP_MS = 350;
var deviceOf = (hass, entityId) => hass?.devices?.[hass?.entities?.[entityId]?.device_id];
var modelOf = (hass, entityId) => {
  const d = deviceOf(hass, entityId);
  return `${d?.model_id || ""} ${d?.model || ""}`;
};
var z2mTopic = (ctx) => ctx.cfg.z2m_topic || (deviceOf(ctx.hass, ctx.entity)?.name ? `${ctx.cfg.z2m_base || "zigbee2mqtt"}/${deviceOf(ctx.hass, ctx.entity).name}/set` : null);
var ensureOn = async (ctx) => {
  if (!ctx.isOn()) {
    await ctx.mqtt(z2mTopic(ctx), { state: "ON", brightness: 200 });
    await wait(STEP_MS);
  }
};
var z2mProblem = (ctx) => z2mTopic(ctx) ? null : "Couldn't work out the Zigbee2MQTT topic. Set z2m_topic in the card config.";
var aqaraPaint = async (ctx, colors) => {
  if (!colors.some((c) => !isDark(c))) return ctx.mqtt(z2mTopic(ctx), { state: "OFF" });
  if (!ctx.isOn()) await ctx.mqtt(z2mTopic(ctx), { state: "ON", brightness: 200 });
  return ctx.mqtt(z2mTopic(ctx), { segment_colors: colors.map((c, i) => ({ segment: i + 1, color: hex2rgb(c) })) });
};
var aqaraRun = (withSegments) => async (ctx, fx) => {
  const t = z2mTopic(ctx);
  await ensureOn(ctx);
  if (fx.colors?.length) {
    await ctx.mqtt(t, { effect_colors: fx.colors.slice(0, 8).map(hex2rgb) });
    await wait(STEP_MS);
  }
  if (withSegments) {
    await ctx.mqtt(t, { effect_segments: segString(fx) });
    await wait(STEP_MS);
  }
  await ctx.mqtt(t, { effect_speed: Number(fx.speed) || 50 });
  await wait(STEP_MS);
  await ctx.mqtt(t, { effect: fx.type });
};
var aqaraT1 = {
  id: "aqara_t1",
  label: "Aqara LED Strip T1 (Zigbee2MQTT)",
  beta: false,
  match: (hass, e) => /LGYCDD01LM|LED Strip T1/i.test(modelOf(hass, e)),
  segments: (ctx) => {
    if (Number(ctx.cfg.segments) > 0) return Number(ctx.cfg.segments);
    const dev = ctx.hass?.entities?.[ctx.entity]?.device_id;
    const len = dev && Object.values(ctx.hass.entities).find((x) => x.device_id === dev && /^number\..*_length$/.test(x.entity_id));
    const m = len ? parseFloat(ctx.hass.states[len.entity_id]?.state) : NaN;
    return Number.isFinite(m) && m > 0 ? Math.round(m * 5) : 10;
  },
  problem: z2mProblem,
  styles: () => [
    { id: "flicker", label: "Flicker" },
    { id: "breathing", label: "Breathe" },
    { id: "chasing", label: "Chase" },
    { id: "dash", label: "Dash" },
    { id: "hopping", label: "Hop" },
    { id: "flash", label: "Flash" },
    { id: "rainbow1", label: "Rainbow", colors: 0 },
    { id: "rainbow2", label: "Rainbow flow", colors: 0 }
  ],
  caps: { colors: 8, speed: true, segments: true },
  paint: aqaraPaint,
  run: aqaraRun(true),
  setSpeed: (ctx, fx) => ctx.mqtt(z2mTopic(ctx), { effect_speed: Number(fx.speed) || 50 }),
  defaultEffects: () => [
    ["Woodfire", "flicker", ["#ff3a00", "#ff6a00", "#ff9500", "#b31b00", "#ffb347"], 55],
    ["Candlelight", "flicker", ["#ff8c1a", "#ffb04d", "#ff7a00"], 30],
    ["Ember glow", "breathing", ["#ff2a00", "#7a0f00"], 20],
    ["Ocean waves", "chasing", ["#0040ff", "#00b4ff", "#00ffd5", "#003080"], 25],
    ["Aurora", "chasing", ["#00ff9c", "#00d4ff", "#7a00ff", "#00ff5a"], 15],
    ["Lava lamp", "breathing", ["#ff0040", "#ff5a00", "#c000ff"], 15],
    ["Starry night", "dash", ["#0a1aff", "#ffffff", "#3a6bff"], 30],
    ["Sunset drift", "breathing", ["#ffb300", "#ff5500", "#8200dc"], 10],
    ["Rainbow", "rainbow1", [], 50],
    ["Rainbow flow", "rainbow2", [], 40],
    ["Disco", "hopping", ["#ff0000", "#00ff00", "#0000ff", "#ff00ff", "#ffff00", "#00ffff"], 85],
    ["Heartbeat", "breathing", ["#ff0022"], 75],
    ["Christmas", "chasing", ["#ff0000", "#00c000", "#ffffff"], 40],
    ["Police", "flash", ["#ff0000", "#0000ff"], 90]
  ]
};
var aqaraT1M = {
  id: "aqara_t1m",
  label: "Aqara Ceiling Light T1M / T1 ring (Zigbee2MQTT)",
  beta: true,
  match: (hass, e) => /CL-L02D|HCXDD12LM|Ceiling light T1/i.test(modelOf(hass, e)),
  segments: (ctx) => Number(ctx.cfg.segments) || (/HCXDD12LM/i.test(modelOf(ctx.hass, ctx.entity)) ? 20 : 26),
  problem: z2mProblem,
  styles: () => [
    { id: "flow1", label: "Flow" },
    { id: "flow2", label: "Flow 2" },
    { id: "fading", label: "Fade" },
    { id: "hopping", label: "Hop" },
    { id: "breathing", label: "Breathe" },
    { id: "rolling", label: "Roll" }
  ],
  caps: { colors: 8, speed: true, segments: false },
  paint: aqaraPaint,
  run: aqaraRun(false),
  setSpeed: (ctx, fx) => ctx.mqtt(z2mTopic(ctx), { effect_speed: Number(fx.speed) || 50 }),
  defaultEffects: () => [
    ["Woodfire", "fading", ["#ff3a00", "#ff6a00", "#ff9500", "#b31b00"], 60],
    ["Candlelight", "breathing", ["#ff8c1a", "#ffb04d"], 30],
    ["Ocean waves", "flow1", ["#0040ff", "#00b4ff", "#00ffd5"], 25],
    ["Aurora", "flow2", ["#00ff9c", "#00d4ff", "#7a00ff"], 15],
    ["Lava lamp", "fading", ["#ff0040", "#ff5a00", "#c000ff"], 15],
    ["Rainbow", "rolling", ["#ff0000", "#ffd000", "#00ff6a", "#0080ff", "#b000ff"], 40],
    ["Disco", "hopping", ["#ff0000", "#00ff00", "#0000ff", "#ff00ff"], 85],
    ["Heartbeat", "breathing", ["#ff0022"], 75]
  ]
};
var HUE_EFFECTS = ["candle", "fireplace", "colorloop", "sunrise", "sunset", "sparkle", "opal", "glisten", "underwater", "cosmos", "sunbeam", "enchant"];
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
var hueGradient = {
  id: "hue_gradient",
  label: "Philips Hue gradient (Zigbee2MQTT)",
  beta: true,
  match: (hass, e) => /gradient/i.test(modelOf(hass, e)),
  segments: (ctx) => Math.min(9, Math.max(1, Number(ctx.cfg.segments) || 5)),
  problem: z2mProblem,
  styles: () => HUE_EFFECTS.map((id) => ({ id, label: id === "colorloop" ? "Colour loop" : cap(id), colors: 0 })),
  caps: { colors: 0, speed: true, segments: false },
  paint: async (ctx, colors) => {
    if (!colors.some((c) => !isDark(c))) return ctx.mqtt(z2mTopic(ctx), { state: "OFF" });
    return ctx.mqtt(z2mTopic(ctx), { state: "ON", gradient: colors.slice(0, 9) });
  },
  run: async (ctx, fx) => {
    await ensureOn(ctx);
    await ctx.mqtt(z2mTopic(ctx), { effect: fx.type, effect_speed: Math.max(0, Math.min(1, (Number(fx.speed) || 50) / 100)) });
  },
  setSpeed: (ctx, fx) => ctx.mqtt(z2mTopic(ctx), { effect_speed: Math.max(0, Math.min(1, (Number(fx.speed) || 50) / 100)) }),
  defaultEffects: () => [
    ["Woodfire", "fireplace", [], 55],
    ["Candlelight", "candle", [], 30],
    ["Sunrise", "sunrise", [], 20],
    ["Sunset", "sunset", [], 20],
    ["Ocean", "underwater", [], 30],
    ["Starry night", "cosmos", [], 30],
    ["Sparkle", "sparkle", [], 50],
    ["Opal", "opal", [], 30],
    ["Glisten", "glisten", [], 40],
    ["Enchant", "enchant", [], 40],
    ["Sunbeam", "sunbeam", [], 30],
    ["Colour loop", "colorloop", [], 50]
  ]
};

// src/drivers/wled.js
var wait2 = (ms) => new Promise((r) => setTimeout(r, ms));
var deviceOf2 = (hass, e) => hass?.devices?.[hass?.entities?.[e]?.device_id];
var wledLedCount = (ctx) => {
  if (Number(ctx.cfg.leds) > 0) return Number(ctx.cfg.leds);
  const dev = ctx.hass?.entities?.[ctx.entity]?.device_id;
  const s = dev && Object.values(ctx.hass.entities).find((x) => x.device_id === dev && /^sensor\..*led_count$/.test(x.entity_id));
  const v = s ? parseInt(ctx.hass.states[s.entity_id]?.state, 10) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 30;
};
var wledRanges = (colors, leds) => {
  const out = [];
  colors.forEach((c, i) => {
    const start = Math.round(i * leds / colors.length), stop = Math.round((i + 1) * leds / colors.length);
    if (stop > start) out.push(start, stop, c.replace("#", "").toUpperCase());
  });
  return out;
};
var apiTopic = (ctx) => ctx.cfg.wled_topic ? `${ctx.cfg.wled_topic.replace(/\/+$/, "")}/api` : null;
var effectList = (ctx) => ctx.hass.states[ctx.entity]?.attributes?.effect_list || [];
var WANT = [
  ["Woodfire", ["Fire 2012", "Fire Flicker"], ["#ff3a00", "#ff9500", "#b31b00"], 55],
  ["Candlelight", ["Candle", "Candle Multi"], ["#ff8c1a", "#ffb04d", "#ff7a00"], 30],
  ["Ocean waves", ["Pacifica", "Lake", "Waves"], ["#0040ff", "#00b4ff", "#00ffd5"], 25],
  ["Aurora", ["Aurora", "Colorwaves"], ["#00ff9c", "#00d4ff", "#7a00ff"], 15],
  ["Lava lamp", ["Plasma", "Noise Pal", "Lava"], ["#ff0040", "#ff5a00", "#c000ff"], 15],
  ["Starry night", ["Twinklefox", "Twinkle", "Starburst"], ["#0a1aff", "#ffffff", "#3a6bff"], 30],
  ["Breathe", ["Breathe"], ["#ff2a00", "#7a0f00", "#000000"], 20],
  ["Rainbow", ["Rainbow", "Colorloop"], [], 50],
  ["Fireworks", ["Fireworks", "Fireworks Starburst"], ["#ff0000", "#00ff00", "#0000ff"], 60],
  ["Disco", ["Rain", "Dancing Shadows", "Juggle"], ["#ff0000", "#00ff00", "#ff00ff"], 85]
];
var wled = {
  id: "wled",
  label: "WLED",
  beta: true,
  match: (hass, e) => /wled/i.test(deviceOf2(hass, e)?.manufacturer || "") || /^light\.wled/.test(e),
  segments: (ctx) => Math.max(1, Math.min(wledLedCount(ctx), Number(ctx.cfg.segments) || 20)),
  problem: (ctx) => apiTopic(ctx) ? null : "Painting needs WLED's MQTT topic: enable MQTT in WLED (Sync settings) and set wled_topic, e.g. wled/bedroom.",
  styles: (ctx) => effectList(ctx).filter((n) => n !== "Solid").map((n) => ({ id: n, label: n })),
  caps: { colors: 3, speed: true, segments: false },
  paint: async (ctx, colors) => {
    const t = apiTopic(ctx);
    if (!t) throw new Error("wled_topic not set");
    if (!colors.some((c) => !isDark(c))) return ctx.mqtt(t, { on: false });
    return ctx.mqtt(t, { on: true, seg: [{ id: 0, fx: 0, i: wledRanges(colors, wledLedCount(ctx)) }] });
  },
  run: async (ctx, fx) => {
    const t = apiTopic(ctx);
    if (t) {
      const seg = { id: 0, sx: Math.round((Number(fx.speed) || 50) / 100 * 255) };
      if (fx.colors?.length) seg.col = fx.colors.slice(0, 3).map((c) => {
        const { r, g, b } = hex2rgb(c);
        return [r, g, b];
      });
      await ctx.mqtt(t, { on: true, seg: [seg] });
      await wait2(150);
    }
    await ctx.call("light", "turn_on", { entity_id: ctx.entity, effect: fx.type });
  },
  setSpeed: async (ctx, fx) => {
    const t = apiTopic(ctx);
    if (t) await ctx.mqtt(t, { seg: [{ id: 0, sx: Math.round((Number(fx.speed) || 50) / 100 * 255) }] });
  },
  defaultEffects: (ctx) => {
    const have = new Set(effectList(ctx));
    return WANT.map(([name, options, colors, speed]) => {
      const type = options.find((o) => have.has(o));
      return type ? [name, type, colors, speed] : null;
    }).filter(Boolean);
  }
};

// src/drivers/lights.js
var list = (ctx) => Array.isArray(ctx.cfg.segment_entities) ? ctx.cfg.segment_entities : [];
var segmentLights = {
  id: "segment_lights",
  label: "Segment lights (any brand)",
  beta: true,
  match: (_hass, _e, cfg) => Array.isArray(cfg?.segment_entities) && cfg.segment_entities.length > 0,
  segments: (ctx) => Math.max(1, list(ctx).length),
  problem: (ctx) => list(ctx).length ? null : "Add segment_entities: the light for each segment, in order along the strip.",
  styles: (ctx) => (ctx.hass.states[ctx.entity]?.attributes?.effect_list || []).map((n) => ({ id: n, label: n })),
  caps: { colors: 0, speed: false, segments: false },
  paint: (ctx, colors) => Promise.all(list(ctx).map((e, i) => {
    const c = colors[i] || "#000000";
    if (isDark(c)) return ctx.call("light", "turn_off", { entity_id: e });
    const { r, g, b } = hex2rgb(c);
    return ctx.call("light", "turn_on", { entity_id: e, rgb_color: [r, g, b] });
  })),
  run: (ctx, fx) => ctx.call("light", "turn_on", { entity_id: ctx.entity, effect: fx.type }),
  setSpeed: async () => {
  },
  // generic lights expose no effect speed
  defaultEffects: (ctx) => (ctx.hass.states[ctx.entity]?.attributes?.effect_list || []).slice(0, 12).map((n) => [n, n, [], 50])
};

// src/drift.js
var DRIFT_SCRIPT = "script.glow_studio_drift";
var DRIFT_STYLES = [
  { id: "drift", label: "Slow drift", colors: 8, minutes: true },
  { id: "drift_flow", label: "Slow flow", colors: 8, minutes: true }
];
var MINUTE_CHOICES = [5, 15, 30, 60, 120];
var isDrift = (type) => typeof type === "string" && type.startsWith("drift");
var DRIFT_DEFAULTS = [
  ["Slow sunset", "drift", ["#ffb300", "#ff5500", "#c2185b", "#41006e"], 30],
  ["Ocean drift", "drift_flow", ["#001a66", "#0060c0", "#00b4ff", "#00ffd5"], 20],
  ["Aurora drift", "drift_flow", ["#00ff9c", "#00d4ff", "#7a00ff", "#00ff5a"], 30],
  ["Ember drift", "drift", ["#ff3a00", "#b31b00", "#ff8c1a", "#7a0f00"], 15],
  ["Calm night", "drift", ["#1a0a40", "#2a1a6e", "#0a2a5a", "#3a1255"], 60]
];
var SLOW_RAINBOW = ["#ff0000", "#ffd000", "#00ff6a", "#0080ff", "#b000ff"];
function slowEquivalent(fx, minutes) {
  if (isDrift(fx.type)) return { ...fx, minutes };
  const travels = /chas|dash|flow|rainbow2|roll|wave|run|scan|comet|meteor|wipe/i.test(fx.type);
  const rainbow = /rainbow|colou?r ?loop/i.test(fx.type);
  const colors = fx.colors?.length >= 2 ? fx.colors : fx.colors?.length === 1 ? [fx.colors[0], "#000000"] : rainbow ? SLOW_RAINBOW : ["#ff5500", "#8200dc"];
  return { ...fx, type: travels ? "drift_flow" : "drift", colors: colors.slice(0, 8), minutes };
}
var driftMinutes = (fx) => Math.max(1, Math.min(240, Number(fx.minutes) || 30));
function driftVariables(driver, ctx, fx, segments) {
  const base = {
    driver: driver.id,
    entity: ctx.entity,
    segments,
    colors: (fx.colors?.length ? fx.colors : ["#ff5500", "#8200dc"]).slice(0, 8),
    minutes: driftMinutes(fx),
    flow: fx.type === "drift_flow"
  };
  if (driver.id === "wled") return { ...base, topic: ctx.cfg.wled_topic ? `${ctx.cfg.wled_topic.replace(/\/+$/, "")}/api` : "", leds: wledLedCount(ctx) };
  if (driver.id === "segment_lights") return { ...base, segment_entities: ctx.cfg.segment_entities || [] };
  return { ...base, topic: z2mTopic(ctx) || "" };
}

// src/drivers/index.js
var DRIVERS = [segmentLights, aqaraT1, aqaraT1M, hueGradient, wled];
var DRIVER_OPTIONS = DRIVERS.map((d) => ({ value: d.id, label: d.label + (d.beta ? " (beta)" : "") }));
function pickDriver(hass, cfg) {
  if (cfg.driver && cfg.driver !== "auto") return DRIVERS.find((d) => d.id === cfg.driver) || null;
  return DRIVERS.find((d) => d.match(hass, cfg.entity, cfg)) || null;
}
var allStyles = (driver, ctx) => [...driver.styles(ctx), ...DRIFT_STYLES];
function styleInfo(driver, ctx, type) {
  const s = allStyles(driver, ctx).find((x) => x.id === type);
  if (isDrift(type)) return { label: s?.label || type, colors: 8, speed: false, minutes: true, segments: false };
  const colors = s && s.colors !== void 0 ? s.colors : driver.caps.colors;
  return { label: s?.label || type, colors, speed: driver.caps.speed, minutes: false, segments: driver.caps.segments };
}

// src/views.js
var MENU_PATTERN = [["edit", "Load to paint"], ["overwrite", "Update with current"], ["rename", "Rename"], ["delete", "Delete"]];
var MENU_FX = [["edit", "Edit"], ["dup", "Duplicate"], ["delete", "Delete"]];
var menu = (attr, id, items) => `<div class="menu">${items.map(([a, l]) => `<button class="${a === "delete" ? "danger" : ""}" ${attr}="${a}" data-id="${esc(id)}">${l}</button>`).join("")}</div>`;
function paintTab(s) {
  const naming = s.naming?.kind === "pattern-new";
  return `<div class="swatches">${SWATCHES.map((c) => `<button class="sw ${c === s.color ? "cur" : ""}" data-color="${c}" style="background:${c}" title="${c === "#000000" ? "Off" : c}">${c === "#000000" ? "\u2298" : ""}</button>`).join("")}
      <label class="sw custom" title="Any colour"><input type="color" value="${s.color}" data-act="pick"><span style="background:${s.color}"></span></label></div>
    <p class="hint">Tap or drag across the strip to paint. ${s.sel.size ? `${s.sel.size} selected.` : "Long-press a segment to select it."}</p>
    <div class="row">
      <button class="chip ${s.mirror ? "on" : ""}" data-act="mirror">\u21CB Mirror</button>
      <button class="chip" data-act="fill">Fill all</button><button class="chip" data-act="blend">\u27F7 Blend</button>
      <button class="chip" data-act="selall">Select all</button><button class="chip" data-act="selnone">Clear selection</button>
    </div>
    ${naming ? `<div class="row name"><input placeholder="Pattern name" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">Save</button><button class="chip" data-act="name-cancel">Cancel</button></div>` : `<button class="wide pri" data-act="save-pattern">\uFF0B Save as pattern</button>`}`;
}
function patternsTab(s, lib) {
  const ren = s.naming?.kind === "pattern-rename" ? s.naming.id : null;
  const tiles = lib.patterns.map((p) => `
    <div class="tile ${lib.active?.kind === "pattern" && lib.active.id === p.id ? "act" : ""}">
      <button class="hit" data-apply-pattern="${esc(p.id)}">
        <div class="mini strip" style="--n:${p.colors.length}">${p.colors.map((c) => `<i style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 8px ${c}`}"></i>`).join("")}</div>
        ${ren === p.id ? "" : `<span>${esc(p.name)}</span>`}</button>
      ${ren === p.id ? `<div class="row name"><input value="${esc(p.name)}" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">OK</button></div>` : ""}
      <button class="dots" data-menu="${esc(p.id)}">\u22EF</button>
      ${s.menu === p.id ? menu("data-pattern-act", p.id, MENU_PATTERN) : ""}
    </div>`).join("");
  return `<div class="grid">${tiles || `<p class="hint">No patterns yet. Paint something and save it.</p>`}</div>`;
}
function effectsTab(s, lib, driver, ctx, n) {
  if (s.editing) return effectEditor(s, driver, ctx, n);
  const tiles = lib.effects.map((fx) => `
    <div class="tile ${lib.active?.kind === "effect" && lib.active.id === fx.id ? "act" : ""}">
      <button class="hit" data-run-effect="${esc(fx.id)}">${fxStripHtml(fx, "t" + fx.id, n)}<span>${esc(fx.name)}</span><em>${esc(styleInfo(driver, ctx, fx.type).label)}</em></button>
      <button class="dots" data-menu="${esc(fx.id)}">\u22EF</button>
      ${s.menu === fx.id ? menu("data-fx-act", fx.id, MENU_FX) : ""}
    </div>`).join("");
  return `<div class="grid">${tiles}</div><button class="wide pri" data-act="new-effect">\uFF0B New effect</button>`;
}
function styleChooser(styles, current) {
  if (styles.length > 12) {
    return `<select class="namebox" data-ed-type-select>${styles.map((st) => `<option value="${esc(st.id)}" ${st.id === current ? "selected" : ""}>${esc(st.label)}</option>`).join("")}</select>`;
  }
  return `<div class="row">${styles.map((st) => `<button class="chip ${st.id === current ? "on" : ""}" data-ed-type="${esc(st.id)}">${esc(st.label)}</button>`).join("")}</div>`;
}
function effectEditor(s, driver, ctx, n) {
  const fx = s.editing;
  const info = styleInfo(driver, ctx, fx.type);
  const colours = info.colors > 0 ? `
    <h4>Colours <small>${fx.colors.length}/${info.colors}</small></h4>
    <div class="swatches">${fx.colors.map((c, k) => `<span class="sw cur rm" style="background:${c}" data-ed-rm="${k}" title="Remove">\xD7</span>`).join("")}
      ${fx.colors.length < info.colors ? `<label class="sw custom" title="Add colour"><input type="color" value="#ff5500" data-ed="add"><span>\uFF0B</span></label>` : ""}</div>
    <div class="swatches small">${SWATCHES.slice(0, 13).map((c) => `<button class="sw" style="background:${c}" data-ed-add="${c}"></button>`).join("")}</div>` : `<p class="hint">This style uses the light's own colours.</p>`;
  return `<div class="editor">${fxStripHtml(fx, "edit", n, "main")}
    <input class="namebox" value="${esc(fx.name)}" maxlength="28" placeholder="Effect name" data-ed="name">
    <h4>Style</h4>${styleChooser(allStyles(driver, ctx), fx.type)}
    ${colours}
    ${info.minutes ? `<h4>One full cycle takes</h4><div class="row">${[5, 15, 30, 60, 120].map((m) => `<button class="chip ${driftMinutes(fx) === m ? "on" : ""}" data-ed-min="${m}">${m < 60 ? `${m} min` : `${m / 60} h`}</button>`).join("")}</div>
      <p class="hint">Runs in Home Assistant, so it can change as slowly as you like.</p>` : ""}
    ${info.speed ? `<h4>Speed <small data-speed>${fx.speed}%</small></h4><input type="range" min="1" max="100" value="${fx.speed}" data-ed="speed">
      ${slowChips("data-ed-slow")}` : ""}
    ${info.segments ? `<h4>Segments</h4><div class="row">${Object.entries(SEG_SETS).map(([k, v]) => `<button class="chip ${fx.segments === k ? "on" : ""}" data-ed-seg="${k}">${v}</button>`).join("")}</div>
      ${fx.segments === "selected" ? `<p class="hint">Uses the segments selected in Paint (${(fx.selected || []).length}).</p>` : ""}` : ""}
    <div class="row end"><button class="chip" data-act="ed-cancel">Cancel</button>
      <button class="chip" data-act="ed-try">\u25B6 Try it</button><button class="chip pri" data-act="ed-save">Save</button></div></div>`;
}
function speedBar(fx, info, minuteChoices) {
  if (info.minutes) {
    return `<div class="row speedbar"><span class="hint">Cycle</span>${minuteChoices.map((m) => `<button class="chip ${driftMinutes(fx) === m ? "on" : ""}" data-fx-min="${m}">${m < 60 ? `${m} min` : `${m / 60} h`}</button>`).join("")}</div>`;
  }
  if (!info.speed) return "";
  return `<label class="bri speedbar"><span title="Effect speed">\u23F1</span><input type="range" min="1" max="100" value="${Number(fx.speed) || 50}" data-fx-speed><b data-fx-speed-label>${Number(fx.speed) || 50}%</b></label>
    ${slowChips("data-fx-slow", minuteChoices)}`;
}
function slowChips(attr, choices = [5, 15, 30, 60, 120]) {
  return `<div class="row slower"><span class="hint">Slower:</span>${choices.map((m) => `<button class="chip" ${attr}="${m}" title="Change over ${m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}">${m < 60 ? `${m} min` : `${m / 60} h`}</button>`).join("")}</div>`;
}

// src/card.js
var Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
var wait3 = (ms) => new Promise((r) => setTimeout(r, ms));
var GlowStudioCard = class extends Base {
  static getConfigElement() {
    return document.createElement("glow-studio-card-editor");
  }
  static getStubConfig(hass) {
    const light = Object.keys(hass?.states || {}).find((e) => e.startsWith("light.") && /strip|led|wled|gradient/i.test(e));
    return { entity: light || "" };
  }
  setConfig(config) {
    const entity = config.entity || config.light;
    if (!entity) throw new Error("Pick the strip's light entity (entity: light.xxx)");
    const slug = slugify(entity);
    this._cfg = {
      title: "Glow Studio",
      z2m_base: "zigbee2mqtt",
      drift_script: DRIFT_SCRIPT,
      library_topic: `glow_studio/${slug}/library`,
      library_entity: `sensor.glow_studio_${slug}`,
      ...config,
      entity
    };
    this._s = { tab: "paint", sel: /* @__PURE__ */ new Set(), color: "#ff5500", mirror: false, editing: null, menu: null, naming: null };
    this._libSig = "";
    this._paint = null;
    this._dragging = false;
    this._error = null;
    this._driver = void 0;
  }
  /* ---------- context handed to drivers ---------- */
  get _ctx() {
    return {
      hass: this._hass,
      cfg: this._cfg,
      entity: this._cfg.entity,
      isOn: () => this._hass.states[this._cfg.entity]?.state === "on",
      mqtt: (topic, obj) => this._hass.callService("mqtt", "publish", { topic, payload: JSON.stringify(obj) }),
      call: (domain, service, data) => this._hass.callService(domain, service, data)
    };
  }
  get _n() {
    return this._driver ? this._driver.segments(this._ctx) : Number(this._cfg.segments) || 10;
  }
  get _light() {
    return this._hass?.states[this._cfg.entity];
  }
  set hass(hass) {
    this._hass = hass;
    if (this._driver === void 0 || !this._driver && !this._cfg.driver) this._driver = pickDriver(hass, this._cfg);
    const lib = this._lib();
    if (!this._paint) this._paint = lib?.current?.length ? scaleColors(lib.current, this._n) : Array(this._n).fill("#ffa600");
    if (this._dragging) return;
    const sig = JSON.stringify(lib) + "|" + this._light?.state + "|" + this._light?.attributes?.brightness;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this._libSig = sig;
      this._render();
      return;
    }
    if (sig === this._libSig) return;
    this._libSig = sig;
    let f = null;
    try {
      f = this.shadowRoot.activeElement;
    } catch {
    }
    if (f && ["INPUT", "SELECT"].includes(f.tagName)) return;
    this._render();
  }
  getCardSize() {
    return 8;
  }
  getGridOptions() {
    return { columns: "full", min_columns: 6 };
  }
  /* ---------- library (retained MQTT topic ⇄ MQTT sensor attributes) ---------- */
  _lib() {
    const a = this._hass?.states[this._cfg.library_entity]?.attributes;
    if (!a || !Array.isArray(a.patterns)) return null;
    return { version: a.version || 1, patterns: a.patterns, effects: a.effects || [], active: a.active || null, current: a.current || null };
  }
  _saveLib(lib) {
    lib.version = (lib.version || 1) + 1;
    return this._hass.callService("mqtt", "publish", { topic: this._cfg.library_topic, payload: JSON.stringify(lib), retain: true });
  }
  async _setup() {
    const id = this._cfg.library_entity.split(".")[1];
    const disc = {
      name: `Glow Studio ${this._light?.attributes?.friendly_name || id}`,
      unique_id: id,
      object_id: id,
      default_entity_id: this._cfg.library_entity,
      state_topic: this._cfg.library_topic,
      value_template: "{{ value_json.version }}",
      json_attributes_topic: this._cfg.library_topic,
      icon: "mdi:palette"
    };
    await this._hass.callService("mqtt", "publish", { topic: `homeassistant/sensor/${id}/library/config`, payload: JSON.stringify(disc), retain: true });
    await wait3(1500);
    const lib = defaultLibrary(this._n, this._driver.defaultEffects(this._ctx));
    DRIFT_DEFAULTS.forEach(([name, type, colors, minutes], i) => lib.effects.push({ id: `d${i}`, name, type, colors, minutes, speed: 50, segments: "all" }));
    await this._hass.callService("mqtt", "publish", { topic: this._cfg.library_topic, payload: JSON.stringify(lib), retain: true });
  }
  /* ---------- talking to the strip (via the driver) ---------- */
  async _guard(fn) {
    try {
      this._error = null;
      await fn();
    } catch (e) {
      this._error = e?.message || String(e);
      this._render();
    }
  }
  _sendPaint(colors, delay = 220) {
    clearTimeout(this._sendT);
    this._sendT = setTimeout(() => this._guard(async () => {
      await this._stopDrift();
      await this._driver.paint(this._ctx, colors);
      const lib = this._lib();
      if (!lib) return;
      const fromPattern = lib.active?.kind === "pattern" && lib.patterns.some((p) => p.id === lib.active.id && JSON.stringify(p.colors) === JSON.stringify(colors));
      if (JSON.stringify(lib.current) !== JSON.stringify(colors) || lib.active?.kind === "effect") {
        lib.current = [...colors];
        if (!fromPattern) lib.active = { kind: "pattern", id: null, name: "Custom" };
        await this._saveLib(lib);
      }
    }), delay);
  }
  async _applyPattern(p) {
    this._paint = scaleColors(p.colors, this._n);
    const lib = this._lib();
    lib.active = { kind: "pattern", id: p.id, name: p.name };
    lib.current = [...this._paint];
    await this._saveLib(lib);
    this._sendPaint(this._paint, 0);
    this._render();
  }
  /** Slow effects run in Home Assistant (drift script); hardware effects on the strip itself. */
  _runEffect(fx, remember = true) {
    return this._guard(async () => {
      if (isDrift(fx.type)) {
        if (!this._hass.states[this._cfg.drift_script]) throw new Error("Slow effects need the Glow Studio drift script. Import it from the README (one click).");
        await this._hass.callService("script", "turn_on", { entity_id: this._cfg.drift_script, variables: driftVariables(this._driver, this._ctx, fx, this._n) });
      } else {
        await this._stopDrift();
        await this._driver.run(this._ctx, fx);
      }
      if (remember) {
        const lib = this._lib();
        lib.active = { kind: "effect", id: fx.id, name: fx.name };
        await this._saveLib(lib);
      }
    });
  }
  async _stopDrift() {
    if (this._hass.states[this._cfg.drift_script]?.state === "on") {
      await this._hass.callService("script", "turn_off", { entity_id: this._cfg.drift_script });
    }
  }
  /** Quick speed change for the running effect (hardware speed, or cycle minutes for slow effects). */
  async _changeSpeed(patch) {
    const lib = this._lib();
    const fx = lib.effects.find((e) => e.id === lib.active?.id);
    if (!fx) return;
    Object.assign(fx, patch);
    await this._guard(async () => {
      if (isDrift(fx.type)) await this._runEffect(fx, false);
      else await this._driver.setSpeed(this._ctx, fx);
      await this._saveLib(lib);
    });
  }
  /** Running hardware effect → its slow version (same name/colours), saved and restarted via the drift script. */
  async _makeSlow(minutes) {
    const lib = this._lib();
    const i = lib.effects.findIndex((e) => e.id === lib.active?.id);
    if (i < 0) return;
    lib.effects[i] = slowEquivalent(lib.effects[i], minutes);
    await this._guard(async () => {
      await this._runEffect(lib.effects[i], false);
      if (!this._error) await this._saveLib(lib);
    });
  }
  async _stop() {
    this._sendPaint(this._paint, 0);
    const lib = this._lib();
    lib.active = { kind: "pattern", id: null, name: "Custom" };
    await this._saveLib(lib);
  }
  /* ---------- painting ---------- */
  _paintSeg(i) {
    (this._s.mirror ? [i, this._n - 1 - i] : [i]).forEach((k) => {
      this._paint[k] = this._s.color;
    });
    this._updateStrip();
    this._sendPaint(this._paint);
  }
  _blend() {
    const s = [...this._s.sel].sort((a2, b2) => a2 - b2);
    const [a, b] = s.length >= 2 ? [s[0], s[s.length - 1]] : [0, this._n - 1];
    for (let i = a; i <= b; i++) this._paint[i] = mix(this._paint[a], this._paint[b], (i - a) / Math.max(1, b - a));
    this._updateStrip();
    this._sendPaint(this._paint, 0);
  }
  _updateStrip() {
    this.shadowRoot.querySelectorAll(".main.strip i[data-seg]").forEach((el, i) => {
      el.style.background = this._paint[i];
      el.style.boxShadow = isDark(this._paint[i]) ? "none" : `0 0 18px ${this._paint[i]}aa`;
      el.classList.toggle("sel", this._s.sel.has(i));
    });
  }
  /* ---------- rendering ---------- */
  _render() {
    if (!this._hass || !this.shadowRoot) return;
    const head = `<style>${STYLES}</style>`;
    const msg = (html) => {
      this.shadowRoot.innerHTML = `${head}<ha-card><div class="setup">${html}</div></ha-card>`;
    };
    if (!this._light) return msg(`<p class="warn">Entity ${esc(this._cfg.entity)} not found.</p>`);
    if (!this._driver) return msg(`<h3>${esc(this._cfg.title)}</h3><p>This light isn't recognised as an addressable strip.
      Pick a driver in the card editor, or list <code>segment_entities</code> if each segment is its own light.</p>`);
    const lib = this._lib();
    if (!lib) {
      msg(`<h3>${esc(this._cfg.title)}</h3><p>First run: create the shared library of patterns and effects for this ${esc(this._driver.label)} (${this._n} segments).</p>
        <button class="wide pri" data-act="setup">\u2728 Set up Glow Studio</button>`);
      this.shadowRoot.querySelector("[data-act=setup]").onclick = () => this._setup();
      return;
    }
    const on = this._light.state === "on", s = this._s, ctx = this._ctx;
    const bri = Math.round((this._light.attributes?.brightness || 0) / 2.55);
    const fxActive = lib.active?.kind === "effect" ? lib.effects.find((e) => e.id === lib.active.id) : null;
    const strip = fxActive && on && s.tab !== "paint" ? fxStripHtml(fxActive, "main", this._n, "main") : `<div class="main strip" style="--n:${this._n}">${this._paint.map((c, i) => `<i data-seg="${i}" class="${s.sel.has(i) ? "sel" : ""}" style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 18px ${c}aa`}"></i>`).join("")}</div>`;
    const tabs = { paint: "\u{1F3A8} Paint", patterns: "\u25A6 Patterns", effects: "\u2728 Effects" };
    const body = s.tab === "paint" ? paintTab(s) : s.tab === "patterns" ? patternsTab(s, lib) : effectsTab(s, lib, this._driver, ctx, this._n);
    const problem = this._error || this._driver.problem(ctx);
    this.shadowRoot.innerHTML = `${head}<ha-card>
      <header>
        <div class="title"><span>${esc(this._cfg.title)}</span><small>${esc(on ? lib.active?.name || "Custom" : "Off")}${fxActive && on ? " \xB7 effect" : ""}</small></div>
        ${fxActive && on ? `<button class="chip stop" data-act="stop">\u25A0 Stop</button>` : ""}
        <button class="power ${on ? "on" : ""}" data-act="power" title="On / off">\u23FB</button>
      </header>
      ${problem ? `<p class="warn">${esc(problem)}</p>` : ""}
      ${strip}
      ${fxActive && on ? speedBar(fxActive, styleInfo(this._driver, ctx, fxActive.type), MINUTE_CHOICES) : ""}
      <label class="bri"><span>\u2600</span><input type="range" min="1" max="100" value="${on ? bri : 0}" data-act="bri"><b>${on ? bri + "%" : "off"}</b></label>
      <nav>${Object.entries(tabs).map(([t, l]) => `<button class="${s.tab === t ? "act" : ""}" data-tab="${t}">${l}</button>`).join("")}</nav>
      <section>${body}</section></ha-card>`;
    this._wire();
  }
  /* ---------- events ---------- */
  _wire() {
    const R = this.shadowRoot, q = (sel) => R.querySelectorAll(sel), s = this._s;
    const find = (list2, id) => list2.find((x) => x.id === id);
    q("[data-tab]").forEach((b) => b.onclick = () => {
      s.tab = b.dataset.tab;
      s.menu = null;
      s.naming = null;
      this._render();
    });
    q("[data-act]").forEach((el) => {
      if (el.tagName === "INPUT") el.oninput = el.onchange = (e) => this._onInput(el.dataset.act, e);
      else el.onclick = () => this._onAct(el.dataset.act);
    });
    q("[data-color]").forEach((b) => b.onclick = () => {
      s.color = b.dataset.color;
      this._colorPicked();
    });
    q("[data-menu]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      s.menu = s.menu === b.dataset.menu ? null : b.dataset.menu;
      this._render();
    });
    q("[data-apply-pattern]").forEach((b) => b.onclick = () => {
      const p = find(this._lib().patterns, b.dataset.applyPattern);
      if (p) this._applyPattern(p);
    });
    q("[data-run-effect]").forEach((b) => b.onclick = () => {
      const fx = find(this._lib().effects, b.dataset.runEffect);
      if (fx) this._runEffect(fx);
    });
    q("[data-pattern-act]").forEach((b) => b.onclick = () => this._patternAct(b.dataset.patternAct, b.dataset.id));
    q("[data-fx-act]").forEach((b) => b.onclick = () => this._fxAct(b.dataset.fxAct, b.dataset.id));
    q("[data-ed]").forEach((el) => el.oninput = el.onchange = (e) => this._edInput(el.dataset.ed, e));
    q("[data-ed-type]").forEach((b) => b.onclick = () => this._setStyle(b.dataset.edType));
    q("[data-ed-type-select]").forEach((el) => el.onchange = () => this._setStyle(el.value));
    q("[data-ed-seg]").forEach((b) => b.onclick = () => {
      s.editing.segments = b.dataset.edSeg;
      s.editing.selected = [...s.sel];
      this._render();
    });
    q("[data-ed-rm]").forEach((b) => b.onclick = () => {
      s.editing.colors.splice(Number(b.dataset.edRm), 1);
      this._render();
    });
    q("[data-ed-add]").forEach((b) => b.onclick = () => this._addColour(b.dataset.edAdd));
    q("[data-ed-min]").forEach((b) => b.onclick = () => {
      s.editing.minutes = Number(b.dataset.edMin);
      this._render();
    });
    q("[data-fx-min]").forEach((b) => b.onclick = () => this._changeSpeed({ minutes: Number(b.dataset.fxMin) }));
    q("[data-fx-slow]").forEach((b) => b.onclick = () => this._makeSlow(Number(b.dataset.fxSlow)));
    q("[data-ed-slow]").forEach((b) => b.onclick = () => {
      s.editing = slowEquivalent(s.editing, Number(b.dataset.edSlow));
      this._render();
    });
    q("[data-fx-speed]").forEach((el) => {
      el.oninput = () => {
        const l = R.querySelector("[data-fx-speed-label]");
        if (l) l.textContent = `${el.value}%`;
      };
      el.onchange = () => this._changeSpeed({ speed: Number(el.value) });
    });
    this._wireStrip();
    const ni = R.querySelector('[data-act="name-input"]');
    if (ni) {
      ni.focus();
      ni.onkeydown = (e) => {
        if (e.key === "Enter") this._onAct("name-save");
      };
    }
  }
  _wireStrip() {
    const strip = this.shadowRoot.querySelector(".main.strip");
    if (!strip?.querySelector("[data-seg]")) return;
    let down = false, pressT = null, last = -1;
    const sel = this._s.sel;
    const segAt = (e) => {
      const el = this.shadowRoot.elementFromPoint(e.clientX, e.clientY);
      return el?.dataset?.seg !== void 0 ? Number(el.dataset.seg) : -1;
    };
    const end = () => {
      down = false;
      this._dragging = false;
    };
    strip.onpointerdown = (e) => {
      const i = segAt(e);
      if (i < 0) return;
      down = true;
      this._dragging = true;
      last = i;
      strip.setPointerCapture(e.pointerId);
      pressT = setTimeout(() => {
        pressT = null;
        end();
        sel.has(i) ? sel.delete(i) : sel.add(i);
        this._render();
      }, 450);
    };
    strip.onpointermove = (e) => {
      if (!down) return;
      const i = segAt(e);
      if (i >= 0 && i !== last) {
        if (pressT) {
          clearTimeout(pressT);
          pressT = null;
          this._paintSeg(last);
        }
        last = i;
        this._paintSeg(i);
      }
    };
    strip.onpointerup = () => {
      if (pressT) {
        clearTimeout(pressT);
        pressT = null;
        if (sel.has(last)) {
          sel.forEach((k) => {
            this._paint[k] = this._s.color;
          });
          this._updateStrip();
          this._sendPaint(this._paint);
        } else this._paintSeg(last);
      }
      end();
    };
    strip.onpointercancel = () => {
      if (pressT) {
        clearTimeout(pressT);
        pressT = null;
      }
      end();
    };
  }
  _colorPicked() {
    const s = this._s;
    if (s.sel.size) {
      s.sel.forEach((k) => {
        this._paint[k] = s.color;
        if (s.mirror) this._paint[this._n - 1 - k] = s.color;
      });
      this._sendPaint(this._paint);
    }
    this._render();
  }
  _onInput(act, e) {
    if (act === "pick") {
      this._s.color = e.target.value;
      if (e.type === "change") this._colorPicked();
    }
    if (act === "bri" && e.type === "change") this._hass.callService("light", "turn_on", { entity_id: this._cfg.entity, brightness_pct: Number(e.target.value) });
    if (act === "name-input") this._nameDraft = e.target.value;
  }
  async _onAct(act) {
    const n = this._n, s = this._s;
    const first = () => allStyles(this._driver, this._ctx)[0];
    const actions = {
      power: () => this._hass.callService("light", "toggle", { entity_id: this._cfg.entity }),
      stop: () => this._stop(),
      mirror: () => {
        s.mirror = !s.mirror;
        this._render();
      },
      fill: () => {
        this._paint = Array(n).fill(s.color);
        this._render();
        this._sendPaint(this._paint, 0);
      },
      blend: () => this._blend(),
      selall: () => {
        s.sel = /* @__PURE__ */ new Set([...Array(n).keys()]);
        this._render();
      },
      selnone: () => {
        s.sel.clear();
        this._render();
      },
      "save-pattern": () => {
        s.naming = { kind: "pattern-new" };
        this._nameDraft = "";
        this._render();
      },
      "name-cancel": () => {
        s.naming = null;
        this._render();
      },
      "name-save": () => this._saveName(),
      "new-effect": () => {
        const type = first()?.id;
        if (!type) return;
        const max = styleInfo(this._driver, this._ctx, type).colors;
        s.editing = { id: null, name: "My effect", type, colors: ["#ff3a00", "#ff9500"].slice(0, max), speed: 50, minutes: 30, segments: "all" };
        this._render();
      },
      "ed-cancel": () => {
        s.editing = null;
        this._render();
      },
      "ed-try": () => this._runEffect(s.editing, false),
      "ed-save": () => this._saveEffect()
    };
    await actions[act]?.();
  }
  _setStyle(type) {
    const fx = this._s.editing;
    fx.type = type;
    const max = styleInfo(this._driver, this._ctx, type).colors;
    if (fx.colors.length > max) fx.colors = fx.colors.slice(0, max);
    this._render();
  }
  _addColour(c) {
    const fx = this._s.editing;
    if (fx.colors.length < styleInfo(this._driver, this._ctx, fx.type).colors) {
      fx.colors.push(c);
      this._render();
    }
  }
  async _saveName() {
    const s = this._s, name = (this._nameDraft || "").trim() || "Untitled";
    const lib = this._lib();
    if (s.naming?.kind === "pattern-new") lib.patterns.push({ id: uid(), name, colors: [...this._paint] });
    if (s.naming?.kind === "pattern-rename") {
      const p = lib.patterns.find((x) => x.id === s.naming.id);
      if (p) p.name = name;
    }
    s.naming = null;
    s.menu = null;
    if (s.tab === "paint") s.tab = "patterns";
    await this._saveLib(lib);
  }
  async _patternAct(act, id) {
    const s = this._s, lib = this._lib(), p = lib.patterns.find((x) => x.id === id);
    if (!p) return;
    s.menu = null;
    if (act === "edit") {
      this._paint = scaleColors(p.colors, this._n);
      s.tab = "paint";
      this._render();
      return;
    }
    if (act === "rename") {
      s.naming = { kind: "pattern-rename", id };
      this._nameDraft = p.name;
      this._render();
      return;
    }
    if (act === "overwrite") p.colors = [...this._paint];
    if (act === "delete") {
      if (!confirm(`Delete pattern "${p.name}"?`)) {
        this._render();
        return;
      }
      lib.patterns = lib.patterns.filter((x) => x.id !== id);
    }
    await this._saveLib(lib);
  }
  async _fxAct(act, id) {
    const s = this._s, lib = this._lib(), fx = lib.effects.find((x) => x.id === id);
    if (!fx) return;
    s.menu = null;
    if (act === "edit") {
      s.editing = JSON.parse(JSON.stringify(fx));
      this._render();
      return;
    }
    if (act === "dup") lib.effects.push({ ...JSON.parse(JSON.stringify(fx)), id: uid(), name: `${fx.name} copy` });
    if (act === "delete") {
      if (!confirm(`Delete effect "${fx.name}"?`)) {
        this._render();
        return;
      }
      lib.effects = lib.effects.filter((x) => x.id !== id);
    }
    await this._saveLib(lib);
  }
  _edInput(key, e) {
    const fx = this._s.editing;
    if (key === "name") fx.name = e.target.value;
    if (key === "speed") {
      fx.speed = Number(e.target.value);
      const lbl = this.shadowRoot.querySelector("[data-speed]");
      if (lbl) lbl.textContent = `${fx.speed}%`;
      if (e.type === "change") this._render();
    }
    if (key === "add" && e.type === "change") this._addColour(e.target.value);
  }
  async _saveEffect() {
    const s = this._s, fx = s.editing, lib = this._lib();
    fx.name = (fx.name || "").trim() || "My effect";
    if (fx.id) lib.effects = lib.effects.map((x) => x.id === fx.id ? fx : x);
    else {
      fx.id = uid();
      lib.effects.push(fx);
    }
    s.editing = null;
    await this._saveLib(lib);
  }
};

// src/editor.js
var Base2 = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
var LABELS = {
  entity: "Light",
  driver: "Strip type",
  title: "Title (optional)",
  z2m_topic: "Zigbee2MQTT set topic (optional, auto-detected)",
  segments: "Segments (optional, auto-detected where possible)",
  wled_topic: "WLED MQTT device topic (e.g. wled/bedroom)",
  leds: "Total LEDs (optional, auto-detected)",
  segment_entities: "Segment lights, in order along the strip"
};
function editorSchema(config, hass) {
  const driver = pickDriver(hass || {}, { ...config, entity: config.entity || config.light });
  const id = config.driver && config.driver !== "auto" ? config.driver : driver?.id;
  const schema = [
    { name: "entity", required: true, selector: { entity: { domain: "light" } } },
    { name: "driver", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: `Auto-detect${driver ? ` (${driver.label})` : ""}` }, ...DRIVER_OPTIONS] } } },
    { name: "title", selector: { text: {} } }
  ];
  if (["aqara_t1", "aqara_t1m", "hue_gradient"].includes(id)) schema.push({ name: "z2m_topic", selector: { text: {} } });
  if (id === "wled") schema.push({ name: "wled_topic", selector: { text: {} } }, { name: "leds", selector: { number: { min: 1, max: 2e3, mode: "box" } } });
  if (id === "segment_lights" || !id) schema.push({ name: "segment_entities", selector: { entity: { domain: "light", multiple: true } } });
  if (id !== "segment_lights") schema.push({ name: "segments", selector: { number: { min: 1, max: 100, mode: "box" } } });
  return schema;
}
var GlowStudioCardEditor = class extends Base2 {
  setConfig(config) {
    this._config = config;
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
  }
  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (e) => {
        const config = { ...e.detail.value };
        Object.keys(config).forEach((k) => {
          const v = config[k];
          if (v === "" || v === void 0 || Array.isArray(v) && !v.length || k === "driver" && v === "auto") delete config[k];
        });
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = editorSchema(this._config, this._hass);
    this._form.data = { driver: "auto", ...this._config, entity: this._config.entity || this._config.light };
  }
};

// src/index.js
var VERSION = "2.1.0";
if (!customElements.get("glow-studio-card")) customElements.define("glow-studio-card", GlowStudioCard);
if (!customElements.get("glow-studio-card-editor")) customElements.define("glow-studio-card-editor", GlowStudioCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "glow-studio-card",
  name: "Glow Studio",
  description: "Paint segments, save patterns and run hardware effects on addressable LED strips: Aqara T1/T1M, Hue gradient, WLED or any segment lights.",
  preview: false,
  documentationURL: "https://github.com/danish-din/glow-studio-card"
});
console.info(`%c GLOW-STUDIO %c ${VERSION} `, "background:#ff6a1a;color:#fff;font-weight:700", "background:#2a1d45;color:#fff");
