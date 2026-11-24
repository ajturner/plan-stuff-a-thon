'use strict';

import { NEARBY_COUNCILS, NEARBY_COURSES, NEARBY_VENUES, NEARBY_EVENTS } from './training-nearby-data.js';

/* Training page data — training/index.html.
   This file holds the troop's own council (NCAC). Courses from nearby councils
   live in training-nearby-data.js and are merged into the exports below.
   Source for NCAC: "NCAC Training Calendar, November 17, 2026" (PDF), with each
   dated line checked against its scoutingevent.com registration page on
   November 23, 2026. Where the two disagree the registration page wins and the
   difference is recorded in the event's notes. */

export const DATA_AS_OF = 'Nov 23, 2026';

/* Councils shown on the page, NCAC first. */
export const COUNCILS = Object.assign({
  NCAC: { name: 'National Capital Area Council', short: 'NCAC', url: 'https://www.ncacbsa.org/training/' }
}, NEARBY_COUNCILS);

/* Courses. aud: 'youth' | 'adult' | 'both'. An event may override it with its own `aud`. */
export const COURSES = Object.assign({
  BALOO: { name: 'BALOO', full: 'Basic Adult Leader Outdoor Orientation', aud: 'adult',
    desc: 'Overnight outdoor training for Cub Scout leaders. A pack needs a BALOO-trained adult on every pack campout.' },
  IOLS: { name: 'IOLS', full: 'Introduction to Outdoor Leader Skills', aud: 'adult',
    desc: 'Hands-on outdoor skills through First Class. Required for Scoutmasters and Assistant Scoutmasters to be fully trained.' },
  BCOLS: { name: 'BCOLS', full: 'Back Country Outdoor Leader Skills', aud: 'adult',
    desc: 'Backcountry trek leadership for adults. Each course is a classroom day plus a field weekend; you attend both.' },
  SST: { name: 'SST', full: 'Scoutmaster & Assistant Scoutmaster Specific Training', aud: 'adult',
    desc: 'Position-specific classroom training for Scoutmasters and Assistant Scoutmasters.' },
  CSLST: { name: 'CSLST', full: 'Cub Scout Leader Specific Training', aud: 'adult',
    desc: 'Position-specific classroom training for den leaders, Cubmasters and pack committee members.' },
  DCT: { name: 'Den Chief', full: 'Den Chief Training', aud: 'youth',
    desc: 'Half-day training for Scouts serving, or about to serve, as den chiefs with a Cub Scout pack.' },
  NYLT: { name: 'NYLT', full: 'National Youth Leadership Training', aud: 'youth',
    desc: 'Six-day youth leadership course run as a model troop. Scouts must be 13 by the course start and First Class if registered in a troop.' },
  WFA: { name: 'WFA', full: 'Wilderness First Aid', aud: 'both',
    desc: 'Two-day wilderness first aid course run by NCAC Camping. Includes 3–5 hours of online work before the first class. Bring your own lunch.' },
  LNT1: { name: 'LNT Level 1', full: 'Leave No Trace Level 1', aud: 'both',
    desc: 'Overnight Leave No Trace instructor course. Graduates can teach Leave No Trace awareness sessions to units.' },
  FOT: { name: 'Fundamentals', full: 'Fundamentals of Training: Science of Training and Craft of Training', aud: 'both',
    desc: 'Train-the-trainer day. Required for Wood Badge and NYLT staff, youth and adult.' },
  UOS: { name: 'UoS', full: 'University of Scouting', aud: 'adult',
    desc: 'The council\'s annual one-day conference of elective classes for adult leaders.' },
  COMM: { name: 'Commissioners College', full: 'Commissioners College', aud: 'adult',
    desc: 'Annual training day for unit, district and council commissioners.' }
}, NEARBY_COURSES);

/* Venues. mins = estimated drive from Capitol Hill, used for the drive filter. */
export const VENUES = Object.assign({
  snyder:   { name: 'Camp William B. Snyder', addr: '6100 Antioch Rd, Haymarket, VA 20169', lat: 38.828021, lng: -77.665942, mins: 55 },
  uscg:     { name: 'U.S. Coast Guard Station', addr: '7323 Telegraph Rd, Alexandria, VA 22315', lat: 38.7569237, lng: -77.1338812, mins: 30 },
  heritage: { name: 'Heritage Presbyterian Church', addr: '8503 Fort Hunt Rd, Alexandria, VA 22308', lat: 38.7253614, lng: -77.0578177, mins: 30 },
  kings:    { name: 'Kings Landing Park', addr: '2285 Kings Landing Rd, Huntingtown, MD 20639', lat: 38.628302, lng: -76.654421, mins: 60 },
  church:   { name: 'Churchill Village South Community Center', addr: '13601 Wanegarden Dr, Germantown, MD 20874', lat: 39.1846436, lng: -77.2841594, mins: 55 },
  becket:   { name: 'Saint Thomas à Becket Catholic Church', addr: '1421 Wiehle Ave, Reston, VA 20190', lat: 38.9719527, lng: -77.3326557, mins: 40 },
  hartwood: { name: 'Hartwood Presbyterian Church', addr: '50 Hartwood Church Rd, Fredericksburg, VA 22406', lat: 38.4019975, lng: -77.567075, mins: 75 }
}, NEARBY_VENUES);

