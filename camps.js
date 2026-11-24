'use strict';

/* ── IMPORTS ───────────────────────────────────────────────────────────────── */
import { CAMPS, WEEKS, PATROLS } from './camps-data.js';

import Map           from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView       from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic       from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';

import { esc, hideTip, tipIsOpen, bindDataTips, addMapControls, bindMarkers,
         renderChips, resultsToTop, syncButtons, initSheet, urlParams, setUrl, buttonParam,
         bindCopyLinks, assignSlugs, findItem, bindTools, refreshPrintQr } from './shared.js';

// Stable names for shared links, e.g. ?camp=camp-olmsted
assignSlugs(CAMPS, function(c) { return c.name; });

/* ── HELPERS ───────────────────────────────────────────────────────────────── */
var MEAL_LABEL = { dh: 'Dining hall', pc: 'Patrol cooking', hs: 'Heater stack' };
var WEEK_LABEL = { open: 'Open', almost: 'Almost full', listed: 'Offered', full: 'Full' };
var SHORT_DRIVE_MINS = 150; // "Short drive" request: 2.5 hours or less

// Decorative emoji, hidden from screen readers
function icon(code) { return '<span aria-hidden="true">&#' + code + ';</span> '; }
var NEW_TAB = ' <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span>';

function byId(id) {
  for (var i = 0; i < CAMPS.length; i++) { if (CAMPS[i].id === id) return CAMPS[i]; }
  return null;
}

function weekShort(k) {
  // '06-27' -> '6/27'
  var p = k.split('-');
  return parseInt(p[0], 10) + '/' + parseInt(p[1], 10);
}

function weekCount(c) { return Object.keys(c.weeks).length; }

function hasMeal(c, m) { return c.meals.indexOf(m) !== -1; }

// Flat list of a camp's merit badges, or null when the camp publishes no list
function meritList(c) {
  if (!c.merits) return null;
  var all = [];
  c.merits.areas.forEach(function(a) { all = all.concat(a.badges); });
  return all;
}

function meritCount(c) { var m = meritList(c); return m ? m.length : 0; }

function offersBadge(c, q) {
  var m = meritList(c);
  if (!m) return false;
  q = q.toLowerCase();
  return m.some(function(b) { return b.toLowerCase().indexOf(q) !== -1; });
}

/* ── PATROL FIT ────────────────────────────────────────────────────────────── */
// Each fit key answers true (camp meets it), false (camp does not) or null (not confirmed).
var FIT_KEYS = {
  fresh:  function(c) { return c.fresh; },
  dh:     function(c) { return c.meals.length ? hasMeal(c, 'dh') : null; },
  pc:     function(c) { return c.meals.length ? hasMeal(c, 'pc') : null; },
  shoot:  function(c) { return c.flags.shoot; },
  craft:  function(c) { return c.flags.craft; },
  nature: function(c) { return c.flags.nature; },
  short:  function(c) { return c.mins <= SHORT_DRIVE_MINS; }
};

var FIT_MAX = 0;
PATROLS.forEach(function(p) { p.asks.forEach(function(a) { if (a.key) FIT_MAX++; }); });

// Returns { score, perPatrol: [{ patrol, met, scorable, asks:[{text, state}] }] }
function fitFor(c) {
  var score = 0;
  var perPatrol = PATROLS.map(function(p) {
    var met = 0, scorable = 0;
    var asks = p.asks.map(function(a) {
      if (!a.key) return { text: a.text, state: 'na' };
      scorable++;
      var v = FIT_KEYS[a.key](c);
      if (v === true) { met++; score++; return { text: a.text, state: 'yes' }; }
      if (v === false) return { text: a.text, state: 'no' };
      return { text: a.text, state: 'unk' };
    });
    return { patrol: p, met: met, scorable: scorable, asks: asks };
  });
  return { score: score, perPatrol: perPatrol };
}

CAMPS.forEach(function(c) { c._fit = fitFor(c); });

