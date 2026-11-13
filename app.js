'use strict';

/* ── IMPORTS ───────────────────────────────────────────────────────────────── */
import { ACTS } from './data.js';

import Map          from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView      from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic      from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';

/* ── ARCGIS MAP (SDK 5 ES modules) ─────────────────────────────────────────── */
var distColor = { near: [39, 174, 96], mid: [230, 126, 34], far: [192, 57, 43], xfar: [91, 58, 140] };
var MUTED_COLOR = [176, 176, 176, 0.45];

// id -> Graphic, so the filter bar can mute markers that no longer match
var markerById = {};

// Build a popup body as real DOM nodes with a live listener.
//
// This must not be an HTML string: ArcGIS Maps SDK 5 sanitises string popup
// content, discarding the <button> element along with its onclick attribute,
// which leaves the words "View details" as inert text. Returning a node from a
// content function bypasses the sanitiser and keeps the listener attached.
function buildPopupNode(a) {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var wrap = el('div', 'map-pop');
  wrap.appendChild(el('div', 'map-pop-title', a.title));
  wrap.appendChild(el('div', 'map-pop-meta',
    a.drive + ' from DC \u00b7 ' + (a.style === 'day' ? 'Day trip' : 'Overnight')));
  wrap.appendChild(el('div', 'map-pop-cost', a.cost));

  var btn = el('button', 'map-pop-btn', 'View details');
  btn.type = 'button';
  btn.addEventListener('click', function() { window.openOverlay(a.id); });
  wrap.appendChild(btn);

  return wrap;
}

// Build the marker symbol for an activity. Inactive (filtered-out) markers are
// smaller and grey so matching results stand out on the map.
function markerSymbol(a, active) {
  return {
    type: 'simple-marker',
    style: 'circle',
    color: active ? distColor[a.dist] : MUTED_COLOR,
    size: active ? '14px' : '9px',
    outline: { color: active ? [255, 255, 255] : [255, 255, 255, 0.6], width: active ? 2 : 1 }
  };
}

(function initMap() {
  var esriMap = new Map({ basemap: 'topo-vector' });

  var view = new MapView({
    container: 'mapView',
    map: esriMap,
    center: [-77.8, 38.95],
    zoom: 7
  });

  var layer = new GraphicsLayer();
  esriMap.add(layer);

  ACTS.forEach(function(a) {
    var graphic = new Graphic({
      geometry: { type: 'point', longitude: a.lng, latitude: a.lat },
      symbol: markerSymbol(a, true),
      // Content MUST be a function returning a DOM node, not an HTML string.
      // SDK 5 sanitises string content and strips buttons and event handlers.
      popupTemplate: { title: a.title, content: function() { return buildPopupNode(a); } }
    });
    layer.add(graphic);
    markerById[a.id] = graphic;
  });
}());

/* ── GALLERY ───────────────────────────────────────────────────────────────── */
var gPhotos = [];
var gIdx = 0;

function gSetPhoto(idx) {
  if (!gPhotos.length) return;
  gIdx = ((idx % gPhotos.length) + gPhotos.length) % gPhotos.length;
  document.querySelectorAll('.g-img').forEach(function(el, i) {
    el.classList.toggle('on', i === gIdx);
  });
  document.querySelectorAll('.g-dot').forEach(function(el, i) {
    el.classList.toggle('on', i === gIdx);
  });
  document.getElementById('gCap').textContent = gPhotos[gIdx] ? gPhotos[gIdx].cap : '';
}

document.getElementById('gPrev').addEventListener('click', function() { gSetPhoto(gIdx - 1); });
document.getElementById('gNext').addEventListener('click', function() { gSetPhoto(gIdx + 1); });

