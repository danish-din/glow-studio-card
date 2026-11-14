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
var detectSegments = (hass, entityId) => {
  const dev = hass?.entities?.[entityId]?.device_id;
  if (!dev) return null;
  const len = Object.values(hass.entities).find(
    (e) => e.device_id === dev && e.entity_id.startsWith("number.") && /_length$/.test(e.entity_id)
  );
  const metres = len ? parseFloat(hass.states[len.entity_id]?.state) : NaN;
  return Number.isFinite(metres) && metres > 0 ? Math.round(metres * 5) : null;
};
var detectTopic = (hass, entityId, base = "zigbee2mqtt") => {
  const dev = hass?.entities?.[entityId]?.device_id;
  const name = dev ? hass.devices?.[dev]?.name : null;
  return name ? `${base}/${name}/set` : null;
};

// src/defaults.js
var FX_TYPES = {
  flicker: "Flicker",
  breathing: "Breathe",
  chasing: "Chase",
  dash: "Dash",
  hopping: "Hop",
  flash: "Flash",
  rainbow1: "Rainbow",
  rainbow2: "Rainbow flow"
};
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
var DEFAULT_EFFECTS = [
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
];
var defaultLibrary = (segments) => ({
  version: 1,
  patterns: DEFAULT_PATTERNS.map(([name, colors], i) => ({ id: `p${i}`, name, colors: scaleColors(colors, segments) })),
  effects: DEFAULT_EFFECTS.map(([name, type, colors, speed], i) => ({ id: `e${i}`, name, type, colors, speed, segments: "all" })),
  active: null,
  current: scaleColors(DEFAULT_PATTERNS[2][1], segments)
});

