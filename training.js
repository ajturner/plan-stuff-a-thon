'use strict';

/* ── IMPORTS ───────────────────────────────────────────────────────────────── */
import { EVENTS, COURSES, VENUES, COUNCILS, UNDATED, DATA_AS_OF } from './training-data.js';

import Map           from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView       from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic       from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';

/* ── HELPERS ───────────────────────────────────────────────────────────────── */
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var AUD_LABEL = { youth: 'Youth', adult: 'Adult', both: 'Youth and adult' };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pad(n) { return (n < 10 ? '0' : '') + n; }

// 'YYYY-MM-DD' <-> local Date (never via Date.parse, which reads the string as UTC)
function toDate(iso) {
  var p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}
function toIso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

var TODAY = toIso(new Date());

function course(ev) { return COURSES[ev.course]; }
function aud(ev) { return ev.aud || course(ev).aud; }
function venue(ev) { return ev.venue ? VENUES[ev.venue] : null; }
function title(ev) { return ev.title || (course(ev).name === course(ev).full ? course(ev).full : course(ev).name + ' — ' + course(ev).full); }
function firstDay(ev) { return ev.sessions[0].s; }
function lastDay(ev) { return ev.sessions[ev.sessions.length - 1].e; }
function isUpcoming(ev) { return lastDay(ev) >= TODAY; }

// 'Mar 13–14, 2027' / 'Dec 26–31, 2026' / 'Jan 30 – Feb 1, 2027'
function rangeText(s, e) {
  var a = toDate(s), b = toDate(e);
  if (s === e) return MONTHS[a.getMonth()] + ' ' + a.getDate() + ', ' + a.getFullYear();
  if (a.getMonth() === b.getMonth()) return MONTHS[a.getMonth()] + ' ' + a.getDate() + '–' + b.getDate() + ', ' + a.getFullYear();
  return MONTHS[a.getMonth()] + ' ' + a.getDate() + ' – ' + MONTHS[b.getMonth()] + ' ' + b.getDate() + ', ' + b.getFullYear();
}

function dowText(s, e) {
  var a = toDate(s), b = toDate(e);
  return s === e ? DOW[a.getDay()] : DOW[a.getDay()] + '–' + DOW[b.getDay()];
}

function datesText(ev) {
  return ev.sessions.map(function(x) { return rangeText(x.s, x.e); }).join(' + ');
}

// Every calendar day an event covers, as ISO strings
function eventDays(ev) {
  var out = [];
  ev.sessions.forEach(function(x) {
    var d = toDate(x.s), end = toDate(x.e);
    while (d <= end) { out.push(toIso(d)); d.setDate(d.getDate() + 1); }
  });
  return out;
}
EVENTS.forEach(function(ev) { ev._days = eventDays(ev); });

function placeText(ev) {
  var v = venue(ev);
  return v ? v.name : 'Location not posted';
}

// 'Haymarket, VA' from '6100 Antioch Rd, Haymarket, VA 20169'
function venueTown(v) {
  var p = v.addr.split(', ');
  if (p.length < 3) return p[p.length - 1];
  return p[p.length - 2] + ', ' + p[p.length - 1].split(' ')[0];
}

function driveText(mins) {
  if (mins < 60) return mins + ' min';
  var h = Math.round(mins / 30) / 2;
  return h + ' hr';
}

/* ── FILTERS ───────────────────────────────────────────────────────────────── */
var fAud = 'all', fWhen = 'upcoming', fMonth = 'all', fCourse = 'all', fLoc = 'all',
    fCouncil = 'all', fDrive = 'all', fDay = '';

