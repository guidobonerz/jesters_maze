// maze.js - the model of a three dimensional maze and its formats.
//
// A maze is width x depth cells on each of its levels. Row 0 is the north edge, level 0 the lowest.
// Every cell holds its openings as the bits the game server sends to the C64 (src/server/mazeserver.go,
// routeElement: DUEWSN), the type of what lies there and a number (of a key and its gate).
// In the server's source a cell is a code of four characters: AABC
//   A = the shape of the paths on the level (the openings N S W E), see SHAPES
//   A = the second one: the stairs (X none, U up, D down, B both)
//   B = the type (TYPES), C = the number

export const N = 1, S = 2, W = 4, E = 8, U = 16, D = 32;
export const DIRS = [
  { bit: N, key: 'n', name: 'North', dx: 0, dy: -1, dz: 0, back: S },
  { bit: S, key: 's', name: 'South', dx: 0, dy: 1, dz: 0, back: N },
  { bit: W, key: 'w', name: 'West', dx: -1, dy: 0, dz: 0, back: E },
  { bit: E, key: 'e', name: 'East', dx: 1, dy: 0, dz: 0, back: W },
  { bit: U, key: 'u', name: 'Up', dx: 0, dy: 0, dz: 1, back: D },
  { bit: D, key: 'd', name: 'Down', dx: 0, dy: 0, dz: -1, back: U },
];
export const dirOf = bit => DIRS.find(d => d.bit === bit);

// the shape letter of the openings on the level (mazeserver.go: routeElement)
const SHAPES = {
  X: 0, A: N | S, B: W | E, C: N | S | W | E, D: E | S, E: W | S, F: E | N, G: W | N,
  H: E | W | N, I: E | W | S, J: W | S | N, K: E | S | N, L: S, M: N, N: E, O: W,
};
const SHAPE_OF = Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [v, k]));
const VERTICAL = { X: 0, U: U, D: D, B: U | D };
const VERTICAL_OF = Object.fromEntries(Object.entries(VERTICAL).map(([k, v]) => [v, k]));

export const TYPES = [
  { id: 0, name: 'Nothing', icon: 'la-circle', glyph: '' },
  { id: 1, name: 'Start', icon: 'la-play', glyph: '', color: '#16a34a', unique: true },
  { id: 2, name: 'Exit', icon: 'la-flag-checkered', glyph: '', color: '#dc2626' },
  { id: 3, name: 'Treasure', icon: 'la-gem', glyph: '', color: '#d97706' },
  { id: 4, name: 'Lamp oil', icon: 'la-oil-can', glyph: '', color: '#0891b2' },
  { id: 5, name: 'Key', icon: 'la-key', glyph: '', color: '#ca8a04', numbered: true },
  { id: 6, name: 'Gate', icon: 'la-dungeon', glyph: '', color: '#7c3aed', numbered: true },
  { id: 7, name: 'Riddle', icon: 'la-question', glyph: '', color: '#db2777' },
];

export const LIMITS = { size: 64, levels: 16 };

export function emptyCell() { return { o: 0, t: 0, n: 0 }; }

export function createMaze({ name = 'maze', width = 20, depth = 20, levels = 3 } = {}) {
  const cells = [];
  for (let z = 0; z < levels; z++) {
    const level = [];
    for (let y = 0; y < depth; y++) level.push(Array.from({ length: width }, emptyCell));
    cells.push(level);
  }
  return { name, width, depth, levels, cells };
}

