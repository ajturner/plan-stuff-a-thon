'use strict';

/* ── IMPORTS ───────────────────────────────────────────────────────────────── */
import { CAMPS, WEEKS, SURVEY_WEEKS, PATROLS } from './camps-data.js';

import Map           from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView       from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic       from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';

/* ── HELPERS ───────────────────────────────────────────────────────────────── */
var MEAL_LABEL = { dh: 'Dining hall', pc: 'Patrol cooking', hs: 'Heater stack' };
var WEEK_LABEL = { open: 'Open', almost: 'Almost full', listed: 'Offered', full: 'Full' };
var SHORT_DRIVE_MINS = 150; // "Short drive" request: 2.5 hours or less

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// Popup content must be a DOM node, not an HTML string: SDK 5 sanitises string
// content and strips the button and its listener (see AGENTS.md).
function buildPopupNode(c) {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  var wrap = el('div', 'map-pop');
  wrap.appendChild(el('div', 'map-pop-title', c.name));
  wrap.appendChild(el('div', 'map-pop-meta', c.drive + ' from DC · ' + c.place));
  wrap.appendChild(el('div', 'map-pop-cost', 'Youth: ' + c.youthLabel));
  var btn = el('button', 'map-pop-btn', 'View details');
  btn.type = 'button';
  btn.addEventListener('click', function() { window.openCamp(c.id); });
  wrap.appendChild(btn);
  return wrap;
}

function markerSymbol(c, active) {
  return {
    type: 'simple-marker',
    style: 'circle',
    color: active ? distColor[c.dist] : MUTED_COLOR,
    size: active ? '14px' : '9px',
    outline: { color: active ? [255, 255, 255] : [255, 255, 255, 0.6], width: active ? 2 : 1 }
  };
}

