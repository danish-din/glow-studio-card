// CSS approximation of hardware effects, for tile previews and the live strip. Works from any brand's effect name.
import { RAINBOW } from "./defaults.js";

/** Map a driver effect id/name onto one of a handful of preview animations. */
export function previewKind(type = "", name = "") {
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

/** Colours to animate when an effect carries none (hardware/brand palettes). */
export function fallbackPalette(kind, s) {
  if (kind.startsWith("rainbow") || /loop|disco|firework/.test(s)) return RAINBOW;
  if (/fire|candle|ember|flame|sun/.test(s)) return ["#ff3a00", "#ff9500", "#b31b00", "#ffb347"];
  if (/ocean|under|water|lake|pacifica|wave/.test(s)) return ["#0040ff", "#00b4ff", "#00ffd5"];
  if (/cosmos|star|night|enchant|aurora/.test(s)) return ["#1a1aff", "#7a00ff", "#00d4ff", "#ffffff"];
  if (/sparkle|glisten|opal/.test(s)) return ["#ffffff", "#ffd8a8", "#8ad8ff"];
  return ["#ff5500", "#ffa600", "#ff2d8a"];
}

export function fxCss(fx, scope) {
  const kind = previewKind(fx.type, fx.name);
  const s = `${fx.type} ${fx.name}`.toLowerCase();
  const cols = fx.colors?.length ? fx.colors : fallbackPalette(kind, s);
  // Slow (drift) effects take minutes on the strip; the preview just shows them noticeably slower.
  const dur = String(fx.type).startsWith("drift") ? 4 : 0.5 + ((100 - (Number(fx.speed) || 50)) / 100) * 5;
  const d = (x) => x.toFixed(2);
  const name = `fx_${String(scope).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stops = cols.map((c, k) => `${Math.round((k / cols.length) * 100)}%{background:${c};box-shadow:0 0 14px ${c}}`).join("")
    + `100%{background:${cols[0]};box-shadow:0 0 14px ${cols[0]}}`;
  let anim = `${name} ${d(dur * cols.length)}s linear infinite`;
  let delay = (i) => `${-i * 0.35}s`;
  let extra = "";
  switch (kind) {
    case "flicker":
      extra = `@keyframes ${name}_f{0%,100%{opacity:1}20%{opacity:.55}35%{opacity:.95}55%{opacity:.7}70%{opacity:1}85%{opacity:.6}}`;
      anim = `${name} ${d(dur * 1.6)}s steps(${cols.length}) infinite, ${name}_f ${d(dur / 2.5)}s ease-in-out infinite`;
      delay = (i) => `${-((i * 7919) % 13) / 5}s`; break;
    case "breathing":
      extra = `@keyframes ${name}_f{0%,100%{opacity:.25}50%{opacity:1}}`;
      anim = `${name} ${d(dur * cols.length * 2)}s linear infinite, ${name}_f ${d(dur * 1.2)}s ease-in-out infinite`;
      delay = () => "0s"; break;
    case "hopping":
      anim = `${name} ${d(dur * cols.length)}s steps(${cols.length}) infinite`; delay = () => "0s"; break;
    case "flash":
      extra = `@keyframes ${name}_f{0%,49%{opacity:1}50%,100%{opacity:.08}}`;
      anim = `${name} ${d(dur * cols.length)}s steps(${cols.length}) infinite, ${name}_f ${d(dur / 2)}s infinite`;
      delay = () => "0s"; break;
    case "dash":
      extra = `@keyframes ${name}_f{0%,60%{opacity:.1}70%,90%{opacity:1}100%{opacity:.1}}`;
      anim = `${name} ${d(dur * cols.length)}s linear infinite, ${name}_f ${d(dur)}s linear infinite`;
      delay = (i) => `${-(i * dur) / 10}s`; break;
    case "rainbow1":
      anim = `${name} ${d(dur * 2)}s linear infinite`; delay = () => "0s"; break;
    default: break; // chasing, rainbow2: colour travels along the strip
  }
  return { css: `@keyframes ${name}{${stops}}${extra}`, anim, delay, cols, kind };
}

/** Animated strip markup; the inline background is the still frame when motion is reduced. */
export function fxStripHtml(fx, scope, n, cls = "mini") {
  const { css, anim, delay, cols } = fxCss(fx, scope);
  const segs = Array.from({ length: n }, (_, i) => {
    const c = cols[Math.floor((i * cols.length) / n)];
    return `<i style="background:${c};animation:${anim};animation-delay:${delay(i)}"></i>`;
  }).join("");
  return `<style>${css}</style><div class="${cls} strip" style="--n:${n}">${segs}</div>`;
}
