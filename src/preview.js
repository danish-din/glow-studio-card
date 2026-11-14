// CSS approximation of the T1 hardware effects, for tile previews and the live strip.
import { RAINBOW } from "./defaults.js";

export function fxCss(fx, scope) {
  const cols = String(fx.type).startsWith("rainbow") ? RAINBOW : (fx.colors?.length ? fx.colors : ["#ff5500"]);
  const dur = 0.5 + ((100 - (Number(fx.speed) || 50)) / 100) * 5;
  const d = (x) => x.toFixed(2);
  const name = `fx_${String(scope).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stops = cols.map((c, k) => `${Math.round((k / cols.length) * 100)}%{background:${c};box-shadow:0 0 14px ${c}}`).join("")
    + `100%{background:${cols[0]};box-shadow:0 0 14px ${cols[0]}}`;
  let anim = `${name} ${d(dur * cols.length)}s linear infinite`;
  let delay = (i) => `${-i * 0.35}s`;
  let extra = "";
  switch (fx.type) {
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
  return { css: `@keyframes ${name}{${stops}}${extra}`, anim, delay, cols };
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
