'use strict';

/* Shared behaviour for the activity guide (app.js) and the summer camp page
   (camps.js): map controls and marker hover/click, the hover card, filter
   chips, the phone filter sheet, and focus handling for the details dialog.
   Markup these helpers expect is described beside each one. */

import Home   from 'https://js.arcgis.com/5.0/@arcgis/core/widgets/Home.js';
import Search from 'https://js.arcgis.com/5.0/@arcgis/core/widgets/Search.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── HOVER CARD ────────────────────────────────────────────────────────────── */
// Expects <div class="tr-tip" id="hoverTip" aria-hidden="true" hidden></div>.
// The card can be hovered itself and Escape dismisses it (WCAG 1.4.13).
var tipTimer = null;

export function hideTip() {
  clearTimeout(tipTimer);
  var tip = document.getElementById('hoverTip');
  if (tip) tip.hidden = true;
}

export function hideTipSoon() {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 150);
}

export function tipIsOpen() {
  var tip = document.getElementById('hoverTip');
  return !!tip && !tip.hidden;
}

// r: the screen rectangle the card points at ({left, top, bottom, width})
export function showTip(html, r) {
  clearTimeout(tipTimer);
  var tip = document.getElementById('hoverTip');
  tip.innerHTML = html;
  tip.hidden = false;
  // Above the target when there is room, otherwise below; kept inside the window
  var w = tip.offsetWidth, h = tip.offsetHeight;
  var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  var top = r.top - h - 6;
  if (top < 8) top = r.bottom + 6;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

// Hover card for any element carrying data-tip inside `root` (e.g. week cells)
export function bindDataTips(root) {
  function target(el) { return el && el.closest ? el.closest('[data-tip]') : null; }
  root.addEventListener('mouseover', function(e) {
    var el = target(e.target);
    if (el) showTip('<div class="tr-tip-more">' + esc(el.getAttribute('data-tip')) + '</div>', el.getBoundingClientRect());
  });
  root.addEventListener('mouseout', function(e) { if (target(e.target)) hideTipSoon(); });
}

(function bindTipItself() {
  var tip = document.getElementById('hoverTip');
  if (!tip) return;
  tip.addEventListener('mouseenter', function() { clearTimeout(tipTimer); });
  tip.addEventListener('mouseleave', hideTipSoon);
  window.addEventListener('scroll', hideTip, { passive: true });
  var left = document.querySelector('.tr-left');
  if (left) left.addEventListener('scroll', hideTip);
}());

/* ── MAP ───────────────────────────────────────────────────────────────────── */
// Home returns to the starting view; Search finds a place or address
export function addMapControls(view) {
  view.ui.add(new Home({ view: view }), 'top-left');
  view.ui.add(new Search({ view: view, popupEnabled: false }), 'top-right');
}

// Marker hover and click. Graphics must carry attributes.key.
// opts.tip(key) returns the hover card's HTML; opts.click(key, shiftKey) handles a click;
// opts.geometry(key) returns the marker's point, used to anchor the card.
export function bindMarkers(view, opts) {
  function keyAt(hit) {
    var key = null;
    hit.results.forEach(function(r) {
      if (key === null && r.graphic && r.graphic.attributes && r.graphic.attributes.key !== undefined) key = r.graphic.attributes.key;
    });
    return key;
  }
  view.on('click', function(e) {
    view.hitTest(e).then(function(hit) {
      var key = keyAt(hit);
      if (key === null) return;
      hideTip();
      opts.click(key, !!(e.native && e.native.shiftKey));
    });
  });
  var over = null;
  view.on('pointer-move', function(e) {
    view.hitTest(e).then(function(hit) {
      var key = keyAt(hit);
      view.container.style.cursor = key !== null ? 'pointer' : '';
      if (key === over) return;
      over = key;
      if (key === null) { hideTipSoon(); return; }
      var box = view.container.getBoundingClientRect();
      var pt = view.toScreen(opts.geometry(key));
      showTip(opts.tip(key), { left: box.left + pt.x - 12, top: box.top + pt.y - 12, bottom: box.top + pt.y + 12, width: 24 });
    });
  });
  view.on('pointer-leave', function() { over = null; hideTipSoon(); });
  view.on('drag', function() { over = null; hideTip(); });
}

/* ── FILTER CHIPS ──────────────────────────────────────────────────────────── */
// Expects <ul class="tr-active" id="activeBar" hidden></ul> and a heading #resultsTitle.
// list: [{ kind, label }]; onClear(kind) is called with a kind, or 'all'.
export function renderChips(list, onClear) {
  var html = '';
  list.forEach(function(f) {
    html += '<li><button type="button" class="tr-chip" data-clear="' + esc(f.kind) + '">' +
      '<span class="sr-only">Remove filter: </span>' + esc(f.label) + ' <span aria-hidden="true">&#10005;</span></button></li>';
  });
  if (list.length) {
    html += '<li><button type="button" class="tr-chip tr-chip-all" data-clear="all">Clear all filters</button></li>';
  }
  setPrintFilters(list);
  var bar = document.getElementById('activeBar');
  bar.innerHTML = html;
  bar.hidden = !list.length;
  bar.querySelectorAll('.tr-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
      onClear(btn.getAttribute('data-clear'));
      // The chip is gone: put focus on the next one, or on the results heading
      var next = document.querySelector('#activeBar .tr-chip') || document.getElementById('resultsTitle');
      next.focus({ preventScroll: true });
    });
  });
  var open = document.getElementById('filterOpen');
  if (open) open.textContent = 'Filters' + (list.length ? ' (' + list.length + ')' : '');
}