/* ── PATROL PREFERENCES PANEL ──────────────────────────────────────────────── */
(function renderPrefs() {
  var html = '';
  PATROLS.forEach(function(p) {
    var items = '';
    p.asks.forEach(function(a) {
      items += '<li class="' + (a.key ? '' : 'pref-na') + '">' + esc(a.text) + (a.key ? '' : ' <span class="pref-note">(not scored)</span>') + '</li>';
    });
    html +=
      '<div class="pref-card">' +
        '<div class="pref-code">' + esc(p.code) + '</div>' +
        '<div class="pref-name">' + esc(p.name) + '</div>' +
        '<ul class="pref-list">' + items + '</ul>' +
      '</div>';
  });
  document.getElementById('prefGrid').innerHTML = html;
}());

/* ── ARCGIS MAP (SDK 5 ES modules) ─────────────────────────────────────────── */
var distColor = { near: [39, 174, 96], mid: [230, 126, 34], far: [192, 57, 43] };
var MUTED_COLOR = [176, 176, 176, 0.45];
var markerById = {};
var mapView = null;
var HOME_VIEW = { center: [-77.6, 39.0], zoom: 6 };

var hoverId = null;   // the camp whose card is hovered or focused

// Filtered-out markers are small and grey; the hovered camp's marker gets a gold ring
function markerSymbol(c, active, picked) {
  return {
    type: 'simple-marker',
    style: 'circle',
    color: active ? distColor[c.dist] : MUTED_COLOR,
    size: (active ? 14 : 9) + (picked ? 5 : 0) + 'px',
    outline: picked ? { color: [212, 167, 44], width: 3.5 } :
      { color: active ? [255, 255, 255] : [255, 255, 255, 0.6], width: active ? 2 : 1 }
  };
}

// Hover card for a marker (the map has no popups; clicking a marker opens the camp)
function campTip(id) {
  var c = byId(id);
  return '<div class="tr-tip-date">' + esc(c.drive) + ' from DC · ' + esc(c.place) + '</div>' +
    '<ul><li><span class="tr-tip-dot s-' + c.dist + '"></span><span><b>' + esc(c.name) + '</b><br>' +
    'Youth ' + esc(c.youthLabel) + ' · ' + weekCount(c) + ' week' + (weekCount(c) === 1 ? '' : 's') + ' offered</span></li></ul>' +
    '<div class="tr-tip-more">Click for details</div>';
}

(function initMap() {
  var esriMap = new Map({ basemap: 'topo-vector' });
  var view = new MapView({ container: 'mapView', map: esriMap, center: HOME_VIEW.center, zoom: HOME_VIEW.zoom, popupEnabled: false });
  mapView = view;
  var layer = new GraphicsLayer();
  esriMap.add(layer);
  addMapControls(view);

  // Home marker: Capitol Hill, where drive times are measured from
  layer.add(new Graphic({
    geometry: { type: 'point', longitude: -76.996, latitude: 38.889 },
    symbol: { type: 'simple-marker', style: 'diamond', color: [26, 58, 42], size: '12px', outline: { color: [255, 255, 255], width: 2 } }
  }));

  CAMPS.forEach(function(c) {
    var g = new Graphic({
      geometry: { type: 'point', longitude: c.lng, latitude: c.lat },
      attributes: { key: c.id },
      symbol: markerSymbol(c, true, false)
    });
    layer.add(g);
    markerById[c.id] = g;
  });

  bindMarkers(view, {
    tip: campTip,
    geometry: function(id) { return markerById[id].geometry; },
    click: function(id) { window.openCamp(id); }
  });
}());

/* ── GALLERY ───────────────────────────────────────────────────────────────── */
var gPhotos = [];
var gIdx = 0;

function gSetPhoto(idx) {
  if (!gPhotos.length) return;
  gIdx = ((idx % gPhotos.length) + gPhotos.length) % gPhotos.length;
  document.querySelectorAll('.g-img').forEach(function(el, i) { el.classList.toggle('on', i === gIdx); });
  document.querySelectorAll('.g-dot').forEach(function(el, i) { el.classList.toggle('on', i === gIdx); });
  document.getElementById('gCap').textContent = gPhotos[gIdx] ? gPhotos[gIdx].cap : '';
}

