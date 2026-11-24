'use strict';

/* ── IMPORTS ───────────────────────────────────────────────────────────────── */
import { EVENTS, COURSES, VENUES, COUNCILS, UNDATED, DATA_AS_OF } from './training-data.js';

import Map           from 'https://js.arcgis.com/5.0/@arcgis/core/Map.js';
import MapView       from 'https://js.arcgis.com/5.0/@arcgis/core/views/MapView.js';
import Graphic       from 'https://js.arcgis.com/5.0/@arcgis/core/Graphic.js';
import GraphicsLayer from 'https://js.arcgis.com/5.0/@arcgis/core/layers/GraphicsLayer.js';
import Home          from 'https://js.arcgis.com/5.0/@arcgis/core/widgets/Home.js';
import Search        from 'https://js.arcgis.com/5.0/@arcgis/core/widgets/Search.js';

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

/* ── STATE ─────────────────────────────────────────────────────────────────── */
var fAud = 'all', fCourse = 'all', fCouncil = 'all', fDrive = 'all', fMonth = '';
// Locations and days can hold several picks (Shift-click adds one); a course matches any of them.
// fLocs holds VENUES keys, plus 'virtual' or 'none' from the Location dropdown.
var fLocs = [], fDays = [];

// Plain click: pick only this one, or clear it if it is already the only pick.
// Shift-click: add it to the picks, or take it out.
function pick(list, value, add) {
  var i = list.indexOf(value);
  if (add) {
    if (i === -1) list.push(value); else list.splice(i, 1);
    return list;
  }
  return (list.length === 1 && i === 0) ? [] : [value];
}

function atLoc(ev, k) { return k === 'none' ? !ev.venue : k === 'virtual' ? !!ev.virtual : ev.venue === k; }
function locLabel(k) { return VENUES[k] ? VENUES[k].name : k === 'virtual' ? 'Has an online session' : 'Location not posted'; }
function dayLabel(iso) { var dd = toDate(iso); return DOW[dd.getDay()] + ', ' + MONTHS[dd.getMonth()] + ' ' + dd.getDate() + ', ' + dd.getFullYear(); }
var selId = null;       // the course open in the results pane, or null for the list
var listScroll = 0;     // page scroll to return to when leaving a course
var mapView = null;

function byId(id) {
  for (var i = 0; i < EVENTS.length; i++) { if (EVENTS[i].id === id) return EVENTS[i]; }
  return null;
}

/* ── FILTERS ───────────────────────────────────────────────────────────────── */
// Everything except the calendar picks (month, day). The calendar uses this so
// that the other days stay coloured while one day or month is selected.
function matchesBase(ev) {
  if (!isUpcoming(ev)) return false;
  var a = aud(ev);
  var audOk = fAud === 'all' || a === 'both' || a === fAud;
  var courseOk = fCourse === 'all' || ev.course === fCourse;
  var locOk = !fLocs.length || fLocs.some(function(k) { return atLoc(ev, k); });
  var councilOk = fCouncil === 'all' || ev.council === fCouncil;
  // A course with no posted location cannot be said to be inside a drive limit
  var v = venue(ev);
  var driveOk = fDrive === 'all' || (v && v.mins <= parseInt(fDrive, 10));
  return audOk && courseOk && locOk && councilOk && driveOk;
}

// Single source of truth for the course list
function matchesFilters(ev) {
  return matchesBase(ev) &&
    (!fMonth || ev._days.some(function(d) { return d.slice(0, 7) === fMonth; })) &&
    (!fDays.length || fDays.some(function(d) { return ev._days.indexOf(d) !== -1; }));
}

// What the map shows: the open course alone, or everything in the list
function onMap(ev) { return selId !== null ? ev.id === selId : matchesFilters(ev); }
// What the calendar colours: the open course alone, or everything the filter bar allows
function onCalendar(ev) { return selId !== null ? ev.id === selId : matchesBase(ev); }

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
// Same values as --tr-youth / --tr-adult / --tr-both in styles.css (white text passes 4.5:1 on each)
var AUD_COLOR = { youth: [39, 103, 157], adult: [176, 78, 38], both: [91, 58, 140] };
var MUTED_COLOR = [176, 176, 176, 0.45];
var PICK_OUTLINE = [212, 167, 44];
var HOME_VIEW = { center: [-77.1, 39.0], zoom: 7 };
var markerByVenue = {};

