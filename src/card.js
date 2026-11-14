// <glow-studio-card> — paint, patterns and hardware effects for an Aqara T1 LED strip via Zigbee2MQTT.
import { esc, hex2rgb, mix, isDark, uid, slugify, segString, detectSegments, detectTopic, scaleColors } from "./helpers.js";
import { FX_TYPES, SWATCHES, SEG_SETS, defaultLibrary } from "./defaults.js";
import { fxStripHtml } from "./preview.js";
import { STYLES } from "./styles.js";

const Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP_MS = 350; // gap between Z2M writes when starting an effect

export class GlowStudioCard extends Base {
  static getConfigElement() { return document.createElement("glow-studio-card-editor"); }
  static getStubConfig(hass) {
    const light = Object.keys(hass?.states || {}).find((e) => e.startsWith("light.") && /strip|led/i.test(e));
    return { entity: light || "" };
  }

  setConfig(config) {
    const entity = config.entity || config.light;
    if (!entity) throw new Error("Pick the strip's light entity (entity: light.xxx)");
    const slug = slugify(entity);
    this._cfg = {
      title: "Glow Studio", z2m_base: "zigbee2mqtt",
      library_topic: `glow_studio/${slug}/library`, library_entity: `sensor.glow_studio_${slug}`,
      ...config, entity,
    };
    this._tab = "paint"; this._sel = new Set(); this._color = "#ff5500"; this._mirror = false;
    this._editing = null; this._menu = null; this._naming = null; this._libSig = "";
    this._paint = null; this._dragging = false;
  }

  /* ---------- derived config ---------- */
  get _n() { return Number(this._cfg.segments) || detectSegments(this._hass, this._cfg.entity) || 10; }
  get _topic() { return this._cfg.z2m_topic || detectTopic(this._hass, this._cfg.entity, this._cfg.z2m_base); }
  get _light() { return this._hass?.states[this._cfg.entity]; }

  set hass(hass) {
    this._hass = hass;
    const lib = this._lib();
    if (!this._paint) this._paint = lib?.current?.length ? scaleColors(lib.current, this._n) : Array(this._n).fill("#ffa600");
    if (this._dragging) return;
    const sig = JSON.stringify(lib) + "|" + this._light?.state + "|" + this._light?.attributes?.brightness;
    if (!this.shadowRoot) { this.attachShadow({ mode: "open" }); this._libSig = sig; this._render(); return; }
    if (sig === this._libSig) return;
    this._libSig = sig;
    let f = null;
    try { f = this.shadowRoot.activeElement; } catch { /* some DOMs throw here; treat as nothing focused */ }
    if (f && ["INPUT", "SELECT"].includes(f.tagName)) return; // don't wipe a field the user is typing in
    this._render();
  }

