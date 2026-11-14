import { GlowStudioCard } from "./card.js";
import { GlowStudioCardEditor } from "./editor.js";

const VERSION = "1.1.0";

if (!customElements.get("glow-studio-card")) customElements.define("glow-studio-card", GlowStudioCard);
if (!customElements.get("glow-studio-card-editor")) customElements.define("glow-studio-card-editor", GlowStudioCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "glow-studio-card",
  name: "Glow Studio",
  description: "Paint segments, save patterns and run hardware effects on an Aqara T1 LED strip (Zigbee2MQTT).",
  preview: false,
  documentationURL: "https://github.com/danish-din/glow-studio-card",
});
console.info(`%c GLOW-STUDIO %c ${VERSION} `, "background:#ff6a1a;color:#fff;font-weight:700", "background:#2a1d45;color:#fff");