document.getElementById('gPrev').addEventListener('click', function() { gSetPhoto(gIdx - 1); });
document.getElementById('gNext').addEventListener('click', function() { gSetPhoto(gIdx + 1); });

// Same photo sourcing as the activity guide: Wikipedia page image first,
// then a Wikimedia Commons search on the same title.
var galleryToken = 0;
async function loadGallery(wikiTitles) {
  var token = ++galleryToken;
  var gallery = document.getElementById('gallery');
  gallery.querySelectorAll('.g-img, .g-loader, .g-empty').forEach(function(el) { el.remove(); });
  document.getElementById('gDots').innerHTML = '';
  document.getElementById('gCap').textContent = '';
  gPhotos = [];
  gIdx = 0;

  var loader = document.createElement('div');
  loader.className = 'g-loader';
  loader.setAttribute('role', 'status');
  loader.innerHTML = '<div class="spinner"></div><span>Loading photos…</span>';
  gallery.insertBefore(loader, document.getElementById('gPrev'));

  var imgs = [];
  for (var i = 0; i < wikiTitles.length && imgs.length < 3; i++) {
    try {
      var t = wikiTitles[i].replace(/_/g, ' ');
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
        if (/\.(svg|gif|ico|ogv|ogg)/i.test(thu)) continue;
        imgs.push({ url: thu, cap: (cp.title || t).replace(/^File:/, '').replace(/\.[^.]+$/, '') });
      }
    } catch (_) { /* network error — skip */ }
  }

  // A newer camp was opened while these photos loaded: drop this result
  if (token !== galleryToken) return;
  loader.remove();

  if (!imgs.length) {
    var empty = document.createElement('div');
    empty.className = 'g-empty';
    empty.textContent = '📷 Photos load when connected to the internet';
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
    (function(idx) { dot.addEventListener('click', function() { gSetPhoto(idx); }); }(i));
    dotsEl.appendChild(dot);
  });
  document.getElementById('gCap').textContent = imgs[0].cap;
}

/* ── SHARED MARKUP ─────────────────────────────────────────────────────────── */
function mealTags(c) {
  if (!c.meals.length) return '<span class="tag t-def">Meals: not confirmed</span>';
  var html = '';
  c.meals.forEach(function(m) { html += '<span class="tag t-meal-' + m + '">' + MEAL_LABEL[m] + '</span>'; });
  return html;
}

function waterTag(c) {
  if (c.fresh === true)  return '<span class="tag t-beach">Fresh water</span>';
  if (c.fresh === false) return '<span class="tag t-salt">Salt / tidal water</span>';
  return '<span class="tag t-def">Water: not confirmed</span>';
}

function weekStrip(c) {
  var html = '';
  WEEKS.forEach(function(k) {
    var s = c.weeks[k];
    var cls = s ? 'wk-' + s : 'wk-none';
    var status = s ? WEEK_LABEL[s] : 'Not offered';
    html += '<span class="wk-cell ' + cls + '" data-tip="Week of ' + weekShort(k) + ': ' + status + '">' + weekShort(k) +
      '<span class="sr-only"> ' + status + '</span></span>';
  });
  if (!weekCount(c)) html += '<span class="wk-unknown">2027 dates not found</span>';
  return '<div class="wk-strip">' + html + '</div>';
}

function fitBar(c) {
  return '<div class="fit">' +
           '<div class="fit-lbl">Patrol fit <b>' + c._fit.score + ' / ' + FIT_MAX + '</b></div>' +
           '<progress class="fit-track" max="' + FIT_MAX + '" value="' + c._fit.score + '"></progress>' +
         '</div>';
}

function meritLine(c) {
  if (!c.merits) return 'Merit badges: list not published';
  var n = meritCount(c);
  var line = (c.merits.partial ? n + '+ merit badges' : n + ' merit badges');
  if (fBadge) {
    var hits = meritList(c).filter(function(b) { return b.toLowerCase().indexOf(fBadge.toLowerCase()) !== -1; });
    line += ' \u00b7 offers ' + hits.join(', ');
  }
  return esc(line);
}