function venueEvents(key) {
  return EVENTS.filter(function(ev) { return ev.venue === key && onMap(ev); });
}

// One colour when every course at a venue is for the same audience, else "both"
function listAud(list) {
  var a = aud(list[0]);
  for (var i = 1; i < list.length; i++) { if (aud(list[i]) !== a) return 'both'; }
  return a;
}

// picked: the venue chosen as the location filter, or the open course's venue
function venueSymbol(list, picked) {
  if (!list.length) {
    return { type: 'simple-marker', style: 'circle', color: MUTED_COLOR, size: '9px', outline: { color: [255, 255, 255, 0.6], width: 1 } };
  }
  var size = Math.min(26, 13 + list.length) + (picked ? 5 : 0);
  return {
    type: 'simple-marker', style: 'circle', color: AUD_COLOR[listAud(list)], size: size + 'px',
    outline: picked ? { color: PICK_OUTLINE, width: 3.5 } : { color: [255, 255, 255], width: 2 }
  };
}

// Venues to outline: the open course's, the hovered result's, or the location picks
function pickedVenues() {
  if (selId !== null) return [byId(selId).venue];
  if (hoverId !== null) return [byId(hoverId).venue];
  return fLocs;
}

(function initMap() {
  var esriMap = new Map({ basemap: 'topo-vector' });
  // Clicking a marker filters the course list, so the default popup is switched off
  mapView = new MapView({ container: 'mapView', map: esriMap, center: HOME_VIEW.center, zoom: HOME_VIEW.zoom, popupEnabled: false });
  var layer = new GraphicsLayer();
  esriMap.add(layer);

  // Home returns to the starting view; Search finds a place or address to compare against the markers
  mapView.ui.add(new Home({ view: mapView }), 'top-left');
  mapView.ui.add(new Search({ view: mapView, popupEnabled: false, allPlaceholder: 'Find a place or address' }), 'top-right');

  // Home marker: Capitol Hill, where drive times are measured from
  layer.add(new Graphic({
    geometry: { type: 'point', longitude: -76.996, latitude: 38.889 },
    symbol: { type: 'simple-marker', style: 'diamond', color: [26, 58, 42], size: '12px', outline: { color: [255, 255, 255], width: 2 } }
  }));

  Object.keys(VENUES).forEach(function(key) {
    var v = VENUES[key];
    var g = new Graphic({
      geometry: { type: 'point', longitude: v.lng, latitude: v.lat },
      attributes: { venue: key },
      symbol: venueSymbol(venueEvents(key), false)
    });
    layer.add(g);
    markerByVenue[key] = g;
  });

  mapView.on('click', function(e) {
    mapView.hitTest(e).then(function(hit) {
      var key = null;
      hit.results.forEach(function(r) {
        if (!key && r.graphic && r.graphic.attributes && r.graphic.attributes.venue) key = r.graphic.attributes.venue;
      });
      var shift = !!(e.native && e.native.shiftKey);
      if (!key) {
        // A click on empty map clears the location picks; a Shift-click leaves them alone
        if (shift || !fLocs.length) return;
        fLocs = [];
      } else {
        fLocs = pick(selId === null ? fLocs : [], key, shift);
      }
      selId = null;
      hideTip();
      render();
      resultsToTop();
    });
  });

  // Hover card for markers, the same one the calendar uses
  var overKey = null;
  mapView.on('pointer-move', function(e) {
    mapView.hitTest(e).then(function(hit) {
      var key = null;
      hit.results.forEach(function(r) {
        if (!key && r.graphic && r.graphic.attributes && r.graphic.attributes.venue) key = r.graphic.attributes.venue;
      });
      mapView.container.style.cursor = key ? 'pointer' : '';
      if (key === overKey) return;
      overKey = key;
      if (!key) { hideTipSoon(); return; }
      // Anchor the card to the marker itself, not the pointer
      var box = mapView.container.getBoundingClientRect();
      var pt = mapView.toScreen(markerByVenue[key].geometry);
      showVenueTip(key, { left: box.left + pt.x - 12, right: box.left + pt.x + 12, top: box.top + pt.y - 12, bottom: box.top + pt.y + 12, width: 24 });
    });
  });
  mapView.on('pointer-leave', function() { overKey = null; hideTipSoon(); });
  mapView.on('drag', function() { overKey = null; hideTip(); });
}());

