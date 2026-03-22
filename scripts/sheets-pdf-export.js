/**
 * Sheets naar PDF Exporter
 * Exporteert een tabblad als PDF naar Google Drive.
 *
 * Gebruik: Pas TAB_NAAM en MAP_NAAM aan en run exporteerAlsPDF()
 */

const TAB_NAAM = 'Rapport';      // Naam van het tabblad om te exporteren
const MAP_NAAM = 'PDF Exports';  // Map in Drive waar bestanden worden opgeslagen

function exporteerAlsPDF() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const tabblad     = spreadsheet.getSheetByName(TAB_NAAM);

  if (!tabblad) {
    throw new Error(`Tabblad "${TAB_NAAM}" niet gevonden.`);
  }

  const url = `${spreadsheet.getUrl().replace('/edit', '/export')}` +
    `?exportFormat=pdf&format=pdf` +
    `&gid=${tabblad.getSheetId()}` +
    `&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false`;

  const token    = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const blob     = response.getBlob().setName(`${TAB_NAAM}_${vandaag()}.pdf`);

  const map = haalMapOp(MAP_NAAM);
  map.createFile(blob);

  Logger.log(`PDF opgeslagen in "${MAP_NAAM}"`);
}

function vandaag() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function haalMapOp(naam) {
  const mappen = DriveApp.getFoldersByName(naam);
  return mappen.hasNext() ? mappen.next() : DriveApp.createFolder(naam);
}