// Everything except the single-day pick. The calendar uses this so that the
// other days stay coloured while one day is selected.
function matchesBase(ev) {
  var a = aud(ev);
  var audOk = fAud === 'all' || a === 'both' || a === fAud;
  var whenOk = fWhen === 'all' || isUpcoming(ev);
  var monthOk = fMonth === 'all' || ev._days.some(function(d) { return d.slice(0, 7) === fMonth; });
  var courseOk = fCourse === 'all' || ev.course === fCourse;
  var locOk = fLoc === 'all' ||
    (fLoc === 'none' ? !ev.venue : fLoc === 'virtual' ? !!ev.virtual : ev.venue === fLoc);
  var councilOk = fCouncil === 'all' || ev.council === fCouncil;
  // A course with no posted location cannot be said to be inside a drive limit
  var v = venue(ev);
  var driveOk = fDrive === 'all' || (v && v.mins <= parseInt(fDrive, 10));
  return audOk && whenOk && monthOk && courseOk && locOk && councilOk && driveOk;
}

// Single source of truth for the cards and the map
function matchesFilters(ev) {
  return matchesBase(ev) && (!fDay || ev._days.indexOf(fDay) !== -1);
}

function compare(a, b) {
  // Order by the next day still to come, so a two-part course that is half over sorts by its second part
  function key(ev) {
    for (var i = 0; i < ev._days.length; i++) { if (ev._days[i] >= TODAY) return ev._days[i]; }
    return firstDay(ev);
  }
  var ka = key(a), kb = key(b);
  return ka < kb ? -1 : ka > kb ? 1 : title(a).localeCompare(title(b));
}

/* ── ARCGIS MAP (SDK 5 ES modules) ─────────────────────────────────────────── */
var AUD_COLOR = { youth: [47, 127, 191], adult: [192, 86, 43], both: [91, 58, 140] };
var MUTED_COLOR = [176, 176, 176, 0.45];
var markerByVenue = {};

function venueEvents(key) {
  return EVENTS.filter(function(ev) { return ev.venue === key && matchesFilters(ev); }).sort(compare);
}

// One colour when every matching course at a venue is for the same audience, else "both"
function venueAud(list) {
  var a = aud(list[0]);
  for (var i = 1; i < list.length; i++) { if (aud(list[i]) !== a) return 'both'; }
  return a;
}

function venueSymbol(list) {
  if (!list.length) {
    return { type: 'simple-marker', style: 'circle', color: MUTED_COLOR, size: '9px', outline: { color: [255, 255, 255, 0.6], width: 1 } };
  }
  var size = Math.min(26, 13 + list.length);
  return { type: 'simple-marker', style: 'circle', color: AUD_COLOR[venueAud(list)], size: size + 'px', outline: { color: [255, 255, 255], width: 2 } };
}

// Popup content must be a DOM node, not an HTML string: SDK 5 sanitises string
// content and strips buttons and their listeners (see AGENTS.md).
function buildPopupNode(key) {
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  var v = VENUES[key];
  var list = venueEvents(key);
  var wrap = el('div', 'map-pop');
  wrap.appendChild(el('div', 'map-pop-title', v.name));
  wrap.appendChild(el('div', 'map-pop-meta', driveText(v.mins) + ' from DC · ' + v.addr));
  if (!list.length) {
    wrap.appendChild(el('div', 'map-pop-cost', 'No courses here match the filters.'));
    return wrap;
  }
  wrap.appendChild(el('div', 'map-pop-cost', list.length + ' matching course' + (list.length === 1 ? '' : 's')));
  list.slice(0, 8).forEach(function(ev) {
    var btn = el('button', 'map-pop-btn tr-pop-btn', course(ev).name + ' · ' + datesText(ev));
    btn.type = 'button';
    btn.addEventListener('click', function() { window.openTraining(ev.id); });
    wrap.appendChild(btn);
  });
  if (list.length > 8) wrap.appendChild(el('div', 'map-pop-meta', '+ ' + (list.length - 8) + ' more in the list below'));
  return wrap;
}