function applyMap() {
  var picked = pickedVenues();
  Object.keys(markerByVenue).forEach(function(key) {
    markerByVenue[key].symbol = venueSymbol(venueEvents(key), picked.indexOf(key) !== -1);
  });
}

/* ── COURSE DETAILS (shown in the results pane) ────────────────────────────── */
function audTag(ev) {
  return '<span class="tag tr-aud-' + aud(ev) + '">' + AUD_LABEL[aud(ev)] + '</span>';
}

// Link to the Scouting America page about the course
function learnLink(ev) {
  var c = course(ev);
  if (!c.learn) return '';
  return '<a class="site-link" href="' + esc(c.learn) + '" target="_blank" rel="noopener"' +
    ' onclick="event.stopPropagation()">About ' + esc(c.name) + ' at Scouting America <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span></a>';
}

// Decorative emoji, hidden from screen readers
function icon(code) { return '<span aria-hidden="true">&#' + code + ';</span> '; }
var ICON = { what: icon(127891), when: icon(128197), cost: icon(128176), where: icon(128205), know: icon(128204) };

function renderDetail(ev) {
  var c = course(ev);
  var v = venue(ev);
  var council = COUNCILS[ev.council];

  document.getElementById('olTitle').textContent = title(ev);

  document.getElementById('olMeta').innerHTML =
    audTag(ev) +
    (ev.virtual ? '<span class="tag t-day">Part online</span>' : '') +
    '<span class="tag t-def">' + esc(ev.host) + '</span>' +
    '<span class="tag t-bsa">' + esc(council.name) + '</span>';

  document.getElementById('olDesc').innerHTML =
    '<div class="dbox tr-what">' +
      '<h3 class="dbox-title">' + ICON.what + 'What</h3>' +
      '<p class="tr-what-name">' + esc(c.full) + '</p>' +
      '<p class="tr-what-text">' + esc(c.desc) + '</p>' +
    '</div>';

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
      '<a class="site-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + v.lat + '%2C' + v.lng + '" target="_blank" rel="noopener">Open in Google Maps <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span></a>';
  } else {
    whereHtml = '<div class="cost-big">Location not posted</div>' +
      '<p class="cost-note">The council calendar gives no location for this course yet.</p>';
  }

  var regHtml = ev.url ?
    '<a class="site-link" href="' + esc(ev.url) + '" target="_blank" rel="noopener">Registration page <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span></a>' :
    '<a class="site-link" href="' + esc(council.url) + '" target="_blank" rel="noopener">' + esc(council.short) + ' training page <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span></a>';

  document.getElementById('olGrid').innerHTML =
    '<div class="dbox">' +
      '<h3 class="dbox-title">' + ICON.when + 'When</h3>' +
      '<ul class="req-list">' + sessHtml + '</ul>' +
      (ev.time ? '<p class="cost-note">' + esc(ev.time) + '</p>' : '') +
      '<h3 class="dbox-title dbox-title-gap">' + ICON.cost + 'Cost</h3>' +
      '<div class="cost-sub">' + (ev.cost ? esc(ev.cost) : 'Not listed — see the registration page') + '</div>' +
      '<div class="ol-links">' + regHtml + learnLink(ev) + '</div>' +
    '</div>' +
    '<div class="dbox">' +
      '<h3 class="dbox-title">' + ICON.where + 'Where</h3>' +
      whereHtml +
    '</div>';

  var noteHtml = '';
  ev.notes.forEach(function(n) { noteHtml += '<li>' + esc(n) + '</li>'; });
  document.getElementById('olNotes').innerHTML = noteHtml ?
    '<div class="merits-box"><h3 class="dbox-title">' + ICON.know + 'Know before you register</h3><ul class="req-list">' + noteHtml + '</ul></div>' : '';
}

