// app.js - the editor's page: the app bar (menu, file, save, export, import), the rail of the views,
// the toolbar of each view, the keys. The views: the maze (level editor, 3D view, inspector) and
// the code (the maze as the Go source of the game server, or as JSON).

import { state, subscribe, setView, setSetting, setMaze, markSaved, restoreWork, undo, redo, canUndo, canRedo, change } from './store.js';
import { createMaze, toJSON, toGo, fromJSON, parseAny, goIdent, TYPES, DIRS, U, D, cellAt, setPassage, clearCell, LIMITS } from './maze.js';
import { $, h, icon, openMenu, dialog, field, toast, download, pickFile } from './ui.js';
import { createGrid, isTyping } from './grid.js';
import { createIso } from './iso.js';
import { createInspector } from './inspector.js';
import { createSpaceMouse, supported as hidSupported } from './spacemouse.js';

// ---- the server (editor/main.go): the mazes as files. Without it the editor keeps the maze in the
//      browser only (store.js) and Save offers a download --------------------------------------------

const api = {
  ok: false,
  async info() {
    try { const r = await fetch('api/info'); if (!r.ok) return null; this.ok = true; return r.json(); } catch { return null; }
  },
  async list() { const r = await fetch('api/mazes'); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async load(name) { const r = await fetch(`api/mazes/${encodeURIComponent(name)}`); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async save(name, data) {
    const r = await fetch(`api/mazes/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data, null, 1) });
    if (!r.ok) throw new Error(await r.text());
  },
  async remove(name) { const r = await fetch(`api/mazes/${encodeURIComponent(name)}`, { method: 'DELETE' }); if (!r.ok) throw new Error(await r.text()); },
};
const fileName = s => String(s).trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'maze';

// ---- the views ----------------------------------------------------------------------------------

const grid = createGrid($('#grid'));
const iso = createIso($('#iso-stage'));
createInspector($('#inspector'));

function showView(v) {
  document.body.dataset.view = v;
  document.querySelectorAll('.md-nav-rail__item').forEach(b => b.classList.toggle('md-nav-rail__item--active', b.dataset.view === v));
  document.querySelectorAll('.toolbar__view').forEach(t => { t.hidden = t.dataset.for !== v; });
  document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== `view-${v}`; });
  if (v === 'code') renderCode();
  updateChrome();
}
document.querySelectorAll('.md-nav-rail__item').forEach(b => { b.onclick = () => showView(b.dataset.view); });

// ---- the code view ------------------------------------------------------------------------------

let codeFormat = 'go';
const codeText = () => codeFormat === 'go' ? toGo(state.maze) : JSON.stringify(toJSON(state.maze), null, 1);
function renderCode() { if (document.body.dataset.view === 'code') $('#code').textContent = codeText(); }
document.querySelectorAll('#code-format button').forEach(b => {
  b.onclick = () => {
    codeFormat = b.dataset.format;
    document.querySelectorAll('#code-format button').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    renderCode();
  };
});
$('#btn-code-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(codeText()); toast('Copied to the clipboard.'); } catch (e) { toast(`Copy failed: ${e.message}`, { error: true }); }
};
$('#btn-code-download').onclick = () => codeFormat === 'go' ? exportGo() : exportJSON();

// ---- the toolbar of the editor --------------------------------------------------------------------

const TOOL_KEYS = { v: 'select', c: 'carve', p: 'carve', w: 'wall', e: 'erase', s: 'stairs', i: 'item' };
document.querySelectorAll('#tools button').forEach(b => { b.onclick = () => setView({ tool: b.dataset.tool }); });

// the item tool: which item, which number
function renderItemTool() {
  const box = $('#item-tool');
  box.hidden = state.tool !== 'item';
  if (box.hidden) return;
  const t = TYPES[state.item];
  box.replaceChildren(
    h('div', { class: 'md-segmented' }, TYPES.slice(1).map(tt => h('button', {
      'aria-pressed': String(tt.id === state.item), 'data-tip': `${tt.name} (${tt.id})`, style: `--item: ${tt.color}`,
      onclick: () => setView({ item: tt.id }),
    }, h('i', { class: `msr msr--sm la ${tt.icon}` })))),
    h('label', { class: 'item-no', 'data-tip': t.numbered ? 'The number: a key opens the gate of its number' : 'The number of the item (the last character of the code)' },
      h('span', { class: 'md-label-medium' }, 'No.'),
      h('input', { class: 'item-no__input', type: 'number', min: 0, max: 9, value: state.itemNo,
        onchange: e => setView({ itemNo: Math.max(0, Math.min(9, Number(e.target.value) | 0)) }) })));
}

function renderLevels() {
  const tabs = $('#level-tabs'), m = state.maze;
  if (tabs.childElementCount !== m.levels) {
    tabs.replaceChildren(...Array.from({ length: m.levels }, (_, z) => h('button', { 'data-level': z, 'data-tip': `Level ${z + 1}${z === 0 ? ' (the lowest)' : ''}`, onclick: () => setView({ level: z }) }, String(z + 1))));
  }
  tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.level) === state.level)));
  $('#btn-level-down').disabled = state.level === 0;
  $('#btn-level-up').disabled = state.level >= m.levels - 1;
}
const goLevel = dz => {
  const z = Math.max(0, Math.min(state.maze.levels - 1, state.level + dz));
  if (z !== state.level) setView({ level: z });
};
$('#btn-level-down').onclick = () => goLevel(-1);
$('#btn-level-up').onclick = () => goLevel(1);

$('#btn-undo').onclick = undo;
$('#btn-redo').onclick = redo;
$('#btn-zoom-in').onclick = () => grid.zoomIn();
$('#btn-zoom-out').onclick = () => grid.zoomOut();
$('#btn-fit').onclick = () => grid.fit();
$('#btn-3d').onclick = () => setSetting('preview', !state.settings.preview);
$('#btn-inspector').onclick = () => setSetting('inspector', state.settings.inspector === false);
$('#btn-iso-left').onclick = () => iso.turn(-Math.PI / 2);
$('#btn-iso-right').onclick = () => iso.turn(Math.PI / 2);
$('#btn-iso-closer').onclick = () => iso.spread(1 / 1.25);
$('#btn-iso-apart').onclick = () => iso.spread(1.25);
$('#btn-iso-reset').onclick = () => iso.reset();
$('#btn-iso-solid').onclick = e => e.currentTarget.classList.toggle('md-icon-button--selected', iso.toggleSolid());

// the split between the level editor and the 3D view: drag the handle, double click resets
{
  const handle = $('#split-handle'), pane = $('#iso');
  const setW = w => { pane.style.width = w ? `${w}px` : ''; try { localStorage.setItem('jm-iso-width', w || ''); } catch { /* */ } };
  const saved = Number(localStorage.getItem('jm-iso-width'));
  if (saved) pane.style.width = `${saved}px`;
  handle.addEventListener('pointerdown', e => {
    handle.setPointerCapture(e.pointerId);
    const sx = e.clientX, sw = pane.getBoundingClientRect().width, max = pane.parentElement.clientWidth - 240;
    document.body.classList.add('col-resizing');
    const move = ev => setW(Math.round(Math.max(220, Math.min(max, sw - (ev.clientX - sx)))));
    const stop = () => { handle.removeEventListener('pointermove', move); document.body.classList.remove('col-resizing'); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop, { once: true });
  });
  handle.addEventListener('dblclick', () => setW(0));
}

// ---- the chrome: what follows the state -----------------------------------------------------------

function updateChrome() {
  const m = state.maze;
  document.querySelectorAll('#tools button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool)));
  $('#grid').dataset.tool = state.tool;
  renderItemTool();
  renderLevels();
  $('#btn-undo').disabled = !canUndo();
  $('#btn-redo').disabled = !canRedo();
  $('#file-name').textContent = state.file ?? `${m.name} (not saved)`;
  $('#save-dot').hidden = !state.dirty;
  document.title = `${state.dirty ? '• ' : ''}${m.name} - Jester's Maze Editor`;
  const preview = state.settings.preview !== false;
  $('#iso').hidden = !preview;
  $('#split-handle').hidden = !preview;
  $('#btn-3d').classList.toggle('md-icon-button--selected', preview);
  const insp = state.settings.inspector !== false;
  $('#inspector').hidden = !insp || document.body.dataset.view !== 'editor';
  $('#btn-inspector').classList.toggle('md-icon-button--selected', insp);
  const errors = state.problems.filter(p => p.level === 'error').length;
  const badge = $('#problem-badge');
  badge.hidden = !errors;
  badge.textContent = errors;
  const chip = $('#status-chip');
  chip.className = `status-chip status-chip--${errors ? 'error' : state.problems.length ? 'warning' : 'ok'}`;
  chip.replaceChildren(icon(errors ? 'la-exclamation-circle' : state.problems.length ? 'la-exclamation-triangle' : 'la-check-circle', 'msr--xs'),
    errors ? `${errors} error${errors === 1 ? '' : 's'}` : state.problems.length ? `${state.problems.length} warning${state.problems.length === 1 ? '' : 's'}` : 'Maze ok');
  chip.dataset.tip = 'The problems are listed in the inspector';
}
subscribe(kind => { updateChrome(); if (kind === 'maze') renderCode(); });

// ---- the burger menu: the settings ----------------------------------------------------------------

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('jm-theme', t); } catch { /* */ }
  grid.redraw(); iso.redraw();
}
$('#btn-menu').onclick = e => openMenu(e.currentTarget, [
  { header: 'Settings' },
  document.documentElement.dataset.theme === 'dark'
    ? { label: 'Light theme', icon: 'la-sun', onclick: () => setTheme('light') }
    : { label: 'Dark theme', icon: 'la-moon', onclick: () => setTheme('dark') },
  { divider: true },
  { label: 'Coordinates', icon: 'la-ruler-combined', checked: state.settings.coords, onclick: () => setSetting('coords', !state.settings.coords) },
  { label: 'Level below, faint', icon: 'la-layer-group', checked: state.settings.ghost, onclick: () => setSetting('ghost', !state.settings.ghost) },
  { label: '3D view', icon: 'la-cube', kbd: '3', checked: state.settings.preview !== false, onclick: () => setSetting('preview', state.settings.preview === false) },
  { label: 'Inspector', icon: 'la-columns', kbd: 'Tab', checked: state.settings.inspector !== false, onclick: () => setSetting('inspector', state.settings.inspector === false) },
  { divider: true },
  hidSupported() ? { label: 'SpaceMouse…', icon: 'la-compass', onclick: showSpaceMouse } : null,
  { label: 'Keyboard shortcuts', icon: 'la-keyboard', kbd: '?', onclick: showKeys },
  { label: 'About', icon: 'la-info-circle', onclick: showAbout },
]);

function showAbout() {
  dialog({
    title: 'About',
    content: h('div', { class: 'about' },
      h('img', { class: 'about__logo', src: 'images/jmg_logo.png', alt: "Jester's Maze Generator" }),
      h('div', { class: 'md-body-small about__text' }, 'Three dimensional mazes for the Jester\'s Maze server of the C64U / U64'),
      h('div', { class: 'md-body-small about__text' }, 'drazil 2026'),
      h('div', { class: 'md-body-small about__text' }, 'Icons: ', h('a', { href: 'https://icons8.com/line-awesome', target: '_blank', rel: 'noopener' }, 'Line Awesome by Icons8'))),
  });
}

function showKeys() {
  const rows = [
    ['V C W E S I', 'Tools: select, carve, wall, erase, stairs, item'],
    ['1 … 7', 'The item to place (with the item tool)'],
    ['Page Up / Page Down', 'Level above / below'],
    ['Arrows', 'Move the selection'],
    ['Shift+Arrows', 'Toggle the passage of the selected cell'],
    ['Shift+Page Up / Down', 'Toggle the stairs of the selected cell'],
    ['Delete', 'Clear the selected cell'],
    ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
    ['Ctrl+S', 'Save'],
    ['F, +, -', 'Fit, zoom in, zoom out'],
    ['Space+drag, right drag', 'Pan'],
    ['3 / Tab', '3D view / inspector on or off'],
    ['SpaceMouse', 'Roll: turn, twist: rotate, tilt, push / pull: zoom, slide: move the 3D view; buttons: level below / above'],
  ];
  dialog({ title: 'Keyboard shortcuts', width: 560, content: h('table', { class: 'keys' }, rows.map(([k, t]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, t)))) });
}

// ---- files --------------------------------------------------------------------------------------

async function confirmDiscard() {
  if (!state.dirty) return true;
  return dialog({
    title: 'Discard the changes?', content: h('p', {}, `The changes of "${state.maze.name}" are not saved.`),
    actions: [{ label: 'Cancel', value: false }, { label: 'Discard', value: true, variant: 'filled', danger: true }],
  });
}

async function newMaze() {
  if (!await confirmDiscard()) return;
  const v = { name: 'maze', width: 20, depth: 20, levels: 3 };
  const num = (k, label, max) => field({ label, type: 'number', id: `new-${k}`, min: 1, max, value: v[k], oninput: e => { v[k] = Number(e.target.value) | 0; } });
  const ok = await dialog({
    title: 'New maze',
    content: h('div', { class: 'stack' },
      field({ label: 'Name', id: 'new-name', value: v.name, oninput: e => { v.name = e.target.value; } }),
      h('div', { class: 'grid3' }, num('width', 'Width (x)', LIMITS.size), num('depth', 'Depth (y)', LIMITS.size), num('levels', 'Levels (z)', LIMITS.levels)),
      h('p', { class: 'md-body-small' }, 'The game server of today has a maze of 20 × 20 cells.')),
    actions: [{ label: 'Cancel', value: false }, { label: 'Create', value: true, variant: 'filled' }],
  });
  if (!ok) return;
  const c = (n, max) => Math.max(1, Math.min(max, n | 0));
  setMaze(createMaze({ name: v.name.trim() || 'maze', width: c(v.width, LIMITS.size), depth: c(v.depth, LIMITS.size), levels: c(v.levels, LIMITS.levels) }));
  grid.refit();
}

async function openMaze() {
  if (!api.ok) return toast('Open needs the editor server (editor/main.go). Use Import for a file.', { error: true });
  let list;
  try { list = await api.list(); } catch (e) { return toast(`The mazes could not be listed: ${e.message}`, { error: true }); }
  if (!list.length) return toast('No mazes saved yet.');
  let close;
  const pick = async name => {
    close(null);
    if (!await confirmDiscard()) return;
    try {
      const warnings = [];
      const m = fromJSON(await api.load(name), warnings);
      setMaze(m, { file: name });
      grid.refit();
      if (warnings.length) toast(`${warnings.length} cell code(s) were not understood: ${warnings[0]}`, { error: true });
    } catch (e) { toast(`"${name}" could not be opened: ${e.message}`, { error: true }); }
  };
  const remove = async (name, ev) => {
    ev.stopPropagation();
    close(null);
    const sure = await dialog({ title: `Delete "${name}"?`, content: h('p', {}, 'The file is deleted on the server.'),
      actions: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, variant: 'filled', danger: true }] });
    if (!sure) return;
    try {
      await api.remove(name);
      if (state.file === name) setView({ file: null, dirty: true });
      toast(`"${name}" deleted.`); } catch (e) { toast(e.message, { error: true }); }
  };
  dialog({
    title: 'Open a maze', width: 480,
    content: h('div', { class: 'md-list' }, list.map(f => h('div', { class: 'md-list-item', role: 'button', tabindex: 0, onclick: () => pick(f.name), onkeydown: e => e.key === 'Enter' && pick(f.name) },
      icon('la-cubes'),
      h('span', { class: 'md-list-item__text' },
        h('span', { class: 'md-list-item__headline' }, f.name),
        h('span', { class: 'md-list-item__support' }, `${f.width ?? '?'} × ${f.depth ?? '?'} × ${f.levels ?? '?'} · ${new Date(f.modified).toLocaleString()}`)),
      h('button', { class: 'md-icon-button md-icon-button--sm md-icon-button--danger', 'data-tip': 'Delete', onclick: e => remove(f.name, e) }, icon('la-trash-alt'))))),
    actions: [{ label: 'Cancel', value: null }],
    onopen: box => { close = () => box.parentElement.querySelector('.md-dialog__actions button').click(); },
  });
}