(function initMap() {
  var esriMap = new Map({ basemap: 'topo-vector' });
  var view = new MapView({ container: 'mapView', map: esriMap, center: [-77.1, 39.0], zoom: 7 });
  var layer = new GraphicsLayer();
  esriMap.add(layer);

  // Home marker: Capitol Hill, where drive times are measured from
  layer.add(new Graphic({
    geometry: { type: 'point', longitude: -76.996, latitude: 38.889 },
    symbol: { type: 'simple-marker', style: 'diamond', color: [26, 58, 42], size: '12px', outline: { color: [255, 255, 255], width: 2 } },
    popupTemplate: { title: 'Troop 380 · Capitol Hill', content: 'Drive times are estimated from here.' }
  }));

  Object.keys(VENUES).forEach(function(key) {
    var v = VENUES[key];
    var g = new Graphic({
      geometry: { type: 'point', longitude: v.lng, latitude: v.lat },
      symbol: venueSymbol(venueEvents(key)),
      popupTemplate: { title: v.name, content: function() { return buildPopupNode(key); } }
    });
    layer.add(g);
    markerByVenue[key] = g;
  });
}());

function applyMapFilter() {
  Object.keys(markerByVenue).forEach(function(key) {
    markerByVenue[key].symbol = venueSymbol(venueEvents(key));
  });
}

/* ── OVERLAY ───────────────────────────────────────────────────────────────── */
function audTag(ev) {
  return '<span class="tag tr-aud-' + aud(ev) + '">' + AUD_LABEL[aud(ev)] + '</span>';
}