async function loadGallery(wikiTitles) {
  var gallery = document.getElementById('gallery');
  // Remove previous dynamic elements
  gallery.querySelectorAll('.g-img, .g-loader, .g-empty').forEach(function(el) { el.remove(); });
  document.getElementById('gDots').innerHTML = '';
  document.getElementById('gCap').textContent = '';
  gPhotos = [];
  gIdx = 0;

  // Spinner
  var loader = document.createElement('div');
  loader.className = 'g-loader';
  loader.innerHTML = '<div class="spinner"></div><span>Loading photos\u2026</span>';
  gallery.insertBefore(loader, document.getElementById('gPrev'));

  // Fetch from Wikipedia Action API (CORS-safe, more reliable than REST v1 summary)
  var imgs = [];
  for (var i = 0; i < wikiTitles.length && imgs.length < 3; i++) {
    try {
      var t = wikiTitles[i].replace(/_/g, ' ');
      // Primary: Wikipedia representative page image
      var wpUrl = 'https://en.wikipedia.org/w/api.php?action=query' +
        '&titles=' + encodeURIComponent(t) +
        '&prop=pageimages&pithumbsize=800&pilicense=any&format=json&origin=*';
      var resp = await fetch(wpUrl);
      if (resp.ok) {
        var data = await resp.json();
        var pages = data.query && data.query.pages;
        if (pages) {
          var page = Object.values(pages)[0];
          if (page && page.thumbnail && page.thumbnail.source) {
            imgs.push({ url: page.thumbnail.source, cap: page.title || t });
            continue;
          }
        }
      }
      // Fallback: Wikimedia Commons image search
      var commonsUrl = 'https://commons.wikimedia.org/w/api.php?action=query' +
        '&generator=search&gsrnamespace=6&gsrlimit=3' +
        '&gsrsearch=' + encodeURIComponent(t) +
        '&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*';
      var cresp = await fetch(commonsUrl);
      if (!cresp.ok) continue;
      var cdata = await cresp.json();
      if (!cdata.query || !cdata.query.pages) continue;
      var cpages = Object.values(cdata.query.pages);
      for (var j = 0; j < cpages.length && imgs.length < 3; j++) {
        var cp = cpages[j];
        if (!cp.imageinfo || !cp.imageinfo[0] || !cp.imageinfo[0].thumburl) continue;
        var thu = cp.imageinfo[0].thumburl;
        // Skip SVG diagrams, animations, and icons
        if (/\.(svg|gif|ico|ogv|ogg)/i.test(thu)) continue;
        var cap = (cp.title || t).replace(/^File:/, '').replace(/\.[^.]+$/, '');
        imgs.push({ url: thu, cap: cap });
      }
    } catch (_) { /* network error — skip */ }
  }

  loader.remove();

  if (!imgs.length) {
    var empty = document.createElement('div');
    empty.className = 'g-empty';
    empty.textContent = '\uD83D\uDCF7 Photos load when connected to the internet';
    gallery.insertBefore(empty, document.getElementById('gPrev'));
    return;
  }

  gPhotos = imgs;
  var dotsEl = document.getElementById('gDots');

  imgs.forEach(function(p, i) {
    var img = document.createElement('img');
    img.className = 'g-img' + (i === 0 ? ' on' : '');
    img.src = p.url;
    img.alt = p.cap;
    img.onerror = function() { this.style.display = 'none'; };
    gallery.insertBefore(img, document.getElementById('gPrev'));

    var dot = document.createElement('button');
    dot.className = 'g-dot' + (i === 0 ? ' on' : '');
    dot.setAttribute('aria-label', 'Photo ' + (i + 1));
    // Closure to capture correct index
    (function(idx) {
      dot.addEventListener('click', function() { gSetPhoto(idx); });
    }(i));
    dotsEl.appendChild(dot);
  });

  document.getElementById('gCap').textContent = imgs[0].cap;
}

/* ── OVERLAY ───────────────────────────────────────────────────────────────── */
var BADGE_CLS = { day:'t-day', over:'t-over', bike:'t-bike', beach:'t-beach', merit:'t-merit', bsa:'t-bsa', baloo:'t-baloo', ha:'t-ha' };

