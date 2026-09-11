'use strict';

// Presentation metadata follows the same per-case visibility as original downloads.
function fileVisible(file, c, user) {
  if (user.role === 'appraiser' && file.kind === 'partner_invoice') return false;
  if (user.role === 'partner' && file.kind === 'report' && !['report_ready', 'report_sent', 'closed'].includes(c.status)) return false;
  return true;
}
function summarize(c, files, events, user) {
  const visibleFiles = files.filter(f => fileVisible(f, c, user));
  const photos = visibleFiles.filter(f => f.kind === 'photo');
  const preview = photos.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
  const publicEvents = events.filter(e => !e.internal).sort((a,b) => b.at.localeCompare(a.at));
  const request = publicEvents.find(e => e.action === 'Status: Rückfrage' && e.note);
  const lastMessage = publicEvents.find(e => e.action === 'Nachricht' && e.note);
  const eventView = e => e ? {id:e.id, note:e.note, at:e.at, actor:e.actor} : null;
  return {...c, fileCount:visibleFiles.length, photoCount:photos.length, documentCount:visibleFiles.length-photos.length,
    thumbnailFileId:(preview.find(f => f.perspective === 'frontLeft') || preview[0])?.id || null,
    latestRequest:eventView(request), lastMessage:eventView(lastMessage)};
}
async function summarizeCases(s, cases, user) {
  const result=[];
  for (const c of cases) result.push(summarize(c, await s.list('file',c.id), await s.list('event',c.id),user));
  return result;
}
module.exports={fileVisible,summarize,summarizeCases};