var NYLT_URL = 'https://scoutingevent.com/082-121369';
var WFA_URL  = 'https://scoutingevent.com/082-122617';

/* Events. sessions: [{s, e, label?}] as 'YYYY-MM-DD' (e may equal s).
   venue: a VENUES key, or null when the location is not posted.
   virtual: true when at least one session is online. */
const NCAC_EVENTS = [
  { id: 1, course: 'FOT', council: 'NCAC', host: 'Council', venue: 'becket',
    sessions: [{ s: '2026-12-05', e: '2026-12-05' }], time: '8:30 am – 4:15 pm', cost: '$25',
    url: 'https://scoutingevent.com/082-99105',
    notes: ['The registration page listed only its 2025 sessions when checked on Nov 23, 2026 — confirm this date before planning around it.'] },
  { id: 2, course: 'DCT', council: 'NCAC', host: 'Seneca District', venue: 'church',
    sessions: [{ s: '2026-12-06', e: '2026-12-06' }], time: '1:00 – 5:00 pm', cost: '$10',
    url: 'https://scoutingevent.com/082-122010',
    notes: ['Registration closes Dec 3, 2026.'] },
  { id: 3, course: 'SST', council: 'NCAC', host: 'Accotink Bay District', venue: 'heritage',
    sessions: [{ s: '2026-12-12', e: '2026-12-12' }], time: '9:00 am – 1:30 pm', cost: null,
    url: 'https://scoutingevent.com/082-sstfall26',
    notes: ['Each session is limited to 12 participants.'] },
  { id: 4, course: 'CSLST', council: 'NCAC', host: 'Accotink Bay District', venue: 'heritage',
    sessions: [{ s: '2026-12-19', e: '2026-12-19' }], time: '9:00 am – 12:30 pm', cost: null,
    url: 'https://scoutingevent.com/082-clstfall26',
    notes: ['The council calendar lists December 12; the registration page lists Saturday, December 19. Shown here on the registration page date.'] },
  { id: 5, course: 'NYLT', council: 'NCAC', host: 'Council', venue: 'snyder', title: 'NYLT course 26-7',
    sessions: [{ s: '2026-12-26', e: '2026-12-31' }], time: 'Sat 6:00 pm – Thu 5:00 pm', cost: '$330–$370',
    url: NYLT_URL, notes: ['Registration closes Dec 19, 2026.'] },
  { id: 6, course: 'NYLT', council: 'NCAC', host: 'Council', venue: 'snyder', title: 'NYLT course 27-1 (two weekends)',
    sessions: [{ s: '2027-01-15', e: '2027-01-18', label: 'Weekend 1' }, { s: '2027-01-30', e: '2027-01-31', label: 'Weekend 2' }],
    time: 'Weekend 1 starts Fri 6:00 pm', cost: '$330–$370',
    url: NYLT_URL, notes: ['Scouts attend both weekends.', 'Registration closes Jan 8, 2027.'] },
  { id: 7, course: 'NYLT', council: 'NCAC', host: 'Council', venue: 'snyder', title: 'NYLT course 27-2 (two weekends)',
    sessions: [{ s: '2027-02-12', e: '2027-02-15', label: 'Weekend 1' }, { s: '2027-02-27', e: '2027-02-28', label: 'Weekend 2' }],
    time: 'Weekend 1 starts Fri 6:00 pm', cost: '$330–$370',
    url: NYLT_URL, notes: ['Scouts attend both weekends.', 'Registration closes Feb 5, 2027.'] },
  { id: 8, course: 'NYLT', council: 'NCAC', host: 'Council', venue: 'snyder', title: 'NYLT courses 27-3 and 27-4',
    sessions: [{ s: '2027-06-20', e: '2027-06-25' }], time: 'Sun noon – Fri 5:00 pm', cost: '$330–$370',
    url: NYLT_URL, notes: ['Two separate courses run the same week.', 'Registration closes Jun 9, 2027.'] },
  { id: 9, course: 'NYLT', council: 'NCAC', host: 'Council', venue: 'snyder', title: 'NYLT courses 27-5 and 27-6',
    sessions: [{ s: '2027-08-01', e: '2027-08-06' }], time: 'Sun noon – Fri 5:00 pm', cost: '$330–$370',
    url: NYLT_URL, notes: ['Two separate courses run the same week.', 'Registration closes Jul 20, 2027.'] },

  { id: 10, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-01-23', e: '2027-01-24' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Jan 13, 2027.'] },
  { id: 11, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-02-06', e: '2027-02-07' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Jan 27, 2027.'] },
  { id: 12, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-02-20', e: '2027-02-21' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Feb 10, 2027.'] },
  { id: 13, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-03-13', e: '2027-03-14' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Mar 3, 2027.'] },
  { id: 14, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-03-27', e: '2027-03-28' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Mar 17, 2027.'] },
  { id: 15, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-04-10', e: '2027-04-11' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Mar 31, 2027.'] },
  { id: 16, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-04-24', e: '2027-04-25' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: ['Registration closes Apr 14, 2027.'] },
  { id: 17, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-05-08', e: '2027-05-09' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: [] },
  { id: 18, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-05-22', e: '2027-05-23' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: [] },
  { id: 19, course: 'WFA', council: 'NCAC', host: 'NCAC Camping', venue: 'snyder', sessions: [{ s: '2027-05-29', e: '2027-05-30' }], time: 'Sat 8:00 am – Sun 5:00 pm', cost: null, url: WFA_URL, notes: [] },

  { id: 20, course: 'UOS', council: 'NCAC', host: 'Council', venue: null,
    sessions: [{ s: '2027-02-02', e: '2027-02-02' }], time: null, cost: null, url: null,
    notes: ['The council calendar lists "February 2 2027", which is a Tuesday. University of Scouting is normally held on a Saturday, so treat this date as unconfirmed.', 'Location and registration link are not posted yet.'] },

  { id: 21, course: 'BALOO', council: 'NCAC', host: 'Prince William District', venue: 'snyder',
    sessions: [{ s: '2027-03-13', e: '2027-03-14' }], time: 'Sat 8:00 am – Sun noon', cost: null,
    url: 'https://scoutingevent.com/082-122893',
    notes: ['Bring a printed health form (parts A and B).', 'Registration closes Mar 11, 2027.'] },
  { id: 22, course: 'IOLS', council: 'NCAC', host: 'Prince William District', venue: 'snyder',
    sessions: [{ s: '2027-03-13', e: '2027-03-14' }], time: 'Sat 8:00 am – Sun 1:00 pm', cost: null,
    url: 'https://scoutingevent.com/082-122889', notes: [] },
  { id: 23, course: 'COMM', council: 'NCAC', host: 'Council', venue: null,
    sessions: [{ s: '2027-03-13', e: '2027-03-13' }], time: null, cost: null, url: null,
    notes: ['The council calendar says only "2nd Saturday in March", which is March 13 in 2027.', 'Location and registration link are not posted yet.'] },
  { id: 24, course: 'LNT1', council: 'NCAC', host: 'Aquia District', venue: 'hartwood',
    sessions: [{ s: '2027-03-20', e: '2027-03-21' }], time: 'Sat 9:00 am – Sun 10:00 am', cost: null,
    url: 'https://scoutingevent.com/082-AquiaLNTLvl1',
    notes: ['Overnight course: bring sleeping gear and a health form (parts A and B).', 'Fee covers materials, lunch, dinner and a light Sunday breakfast.', 'Registration closes Mar 5, 2027.'] },

  { id: 25, course: 'BCOLS', council: 'NCAC', host: 'Council', venue: null, title: 'BCOLS — spring course',
    sessions: [{ s: '2027-04-03', e: '2027-04-03', label: 'Classroom' }, { s: '2027-04-23', e: '2027-04-24', label: 'Field' }],
    time: null, cost: null, url: null,
    notes: ['Attend both the classroom day and the field weekend.', 'Location is not posted. Contact the NCAC BCOLS training lead, Al Barber, through the council training page.'] },
  { id: 26, course: 'BALOO', council: 'NCAC', host: 'Accotink Bay District', venue: 'uscg',
    sessions: [{ s: '2027-04-17', e: '2027-04-17' }], time: '9:00 am – 3:30 pm', cost: '$30',
    url: 'https://scoutingevent.com/082-baloospring27',
    notes: ['The council calendar lists April 17–18; the registration page lists Saturday, April 17 only.', 'Registration closes Apr 11, 2027.'] },
  { id: 27, course: 'IOLS', council: 'NCAC', host: 'Accotink Bay District', venue: 'uscg',
    sessions: [{ s: '2027-04-17', e: '2027-04-18' }], time: null, cost: null,
    url: 'https://scoutingevent.com/082-baloospring27',
    notes: ['The council calendar lists IOLS here on April 17–18 under the BALOO registration link. That page described only BALOO when checked — confirm IOLS is running before registering.'] },
  { id: 28, course: 'BALOO', council: 'NCAC', host: 'Western Shore District', venue: 'kings',
    sessions: [{ s: '2027-04-23', e: '2027-04-24' }], time: 'Fri 6:30 pm – Sat 6:30 pm', cost: '$45',
    url: 'https://scoutingevent.com/082-121652',
    notes: ['The council calendar lists April 17–18; the registration page lists Friday–Saturday, April 23–24.', 'Combined IOLS and BALOO weekend, 20 seats in each. Register for one, not both.', 'Registration opens Feb 15 and closes Apr 13, 2027.'] },
  { id: 29, course: 'IOLS', council: 'NCAC', host: 'Western Shore District', venue: 'kings',
    sessions: [{ s: '2027-04-23', e: '2027-04-24' }], time: 'Fri 6:30 pm – Sat 6:30 pm', cost: '$45',
    url: 'https://scoutingevent.com/082-121652',
    notes: ['The council calendar lists April 17–18; the registration page lists Friday–Saturday, April 23–24.', 'Combined IOLS and BALOO weekend, 20 seats in each. Register for one, not both.', 'Registration opens Feb 15 and closes Apr 13, 2027.'] },

  { id: 30, course: 'IOLS', council: 'NCAC', host: 'Burke Lake District', venue: 'snyder', virtual: true, title: 'IOLS — June course',
    sessions: [{ s: '2027-06-01', e: '2027-06-01', label: 'Virtual session' }, { s: '2027-06-05', e: '2027-06-06', label: 'Field weekend' }],
    time: null, cost: null, url: null,
    notes: ['The council calendar lists a virtual session on Tuesday, June 1 and a weekend on June 5–6 as separate lines. They are shown together here as one course — confirm with the district.', 'Registration link is not posted yet.'] },
  { id: 31, course: 'IOLS', council: 'NCAC', host: 'Burke Lake District', venue: 'snyder', virtual: true, title: 'IOLS — September course',
    sessions: [{ s: '2027-09-13', e: '2027-09-13', label: 'Virtual session' }, { s: '2027-09-18', e: '2027-09-19', label: 'Field weekend' }],
    time: null, cost: null, url: null,
    notes: ['The council calendar lists a virtual session on Monday, September 13 and a weekend on September 18–19 as separate lines. They are shown together here as one course — confirm with the district.', 'Registration link is not posted yet.'] },
  { id: 32, course: 'BCOLS', council: 'NCAC', host: 'Council', venue: null, title: 'BCOLS — fall course',
    sessions: [{ s: '2027-09-18', e: '2027-09-18', label: 'Classroom' }, { s: '2027-10-02', e: '2027-10-03', label: 'Field' }],
    time: null, cost: null, url: null,
    notes: ['Attend both the classroom day and the field weekend.', 'Location is not posted. Contact the NCAC BCOLS training lead, Al Barber, through the council training page.'] }
];

/* Every dated course: NCAC ids 1–32, nearby councils from 33. */
export const EVENTS = NCAC_EVENTS.concat(NEARBY_EVENTS);

/* Courses on the council calendar with no upcoming date posted. */
export const UNDATED = [
  { council: 'NCAC', name: 'Wood Badge', aud: 'adult', note: 'Fall 2026 course has finished; 2027 dates not posted', url: 'https://scoutingevent.com/082-WB26' },
  { council: 'NCAC', name: 'ILST — Introduction to Leadership Skills for Troops', aud: 'youth', note: 'Taught at the troop level', url: 'https://www.ncacbsa.org/national-youth-leadership-training/' },
  { council: 'NCAC', name: 'STEM merit badge workshops', aud: 'youth', note: '', url: null },
  { council: 'NCAC', name: 'CST 12 conference', aud: 'adult', note: 'See the regional calendar', url: 'https://scoutingevent.com/000/Calendar/Embed?region=12' },
  { council: 'NCAC', name: 'Charter Organization Representative (COR)', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Climbing — Scouterhorn operation (NCAC climbing tower)', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Climbing Level I Instructor', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Committee training — pack and committee chair', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Cubmaster and pack committee', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Den leaders and assistant den leaders', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'First aid and CPR-Pro for camp health officers', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Goshen training 2027', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Merit badge counselor', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'NCAP assessor training — long term and short term', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'NYLT course directors conference', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Outdoor Ethics Guide — Tread Lightly! trainer course', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Paddle Craft Safety — white water', aud: 'adult', note: 'Limit 12 leaders', url: null },
  { council: 'NCAC', name: 'Paddle Craft Safety — moving water', aud: 'adult', note: 'Limit 12 leaders', url: null },
  { council: 'NCAC', name: 'Safeguarding Youth', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Troop position-specific training', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Wood Badge course directors conference', aud: 'adult', note: '', url: null },
  { council: 'NCAC', name: 'Youth Mental Health First Aid', aud: 'adult', note: '', url: null }
];
