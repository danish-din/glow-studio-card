// Visual editor (uses Home Assistant's built-in <ha-form>).
const Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {};

const SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "light" } } },
  { name: "title", selector: { text: {} } },
  { name: "z2m_topic", selector: { text: {} } },
  { name: "segments", selector: { number: { min: 1, max: 50, mode: "box" } } },
];
const LABELS = {
  entity: "Strip light",
  title: "Title (optional)",
  z2m_topic: "Zigbee2MQTT set topic (optional, auto-detected)",
  segments: "Segments (optional, auto-detected: 5 per metre)",
};

export class GlowStudioCardEditor extends Base {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (e) => {
        const config = { ...e.detail.value };
        Object.keys(config).forEach((k) => (config[k] === "" || config[k] === undefined) && delete config[k]);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = SCHEMA;
    this._form.data = { ...this._config, entity: this._config.entity || this._config.light };
  }
}
