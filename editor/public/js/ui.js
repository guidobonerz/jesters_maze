// ui.js - the small building blocks of the page: elements, menus, dialogs, toasts and tooltips
// (the components of css/m3.css, the same as in the Yopaca editor)

export const $ = (sel, root = document) => root.querySelector(sel);

// an element: h('div', { class: 'x', onclick }, child, 'text', ...)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const icon = (name, cls = '') => h('i', { class: `msr la ${name} ${cls}`.trim() });

// ---- menus --------------------------------------------------------------------------------------

let openMenuEl = null;
export function closeMenu() { openMenuEl?.remove(); openMenuEl = null; }

// items: { label, icon, kbd, checked, danger, disabled, onclick } | { divider } | { header }
export function openMenu(anchor, items) {
  closeMenu();
  const menu = h('div', { class: 'md-menu', role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it.divider) { menu.append(h('div', { class: 'md-menu__divider' })); continue; }
    if (it.header) { menu.append(h('div', { class: 'md-menu__header' }, it.header)); continue; }
    menu.append(h('button', {
      class: `md-menu__item${it.checked ? ' md-menu__item--checked' : ''}${it.danger ? ' md-menu__item--danger' : ''}`,
      role: 'menuitem', disabled: it.disabled,
      onclick: () => { closeMenu(); it.onclick?.(); },
    }, it.icon ? icon(it.icon) : h('span', { class: 'msr' }), h('span', {}, it.label), it.kbd ? h('kbd', {}, it.kbd) : null));
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect(), mr = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left, innerWidth - mr.width - 8)) + 'px';
  menu.style.top = Math.min(r.bottom + 4, innerHeight - mr.height - 8) + 'px';
  openMenuEl = menu;
  menu.querySelector('button:not([disabled])')?.focus();
}
document.addEventListener('pointerdown', e => { if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

// ---- dialogs ------------------------------------------------------------------------------------

// resolves with the value of the action picked (null: closed). actions: { label, value, variant }
export function dialog({ title, content, actions = [{ label: 'Close', value: null, variant: 'filled' }], width, onopen }) {
  return new Promise(resolve => {
    const done = v => { scrim.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
    const key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        const def = actions.find(a => a.variant === 'filled');
        if (def) { e.preventDefault(); done(typeof def.value === 'function' ? def.value() : def.value); }
      }
    };
    const box = h('div', { class: 'md-dialog', role: 'dialog', 'aria-modal': 'true' },
      h('h2', { class: 'md-dialog__title' }, title),
      h('div', { class: 'md-dialog__content' }, content),
      h('div', { class: 'md-dialog__actions' }, actions.map(a => h('button', {
        class: `md-button md-button--${a.variant ?? 'text'}${a.danger ? ' md-button--danger' : ''}`,
        onclick: () => done(typeof a.value === 'function' ? a.value() : a.value),
      }, a.label))));
    if (width) box.style.width = `min(${width}px, 100%)`;
    const scrim = h('div', { class: 'md-dialog-scrim', onpointerdown: e => { if (e.target === scrim) done(null); } }, box);
    document.addEventListener('keydown', key, true);
    document.body.append(scrim);
    onopen?.(box);
    (box.querySelector('input, select, textarea') ?? box.querySelector('.md-button--filled'))?.focus();
  });
}

// a text field with its floating label (the outline draws the notch)
export function field({ label, value = '', type = 'text', id, min, max, dense, mono, oninput, onchange, support, placeholder = ' ' }) {
  const input = h('input', { class: 'md-field__control', type, id, min, max, value, placeholder, oninput, onchange, autocomplete: 'off', spellcheck: 'false' });
  return h('div', { class: `md-field${dense ? ' md-field--dense' : ''}${mono ? ' md-field--mono' : ''}` },
    h('div', { class: 'md-field__box' }, input,
      h('label', { class: 'md-field__label', for: id }, label),
      h('fieldset', { class: 'md-field__outline', 'aria-hidden': 'true' }, h('legend', {}, h('span', {}, label)))),
    support ? h('div', { class: 'md-field__support' }, support) : null);
}

export function selectField({ label, options, value, id, onchange, dense = true }) {
  const sel = h('select', { class: 'md-field__control', id, onchange },
    options.map(o => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return h('div', { class: `md-field md-field--float${dense ? ' md-field--dense' : ''}` },
    h('div', { class: 'md-field__box' }, sel,
      h('label', { class: 'md-field__label', for: id }, label),
      h('fieldset', { class: 'md-field__outline', 'aria-hidden': 'true' }, h('legend', {}, h('span', {}, label)))));
}

// ---- toasts -------------------------------------------------------------------------------------

let toasts = null;
export function toast(text, { error = false, ms = 3500 } = {}) {
  toasts ??= document.body.appendChild(h('div', { class: 'md-toasts' }));
  const t = h('div', { class: `md-toast${error ? ' md-toast--error' : ''}`, role: 'status' },
    error ? icon('la-exclamation-circle') : null,
    h('span', { class: 'md-toast__text' }, text),
    h('button', { class: 'md-icon-button md-icon-button--xs md-toast__close', onclick: () => t.remove() }, icon('la-times')));
  toasts.append(t);
  setTimeout(() => t.remove(), error ? ms * 2 : ms);
}

// ---- tooltips: every element with data-tip ---------------------------------------------------------

let tip = null, tipFor = null, tipTimer = 0;
const hideTip = () => { clearTimeout(tipTimer); tip?.remove(); tip = null; tipFor = null; };
document.addEventListener('pointerover', e => {
  const el = e.target.closest?.('[data-tip]');
  if (el === tipFor) return;
  hideTip();
  if (!el) return;
  tipFor = el;
  tipTimer = setTimeout(() => {
    tip = h('div', { class: 'md-tooltip', role: 'tooltip' }, el.dataset.tip);
    document.body.append(tip);
    const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + tr.height > innerHeight - 4) top = r.top - tr.height - 6;
    tip.style.left = Math.max(4, Math.min(r.left + r.width / 2 - tr.width / 2, innerWidth - tr.width - 4)) + 'px';
    tip.style.top = top + 'px';
  }, 450);
});
document.addEventListener('pointerdown', hideTip, true);
document.addEventListener('pointerout', e => { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });

// ---- files --------------------------------------------------------------------------------------

export function download(name, text, type = 'text/plain') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, onchange: () => resolve(input.files[0] ?? null) });
    input.click();
  });
}