(function initMap() {
  var esriMap = new Map({ basemap: 'topo-vector' });
  var view = new MapView({ container: 'mapView', map: esriMap, center: [-77.6, 39.0], zoom: 6 });
  var layer = new GraphicsLayer();
  esriMap.add(layer);

  // Home marker: Capitol Hill, where drive times are measured from
  layer.add(new Graphic({
    geometry: { type: 'point', longitude: -76.996, latitude: 38.889 },
    symbol: { type: 'simple-marker', style: 'diamond', color: [26, 58, 42], size: '12px', outline: { color: [255, 255, 255], width: 2 } },
    popupTemplate: { title: 'Troop 380 · Capitol Hill', content: 'Drive times are estimated from here.' }
  }));

  CAMPS.forEach(function(c) {
    var g = new Graphic({
      geometry: { type: 'point', longitude: c.lng, latitude: c.lat },
      symbol: markerSymbol(c, true),
      popupTemplate: { title: c.name, content: function() { return buildPopupNode(c); } }
    });
    layer.add(g);
    markerById[c.id] = g;
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
    var survey = SURVEY_WEEKS.indexOf(k) !== -1 ? ' wk-survey' : '';
    var title = weekShort(k) + ': ' + (s ? WEEK_LABEL[s] : 'Not offered');
    html += '<span class="wk-cell ' + cls + survey + '" title="' + title + '">' + weekShort(k) + '</span>';
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
function openCamp(id) {
  var c = null;
  for (var i = 0; i < CAMPS.length; i++) { if (CAMPS[i].id === id) { c = CAMPS[i]; break; } }
  if (!c) return;

  loadGallery(c.wiki || []);

  document.getElementById('olTitle').textContent = c.name;

  document.getElementById('olMeta').innerHTML =
    '<span class="tag dbadge d-' + c.dist + '">' + c.drive + '</span>' +
    '<span class="tag t-def">' + esc(c.place) + '</span>' +
    mealTags(c) + waterTag(c) +
    '<span class="tag t-bsa">' + esc(c.council) + '</span>';

  document.getElementById('olDesc').textContent = c.desc;

  var wkHtml = '<div class="dbox-title">&#128197; 2027 weeks (Sunday start)</div>' + weekStrip(c);
  document.getElementById('olWeeks').innerHTML = wkHtml;

  var linkHtml = '';
  c.links.forEach(function(l) {
    linkHtml += '<a class="site-link" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' &#8599;</a> ';
  });
  var progHtml = '';
  c.programs.forEach(function(p) { progHtml += '<li>' + esc(p) + '</li>'; });
  var noteHtml = '';
  c.notes.forEach(function(n) { noteHtml += '<li>' + esc(n) + '</li>'; });

  document.getElementById('olGrid').innerHTML =
    '<div class="dbox">' +
      '<div class="dbox-title">&#128176; Cost</div>' +
      '<div class="cost-big">Youth ' + esc(c.youthLabel) + '</div>' +
      '<div class="cost-sub">Adults: ' + esc(c.adult) + '</div>' +
      '<p class="cost-note">' + esc(c.costNote) + '</p>' +
      '<div class="ol-links">' + linkHtml + '</div>' +
    '</div>' +
    '<div class="dbox">' +
      '<div class="dbox-title">&#127957;&#65039; Activities</div>' +
      '<ul class="req-list">' + progHtml + '</ul>' +
      '<div class="dbox-title dbox-title-gap">&#128204; Know before you book</div>' +
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
        '<div class="dbox-title">&#127885; Merit badges — ' + meritCount(c) + (c.merits.partial ? '+ (partial list)' : '') + '</div>' +
        areas +
        '<p class="cost-note">Source: <a class="site-link" href="' + esc(c.merits.url) + '" target="_blank" rel="noopener">' + esc(c.merits.source) + ' &#8599;</a></p>' +
      '</div>';
  } else {
    mEl.innerHTML = '<div class="merits-box mb-box"><div class="dbox-title">&#127885; Merit badges</div>' +
      '<p class="cost-note">This camp has not published its merit badge list online yet. Check its registration page or leader guide.</p></div>';
  }

  var fitHtml = '';
  c._fit.perPatrol.forEach(function(pp) {
    var chips = '';
    pp.asks.forEach(function(a) {
      chips += '<span class="ask ask-' + a.state + '">' +
        (a.state === 'yes' ? '&#10003; ' : a.state === 'no' ? '&#10007; ' : a.state === 'unk' ? '? ' : '') +
        esc(a.text) + '</span>';
    });
    fitHtml += '<div class="fit-row"><div class="fit-patrol">' + esc(pp.patrol.name) +
      ' <span>' + pp.met + '/' + pp.scorable + '</span></div><div class="fit-asks">' + chips + '</div></div>';
  });
  document.getElementById('olFit').innerHTML =
    '<div class="merits-box">' +
      '<div class="dbox-title">&#9978;&#65039; Patrol fit — ' + c._fit.score + ' of ' + FIT_MAX + ' requests met</div>' +
      fitHtml +
      '<p class="cost-note">&#10003; met · &#10007; not met · ? not confirmed on the camp’s pages · plain = not scored</p>' +
    '</div>';

  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Generated card and table markup calls this, so it must be on window
window.openCamp = openCamp;

document.getElementById('olClose').addEventListener('click', closeOverlay);
document.getElementById('overlay').addEventListener('click', function(e) {
  if (e.target === this) closeOverlay();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeOverlay();
});

/* ── FILTER + SORT ─────────────────────────────────────────────────────────── */
var fMeals = 'all', fWeek = 'all', fWater = 'all', fDrive = 'all', fBadge = '', sortBy = 'fit';

// Single source of truth for the filter bar — used by the cards, the week table and the map
function matchesFilters(c) {
  var mealsOk =
    fMeals === 'all' ||
    (fMeals === 'both' ? (hasMeal(c, 'dh') && hasMeal(c, 'pc')) : hasMeal(c, fMeals));
  var weekOk =
    fWeek === 'all' ||
    (fWeek === 'survey' ? SURVEY_WEEKS.some(function(k) { return !!c.weeks[k]; }) : !!c.weeks[fWeek]);
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
    if (g) g.symbol = markerSymbol(c, matchesFilters(c));
  });
}

/* ── CARDS + WEEK TABLE ────────────────────────────────────────────────────── */
function renderCards() {
  var list = CAMPS.filter(matchesFilters).sort(compare);

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
      '<article class="card" onclick="window.openCamp(' + c.id + ')" tabindex="0" role="button" aria-label="' + esc(c.name) + '">' +
        '<div class="c-stripe s-' + c.dist + '"></div>' +
        '<div class="c-body">' +
          '<div class="c-top">' +
            '<div class="c-title">' + esc(c.name) + '</div>' +
            '<span class="dbadge d-' + c.dist + '">' + c.drive + '</span>' +
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
          '<button class="detail-btn" onclick="event.stopPropagation();window.openCamp(' + c.id + ')">Details + Photos &#8594;</button>' +
        '</div>' +
      '</article>';
  });
  document.getElementById('grid').innerHTML = html;

  document.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  renderWeekTable(list);
}