// Bring the top of the results pane into view when it is off screen
function showResultsTop() {
  var t = document.querySelector('.tr-right').getBoundingClientRect().top;
  if (t < 0 || t > window.innerHeight * 0.5) window.scrollBy(0, t);
}

function openTraining(id) {
  var ev = byId(id);
  if (!ev) return;
  if (selId === null) listScroll = window.scrollY;
  selId = id;
  render();
  showResultsTop();
  // Move keyboard and screen-reader focus to the course that just opened
  document.getElementById('olTitle').focus({ preventScroll: true });

  var v = venue(ev);
  if (v && mapView) {
    mapView.goTo({ center: [v.lng, v.lat], zoom: Math.max(mapView.zoom || 0, 9) }).catch(function() { /* interrupted by another move */ });
  }
  // Scroll the calendar to the course's first month
  var m = document.querySelector('.tr-month[data-month="' + firstDay(ev).slice(0, 7) + '"]');
  var cal = document.getElementById('cal');
  if (m && window.matchMedia('(max-width: 900px)').matches) cal.scrollLeft = m.offsetLeft - cal.offsetLeft;
  else if (m) m.scrollIntoView({ block: 'nearest' });
}

function closeTraining() {
  if (selId === null) return;
  var was = selId;
  selId = null;
  render();
  window.scrollTo(0, listScroll);
  // Return focus to the card the visitor came from
  var back = document.querySelector('.tr-title-btn[data-id="' + was + '"]');
  if (back) back.focus({ preventScroll: true });
  if (mapView) mapView.goTo(HOME_VIEW).catch(function() { /* interrupted by another move */ });
}

// Generated card markup calls this, so it must be on window
window.openTraining = openTraining;

document.getElementById('detailBack').addEventListener('click', closeTraining);
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('calTip').hidden) { hideTip(); return; }
  if (document.body.classList.contains('tr-sheet-on')) closeSheet();
  else closeTraining();
});

/* ── CALENDAR ──────────────────────────────────────────────────────────────── */
// Every month from this one (or the first course) to the last course, as 'YYYY-MM'
function calendarSpan() {
  var first = null, last = null;
  EVENTS.forEach(function(ev) {
    if (!isUpcoming(ev)) return;
    var a = firstDay(ev).slice(0, 7), b = lastDay(ev).slice(0, 7);
    if (!first || a < first) first = a;
    if (!last || b > last) last = b;
  });
  if (!first) return [];
  if (first < TODAY.slice(0, 7)) first = TODAY.slice(0, 7);
  var out = [];
  var y = parseInt(first.slice(0, 4), 10), m = parseInt(first.slice(5), 10);
  while (y + '-' + pad(m) <= last) {
    out.push(y + '-' + pad(m));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function monthLabel(k) { return MONTHS_LONG[parseInt(k.slice(5), 10) - 1] + ' ' + k.slice(0, 4); }

var calByDay = {};   // day -> courses coloured on the calendar, for the hover card

function renderCalendar() {
  var byDay = {};
  calByDay = byDay;
  hideTip();
  EVENTS.filter(onCalendar).forEach(function(ev) {
    ev._days.forEach(function(d) { (byDay[d] = byDay[d] || []).push(ev); });
  });

  var html = '';
  calendarSpan().forEach(function(k) {
    var y = parseInt(k.slice(0, 4), 10), m = parseInt(k.slice(5), 10) - 1;
    var lead = new Date(y, m, 1).getDay();
    var count = new Date(y, m + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="tr-day tr-day-pad"></span>';
    for (var d = 1; d <= count; d++) {
      var iso = k + '-' + pad(d);
      var list = byDay[iso];
      var cls = 'tr-day' + (iso === TODAY ? ' tr-day-today' : '') + (fDays.indexOf(iso) !== -1 && selId === null ? ' tr-day-on' : '');
      if (list) {
        var names = list.map(function(ev) { return course(ev).name; }).join(', ');
        cells += '<button type="button" class="' + cls + ' tr-day-ev tr-bg-' + listAud(list) + '" data-day="' + iso + '"' +
          ' aria-pressed="' + (fDays.indexOf(iso) !== -1 && selId === null ? 'true' : 'false') + '"' + (iso === TODAY ? ' aria-current="date"' : '') +
          ' aria-label="' + MONTHS_LONG[m] + ' ' + d + ', ' + list.length + (list.length === 1 ? ' course: ' : ' courses: ') + esc(names) + '">' +
          d + (list.length > 1 ? '<span class="tr-day-n" aria-hidden="true">' + list.length + '</span>' : '') + '</button>';
      } else {
        cells += '<span class="' + cls + '">' + d + '</span>';
      }
    }
    var on = k === fMonth && selId === null;
    html +=
      '<div class="tr-month' + (on ? ' tr-month-on' : '') + '" data-month="' + k + '">' +
        '<button type="button" class="tr-month-name" data-month="' + k + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
          ' title="Show only ' + monthLabel(k) + '">' + monthLabel(k) + '</button>' +
        '<div class="tr-dow" aria-hidden="true"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>' +
        '<div class="tr-days">' + cells + '</div>' +
      '</div>';
  });
  var cal = document.getElementById('cal');
  var keepLeft = cal.scrollLeft;
  cal.innerHTML = html || '<div class="empty">No months to show.</div>';
  cal.scrollLeft = keepLeft;

  document.querySelectorAll('#cal .tr-day-ev').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      var day = btn.getAttribute('data-day');
      fDays = pick(selId === null ? fDays : [], day, e.shiftKey);
      fMonth = '';
      selId = null;
      render();
      resultsToTop();
      refocus('#cal .tr-day-ev[data-day="' + day + '"]');
    });
  });
  document.querySelectorAll('#cal .tr-month-name').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var k = btn.getAttribute('data-month');
      fMonth = (fMonth === k && selId === null) ? '' : k;
      fDays = [];
      selId = null;
      render();
      resultsToTop();
      refocus('#cal .tr-month-name[data-month="' + k + '"]');
    });
  });
}