// src/preview.js
function fxCss(fx, scope) {
  const cols = String(fx.type).startsWith("rainbow") ? RAINBOW : fx.colors?.length ? fx.colors : ["#ff5500"];
  const dur = 0.5 + (100 - (Number(fx.speed) || 50)) / 100 * 5;
  const d = (x) => x.toFixed(2);
  const name = `fx_${String(scope).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stops = cols.map((c, k) => `${Math.round(k / cols.length * 100)}%{background:${c};box-shadow:0 0 14px ${c}}`).join("") + `100%{background:${cols[0]};box-shadow:0 0 14px ${cols[0]}}`;
  let anim = `${name} ${d(dur * cols.length)}s linear infinite`;
  let delay = (i) => `${-i * 0.35}s`;
  let extra = "";
  switch (fx.type) {
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
  return { css: `@keyframes ${name}{${stops}}${extra}`, anim, delay, cols };
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
`;

// src/card.js
var Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
var STEP_MS = 350;
var GlowStudioCard = class extends Base {
  static getConfigElement() {
    return document.createElement("glow-studio-card-editor");
  }
  static getStubConfig(hass) {
    const light = Object.keys(hass?.states || {}).find((e) => e.startsWith("light.") && /strip|led/i.test(e));
    return { entity: light || "" };
  }
  setConfig(config) {
    const entity = config.entity || config.light;
    if (!entity) throw new Error("Pick the strip's light entity (entity: light.xxx)");
    const slug = slugify(entity);
    this._cfg = {
      title: "Glow Studio",
      z2m_base: "zigbee2mqtt",
      library_topic: `glow_studio/${slug}/library`,
      library_entity: `sensor.glow_studio_${slug}`,
      ...config,
      entity
    };
    this._tab = "paint";
    this._sel = /* @__PURE__ */ new Set();
    this._color = "#ff5500";
    this._mirror = false;
    this._editing = null;
    this._menu = null;
    this._naming = null;
    this._libSig = "";
    this._paint = null;
    this._dragging = false;
  }
  /* ---------- derived config ---------- */
  get _n() {
    return Number(this._cfg.segments) || detectSegments(this._hass, this._cfg.entity) || 10;
  }
  get _topic() {
    return this._cfg.z2m_topic || detectTopic(this._hass, this._cfg.entity, this._cfg.z2m_base);
  }
  get _light() {
    return this._hass?.states[this._cfg.entity];
  }
  set hass(hass) {
    this._hass = hass;
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
    await wait(1500);
    await this._hass.callService("mqtt", "publish", { topic: this._cfg.library_topic, payload: JSON.stringify(defaultLibrary(this._n)), retain: true });
  }
  /* ---------- strip I/O ---------- */
  _pub(obj) {
    return this._hass.callService("mqtt", "publish", { topic: this._topic, payload: JSON.stringify(obj) });
  }
  _sendPaint(colors, delay = 220) {
    clearTimeout(this._sendT);
    this._sendT = setTimeout(async () => {
      if (!colors.some((c) => !isDark(c))) {
        await this._pub({ state: "OFF" });
        return;
      }
      if (this._light?.state !== "on") await this._pub({ state: "ON", brightness: 200 });
      await this._pub({ segment_colors: colors.map((c, i) => ({ segment: i + 1, color: hex2rgb(c) })) });
      const lib = this._lib();
      if (!lib) return;
      const fromPattern = lib.active?.kind === "pattern" && lib.patterns.some((p) => p.id === lib.active.id && JSON.stringify(p.colors) === JSON.stringify(colors));
      if (JSON.stringify(lib.current) !== JSON.stringify(colors) || lib.active?.kind === "effect") {
        lib.current = [...colors];
        if (!fromPattern) lib.active = { kind: "pattern", id: null, name: "Custom" };
        await this._saveLib(lib);
      }
    }, delay);
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
  async _runEffect(fx, remember = true) {
    if (this._light?.state !== "on") {
      await this._pub({ state: "ON", brightness: 200 });
      await wait(STEP_MS);
    }
    if (!fx.type.startsWith("rainbow")) {
      await this._pub({ effect_colors: (fx.colors.length ? fx.colors : ["#ff5500"]).slice(0, 8).map(hex2rgb) });
      await wait(STEP_MS);
    }
    await this._pub({ effect_segments: segString(fx) });
    await wait(STEP_MS);
    await this._pub({ effect_speed: Number(fx.speed) || 50 });
    await wait(STEP_MS);
    await this._pub({ effect: fx.type });
    if (remember) {
      const lib = this._lib();
      lib.active = { kind: "effect", id: fx.id, name: fx.name };
      await this._saveLib(lib);
    }
  }
  async _stop() {
    this._sendPaint(this._paint, 0);
    const lib = this._lib();
    lib.active = { kind: "pattern", id: null, name: "Custom" };
    await this._saveLib(lib);
  }
  /* ---------- painting ---------- */
  _paintSeg(i) {
    (this._mirror ? [i, this._n - 1 - i] : [i]).forEach((k) => {
      this._paint[k] = this._color;
    });
    this._updateStrip();
    this._sendPaint(this._paint);
  }
  _blend() {
    const s = [...this._sel].sort((a2, b2) => a2 - b2);
    const [a, b] = s.length >= 2 ? [s[0], s[s.length - 1]] : [0, this._n - 1];
    for (let i = a; i <= b; i++) this._paint[i] = mix(this._paint[a], this._paint[b], (i - a) / Math.max(1, b - a));
    this._updateStrip();
    this._sendPaint(this._paint, 0);
  }
  _updateStrip() {
    this.shadowRoot.querySelectorAll(".main.strip i[data-seg]").forEach((el, i) => {
      el.style.background = this._paint[i];
      el.style.boxShadow = isDark(this._paint[i]) ? "none" : `0 0 18px ${this._paint[i]}aa`;
      el.classList.toggle("sel", this._sel.has(i));
    });
  }
  /* ---------- rendering ---------- */
  _render() {
    if (!this._hass || !this.shadowRoot) return;
    const lib = this._lib();
    const head = `<style>${STYLES}</style>`;
    if (!this._light) {
      this.shadowRoot.innerHTML = `${head}<ha-card><p class="warn">Entity ${esc(this._cfg.entity)} not found.</p></ha-card>`;
      return;
    }
    if (!lib) {
      this.shadowRoot.innerHTML = `${head}<ha-card><div class="setup"><h3>${esc(this._cfg.title)}</h3>
        <p>First run: create the shared library of patterns and effects for this strip (${this._n} segments).</p>
        <button class="wide pri" data-act="setup">\u2728 Set up Glow Studio</button></div></ha-card>`;
      this.shadowRoot.querySelector("[data-act=setup]").onclick = () => this._setup();
      return;
    }
    const on = this._light.state === "on";
    const bri = Math.round((this._light.attributes?.brightness || 0) / 2.55);
    const fxActive = lib.active?.kind === "effect" ? lib.effects.find((e) => e.id === lib.active.id) : null;
    const showFx = fxActive && on && this._tab !== "paint";
    const strip = showFx ? fxStripHtml(fxActive, "main", this._n, "main") : `<div class="main strip" style="--n:${this._n}">${this._paint.map((c, i) => `<i data-seg="${i}" class="${this._sel.has(i) ? "sel" : ""}" style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 18px ${c}aa`}"></i>`).join("")}</div>`;
    const tabs = { paint: "\u{1F3A8} Paint", patterns: "\u25A6 Patterns", effects: "\u2728 Effects" };
    const body = this._tab === "paint" ? this._paintTab() : this._tab === "patterns" ? this._patternsTab(lib) : this._effectsTab(lib);
    this.shadowRoot.innerHTML = `${head}<ha-card>
      <header>
        <div class="title"><span>${esc(this._cfg.title)}</span><small>${esc(on ? lib.active?.name || "Custom" : "Off")}${fxActive && on ? " \xB7 effect" : ""}</small></div>
        ${fxActive && on ? `<button class="chip stop" data-act="stop">\u25A0 Stop</button>` : ""}
        <button class="power ${on ? "on" : ""}" data-act="power" title="On / off">\u23FB</button>
      </header>
      ${this._topic ? "" : `<p class="warn">Couldn't work out the Zigbee2MQTT topic. Set <code>z2m_topic</code> in the card config.</p>`}
      ${strip}
      <label class="bri"><span>\u2600</span><input type="range" min="1" max="100" value="${on ? bri : 0}" data-act="bri"><b>${on ? bri + "%" : "off"}</b></label>
      <nav>${Object.entries(tabs).map(([t, l]) => `<button class="${this._tab === t ? "act" : ""}" data-tab="${t}">${l}</button>`).join("")}</nav>
      <section>${body}</section></ha-card>`;
    this._wire();
  }
  _paintTab() {
    const naming = this._naming?.kind === "pattern-new";
    return `<div class="swatches">${SWATCHES.map((c) => `<button class="sw ${c === this._color ? "cur" : ""}" data-color="${c}" style="background:${c}" title="${c === "#000000" ? "Off" : c}">${c === "#000000" ? "\u2298" : ""}</button>`).join("")}
        <label class="sw custom" title="Any colour"><input type="color" value="${this._color}" data-act="pick"><span style="background:${this._color}"></span></label></div>
      <p class="hint">Tap or drag across the strip to paint. ${this._sel.size ? `${this._sel.size} selected.` : "Long-press a segment to select it."}</p>
      <div class="row">
        <button class="chip ${this._mirror ? "on" : ""}" data-act="mirror">\u21CB Mirror</button>
        <button class="chip" data-act="fill">Fill all</button><button class="chip" data-act="blend">\u27F7 Blend</button>
        <button class="chip" data-act="selall">Select all</button><button class="chip" data-act="selnone">Clear selection</button>
      </div>
      ${naming ? `<div class="row name"><input placeholder="Pattern name" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">Save</button><button class="chip" data-act="name-cancel">Cancel</button></div>` : `<button class="wide pri" data-act="save-pattern">\uFF0B Save as pattern</button>`}`;
  }
  _patternsTab(lib) {
    const ren = this._naming?.kind === "pattern-rename" ? this._naming.id : null;
    const tiles = lib.patterns.map((p) => `
      <div class="tile ${lib.active?.kind === "pattern" && lib.active.id === p.id ? "act" : ""}">
        <button class="hit" data-apply-pattern="${esc(p.id)}">
          <div class="mini strip" style="--n:${p.colors.length}">${p.colors.map((c) => `<i style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 8px ${c}`}"></i>`).join("")}</div>
          ${ren === p.id ? "" : `<span>${esc(p.name)}</span>`}</button>
        ${ren === p.id ? `<div class="row name"><input value="${esc(p.name)}" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">OK</button></div>` : ""}
        <button class="dots" data-menu="${esc(p.id)}">\u22EF</button>
        ${this._menu === p.id ? `<div class="menu">
          <button data-pattern-act="edit" data-id="${esc(p.id)}">Load to paint</button>
          <button data-pattern-act="overwrite" data-id="${esc(p.id)}">Update with current</button>
          <button data-pattern-act="rename" data-id="${esc(p.id)}">Rename</button>
          <button class="danger" data-pattern-act="delete" data-id="${esc(p.id)}">Delete</button></div>` : ""}
      </div>`).join("");
    return `<div class="grid">${tiles || `<p class="hint">No patterns yet. Paint something and save it.</p>`}</div>`;
  }
  _effectsTab(lib) {
    if (this._editing) return this._effectEditor();
    const tiles = lib.effects.map((fx) => `
      <div class="tile ${lib.active?.kind === "effect" && lib.active.id === fx.id ? "act" : ""}">
        <button class="hit" data-run-effect="${esc(fx.id)}">${fxStripHtml(fx, "t" + fx.id, this._n)}<span>${esc(fx.name)}</span><em>${FX_TYPES[fx.type] || esc(fx.type)}</em></button>
        <button class="dots" data-menu="${esc(fx.id)}">\u22EF</button>
        ${this._menu === fx.id ? `<div class="menu">
          <button data-fx-act="edit" data-id="${esc(fx.id)}">Edit</button>
          <button data-fx-act="dup" data-id="${esc(fx.id)}">Duplicate</button>
          <button class="danger" data-fx-act="delete" data-id="${esc(fx.id)}">Delete</button></div>` : ""}
      </div>`).join("");
    return `<div class="grid">${tiles}</div><button class="wide pri" data-act="new-effect">\uFF0B New effect</button>`;
  }
  _effectEditor() {
    const fx = this._editing, rainbow = fx.type.startsWith("rainbow");
    return `<div class="editor">${fxStripHtml(fx, "edit", this._n, "main")}
      <input class="namebox" value="${esc(fx.name)}" maxlength="28" placeholder="Effect name" data-ed="name">
      <h4>Style</h4><div class="row">${Object.entries(FX_TYPES).map(([k, v]) => `<button class="chip ${fx.type === k ? "on" : ""}" data-ed-type="${k}">${v}</button>`).join("")}</div>
      ${rainbow ? `<p class="hint">Rainbow styles use the strip's own colours.</p>` : `
      <h4>Colours <small>${fx.colors.length}/8</small></h4>
      <div class="swatches">${fx.colors.map((c, k) => `<span class="sw cur rm" style="background:${c}" data-ed-rm="${k}" title="Remove">\xD7</span>`).join("")}
        ${fx.colors.length < 8 ? `<label class="sw custom" title="Add colour"><input type="color" value="#ff5500" data-ed="add"><span>\uFF0B</span></label>` : ""}</div>
      <div class="swatches small">${SWATCHES.slice(0, 13).map((c) => `<button class="sw" style="background:${c}" data-ed-add="${c}"></button>`).join("")}</div>`}
      <h4>Speed <small data-speed>${fx.speed}%</small></h4><input type="range" min="1" max="100" value="${fx.speed}" data-ed="speed">
      <h4>Segments</h4><div class="row">${Object.entries(SEG_SETS).map(([k, v]) => `<button class="chip ${fx.segments === k ? "on" : ""}" data-ed-seg="${k}">${v}</button>`).join("")}</div>
      ${fx.segments === "selected" ? `<p class="hint">Uses the segments selected in Paint (${(fx.selected || []).length}).</p>` : ""}
      <div class="row end"><button class="chip" data-act="ed-cancel">Cancel</button>
        <button class="chip" data-act="ed-try">\u25B6 Try on strip</button><button class="chip pri" data-act="ed-save">Save</button></div></div>`;
  }
  /* ---------- events ---------- */
  _wire() {
    const R = this.shadowRoot, q = (s) => R.querySelectorAll(s);
    const find = (list, id) => list.find((x) => x.id === id);
    q("[data-tab]").forEach((b) => b.onclick = () => {
      this._tab = b.dataset.tab;
      this._menu = null;
      this._naming = null;
      this._render();
    });
    q("[data-act]").forEach((el) => {
      if (el.tagName === "INPUT") el.oninput = el.onchange = (e) => this._onInput(el.dataset.act, e);
      else el.onclick = () => this._onAct(el.dataset.act);
    });
    q("[data-color]").forEach((b) => b.onclick = () => {
      this._color = b.dataset.color;
      this._colorPicked();
    });
    q("[data-menu]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      this._menu = this._menu === b.dataset.menu ? null : b.dataset.menu;
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
    q("[data-ed-type]").forEach((b) => b.onclick = () => {
      this._editing.type = b.dataset.edType;
      this._render();
    });
    q("[data-ed-seg]").forEach((b) => b.onclick = () => {
      this._editing.segments = b.dataset.edSeg;
      this._editing.selected = [...this._sel];
      this._render();
    });
    q("[data-ed-rm]").forEach((b) => b.onclick = () => {
      this._editing.colors.splice(Number(b.dataset.edRm), 1);
      this._render();
    });
    q("[data-ed-add]").forEach((b) => b.onclick = () => {
      if (this._editing.colors.length < 8) {
        this._editing.colors.push(b.dataset.edAdd);
        this._render();
      }
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
        this._sel.has(i) ? this._sel.delete(i) : this._sel.add(i);
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
        if (this._sel.has(last)) {
          this._sel.forEach((k) => {
            this._paint[k] = this._color;
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
    if (this._sel.size) {
      this._sel.forEach((k) => {
        this._paint[k] = this._color;
        if (this._mirror) this._paint[this._n - 1 - k] = this._color;
      });
      this._sendPaint(this._paint);
    }
    this._render();
  }
  _onInput(act, e) {
    if (act === "pick") {
      this._color = e.target.value;
      if (e.type === "change") this._colorPicked();
    }
    if (act === "bri" && e.type === "change") this._hass.callService("light", "turn_on", { entity_id: this._cfg.entity, brightness_pct: Number(e.target.value) });
    if (act === "name-input") this._nameDraft = e.target.value;
  }
  async _onAct(act) {
    const n = this._n;
    const actions = {
      power: () => this._hass.callService("light", "toggle", { entity_id: this._cfg.entity }),
      stop: () => this._stop(),
      mirror: () => {
        this._mirror = !this._mirror;
        this._render();
      },
      fill: () => {
        this._paint = Array(n).fill(this._color);
        this._render();
        this._sendPaint(this._paint, 0);
      },
      blend: () => this._blend(),
      selall: () => {
        this._sel = /* @__PURE__ */ new Set([...Array(n).keys()]);
        this._render();
      },
      selnone: () => {
        this._sel.clear();
        this._render();
      },
      "save-pattern": () => {
        this._naming = { kind: "pattern-new" };
        this._nameDraft = "";
        this._render();
      },
      "name-cancel": () => {
        this._naming = null;
        this._render();
      },
      "name-save": () => this._saveName(),
      "new-effect": () => {
        this._editing = { id: null, name: "My effect", type: "flicker", colors: ["#ff3a00", "#ff9500"], speed: 50, segments: "all" };
        this._render();
      },
      "ed-cancel": () => {
        this._editing = null;
        this._render();
      },
      "ed-try": () => this._runEffect(this._editing, false),
      "ed-save": () => this._saveEffect()
    };
    await actions[act]?.();
  }
  async _saveName() {
    const name = (this._nameDraft || "").trim() || "Untitled";
    const lib = this._lib();
    if (this._naming?.kind === "pattern-new") lib.patterns.push({ id: uid(), name, colors: [...this._paint] });
    if (this._naming?.kind === "pattern-rename") {
      const p = lib.patterns.find((x) => x.id === this._naming.id);
      if (p) p.name = name;
    }
    this._naming = null;
    this._menu = null;
    if (this._tab === "paint") this._tab = "patterns";
    await this._saveLib(lib);
  }
  async _patternAct(act, id) {
    const lib = this._lib(), p = lib.patterns.find((x) => x.id === id);
    if (!p) return;
    this._menu = null;
    if (act === "edit") {
      this._paint = scaleColors(p.colors, this._n);
      this._tab = "paint";
      this._render();
      return;
    }
    if (act === "rename") {
      this._naming = { kind: "pattern-rename", id };
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
    const lib = this._lib(), fx = lib.effects.find((x) => x.id === id);
    if (!fx) return;
    this._menu = null;
    if (act === "edit") {
      this._editing = JSON.parse(JSON.stringify(fx));
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
    const fx = this._editing;
    if (key === "name") fx.name = e.target.value;
    if (key === "speed") {
      fx.speed = Number(e.target.value);
      const lbl = this.shadowRoot.querySelector("[data-speed]");
      if (lbl) lbl.textContent = `${fx.speed}%`;
      if (e.type === "change") this._render();
    }
    if (key === "add" && e.type === "change" && fx.colors.length < 8) {
      fx.colors.push(e.target.value);
      this._render();
    }
  }
  async _saveEffect() {
    const fx = this._editing, lib = this._lib();
    fx.name = (fx.name || "").trim() || "My effect";
    if (fx.id) lib.effects = lib.effects.map((x) => x.id === fx.id ? fx : x);
    else {
      fx.id = uid();
      lib.effects.push(fx);
    }
    this._editing = null;
    await this._saveLib(lib);
  }
};

// src/editor.js
var Base2 = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
var SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "light" } } },
  { name: "title", selector: { text: {} } },
  { name: "z2m_topic", selector: { text: {} } },
  { name: "segments", selector: { number: { min: 1, max: 50, mode: "box" } } }
];
var LABELS = {
  entity: "Strip light",
  title: "Title (optional)",
  z2m_topic: "Zigbee2MQTT set topic (optional, auto-detected)",
  segments: "Segments (optional, auto-detected: 5 per metre)"
};
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
        Object.keys(config).forEach((k) => (config[k] === "" || config[k] === void 0) && delete config[k]);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = SCHEMA;
    this._form.data = { ...this._config, entity: this._config.entity || this._config.light };
  }
};

// src/index.js
var VERSION = "1.1.0";
if (!customElements.get("glow-studio-card")) customElements.define("glow-studio-card", GlowStudioCard);
if (!customElements.get("glow-studio-card-editor")) customElements.define("glow-studio-card-editor", GlowStudioCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "glow-studio-card",
  name: "Glow Studio",
  description: "Paint segments, save patterns and run hardware effects on an Aqara T1 LED strip (Zigbee2MQTT).",
  preview: false,
  documentationURL: "https://github.com/danish-din/glow-studio-card"
});
console.info(`%c GLOW-STUDIO %c ${VERSION} `, "background:#ff6a1a;color:#fff;font-weight:700", "background:#2a1d45;color:#fff");
