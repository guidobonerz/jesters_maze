// grid.js - the level editor: one level of the maze from above, its cells as the paths of the game's
// tiles (│ ─ ┌ ...), the level below faint behind it. The tools of the toolbar draw on it:
//   select  click: the cell to the inspector, drag: pan
//   carve   drag from cell to cell: opens the passages between them; click near an edge: toggles it
//   wall    drag from cell to cell: closes the passages between them; click near an edge: toggles it
//   erase   drag: clears the cells (passages, stairs, items)
//   stairs  click: toggles the stairs up (Shift: down)
//   item    click: puts the item of the toolbar there (again: takes it away)
// Right or middle button, or Space held: pan. Wheel: scroll, Ctrl+wheel: zoom.

import { state, subscribe, change, beginStroke, endStroke, setView } from './store.js';
import { DIRS, U, D, TYPES, canOpen, setPassage, clearCell, stepBit } from './maze.js';

const BASE = 36;          // the size of a cell at zoom 1
const MARGIN = 28;        // room for the coordinates

export function createGrid(host) {
  const canvas = host.appendChild(document.createElement('canvas'));
  canvas.className = 'grid__canvas';
  const ctx = canvas.getContext('2d');
  let zoom = 1, ox = MARGIN + 16, oy = MARGIN + 16, fitted = false;
  let hover = null;                 // { x, y, edge }
  let drag = null;                  // what the pointer does while it is down
  let spaceDown = false;

  const cs = () => BASE * zoom;
  const colors = () => {
    const s = getComputedStyle(document.documentElement);
    const v = n => s.getPropertyValue(n).trim();
    const dark = document.documentElement.dataset.theme === 'dark';
    return {
      path: dark ? '#d4d4d8' : '#3f3f46',
      ghost: dark ? 'rgba(161,161,170,.18)' : 'rgba(113,113,122,.16)',
      floor: v('--md-sys-color-surface'),
      line: v('--md-sys-color-outline-variant'),
      frame: v('--md-sys-color-outline'),
      text: v('--md-sys-color-on-surface-variant'),
      sel: v('--field-label-float'),
      hover: dark ? 'rgba(250,250,250,.07)' : 'rgba(9,9,11,.05)',
      error: v('--md-sys-color-error'),
      stairs: dark ? '#fb923c' : '#c2410c',
      onPath: dark ? '#18181b' : '#fafafa',
    };
  };

  // ---- drawing ----------------------------------------------------------------------------------

  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };

  function draw() {
    frame = 0;
    const dpr = devicePixelRatio || 1, w = host.clientWidth, hh = host.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = hh + 'px';
    }
    if (!fitted && w > 0) { fitted = true; fit(false); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const m = state.maze, z = state.level, c = colors(), s = cs();
    const W = m.width * s, H = m.depth * s;

    // the floor of the level and its grid
    ctx.fillStyle = c.floor;
    ctx.fillRect(ox, oy, W, H);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < m.width; x++) { const px = Math.round(ox + x * s) + .5; ctx.moveTo(px, oy); ctx.lineTo(px, oy + H); }
    for (let y = 1; y < m.depth; y++) { const py = Math.round(oy + y * s) + .5; ctx.moveTo(ox, py); ctx.lineTo(ox + W, py); }
    ctx.stroke();

    // the level below, faint
    if (state.settings.ghost && z > 0) drawPaths(m.cells[z - 1], c.ghost, s, .5);
    if (hover && !drag && state.tool !== 'select') {
      ctx.fillStyle = c.hover;
      ctx.fillRect(ox + hover.x * s, oy + hover.y * s, s, s);
    }
    drawPaths(m.cells[z], c.path, s, .44);

    // stairs, items, numbers
    const problemCells = new Set(state.problems.filter(p => p.at && p.at.z === z && p.level === 'error').map(p => `${p.at.x},${p.at.y}`));
    for (let y = 0; y < m.depth; y++) for (let x = 0; x < m.width; x++) {
      const cell = m.cells[z][y][x], px = ox + x * s, py = oy + y * s;
      if (cell.o & (U | D)) {
        const g = (cell.o & U) && (cell.o & D) ? '' : cell.o & U ? '' : '';
        glyph(g, px + s * .78, py + s * .24, s * .3, c.stairs);
      }
      if (cell.t) {
        const t = TYPES[cell.t];
        ctx.fillStyle = c.floor;
        ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, s * .3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = t.color; ctx.lineWidth = Math.max(1, s * .05); ctx.stroke();
        glyph(t.glyph, px + s / 2, py + s / 2, s * .32, t.color);
        if (t.numbered || cell.n) {
          ctx.font = `600 ${Math.max(8, s * .24)}px Geist, system-ui, sans-serif`;
          ctx.fillStyle = t.color; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(String(cell.n), px + s - 3, py + s - 3);
        }
      }
      if (problemCells.has(`${x},${y}`)) {
        ctx.fillStyle = c.error;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s * .26, py); ctx.lineTo(px, py + s * .26); ctx.fill();
      }
    }

    // the edge a click would toggle
    if (hover?.edge && !drag && (state.tool === 'carve' || state.tool === 'wall')) {
      const d = DIRS.find(d => d.bit === hover.edge), px = ox + hover.x * s, py = oy + hover.y * s;
      ctx.strokeStyle = c.sel; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      if (d.dy) { const ey = py + (d.dy > 0 ? s : 0); ctx.moveTo(px + 4, ey); ctx.lineTo(px + s - 4, ey); }
      else { const ex = px + (d.dx > 0 ? s : 0); ctx.moveTo(ex, py + 4); ctx.lineTo(ex, py + s - 4); }
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // the frame, the selection
    ctx.strokeStyle = c.frame; ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, W, H);
    if (state.sel) {
      ctx.strokeStyle = c.sel; ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + state.sel.x * s + 1.5, oy + state.sel.y * s + 1.5, s - 3, s - 3);
    }

    // the coordinates (x: the columns, y: the rows - as the server counts them)
    if (state.settings.coords) {
      ctx.fillStyle = c.text;
      ctx.font = `500 ${Math.min(12, Math.max(9, s * .3))}px Geist, system-ui, sans-serif`;
      const every = s < 18 ? 5 : s < 26 ? 2 : 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (let x = 0; x < m.width; x += every) ctx.fillText(x, ox + x * s + s / 2, oy - 6);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = 0; y < m.depth; y += every) ctx.fillText(y, ox - 8, oy + y * s + s / 2);
    }
  }

  // the paths of a level: a square in the middle of each open cell, a bar to each open side
  function drawPaths(level, color, s, k) {
    // on whole pixels, the arms a little into the neighbour: no seams between the cells
    const p = Math.round(s * k), inset = Math.round((s - p) / 2), arm = inset + 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    level.forEach((row, y) => row.forEach((cell, x) => {
      if (!cell.o) return;
      const px = Math.round(ox + x * s), py = Math.round(oy + y * s), q = Math.round(ox + (x + 1) * s) - px;
      ctx.rect(px + inset, py + inset, p, p);
      if (cell.o & 1) ctx.rect(px + inset, py - 1, p, arm);                // N
      if (cell.o & 2) ctx.rect(px + inset, py + inset + p, p, q - inset - p + 1);  // S
      if (cell.o & 4) ctx.rect(px - 1, py + inset, arm, p);                // W
      if (cell.o & 8) ctx.rect(px + inset + p, py + inset, q - inset - p + 1, p);  // E
    }));
    ctx.fill('nonzero');
  }

  function glyph(ch, x, y, size, color) {
    if (!ch) return;
    ctx.font = `900 ${size}px "Line Awesome Free"`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
  }

  // ---- the view ---------------------------------------------------------------------------------

  function fit(animate = true) {
    const m = state.maze, w = host.clientWidth, hh = host.clientHeight;
    if (!w || !hh) return;
    const pad = MARGIN + 24;
    zoom = Math.max(.25, Math.min(3, Math.min((w - pad * 2) / (m.width * BASE), (hh - pad * 2) / (m.depth * BASE))));
    ox = Math.round((w - m.width * cs()) / 2 + MARGIN / 2);
    oy = Math.round((hh - m.depth * cs()) / 2 + MARGIN / 2);
    if (animate) redraw();
  }
  function zoomAt(f, px = host.clientWidth / 2, py = host.clientHeight / 2) {
    const nz = Math.max(.25, Math.min(4, zoom * f));
    ox = px - (px - ox) * nz / zoom;
    oy = py - (py - oy) * nz / zoom;
    zoom = nz;
    redraw();
  }

  // ---- the pointer ------------------------------------------------------------------------------

  function hit(e) {
    const r = canvas.getBoundingClientRect(), s = cs();
    const fx = (e.clientX - r.left - ox) / s, fy = (e.clientY - r.top - oy) / s;
    const x = Math.floor(fx), y = Math.floor(fy);
    if (x < 0 || y < 0 || x >= state.maze.width || y >= state.maze.depth) return null;
    const ux = fx - x, uy = fy - y;
    // near an edge (a quarter of the cell): the passage there
    const near = [[uy, 1], [1 - uy, 2], [ux, 4], [1 - ux, 8]].sort((a, b) => a[0] - b[0])[0];
    let edge = near[0] < .25 ? near[1] : 0;
    if (edge && !canOpen(state.maze, x, y, state.level, edge) && !(state.maze.cells[state.level][y][x].o & edge)) edge = 0;
    return { x, y, edge };
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = hit(e);
    if (e.button === 1 || e.button === 2 || spaceDown || (state.tool === 'select' && !p)) {
      drag = { pan: true, sx: e.clientX, sy: e.clientY, ox, oy };
      host.classList.add('grid--panning');
      return;
    }
    if (e.button !== 0 || !p) return;
    const z = state.level, tool = state.tool;
    if (tool === 'select') {
      setView({ sel: { x: p.x, y: p.y } });
      drag = { pan: true, sx: e.clientX, sy: e.clientY, ox, oy, moved: false };
      return;
    }
    beginStroke();
    drag = { tool, last: p, start: p, moved: false };
    if (tool === 'erase') change(m => { if (!m.cells[z][p.y][p.x].o && !m.cells[z][p.y][p.x].t) return false; clearCell(m, p.x, p.y, z); });
    if (tool === 'stairs') {
      const bit = e.shiftKey ? D : U;
      change(m => setPassage(m, p.x, p.y, z, bit, !(m.cells[z][p.y][p.x].o & bit)) || false);
    }
    if (tool === 'item') placeItem(p);
    setView({ sel: { x: p.x, y: p.y } });
  });

  canvas.addEventListener('pointermove', e => {
    const p = hit(e);
    if (!drag) {
      if (p?.x !== hover?.x || p?.y !== hover?.y || p?.edge !== hover?.edge) { hover = p; redraw(); }
      return;
    }
    if (drag.pan) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) drag.moved = true;
      ox = drag.ox + e.clientX - drag.sx; oy = drag.oy + e.clientY - drag.sy;
      return redraw();
    }
    if (!p || (p.x === drag.last.x && p.y === drag.last.y)) return;
    drag.moved = true;
    const z = state.level;
    // from the last cell to this one, a step at a time (a fast pointer skips cells)
    let { x, y } = drag.last;
    while (x !== p.x || y !== p.y) {
      const nx = x + Math.sign(p.x - x) * (Math.abs(p.x - x) >= Math.abs(p.y - y) ? 1 : 0);
      const ny = nx === x ? y + Math.sign(p.y - y) : y;
      const bit = stepBit(x, y, nx, ny);
      const fx = x, fy = y;
      if (drag.tool === 'carve') change(m => setPassage(m, fx, fy, z, bit, true) || false);
      if (drag.tool === 'wall') change(m => setPassage(m, fx, fy, z, bit, false) || false);
      if (drag.tool === 'erase') change(m => { const c = m.cells[z][ny][nx]; if (!c.o && !c.t) return false; clearCell(m, nx, ny, z); });
      x = nx; y = ny;
    }
    drag.last = p;
    if (drag.tool === 'carve' || drag.tool === 'wall' || drag.tool === 'erase') setView({ sel: { x: p.x, y: p.y } });
  });

  const up = e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    host.classList.remove('grid--panning');
    // a click near an edge toggles the passage there
    if (!d.pan && !d.moved && (d.tool === 'carve' || d.tool === 'wall') && d.start.edge) {
      const { x, y, edge } = d.start, z = state.level;
      change(m => setPassage(m, x, y, z, edge, !(m.cells[z][y][x].o & edge)) || false);
    }
    endStroke();
    redraw();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (!drag) { hover = null; redraw(); } });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top);
    } else {
      ox -= e.shiftKey ? e.deltaY : e.deltaX;
      oy -= e.shiftKey ? 0 : e.deltaY;
      redraw();
    }
  }, { passive: false });

  addEventListener('keydown', e => { if (e.code === 'Space' && !isTyping(e)) { spaceDown = true; host.classList.add('grid--pan-ready'); } });
  addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; host.classList.remove('grid--pan-ready'); } });

  function placeItem(p) {
    const z = state.level, t = state.item, n = state.itemNo;
    change(m => {
      const c = m.cells[z][p.y][p.x];
      if (c.t === t && c.n === n) { c.t = 0; c.n = 0; return; }
      // one start only: the old one goes
      if (TYPES[t].unique) for (const l of m.cells) for (const r of l) for (const o of r) if (o.t === t) { o.t = 0; o.n = 0; }
      c.t = t; c.n = n;
    });
  }

  new ResizeObserver(redraw).observe(host);
  subscribe(redraw);
  document.fonts?.ready.then(redraw);
  redraw();
  return {
    redraw, fit, zoomIn: () => zoomAt(1.25), zoomOut: () => zoomAt(.8), refit: () => { fitted = false; redraw(); },
    // the SpaceMouse (spacemouse.js): move and zoom in small steps
    move: ({ panX = 0, panY = 0, zoom = 1 }) => { ox += panX; oy += panY; if (zoom !== 1) zoomAt(zoom); else redraw(); },
  };
}

export const isTyping = e => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