function openOverlay(id) {
  var a = null;
  for (var i = 0; i < ACTS.length; i++) { if (ACTS[i].id === id) { a = ACTS[i]; break; } }
  if (!a) return;

  loadGallery(a.wiki || []);

  document.getElementById('olTitle').textContent = a.title;

  var metaHtml = '';
  metaHtml += '<span class="tag dbadge d-' + a.dist + '">' + a.drive + '</span>';
  metaHtml += '<span class="tag ' + (a.style === 'day' ? 't-day' : 't-over') + '">' + (a.style === 'day' ? 'Day trip' : 'Overnight') + '</span>';
  if (a.badges.indexOf('merit') !== -1) metaHtml += '<span class="tag t-merit">Merit badge eligible</span>';
  if (a.badges.indexOf('bsa')   !== -1) metaHtml += '<span class="tag t-bsa">BSA camp</span>';
  if (a.badges.indexOf('baloo') !== -1) metaHtml += '<span class="tag t-baloo">Cub Scout / BALOO</span>';
  if (a.badges.indexOf('ha')    !== -1) metaHtml += '<span class="tag t-ha">High adventure (13/14+)</span>';
  document.getElementById('olMeta').innerHTML = metaHtml;

  document.getElementById('olDesc').textContent = a.desc;

  var reqHtml = '';
  (a.reqs || []).forEach(function(r) { reqHtml += '<li>' + r + '</li>'; });
  var siteHtml = a.website
    ? '<a class="site-link" href="' + a.website + '" target="_blank" rel="noopener">Official website &#8599;</a>'
    : '';
  document.getElementById('olGrid').innerHTML =
    '<div class="dbox">' +
      '<div class="dbox-title">&#128176; Cost &amp; Logistics</div>' +
      '<div class="cost-big">' + a.cost + '</div>' +
      '<p class="cost-note">' + a.costNote + '</p>' +
      siteHtml +
    '</div>' +
    '<div class="dbox">' +
      '<div class="dbox-title">&#9989; Requirements &amp; What to Know</div>' +
      '<ul class="req-list">' + reqHtml + '</ul>' +
    '</div>';

  var meritsEl = document.getElementById('olMerits');
  if (a.merits && a.merits.length) {
    var chips = '';
    a.merits.forEach(function(m) { chips += '<span class="merit-chip">' + m + '</span>'; });
    meritsEl.innerHTML =
      '<div class="merits-box">' +
        '<div class="dbox-title">&#127885; Merit Badge Opportunities</div>' +
        '<div class="merit-chips">' + chips + '</div>' +
      '</div>';
  } else {
    meritsEl.innerHTML = '';
  }

  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Expose to window scope so ArcGIS popup buttons (inline HTML) can call it
window.openOverlay = openOverlay;

document.getElementById('olClose').addEventListener('click', closeOverlay);
document.getElementById('overlay').addEventListener('click', function(e) {
  if (e.target === this) closeOverlay();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeOverlay();
});

/* ── CARDS ─────────────────────────────────────────────────────────────────── */
var fType = 'all', fTrip = 'all', fSeas = 'all', fBaloo = 'all', fHA = 'all';
var SD_CLS = { Sp: 'sd-sp', Su: 'sd-su', Fa: 'sd-fa', Wi: 'sd-wi' };

// Single source of truth for the filter bar — used by both the card grid and the map
function matchesFilters(a) {
  return (fType === 'all' || a.types.indexOf(fType) !== -1) &&
         (fTrip === 'all' || a.style === fTrip) &&
         (fSeas === 'all' || a.seas.indexOf(fSeas) !== -1) &&
         (fBaloo === 'all' || a.badges.indexOf('baloo') !== -1) &&
         (fHA === 'all' || (fHA === 'yes') === (a.badges.indexOf('ha') !== -1));
}

// Grey out map markers for activities the current filters exclude
function applyMapFilter() {
  ACTS.forEach(function(a) {
    var g = markerById[a.id];
    if (g) g.symbol = markerSymbol(a, matchesFilters(a));
  });
}

function renderCards() {
  var filtered = ACTS.filter(matchesFilters);

  applyMapFilter();

  document.getElementById('countBadge').textContent =
    filtered.length + ' activit' + (filtered.length === 1 ? 'y' : 'ies');

  if (!filtered.length) {
    document.getElementById('grid').innerHTML =
      '<div class="empty">&#127957;&#65039; No activities match — try broadening your filters.</div>';
    return;
  }

  var html = '';
  filtered.forEach(function(a) {
    var seaDots = '';
    ['Sp','Su','Fa','Wi'].forEach(function(s) {
      seaDots += '<div class="sd ' + SD_CLS[s] + (a.seas.indexOf(s) !== -1 ? ' on' : '') + '">' + s + '</div>';
    });

    var tagHtml = '';
    a.badges.forEach(function(b, i) {
      var cls = BADGE_CLS[b] || 't-def';
      tagHtml += '<span class="tag ' + cls + '">' + (a.labels[i] || '') + '</span>';
    });
    for (var j = a.badges.length; j < a.labels.length; j++) {
      tagHtml += '<span class="tag t-def">' + a.labels[j] + '</span>';
    }

    html +=
      '<article class="card" onclick="window.openOverlay(' + a.id + ')" tabindex="0" role="button" aria-label="' + a.title.replace(/'/g, '&#39;') + '">' +
        '<div class="c-stripe s-' + a.dist + '"></div>' +
        '<div class="c-body">' +
          '<div class="c-top">' +
            '<div class="c-title">' + a.title + '</div>' +
            '<span class="dbadge d-' + a.dist + '">' + a.drive + '</span>' +
          '</div>' +
          '<div class="seas">' + seaDots + '</div>' +
          '<div class="tags">' + tagHtml + '</div>' +
          '<p class="c-desc">' + a.desc + '</p>' +
          '<div class="c-cost"><span class="cost-lbl">Cost:</span><span class="cost-val">' + a.cost + '</span></div>' +
        '</div>' +
        '<div class="c-foot">' +
          '<button class="detail-btn" onclick="event.stopPropagation();window.openOverlay(' + a.id + ')">Details + Photos &#8594;</button>' +
        '</div>' +
      '</article>';
  });
  document.getElementById('grid').innerHTML = html;

  // Keyboard support
  document.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

/* ── FILTERS ───────────────────────────────────────────────────────────────── */
var ON_CLS = { type: 'on', trip: 'on-t', seas: 'on-s', baloo: 'on-b', ha: 'on-h' };
document.querySelectorAll('.fb').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var g = btn.getAttribute('data-g');
    var v = btn.getAttribute('data-v');
    document.querySelectorAll('[data-g="' + g + '"]').forEach(function(b) {
      b.classList.remove('on', 'on-t', 'on-s', 'on-b', 'on-h');
    });
    btn.classList.add(ON_CLS[g] || 'on');
    if      (g === 'type')  fType  = v;
    else if (g === 'trip')  fTrip  = v;
    else if (g === 'seas')  fSeas  = v;
    else if (g === 'baloo') fBaloo = v;
    else if (g === 'ha')    fHA    = v;
    renderCards();
  });
});

/* ── PRINT HANDLERS ────────────────────────────────────────────────────────── */
var currentActivityId = null;

document.getElementById('printIndexBtn').addEventListener('click', function() {
  // Make sure we are NOT in single-activity print mode
  document.body.classList.remove('print-single');
  // Close any open overlay
  closeOverlay();
  // Slight delay so DOM updates before print dialog
  setTimeout(function() { window.print(); }, 50);
});

document.getElementById('printActivityBtn').addEventListener('click', function() {
  // Add the print-single class so the print stylesheet shows just this overlay
  document.body.classList.add('print-single');
  setTimeout(function() { window.print(); }, 50);
});

// Always remove print-single class after the print dialog closes
window.addEventListener('afterprint', function() {
  document.body.classList.remove('print-single');
});

// Track which activity is open (helpful for future single-activity print routes)
var _origOpenOverlay = openOverlay;
window.openOverlay = function(id) {
  currentActivityId = id;
  _origOpenOverlay(id);
};

/* ── INIT ──────────────────────────────────────────────────────────────────── */
renderCards();