/* ── ACTIVE FILTERS (chips above the results) ──────────────────────────────── */
var AUD_CHIP = { youth: 'For youth', adult: 'For adults' };

// Every filter in effect, as { kind, label }
function activeFilters() {
  var out = [];
  if (fAud !== 'all') out.push({ kind: 'aud', label: AUD_CHIP[fAud] });
  if (fCourse !== 'all') out.push({ kind: 'course', label: COURSES[fCourse].name });
  fLocs.forEach(function(k) { out.push({ kind: 'loc:' + k, label: locLabel(k) }); });
  if (fCouncil !== 'all') out.push({ kind: 'council', label: COUNCILS[fCouncil].name });
  if (fDrive !== 'all') out.push({ kind: 'drive', label: 'Within ' + driveText(parseInt(fDrive, 10)) });
  if (fMonth) out.push({ kind: 'month', label: monthLabel(fMonth) });
  fDays.slice().sort().forEach(function(d) { out.push({ kind: 'day:' + d, label: dayLabel(d) }); });
  return out;
}

function clearFilter(kind) {
  if (kind === 'aud' || kind === 'all') fAud = 'all';
  if (kind === 'course' || kind === 'all') fCourse = 'all';
  if (kind === 'all') fLocs = [];
  if (kind.indexOf('loc:') === 0) fLocs = fLocs.filter(function(k) { return k !== kind.slice(4); });
  if (kind === 'council' || kind === 'all') fCouncil = 'all';
  if (kind === 'drive' || kind === 'all') fDrive = 'all';
  if (kind === 'month' || kind === 'all') fMonth = '';
  if (kind === 'all') fDays = [];
  if (kind.indexOf('day:') === 0) fDays = fDays.filter(function(d) { return d !== kind.slice(4); });
}

