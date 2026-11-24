'use strict';

/* ── IMPORTS ───────────────────────────────────────────────────────────────── */
import { ACTS } from './data.js';

import Map          from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView      from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic      from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';

import { esc, hideTip, tipIsOpen, addMapControls, bindMarkers, renderChips, resultsToTop,
         syncButtons, initSheet, urlParams, setUrl, buttonParam, bindCopyLinks,
         assignSlugs, findItem, bindTools, refreshPrintQr } from './shared.js';

// Stable names for shared links, e.g. ?activity=billy-goat-trail-great-falls
assignSlugs(ACTS, function(a) { return a.title; });

// Decorative emoji, hidden from screen readers
function icon(code) { return '<span aria-hidden="true">&#' + code + ';</span> '; }

/* ── ARCGIS MAP (SDK 5 ES modules) ─────────────────────────────────────────── */
var distColor = { near: [39, 174, 96], mid: [230, 126, 34], far: [192, 57, 43], xfar: [91, 58, 140] };
var MUTED_COLOR = [176, 176, 176, 0.45];

// id -> Graphic, so the filter bar can mute markers that no longer match
var markerById = {};
var mapView = null;
var HOME_VIEW = { center: [-77.8, 38.95], zoom: 7 };

var hoverId = null;   // the activity whose card is hovered or focused

function byId(id) {
  for (var i = 0; i < ACTS.length; i++) { if (ACTS[i].id === id) return ACTS[i]; }
  return null;
}

// Build the marker symbol for an activity. Filtered-out markers are smaller and
// grey so matching results stand out; the hovered activity's marker gets a gold ring.
function markerSymbol(a, active, picked) {
  return {
    type: 'simple-marker',
    style: 'circle',
    color: active ? distColor[a.dist] : MUTED_COLOR,
    size: (active ? 14 : 9) + (picked ? 5 : 0) + 'px',
    outline: picked ? { color: [212, 167, 44], width: 3.5 } :
      { color: active ? [255, 255, 255] : [255, 255, 255, 0.6], width: active ? 2 : 1 }
  };
}

// Hover card for a marker. The map has no popups: clicking a marker opens the activity.
function activityTip(id) {
  var a = byId(id);
  return '<div class="tr-tip-date">' + esc(a.drive) + ' from DC · ' + (a.style === 'day' ? 'Day trip' : 'Overnight') + '</div>' +
    '<ul><li><span class="tr-tip-dot s-' + a.dist + '"></span><span><b>' + esc(a.title) + '</b><br>' + esc(a.cost) + '</span></li></ul>' +
    '<div class="tr-tip-more">Click for details</div>';
}

