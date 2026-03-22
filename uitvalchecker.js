// Magister Uitval Detector
// Vergelijkt je rooster elke 5 minuten met een snapshot — verdwenen lessen = uitval.
//
// Setup (eenmalig):
//   1. Ga naar script.google.com en maak een nieuw project aan
//   2. Plak deze code en sla op (Ctrl+S)
//   3. Selecteer 'setupTrigger' in het dropdown en klik op ▶
//   4. Geef toestemming wanneer Google daarom vraagt

// ── Jouw persoonlijke Magister iCal-link (zie handleiding) ───
// Let op: de link moet beginnen met https:// en niet met webcal://
// Vervang webcal:// door https:// als dat nodig is.
const WEBCAL_URL = 'PLAK_HIER_JOUW_MAGISTER_LINK';

const MAIL_NAAR  = Session.getActiveUser().getEmail();
const SCRIPT_KEY = 'magister_snapshot';
const DATUM_KEY  = 'magister_snapshot_datum';

// ─────────────────────────────────────────────────────────────

function checkUitval() {
  resetSnapshotAlsNieuweDag();

  const icsText = fetchIcs(WEBCAL_URL);
  if (!icsText) return;

  const events  = parseIcs(icsText);
  const periode = komendWeekEvents(events);
  const snapshot = loadSnapshot();

  if (snapshot === null) {
    saveSnapshot(periode);
    return;
  }

  const uitgevallen = detectVerdwenen(snapshot, periode);

  if (uitgevallen.length > 0) {
    stuurMail(uitgevallen);
  }

  saveSnapshot(periode);
}

// Reset de snapshot elke nacht zodat de dag opnieuw als baseline dient
function resetSnapshotAlsNieuweDag() {
  const props   = PropertiesService.getScriptProperties();
  const vandaag = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'yyyy-MM-dd');

  if (props.getProperty(DATUM_KEY) !== vandaag) {
    props.deleteProperty(SCRIPT_KEY);
    props.setProperty(DATUM_KEY, vandaag);
  }
}

function fetchIcs(url) {
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    return response.getContentText();
  } catch (e) {
    return null;
  }
}

function parseIcs(text) {
  const events = [];
  text = text.replace(/\r\n[ \t]/g, '').replace(/\r/g, '');

  const blocks = text.split('BEGIN:VEVENT');
  blocks.shift();

  for (const block of blocks) {
    const get = (key) => {
      const m = block.match(new RegExp('^' + key + '[^:]*:(.*)$', 'm'));
      return m ? m[1].trim() : '';
    };

    const dtstart = get('DTSTART');
    if (!dtstart) continue;

    const start = parseIcsDate(dtstart);
    if (!start) continue;

    const dtend   = get('DTEND');
    const summary = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');

    events.push({
      uid:     get('UID'),
      summary,
      start,
      end:     parseIcsDate(dtend),
      loc:     get('LOCATION'),
      fp:      summary + '|' + dtstart + '|' + (dtend || '')
    });
  }

  return events;
}

function parseIcsDate(s) {
  if (!s) return null;
  try {
    if (s.length === 8) {
      return new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
    }
    const [y, mo, d, h, mi] = [s.slice(0,4), s.slice(4,6), s.slice(6,8), s.slice(9,11), s.slice(11,13)];
    const se = s.slice(13, 15) || '00';
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}${s.endsWith('Z') ? 'Z' : ''}`;
    return new Date(iso);
  } catch (e) {
    return null;
  }
}

function komendWeekEvents(events) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999);
  return events.filter(e => e.start >= start && e.start <= end);
}

function detectVerdwenen(was, isNu) {
  const nuFps = new Set(isNu.map(e => e.fp));
  return was.filter(e => !nuFps.has(e.fp));
}

function saveSnapshot(events) {
  const data = events.map(e => ({
    fp:      e.fp,
    summary: e.summary,
    start:   e.start.toISOString(),
    end:     e.end ? e.end.toISOString() : null,
    loc:     e.loc
  }));
  PropertiesService.getScriptProperties().setProperty(SCRIPT_KEY, JSON.stringify(data));
}

function loadSnapshot() {
  const raw = PropertiesService.getScriptProperties().getProperty(SCRIPT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).map(e => ({
      fp:      e.fp,
      summary: e.summary,
      start:   new Date(e.start),
      end:     e.end ? new Date(e.end) : null,
      loc:     e.loc
    }));
  } catch (e) {
    return null;
  }
}

// Verwijder de snapshot handmatig als je een frisse start wilt
function resetSnapshot() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(SCRIPT_KEY);
  props.deleteProperty(DATUM_KEY);
}

function stuurMail(uitgevallen) {
  const datum     = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'EEEE d MMMM yyyy');
  const tijdNu    = Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'HH:mm');
  const onderwerp = `Uitval: ${uitgevallen.length} les${uitgevallen.length > 1 ? 'sen' : ''} - ${datum}`;

  uitgevallen.sort((a, b) => a.start - b.start);

  const lessenHtml = uitgevallen.map(e => {
    const lesdatum = Utilities.formatDate(e.start, 'Europe/Amsterdam', 'EEEE d MMMM');
    const start    = Utilities.formatDate(e.start, 'Europe/Amsterdam', 'HH:mm');
    const end      = e.end ? Utilities.formatDate(e.end, 'Europe/Amsterdam', 'HH:mm') : '';
    const tijd     = end ? `${start} - ${end}` : start;
    const loc      = e.loc ? `<div class="les-loc">Lokaal: ${e.loc}</div>` : '';
    return `
      <div class="les">
        <div class="les-datum">${lesdatum}</div>
        <div class="les-naam">${e.summary || '(naamloos)'}</div>
        <div class="les-tijd">${tijd}</div>
        ${loc}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<style>
  body       { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .wrap      { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px;
               overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
  .header    { background: #1a1a2e; color: #fff; padding: 24px 28px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .header p  { margin: 6px 0 0; font-size: 13px; color: #aaa; }
  .body      { padding: 20px 28px; }
  .les       { background: #fafafa; border-left: 3px solid #d32f2f; border-radius: 4px;
               padding: 12px 14px; margin-bottom: 10px; }
  .les-datum { font-size: 11px; font-weight: 700; text-transform: uppercase;
               letter-spacing: .5px; color: #d32f2f; margin-bottom: 4px; }
  .les-naam  { font-weight: 600; font-size: 15px; margin-bottom: 3px; }
  .les-tijd  { font-size: 13px; color: #555; }
  .les-loc   { font-size: 12px; color: #888; margin-top: 3px; }
  .footer    { padding: 14px 28px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Magister uitval melding</h1>
    <p>Gedetecteerd op ${datum} om ${tijdNu}</p>
  </div>
  <div class="body">${lessenHtml}</div>
  <div class="footer">Automatisch verstuurd door Magister Uitval Detector</div>
</div>
</body>
</html>`;

  GmailApp.sendEmail(MAIL_NAAR, onderwerp, '', { htmlBody: html });
}

function setupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'checkUitval')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('checkUitval').timeBased().everyMinutes(5).create();
  checkUitval();
}