function renderActive() {
  var list = activeFilters();
  var html = '';
  list.forEach(function(f) {
    html += '<li><button type="button" class="tr-chip" data-clear="' + f.kind + '">' +
      '<span class="sr-only">Remove filter: </span>' + esc(f.label) + ' <span aria-hidden="true">&#10005;</span></button></li>';
  });
  if (list.length) {
    html += '<li><button type="button" class="tr-chip tr-chip-all" data-clear="all">Clear all filters</button></li>';
  }
  document.getElementById('activeBar').innerHTML = html;
  document.getElementById('activeBar').hidden = !list.length;
  document.querySelectorAll('#activeBar .tr-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
      clearFilter(btn.getAttribute('data-clear'));
      render();
      resultsToTop();
      // The chip is gone: put focus on the next one, or on the results heading
      var next = document.querySelector('#activeBar .tr-chip') || document.getElementById('resultsTitle');
      next.focus({ preventScroll: true });
    });
  });

  // Number of filter-bar choices in effect, shown on the phone's Filters button
  var n = (fAud !== 'all') + (fCourse !== 'all') + (fLocs.length > 0) + (fCouncil !== 'all') + (fDrive !== 'all');
  document.getElementById('filterOpen').textContent = 'Filters' + (n ? ' (' + n + ')' : '');
}

// Make the filter bar's buttons and dropdowns match the state (it can change from chips and the map)
function syncControls() {
  var state = { aud: fAud, drive: fDrive };
  document.querySelectorAll('.fb[data-g]').forEach(function(b) {
    var g = b.getAttribute('data-g');
    var on = b.getAttribute('data-v') === state[g];
    b.classList.remove('on', 'on-b');
    if (on) b.classList.add(g === 'drive' ? 'on-b' : 'on');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.getElementById('courseSel').value = fCourse;
  // The dropdown holds one location; with several picked it shows a "several" placeholder
  document.getElementById('locSel').value = !fLocs.length ? 'all' : fLocs.length === 1 ? fLocs[0] : 'multi';
  document.getElementById('councilSel').value = fCouncil;
}

// After a filter change, bring the first result back into view
function resultsToTop() {
  var t = document.querySelector('.tr-right').getBoundingClientRect().top;
  if (t < 0) window.scrollBy(0, t);
}

// Re-rendering replaces calendar buttons; put focus back on the one that was used
function refocus(selector) {
  var el = document.querySelector(selector);
  if (el) el.focus({ preventScroll: true });
}

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
      '<article class="card" data-id="' + ev.id + '" onclick="window.openTraining(' + ev.id + ')">' +
        '<div class="c-stripe tr-bg-' + aud(ev) + '"></div>' +
        '<div class="c-body">' +
          '<div class="tr-head">' +
            dateBlock(ev) +
            '<div class="tr-head-text">' +
              '<h3 class="c-title"><button type="button" class="tr-title-btn" data-id="' + ev.id + '"' +
                ' onclick="event.stopPropagation();window.openTraining(' + ev.id + ')">' + esc(ev.title || course(ev).name) +
                '<span class="sr-only">, ' + esc(datesText(ev)) + '</span></button></h3>' +
              '<div class="c-place">' + esc(course(ev).full) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tags">' + audTag(ev) +
            (ev.virtual ? '<span class="tag t-day">Part online</span>' : '') +
            (v ? '<span class="tag t-def">' + driveText(v.mins) + '</span>' : '') +
          '</div>' +
          more +
          '<p class="c-desc">' + esc(placeText(ev)) + ' · ' + esc(ev.host) + '</p>' +
          '<div class="c-cost"><span class="cost-lbl">Cost:</span><span class="cost-val">' + (ev.cost ? esc(ev.cost) : 'See registration') + '</span>' +
            '<span class="cost-lbl tr-council">' + esc(COUNCILS[ev.council].short) + '</span></div>' +
        '</div>' +
        '<div class="c-foot">' +
          '<button type="button" class="detail-btn" tabindex="-1" aria-hidden="true" onclick="event.stopPropagation();window.openTraining(' + ev.id + ')">Details + Registration &#8594;</button>' +
          learnLink(ev) +
        '</div>' +
      '</article>';
  });
  document.getElementById('grid').innerHTML = html;
}

/* ── HOVER: a result lights up its venue and its dates ─────────────────────── */
var hoverId = null;