// After a filter change, bring the first result back into view
export function resultsToTop() {
  var t = document.querySelector('.tr-right').getBoundingClientRect().top;
  if (t < 0) window.scrollBy(0, t);
}

// Mark the pressed button in each filter group. state: { group: value }, onCls: { group: class }
export function syncButtons(state, onCls) {
  document.querySelectorAll('.fb[data-g]').forEach(function(b) {
    var g = b.getAttribute('data-g');
    var on = b.getAttribute('data-v') === String(state[g]);
    b.classList.remove('on', 'on-t', 'on-s', 'on-b', 'on-h');
    if (on) b.classList.add(onCls[g] || 'on');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/* ── KEYBOARD FOCUS ────────────────────────────────────────────────────────── */
// Keep Tab inside `container` while isActive() is true
export function trapTab(container, isActive) {
  container.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab' || !isActive()) return;
    var items = Array.prototype.filter.call(
      container.querySelectorAll('button, select, input, a[href], [tabindex="0"]'),
      function(el) { return el.offsetParent !== null && !el.disabled; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ── FILTER SHEET (phones) ─────────────────────────────────────────────────── */
// Expects #filterSheet (the .filters block), #filterOpen, #filterClose and #sheetBackdrop.
// On wide screens the sheet classes do nothing. Returns { isOpen, close }.
export function initSheet() {
  var sheet = document.getElementById('filterSheet');
  var openBtn = document.getElementById('filterOpen');
  function isOpen() { return document.body.classList.contains('tr-sheet-on'); }
  function open() {
    document.body.classList.add('tr-sheet-on');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    openBtn.setAttribute('aria-expanded', 'true');
    // The sheet becomes visible on the next frame; focus cannot land in it before then
    setTimeout(function() { document.getElementById('filterClose').focus(); }, 60);
  }
  function close() {
    if (!isOpen()) return;
    document.body.classList.remove('tr-sheet-on');
    sheet.removeAttribute('role');
    sheet.removeAttribute('aria-modal');
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.focus();
  }
  openBtn.addEventListener('click', open);
  document.getElementById('filterClose').addEventListener('click', close);
  document.getElementById('sheetBackdrop').addEventListener('click', close);
  trapTab(sheet, isOpen);
  return { isOpen: isOpen, close: close };
}

/* ── SHAREABLE URLS ────────────────────────────────────────────────────────── */
// The page's filters and open item live in the query string, so any view can be
// bookmarked or shared. Pages call setUrl() after every state change and read
// the query string on load and on back/forward (popstate).
export function urlParams() { return new URLSearchParams(window.location.search); }

// pairs: { name: value }; empty values are left out. push adds a history entry.
export function setUrl(pairs, push) {
  var q = new URLSearchParams();
  Object.keys(pairs).forEach(function(k) {
    var v = pairs[k];
    if (v !== '' && v !== null && v !== undefined) q.set(k, v);
  });
  var qs = q.toString();
  var url = window.location.pathname + (qs ? '?' + qs : '');
  if (url !== window.location.pathname + window.location.search) {
    window.history[push ? 'pushState' : 'replaceState'](null, '', url);
  }
  refreshPrintQr();
}

// A filter value from the URL is used only if the filter bar has a button for it
export function buttonParam(params, name, group) {
  var v = params.get(name);
  if (!v) return 'all';
  var ok = false;
  document.querySelectorAll('.fb[data-g="' + group + '"]').forEach(function(b) {
    if (b.getAttribute('data-v') === v) ok = true;
  });
  return ok ? v : 'all';
}

// Buttons marked data-copy-link copy the current address
export function bindCopyLinks() {
  var status = document.createElement('div');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  document.body.appendChild(status);
  document.querySelectorAll('[data-copy-link]').forEach(function(btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function() {
      var url = window.location.href;
      function done() {
        btn.textContent = 'Link copied';
        status.textContent = 'Link copied to the clipboard';
        setTimeout(function() { btn.textContent = label; status.textContent = ''; }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function() { window.prompt('Copy this link', url); });
      } else {
        window.prompt('Copy this link', url);
      }
    });
  });
}

/* ── STABLE ITEM NAMES FOR URLS ────────────────────────────────────────────── */
// Shared links name an item by a slug made from its own text ("camp-olmsted"),
// not by its id or position, so they keep working when items are added,
// removed or reordered. An item may pin its slug with an explicit `slug` field,
// which then survives a rename too.
export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Give every item a unique `_slug`. text(item) returns the words to build it from.
export function assignSlugs(items, text) {
  var seen = {};
  items.forEach(function(it) {
    var base = it.slug || slugify(text(it)) || 'item';
    var slug = base, n = 2;
    while (seen[slug]) { slug = base + '-' + n; n++; }
    seen[slug] = true;
    it._slug = slug;
  });
}

// The item a URL value names: by slug, or by numeric id for links shared before slugs
export function findItem(items, value) {
  if (!value) return null;
  var i;
  for (i = 0; i < items.length; i++) { if (items[i]._slug === value) return items[i]; }
  if (/^\d+$/.test(value)) {
    for (i = 0; i < items.length; i++) { if (String(items[i].id) === value) return items[i]; }
  }
  return null;
}

/* ── PRINT AND POCKET MAP (follow the current filters) ─────────────────────── */
// Expects buttons marked data-print and data-pocket in the results heading, and
// optionally <p id="printFilters"> for a print-only line naming the filters.
var POCKETMAPS = 'https://ajturner.github.io/pocketmaps/app.html';
var POCKET_URL_LIMIT = 7000;   // longer addresses are refused by the web server

// Print-only line naming the filters in effect, so a printed list says what it shows
export function setPrintFilters(list) {
  var el = document.getElementById('printFilters');
  if (!el) return;
  el.textContent = list.length ? 'Filters: ' + list.map(function(f) { return f.label; }).join(' · ') : '';
}

// Open the PocketMaps booklet generator on the given places.
// spec: { title, subtitle, places: [{ lng, lat, name, summary, link }] }
// The places travel as GeoJSON inside the address (a data: URL), or, when that
// would be too long and this page shares PocketMaps' origin, as a blob: URL
// that the generator reads from this still-open page.
export function openPocketMap(spec) {
  if (!spec.places.length) {
    window.alert('There is nothing to map: no results with a location match the current filters.');
    return;
  }
  var json = JSON.stringify({
    type: 'FeatureCollection',
    name: spec.title,
    features: spec.places.map(function(p) {
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Math.round(p.lng * 1e5) / 1e5, Math.round(p.lat * 1e5) / 1e5] },
        properties: { Name: p.name, Summary: p.summary, Link: p.link }
      };
    })
  });
  function address(dataUrl) {
    var q = new URLSearchParams();
    q.set('url', dataUrl);
    q.set('title', spec.title);
    if (spec.subtitle) q.set('subtitle', spec.subtitle);
    q.set('name', 'Name');
    q.set('desc', 'Summary');
    q.set('qrlink', '{Link}');
    // The generator's index QR would encode this whole address, data included: leave it off
    q.set('indexqr', '0');
    return POCKETMAPS + '?' + q.toString();
  }
  // btoa needs single-byte characters, so encode the JSON as UTF-8 first
  var url = address('data:application/geo+json;base64,' + window.btoa(unescape(encodeURIComponent(json))));
  if (url.length > POCKET_URL_LIMIT) {
    if (window.location.origin !== new URL(POCKETMAPS).origin) {
      window.alert('That is too many places (' + spec.places.length + ') to send to the pocket map from this address. Narrow the filters, or use the published site.');
      return;
    }
    url = address(URL.createObjectURL(new Blob([json], { type: 'application/geo+json' })));
  }
  window.open(url, '_blank', 'noopener');
}

// opts.print(): print the list or the open item (default: window.print()).
// opts.pocket(): returns the spec for openPocketMap().
export function bindTools(opts) {
  document.querySelectorAll('[data-print]').forEach(function(btn) {
    btn.addEventListener('click', function() { if (opts.print) opts.print(); else window.print(); });
  });
  document.querySelectorAll('[data-pocket]').forEach(function(btn) {
    btn.addEventListener('click', function() { openPocketMap(opts.pocket()); });
  });
}

/* ── PRINT-ONLY QR CODE ────────────────────────────────────────────────────── */
// Expects <div class="tr-print-qr" id="printQr" aria-hidden="true"></div>, shown only
// when printing. It holds a QR code for the page's current address, so a printed
// list leads back to the same filtered search and a printed item to that item.
// The QR library loads on demand from a pinned CDN build; if it cannot load, the
// printout simply has no code.
var QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm';
var qrLoading = null;

export function refreshPrintQr() {
  var box = document.getElementById('printQr');
  if (!box) return;
  var url = window.location.href;
  var isItem = /[?&](activity|camp|training)=/.test(window.location.search);
  if (!qrLoading) qrLoading = import(QR_LIB).then(function(m) { return m.default; });
  qrLoading.then(function(qrcode) {
    if (url !== window.location.href) return;   // the address moved on while loading
    var qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 }) +
      '<div class="tr-print-qr-cap">' + (isItem ? 'Scan to open this page online' : 'Scan to open this list online') + '</div>';
    box.setAttribute('data-url', url);
  }).catch(function() { box.innerHTML = ''; });
}