/* ── OVERLAY ───────────────────────────────────────────────────────────────── */
var overlayOpener = null;   // what to return focus to when the details close
var selId = null;           // the item open in the results pane, or null for the list
var listScroll = 0;         // page scroll to return to

// fromUrl: true when the address already names this camp (page load, back/forward)
function openCamp(id, fromUrl) {
  var c = byId(id);
  if (!c) return;
  var wasList = selId === null;
  // Details replace the list in the results pane; remember where the list was
  if (wasList) { overlayOpener = document.activeElement; listScroll = window.scrollY; }
  selId = id;
  // Opening from the list adds a history entry, so the browser's Back returns to the list
  if (!fromUrl) syncUrl(wasList);

  loadGallery(c.wiki || []);

  document.getElementById('olTitle').textContent = c.name;

  document.getElementById('olMeta').innerHTML =
    '<span class="tag dbadge d-' + c.dist + '">' + c.drive + '</span>' +
    '<span class="tag t-def">' + esc(c.place) + '</span>' +
    mealTags(c) + waterTag(c) +
    '<span class="tag t-bsa">' + esc(c.council) + '</span>';

  document.getElementById('olDesc').textContent = c.desc;

  var wkHtml = '<h3 class="dbox-title">' + icon(128197) + '2027 weeks (Sunday start)</h3>' + weekStrip(c);
  document.getElementById('olWeeks').innerHTML = wkHtml;

  var linkHtml = '';
  c.links.forEach(function(l) {
    linkHtml += '<a class="site-link" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + NEW_TAB + '</a> ';
  });
  var progHtml = '';
  c.programs.forEach(function(p) { progHtml += '<li>' + esc(p) + '</li>'; });
  var noteHtml = '';
  c.notes.forEach(function(n) { noteHtml += '<li>' + esc(n) + '</li>'; });

  document.getElementById('olGrid').innerHTML =
    '<div class="dbox">' +
      '<h3 class="dbox-title">' + icon(128176) + 'Cost</h3>' +
      '<div class="cost-big">Youth ' + esc(c.youthLabel) + '</div>' +
      '<div class="cost-sub">Adults: ' + esc(c.adult) + '</div>' +
      '<p class="cost-note">' + esc(c.costNote) + '</p>' +
      '<div class="ol-links">' + linkHtml + '</div>' +
    '</div>' +
    '<div class="dbox">' +
      '<h3 class="dbox-title">' + icon(127957) + 'Activities</h3>' +
      '<ul class="req-list">' + progHtml + '</ul>' +
      '<h3 class="dbox-title dbox-title-gap">' + icon(128204) + 'Know before you book</h3>' +
      '<ul class="req-list">' + noteHtml + '</ul>' +
      '<p class="cost-note">Waterfront: ' + esc(c.water) + '</p>' +
    '</div>';

  var mEl = document.getElementById('olMerits');
  if (c.merits) {
    var areas = '';
    c.merits.areas.forEach(function(a) {
      var chips = '';
      a.badges.forEach(function(b) {
        var hit = fBadge && b.toLowerCase().indexOf(fBadge.toLowerCase()) !== -1;
        chips += '<span class="merit-chip' + (hit ? ' merit-hit' : '') + '">' + esc(b) + '</span>';
      });
      areas += '<div class="mb-area"><div class="mb-area-name">' + esc(a.area) + '</div><div class="merit-chips">' + chips + '</div></div>';
    });
    mEl.innerHTML =
      '<div class="merits-box mb-box">' +
        '<h3 class="dbox-title">' + icon(127885) + 'Merit badges — ' + meritCount(c) + (c.merits.partial ? '+ (partial list)' : '') + '</h3>' +
        areas +
        '<p class="cost-note">Source: <a class="site-link" href="' + esc(c.merits.url) + '" target="_blank" rel="noopener">' + esc(c.merits.source) + NEW_TAB + '</a></p>' +
      '</div>';
  } else {
    mEl.innerHTML = '<div class="merits-box mb-box"><h3 class="dbox-title">' + icon(127885) + 'Merit badges</h3>' +
      '<p class="cost-note">This camp has not published its merit badge list online yet. Check its registration page or leader guide.</p></div>';
  }

  var fitHtml = '';
  c._fit.perPatrol.forEach(function(pp) {
    var chips = '';
    pp.asks.forEach(function(a) {
      chips += '<span class="ask ask-' + a.state + '">' +
        '<span class="sr-only">' + (a.state === 'yes' ? 'Met: ' : a.state === 'no' ? 'Not met: ' : a.state === 'unk' ? 'Not confirmed: ' : 'Not scored: ') + '</span>' +
        '<span aria-hidden="true">' + (a.state === 'yes' ? '&#10003; ' : a.state === 'no' ? '&#10007; ' : a.state === 'unk' ? '? ' : '') + '</span>' +
        esc(a.text) + '</span>';
    });
    fitHtml += '<div class="fit-row"><div class="fit-patrol">' + esc(pp.patrol.name) +
      ' <span>' + pp.met + '/' + pp.scorable + '</span></div><div class="fit-asks">' + chips + '</div></div>';
  });
  document.getElementById('olFit').innerHTML =
    '<div class="merits-box">' +
      '<h3 class="dbox-title">' + icon(9978) + 'Patrol fit — ' + c._fit.score + ' of ' + FIT_MAX + ' requests met</h3>' +
      fitHtml +
      '<p class="cost-note">&#10003; met · &#10007; not met · ? not confirmed on the camp’s pages · plain = not scored</p>' +
    '</div>';

  document.getElementById('overlay').classList.add('open');
  document.getElementById('listView').hidden = true;
  document.getElementById('detailView').hidden = false;
  applyMapFilter();
  // Bring the top of the results pane into view, then move focus to the heading
  var t = document.querySelector('.tr-right').getBoundingClientRect().top;
  if (t < 0 || t > window.innerHeight * 0.5) window.scrollBy(0, t);
  document.getElementById('olTitle').focus({ preventScroll: true });
  if (mapView) mapView.goTo({ center: [c.lng, c.lat], zoom: Math.max(mapView.zoom || 0, 9) }).catch(function() { /* interrupted by another move */ });
}