async function save(as = false) {
  if (!api.ok) { exportJSON(); markSaved(null); return; }
  let name = state.file;
  if (as || !name) {
    let v = fileName(state.maze.name);
    const ok = await dialog({
      title: as ? 'Save as' : 'Save the maze',
      content: field({ label: 'File name', id: 'save-name', value: v, support: 'Letters, digits, - and _ (saved as <name>.json in the mazes folder)', oninput: e => { v = e.target.value; } }),
      actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, variant: 'filled' }],
    });
    if (!ok) return;
    name = fileName(v);
  }
  try {
    await api.save(name, toJSON(state.maze));
    markSaved(name);
    toast(`Saved as ${name}.json`);
  } catch (e) { toast(`Save failed: ${e.message}`, { error: true }); }
}

function exportGo() { download(`${goIdent(state.maze.name)}.go`, toGo(state.maze), 'text/x-go'); }
function exportJSON() { download(`${fileName(state.maze.name)}.json`, JSON.stringify(toJSON(state.maze), null, 1), 'application/json'); }

async function importMaze() {
  const f = await pickFile('.json,.go,.txt');
  if (!f) return;
  if (!await confirmDiscard()) return;
  try {
    const warnings = [];
    const m = parseAny(await f.text(), warnings);
    if (!/\.json$/i.test(f.name) && m.name === 'maze') m.name = f.name.replace(/\.\w+$/, '');
    setMaze(m, { dirty: true });
    grid.refit();
    toast(`Imported ${m.width} × ${m.depth} × ${m.levels} from ${f.name}.`);
    if (warnings.length) {
      dialog({ title: `${warnings.length} problem${warnings.length === 1 ? '' : 's'} in the file`, width: 620,
        content: h('div', {}, h('p', {}, 'These cells were read as far as they could be:'), h('pre', { class: 'warnings' }, warnings.slice(0, 100).join('\n'))) });
    }
  } catch (e) { toast(`${f.name} could not be imported: ${e.message}`, { error: true }); }
}

