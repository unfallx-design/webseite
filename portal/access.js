'use strict';
const {assert}=require('./domain');
const isPortalRole=role=>['partner','admin','appraiser'].includes(role);
const unavailable='UNFALLX Connect ist ausschließlich für Partner und das interne UNFALLX-Team verfügbar. Bei Fragen kontaktiere info@unfallx.com.';
function assertPortalUser(user){assert(user&&isPortalRole(user.role),unavailable,403);}
module.exports={isPortalRole,assertPortalUser,unavailable};