// Back to the list. keepPlace: false when a filter change sends the list to its top anyway.
function closeOverlay(keepPlace, fromUrl) {
  if (selId === null) return;
  selId = null;
  if (!fromUrl) syncUrl(false);
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('detailView').hidden = true;
  document.getElementById('listView').hidden = false;
  galleryToken++;   // drop photos still loading
  applyMapFilter();
  if (mapView) mapView.goTo(HOME_VIEW).catch(function() { /* interrupted by another move */ });
  if (keepPlace === false) { overlayOpener = null; return; }
  window.scrollTo(0, listScroll);
  if (overlayOpener && document.contains(overlayOpener)) overlayOpener.focus({ preventScroll: true });
  overlayOpener = null;
}

// Generated card and table markup calls this, so it must be on window
window.openCamp = openCamp;

document.getElementById('detailBack').addEventListener('click', function() { closeOverlay(); });
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (tipIsOpen()) hideTip();
  else if (sheet.isOpen()) sheet.close();
  else closeOverlay();
});

var ON_CLS = { meals: 'on', week: 'on-t', water: 'on-s', drive: 'on-b' };
var sheet = initSheet();

/* ── FILTER + SORT ─────────────────────────────────────────────────────────── */
var fMeals = 'all', fWeek = 'all', fWater = 'all', fDrive = 'all', fBadge = '', sortBy = 'fit';

// Single source of truth for the filter bar — used by the cards, the week table and the map
function matchesFilters(c) {
  var mealsOk =
    fMeals === 'all' ||
    (fMeals === 'both' ? (hasMeal(c, 'dh') && hasMeal(c, 'pc')) : hasMeal(c, fMeals));
  var weekOk = fWeek === 'all' || !!c.weeks[fWeek];
  var waterOk = fWater === 'all' || c.fresh === true;
  var driveOk = fDrive === 'all' || c.mins <= parseInt(fDrive, 10);
  // Camps that publish no merit badge list never match a badge search
  var badgeOk = !fBadge || offersBadge(c, fBadge);
  return mealsOk && weekOk && waterOk && driveOk && badgeOk;
}

