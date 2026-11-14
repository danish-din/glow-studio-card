// Card styles (shadow DOM)
export const STYLES = `
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
.speedbar{margin:10px 2px 0}.row.speedbar{align-items:center;gap:6px}.row.speedbar .hint{margin:0 4px 0 0}
`;