export const inside = (m, x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < m.width && y < m.depth && z < m.levels;
export const cellAt = (m, x, y, z) => (inside(m, x, y, z) ? m.cells[z][y][x] : null);

// ---- the code of a cell (AABC) ------------------------------------------------------------------

export function cellCode(c) {
  return (SHAPE_OF[c.o & 15] ?? 'X') + (VERTICAL_OF[c.o & (U | D)] ?? 'X') + (c.t & 7) + (c.n % 10);
}

// a code to a cell; what it does not know goes to the warnings, the cell keeps the rest
export function parseCode(code, warn = () => {}) {
  const c = emptyCell();
  if (typeof code !== 'string' || code.length < 2) { warn(`not a cell code: ${JSON.stringify(code)}`); return c; }
  const shape = SHAPES[code[0]];
  if (shape === undefined) warn(`unknown shape '${code[0]}' in "${code}"`); else c.o |= shape;
  const vert = VERTICAL[code[1]];
  if (vert === undefined) warn(`unknown stairs '${code[1]}' in "${code}" - read as X`); else c.o |= vert;
  const t = Number(code[2] ?? 0), n = Number(code[3] ?? 0);
  if (!(t >= 0 && t <= 7)) warn(`unknown type '${code[2]}' in "${code}"`); else c.t = t;
  if (!(n >= 0 && n <= 9)) warn(`unknown number '${code[3]}' in "${code}"`); else c.n = n;
  return c;
}

// ---- editing: every passage is opened and closed on both of its sides --------------------------

// (the start and the exit may open to the outside on the level: the doors of the maze)
export const isDoor = c => c.t === 1 || c.t === 2;
export function canOpen(m, x, y, z, bit) {
  const a = cellAt(m, x, y, z), d = dirOf(bit);
  return !!a && (!!cellAt(m, x + d.dx, y + d.dy, z + d.dz) || (!d.dz && isDoor(a)));
}
export function setPassage(m, x, y, z, bit, open) {
  const a = cellAt(m, x, y, z), d = dirOf(bit);
  const b = cellAt(m, x + d.dx, y + d.dy, z + d.dz);
  if (!a || (!b && open && !canOpen(m, x, y, z, bit))) return false;
  const before = a.o;
  if (open) { a.o |= bit; if (b) b.o |= d.back; } else { a.o &= ~bit; if (b) b.o &= ~d.back; }
  return a.o !== before;
}

export function clearCell(m, x, y, z) {
  const c = cellAt(m, x, y, z);
  if (!c) return;
  for (const d of DIRS) if (c.o & d.bit) setPassage(m, x, y, z, d.bit, false);
  c.o = 0; c.t = 0; c.n = 0;
}

// the direction from one cell to its neighbour on the level, or 0
export function stepBit(ax, ay, bx, by) {
  const d = DIRS.find(d => d.dz === 0 && ax + d.dx === bx && ay + d.dy === by);
  return d ? d.bit : 0;
}

export function resizeMaze(m, width, depth, levels) {
  const out = createMaze({ name: m.name, width, depth, levels });
  for (let z = 0; z < levels; z++) for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    const c = cellAt(m, x, y, z);
    if (c) out.cells[z][y][x] = { ...c };
  }
  // passages into what was cut off are closed (a door to the outside stays)
  for (let z = 0; z < levels; z++) for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    const c = out.cells[z][y][x];
    for (const d of DIRS) {
      const nx = x + d.dx, ny = y + d.dy, nz = z + d.dz;
      if ((c.o & d.bit) && !inside(out, nx, ny, nz) && inside(m, nx, ny, nz)) c.o &= ~d.bit;
    }
  }
  return out;
}

export function cloneMaze(m) {
  return { ...m, cells: m.cells.map(l => l.map(r => r.map(c => ({ ...c })))) };
}

// ---- formats ------------------------------------------------------------------------------------

export function toJSON(m) {
  return {
    format: 'jesters-maze', version: 1,
    name: m.name, width: m.width, depth: m.depth, levels: m.levels,
    cells: m.cells.map(l => l.map(r => r.map(cellCode))),
  };
}

export function fromJSON(j, warnings = []) {
  if (!j || !Array.isArray(j.cells)) throw new Error('This is not a maze: the cells are missing.');
  return fromCodes(j.cells, j.name ?? 'maze', warnings);
}

// levels of rows of codes to a maze; ragged rows are filled up with empty cells
function fromCodes(codes, name, warnings) {
  const levels = codes.length;
  const depth = Math.max(0, ...codes.map(l => l.length));
  const width = Math.max(0, ...codes.flatMap(l => l.map(r => r.length)));
  if (!levels || !depth || !width) throw new Error('The maze is empty.');
  if (width > LIMITS.size || depth > LIMITS.size || levels > LIMITS.levels)
    throw new Error(`The maze is too large (${width} x ${depth} x ${levels}).`);
  const m = createMaze({ name, width, depth, levels });
  codes.forEach((l, z) => l.forEach((r, y) => r.forEach((code, x) => {
    m.cells[z][y][x] = parseCode(code, w => warnings.push(`Level ${z + 1}, row ${y}, column ${x}: ${w}`));
  })));
  return m;
}