function setHover(id) {
  if (id === hoverId) return;
  hoverId = id;
  document.querySelectorAll('#cal .tr-day-hl').forEach(function(el) { el.classList.remove('tr-day-hl'); });
  var ev = id === null ? null : byId(id);
  document.getElementById('cal').classList.toggle('tr-cal-hover', !!ev);
  applyMap();
  if (!ev) return;
  ev._days.forEach(function(d) {
    var cell = document.querySelector('#cal .tr-day-ev[data-day="' + d + '"]');
    if (cell) cell.classList.add('tr-day-hl');
  });
}

(function bindHover() {
  var grid = document.getElementById('grid');
  function cardId(target) {
    var card = target && target.closest ? target.closest('.card') : null;
    return card ? parseInt(card.getAttribute('data-id'), 10) : null;
  }
  grid.addEventListener('mouseover', function(e) { setHover(cardId(e.target)); });
  grid.addEventListener('mouseleave', function() { setHover(null); });
  grid.addEventListener('focusin', function(e) { setHover(cardId(e.target)); });
  grid.addEventListener('focusout', function() { setHover(null); });
}());

/* ── CALENDAR HOVER CARD ───────────────────────────────────────────────────── */
// Shown on hover and on keyboard focus. It can be hovered itself and Escape
// dismisses it (WCAG 1.4.13). The day's aria-label already names the courses,
// so the card is hidden from screen readers.
var tipTimer = null;

function hideTip() {
  clearTimeout(tipTimer);
  var tip = document.getElementById('calTip');
  if (tip) tip.hidden = true;
}

function showTip(btn) {
  clearTimeout(tipTimer);
  var day = btn.getAttribute('data-day');
  var list = (calByDay[day] || []).slice().sort(compare);
  if (!list.length) return;
  var dd = toDate(day);
  var html = '<div class="tr-tip-date">' + DOW[dd.getDay()] + ', ' + MONTHS_LONG[dd.getMonth()] + ' ' + dd.getDate() + '</div><ul>';
  list.slice(0, 8).forEach(function(ev) {
    html += '<li><span class="tr-tip-dot tr-bg-' + aud(ev) + '"></span>' +
      '<span><b>' + esc(ev.title || course(ev).name) + '</b><br>' + esc(placeText(ev)) + '</span></li>';
  });
  html += '</ul>';
  if (list.length > 8) html += '<div class="tr-tip-more">+ ' + (list.length - 8) + ' more — click the day to list them</div>';
  placeTip(html, btn.getBoundingClientRect());
}

function hideTipSoon() { clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 150); }

// The same card for a map marker: the venue and its matching courses
function showVenueTip(key, rect) {
  clearTimeout(tipTimer);
  var v = VENUES[key];
  var list = venueEvents(key).sort(compare);
  var html = '<div class="tr-tip-date">' + esc(v.name) + ' · ' + driveText(v.mins) + '</div>';
  if (!list.length) {
    html += '<div class="tr-tip-more">No courses here match the filters.</div>';
  } else {
    html += '<ul>';
    list.slice(0, 8).forEach(function(ev) {
      html += '<li><span class="tr-tip-dot tr-bg-' + aud(ev) + '"></span>' +
        '<span><b>' + esc(ev.title || course(ev).name) + '</b><br>' + esc(datesText(ev)) + '</span></li>';
    });
    html += '</ul>';
    if (list.length > 8) html += '<div class="tr-tip-more">+ ' + (list.length - 8) + ' more — click the marker to list them</div>';
  }
  placeTip(html, rect);
}

// r: the screen rectangle the card points at
function placeTip(html, r) {
  var tip = document.getElementById('calTip');
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

(function bindTip() {
  var cal = document.getElementById('cal');
  var tip = document.getElementById('calTip');
  var later = hideTipSoon;
  function dayOf(target) { return target && target.closest ? target.closest('.tr-day-ev') : null; }
  cal.addEventListener('mouseover', function(e) { var b = dayOf(e.target); if (b) showTip(b); });
  cal.addEventListener('mouseout', function(e) { if (dayOf(e.target)) later(); });
  cal.addEventListener('focusin', function(e) { var b = dayOf(e.target); if (b) showTip(b); });
  cal.addEventListener('focusout', later);
  tip.addEventListener('mouseenter', function() { clearTimeout(tipTimer); });
  tip.addEventListener('mouseleave', later);
  document.querySelector('.tr-left').addEventListener('scroll', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });
}());

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
      (u.url ? '<a class="site-link" href="' + esc(u.url) + '" target="_blank" rel="noopener">' + esc(u.name.split(' — ')[0]) + ' link <span aria-hidden="true">&#8599;</span> <span class="sr-only">(opens in a new tab)</span></a>' : '') +
    '</li>';
  });
  document.getElementById('undated').innerHTML = html || '<li class="tr-und">None for these filters.</li>';
}

