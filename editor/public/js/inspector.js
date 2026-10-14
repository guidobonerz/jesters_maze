// inspector.js - the side sheet: the selected cell (its passages, stairs and item), the maze (name,
// size, numbers) and the problems of the maze

import { state, subscribe, change, setView, setMaze } from './store.js';
import { DIRS, TYPES, LIMITS, U, D, cellAt, canOpen, cellCode, setPassage, clearCell, resizeMaze, stats } from './maze.js';
import { h, icon, field, dialog } from './ui.js';

export function createInspector(host) {
  const collapsed = new Set(JSON.parse(localStorage.getItem('jm-collapsed') ?? '[]'));

  function section(id, title, ...body) {
    const sec = h('section', { class: `section section--collapsible${collapsed.has(id) ? ' section--collapsed' : ''}` },
      h('div', { class: 'section__head', onclick: () => {
        sec.classList.toggle('section--collapsed');
        sec.classList.contains('section--collapsed') ? collapsed.add(id) : collapsed.delete(id);
        localStorage.setItem('jm-collapsed', JSON.stringify([...collapsed]));
      } }, h('span', { class: 'section__title' }, title), icon('la-angle-down', 'section__chevron')),
      ...body);
    return sec;
  }

  function render() {
    // keep the focus in a field across a render (the name while typing)
    const focusId = document.activeElement?.id;
    const scroll = host.querySelector('.sheet__body')?.scrollTop ?? 0;
    const m = state.maze, z = state.level, sel = state.sel, cell = sel && cellAt(m, sel.x, sel.y, z);
    host.replaceChildren(
      h('div', { class: 'sheet__head' },
        h('div', { class: 'sheet__icon' }, icon(cell ? 'la-vector-square' : 'la-cube')),
        h('div', { class: 'sheet__titles' },
          h('span', { class: 'sheet__title' }, cell ? `Cell ${sel.x}, ${sel.y}` : m.name),
          h('span', { class: 'sheet__subtitle' }, cell
            ? `Level ${z + 1} · code ${cellCode(cell)}`
            : `${m.width} × ${m.depth} cells · ${m.levels} level${m.levels === 1 ? '' : 's'}`)),
        cell ? h('button', { class: 'md-icon-button', 'data-tip': 'Deselect (Esc)', onclick: () => setView({ sel: null }) }, icon('la-times')) : null),
      h('div', { class: 'sheet__body' },
        cell ? cellSections(cell, sel.x, sel.y, z) : null,
        mazeSection(),
        problemsSection()));
    host.querySelector('.sheet__body').scrollTop = scroll;
    if (focusId) document.getElementById(focusId)?.focus();
  }

  function cellSections(cell, x, y, z) {
    const m = state.maze;
    const dirButton = d => {
      const can = canOpen(m, x, y, z, d.bit), on = !!(cell.o & d.bit);
      return h('button', {
        class: `compass__btn compass__btn--${d.key}${on ? ' compass__btn--on' : ''}`,
        disabled: !can && !on,
        'aria-pressed': String(on),
        'data-tip': `${d.name}: ${on ? 'open' : 'closed'}${cellAt(m, x + d.dx, y + d.dy, z) ? '' : can ? ' (a door to the outside)' : ' (edge of the maze)'} - Shift+${{ n: '↑', s: '↓', w: '←', e: '→', u: 'PgUp', d: 'PgDn' }[d.key]}`,
        onclick: () => change(mm => setPassage(mm, x, y, z, d.bit, !on) || false),
      }, d.name[0]);
    };
    const t = TYPES[cell.t];
    return [
      section('passages', 'Passages',
        h('div', { class: 'compass' },
          ...DIRS.filter(d => !d.dz).map(dirButton),
          h('div', { class: 'compass__center' }, h('span', { class: 'compass__code' }, cellCode(cell)))),
        h('div', { class: 'stairs-row' },
          ...[U, D].map(bit => {
            const d = DIRS.find(d => d.bit === bit), can = !!cellAt(m, x, y, z + d.dz), on = !!(cell.o & bit);
            return h('button', {
              class: `md-button md-button--small md-button--outlined stairs-btn${on ? ' stairs-btn--on' : ''}`,
              disabled: !can && !on, 'aria-pressed': String(on),
              'data-tip': can ? `Stairs ${d.name.toLowerCase()} to level ${z + 1 + d.dz}` : `No level ${d.dz > 0 ? 'above' : 'below'}`,
              onclick: () => change(mm => setPassage(mm, x, y, z, bit, !on) || false),
            }, icon(bit === U ? 'la-level-up-alt' : 'la-level-down-alt'), `Stairs ${d.name.toLowerCase()}`);
          })),
        h('div', { class: 'row-actions' },
          h('button', { class: 'md-button md-button--small md-button--text md-button--danger', onclick: () => change(mm => clearCell(mm, x, y, z)) },
            icon('la-eraser'), 'Clear cell'))),
      section('item', 'Content',
        h('div', { class: 'item-choices' }, TYPES.map(tt => h('button', {
          class: `item-choice${cell.t === tt.id ? ' item-choice--on' : ''}`,
          style: tt.color ? `--item: ${tt.color}` : '',
          'data-tip': tt.name,
          onclick: () => change(mm => {
            const c = mm.cells[z][y][x];
            if (c.t === tt.id) return false;
            if (tt.unique) for (const l of mm.cells) for (const r of l) for (const o of r) if (o.t === tt.id) o.t = 0;
            c.t = tt.id;
          }),
        }, icon(tt.id ? tt.icon : 'la-ban'), h('span', {}, tt.name)))),
        h('div', { class: 'number-field' },
          field({ label: 'Number', type: 'number', id: 'cell-no', min: 0, max: 9, value: cell.n, dense: true,
            support: t.numbered ? `The ${t.name.toLowerCase()} ${t.id === 5 ? 'opens the gate' : 'opens with the key'} of this number` : 'The 4th character of the code',
            onchange: e => { const n = Math.max(0, Math.min(9, Number(e.target.value) | 0)); change(mm => { if (mm.cells[z][y][x].n === n) return false; mm.cells[z][y][x].n = n; }); } }))),
    ];
  }

  function mazeSection() {
    const m = state.maze, st = stats(m);
    const size = { width: m.width, depth: m.depth, levels: m.levels };
    const sizeField = (k, label, max) => field({ label, type: 'number', id: `maze-${k}`, min: 1, max, value: m[k], dense: true,
      oninput: e => { size[k] = Number(e.target.value) | 0; } });
    const apply = async () => {
      const w = clamp(size.width, LIMITS.size), dp = clamp(size.depth, LIMITS.size), lv = clamp(size.levels, LIMITS.levels);
      if (w === m.width && dp === m.depth && lv === m.levels) return;
      if (w < m.width || dp < m.depth || lv < m.levels) {
        const ok = await dialog({ title: 'Make the maze smaller?', content: h('p', {}, 'The cells outside the new size are lost (Undo brings them back).'),
          actions: [{ label: 'Cancel', value: false }, { label: 'Resize', value: true, variant: 'filled' }] });
        if (!ok) return render();
      }
      setMaze(resizeMaze(m, w, dp, lv), { keepHistory: true, dirty: true });
    };
    return section('maze', 'Maze',
      h('div', { class: 'stack' },
        field({ label: 'Name', id: 'maze-name', value: m.name, dense: true,
          support: 'Also the name of the variable in the Go source',
          onchange: e => { const v = e.target.value.trim() || 'maze'; if (v !== m.name) change(mm => { mm.name = v; }); } }),
        h('div', { class: 'grid3' }, sizeField('width', 'Width (x)', LIMITS.size), sizeField('depth', 'Depth (y)', LIMITS.size), sizeField('levels', 'Levels (z)', LIMITS.levels)),
        h('div', { class: 'row-actions' }, h('button', { class: 'md-button md-button--small md-button--tonal', onclick: apply }, icon('la-expand'), 'Apply size')),
        h('div', { class: 'facts' },
          fact('Cells with passages', `${st.open} of ${m.width * m.depth * m.levels}`),
          fact('Stairs', st.stairs),
          ...TYPES.slice(1).filter(t => st.items[t.id]).map(t => fact(t.name, st.items[t.id], t)))));
  }

  const fact = (label, value, t) => h('div', { class: 'fact' },
    t ? icon(t.icon, 'fact__icon') : null, h('span', { class: 'fact__label' }, label), h('span', { class: 'fact__value' }, String(value)));

  function problemsSection() {
    const ps = state.problems;
    return section('problems', ps.length ? `Problems (${ps.length})` : 'Problems',
      ps.length ? h('div', { class: 'problems' }, ps.slice(0, 200).map(p => h('button', {
        class: `problem problem--${p.level}`,
        disabled: !p.at,
        onclick: () => p.at && setView({ level: p.at.z, sel: { x: p.at.x, y: p.at.y } }),
      }, icon(p.level === 'error' ? 'la-exclamation-circle' : 'la-exclamation-triangle'),
      h('span', { class: 'problem__text' }, p.text),
      p.at ? h('span', { class: 'problem__at' }, `L${p.at.z + 1} ${p.at.x},${p.at.y}`) : null)))
        : h('p', { class: 'section__hint ok-hint' }, icon('la-check-circle'), 'The maze is complete: a start, a reachable exit, no loose ends.'));
  }

  subscribe(render);
  render();
  return { render };
}

const clamp = (v, max) => Math.max(1, Math.min(max, v | 0));
