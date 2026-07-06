/**
 * Vyaya.vg — Google Apps Script Web App
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Replace the entire Code.gs contents with this file
 * 3. Click Deploy → Manage deployments → Edit → New version → Deploy
 *    (Same URL, no need to update the app)
 *
 * SHEET STRUCTURE:
 *   "Jul 2026", "Jun 2026", ...  — one sheet per month, auto-created
 *   "Settings"                   — key/value: budgets, goals, recurring
 *
 * NOTE: Delete your old "Transactions" sheet manually after deploying this.
 */

const SETTINGS_SHEET = 'Settings';
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TX_HEADERS = ['Date','Time','Category','Amount','Mode of Payment','Note','Split','Paid','Location','Tags'];

// ── Helpers ───────────────────────────────────────────────

function monthSheetName(dateStr) {
  // dateStr = "YYYY-MM-DD"
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return null;
  const m = parseInt(parts[1]) - 1;
  return MONTH_NAMES[m] + ' ' + parts[0];
}

function getOrCreateMonthSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS]);
    try { ss.moveActiveSheet(1); } catch(e) {}
  }
  formatSheetHeaders(sheet);
  return sheet;
}

function formatSheetHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, TX_HEADERS.length);

  // Ensure headers are set
  const existing = headerRange.getValues()[0];
  if (!existing[0] || existing[0] === '') {
    headerRange.setValues([TX_HEADERS]);
  }

  // Style the header row
  headerRange
    .setBackground('#1a1a2e')       // dark navy background
    .setFontColor('#e8c547')         // gold text
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontFamily('Arial')
    .setHorizontalAlignment('center')
    .setBorder(false, false, true, false, false, false, '#e8c547', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  const widths = [100, 70, 130, 90, 140, 200, 55, 55, 150, 120];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Style data rows alternating (light)
  sheet.setRowHeight(1, 32);

  // Tab color — gold
  sheet.setTabColor('#e8c547');
}

function getAllMonthSheets(ss) {
  return ss.getSheets().filter(s => /^[A-Z][a-z]{2} \d{4}$/.test(s.getName()));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    const val = row[i];
    if (h === 'Time' && val instanceof Date) {
      // Sheets returns time cells as Date objects — extract HH:MM only
      const hh = String(val.getHours()).padStart(2, '0');
      const mm = String(val.getMinutes()).padStart(2, '0');
      obj[h] = hh + ':' + mm;
    } else if (h === 'Date' && val instanceof Date) {
      // Sheets may return date cells as Date objects too
      const yyyy = val.getFullYear();
      const mo = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      obj[h] = yyyy + '-' + mo + '-' + dd;
    } else {
      obj[h] = String(val || '').trim();
    }
  });
  return obj;
}

// ── GET ───────────────────────────────────────────────────

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'read';
  setupSheets(); // always ensure current month + Settings exist
  if (action === 'readSettings') return readSettings();
  return readAllTransactions();
}

// Creates current month sheet + Settings if they don't exist yet. Safe to call repeatedly.
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const name = MONTH_NAMES[today.getMonth()] + ' ' + today.getFullYear();
  getOrCreateMonthSheet(ss, name);

  // Settings sheet
  let settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!settingsSheet) settingsSheet = ss.insertSheet(SETTINGS_SHEET);
  formatSettingsSheet(settingsSheet);
}

// Run this manually from Apps Script editor to reformat all existing month sheets
function formatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getAllMonthSheets(ss).forEach(sheet => formatSheetHeaders(sheet));
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  if (settingsSheet) formatSettingsSheet(settingsSheet);
}

function formatSettingsSheet(sheet) {
  const header = sheet.getRange(1, 1, 1, 2);
  if (!header.getValues()[0][0]) {
    header.setValues([['Key', 'Value']]);
  }
  header
    .setBackground('#1a1a2e')
    .setFontColor('#e8c547')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontFamily('Arial')
    .setHorizontalAlignment('center')
    .setBorder(false, false, true, false, false, false, '#e8c547', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 500);
  sheet.setRowHeight(1, 32);
  sheet.setTabColor('#9b6dff');
}

function readAllTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = getAllMonthSheets(ss);

  // Also read the old Transactions sheet if it still exists (migration fallback)
  const legacy = ss.getSheetByName('Transactions');
  if (legacy) sheets.push(legacy);

  const rows = [];
  sheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    const headers = data[0].map(h => String(h).trim());
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      rows.push(rowToObj(headers, data[i]));
    }
  });
  return jsonResponse({ rows });
}

// ── POST ──────────────────────────────────────────────────

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResponse({ error: 'Invalid JSON' }); }

  if (body.action === 'writeSettings') return writeSettings(body.settings);
  if (body.action === 'append')        return appendTransaction(body);
  if (body.action === 'update')        return updateTransaction(body);
  if (body.action === 'delete')        return deleteTransaction(body);

  return jsonResponse({ error: 'Unknown action: ' + body.action });
}

function appendTransaction(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = monthSheetName(body['Date']);
  if (!sheetName) return jsonResponse({ error: 'Invalid date: ' + body['Date'] });
  const sheet = getOrCreateMonthSheet(ss, sheetName);
  sheet.appendRow([
    body['Date'], body['Time'], body['Category'], body['Amount'],
    body['Mode of Payment'], body['Note'], body['Split'] || 1,
    body['Paid'] || 0, body['Location'] || '', body['Tags'] || ''
  ]);
  return jsonResponse({ ok: true });
}

function findRow(ss, body) {
  // Returns { sheet, rowIndex } or null
  const key = body.oldKey || [body['Date'], body['Time'], body['Amount'], body['Category']].join('|');
  const sheetName = monthSheetName(body['Date'] || (key.split('|')[0]));
  // Try the specific month sheet first, then fall back to all sheets
  const toSearch = sheetName
    ? [ss.getSheetByName(sheetName)].filter(Boolean).concat(getAllMonthSheets(ss))
    : getAllMonthSheets(ss);
  const seen = new Set();
  for (const sheet of toSearch) {
    if (!sheet || seen.has(sheet.getName())) continue;
    seen.add(sheet.getName());
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) continue;
    const headers = data[0].map(h => String(h).trim());
    const di = headers.indexOf('Date'), ti = headers.indexOf('Time'),
          ai = headers.indexOf('Amount'), ci = headers.indexOf('Category');
    for (let r = 1; r < data.length; r++) {
      const rowKey = [data[r][di], data[r][ti], data[r][ai], data[r][ci]].join('|');
      if (rowKey === key) return { sheet, rowIndex: r + 1 };
    }
  }
  return null;
}

function updateTransaction(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const found = findRow(ss, body);
  if (!found) return jsonResponse({ ok: true, note: 'row not found' });
  found.sheet.getRange(found.rowIndex, 1, 1, TX_HEADERS.length).setValues([[
    body['Date'], body['Time'], body['Category'], body['Amount'],
    body['Mode of Payment'], body['Note'], body['Split'] || 1,
    body['Paid'] || 0, body['Location'] || '', body['Tags'] || ''
  ]]);
  return jsonResponse({ ok: true });
}

function deleteTransaction(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const found = findRow(ss, body);
  if (!found) return jsonResponse({ ok: true, note: 'row not found' });
  found.sheet.deleteRow(found.rowIndex);
  return jsonResponse({ ok: true });
}

// ── Settings ──────────────────────────────────────────────

function readSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) return jsonResponse({ settings: {} });
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const val = String(data[i][1]).trim();
    if (!key) continue;
    try { settings[key] = JSON.parse(val); }
    catch(e) { settings[key] = val; }
  }
  return jsonResponse({ settings });
}

function writeSettings(settings) {
  if (!settings) return jsonResponse({ error: 'No settings provided' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const rowMap = {};
  for (let i = 0; i < data.length; i++) {
    const k = String(data[i][0]).trim();
    if (k) rowMap[k] = i + 1;
  }
  Object.entries(settings).forEach(([key, value]) => {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (rowMap[key]) {
      sheet.getRange(rowMap[key], 1, 1, 2).setValues([[key, serialized]]);
    } else {
      sheet.appendRow([key, serialized]);
    }
  });
  return jsonResponse({ ok: true });
}