function render() {
  hoverId = null;
  var ev = selId !== null ? byId(selId) : null;
  document.getElementById('listView').hidden = !!ev;
  document.getElementById('detailView').hidden = !ev;
  syncControls();
  applyMap();
  renderCalendar();
  if (ev) {
    renderDetail(ev);
  } else {
    renderActive();
    renderCards();
    renderUndated();
  }
}

/* ── CONTROLS ──────────────────────────────────────────────────────────────── */
function option(value, label) { return '<option value="' + esc(value) + '">' + esc(label) + '</option>'; }

(function fillSelects() {
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
  lHtml += '<option value="multi" hidden>Several locations</option>';
  document.getElementById('locSel').innerHTML = lHtml;

  var keys = Object.keys(COUNCILS);
  var kHtml = option('all', 'All councils');
  keys.forEach(function(k) { kHtml += option(k, COUNCILS[k].name); });
  document.getElementById('councilSel').innerHTML = kHtml;
  // A council filter with one council in it is noise
  if (keys.length < 2) document.getElementById('councilGroup').hidden = true;
}());

document.querySelectorAll('.fb[data-g]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var g = btn.getAttribute('data-g');
    var v = btn.getAttribute('data-v');
    if      (g === 'aud')   fAud = v;
    else if (g === 'drive') fDrive = v;
    selId = null;
    render();
    resultsToTop();
  });
});

function bindSelect(id, set) {
  document.getElementById(id).addEventListener('change', function() {
    set(this.value);
    selId = null;
    render();
    resultsToTop();
  });
}
bindSelect('courseSel',  function(v) { fCourse = v; });
bindSelect('locSel',     function(v) { fLocs = (v === 'all' || v === 'multi') ? [] : [v]; });
bindSelect('councilSel', function(v) { fCouncil = v; });

/* ── FILTER SHEET (phones) ─────────────────────────────────────────────────── */
// On narrow screens the filter bar is a bottom sheet; these classes do nothing on wide ones
function openSheet() {
  var sheet = document.getElementById('filterSheet');
  document.body.classList.add('tr-sheet-on');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  document.getElementById('filterOpen').setAttribute('aria-expanded', 'true');
  // The sheet becomes visible on the next frame; focus cannot land in it before then
  setTimeout(function() { document.getElementById('filterClose').focus(); }, 60);
}
function closeSheet() {
  if (!document.body.classList.contains('tr-sheet-on')) return;
  var sheet = document.getElementById('filterSheet');
  document.body.classList.remove('tr-sheet-on');
  sheet.removeAttribute('role');
  sheet.removeAttribute('aria-modal');
  document.getElementById('filterOpen').setAttribute('aria-expanded', 'false');
  document.getElementById('filterOpen').focus();
}
// Keep Tab inside the sheet while it is open
document.getElementById('filterSheet').addEventListener('keydown', function(e) {
  if (e.key !== 'Tab' || !document.body.classList.contains('tr-sheet-on')) return;
  var items = Array.prototype.filter.call(this.querySelectorAll('button, select'), function(el) { return el.offsetParent !== null; });
  var first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
document.getElementById('filterOpen').addEventListener('click', openSheet);
document.getElementById('filterClose').addEventListener('click', closeSheet);
document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);

/* ── INIT ──────────────────────────────────────────────────────────────────── */
document.getElementById('hdrCount').textContent =
  EVENTS.filter(isUpcoming).length + ' upcoming';
document.getElementById('hdrCouncils').textContent = Object.keys(COUNCILS).length + ' within 3 hours';
document.getElementById('hdrAsOf').textContent = DATA_AS_OF;
render();