function compare(a, b) {
  var byName = a.name.localeCompare(b.name);
  if (sortBy === 'name') return byName;
  if (sortBy === 'drive') return (a.mins - b.mins) || byName;
  if (sortBy === 'merits') return (meritCount(b) - meritCount(a)) || byName;
  if (sortBy === 'weeks') return (weekCount(b) - weekCount(a)) || (a.mins - b.mins) || byName;
  if (sortBy === 'cost') {
    // Camps with no posted fee sort last
    if (a.youth === null && b.youth === null) return byName;
    if (a.youth === null) return 1;
    if (b.youth === null) return -1;
    return (a.youth - b.youth) || byName;
  }
  // 'fit': best patrol fit, then shorter drive
  return (b._fit.score - a._fit.score) || (a.mins - b.mins) || byName;
}

function applyMapFilter() {
  CAMPS.forEach(function(c) {
    var g = markerById[c.id];
    // With a camp open, only its marker stays lit
    var lit = selId !== null ? c.id === selId : matchesFilters(c);
    if (g) g.symbol = markerSymbol(c, lit, c.id === selId || c.id === hoverId);
  });
}

/* ── CARDS + WEEK TABLE ────────────────────────────────────────────────────── */
var DRIVE_LABEL = { '120': 'Within 2 hr', '180': 'Within 3 hr', '210': 'Within 3.5 hr' };

// Every filter in effect, as { kind, label }, for the chips above the results
function activeFilters() {
  var out = [];
  if (fMeals !== 'all') out.push({ kind: 'meals', label: fMeals === 'both' ? 'Dining hall and patrol cooking' : MEAL_LABEL[fMeals] });
  if (fWeek !== 'all') out.push({ kind: 'week', label: 'Week of ' + weekShort(fWeek) });
  if (fWater !== 'all') out.push({ kind: 'water', label: 'Fresh water' });
  if (fDrive !== 'all') out.push({ kind: 'drive', label: DRIVE_LABEL[fDrive] || 'Drive limit' });
  if (fBadge) out.push({ kind: 'badge', label: 'Merit badge: ' + fBadge });
  return out;
}

function clearFilter(kind) {
  if (kind === 'meals' || kind === 'all') fMeals = 'all';
  if (kind === 'week' || kind === 'all') fWeek = 'all';
  if (kind === 'water' || kind === 'all') fWater = 'all';
  if (kind === 'drive' || kind === 'all') fDrive = 'all';
  if (kind === 'badge' || kind === 'all') { fBadge = ''; document.getElementById('mbSearch').value = ''; }
  renderCards();
  resultsToTop();
}