function openTraining(id) {
  var ev = null;
  for (var i = 0; i < EVENTS.length; i++) { if (EVENTS[i].id === id) { ev = EVENTS[i]; break; } }
  if (!ev) return;
  var c = course(ev);
  var v = venue(ev);
  var council = COUNCILS[ev.council];

  document.getElementById('olTitle').textContent = title(ev);

  document.getElementById('olMeta').innerHTML =
    audTag(ev) +
    (ev.virtual ? '<span class="tag t-day">Part online</span>' : '') +
    (isUpcoming(ev) ? '' : '<span class="tag t-def">Past</span>') +
    '<span class="tag t-def">' + esc(ev.host) + '</span>' +
    '<span class="tag t-bsa">' + esc(council.name) + '</span>';

  document.getElementById('olDesc').textContent = c.desc;

  var sessHtml = '';
  ev.sessions.forEach(function(x) {
    sessHtml += '<li>' + (x.label ? '<b>' + esc(x.label) + ':</b> ' : '') +
      dowText(x.s, x.e) + ', ' + rangeText(x.s, x.e) + '</li>';
  });

  var whereHtml;
  if (v) {
    whereHtml =
      '<div class="cost-big">' + esc(v.name) + '</div>' +
      '<p class="cost-note">' + esc(v.addr) + '</p>' +
      '<div class="cost-sub">About ' + driveText(v.mins) + ' from Capitol Hill</div>' +
      '<a class="site-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + v.lat + '%2C' + v.lng + '" target="_blank" rel="noopener">Open in Google Maps &#8599;</a>';
  } else {
    whereHtml = '<div class="cost-big">Location not posted</div>' +
      '<p class="cost-note">The council calendar gives no location for this course yet.</p>';
  }

  var regHtml = ev.url ?
    '<a class="site-link" href="' + esc(ev.url) + '" target="_blank" rel="noopener">Registration page &#8599;</a>' :
    '<a class="site-link" href="' + esc(council.url) + '" target="_blank" rel="noopener">' + esc(council.short) + ' training page &#8599;</a>';

  document.getElementById('olGrid').innerHTML =
    '<div class="dbox">' +
      '<div class="dbox-title">&#128197; When</div>' +
      '<ul class="req-list">' + sessHtml + '</ul>' +
      (ev.time ? '<p class="cost-note">' + esc(ev.time) + '</p>' : '') +
      '<div class="dbox-title dbox-title-gap">&#128176; Cost</div>' +
      '<div class="cost-sub">' + (ev.cost ? esc(ev.cost) : 'Not listed — see the registration page') + '</div>' +
      '<div class="ol-links">' + regHtml + '</div>' +
    '</div>' +
    '<div class="dbox">' +
      '<div class="dbox-title">&#128205; Where</div>' +
      whereHtml +
    '</div>';

  var noteHtml = '';
  ev.notes.forEach(function(n) { noteHtml += '<li>' + esc(n) + '</li>'; });
  document.getElementById('olNotes').innerHTML = noteHtml ?
    '<div class="merits-box"><div class="dbox-title">&#128204; Know before you register</div><ul class="req-list">' + noteHtml + '</ul></div>' : '';

  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Generated card markup and map popups call this, so it must be on window
window.openTraining = openTraining;

document.getElementById('olClose').addEventListener('click', closeOverlay);
document.getElementById('overlay').addEventListener('click', function(e) {
  if (e.target === this) closeOverlay();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeOverlay();
});

/* ── CALENDAR ──────────────────────────────────────────────────────────────── */
// First and last month to draw, as 'YYYY-MM'
function calendarSpan() {
  var first = null, last = null;
  EVENTS.forEach(function(ev) {
    if (fWhen !== 'all' && !isUpcoming(ev)) return;
    var a = firstDay(ev).slice(0, 7), b = lastDay(ev).slice(0, 7);
    if (!first || a < first) first = a;
    if (!last || b > last) last = b;
  });
  if (!first) return [];
  if (fWhen !== 'all' && first < TODAY.slice(0, 7)) first = TODAY.slice(0, 7);
  var out = [];
  var y = parseInt(first.slice(0, 4), 10), m = parseInt(first.slice(5), 10);
  while (y + '-' + pad(m) <= last) {
    out.push(y + '-' + pad(m));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function renderCalendar() {
  // Day -> matching events, ignoring the single-day pick
  var byDay = {};
  EVENTS.filter(matchesBase).forEach(function(ev) {
    ev._days.forEach(function(d) { (byDay[d] = byDay[d] || []).push(ev); });
  });

  var months = calendarSpan();
  if (fMonth !== 'all') months = months.filter(function(k) { return k === fMonth; });

  var html = '';
  months.forEach(function(k) {
    var y = parseInt(k.slice(0, 4), 10), m = parseInt(k.slice(5), 10) - 1;
    var lead = new Date(y, m, 1).getDay();
    var count = new Date(y, m + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="tr-day tr-day-pad"></span>';
    for (var d = 1; d <= count; d++) {
      var iso = k + '-' + pad(d);
      var list = byDay[iso];
      var cls = 'tr-day' + (iso === TODAY ? ' tr-day-today' : '') + (iso === fDay ? ' tr-day-on' : '');
      if (list) {
        var names = list.map(function(ev) { return course(ev).name; }).join(', ');
        cells += '<button type="button" class="' + cls + ' tr-day-ev tr-bg-' + venueAud(list) + '" data-day="' + iso + '"' +
          ' title="' + esc(names) + '" aria-label="' + MONTHS_LONG[m] + ' ' + d + ': ' + esc(names) + '">' +
          d + (list.length > 1 ? '<span class="tr-day-n">' + list.length + '</span>' : '') + '</button>';
      } else {
        cells += '<span class="' + cls + '">' + d + '</span>';
      }
    }
    html +=
      '<div class="tr-month">' +
        '<div class="tr-month-name">' + MONTHS_LONG[m] + ' ' + y + '</div>' +
        '<div class="tr-dow"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>' +
        '<div class="tr-days">' + cells + '</div>' +
      '</div>';
  });
  document.getElementById('cal').innerHTML = html || '<div class="empty">No months to show.</div>';

  document.querySelectorAll('#cal .tr-day-ev').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var day = btn.getAttribute('data-day');
      fDay = (fDay === day) ? '' : day;
      render();
    });
  });

  var bar = document.getElementById('dayBar');
  if (fDay) {
    var dd = toDate(fDay);
    document.getElementById('dayBarText').textContent =
      'Showing ' + DOW[dd.getDay()] + ', ' + MONTHS_LONG[dd.getMonth()] + ' ' + dd.getDate() + ', ' + dd.getFullYear();
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

document.getElementById('dayClear').addEventListener('click', function() { fDay = ''; render(); });

/* ── CARDS ─────────────────────────────────────────────────────────────────── */
function dateBlock(ev) {
  var a = toDate(firstDay(ev));
  var s0 = ev.sessions[0];
  var days = s0.s === s0.e ? String(a.getDate()) :
    (toDate(s0.e).getMonth() === a.getMonth() ? a.getDate() + '–' + toDate(s0.e).getDate() : a.getDate() + '+');
  return '<div class="tr-date">' +
           '<span class="tr-date-m">' + MONTHS[a.getMonth()] + ' ' + a.getFullYear() + '</span>' +
           '<span class="tr-date-d">' + days + '</span>' +
           '<span class="tr-date-w">' + dowText(s0.s, s0.e) + '</span>' +
         '</div>';
}

function renderCards() {
  var list = EVENTS.filter(matchesFilters).sort(compare);

  document.getElementById('countBadge').textContent = list.length + ' course' + (list.length === 1 ? '' : 's');

  if (!list.length) {
    document.getElementById('grid').innerHTML =
      '<div class="empty">&#127891; No courses match — try broadening your filters.</div>';
    return;
  }

  var html = '';
  list.forEach(function(ev) {
    var v = venue(ev);
    var more = ev.sessions.length > 1 ?
      '<div class="c-merits">' + esc(ev.sessions.map(function(x) { return (x.label ? x.label + ' ' : '') + rangeText(x.s, x.e); }).join(' · ')) + '</div>' : '';
    html +=
      '<article class="card' + (isUpcoming(ev) ? '' : ' tr-past') + '" onclick="window.openTraining(' + ev.id + ')" tabindex="0" role="button" aria-label="' + esc(title(ev)) + ', ' + esc(datesText(ev)) + '">' +
        '<div class="c-stripe tr-bg-' + aud(ev) + '"></div>' +
        '<div class="c-body">' +
          '<div class="tr-head">' +
            dateBlock(ev) +
            '<div class="tr-head-text">' +
              '<div class="c-title">' + esc(ev.title || course(ev).name) + '</div>' +
              '<div class="c-place">' + esc(course(ev).full) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tags">' + audTag(ev) +
            (ev.virtual ? '<span class="tag t-day">Part online</span>' : '') +
            (v ? '<span class="tag t-def">' + driveText(v.mins) + '</span>' : '') +
            (isUpcoming(ev) ? '' : '<span class="tag t-def">Past</span>') +
          '</div>' +
          more +
          '<p class="c-desc">' + esc(placeText(ev)) + ' · ' + esc(ev.host) + '</p>' +
          '<div class="c-cost"><span class="cost-lbl">Cost:</span><span class="cost-val">' + (ev.cost ? esc(ev.cost) : 'See registration') + '</span>' +
            '<span class="cost-lbl tr-council">' + esc(COUNCILS[ev.council].short) + '</span></div>' +
        '</div>' +
        '<div class="c-foot">' +
          '<button class="detail-btn" onclick="event.stopPropagation();window.openTraining(' + ev.id + ')">Details + Registration &#8594;</button>' +
        '</div>' +
      '</article>';
  });
  document.getElementById('grid').innerHTML = html;

  document.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

/* ── UNDATED COURSES ───────────────────────────────────────────────────────── */
function renderUndated() {
  var list = UNDATED.filter(function(u) {
    return (fAud === 'all' || u.aud === 'both' || u.aud === fAud) &&
           (fCouncil === 'all' || u.council === fCouncil);
  });
  var html = '';
  list.forEach(function(u) {
    html += '<li class="tr-und">' +
      '<span class="tr-und-dot tr-bg-' + u.aud + '"></span>' +
      '<span class="tr-und-name">' + esc(u.name) + '</span>' +
      (u.note ? '<span class="tr-und-note">' + esc(u.note) + '</span>' : '') +
      '<span class="tr-und-note">' + esc(COUNCILS[u.council].short) + '</span>' +
      (u.url ? '<a class="site-link" href="' + esc(u.url) + '" target="_blank" rel="noopener">Link &#8599;</a>' : '') +
    '</li>';
  });
  document.getElementById('undated').innerHTML = html || '<li class="tr-und">None for these filters.</li>';
}

function render() {
  applyMapFilter();
  renderCalendar();
  renderCards();
  renderUndated();
}

/* ── CONTROLS ──────────────────────────────────────────────────────────────── */
function option(value, label) { return '<option value="' + esc(value) + '">' + esc(label) + '</option>'; }

(function fillSelects() {
  // Months that have at least one event day
  var seen = {};
  EVENTS.forEach(function(ev) { ev._days.forEach(function(d) { seen[d.slice(0, 7)] = true; }); });
  var mHtml = option('all', 'Any month');
  Object.keys(seen).sort().forEach(function(k) {
    mHtml += option(k, MONTHS_LONG[parseInt(k.slice(5), 10) - 1] + ' ' + k.slice(0, 4));
  });
  document.getElementById('monthSel').innerHTML = mHtml;

  var used = {};
  EVENTS.forEach(function(ev) { used[ev.course] = true; });
  var cHtml = option('all', 'All courses');
  Object.keys(used).sort(function(a, b) { return COURSES[a].name.localeCompare(COURSES[b].name); }).forEach(function(k) {
    cHtml += option(k, COURSES[k].name === COURSES[k].full ? COURSES[k].full : COURSES[k].name + ' — ' + COURSES[k].full);
  });
  document.getElementById('courseSel').innerHTML = cHtml;

  var lHtml = option('all', 'Anywhere');
  Object.keys(VENUES).sort(function(a, b) { return VENUES[a].name.localeCompare(VENUES[b].name); }).forEach(function(k) {
    lHtml += option(k, VENUES[k].name + ' · ' + venueTown(VENUES[k]));
  });
  lHtml += option('virtual', 'Has an online session');
  lHtml += option('none', 'Location not posted');
  document.getElementById('locSel').innerHTML = lHtml;

  var keys = Object.keys(COUNCILS);
  var kHtml = option('all', 'All councils');
  keys.forEach(function(k) { kHtml += option(k, COUNCILS[k].name); });
  document.getElementById('councilSel').innerHTML = kHtml;
  // A council filter with one council in it is noise
  if (keys.length < 2) document.getElementById('councilGroup').hidden = true;
}());

var ON_CLS = { aud: 'on', when: 'on-t', drive: 'on-b' };
document.querySelectorAll('.fb[data-g]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var g = btn.getAttribute('data-g');
    var v = btn.getAttribute('data-v');
    document.querySelectorAll('[data-g="' + g + '"]').forEach(function(b) {
      b.classList.remove('on', 'on-t', 'on-s', 'on-b');
    });
    btn.classList.add(ON_CLS[g] || 'on');
    if      (g === 'aud')   fAud = v;
    else if (g === 'when')  fWhen = v;
    else if (g === 'drive') fDrive = v;
    fDay = '';
    render();
  });
});

function bindSelect(id, set) {
  document.getElementById(id).addEventListener('change', function() {
    set(this.value);
    fDay = '';
    render();
  });
}
bindSelect('monthSel',   function(v) { fMonth = v; });
bindSelect('courseSel',  function(v) { fCourse = v; });
bindSelect('locSel',     function(v) { fLoc = v; });
bindSelect('councilSel', function(v) { fCouncil = v; });

/* ── INIT ──────────────────────────────────────────────────────────────────── */
document.getElementById('hdrCount').textContent =
  EVENTS.filter(isUpcoming).length + ' upcoming';
document.getElementById('hdrCouncils').textContent = Object.keys(COUNCILS).length + ' within 3 hours';
document.getElementById('hdrAsOf').textContent = DATA_AS_OF;
render();
