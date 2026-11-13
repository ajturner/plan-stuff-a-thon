'use strict';
/* camps.html -> summer-camp/ redirect that keeps any ?query or #hash. */
location.replace('summer-camp/' + location.search + location.hash);
