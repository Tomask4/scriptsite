/**
 * E-mail Samenvatter
 * Stuurt elke ochtend een digest van ongelezen e-mails naar jezelf.
 * 
 * Gebruik: Stel een dagelijkse trigger in via Apps Script → Triggers
 */

const ONTVANGER = Session.getActiveUser().getEmail();
const MAX_MAILS  = 20;

function stuurEmailDigest() {
  const threads = GmailApp.search('is:unread newer_than:1d', 0, MAX_MAILS);

  if (threads.length === 0) {
    Logger.log('Geen ongelezen e-mails gevonden.');
    return;
  }

  const regels = threads.map(thread => {
    const bericht = thread.getMessages()[0];
    return `• ${bericht.getSubject()} — van ${bericht.getFrom()}`;
  });

  const onderwerp = `📬 Jouw e-mail digest (${threads.length} ongelezen)`;
  const inhoud    = `Goedemorgen!\n\nJe ongelezen e-mails van de afgelopen 24 uur:\n\n${regels.join('\n')}\n\nGroeten,\nJe Scripts Library 🤖`;

  GmailApp.sendEmail(ONTVANGER, onderwerp, inhoud);
  Logger.log(`Digest verstuurd naar ${ONTVANGER}`);
}
