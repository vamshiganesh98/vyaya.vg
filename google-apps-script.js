/**
 * Vyaya.vg — Google Apps Script Web App
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Replace the entire Code.gs contents with this file
 * 3. Click Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL and paste it in Vyaya.vg Settings → Google Sheets Sync
 *
 * SHEET STRUCTURE (auto-created if missing):
 *   Sheet1 "Transactions" — one row per expense
 *   Sheet2 "Settings"     — key/value rows for budgets, goals, recurring
 */

const TRANSACTIONS_SHEET = 'Transactions';
const SETTINGS_SHEET = 'Settings';

// ── GET handler ───────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || 'read';

  if (action === 'readSettings') {
    return readSettings();
  }

  // Default: read all transactions
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  if (!sheet) sheet = ss.getActiveSheet();

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ rows: [] });

  const headers = data[0].map(h => String(h).trim());
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = String(data[i][j] || '').trim(); });
    rows.push(row);
  }
  return jsonResponse({ rows });
}

// ── POST handler ──────────────────────────────────────────
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResponse({ error: 'Invalid JSON' }); }

  if (body.action === 'writeSettings') {
    return writeSettings(body.settings);
  }

  // Transaction actions
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TRANSACTIONS_SHEET);
    sheet.appendRow(['Date','Time','Category','Amount','Mode of Payment','Note','Split','Paid','Location']);
  }

  const HEADERS = ['Date','Time','Category','Amount','Mode of Payment','Note','Split','Paid','Location'];
  const ensureHeaders = () => {
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!existing[0] || existing[0] === '') sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  };

  if (body.action === 'append') {
    ensureHeaders();
    sheet.appendRow([
      body['Date'], body['Time'], body['Category'], body['Amount'],
      body['Mode of Payment'], body['Note'], body['Split'], body['Paid'], body['Location'] || ''
    ]);
    return jsonResponse({ ok: true });
  }

  if (body.action === 'update' || body.action === 'delete') {
    const key = body.oldKey || [body['Date'], body['Time'], body['Amount'], body['Category']].join('|');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const di = headers.indexOf('Date'), ti = headers.indexOf('Time'),
          ai = headers.indexOf('Amount'), ci = headers.indexOf('Category');

    for (let r = 1; r < data.length; r++) {
      const rowKey = [data[r][di], data[r][ti], data[r][ai], data[r][ci]].join('|');
      if (rowKey === key) {
        if (body.action === 'delete') {
          sheet.deleteRow(r + 1);
        } else {
          sheet.getRange(r + 1, 1, 1, HEADERS.length).setValues([[
            body['Date'], body['Time'], body['Category'], body['Amount'],
            body['Mode of Payment'], body['Note'], body['Split'], body['Paid'], body['Location'] || ''
          ]]);
        }
        return jsonResponse({ ok: true });
      }
    }
    return jsonResponse({ ok: true, note: 'row not found' });
  }

  return jsonResponse({ error: 'Unknown action' });
}

// ── Settings read ─────────────────────────────────────────
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

// ── Settings write ────────────────────────────────────────
function writeSettings(settings) {
  if (!settings) return jsonResponse({ error: 'No settings provided' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET);

  // Build map of existing rows (key → row index)
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

// ── Helper ────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
