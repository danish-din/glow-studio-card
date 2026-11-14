import { StripStudioCard } from "./card.js";
import { StripStudioCardEditor } from "./editor.js";

const VERSION = "1.0.0";

if (!customElements.get("strip-studio-card")) customElements.define("strip-studio-card", StripStudioCard);
if (!customElements.get("strip-studio-card-editor")) customElements.define("strip-studio-card-editor", StripStudioCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "strip-studio-card",
  name: "Strip Studio",
  description: "Paint segments, save patterns and run hardware effects on an Aqara T1 LED strip (Zigbee2MQTT).",
  preview: false,
  documentationURL: "https://github.com/danish-din/strip-studio-card",
});
console.info(`%c STRIP-STUDIO %c ${VERSION} `, "background:#ff6a1a;color:#fff;font-weight:700", "background:#2a1d45;color:#fff");