function renderWeekTable(list) {
  var head = '<thead><tr><th class="wk-th-camp">Camp</th><th>Drive</th><th>Meals</th>';
  WEEKS.forEach(function(k) {
    head += '<th class="' + (SURVEY_WEEKS.indexOf(k) !== -1 ? 'wk-th-survey' : '') + '">' + weekShort(k) + '</th>';
  });
  head += '<th>Youth</th><th>Fit</th></tr></thead>';

  var body = '<tbody>';
  list.forEach(function(c) {
    var meals = c.meals.length ? c.meals.map(function(m) { return MEAL_LABEL[m]; }).join(', ') : '?';
    body += '<tr onclick="window.openCamp(' + c.id + ')" tabindex="0">' +
      '<td class="wk-td-camp">' + esc(c.name) + '</td>' +
      '<td>' + c.drive + '</td>' +
      '<td>' + esc(meals) + '</td>';
    WEEKS.forEach(function(k) {
      var s = c.weeks[k];
      var survey = SURVEY_WEEKS.indexOf(k) !== -1 ? ' wk-td-survey' : '';
      body += '<td class="wk-td' + survey + '">' +
        (s ? '<span class="wk-pill wk-' + s + '">' + WEEK_LABEL[s] + '</span>' : '<span class="wk-dash">—</span>') +
        '</td>';
    });
    body += '<td>' + esc(c.youthLabel) + '</td><td>' + c._fit.score + '/' + FIT_MAX + '</td></tr>';
  });
  body += '</tbody>';

  document.getElementById('wkTable').innerHTML = head + body;
  document.querySelectorAll('#wkTable tbody tr').forEach(function(tr) {
    tr.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tr.click(); }
    });
  });
}

/* ── CONTROLS ──────────────────────────────────────────────────────────────── */
var ON_CLS = { meals: 'on', week: 'on-t', water: 'on-s', drive: 'on-b' };
document.querySelectorAll('.fb').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var g = btn.getAttribute('data-g');
    var v = btn.getAttribute('data-v');
    document.querySelectorAll('[data-g="' + g + '"]').forEach(function(b) {
      b.classList.remove('on', 'on-t', 'on-s', 'on-b');
    });
    btn.classList.add(ON_CLS[g] || 'on');
    if      (g === 'meals') fMeals = v;
    else if (g === 'week')  fWeek  = v;
    else if (g === 'water') fWater = v;
    else if (g === 'drive') fDrive = v;
    renderCards();
  });
});

document.getElementById('sortSel').addEventListener('change', function() {
  sortBy = this.value;
  renderCards();
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
  renderCards();
});

/* ── INIT ──────────────────────────────────────────────────────────────────── */
document.getElementById('hdrCount').textContent = CAMPS.length + ' options';
renderCards();
