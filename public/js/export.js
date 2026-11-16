// Saving a groove out of the app: a file download, a share link, a picture.
import { h, toast } from './ui.js';
import { renderChart } from './notation.js';
import { encodeGroove, asChart } from './library.js';

/** Download some bytes or a blob as a file. */
export function download(data, name, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The link that opens this groove in the app. Everything is in the link itself. */
export const shareUrl = (groove) => `${location.origin}${location.pathname}#g=${encodeGroove(groove)}`;

/** Share the link with the phone's share sheet, or copy it. */
export async function shareGroove(groove) {
  const url = shareUrl(groove);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${groove.name} · Drum Reader`, text: `A drum groove: ${groove.name}`, url });
    } catch {
      /* closed without sharing */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
}

// What the staff's look depends on, copied onto each shape so the picture stands alone.
const LOOK = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'opacity', 'fill-opacity'];

/** Draw the groove as a PNG picture (black on white). Resolves to a Blob. */
export async function groovePng({ name, bars, bpm, repeat }) {
  const W = bars.length > 1 ? 1000 : 640;
  const host = h('div', { class: 'staff-host', style: `position:fixed;left:-9999px;top:0;width:${W}px;color:#111;--ink:#111;--ink2:#555;--ink3:#999;` });
  document.body.append(host);
  try {
    renderChart(host, { bars, full: true, endings: asChart({ bars, repeat }).endings || null });
    const svg = host.querySelector('svg');
    svg.querySelector('.playhead')?.remove();
    for (const e of svg.querySelectorAll('*')) {
      const cs = getComputedStyle(e);
      for (const p of LOOK) e.style.setProperty(p, cs.getPropertyValue(p));
    }
    const w = Number(svg.getAttribute('width'));
    const ht = Number(svg.getAttribute('height'));
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await img.decode();
    const pad = 40;
    const head = 84;
    const scale = 2;
    const canvas = h('canvas', { width: (w + pad * 2) * scale, height: (ht + head + pad) * scale });
    const c = canvas.getContext('2d');
    c.scale(scale, scale);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w + pad * 2, ht + head + pad);
    c.fillStyle = '#111';
    c.font = '700 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    c.fillText(name, pad, 52);
    c.fillStyle = '#666';
    c.font = '500 17px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    c.fillText(`${bpm} BPM`, pad, 76);
    c.drawImage(img, pad, head, w, ht);
    return await new Promise((res) => canvas.toBlob(res, 'image/png'));
  } finally {
    host.remove();
  }
}