function renderCards() {
  var list = CAMPS.filter(matchesFilters).sort(compare);

  hoverId = null;
  syncButtons({ meals: fMeals, week: fWeek, water: fWater, drive: fDrive }, ON_CLS);
  renderChips(activeFilters(), clearFilter);
  syncUrl(false);
  applyMapFilter();

  document.getElementById('countBadge').textContent = list.length + ' camp' + (list.length === 1 ? '' : 's');

  if (!list.length) {
    document.getElementById('grid').innerHTML =
      '<div class="empty">&#127957;&#65039; No camps match — try broadening your filters.</div>';
    document.getElementById('wkTable').innerHTML = '';
    return;
  }

  var html = '';
  list.forEach(function(c) {
    html +=
      '<article class="card" data-id="' + c.id + '" onclick="window.openCamp(' + c.id + ')">' +
        '<div class="c-stripe s-' + c.dist + '"></div>' +
        '<div class="c-body">' +
          '<div class="c-top">' +
            '<h3 class="c-title"><button type="button" class="tr-title-btn" onclick="event.stopPropagation();window.openCamp(' + c.id + ')">' + esc(c.name) + '</button></h3>' +
            '<span class="dbadge d-' + c.dist + '"><span class="sr-only">Drive: </span>' + c.drive + '</span>' +
          '</div>' +
          '<div class="c-place">' + esc(c.place) + ' · ' + esc(c.council) + '</div>' +
          '<div class="tags">' + mealTags(c) + waterTag(c) + '</div>' +
          weekStrip(c) +
          '<p class="c-desc">' + esc(c.desc) + '</p>' +
          fitBar(c) +
          '<div class="c-merits">' + meritLine(c) + '</div>' +
          '<div class="c-cost"><span class="cost-lbl">Youth:</span><span class="cost-val">' + esc(c.youthLabel) + '</span></div>' +
        '</div>' +
        '<div class="c-foot">' +
          '<button type="button" class="detail-btn" tabindex="-1" aria-hidden="true" onclick="event.stopPropagation();window.openCamp(' + c.id + ')">Details + Photos &#8594;</button>' +
        '</div>' +
      '</article>';
  });
  document.getElementById('grid').innerHTML = html;

  renderWeekTable(list);
}

function renderWeekTable(list) {
  var head = '<thead><tr><th scope="col" class="wk-th-camp">Camp</th><th scope="col">Drive</th><th scope="col">Meals</th>';
  WEEKS.forEach(function(k) {
    head += '<th scope="col"><span class="sr-only">Week of </span>' + weekShort(k) + '</th>';
  });
  head += '<th scope="col">Youth</th><th scope="col">Fit</th></tr></thead>';

  var body = '<tbody>';
  list.forEach(function(c) {
    var meals = c.meals.length ? c.meals.map(function(m) { return MEAL_LABEL[m]; }).join(', ') : '?';
    body += '<tr onclick="window.openCamp(' + c.id + ')">' +
      '<th scope="row" class="wk-td-camp"><button type="button" class="wk-open-btn" onclick="event.stopPropagation();window.openCamp(' + c.id + ')">' + esc(c.name) + '</button></th>' +
      '<td>' + c.drive + '</td>' +
      '<td>' + esc(meals) + '</td>';
    WEEKS.forEach(function(k) {
      var s = c.weeks[k];
      body += '<td class="wk-td">' +
        (s ? '<span class="wk-pill wk-' + s + '">' + WEEK_LABEL[s] + '</span>' : '<span class="wk-dash" aria-hidden="true">—</span><span class="sr-only">Not offered</span>') +
        '</td>';
    });
    body += '<td>' + esc(c.youthLabel) + '</td><td>' + c._fit.score + '/' + FIT_MAX + '</td></tr>';
  });
  body += '</tbody>';

  document.getElementById('wkTable').innerHTML = head + body;
}

/* ── CONTROLS ──────────────────────────────────────────────────────────────── */
document.querySelectorAll('.fb[data-g]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var g = btn.getAttribute('data-g');
    var v = btn.getAttribute('data-v');
    if      (g === 'meals') fMeals = v;
    else if (g === 'week')  fWeek  = v;
    else if (g === 'water') fWater = v;
    else if (g === 'drive') fDrive = v;
    closeOverlay(false);
    renderCards();
    resultsToTop();
  });
});

document.getElementById('sortSel').addEventListener('change', function() {
  sortBy = this.value;
  closeOverlay(false);
  renderCards();
  resultsToTop();
});

/* ── MERIT BADGE SEARCH ───────────────────────────────────────────────────── */
(function fillBadgeList() {
  var seen = {};
  CAMPS.forEach(function(c) { (meritList(c) || []).forEach(function(b) { seen[b] = true; }); });
  var opts = '';
  Object.keys(seen).sort().forEach(function(b) { opts += '<option value="' + esc(b) + '">'; });
  document.getElementById('mbList').innerHTML = opts;
}());

document.getElementById('mbSearch').addEventListener('input', function() {
  fBadge = this.value.trim();
  closeOverlay(false);
  renderCards();
  resultsToTop();
});