  getCardSize() { return 8; }
  getGridOptions() { return { columns: "full", min_columns: 6 }; }

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
      name: `Glow Studio ${this._light?.attributes?.friendly_name || id}`, unique_id: id, object_id: id,
      default_entity_id: this._cfg.library_entity, state_topic: this._cfg.library_topic,
      value_template: "{{ value_json.version }}", json_attributes_topic: this._cfg.library_topic, icon: "mdi:palette",
    };
    await this._hass.callService("mqtt", "publish", { topic: `homeassistant/sensor/${id}/library/config`, payload: JSON.stringify(disc), retain: true });
    await wait(1500);
    await this._hass.callService("mqtt", "publish", { topic: this._cfg.library_topic, payload: JSON.stringify(defaultLibrary(this._n)), retain: true });
  }

  /* ---------- strip I/O ---------- */
  _pub(obj) { return this._hass.callService("mqtt", "publish", { topic: this._topic, payload: JSON.stringify(obj) }); }

  _sendPaint(colors, delay = 220) {
    clearTimeout(this._sendT);
    this._sendT = setTimeout(async () => {
      if (!colors.some((c) => !isDark(c))) { await this._pub({ state: "OFF" }); return; }
      if (this._light?.state !== "on") await this._pub({ state: "ON", brightness: 200 });
      await this._pub({ segment_colors: colors.map((c, i) => ({ segment: i + 1, color: hex2rgb(c) })) });
      const lib = this._lib(); if (!lib) return;
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
    lib.active = { kind: "pattern", id: p.id, name: p.name }; lib.current = [...this._paint];
    await this._saveLib(lib);
    this._sendPaint(this._paint, 0);
    this._render();
  }
  async _runEffect(fx, remember = true) {
    if (this._light?.state !== "on") { await this._pub({ state: "ON", brightness: 200 }); await wait(STEP_MS); }
    if (!fx.type.startsWith("rainbow")) {
      await this._pub({ effect_colors: (fx.colors.length ? fx.colors : ["#ff5500"]).slice(0, 8).map(hex2rgb) }); await wait(STEP_MS);
    }
    await this._pub({ effect_segments: segString(fx) }); await wait(STEP_MS);
    await this._pub({ effect_speed: Number(fx.speed) || 50 }); await wait(STEP_MS);
    await this._pub({ effect: fx.type });
    if (remember) { const lib = this._lib(); lib.active = { kind: "effect", id: fx.id, name: fx.name }; await this._saveLib(lib); }
  }
  async _stop() {
    this._sendPaint(this._paint, 0);
    const lib = this._lib(); lib.active = { kind: "pattern", id: null, name: "Custom" }; await this._saveLib(lib);
  }

  /* ---------- painting ---------- */
  _paintSeg(i) {
    (this._mirror ? [i, this._n - 1 - i] : [i]).forEach((k) => { this._paint[k] = this._color; });
    this._updateStrip(); this._sendPaint(this._paint);
  }
  _blend() {
    const s = [...this._sel].sort((a, b) => a - b);
    const [a, b] = s.length >= 2 ? [s[0], s[s.length - 1]] : [0, this._n - 1];
    for (let i = a; i <= b; i++) this._paint[i] = mix(this._paint[a], this._paint[b], (i - a) / Math.max(1, b - a));
    this._updateStrip(); this._sendPaint(this._paint, 0);
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
    if (!this._light) { this.shadowRoot.innerHTML = `${head}<ha-card><p class="warn">Entity ${esc(this._cfg.entity)} not found.</p></ha-card>`; return; }
    if (!lib) {
      this.shadowRoot.innerHTML = `${head}<ha-card><div class="setup"><h3>${esc(this._cfg.title)}</h3>
        <p>First run: create the shared library of patterns and effects for this strip (${this._n} segments).</p>
        <button class="wide pri" data-act="setup">✨ Set up Glow Studio</button></div></ha-card>`;
      this.shadowRoot.querySelector("[data-act=setup]").onclick = () => this._setup();
      return;
    }
    const on = this._light.state === "on";
    const bri = Math.round((this._light.attributes?.brightness || 0) / 2.55);
    const fxActive = lib.active?.kind === "effect" ? lib.effects.find((e) => e.id === lib.active.id) : null;
    const showFx = fxActive && on && this._tab !== "paint";
    const strip = showFx ? fxStripHtml(fxActive, "main", this._n, "main")
      : `<div class="main strip" style="--n:${this._n}">${this._paint.map((c, i) =>
          `<i data-seg="${i}" class="${this._sel.has(i) ? "sel" : ""}" style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 18px ${c}aa`}"></i>`).join("")}</div>`;
    const tabs = { paint: "🎨 Paint", patterns: "▦ Patterns", effects: "✨ Effects" };
    const body = this._tab === "paint" ? this._paintTab() : this._tab === "patterns" ? this._patternsTab(lib) : this._effectsTab(lib);
    this.shadowRoot.innerHTML = `${head}<ha-card>
      <header>
        <div class="title"><span>${esc(this._cfg.title)}</span><small>${esc(on ? (lib.active?.name || "Custom") : "Off")}${fxActive && on ? " · effect" : ""}</small></div>
        ${fxActive && on ? `<button class="chip stop" data-act="stop">■ Stop</button>` : ""}
        <button class="power ${on ? "on" : ""}" data-act="power" title="On / off">⏻</button>
      </header>
      ${this._topic ? "" : `<p class="warn">Couldn't work out the Zigbee2MQTT topic. Set <code>z2m_topic</code> in the card config.</p>`}
      ${strip}
      <label class="bri"><span>☀</span><input type="range" min="1" max="100" value="${on ? bri : 0}" data-act="bri"><b>${on ? bri + "%" : "off"}</b></label>
      <nav>${Object.entries(tabs).map(([t, l]) => `<button class="${this._tab === t ? "act" : ""}" data-tab="${t}">${l}</button>`).join("")}</nav>
      <section>${body}</section></ha-card>`;
    this._wire();
  }

  _paintTab() {
    const naming = this._naming?.kind === "pattern-new";
    return `<div class="swatches">${SWATCHES.map((c) => `<button class="sw ${c === this._color ? "cur" : ""}" data-color="${c}" style="background:${c}" title="${c === "#000000" ? "Off" : c}">${c === "#000000" ? "⊘" : ""}</button>`).join("")}
        <label class="sw custom" title="Any colour"><input type="color" value="${this._color}" data-act="pick"><span style="background:${this._color}"></span></label></div>
      <p class="hint">Tap or drag across the strip to paint. ${this._sel.size ? `${this._sel.size} selected.` : "Long-press a segment to select it."}</p>
      <div class="row">
        <button class="chip ${this._mirror ? "on" : ""}" data-act="mirror">⇋ Mirror</button>
        <button class="chip" data-act="fill">Fill all</button><button class="chip" data-act="blend">⟷ Blend</button>
        <button class="chip" data-act="selall">Select all</button><button class="chip" data-act="selnone">Clear selection</button>
      </div>
      ${naming ? `<div class="row name"><input placeholder="Pattern name" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">Save</button><button class="chip" data-act="name-cancel">Cancel</button></div>`
        : `<button class="wide pri" data-act="save-pattern">＋ Save as pattern</button>`}`;
  }

  _patternsTab(lib) {
    const ren = this._naming?.kind === "pattern-rename" ? this._naming.id : null;
    const tiles = lib.patterns.map((p) => `
      <div class="tile ${lib.active?.kind === "pattern" && lib.active.id === p.id ? "act" : ""}">
        <button class="hit" data-apply-pattern="${esc(p.id)}">
          <div class="mini strip" style="--n:${p.colors.length}">${p.colors.map((c) => `<i style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 8px ${c}`}"></i>`).join("")}</div>
          ${ren === p.id ? "" : `<span>${esc(p.name)}</span>`}</button>
        ${ren === p.id ? `<div class="row name"><input value="${esc(p.name)}" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">OK</button></div>` : ""}
        <button class="dots" data-menu="${esc(p.id)}">⋯</button>
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
        <button class="dots" data-menu="${esc(fx.id)}">⋯</button>
        ${this._menu === fx.id ? `<div class="menu">
          <button data-fx-act="edit" data-id="${esc(fx.id)}">Edit</button>
          <button data-fx-act="dup" data-id="${esc(fx.id)}">Duplicate</button>
          <button class="danger" data-fx-act="delete" data-id="${esc(fx.id)}">Delete</button></div>` : ""}
      </div>`).join("");
    return `<div class="grid">${tiles}</div><button class="wide pri" data-act="new-effect">＋ New effect</button>`;
  }

  _effectEditor() {
    const fx = this._editing, rainbow = fx.type.startsWith("rainbow");
    return `<div class="editor">${fxStripHtml(fx, "edit", this._n, "main")}
      <input class="namebox" value="${esc(fx.name)}" maxlength="28" placeholder="Effect name" data-ed="name">
      <h4>Style</h4><div class="row">${Object.entries(FX_TYPES).map(([k, v]) => `<button class="chip ${fx.type === k ? "on" : ""}" data-ed-type="${k}">${v}</button>`).join("")}</div>
      ${rainbow ? `<p class="hint">Rainbow styles use the strip's own colours.</p>` : `
      <h4>Colours <small>${fx.colors.length}/8</small></h4>
      <div class="swatches">${fx.colors.map((c, k) => `<span class="sw cur rm" style="background:${c}" data-ed-rm="${k}" title="Remove">×</span>`).join("")}
        ${fx.colors.length < 8 ? `<label class="sw custom" title="Add colour"><input type="color" value="#ff5500" data-ed="add"><span>＋</span></label>` : ""}</div>
      <div class="swatches small">${SWATCHES.slice(0, 13).map((c) => `<button class="sw" style="background:${c}" data-ed-add="${c}"></button>`).join("")}</div>`}
      <h4>Speed <small data-speed>${fx.speed}%</small></h4><input type="range" min="1" max="100" value="${fx.speed}" data-ed="speed">
      <h4>Segments</h4><div class="row">${Object.entries(SEG_SETS).map(([k, v]) => `<button class="chip ${fx.segments === k ? "on" : ""}" data-ed-seg="${k}">${v}</button>`).join("")}</div>
      ${fx.segments === "selected" ? `<p class="hint">Uses the segments selected in Paint (${(fx.selected || []).length}).</p>` : ""}
      <div class="row end"><button class="chip" data-act="ed-cancel">Cancel</button>
        <button class="chip" data-act="ed-try">▶ Try on strip</button><button class="chip pri" data-act="ed-save">Save</button></div></div>`;
  }

  /* ---------- events ---------- */
  _wire() {
    const R = this.shadowRoot, q = (s) => R.querySelectorAll(s);
    const find = (list, id) => list.find((x) => x.id === id);
    q("[data-tab]").forEach((b) => (b.onclick = () => { this._tab = b.dataset.tab; this._menu = null; this._naming = null; this._render(); }));
    q("[data-act]").forEach((el) => {
      if (el.tagName === "INPUT") el.oninput = el.onchange = (e) => this._onInput(el.dataset.act, e);
      else el.onclick = () => this._onAct(el.dataset.act);
    });
    q("[data-color]").forEach((b) => (b.onclick = () => { this._color = b.dataset.color; this._colorPicked(); }));
    q("[data-menu]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this._menu = this._menu === b.dataset.menu ? null : b.dataset.menu; this._render(); }));
    q("[data-apply-pattern]").forEach((b) => (b.onclick = () => { const p = find(this._lib().patterns, b.dataset.applyPattern); if (p) this._applyPattern(p); }));
    q("[data-run-effect]").forEach((b) => (b.onclick = () => { const fx = find(this._lib().effects, b.dataset.runEffect); if (fx) this._runEffect(fx); }));
    q("[data-pattern-act]").forEach((b) => (b.onclick = () => this._patternAct(b.dataset.patternAct, b.dataset.id)));
    q("[data-fx-act]").forEach((b) => (b.onclick = () => this._fxAct(b.dataset.fxAct, b.dataset.id)));
    q("[data-ed]").forEach((el) => (el.oninput = el.onchange = (e) => this._edInput(el.dataset.ed, e)));
    q("[data-ed-type]").forEach((b) => (b.onclick = () => { this._editing.type = b.dataset.edType; this._render(); }));
    q("[data-ed-seg]").forEach((b) => (b.onclick = () => { this._editing.segments = b.dataset.edSeg; this._editing.selected = [...this._sel]; this._render(); }));
    q("[data-ed-rm]").forEach((b) => (b.onclick = () => { this._editing.colors.splice(Number(b.dataset.edRm), 1); this._render(); }));
    q("[data-ed-add]").forEach((b) => (b.onclick = () => { if (this._editing.colors.length < 8) { this._editing.colors.push(b.dataset.edAdd); this._render(); } }));
    this._wireStrip();
    const ni = R.querySelector('[data-act="name-input"]');
    if (ni) { ni.focus(); ni.onkeydown = (e) => { if (e.key === "Enter") this._onAct("name-save"); }; }
  }

  _wireStrip() {
    const strip = this.shadowRoot.querySelector(".main.strip");
    if (!strip?.querySelector("[data-seg]")) return;
    let down = false, pressT = null, last = -1;
    const segAt = (e) => { const el = this.shadowRoot.elementFromPoint(e.clientX, e.clientY); return el?.dataset?.seg !== undefined ? Number(el.dataset.seg) : -1; };
    const end = () => { down = false; this._dragging = false; };
    strip.onpointerdown = (e) => {
      const i = segAt(e); if (i < 0) return;
      down = true; this._dragging = true; last = i; strip.setPointerCapture(e.pointerId);
      pressT = setTimeout(() => { pressT = null; end(); this._sel.has(i) ? this._sel.delete(i) : this._sel.add(i); this._render(); }, 450);
    };
    strip.onpointermove = (e) => {
      if (!down) return; const i = segAt(e);
      if (i >= 0 && i !== last) { if (pressT) { clearTimeout(pressT); pressT = null; this._paintSeg(last); } last = i; this._paintSeg(i); }
    };
    strip.onpointerup = () => {
      if (pressT) {
        clearTimeout(pressT); pressT = null;
        if (this._sel.has(last)) { this._sel.forEach((k) => { this._paint[k] = this._color; }); this._updateStrip(); this._sendPaint(this._paint); }
        else this._paintSeg(last);
      }
      end();
    };
    strip.onpointercancel = () => { if (pressT) { clearTimeout(pressT); pressT = null; } end(); };
  }

  _colorPicked() {
    if (this._sel.size) {
      this._sel.forEach((k) => { this._paint[k] = this._color; if (this._mirror) this._paint[this._n - 1 - k] = this._color; });
      this._sendPaint(this._paint);
    }
    this._render();
  }

  _onInput(act, e) {
    if (act === "pick") { this._color = e.target.value; if (e.type === "change") this._colorPicked(); }
    if (act === "bri" && e.type === "change") this._hass.callService("light", "turn_on", { entity_id: this._cfg.entity, brightness_pct: Number(e.target.value) });
    if (act === "name-input") this._nameDraft = e.target.value;
  }

  async _onAct(act) {
    const n = this._n;
    const actions = {
      power: () => this._hass.callService("light", "toggle", { entity_id: this._cfg.entity }),
      stop: () => this._stop(),
      mirror: () => { this._mirror = !this._mirror; this._render(); },
      fill: () => { this._paint = Array(n).fill(this._color); this._render(); this._sendPaint(this._paint, 0); },
      blend: () => this._blend(),
      selall: () => { this._sel = new Set([...Array(n).keys()]); this._render(); },
      selnone: () => { this._sel.clear(); this._render(); },
      "save-pattern": () => { this._naming = { kind: "pattern-new" }; this._nameDraft = ""; this._render(); },
      "name-cancel": () => { this._naming = null; this._render(); },
      "name-save": () => this._saveName(),
      "new-effect": () => { this._editing = { id: null, name: "My effect", type: "flicker", colors: ["#ff3a00", "#ff9500"], speed: 50, segments: "all" }; this._render(); },
      "ed-cancel": () => { this._editing = null; this._render(); },
      "ed-try": () => this._runEffect(this._editing, false),
      "ed-save": () => this._saveEffect(),
    };
    await actions[act]?.();
  }

  async _saveName() {
    const name = (this._nameDraft || "").trim() || "Untitled";
    const lib = this._lib();
    if (this._naming?.kind === "pattern-new") lib.patterns.push({ id: uid(), name, colors: [...this._paint] });
    if (this._naming?.kind === "pattern-rename") { const p = lib.patterns.find((x) => x.id === this._naming.id); if (p) p.name = name; }
    this._naming = null; this._menu = null;
    if (this._tab === "paint") this._tab = "patterns";
    await this._saveLib(lib);
  }

  async _patternAct(act, id) {
    const lib = this._lib(), p = lib.patterns.find((x) => x.id === id); if (!p) return;
    this._menu = null;
    if (act === "edit") { this._paint = scaleColors(p.colors, this._n); this._tab = "paint"; this._render(); return; }
    if (act === "rename") { this._naming = { kind: "pattern-rename", id }; this._nameDraft = p.name; this._render(); return; }
    if (act === "overwrite") p.colors = [...this._paint];
    if (act === "delete") { if (!confirm(`Delete pattern "${p.name}"?`)) { this._render(); return; } lib.patterns = lib.patterns.filter((x) => x.id !== id); }
    await this._saveLib(lib);
  }

  async _fxAct(act, id) {
    const lib = this._lib(), fx = lib.effects.find((x) => x.id === id); if (!fx) return;
    this._menu = null;
    if (act === "edit") { this._editing = JSON.parse(JSON.stringify(fx)); this._render(); return; }
    if (act === "dup") lib.effects.push({ ...JSON.parse(JSON.stringify(fx)), id: uid(), name: `${fx.name} copy` });
    if (act === "delete") { if (!confirm(`Delete effect "${fx.name}"?`)) { this._render(); return; } lib.effects = lib.effects.filter((x) => x.id !== id); }
    await this._saveLib(lib);
  }

  _edInput(key, e) {
    const fx = this._editing;
    if (key === "name") fx.name = e.target.value;
    if (key === "speed") {
      fx.speed = Number(e.target.value);
      const lbl = this.shadowRoot.querySelector("[data-speed]"); if (lbl) lbl.textContent = `${fx.speed}%`;
      if (e.type === "change") this._render();
    }
    if (key === "add" && e.type === "change" && fx.colors.length < 8) { fx.colors.push(e.target.value); this._render(); }
  }

  async _saveEffect() {
    const fx = this._editing, lib = this._lib();
    fx.name = (fx.name || "").trim() || "My effect";
    if (fx.id) lib.effects = lib.effects.map((x) => (x.id === fx.id ? fx : x));
    else { fx.id = uid(); lib.effects.push(fx); }
    this._editing = null;
    await this._saveLib(lib);
  }
}
