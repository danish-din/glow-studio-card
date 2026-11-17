// <glow-studio-card> — paint segments, save patterns and run effects on addressable LED strips.
// Hardware specifics live in ./drivers (Aqara T1/T1M, Hue gradient, WLED, segment lights).
import { esc, mix, isDark, uid, slugify, scaleColors } from "./helpers.js";
import { defaultLibrary } from "./defaults.js";
import { fxStripHtml } from "./preview.js";
import { STYLES } from "./styles.js";
import { sanitizeLibrary, hex } from "./sanitize.js";
import { pickDriver, styleInfo, allStyles } from "./drivers/index.js";
import { DRIFT_SCRIPT, DRIFT_DEFAULTS, isDrift, driftVariables, applySlider, speedLabel } from "./drift.js";
import { paintTab, patternsTab, effectsTab, speedBar } from "./views.js";

const Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class GlowStudioCard extends Base {
  static getConfigElement() { return document.createElement("glow-studio-card-editor"); }
  static getStubConfig(hass) {
    const light = Object.keys(hass?.states || {}).find((e) => e.startsWith("light.") && /strip|led|wled|gradient/i.test(e));
    return { entity: light || "" };
  }

  setConfig(config) {
    const entity = config.entity || config.light;
    if (!entity) throw new Error("Pick the strip's light entity (entity: light.xxx)");
    const slug = slugify(entity);
    this._cfg = {
      title: "Glow Studio", z2m_base: "zigbee2mqtt", drift_script: DRIFT_SCRIPT,
      library_topic: `glow_studio/${slug}/library`, library_entity: `sensor.glow_studio_${slug}`,
      ...config, entity,
    };
    this._s = { tab: "paint", sel: new Set(), color: "#ff5500", mirror: false, editing: null, menu: null, naming: null };
    this._libSig = ""; this._paint = null; this._dragging = false; this._error = null; this._driver = undefined;
  }

  /* ---------- context handed to drivers ---------- */
  get _ctx() {
    return {
      hass: this._hass, cfg: this._cfg, entity: this._cfg.entity,
      isOn: () => this._hass.states[this._cfg.entity]?.state === "on",
      mqtt: (topic, obj) => this._hass.callService("mqtt", "publish", { topic, payload: JSON.stringify(obj) }),
      call: (domain, service, data) => this._hass.callService(domain, service, data),
    };
  }
  get _n() { return this._driver ? this._driver.segments(this._ctx) : Number(this._cfg.segments) || 10; }
  get _light() { return this._hass?.states[this._cfg.entity]; }

  set hass(hass) {
    this._hass = hass;
    if (this._driver === undefined || (!this._driver && !this._cfg.driver)) this._driver = pickDriver(hass, this._cfg);
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
    // Untrusted: anyone who can publish to the retained topic controls these values.
    return sanitizeLibrary(this._hass?.states[this._cfg.library_entity]?.attributes);
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
    const lib = defaultLibrary(this._n, this._driver.defaultEffects(this._ctx));
    DRIFT_DEFAULTS.forEach(([name, type, colors, minutes], i) =>
      lib.effects.push({ id: `d${i}`, name, type, colors, minutes, speed: 50, segments: "all" }));
    await this._hass.callService("mqtt", "publish", { topic: this._cfg.library_topic, payload: JSON.stringify(lib), retain: true });
  }

  /* ---------- talking to the strip (via the driver) ---------- */
  async _guard(fn) {
    try { this._error = null; await fn(); } catch (e) { this._error = e?.message || String(e); this._render(); }
  }
  _sendPaint(colors, delay = 220) {
    clearTimeout(this._sendT);
    this._sendT = setTimeout(() => this._guard(async () => {
      await this._stopDrift();
      await this._driver.paint(this._ctx, colors);
      const lib = this._lib(); if (!lib) return;
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
    lib.active = { kind: "pattern", id: p.id, name: p.name }; lib.current = [...this._paint];
    await this._saveLib(lib);
    this._sendPaint(this._paint, 0);
    this._render();
  }
  /** Slow effects run in Home Assistant (drift script); hardware effects on the strip itself. */
  _runEffect(fx, remember = true) {
    return this._guard(async () => {
      if (isDrift(fx.type)) {
        if (!this._hass.states[this._cfg.drift_script]) throw new Error("Slow effects need the Glow Studio drift script. Import it from the README (one click).");
        await this._stopScripts();
        await this._hass.callService("script", "turn_on", { entity_id: this._cfg.drift_script, variables: driftVariables(this._driver, this._ctx, fx, this._n) });
      } else {
        await this._stopDrift();
        await this._driver.run(this._ctx, fx);
      }
      if (remember) { const lib = this._lib(); lib.active = { kind: "effect", id: fx.id, name: fx.name }; await this._saveLib(lib); }
    });
  }
  /** Stop other things driving this strip (e.g. a sunrise/sunset script) so the newest choice wins. */
  async _stopScripts() {
    const running = [].concat(this._cfg.stop_scripts || []).filter((e) => this._hass.states[e]?.state === "on");
    if (running.length) await this._hass.callService("script", "turn_off", { entity_id: running });
  }
  async _stopDrift() {
    await this._stopScripts();
    if (this._hass.states[this._cfg.drift_script]?.state === "on") {
      await this._hass.callService("script", "turn_off", { entity_id: this._cfg.drift_script });
    }
  }
  /** Speed slider moved for the running effect: strip speed above 30%, slow (Home Assistant) mode below. */
  async _changeSpeed(v) {
    const lib = this._lib();
    const i = lib.effects.findIndex((e) => e.id === lib.active?.id); if (i < 0) return;
    const before = lib.effects[i], after = applySlider(before, v);
    lib.effects[i] = after;
    await this._guard(async () => {
      if (isDrift(after.type) || isDrift(before.type) !== isDrift(after.type)) await this._runEffect(after, false);
      else await this._driver.setSpeed(this._ctx, after);
      if (!this._error) await this._saveLib(lib);
    });
  }
  async _stop() {
    this._sendPaint(this._paint, 0);
    const lib = this._lib(); lib.active = { kind: "pattern", id: null, name: "Custom" }; await this._saveLib(lib);
  }

  /* ---------- painting ---------- */
  _paintSeg(i) {
    (this._s.mirror ? [i, this._n - 1 - i] : [i]).forEach((k) => { this._paint[k] = this._s.color; });
    this._updateStrip(); this._sendPaint(this._paint);
  }
  _blend() {
    const s = [...this._s.sel].sort((a, b) => a - b);
    const [a, b] = s.length >= 2 ? [s[0], s[s.length - 1]] : [0, this._n - 1];
    for (let i = a; i <= b; i++) this._paint[i] = mix(this._paint[a], this._paint[b], (i - a) / Math.max(1, b - a));
    this._updateStrip(); this._sendPaint(this._paint, 0);
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
    const msg = (html) => { this.shadowRoot.innerHTML = `${head}<ha-card><div class="setup">${html}</div></ha-card>`; };
    if (!this._light) return msg(`<p class="warn">Entity ${esc(this._cfg.entity)} not found.</p>`);
    if (!this._driver) return msg(`<h3>${esc(this._cfg.title)}</h3><p>This light isn't recognised as an addressable strip.
      Pick a driver in the card editor, or list <code>segment_entities</code> if each segment is its own light.</p>`);
    const lib = this._lib();
    if (!lib) {
      msg(`<h3>${esc(this._cfg.title)}</h3><p>First run: create the shared library of patterns and effects for this ${esc(this._driver.label)} (${this._n} segments).</p>
        <button class="wide pri" data-act="setup">✨ Set up Glow Studio</button>`);
      this.shadowRoot.querySelector("[data-act=setup]").onclick = () => this._setup();
      return;
    }
    const on = this._light.state === "on", s = this._s, ctx = this._ctx;
    const bri = Math.round((this._light.attributes?.brightness || 0) / 2.55);
    const fxActive = lib.active?.kind === "effect" ? lib.effects.find((e) => e.id === lib.active.id) : null;
    const editing = s.tab === "effects" && s.editing;
    const strip = editing ? "" : fxActive && on && s.tab !== "paint" ? fxStripHtml(fxActive, "main", this._n, "main")
      : `<div class="main strip" style="--n:${this._n}">${this._paint.map((c, i) =>
          `<i data-seg="${i}" class="${s.sel.has(i) ? "sel" : ""}" style="background:${hex(c)};box-shadow:${isDark(c) ? "none" : `0 0 18px ${hex(c)}aa`}"></i>`).join("")}</div>`;
    const tabs = { paint: "🎨 Paint", patterns: "▦ Patterns", effects: "✨ Effects" };
    const body = s.tab === "paint" ? paintTab(s) : s.tab === "patterns" ? patternsTab(s, lib) : effectsTab(s, lib, this._driver, ctx, this._n);
    const problem = this._error || this._driver.problem(ctx);
    this.shadowRoot.innerHTML = `${head}<ha-card>
      <header>
        <div class="title"><span>${esc(this._cfg.title)}</span><small>${esc(on ? (lib.active?.name || "Custom") : "Off")}${fxActive && on ? " · effect" : ""}</small></div>
        ${fxActive && on ? `<button class="chip stop" data-act="stop">■ Stop</button>` : ""}
        <button class="power ${on ? "on" : ""}" data-act="power" title="On / off" aria-label="On / off"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.56 5.44l-1.45 1.45A5.97 5.97 0 0 1 18 12a6 6 0 0 1-12 0c0-2.17 1.16-4.06 2.88-5.12L7.44 5.44A7.96 7.96 0 0 0 4 12a8 8 0 0 0 16 0c0-2.72-1.36-5.12-3.44-6.56M13 3h-2v10h2"/></svg></button>
      </header>
      ${problem ? `<p class="warn">${esc(problem)}</p>` : ""}
      ${strip}
      ${fxActive && on && !editing ? speedBar(fxActive, styleInfo(this._driver, ctx, fxActive.hwType || fxActive.type)) : ""}
      <label class="bri"><span>☀</span><input type="range" min="1" max="100" value="${on ? bri : 0}" data-act="bri"><b>${on ? bri + "%" : "off"}</b></label>
      <nav>${Object.entries(tabs).map(([t, l]) => `<button class="${s.tab === t ? "act" : ""}" data-tab="${t}">${l}</button>`).join("")}</nav>
      <section>${body}</section></ha-card>`;
    this._wire();
  }

  /* ---------- events ---------- */
  _wire() {
    const R = this.shadowRoot, q = (sel) => R.querySelectorAll(sel), s = this._s;
    const find = (list, id) => list.find((x) => x.id === id);
    q("[data-tab]").forEach((b) => (b.onclick = () => { s.tab = b.dataset.tab; s.menu = null; s.naming = null; this._render(); }));
    q("[data-act]").forEach((el) => {
      if (el.tagName === "INPUT") el.oninput = el.onchange = (e) => this._onInput(el.dataset.act, e);
      else el.onclick = () => this._onAct(el.dataset.act);
    });
    q("[data-color]").forEach((b) => (b.onclick = () => { s.color = b.dataset.color; this._colorPicked(); }));
    q("[data-menu]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); s.menu = s.menu === b.dataset.menu ? null : b.dataset.menu; this._render(); }));
    q("[data-apply-pattern]").forEach((b) => (b.onclick = () => { const p = find(this._lib().patterns, b.dataset.applyPattern); if (p) this._applyPattern(p); }));
    q("[data-run-effect]").forEach((b) => (b.onclick = () => { const fx = find(this._lib().effects, b.dataset.runEffect); if (fx) this._runEffect(fx); }));
    q("[data-pattern-act]").forEach((b) => (b.onclick = () => this._patternAct(b.dataset.patternAct, b.dataset.id)));
    q("[data-fx-act]").forEach((b) => (b.onclick = () => this._fxAct(b.dataset.fxAct, b.dataset.id)));
    q("[data-ed]").forEach((el) => (el.oninput = el.onchange = (e) => this._edInput(el.dataset.ed, e)));
    q("[data-ed-type]").forEach((b) => (b.onclick = () => this._setStyle(b.dataset.edType)));
    q("[data-ed-type-select]").forEach((el) => (el.onchange = () => this._setStyle(el.value)));
    q("[data-ed-seg]").forEach((b) => (b.onclick = () => { s.editing.segments = b.dataset.edSeg; s.editing.selected = [...s.sel]; this._render(); }));
    q("[data-ed-rm]").forEach((b) => (b.onclick = () => { s.editing.colors.splice(Number(b.dataset.edRm), 1); this._render(); }));
    q("[data-ed-add]").forEach((b) => (b.onclick = () => this._addColour(b.dataset.edAdd)));
    q("[data-fx-speed]").forEach((el) => {
      const fx = () => { const lib = this._lib(); return lib.effects.find((e) => e.id === lib.active?.id); };
      el.oninput = () => { const l = R.querySelector("[data-fx-speed-label]"); const f = fx(); if (l && f) l.textContent = speedLabel(applySlider(f, el.value)); };
      el.onchange = () => this._changeSpeed(Number(el.value));
    });
    this._wireStrip();
    const ni = R.querySelector('[data-act="name-input"]');
    if (ni) { ni.focus(); ni.onkeydown = (e) => { if (e.key === "Enter") this._onAct("name-save"); }; }
  }

  _wireStrip() {
    const strip = this.shadowRoot.querySelector(".main.strip");
    if (!strip?.querySelector("[data-seg]")) return;
    let down = false, pressT = null, last = -1;
    const sel = this._s.sel;
    const segAt = (e) => { const el = this.shadowRoot.elementFromPoint(e.clientX, e.clientY); return el?.dataset?.seg !== undefined ? Number(el.dataset.seg) : -1; };
    const end = () => { down = false; this._dragging = false; };
    strip.onpointerdown = (e) => {
      const i = segAt(e); if (i < 0) return;
      down = true; this._dragging = true; last = i; strip.setPointerCapture(e.pointerId);
      pressT = setTimeout(() => { pressT = null; end(); sel.has(i) ? sel.delete(i) : sel.add(i); this._render(); }, 450);
    };
    strip.onpointermove = (e) => {
      if (!down) return; const i = segAt(e);
      if (i >= 0 && i !== last) { if (pressT) { clearTimeout(pressT); pressT = null; this._paintSeg(last); } last = i; this._paintSeg(i); }
    };
    strip.onpointerup = () => {
      if (pressT) {
        clearTimeout(pressT); pressT = null;
        if (sel.has(last)) { sel.forEach((k) => { this._paint[k] = this._s.color; }); this._updateStrip(); this._sendPaint(this._paint); }
        else this._paintSeg(last);
      }
      end();
    };
    strip.onpointercancel = () => { if (pressT) { clearTimeout(pressT); pressT = null; } end(); };
  }

  _colorPicked() {
    const s = this._s;
    if (s.sel.size) {
      s.sel.forEach((k) => { this._paint[k] = s.color; if (s.mirror) this._paint[this._n - 1 - k] = s.color; });
      this._sendPaint(this._paint);
    }
    this._render();
  }

  _onInput(act, e) {
    if (act === "pick") { this._s.color = e.target.value; if (e.type === "change") this._colorPicked(); }
    if (act === "bri" && e.type === "change") this._hass.callService("light", "turn_on", { entity_id: this._cfg.entity, brightness_pct: Number(e.target.value) });
    if (act === "name-input") this._nameDraft = e.target.value;
  }

  async _onAct(act) {
    const n = this._n, s = this._s;
    const first = () => allStyles(this._driver, this._ctx)[0];
    const actions = {
      power: () => this._hass.callService("light", "toggle", { entity_id: this._cfg.entity }),
      stop: () => this._stop(),
      mirror: () => { s.mirror = !s.mirror; this._render(); },
      fill: () => { this._paint = Array(n).fill(s.color); this._render(); this._sendPaint(this._paint, 0); },
      blend: () => this._blend(),
      selall: () => { s.sel = new Set([...Array(n).keys()]); this._render(); },
      selnone: () => { s.sel.clear(); this._render(); },
      "save-pattern": () => { s.naming = { kind: "pattern-new" }; this._nameDraft = ""; this._render(); },
      "name-cancel": () => { s.naming = null; this._render(); },
      "name-save": () => this._saveName(),
      "new-effect": () => {
        const type = first()?.id; if (!type) return;
        const max = styleInfo(this._driver, this._ctx, type).colors;
        s.editing = { id: null, name: "My effect", type, colors: ["#ff3a00", "#ff9500"].slice(0, max), speed: 50, minutes: 30, segments: "all" };
        this._render();
      },
      "ed-cancel": () => { s.editing = null; this._render(); },
      "ed-try": () => this._runEffect(s.editing, false),
      "ed-save": () => this._saveEffect(),
    };
    await actions[act]?.();
  }

  _setStyle(type) {
    const fx = this._s.editing; fx.type = type;
    delete fx.hwType; delete fx.hwColors;
    if (isDrift(type)) fx.minutes = fx.minutes || 30;
    else { delete fx.minutes; fx.speed = fx.speed || 50; }
    const max = styleInfo(this._driver, this._ctx, type).colors;
    if (fx.colors.length > max) fx.colors = fx.colors.slice(0, max);
    this._render();
  }
  _addColour(c) {
    const fx = this._s.editing;
    if (fx.colors.length < styleInfo(this._driver, this._ctx, fx.type).colors) { fx.colors.push(c); this._render(); }
  }

  async _saveName() {
    const s = this._s, name = (this._nameDraft || "").trim() || "Untitled";
    const lib = this._lib();
    if (s.naming?.kind === "pattern-new") lib.patterns.push({ id: uid(), name, colors: [...this._paint] });
    if (s.naming?.kind === "pattern-rename") { const p = lib.patterns.find((x) => x.id === s.naming.id); if (p) p.name = name; }
    s.naming = null; s.menu = null;
    if (s.tab === "paint") s.tab = "patterns";
    await this._saveLib(lib);
  }

  async _patternAct(act, id) {
    const s = this._s, lib = this._lib(), p = lib.patterns.find((x) => x.id === id); if (!p) return;
    s.menu = null;
    if (act === "edit") { this._paint = scaleColors(p.colors, this._n); s.tab = "paint"; this._render(); return; }
    if (act === "rename") { s.naming = { kind: "pattern-rename", id }; this._nameDraft = p.name; this._render(); return; }
    if (act === "overwrite") p.colors = [...this._paint];
    if (act === "delete") { if (!confirm(`Delete pattern "${p.name}"?`)) { this._render(); return; } lib.patterns = lib.patterns.filter((x) => x.id !== id); }
    await this._saveLib(lib);
  }

  async _fxAct(act, id) {
    const s = this._s, lib = this._lib(), fx = lib.effects.find((x) => x.id === id); if (!fx) return;
    s.menu = null;
    if (act === "edit") { s.editing = JSON.parse(JSON.stringify(fx)); this._render(); return; }
    if (act === "dup") lib.effects.push({ ...JSON.parse(JSON.stringify(fx)), id: uid(), name: `${fx.name} copy` });
    if (act === "delete") { if (!confirm(`Delete effect "${fx.name}"?`)) { this._render(); return; } lib.effects = lib.effects.filter((x) => x.id !== id); }
    await this._saveLib(lib);
  }

  _edInput(key, e) {
    const fx = this._s.editing;
    if (key === "name") fx.name = e.target.value;
    if (key === "speed") {
      const next = applySlider(fx, e.target.value);
      const lbl = this.shadowRoot.querySelector("[data-speed]"); if (lbl) lbl.textContent = speedLabel(next);
      if (e.type === "change") { this._s.editing = next; this._render(); }
    }
    if (key === "add" && e.type === "change") this._addColour(e.target.value);
  }

  async _saveEffect() {
    const s = this._s, fx = s.editing, lib = this._lib();
    fx.name = (fx.name || "").trim() || "My effect";
    if (fx.id) lib.effects = lib.effects.map((x) => (x.id === fx.id ? fx : x));
    else { fx.id = uid(); lib.effects.push(fx); }
    s.editing = null;
    await this._saveLib(lib);
    // Editing the effect that's running? Show the change on the strip straight away.
    if (lib.active?.kind === "effect" && lib.active.id === fx.id && this._light?.state === "on") await this._runEffect(fx, false);
  }
}