/* ── HOVER: a result lights up its marker; week cells show their status ───── */
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
  bindDataTips(document.querySelector('.tr-right'));
  bindDataTips(document.getElementById('overlay'));
}());

/* ── INIT ──────────────────────────────────────────────────────────────────── */
/* ── VIEW: GRID OR CALENDAR ────────────────────────────────────────────────── */
// The same filtered, sorted camps as cards (grid) or as the week-by-week table (calendar)
var view = 'grid';

function setView(v) {
  view = v;
  document.getElementById('gridView').hidden = v !== 'grid';
  document.getElementById('calView').hidden = v !== 'calendar';
  document.querySelectorAll('.fb[data-view]').forEach(function(b) {
    var on = b.getAttribute('data-view') === v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

document.querySelectorAll('.fb[data-view]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    setView(btn.getAttribute('data-view'));
    syncUrl(false);
    resultsToTop();
  });
});

/* ── SHAREABLE URL ─────────────────────────────────────────────────────────── */
// ?view=calendar&sort=drive&meals=dh&week=07-04&water=fresh&drive=180&badge=Welding&camp=camp-olmsted
var applyingUrl = false;   // true while the page is being set from the address

function syncUrl(push) {
  if (applyingUrl) return;
  setUrl({
    sort:  sortBy !== 'fit' ? sortBy : '',
    meals: fMeals !== 'all' ? fMeals : '',
    week:  fWeek  !== 'all' ? fWeek  : '',
    water: fWater !== 'all' ? fWater : '',
    drive: fDrive !== 'all' ? fDrive : '',
    badge: fBadge,
    camp:  selId !== null ? byId(selId)._slug : '',
    view:  view !== 'grid' ? view : ''
  }, push);
}

// Set the sort, filters and open camp from the address (page load, back/forward)
function applyUrl() {
  var p = urlParams();
  applyingUrl = true;
  var sortSel = document.getElementById('sortSel');
  var sort = p.get('sort');
  sortBy = sort && sortSel.querySelector('option[value="' + sort.replace(/[^a-z]/g, '') + '"]') ? sort : 'fit';
  sortSel.value = sortBy;
  fMeals = buttonParam(p, 'meals', 'meals');
  fWeek  = buttonParam(p, 'week', 'week');
  fWater = buttonParam(p, 'water', 'water');
  fDrive = buttonParam(p, 'drive', 'drive');
  fBadge = (p.get('badge') || '').trim().slice(0, 60);
  document.getElementById('mbSearch').value = fBadge;
  setView(p.get('view') === 'calendar' ? 'calendar' : 'grid');
  var item = findItem(CAMPS, p.get('camp'));
  if (item) {
    renderCards();
    window.openCamp(item.id, true);
  } else {
    closeOverlay(true, true);
    renderCards();
  }
  applyingUrl = false;
  refreshPrintQr();
}

window.addEventListener('popstate', applyUrl);
bindCopyLinks();

// Print and pocket map of the camps the current filters show, in the current order
bindTools({
  pocket: function() {
    var filters = activeFilters().map(function(f) { return f.label; }).join(' · ');
    return {
      title: 'Troop 380 Summer Camp 2027',
      subtitle: filters || 'Scout camps within 5 hours of DC',
      places: CAMPS.filter(matchesFilters).sort(compare).map(function(c) {
        var meals = c.meals.map(function(m) { return MEAL_LABEL[m]; }).join(', ');
        var weeks = WEEKS.filter(function(k) { return !!c.weeks[k]; }).map(weekShort).join(', ');
        return {
          lng: c.lng, lat: c.lat, name: c.name,
          summary: c.drive + ' drive' + (meals ? ' · ' + meals : '') + ' · Youth ' + c.youthLabel + (weeks ? ' · 2027 weeks: ' + weeks : ''),
          link: (c.links[0] && c.links[0].url) || (window.location.origin + window.location.pathname + '?camp=' + c._slug)
        };
      })
    };
  }
});

document.getElementById('hdrCount').textContent = CAMPS.length + ' options';
applyUrl();
