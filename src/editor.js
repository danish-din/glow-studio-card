// Visual editor (uses Home Assistant's built-in <ha-form>). Shows only the fields the chosen driver needs.
import { DRIVER_OPTIONS, pickDriver } from "./drivers/index.js";

const Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {};

const LABELS = {
  entity: "Light",
  driver: "Strip type",
  title: "Title (optional)",
  z2m_topic: "Zigbee2MQTT set topic (optional, auto-detected)",
  segments: "Segments (optional, auto-detected where possible)",
  wled_topic: "WLED MQTT device topic (e.g. wled/bedroom)",
  leds: "Total LEDs (optional, auto-detected)",
  segment_entities: "Segment lights, in order along the strip",
};

/** Schema for a config; exported for tests. */
export function editorSchema(config, hass) {
  const driver = pickDriver(hass || {}, { ...config, entity: config.entity || config.light });
  const id = config.driver && config.driver !== "auto" ? config.driver : driver?.id;
  const schema = [
    { name: "entity", required: true, selector: { entity: { domain: "light" } } },
    { name: "driver", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: `Auto-detect${driver ? ` (${driver.label})` : ""}` }, ...DRIVER_OPTIONS] } } },
    { name: "title", selector: { text: {} } },
  ];
  if (["aqara_t1", "aqara_t1m", "hue_gradient"].includes(id)) schema.push({ name: "z2m_topic", selector: { text: {} } });
  if (id === "wled") schema.push({ name: "wled_topic", selector: { text: {} } }, { name: "leds", selector: { number: { min: 1, max: 2000, mode: "box" } } });
  if (id === "segment_lights" || !id) schema.push({ name: "segment_entities", selector: { entity: { domain: "light", multiple: true } } });
  if (id !== "segment_lights") schema.push({ name: "segments", selector: { number: { min: 1, max: 100, mode: "box" } } });
  return schema;
}

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
        Object.keys(config).forEach((k) => {
          const v = config[k];
          if (v === "" || v === undefined || (Array.isArray(v) && !v.length) || (k === "driver" && v === "auto")) delete config[k];
        });
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = editorSchema(this._config, this._hass);
    this._form.data = { driver: "auto", ...this._config, entity: this._config.entity || this._config.light };
  }
}
