// Small DOM helpers and iOS-style controls.

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, pv] of Object.entries(v)) {
        if (p.startsWith('--')) e.style.setProperty(p, pv); // custom properties need setProperty
        else e.style[p] = pv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function svgIcon(markup, cls = 'icon') {
  const span = document.createElement('span');
  span.className = cls;
  span.innerHTML = markup;
  return span;
}

export const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
  chevron: '<svg viewBox="0 0 10 16" aria-hidden="true"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/** iOS segmented control. options: [{ value, label }] */
export function segmented(options, value, onChange, ariaLabel) {
  let current = value;
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': ariaLabel });
  const buttons = options.map((o) =>
    h('button', {
      type: 'button',
      role: 'radio',
      onClick: () => {
        if (o.value === current) return;
        set(o.value);
        onChange(o.value);
      },
    }, o.label),
  );
  function set(v) {
    current = v;
    buttons.forEach((b, i) => {
      const on = options[i].value === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    });
  }
  root.append(...buttons);
  set(value);
  root.set = set;
  return root;
}

/** iOS stepper (− | +). Press and hold repeats. */
export function stepper({ value, min, max, step = 1, onChange, label = 'value' }) {
  let v = value;
  const minus = h('button', { type: 'button', 'aria-label': `Decrease ${label}` }, '−');
  const plus = h('button', { type: 'button', 'aria-label': `Increase ${label}` }, '+');
  const root = h('div', { class: 'stepper' }, minus, h('span', { class: 'stepper-sep' }), plus);
  const update = () => {
    minus.disabled = v <= min;
    plus.disabled = v >= max;
  };
  const bump = (d) => {
    const nv = Math.min(max, Math.max(min, v + d));
    if (nv !== v) {
      v = nv;
      onChange(v);
    }
    update();
  };
  const hold = (btn, d) => {
    let t1;
    let t2;
    const end = () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      bump(d);
      t1 = setTimeout(() => (t2 = setInterval(() => bump(d), 70)), 400);
    });
    // Keyboard activation (Enter / Space) arrives as a click with detail 0.
    btn.addEventListener('click', (e) => e.detail === 0 && bump(d));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, end);
  };
  hold(minus, -step);
  hold(plus, step);
  update();
  root.set = (nv) => {
    v = nv;
    update();
  };
  return root;
}

/** iOS switch. */
export function toggle(checked, onChange, label) {
  return h('input', {
    type: 'checkbox',
    class: 'switch',
    role: 'switch',
    'aria-label': label,
    checked,
    onChange: (e) => onChange(e.target.checked),
  });
}

/** A row in an inset grouped list. */
export function row(label, ...right) {
  return h('div', { class: 'row' }, h('span', { class: 'row-main' }, label), ...right);
}

/** Bottom sheet with a list of choices. items: [{ label, detail?, checked?, onClick }] */
export function sheet({ title, items }) {
  const close = () => {
    back.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => back.remove(), 260);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const back = h('div', { class: 'sheet-back', onClick: (e) => e.target === back && close() });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grabber' }),
    h('div', { class: 'sheet-head' },
      h('span', { class: 'sheet-title' }, title),
      h('button', { type: 'button', class: 'nav-btn bold', onClick: close }, 'Done')),
    h('div', { class: 'sheet-body' },
      h('div', { class: 'list' },
        items.map((it) =>
          h('button', {
            type: 'button',
            class: 'row row-btn',
            onClick: () => {
              close();
              it.onClick();
            },
          },
          h('span', { class: 'row-main' }, h('span', null, it.label), it.detail && h('span', { class: 'row-sub' }, it.detail)),
          it.checked ? svgIcon(ICONS.check, 'icon check') : null),
        ))),
  );
  back.append(panel);
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => back.classList.add('open'));
  panel.querySelector('.row-btn')?.focus({ preventScroll: true });
}

let toastEl = null;
let toastTimer = null;
/** Small floating message, optionally with one action (e.g. Undo). */
export function toast(message, action) {
  toastEl?.remove();
  clearTimeout(toastTimer);
  const t = h('div', { class: 'toast', role: 'status' },
    h('span', null, message),
    action && h('button', {
      type: 'button',
      onClick: () => {
        action.onClick();
        t.remove();
      },
    }, action.label));
  toastEl = t;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, action ? 4000 : 2200);
}