(function initMap() {
  var esriMap = new Map({ basemap: 'topo-vector' });

  var view = new MapView({
    container: 'mapView',
    map: esriMap,
    center: HOME_VIEW.center,
    zoom: HOME_VIEW.zoom,
    popupEnabled: false
  });
  mapView = view;

  var layer = new GraphicsLayer();
  esriMap.add(layer);
  addMapControls(view);

  ACTS.forEach(function(a) {
    var graphic = new Graphic({
      geometry: { type: 'point', longitude: a.lng, latitude: a.lat },
      attributes: { key: a.id },
      symbol: markerSymbol(a, true, false)
    });
    layer.add(graphic);
    markerById[a.id] = graphic;
  });

  bindMarkers(view, {
    tip: activityTip,
    geometry: function(id) { return markerById[id].geometry; },
    click: function(id) { window.openOverlay(id); }
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
  loader.setAttribute('role', 'status');
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

var overlayOpener = null;   // what to return focus to when the details close
var selId = null;           // the item open in the results pane, or null for the list
var listScroll = 0;         // page scroll to return to

// fromUrl: true when the address already names this activity (page load, back/forward)
function openOverlay(id, fromUrl) {
  var a = byId(id);
  if (!a) return;
  var wasList = selId === null;
  // Details replace the list in the results pane; remember where the list was
  if (wasList) { overlayOpener = document.activeElement; listScroll = window.scrollY; }
  selId = id;
  // Opening from the list adds a history entry, so the browser's Back returns to the list
  if (!fromUrl) syncUrl(wasList);

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
    ? '<a class="site-link" href="' + a.website + '" target="_blank" rel="noopener">Official website <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span></a>'
    : '';
  document.getElementById('olGrid').innerHTML =
    '<div class="dbox">' +
      '<h3 class="dbox-title">' + icon(128176) + 'Cost &amp; Logistics</h3>' +
      '<div class="cost-big">' + a.cost + '</div>' +
      '<p class="cost-note">' + a.costNote + '</p>' +
      siteHtml +
    '</div>' +
    '<div class="dbox">' +
      '<h3 class="dbox-title">' + icon(9989) + 'Requirements &amp; What to Know</h3>' +
      '<ul class="req-list">' + reqHtml + '</ul>' +
    '</div>';

  var meritsEl = document.getElementById('olMerits');
  if (a.merits && a.merits.length) {
    var chips = '';
    a.merits.forEach(function(m) { chips += '<span class="merit-chip">' + m + '</span>'; });
    meritsEl.innerHTML =
      '<div class="merits-box">' +
        '<h3 class="dbox-title">' + icon(127885) + 'Merit Badge Opportunities</h3>' +
        '<div class="merit-chips">' + chips + '</div>' +
      '</div>';
  } else {
    meritsEl.innerHTML = '';
  }

  document.getElementById('overlay').classList.add('open');
  document.getElementById('listView').hidden = true;
  document.getElementById('detailView').hidden = false;
  applyMapFilter();
  // Bring the top of the results pane into view, then move focus to the heading
  var t = document.querySelector('.tr-right').getBoundingClientRect().top;
  if (t < 0 || t > window.innerHeight * 0.5) window.scrollBy(0, t);
  document.getElementById('olTitle').focus({ preventScroll: true });
  if (mapView) mapView.goTo({ center: [a.lng, a.lat], zoom: Math.max(mapView.zoom || 0, 9) }).catch(function() { /* interrupted by another move */ });
}

// Back to the list. keepPlace: false when a filter change sends the list to its top anyway.
function closeOverlay(keepPlace, fromUrl) {
  if (selId === null) return;
  selId = null;
  if (!fromUrl) syncUrl(false);
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('detailView').hidden = true;
  document.getElementById('listView').hidden = false;
  applyMapFilter();
  if (mapView) mapView.goTo(HOME_VIEW).catch(function() { /* interrupted by another move */ });
  if (keepPlace === false) { overlayOpener = null; return; }
  window.scrollTo(0, listScroll);
  if (overlayOpener && document.contains(overlayOpener)) overlayOpener.focus({ preventScroll: true });
  overlayOpener = null;
}

// Expose to window scope so ArcGIS popup buttons (inline HTML) can call it
window.openOverlay = openOverlay;

document.getElementById('detailBack').addEventListener('click', function() { closeOverlay(); });
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (tipIsOpen()) hideTip();
  else if (sheet.isOpen()) sheet.close();
  else closeOverlay();   // back to the results
});

/* ── CARDS ─────────────────────────────────────────────────────────────────── */
var fType = 'all', fTrip = 'all', fSeas = 'all', fBaloo = 'all', fHA = 'all';
var SD_CLS = { Sp: 'sd-sp', Su: 'sd-su', Fa: 'sd-fa', Wi: 'sd-wi' };
var SEASON = { Sp: 'Spring', Su: 'Summer', Fa: 'Fall', Wi: 'Winter' };
var TYPE_LABEL = { water: 'Water', hiking: 'Hiking', climbing: 'Climbing', cave: 'Caving', bike: 'Biking', beach: 'Beach', history: 'History' };
var ON_CLS = { type: 'on', trip: 'on-t', seas: 'on-s', baloo: 'on-b', ha: 'on-h' };
var sheet = initSheet();

// Every filter in effect, as { kind, label }, for the chips above the results
function activeFilters() {
  var out = [];
  if (fType !== 'all') out.push({ kind: 'type', label: TYPE_LABEL[fType] || fType });
  if (fTrip !== 'all') out.push({ kind: 'trip', label: fTrip === 'day' ? 'Day trip' : 'Overnight' });
  if (fSeas !== 'all') out.push({ kind: 'seas', label: SEASON[fSeas] });
  if (fBaloo !== 'all') out.push({ kind: 'baloo', label: 'BALOO compliant' });
  if (fHA !== 'all') out.push({ kind: 'ha', label: fHA === 'yes' ? 'High adventure only' : 'No high adventure' });
  return out;
}

function clearFilter(kind) {
  if (kind === 'type' || kind === 'all') fType = 'all';
  if (kind === 'trip' || kind === 'all') fTrip = 'all';
  if (kind === 'seas' || kind === 'all') fSeas = 'all';
  if (kind === 'baloo' || kind === 'all') fBaloo = 'all';
  if (kind === 'ha' || kind === 'all') fHA = 'all';
  renderCards();
  resultsToTop();
}

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
    // With an activity open, only its marker stays lit
    var lit = selId !== null ? a.id === selId : matchesFilters(a);
    if (g) g.symbol = markerSymbol(a, lit, a.id === selId || a.id === hoverId);
  });
}