// the Go source of the game server: var <name> = [][][]string{ {level 0 rows}, {level 1 rows}, ... }
export function toGo(m) {
  const ident = goIdent(m.name);
  const lines = [
    `// ${m.name}: ${m.width} x ${m.depth} cells, ${m.levels} level${m.levels === 1 ? '' : 's'} - made with the Jester's Maze editor`,
    `var mazeWidth = ${m.width}`,
    `var mazeDepth = ${m.depth}`,
    `var mazeHeight = ${m.levels}`,
    `var ${ident} = [][][]string{`,
  ];
  m.cells.forEach((level, z) => {
    lines.push(`\t// level ${z}`);
    lines.push('\t{');
    level.forEach(row => lines.push(`\t\t{${row.map(c => `"${cellCode(c)}"`).join(', ')}},`));
    lines.push('\t},');
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

export function goIdent(name) {
  let s = String(name || 'maze').replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(s)) s = 'maze_' + s;
  return s;
}

// reads the first [][][]string literal of a Go source (the maze of mazeserver.go, or one made here)
export function fromGo(src, warnings = []) {
  const at = src.search(/\[\]\[\]\[\]string\s*\{/);
  if (at < 0) throw new Error('No [][][]string literal found in the Go source.');
  const nameMatch = /(\w+)\s*(?::=|=)\s*$/.exec(src.slice(0, at));
  let i = src.indexOf('{', at);
  const skip = () => {
    for (;;) {
      while (i < src.length && /[\s,]/.test(src[i])) i++;
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      return;
    }
  };
  const list = () => {
    if (src[i] !== '{') throw new Error(`'{' expected at offset ${i}.`);
    i++;
    const out = [];
    for (;;) {
      skip();
      if (i >= src.length) throw new Error('The literal ends too early.');
      if (src[i] === '}') { i++; return out; }
      if (src[i] === '{') out.push(list());
      else if (src[i] === '"') {
        const e = src.indexOf('"', i + 1);
        if (e < 0) throw new Error('A string is not closed.');
        out.push(src.slice(i + 1, e));
        i = e + 1;
      } else throw new Error(`Unexpected '${src[i]}' at offset ${i}.`);
    }
  };
  const codes = list();
  if (!codes.every(l => Array.isArray(l) && l.every(r => Array.isArray(r))))
    throw new Error('The literal is not a list of levels of rows.');
  return fromCodes(codes, nameMatch ? nameMatch[1] : 'maze', warnings);
}

// a text of either format
export function parseAny(text, warnings = []) {
  const t = text.trim();
  if (t.startsWith('{') && /"cells"\s*:/.test(t)) return fromJSON(JSON.parse(t), warnings);
  return fromGo(text, warnings);
}

// ---- checks -------------------------------------------------------------------------------------

// what is wrong in the maze: { level: 'error' | 'warning', text, at: {x, y, z} }
export function validate(m) {
  const out = [];
  const add = (level, text, at) => out.push({ level, text, at });
  const starts = [], exits = [], keys = new Map(), gates = new Map();
  for (let z = 0; z < m.levels; z++) for (let y = 0; y < m.depth; y++) for (let x = 0; x < m.width; x++) {
    const c = m.cells[z][y][x], at = { x, y, z };
    for (const d of DIRS) {
      if (!(c.o & d.bit)) continue;
      const nb = cellAt(m, x + d.dx, y + d.dy, z + d.dz);
      if (!nb) { if (d.dz || !isDoor(c)) add('warning', `${d.name} leads out of the maze`, at); }
      else if (!(nb.o & d.back)) add('warning', `One-way passage ${d.name.toLowerCase()}: the neighbour has no way back`, at);
    }
    if (c.t && !c.o) add('warning', `${TYPES[c.t].name} in a cell without any passage`, at);
    if (c.t === 1) starts.push(at);
    if (c.t === 2) exits.push(at);
    if (c.t === 5) keys.set(c.n, [...(keys.get(c.n) ?? []), at]);
    if (c.t === 6) gates.set(c.n, [...(gates.get(c.n) ?? []), at]);
  }
  if (!starts.length) add('error', 'The maze has no start', null);
  starts.slice(1).forEach(at => add('error', 'A second start: the server takes the first one only', at));
  if (!exits.length) add('error', 'The maze has no exit', null);
  for (const [n, at] of gates) if (!keys.has(n)) at.forEach(a => add('warning', `Gate ${n} has no key ${n}`, a));
  for (const [n, at] of keys) if (!gates.has(n)) at.forEach(a => add('warning', `Key ${n} opens no gate`, a));

  if (starts.length) {
    const seen = reach(m, starts[0]);
    exits.forEach(at => { if (!seen.has(key(at))) add('error', 'The exit cannot be reached from the start', at); });
    let lost = 0, first = null;
    for (let z = 0; z < m.levels; z++) for (let y = 0; y < m.depth; y++) for (let x = 0; x < m.width; x++)
      if (m.cells[z][y][x].o && !seen.has(key({ x, y, z }))) { lost++; first ??= { x, y, z }; }
    if (lost) add('warning', `${lost} cell${lost === 1 ? '' : 's'} with passages cannot be reached from the start`, first);
  }
  return out;
}

const key = p => `${p.x},${p.y},${p.z}`;

export function reach(m, from) {
  const seen = new Set([key(from)]), queue = [from];
  while (queue.length) {
    const p = queue.shift(), c = m.cells[p.z][p.y][p.x];
    for (const d of DIRS) {
      if (!(c.o & d.bit)) continue;
      const q = { x: p.x + d.dx, y: p.y + d.dy, z: p.z + d.dz };
      if (!inside(m, q.x, q.y, q.z) || seen.has(key(q))) continue;
      seen.add(key(q));
      queue.push(q);
    }
  }
  return seen;
}

export function stats(m) {
  let open = 0, stairs = 0;
  const items = new Array(TYPES.length).fill(0);
  for (const l of m.cells) for (const r of l) for (const c of r) {
    if (c.o) open++;
    if (c.o & U) stairs++;
    items[c.t]++;
  }
  return { open, stairs, items };
}
