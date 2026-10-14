// play.js - the play view: walks the maze of the editor as the game server lets the C64 walk it
// (src/server/mazeserver.go), with the pictures of the game (screens/) and its arrows, the open ways.
// Beside it the 3D view shows the way walked and where the player is.
//   cursor keys            as seen by the player: ↑ forward, → right, ↓ back, ← left (only where the cell
//                          is open); every step turns the player the way it went
//   Shift+↑ / Shift+↓      the stairs up / down (the game: fire + up / down), Page Up / Down as well
//   F1                     back to the start (as in the game)
// The start (type 1) is where the walk begins, the exit (type 2) ends it. On the way the treasures,
// the lamp oil and the keys are picked up; a gate lets the player through with the key of its number.

import { state, subscribe } from './store.js';
import { DIRS, U, D, TYPES, cellAt } from './maze.js';
import { h, icon } from './ui.js';
import { createIso } from './iso.js';

const PICTURES = { corridor: 'images/play/maze2.png', exit: 'images/play/exit2.png', stairs: 'images/play/stair_up.png' };
// the keys: a turn from the way the player faces (0 forward, 1 right, 2 back, 3 left), or the stairs
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, PageUp: 'u', PageDown: 'd' };
const CLOCKWISE = ['n', 'e', 's', 'w'];
const turned = (facing, turn) => CLOCKWISE[(CLOCKWISE.indexOf(facing) + turn) % 4];
const NAMES = { n: 'NORTH', e: 'EAST', s: 'SOUTH', w: 'WEST' };
const key = p => `${p.x},${p.y},${p.z}`;