function renderCards() {
  var filtered = ACTS.filter(matchesFilters);

  hoverId = null;
  syncButtons({ type: fType, trip: fTrip, seas: fSeas, baloo: fBaloo, ha: fHA }, ON_CLS);
  renderChips(activeFilters(), clearFilter);
  syncUrl(false);
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
      seaDots += '<div class="sd ' + SD_CLS[s] + (a.seas.indexOf(s) !== -1 ? ' on' : '') + '" aria-hidden="true">' + s + '</div>';
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
      '<article class="card" data-id="' + a.id + '" onclick="window.openOverlay(' + a.id + ')">' +
        '<div class="c-stripe s-' + a.dist + '"></div>' +
        '<div class="c-body">' +
          '<div class="c-top">' +
            '<h3 class="c-title"><button type="button" class="tr-title-btn" onclick="event.stopPropagation();window.openOverlay(' + a.id + ')">' + a.title + '</button></h3>' +
            '<span class="dbadge d-' + a.dist + '"><span class="sr-only">Drive: </span>' + a.drive + '</span>' +
          '</div>' +
          '<div class="seas">' + seaDots + '<span class="sr-only">Seasons: ' + a.seas.map(function(s) { return SEASON[s]; }).join(', ') + '</span></div>' +
          '<div class="tags">' + tagHtml + '</div>' +
          '<p class="c-desc">' + a.desc + '</p>' +
          '<div class="c-cost"><span class="cost-lbl">Cost:</span><span class="cost-val">' + a.cost + '</span></div>' +
        '</div>' +
        '<div class="c-foot">' +
          '<button type="button" class="detail-btn" tabindex="-1" aria-hidden="true" onclick="event.stopPropagation();window.openOverlay(' + a.id + ')">Details + Photos &#8594;</button>' +
        '</div>' +
      '</article>';
  });
  document.getElementById('grid').innerHTML = html;
}

/* ── HOVER: a result lights up its marker ──────────────────────────────────── */
(function bindHover() {
  var grid = document.getElementById('grid');
  function setHover(id) {
    if (id === hoverId) return;
    hoverId = id;
    applyMapFilter();
  }
  function cardId(target) {
    var card = target && target.closest ? target.closest('.card') : null;
    return card ? parseInt(card.getAttribute('data-id'), 10) : null;
  }
  grid.addEventListener('mouseover', function(e) { setHover(cardId(e.target)); });
  grid.addEventListener('mouseleave', function() { setHover(null); });
  grid.addEventListener('focusin', function(e) { setHover(cardId(e.target)); });
  grid.addEventListener('focusout', function() { setHover(null); });
}());

/* ── FILTERS ───────────────────────────────────────────────────────────────── */
document.querySelectorAll('.fb[data-g]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var g = btn.getAttribute('data-g');
    var v = btn.getAttribute('data-v');
    if      (g === 'type')  fType  = v;
    else if (g === 'trip')  fTrip  = v;
    else if (g === 'seas')  fSeas  = v;
    else if (g === 'baloo') fBaloo = v;
    else if (g === 'ha')    fHA    = v;
    closeOverlay(false);
    renderCards();
    resultsToTop();
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
window.openOverlay = function(id, fromUrl) {
  currentActivityId = id;
  _origOpenOverlay(id, fromUrl);
};

/* ── SHAREABLE URL ─────────────────────────────────────────────────────────── */
// ?type=water&style=day&season=Su&baloo=yes&ha=no&activity=billy-goat-trail-great-falls
var applyingUrl = false;   // true while the page is being set from the address

function syncUrl(push) {
  if (applyingUrl) return;
  setUrl({
    type:     fType  !== 'all' ? fType  : '',
    style:    fTrip  !== 'all' ? fTrip  : '',
    season:   fSeas  !== 'all' ? fSeas  : '',
    baloo:    fBaloo !== 'all' ? fBaloo : '',
    ha:       fHA    !== 'all' ? fHA    : '',
    activity: selId !== null ? byId(selId)._slug : ''
  }, push);
}

// Set the filters and the open activity from the address (page load, back/forward)
function applyUrl() {
  var p = urlParams();
  applyingUrl = true;
  fType  = buttonParam(p, 'type', 'type');
  fTrip  = buttonParam(p, 'style', 'trip');
  fSeas  = buttonParam(p, 'season', 'seas');
  fBaloo = buttonParam(p, 'baloo', 'baloo');
  fHA    = buttonParam(p, 'ha', 'ha');
  var item = findItem(ACTS, p.get('activity'));
  if (item) {
    renderCards();
    window.openOverlay(item.id, true);
  } else {
    closeOverlay(true, true);
    renderCards();
  }
  applyingUrl = false;
  refreshPrintQr();
}

window.addEventListener('popstate', applyUrl);
bindCopyLinks();

// Pocket map of the activities the current filters show
bindTools({
  pocket: function() {
    var filters = activeFilters().map(function(f) { return f.label; }).join(' · ');
    return {
      title: 'Troop 380 Activity Guide',
      subtitle: filters || 'All activities',
      places: ACTS.filter(matchesFilters).map(function(a) {
        return {
          lng: a.lng, lat: a.lat, name: a.title,
          summary: a.drive + ' from DC · ' + (a.style === 'day' ? 'Day trip' : 'Overnight') + ' · ' + a.cost,
          link: a.website || (window.location.origin + window.location.pathname + '?activity=' + a._slug)
        };
      })
    };
  }
});

/* ── INIT ──────────────────────────────────────────────────────────────────── */
applyUrl();