$('#btn-file').onclick = e => openMenu(e.currentTarget, [
  { label: 'New maze…', icon: 'la-plus', onclick: newMaze },
  { label: 'Open…', icon: 'la-folder-open', kbd: 'Ctrl+O', disabled: !api.ok, onclick: openMaze },
  { divider: true },
  { label: 'Save', icon: 'la-save', kbd: 'Ctrl+S', onclick: () => save() },
  { label: 'Save as…', icon: 'la-copy', disabled: !api.ok, onclick: () => save(true) },
  { divider: true },
  { label: 'Import…', icon: 'la-upload', onclick: importMaze },
]);
$('#btn-save').onclick = () => save();
$('#btn-import').onclick = importMaze;
$('#btn-export').onclick = e => openMenu(e.currentTarget, [
  { header: 'Export' },
  { label: 'Go source (for mazeserver.go)', icon: 'la-file-code', onclick: exportGo },
  { label: 'JSON', icon: 'la-file-alt', onclick: exportJSON },
]);
addEventListener('beforeunload', e => { if (state.dirty && api.ok) e.preventDefault(); });

// ---- keys ---------------------------------------------------------------------------------------

const ARROWS = { ArrowUp: DIRS[0], ArrowDown: DIRS[1], ArrowLeft: DIRS[2], ArrowRight: DIRS[3] };
addEventListener('keydown', e => {
  if (document.querySelector('.md-dialog-scrim')) return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 's') { e.preventDefault(); return save(); }
  if (ctrl && k === 'o') { e.preventDefault(); return openMaze(); }
  if (isTyping(e)) return;
  if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); return undo(); }
  if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return redo(); }
  if (ctrl || e.altKey || document.body.dataset.view !== 'editor') return;
  const sel = state.sel, z = state.level;
  if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault();
    const bit = e.key === 'PageUp' ? U : D;
    if (e.shiftKey && sel) return change(m => setPassage(m, sel.x, sel.y, z, bit, !(m.cells[z][sel.y][sel.x].o & bit)) || false);
    return goLevel(bit === U ? 1 : -1);
  }
  if (ARROWS[e.key]) {
    e.preventDefault();
    const d = ARROWS[e.key];
    if (!sel) return setView({ sel: { x: 0, y: 0 } });
    if (e.shiftKey) return change(m => setPassage(m, sel.x, sel.y, z, d.bit, !(m.cells[z][sel.y][sel.x].o & d.bit)) || false);
    if (cellAt(state.maze, sel.x + d.dx, sel.y + d.dy, z)) setView({ sel: { x: sel.x + d.dx, y: sel.y + d.dy } });
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
    return change(m => { const c = m.cells[z][sel.y][sel.x]; if (!c.o && !c.t) return false; clearCell(m, sel.x, sel.y, z); });
  }
  if (e.key === 'Escape') return setView({ sel: null });
  if (e.key === 'Tab') { e.preventDefault(); return setSetting('inspector', state.settings.inspector === false); }
  if (e.key === '?') return showKeys();
  if (k === 'f') return grid.fit();
  if (e.key === '+' || e.key === '=') return grid.zoomIn();
  if (e.key === '-') return grid.zoomOut();
  if (e.key === '3' && state.tool !== 'item') return setSetting('preview', state.settings.preview === false);
  if (state.tool === 'item' && /^[1-7]$/.test(e.key)) return setView({ item: Number(e.key) });
  if (TOOL_KEYS[k] && !e.shiftKey) return setView({ tool: TOOL_KEYS[k] });
});