export function createPlay({ body, bar }) {
  let game = null;          // { pos, path, steps, taken: Set, keys: Set, found: [], won, message }
  let stale = false;        // the maze changed while playing

  // ---- the toolbar ----------------------------------------------------------------------------
  bar.replaceChildren(h('div', { class: 'screen-bar play-bar' },
    h('span', { class: 'md-title-medium' }, 'Play'),
    h('span', { class: 'screen-bar__sep' }),
    h('button', { class: 'md-icon-button', id: 'btn-play-restart', 'data-tip': 'Back to the start (F1)', onclick: () => restart() }, icon('la-redo-alt')),
    h('span', { class: 'screen-bar__sep' }),
    h('span', { class: 'md-body-small play-keys' }, h('kbd', {}, '↑'), ' forward  ', h('kbd', {}, '←→'), ' turn and walk  ', h('kbd', {}, '↓'), ' back  ', h('kbd', {}, 'Shift+↑↓'), ' stairs  ', h('kbd', {}, 'F1'), ' start'),
    h('div', { class: 'app-bar__spacer' }),
    h('span', { class: 'md-body-small play-note' }, 'Walks the maze of the editor as the server does: the way, not the final graphics of the C64.')));

  // ---- the body: the screen left, the 3D view with the way right --------------------------------
  const pic = h('img', { class: 'play-pic', alt: '', src: PICTURES.corridor });
  const won = h('div', { class: 'play-won', hidden: true });
  const msg = h('div', { class: 'play-row play-msg' });
  const where = h('div', { class: 'play-row' });
  const arrows = {};
  const arrow = (d, name) => (arrows[d] = h('span', { class: `play-arrow play-arrow--${d}` }, icon(name)));
  const compass = h('div', { class: 'play-compass' }, arrow('n', 'la-arrow-up'), arrow('w', 'la-arrow-left'), arrow('e', 'la-arrow-right'), arrow('s', 'la-arrow-down'));
  const stairs = h('div', { class: 'play-stairs' }, arrow('u', 'la-caret-up'), arrow('d', 'la-caret-down'));
  const bag = h('div', { class: 'play-bag' });
  const staleNote = h('div', { class: 'play-stale', hidden: true }, 'The maze changed: Restart (F1) plays the new one.');
  const status = h('span', { class: 'md-body-small screen-status' });
  const empty = h('div', { class: 'play-empty', hidden: true },
    icon('la-flag'), h('p', {}, 'The maze has no start yet: put one in with the Item tool of the editor (I, then 1).'));
  const screen = h('div', { class: 'play-screen' },
    h('div', { class: 'play-stage' }, pic, won),
    msg,
    h('div', { class: 'play-panel' }, compass, stairs, h('div', { class: 'play-info' }, where, bag)));
  const isoStage = h('div', { class: 'iso__stage' });
  body.replaceChildren(h('div', { class: 'play-split' },
    h('div', { class: 'play-main' }, staleNote, empty, screen, h('div', { class: 'screen-foot' }, status)),
    h('div', { class: 'iso play-iso' },
      h('div', { class: 'iso__bar' },
        h('span', { class: 'md-label-medium iso__title' }, icon('la-route', 'msr--xs'), 'The way walked'),
        h('div', { class: 'app-bar__spacer' }),
        h('button', { class: 'md-icon-button md-icon-button--xs', 'data-tip': 'Reset the view (double click)', onclick: () => iso.reset() }, icon('la-sync-alt'))),
      isoStage,
      h('div', { class: 'iso__hint md-body-small' }, 'Green: start · yellow: you'))));
  const iso = createIso(isoStage, { level: () => game?.pos.z ?? state.level, path: () => game && { path: game.path, pos: game.pos, facing: game.facing } });

  // ---- the game ---------------------------------------------------------------------------------

  function findStart() {
    const m = state.maze;
    for (let z = 0; z < m.levels; z++) for (let y = 0; y < m.depth; y++) for (let x = 0; x < m.width; x++)
      if (m.cells[z][y][x].t === 1) return { x, y, z };
    return null;
  }

  // at the start the player faces the first open way into the maze (north first, clockwise)
  function firstFacing(p) {
    const m = state.maze, c = cellAt(m, p.x, p.y, p.z);
    const open = CLOCKWISE.filter(k => { const d = DIRS.find(d => d.key === k); return (c.o & d.bit) && cellAt(m, p.x + d.dx, p.y + d.dy, p.z); });
    return open[0] ?? 'n';
  }

  function restart() {
    const start = findStart();
    stale = false;
    game = start && { pos: start, facing: firstFacing(start), path: [start], steps: 0, taken: new Set(), keys: new Set(), found: [], won: false, message: 'Find the way out of the maze.' };
    if (game) enter(start);
    render();
  }

  // what the cell holds when the player comes in
  function enter(p) {
    const c = cellAt(state.maze, p.x, p.y, p.z), k = key(p);
    if (c.t === 2) { game.won = true; game.message = 'Congratulations, you have mastered Jester\'s Maze!'; return; }
    if (c.t === 1) { if (game.steps) game.message = 'You\'re on the start again.'; return; }
    if ([3, 4, 5].includes(c.t) && !game.taken.has(k)) {
      game.taken.add(k);
      game.found.push({ t: c.t, n: c.n });
      if (c.t === 5) game.keys.add(c.n);
      game.message = `You found ${c.t === 3 ? 'a treasure' : c.t === 4 ? 'lamp oil' : `key ${c.n}`}.`;
      return;
    }
    if (c.t === 6) { game.message = `Key ${c.n} opens gate ${c.n}.`; return; }
    if (c.t === 7) { game.message = 'A riddle is written on the wall (riddles are not playable yet).'; return; }
    game.message = '';
  }

  // turn: 0..3 from the way the player faces, or 'u' / 'd' for the stairs
  function walk(turn) {
    const dk = typeof turn === 'number' ? turned(game?.facing ?? 'n', turn) : turn;
    if (!game || game.won) return;
    const d = DIRS.find(d => d.key === dk), m = state.maze, p = game.pos;
    const c = cellAt(m, p.x, p.y, p.z), q = { x: p.x + d.dx, y: p.y + d.dy, z: p.z + d.dz };
    const next = cellAt(m, q.x, q.y, q.z);
    if (!(c.o & d.bit)) { game.message = d.dz ? `There are no stairs ${d.name.toLowerCase()} here.` : `A wall ${['ahead', 'to the right', 'behind you', 'to the left'][turn]}.`; return render(); }
    if (!next) { game.message = 'That way leads out of the maze, but it is not the exit.'; return render(); }
    if (next.t === 6 && !game.keys.has(next.n)) { game.message = `Gate ${next.n} is locked: find key ${next.n} first.`; return render(); }
    game.pos = q;
    if (!d.dz) game.facing = dk;
    game.path.push(q);
    game.steps++;
    enter(q);
    render();
  }

  // ---- drawing ----------------------------------------------------------------------------------

  function render() {
    const m = state.maze;
    empty.hidden = !!game;
    screen.hidden = !game;
    staleNote.hidden = !stale;
    if (!game) { status.textContent = 'No start in the maze.'; iso.redraw(); return; }
    const p = game.pos, c = cellAt(m, p.x, p.y, p.z) ?? { o: 0, t: 0 };
    const src = c.t === 2 ? PICTURES.exit : c.o & (U | D) ? PICTURES.stairs : PICTURES.corridor;
    if (!pic.src.endsWith(src)) pic.src = src;
    // the arrows as the player sees them: up is forward, right is to the right ...
    ['n', 'e', 's', 'w'].forEach((slot, turn) => {
      const d = DIRS.find(d => d.key === turned(game.facing, turn));
      arrows[slot].classList.toggle('play-arrow--open', !!(c.o & d.bit));
    });
    for (const k of ['u', 'd']) arrows[k].classList.toggle('play-arrow--open', !!(c.o & DIRS.find(d => d.key === k).bit));
    msg.textContent = game.message.toUpperCase();
    where.textContent = `LEVEL ${p.z + 1}  X ${p.x}  Y ${p.y}  FACING ${NAMES[game.facing]}  STEPS ${game.steps}`;
    bag.replaceChildren(...(game.found.length ? game.found.map(f => h('span', { class: 'play-item', style: `--item: ${TYPES[f.t].color}`, 'data-tip': TYPES[f.t].name + (f.t === 5 ? ` ${f.n}` : '') },
      icon(TYPES[f.t].icon, 'msr--sm'), f.t === 5 ? String(f.n) : null)) : [h('span', { class: 'play-bag__empty' }, 'NOTHING FOUND YET')]));
    won.hidden = !game.won;
    won.replaceChildren(h('div', { class: 'play-won__title' }, 'YOU MADE IT!'), h('div', {}, `${game.steps} STEPS`), h('div', { class: 'play-won__hint' }, 'F1: PLAY AGAIN'));
    status.textContent = `Level ${p.z + 1} · cell ${p.x}, ${p.y} · facing ${NAMES[game.facing].toLowerCase()} · ${game.steps} step${game.steps === 1 ? '' : 's'} · ${game.won ? 'Mastered' : 'Exploring'}`;
    iso.redraw();
  }

  // the keys: only while the play view is open
  addEventListener('keydown', e => {
    if (document.body.dataset.view !== 'play' || document.querySelector('.md-dialog-scrim')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'F1') { e.preventDefault(); return restart(); }
    let dk = KEYS[e.key];
    if (e.shiftKey && e.key === 'ArrowUp') dk = 'u';
    if (e.shiftKey && e.key === 'ArrowDown') dk = 'd';
    if (dk === undefined) return;
    e.preventDefault();
    walk(dk);
  });

  // the maze edited while playing: the walk goes on where it can, Restart plays the new maze
  subscribe(kind => {
    if (kind !== 'maze') return;
    if (game) { stale = true; if (!cellAt(state.maze, game.pos.x, game.pos.y, game.pos.z)) game = null; }
    render();
  });

  return {
    // the view opened: a new game unless one is on its way
    show() { if (!game || stale && game.won) restart(); else render(); iso.redraw(); },
    restart,
  };
}
