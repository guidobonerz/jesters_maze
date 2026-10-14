// iso.js - the 3D view: every level of the maze stacked, the paths as blocks, the stairs as columns
// between the levels. Drag: turn and tilt, wheel: zoom, double click: back to the start view,
// click on a cell: the level editor goes there. The level shown in the editor is in full color,
// the others are faint (unless "all levels solid").

import { state, subscribe, setView } from './store.js';
import { U, TYPES } from './maze.js';

const HUES = [217, 160, 35, 280, 0, 190, 90, 320];

export function createIso(host) {
  const canvas = host.appendChild(document.createElement('canvas'));
  canvas.className = 'iso__canvas';
  const ctx = canvas.getContext('2d');
  const START = { yaw: -Math.PI / 6, pitch: .78, roll: 0, zoom: 1, spread: 2.2, panX: 0, panY: 0 };
  let view = { ...START }, solid = false;
  let hits = [];                     // the top faces drawn, for a click: { poly, x, y, z }

  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };

  function draw() {
    frame = 0;
    const dpr = devicePixelRatio || 1, w = host.clientWidth, hh = host.clientHeight;
    if (!w || !hh) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = hh + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const m = state.maze, dark = document.documentElement.dataset.theme === 'dark';
    const cx = m.width / 2, cy = m.depth / 2, cz = (m.levels - 1) * view.spread / 2;
    const cr = Math.cos(view.roll), sr = Math.sin(view.roll);
    const cos = Math.cos(view.yaw), sin = Math.sin(view.yaw), sp = Math.sin(view.pitch), cp = Math.cos(view.pitch);
    // the size: the maze's diagonal and its height fill the pane
    const diag = Math.hypot(m.width, m.depth);
    const scale = view.zoom * Math.min(w / (diag * 1.1), hh / (diag * sp * 1.1 + (m.levels - 1) * view.spread * cp + 2));
    const px = (X, Y, Z) => {
      const rx = (X - cx) * cos - (Y - cy) * sin, ry = (X - cx) * sin + (Y - cy) * cos;
      // the picture turned in its plane (roll: the twist of the SpaceMouse) around the middle
      const sx = rx * scale, sy = (ry * sp - (Z - cz) * cp) * scale;
      return [w / 2 + view.panX + sx * cr - sy * sr, hh / 2 + view.panY + sx * sr + sy * cr, ry * cp + (Z - cz) * sp];
    };
    const faceSeen = (nx, ny) => nx * sin + ny * cos > 0;

    // the frames of the levels, the floors under the paths
    for (let z = 0; z < m.levels; z++) {
      const Z = z * view.spread, a = z === state.level ? .9 : .35;
      const pts = [px(0, 0, Z), px(m.width, 0, Z), px(m.width, m.depth, Z), px(0, m.depth, Z)];
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.fillStyle = `hsla(${HUES[z % HUES.length]} 40% ${dark ? 30 : 60}% / ${z === state.level ? .12 : .05})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${HUES[z % HUES.length]} 50% ${dark ? 65 : 45}% / ${a})`;
      ctx.lineWidth = z === state.level ? 1.5 : 1;
      ctx.stroke();
    }

    // the blocks: the middle of a cell, an arm to each open side, a column up
    const boxes = [];
    const k = .22, hgt = .32;
    for (let z = 0; z < m.levels; z++) {
      const Z = z * view.spread, focus = solid || z === state.level;
      for (let y = 0; y < m.depth; y++) for (let x = 0; x < m.width; x++) {
        const c = m.cells[z][y][x];
        if (!c.o) continue;
        const a = .5 - k, b = .5 + k, base = { z, focus, cell: { x, y } };
        boxes.push({ ...base, b: [x + a, y + a, Z, x + b, y + b, Z + hgt], center: true, item: c.t });
        if (c.o & 1) boxes.push({ ...base, b: [x + a, y, Z, x + b, y + a, Z + hgt] });
        if (c.o & 2) boxes.push({ ...base, b: [x + a, y + b, Z, x + b, y + 1, Z + hgt] });
        if (c.o & 4) boxes.push({ ...base, b: [x, y + a, Z, x + a, y + b, Z + hgt] });
        if (c.o & 8) boxes.push({ ...base, b: [x + b, y + a, Z, x + 1, y + b, Z + hgt] });
        if ((c.o & U) && z + 1 < m.levels) {
          const s = .12;
          boxes.push({ ...base, stairs: true, b: [x + .5 - s, y + .5 - s, Z + hgt, x + .5 + s, y + .5 + s, Z + view.spread] });
        }
      }
    }
    for (const bx of boxes) {
      const [x0, y0, z0, x1, y1, z1] = bx.b;
      bx.depth = px((x0 + x1) / 2, (y0 + y1) / 2, bx.stairs ? z0 : (z0 + z1) / 2)[2];
    }
    boxes.sort((p, q) => p.depth - q.depth);

    hits = [];
    const sel = state.sel;
    for (const bx of boxes) {
      const [x0, y0, z0, x1, y1, z1] = bx.b;
      const hue = bx.stairs ? 24 : HUES[bx.z % HUES.length];
      const alpha = bx.focus ? 1 : .28;
      const isSel = bx.focus && sel && bx.z === state.level && bx.cell.x === sel.x && bx.cell.y === sel.y;
      const L = dark ? 62 : 52;
      const shade = (dl, sat = 55) => isSel ? `hsla(217 91% ${60 + dl / 2}% / ${alpha})` : `hsla(${hue} ${sat}% ${L + dl}% / ${alpha})`;
      const quad = (pts, fill) => {
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        if (bx.focus) { ctx.strokeStyle = `hsla(${hue} 40% ${dark ? 20 : 30}% / .35)`; ctx.lineWidth = .6; ctx.stroke(); }
        return pts;
      };
      if (faceSeen(0, -1)) quad([px(x0, y0, z0), px(x1, y0, z0), px(x1, y0, z1), px(x0, y0, z1)], shade(-14));
      if (faceSeen(0, 1)) quad([px(x0, y1, z0), px(x1, y1, z0), px(x1, y1, z1), px(x0, y1, z1)], shade(-14));
      if (faceSeen(-1, 0)) quad([px(x0, y0, z0), px(x0, y1, z0), px(x0, y1, z1), px(x0, y0, z1)], shade(-24));
      if (faceSeen(1, 0)) quad([px(x1, y0, z0), px(x1, y1, z0), px(x1, y1, z1), px(x1, y0, z1)], shade(-24));
      const top = quad([px(x0, y0, z1), px(x1, y0, z1), px(x1, y1, z1), px(x0, y1, z1)], shade(8));
      if (bx.center) hits.push({ poly: top, x: bx.cell.x, y: bx.cell.y, z: bx.z });
      if (bx.center && bx.item) {
        const [ix, iy] = px((x0 + x1) / 2, (y0 + y1) / 2, z1 + .25);
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(ix, iy, Math.max(3, scale * .2), 0, Math.PI * 2);
        ctx.fillStyle = TYPES[bx.item].color; ctx.fill();
        ctx.strokeStyle = dark ? '#09090b' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // the numbers of the levels at their corner
    ctx.font = '600 12px Geist, system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let z = 0; z < m.levels; z++) {
      const corners = [[0, 0], [m.width, 0], [m.width, m.depth], [0, m.depth]].map(([x, y]) => px(x, y, z * view.spread));
      const left = corners.reduce((p, q) => (q[0] < p[0] ? q : p));
      ctx.fillStyle = `hsla(${HUES[z % HUES.length]} 50% ${dark ? 65 : 40}% / ${z === state.level ? 1 : .6})`;
      ctx.fillText(`L${z + 1}`, left[0] - 8, left[1]);
    }
  }

  // ---- the pointer ------------------------------------------------------------------------------

  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    drag = { sx: e.clientX, sy: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false };
    host.classList.add('iso--turning');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    view.yaw = drag.yaw + dx * .008;
    view.pitch = Math.max(.15, Math.min(Math.PI / 2 - .01, drag.pitch + dy * .006));
    redraw();
  });
  const up = e => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    host.classList.remove('iso--turning');
    if (moved) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = hits.length - 1; i >= 0; i--) {
      if (inPoly(x, y, hits[i].poly)) return setView({ level: hits[i].z, sel: { x: hits[i].x, y: hits[i].y } });
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { drag = null; host.classList.remove('iso--turning'); });
  canvas.addEventListener('dblclick', () => { view = { ...START }; redraw(); });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    view.zoom = Math.max(.3, Math.min(6, view.zoom * Math.exp(-e.deltaY * .0015)));
    redraw();
  }, { passive: false });

  new ResizeObserver(redraw).observe(host);
  subscribe(redraw);
  redraw();
  return {
    redraw,
    turn: a => { view.yaw += a; redraw(); },
    reset: () => { view = { ...START }; redraw(); },
    // the SpaceMouse (spacemouse.js): turn, tilt, zoom and move in small steps
    move: ({ yaw = 0, pitch = 0, roll = 0, zoom = 1, panX = 0, panY = 0 }) => {
      view.yaw += yaw;
      view.roll += roll;
      view.pitch = Math.max(.15, Math.min(Math.PI / 2 - .01, view.pitch + pitch));
      view.zoom = Math.max(.3, Math.min(6, view.zoom * zoom));
      view.panX += panX; view.panY += panY;
      redraw();
    },
    spread: f => { view.spread = Math.max(1, Math.min(6, view.spread * f)); redraw(); },
    toggleSolid: () => { solid = !solid; redraw(); return solid; },
  };
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