// ---- the SpaceMouse: it moves the 3D view (roll: turn, twist: rotate the picture, tilt: tilt, push / pull: zoom, slide: move);
//      without the 3D view the level grid (slide: move, push / pull: zoom).
//      The left button goes a level down, the right one a level up ------------------------------------

const smSetting = (k, def) => state.settings[k] ?? def;
const spacemouse = createSpaceMouse({
  onMotion(a, dt) {
    if (document.body.dataset.view !== 'editor' || document.querySelector('.md-dialog-scrim')) return;
    // the device's axes: y slide forward / back, z push / pull, rz twist, ry roll (spacemouse.js)
    const inv = k => smSetting(k, false) ? -1 : 1;
    const speed = smSetting('smSpeed', 1) * dt, turn = -inv('smInvertTurn'), zoom = inv('smInvertZoom'), slide = inv('smInvertSlide');
    const zf = Math.exp(a.tz * 1.8 * speed * zoom);      // push down (z > 0): zoom in, pull up: zoom out
    if (state.settings.preview !== false) iso.move({ yaw: -a.rz * 2.6 * speed * turn, pitch: -a.rx * 1.6 * speed * turn, roll: -a.ry * 2.0 * speed * turn, zoom: zf, panX: a.tx * 700 * speed * slide, panY: a.ty * 700 * speed * slide });
    else grid.move({ panX: a.tx * 900 * speed * slide, panY: a.ty * 900 * speed * slide, zoom: zf });
  },
  onButton(b, down) {
    if (!down || document.querySelector('.md-dialog-scrim')) return;
    if (b === 0) goLevel(-1);
    if (b === 1) goLevel(1);
  },
  onChange: () => updateSpaceMouse(),
  auto: () => smSetting('smAuto', true),
});

