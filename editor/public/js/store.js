// store.js - the state of the editor: the maze, the level shown, the selected cell, the tool, the
// history of the changes (undo / redo) and the settings. Views listen with subscribe(fn(kind)):
//   'maze'  the cells or the size changed      'view'  level, selection, tool or a setting changed

import { createMaze, cloneMaze, toJSON, fromJSON, validate } from './maze.js';

const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = kind => listeners.forEach(fn => fn(kind));

const SETTINGS_KEY = 'jm-settings', WORK_KEY = 'jm-work';
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };

export const state = {
  maze: createMaze(),
  level: 0,
  sel: null,                 // { x, y } on the level shown
  tool: 'carve',             // select | carve | wall | erase | stairs | item
  item: 1,                   // the type the item tool places
  itemNo: 0,                 // and its number
  dirty: false,              // changes not saved into the maze's file
  file: null,                // the name of the file on the server, null: not saved yet
  problems: [],
  settings: { coords: true, ghost: true, preview: true, ...load(SETTINGS_KEY, {}) },
};

let undoStack = [], redoStack = [];

// a change of the cells: fn gets the maze to change in place; one step of the history
// (fn returns false: nothing changed, no step). In a stroke - the drag of a tool - the first change
// opens the step and the others join it
let stroke = false, strokeOpen = false;
export function beginStroke() { stroke = true; strokeOpen = false; }
export function endStroke() { stroke = false; }
export function change(fn) {
  const before = cloneMaze(state.maze);
  if (fn(state.maze) === false) return;
  if (!stroke || !strokeOpen) {
    undoStack.push(before);
    if (undoStack.length > 300) undoStack.shift();
    strokeOpen = stroke;
  }
  redoStack = [];
  touched();
}

function touched() {
  state.dirty = true;
  state.problems = validate(state.maze);
  saveWork();
  emit('maze');
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export function undo() {
  if (!undoStack.length) return;
  redoStack.push(cloneMaze(state.maze));
  replaceMaze(undoStack.pop());
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(cloneMaze(state.maze));
  replaceMaze(redoStack.pop());
}
function replaceMaze(m) {
  state.maze = m;
  state.level = Math.min(state.level, m.levels - 1);
  if (state.sel && (state.sel.x >= m.width || state.sel.y >= m.depth)) state.sel = null;
  touched();
}

// a maze as a whole: new, opened, imported, resized (resize keeps the history)
export function setMaze(m, { file = null, keepHistory = false, dirty = false } = {}) {
  if (keepHistory) undoStack.push(cloneMaze(state.maze)), redoStack = [];
  else undoStack = [], redoStack = [];
  state.maze = m;
  if (!keepHistory) state.file = file;
  state.level = Math.min(state.level, m.levels - 1);
  state.sel = null;
  state.problems = validate(m);
  state.dirty = dirty;
  saveWork();
  emit('maze');
  emit('view');
}

export function setView(patch) {
  Object.assign(state, patch);
  emit('view');
}

export function setSetting(k, v) {
  state.settings[k] = v;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* no storage */ }
  emit('view');
}

export function markSaved(file) {
  state.file = file;
  state.dirty = false;
  saveWork();
  emit('view');
}

// the work in progress survives a reload of the page
function saveWork() {
  try { localStorage.setItem(WORK_KEY, JSON.stringify({ maze: toJSON(state.maze), file: state.file, dirty: state.dirty })); } catch { /* full */ }
}
export function restoreWork() {
  const w = load(WORK_KEY, null);
  if (!w?.maze) return false;
  try { setMaze(fromJSON(w.maze), { file: w.file ?? null, dirty: !!w.dirty }); return true; } catch { return false; }
}
