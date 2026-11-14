// HTML builders for the card's tabs. Pure functions of (card state, library, driver) → markup.
import { esc, isDark } from "./helpers.js";
import { SWATCHES, SEG_SETS } from "./defaults.js";
import { fxStripHtml } from "./preview.js";
import { styleInfo, allStyles } from "./drivers/index.js";
import { driftMinutes } from "./drift.js";

const MENU_PATTERN = [["edit", "Load to paint"], ["overwrite", "Update with current"], ["rename", "Rename"], ["delete", "Delete"]];
const MENU_FX = [["edit", "Edit"], ["dup", "Duplicate"], ["delete", "Delete"]];

const menu = (attr, id, items) => `<div class="menu">${items.map(([a, l]) =>
  `<button class="${a === "delete" ? "danger" : ""}" ${attr}="${a}" data-id="${esc(id)}">${l}</button>`).join("")}</div>`;

export function paintTab(s) {
  const naming = s.naming?.kind === "pattern-new";
  return `<div class="swatches">${SWATCHES.map((c) => `<button class="sw ${c === s.color ? "cur" : ""}" data-color="${c}" style="background:${c}" title="${c === "#000000" ? "Off" : c}">${c === "#000000" ? "⊘" : ""}</button>`).join("")}
      <label class="sw custom" title="Any colour"><input type="color" value="${s.color}" data-act="pick"><span style="background:${s.color}"></span></label></div>
    <p class="hint">Tap or drag across the strip to paint. ${s.sel.size ? `${s.sel.size} selected.` : "Long-press a segment to select it."}</p>
    <div class="row">
      <button class="chip ${s.mirror ? "on" : ""}" data-act="mirror">⇋ Mirror</button>
      <button class="chip" data-act="fill">Fill all</button><button class="chip" data-act="blend">⟷ Blend</button>
      <button class="chip" data-act="selall">Select all</button><button class="chip" data-act="selnone">Clear selection</button>
    </div>
    ${naming ? `<div class="row name"><input placeholder="Pattern name" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">Save</button><button class="chip" data-act="name-cancel">Cancel</button></div>`
      : `<button class="wide pri" data-act="save-pattern">＋ Save as pattern</button>`}`;
}

export function patternsTab(s, lib) {
  const ren = s.naming?.kind === "pattern-rename" ? s.naming.id : null;
  const tiles = lib.patterns.map((p) => `
    <div class="tile ${lib.active?.kind === "pattern" && lib.active.id === p.id ? "act" : ""}">
      <button class="hit" data-apply-pattern="${esc(p.id)}">
        <div class="mini strip" style="--n:${p.colors.length}">${p.colors.map((c) => `<i style="background:${c};box-shadow:${isDark(c) ? "none" : `0 0 8px ${c}`}"></i>`).join("")}</div>
        ${ren === p.id ? "" : `<span>${esc(p.name)}</span>`}</button>
      ${ren === p.id ? `<div class="row name"><input value="${esc(p.name)}" maxlength="28" data-act="name-input"><button class="chip pri" data-act="name-save">OK</button></div>` : ""}
      <button class="dots" data-menu="${esc(p.id)}">⋯</button>
      ${s.menu === p.id ? menu("data-pattern-act", p.id, MENU_PATTERN) : ""}
    </div>`).join("");
  return `<div class="grid">${tiles || `<p class="hint">No patterns yet. Paint something and save it.</p>`}</div>`;
}

export function effectsTab(s, lib, driver, ctx, n) {
  if (s.editing) return effectEditor(s, driver, ctx, n);
  const tiles = lib.effects.map((fx) => `
    <div class="tile ${lib.active?.kind === "effect" && lib.active.id === fx.id ? "act" : ""}">
      <button class="hit" data-run-effect="${esc(fx.id)}">${fxStripHtml(fx, "t" + fx.id, n)}<span>${esc(fx.name)}</span><em>${esc(styleInfo(driver, ctx, fx.type).label)}</em></button>
      <button class="dots" data-menu="${esc(fx.id)}">⋯</button>
      ${s.menu === fx.id ? menu("data-fx-act", fx.id, MENU_FX) : ""}
    </div>`).join("");
  return `<div class="grid">${tiles}</div><button class="wide pri" data-act="new-effect">＋ New effect</button>`;
}

function styleChooser(styles, current) {
  if (styles.length > 12) {
    return `<select class="namebox" data-ed-type-select>${styles.map((st) =>
      `<option value="${esc(st.id)}" ${st.id === current ? "selected" : ""}>${esc(st.label)}</option>`).join("")}</select>`;
  }
  return `<div class="row">${styles.map((st) => `<button class="chip ${st.id === current ? "on" : ""}" data-ed-type="${esc(st.id)}">${esc(st.label)}</button>`).join("")}</div>`;
}

export function effectEditor(s, driver, ctx, n) {
  const fx = s.editing;
  const info = styleInfo(driver, ctx, fx.type);
  const colours = info.colors > 0 ? `
    <h4>Colours <small>${fx.colors.length}/${info.colors}</small></h4>
    <div class="swatches">${fx.colors.map((c, k) => `<span class="sw cur rm" style="background:${c}" data-ed-rm="${k}" title="Remove">×</span>`).join("")}
      ${fx.colors.length < info.colors ? `<label class="sw custom" title="Add colour"><input type="color" value="#ff5500" data-ed="add"><span>＋</span></label>` : ""}</div>
    <div class="swatches small">${SWATCHES.slice(0, 13).map((c) => `<button class="sw" style="background:${c}" data-ed-add="${c}"></button>`).join("")}</div>`
    : `<p class="hint">This style uses the light's own colours.</p>`;
  return `<div class="editor">${fxStripHtml(fx, "edit", n, "main")}
    <input class="namebox" value="${esc(fx.name)}" maxlength="28" placeholder="Effect name" data-ed="name">
    <h4>Style</h4>${styleChooser(allStyles(driver, ctx), fx.type)}
    ${colours}
    ${info.minutes ? `<h4>One full cycle takes</h4><div class="row">${[5, 15, 30, 60, 120].map((m) =>
        `<button class="chip ${driftMinutes(fx) === m ? "on" : ""}" data-ed-min="${m}">${m < 60 ? `${m} min` : `${m / 60} h`}</button>`).join("")}</div>
      <p class="hint">Runs in Home Assistant, so it can change as slowly as you like.</p>` : ""}
    ${info.speed ? `<h4>Speed <small data-speed>${fx.speed}%</small></h4><input type="range" min="1" max="100" value="${fx.speed}" data-ed="speed">
      ${slowChips("data-ed-slow")}` : ""}
    ${info.segments ? `<h4>Segments</h4><div class="row">${Object.entries(SEG_SETS).map(([k, v]) => `<button class="chip ${fx.segments === k ? "on" : ""}" data-ed-seg="${k}">${v}</button>`).join("")}</div>
      ${fx.segments === "selected" ? `<p class="hint">Uses the segments selected in Paint (${(fx.selected || []).length}).</p>` : ""}` : ""}
    <div class="row end"><button class="chip" data-act="ed-cancel">Cancel</button>
      <button class="chip" data-act="ed-try">▶ Try it</button><button class="chip pri" data-act="ed-save">Save</button></div></div>`;
}

/** Quick speed control shown under the strip while an effect runs. */
export function speedBar(fx, info, minuteChoices) {
  if (info.minutes) {
    return `<div class="row speedbar"><span class="hint">Cycle</span>${minuteChoices.map((m) =>
      `<button class="chip ${driftMinutes(fx) === m ? "on" : ""}" data-fx-min="${m}">${m < 60 ? `${m} min` : `${m / 60} h`}</button>`).join("")}</div>`;
  }
  if (!info.speed) return "";
  return `<label class="bri speedbar"><span title="Effect speed">⏱</span><input type="range" min="1" max="100" value="${Number(fx.speed) || 50}" data-fx-speed><b data-fx-speed-label>${Number(fx.speed) || 50}%</b></label>
    ${slowChips("data-fx-slow", minuteChoices)}`;
}

/** "Slower than the strip can go": turns a hardware effect into its slow (Home Assistant driven) version. */
function slowChips(attr, choices = [5, 15, 30, 60, 120]) {
  return `<div class="row slower"><span class="hint">Slower:</span>${choices.map((m) =>
    `<button class="chip" ${attr}="${m}" title="Change over ${m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}">${m < 60 ? `${m} min` : `${m / 60} h`}</button>`).join("")}</div>`;
}