// connect automatically: a SpaceMouse granted once opens by itself (spacemouse.js). Before that the
// browser has to ask, and it lets a page ask only from a click: the first click in the editor opens
// its device chooser, once - cancelled, it does not ask again (the dialog still connects)
// the 3Dconnexion driver (3DxWare) turns the motion of the cap into wheel and key events for programs it
// does not know - the browser too. Read from the device as well, the views would move twice, the
// emulated motion often the other way: while the cap moves, the wheel and the zoom keys are ignored
addEventListener('wheel', e => { if (spacemouse.active) { e.preventDefault(); e.stopImmediatePropagation(); } }, { capture: true, passive: false });
addEventListener('keydown', e => { if (spacemouse.active && ['+', '-', '=', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

addEventListener('click', async function ask(e) {
  if (!hidSupported() || !smSetting('smAuto', true) || !smSetting('smAsk', true)) return removeEventListener('click', ask, true);
  if (spacemouse.device || spacemouse.granted || e.target.closest?.('.md-dialog-scrim')) return;
  removeEventListener('click', ask, true);
  try {
    if (await spacemouse.connect()) toast(`SpaceMouse connected: ${spacemouse.name}`);
    else setSetting('smAsk', false);
  } catch { setSetting('smAsk', false); }
}, true);

function updateSpaceMouse() {
  const btn = $('#btn-spacemouse');
  btn.hidden = !hidSupported();
  btn.classList.toggle('md-icon-button--selected', !!spacemouse.device);
  btn.dataset.tip = spacemouse.device ? `SpaceMouse: ${spacemouse.name}` : 'SpaceMouse: not connected';
  document.dispatchEvent(new Event('spacemouse'));
}

// the settings: connect, a meter of the six axes (to see what the cap sends), speed, directions
function showSpaceMouse() {
  const status = h('div', { class: 'sm-status' });
  // each bar: the motion named on its left fills it to the left (sign: the device's value turned
  // to that - the SpaceNavigator reports push and a twist to the left as positive)
  const AXES = [
    ['tx', 'Slide', 'left', 'right', 1], ['ty', 'Slide', 'forward', 'back', 1], ['tz', 'Push / pull', 'push', 'pull', -1],
    ['rx', 'Tilt', 'forward', 'back', 1], ['rz', 'Roll', 'left', 'right', 1], ['ry', 'Twist', 'left', 'right', -1],
  ];
  const bars = AXES.map(([k, label, from, to, sign]) => {
    const fill = h('span', { class: 'sm-meter__fill' });
    return { k, sign, fill, row: h('div', { class: 'sm-meter__row' }, h('span', { class: 'sm-meter__label' }, label, h('span', { class: 'sm-meter__axis' }, k)),
      h('span', { class: 'sm-meter__end' }, from), h('span', { class: 'sm-meter__bar' }, fill), h('span', { class: 'sm-meter__end' }, to)) };
  });
  const renderStatus = () => status.replaceChildren(spacemouse.device
    ? h('div', { class: 'sm-status__line' }, icon('la-check-circle', 'sm-ok'), h('span', { class: 'sm-status__text' }, `Connected: ${spacemouse.name}`),
      h('button', { class: 'md-button md-button--small md-button--text md-button--danger', onclick: () => spacemouse.forget() }, 'Disconnect'))
    : h('div', { class: 'sm-status__line' }, icon('la-plug'), h('span', { class: 'sm-status__text' }, 'No SpaceMouse connected.'),
      h('button', { class: 'md-button md-button--small md-button--filled', onclick: async () => {
        try { if (!await spacemouse.connect()) toast('No device was picked.'); } catch (e) { toast(`The SpaceMouse could not be opened: ${e.message}`, { error: true }); }
      } }, icon('la-plug'), 'Connect…')));
  renderStatus();
  document.addEventListener('spacemouse', renderStatus);
  let live = requestAnimationFrame(function meter() {
    for (const b of bars) {
      const v = spacemouse.raw[b.k] * b.sign;
      b.fill.style.left = `${50 + Math.min(0, v) * 50}%`;
      b.fill.style.width = `${Math.abs(v) * 50}%`;
    }
    live = requestAnimationFrame(meter);
  });
  const speedOut = h('span', { class: 'sm-range__value' }, `${smSetting('smSpeed', 1).toFixed(1)}×`);
  const speed = h('input', { type: 'range', class: 'sm-range', min: .2, max: 3, step: .1, value: smSetting('smSpeed', 1),
    oninput: e => { setSetting('smSpeed', Number(e.target.value)); speedOut.textContent = `${Number(e.target.value).toFixed(1)}×`; } });
  const check = (k, label) => h('label', { class: 'md-checkbox' }, h('input', { type: 'checkbox', checked: smSetting(k, false), onchange: e => setSetting(k, e.target.checked) }), label);
  dialog({
    title: 'SpaceMouse', width: 540,
    content: h('div', { class: 'stack' },
      status,
      h('p', { class: 'md-body-small' }, 'Moves the 3D view: roll turns the maze, twist rotates the picture, tilting tilts it, push / pull zooms, sliding moves it. With the 3D view off it moves and zooms the level grid. Left button: level below, right button: level above.'),
      h('div', { class: 'sm-meter' }, bars.map(b => b.row)),
      h('label', { class: 'sm-range__row' }, h('span', { class: 'md-label-large' }, 'Speed'), speed, speedOut),
      h('div', { class: 'sm-checks' }, check('smInvertTurn', 'Invert turn and tilt'), check('smInvertZoom', 'Invert zoom'), check('smInvertSlide', 'Invert slide')),
      h('div', { class: 'sm-checks' }, h('label', { class: 'md-checkbox' }, h('input', { type: 'checkbox', checked: smSetting('smAuto', true),
        onchange: e => { setSetting('smAuto', e.target.checked); if (e.target.checked) { setSetting('smAsk', true); spacemouse.openGranted(); } } }), 'Connect automatically when a SpaceMouse is available')),
      h('p', { class: 'md-body-small sm-note' }, 'Needs Chrome or Edge (WebHID). If the 3Dconnexion driver keeps the device to itself, quit 3DxWare and connect again.')),
  }).then(() => { cancelAnimationFrame(live); document.removeEventListener('spacemouse', renderStatus); });
}
$('#btn-spacemouse').onclick = showSpaceMouse;
updateSpaceMouse();

// ---- start --------------------------------------------------------------------------------------

api.info().then(info => {
  if (info?.version) { $('#app-version').textContent = info.version; $('#app-version').hidden = false; }
  if (!api.ok) toast('No editor server: the maze is kept in this browser, Save downloads a file.');
  updateChrome();
});
if (!restoreWork()) setMaze(createMaze({ name: 'maze', width: 20, depth: 20, levels: 3 }));
showView('editor');
