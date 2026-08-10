/**
 * Vyaya.vg — Google Apps Script Web App
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Replace the entire Code.gs contents with this file
 * 3. ONE-TIME: select authorizeVyayaOnce → Run → Allow permissions
 * 4. Deploy → New deployment → Web app:
 *      Execute as: ME (your account)  ← required for AI from github.io
 *      Who has access: Anyone
 * 5. Optional: run saveOpenAIKeyToScript() to store API key in Script Properties
 *    (then you don't need to paste the key in the vyaya.vg app)
 *
 * SHEET STRUCTURE:
 *   "Jul 2026", "Jun 2026", ...  — one sheet per month, auto-created
 *   "Settings"                   — four visual tables: Budget, Cat Budgets, Goals, Recurring
 */

/** Run once from the Apps Script editor (▶ Run) to grant UrlFetchApp / OpenAI access. */
function authorizeVyayaOnce() {
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/models', {
    method: 'get',
    headers: { Authorization: 'Bearer test' },
    muteHttpExceptions: true,
  });
  Logger.log('Authorization OK — HTTP ' + res.getResponseCode() + ' (401 expected without a real key)');
}

/** Optional: run once to save OpenAI key server-side (Extensions → Apps Script → Run). */
function saveOpenAIKeyToScript() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Paste your OpenAI API key (sk-…)', 'OpenAI key', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const key = String(r.getResponseText() || '').trim();
  if (!key) return;
  PropertiesService.getScriptProperties().setProperty('OPENAI_API_KEY', key);
  ui.alert('OpenAI key saved in Script Properties. You can remove it from the vyaya.vg app Setup.');
}

/** Test UrlFetchApp from browser: YOUR_URL?action=pingExternal */
function pingExternal_() {
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/models', {
    method: 'get',
    headers: { Authorization: 'Bearer test' },
    muteHttpExceptions: true,
  });
  return { ok: true, http: res.getResponseCode(), hint: 'UrlFetchApp works. HTTP 401 is expected.' };
}

const SETTINGS_SHEET = 'Settings';
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TX_HEADERS  = ['Date','Time','Category','Amount','Mode of Payment','Note','Split','Paid','Location','Tags','Id'];
const CATS_LIST   = ['Food','Travel & Commute','Bills','Q-Commerce','Entertainment','Investments','Shopping','Others'];

// Fixed row positions for each section in the Settings sheet
const SEC = {
  BUDGET_HEADER: 1,  BUDGET_COL: 2,  BUDGET_VAL: 3,
  CATBUD_HEADER: 5,  CATBUD_COL: 6,  CATBUD_START: 7,   // rows 7-14
  GOALS_HEADER:  16, GOALS_COL:  17, GOALS_START:  18,  // rows 18-37
  REC_HEADER:    39, REC_COL:    40, REC_START:    41,   // rows 41+
};

// ── Colours ───────────────────────────────────────────────
const C = {
  DARK:   '#0d0d1a',
  NAVY:   '#1a1a2e',
  GOLD:   '#e8c547',
  PURPLE: '#a09ec0',
  WHITE:  '#ffffff',
  STRIPE: '#f5f4fc',
  TEXT:   '#1a1830',
  MUTED:  '#7270a0',
  GHOST:  '#cccccc',
  BORDER: '#e2e0f0',
};

// ── Helpers ───────────────────────────────────────────────

function monthSheetName(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return null;
  return MONTH_NAMES[parseInt(parts[1]) - 1] + ' ' + parts[0];
}

function getOrCreateMonthSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS]);
    try { ss.moveActiveSheet(1); } catch(e) {}
  }
  formatMonthSheet(sheet);
  return sheet;
}

function formatMonthSheet(sheet) {
  const h = sheet.getRange(1, 1, 1, TX_HEADERS.length);
  if (!h.getValues()[0][0]) h.setValues([TX_HEADERS]);
  h.setBackground(C.DARK).setFontColor(C.GOLD).setFontWeight('bold')
   .setFontSize(10).setFontFamily('Arial').setHorizontalAlignment('center')
   .setBorder(false, false, true, false, false, false, C.GOLD, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  [100,70,130,90,140,200,55,55,150,120,110].forEach((w,i) => sheet.setColumnWidth(i+1, w));
  sheet.setTabColor(C.GOLD);
}

function getAllMonthSheets(ss) {
  return ss.getSheets().filter(s => /^[A-Z][a-z]{2} \d{4}$/.test(s.getName()));
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    const val = row[i];
    if (h === 'Time' && val instanceof Date) {
      obj[h] = String(val.getHours()).padStart(2,'0') + ':' + String(val.getMinutes()).padStart(2,'0');
    } else if (h === 'Date' && val instanceof Date) {
      obj[h] = val.getFullYear() + '-' + String(val.getMonth()+1).padStart(2,'0') + '-' + String(val.getDate()).padStart(2,'0');
    } else {
      obj[h] = String(val || '').trim();
    }
  });
  return obj;
}

function genIdGas() {
  return Math.random().toString(36).slice(2,10);
}

// ── GET ───────────────────────────────────────────────────

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'read';
  if (action === 'pingExternal') {
    try {
      return jsonResponse(pingExternal_());
    } catch (err) {
      return jsonResponse({
        ok: false,
        error: String(err),
        fix: 'Run authorizeVyayaOnce in the editor, then redeploy web app as Execute as: Me',
      });
    }
  }
  setupSheets();
  if (action === 'readSettings') return readSettings();
  return readAllTransactions();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  getOrCreateMonthSheet(ss, MONTH_NAMES[today.getMonth()] + ' ' + today.getFullYear());
  let s = ss.getSheetByName(SETTINGS_SHEET);
  if (!s) { s = ss.insertSheet(SETTINGS_SHEET); initSettingsSheet(s); }
}

// Run manually in Apps Script editor to reformat all sheets
function formatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getAllMonthSheets(ss).forEach(s => formatMonthSheet(s));
  const s = ss.getSheetByName(SETTINGS_SHEET);
  if (s) initSettingsSheet(s);
}

// ── Settings Sheet — Visual Tables ────────────────────────

function initSettingsSheet(sheet) {
  // Just format the skeleton, no data
  _applySettingsChrome(sheet, 0, 0);
}

function writeSettings(settings) {
  if (!settings) return jsonResponse({ error: 'No settings provided' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET);

  const needed = SEC.REC_START + 55;
  if (sheet.getMaxRows() < needed) sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows());
  sheet.clearContents();

  const catBudgets = settings.cat_budgets || {};
  const goals      = settings.goals       || [];
  const recurring  = settings.recurring   || [];
  const DOW        = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // ── Section 1: Monthly Budget ──────────────────────────
  sheet.getRange(SEC.BUDGET_HEADER, 1).setValue('💰  Monthly Budget');
  sheet.getRange(SEC.BUDGET_COL,    1).setValue('Amount (₹)');
  sheet.getRange(SEC.BUDGET_VAL,    1).setValue(settings.monthly_budget || 0);

  // ── Section 2: Category Budgets ───────────────────────
  sheet.getRange(SEC.CATBUD_HEADER, 1).setValue('📊  Category Budgets');
  sheet.getRange(SEC.CATBUD_COL,  1, 1, 2).setValues([['Category', 'Monthly Limit (₹)']]);
  sheet.getRange(SEC.CATBUD_START, 1, CATS_LIST.length, 2)
       .setValues(CATS_LIST.map(c => [c, catBudgets[c] || 0]));

  // ── Section 3: Goals ──────────────────────────────────
  sheet.getRange(SEC.GOALS_HEADER, 1).setValue('🎯  Savings Goals');
  sheet.getRange(SEC.GOALS_COL, 1, 1, 5).setValues([['Name', 'Target (₹)', 'Saved (₹)', 'Progress', 'ID']]);
  if (goals.length) {
    sheet.getRange(SEC.GOALS_START, 1, goals.length, 5).setValues(
      goals.map(g => [
        g.name || '', g.target || 0, g.saved || 0,
        g.target > 0 ? Math.round((g.saved||0) / g.target * 100) + '%' : '0%',
        g.id || ''
      ])
    );
  }

  // ── Section 4: Recurring Expenses ─────────────────────
  sheet.getRange(SEC.REC_HEADER, 1).setValue('🔁  Recurring Expenses');
  sheet.getRange(SEC.REC_COL, 1, 1, 10).setValues([[
    'Name', 'Amount (₹)', 'Category', 'Payment',
    'Frequency', 'Days (weekly)', 'Day of Month', 'Every N Days', 'Last Logged', 'ID'
  ]]);
  if (recurring.length) {
    sheet.getRange(SEC.REC_START, 1, recurring.length, 10).setValues(
      recurring.map(r => [
        r.name || '', r.amount || 0, r.category || '', r.payment || '',
        r.freq || 'monthly',
        (r.freqDays || []).map(d => DOW[d]).join(', '),
        r.freqDate || '', r.freqN || '', r.lastLogged || '', r.id || ''
      ])
    );
  }

  _applySettingsChrome(sheet, goals.length, recurring.length);
  return jsonResponse({ ok: true });
}

function _applySettingsChrome(sheet, goalCount, recCount) {
  // Section header rows + their span
  [ [SEC.BUDGET_HEADER, 1], [SEC.CATBUD_HEADER, 2], [SEC.GOALS_HEADER, 5], [SEC.REC_HEADER, 10] ]
  .forEach(([row, cols]) => {
    const r = sheet.getRange(row, 1, 1, cols);
    r.setBackground(C.DARK).setFontColor(C.GOLD).setFontWeight('bold')
     .setFontSize(11).setFontFamily('Arial').setVerticalAlignment('middle');
    sheet.setRowHeight(row, 32);
    if (cols > 1) try { r.merge(); } catch(e) {}
  });

  // Column header rows
  [ [SEC.BUDGET_COL, 1], [SEC.CATBUD_COL, 2], [SEC.GOALS_COL, 5], [SEC.REC_COL, 10] ]
  .forEach(([row, cols]) => {
    sheet.getRange(row, 1, 1, cols)
      .setBackground(C.NAVY).setFontColor(C.PURPLE).setFontWeight('bold')
      .setFontSize(9).setFontFamily('Arial').setHorizontalAlignment('center');
    sheet.setRowHeight(row, 26);
  });

  // Monthly budget value
  sheet.getRange(SEC.BUDGET_VAL, 1)
    .setBackground(C.WHITE).setFontColor(C.TEXT).setFontSize(12).setFontWeight('bold').setFontFamily('Arial');
  sheet.setRowHeight(SEC.BUDGET_VAL, 30);

  // Category budget rows
  for (let i = 0; i < CATS_LIST.length; i++) {
    const row = SEC.CATBUD_START + i;
    sheet.getRange(row, 1, 1, 2)
      .setBackground(i % 2 === 0 ? C.WHITE : C.STRIPE).setFontColor(C.TEXT)
      .setFontSize(10).setFontFamily('Arial')
      .setBorder(false, false, true, false, false, false, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(row, 26);
  }

  // Goal rows
  for (let i = 0; i < Math.max(goalCount, 1); i++) {
    const row = SEC.GOALS_START + i;
    const bg = i % 2 === 0 ? C.WHITE : C.STRIPE;
    if (i < goalCount) {
      sheet.getRange(row, 1, 1, 4).setBackground(bg).setFontColor(C.TEXT).setFontSize(10).setFontFamily('Arial')
        .setBorder(false, false, true, false, false, false, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
      sheet.getRange(row, 5).setBackground(bg).setFontColor(C.GHOST).setFontSize(8);
    }
    sheet.setRowHeight(row, 26);
  }

  // Recurring rows
  for (let i = 0; i < Math.max(recCount, 1); i++) {
    const row = SEC.REC_START + i;
    const bg = i % 2 === 0 ? C.WHITE : C.STRIPE;
    if (i < recCount) {
      sheet.getRange(row, 1, 1, 9).setBackground(bg).setFontColor(C.TEXT).setFontSize(10).setFontFamily('Arial')
        .setBorder(false, false, true, false, false, false, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
      sheet.getRange(row, 10).setBackground(bg).setFontColor(C.GHOST).setFontSize(8);
    }
    sheet.setRowHeight(row, 26);
  }

  // Column widths (covers widest section — Recurring with 10 cols)
  [180, 110, 140, 120, 100, 130, 110, 110, 130, 100].forEach((w,i) => sheet.setColumnWidth(i+1, w));
  sheet.setTabColor('#9b6dff');
  sheet.setFrozenRows(0);
}

function readSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) return jsonResponse({ settings: {} });

  const r1 = String(sheet.getRange(1,1).getValue() || '').trim();

  // Legacy flat JSON format — migrate transparently
  if (r1 === 'Key' || r1 === 'monthly_budget' || r1 === 'cat_budgets' || r1 === 'goals' || r1 === 'recurring') {
    const data = sheet.getDataRange().getValues();
    const settings = {};
    data.forEach(row => {
      const k = String(row[0]||'').trim();
      const v = String(row[1]||'').trim();
      if (!k || k === 'Key') return;
      try { settings[k] = JSON.parse(v); } catch(e) { settings[k] = v; }
    });
    return jsonResponse({ settings });
  }

  // New structured table format — batch read
  const maxRow = Math.max(SEC.REC_START + 55, sheet.getLastRow());
  const all = sheet.getRange(1, 1, maxRow, 10).getValues();

  const settings = {};

  // Monthly budget
  settings.monthly_budget = parseFloat(all[SEC.BUDGET_VAL - 1][0]) || 0;

  // Category budgets
  const catBudgets = {};
  CATS_LIST.forEach((cat, i) => {
    const v = parseFloat(all[SEC.CATBUD_START - 1 + i][1]);
    if (v > 0) catBudgets[cat] = v;
  });
  settings.cat_budgets = catBudgets;

  // Goals
  const goals = [];
  for (let i = 0; i < 20; i++) {
    const row = all[SEC.GOALS_START - 1 + i];
    const name = String(row[0]||'').trim();
    if (!name) break;
    goals.push({ id: String(row[4]||'')||genIdGas(), name, target: parseFloat(row[1])||0, saved: parseFloat(row[2])||0 });
  }
  settings.goals = goals;

  // Recurring
  const DOW_MAP = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const recurring = [];
  for (let i = 0; i < 50; i++) {
    const ri = SEC.REC_START - 1 + i;
    if (ri >= all.length) break;
    const row = all[ri];
    const name = String(row[0]||'').trim();
    if (!name) break;
    const daysStr = String(row[5]||'').trim();
    const freqDays = daysStr ? daysStr.split(',').map(d=>DOW_MAP[d.trim()]).filter(d=>d!==undefined) : [];
    const obj = {
      id: String(row[9]||'')||genIdGas(), name,
      amount: parseFloat(row[1])||0,
      category: String(row[2]||'').trim(),
      payment: String(row[3]||'').trim(),
      freq: String(row[4]||'monthly').trim(),
      freqDays,
      lastLogged: String(row[8]||'').trim() || undefined,
    };
    const fd = parseInt(row[6]); if (fd) obj.freqDate = fd;
    const fn = parseInt(row[7]); if (fn) obj.freqN = fn;
    recurring.push(obj);
  }
  settings.recurring = recurring;

  return jsonResponse({ settings });
}

// ── Transaction GET ───────────────────────────────────────

function readAllTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = getAllMonthSheets(ss);
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

// ── Transaction POST ──────────────────────────────────────

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch(err) { return jsonResponse({ error: 'Invalid JSON' }); }
  if (body.action === 'writeSettings') return writeSettings(body.settings);
  if (body.action === 'parse')         return parseExpenseAI(body);
  if (body.action === 'append')        return appendTransaction(body);
  if (body.action === 'update')        return updateTransaction(body);
  if (body.action === 'delete')        return deleteTransaction(body);
  return jsonResponse({ error: 'Unknown action: ' + body.action });
}

// ── AI parse (OpenAI proxy — avoids browser CORS on github.io) ──

function parseExpenseAI(body) {
  const text = String(body.text || '').trim();
  const apiKey = String(body.apiKey || '').trim()
    || PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY')
    || '';
  if (!text) return jsonResponse({ error: 'Missing text' });
  if (!apiKey) return jsonResponse({ error: 'Missing apiKey — add in vyaya.vg Setup or run saveOpenAIKeyToScript()' });

  const tz = 'Asia/Kolkata';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const cats = 'Food, Travel & Commute, Bills, Q-Commerce, Entertainment, Investments, Shopping, Others';

  const payload = {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You parse Indian personal expense sentences into JSON. Today is ' + today + ' (IST). Categories: ' + cats + '. Payment: UPI or Credit Card. Return only JSON with keys: amount (number INR), category, note (short merchant/description), payment, date (YYYY-MM-DD), location (optional), tags (string array), recurring (boolean), split (integer 1-10). Infer category from context.'
      },
      { role: 'user', content: text }
    ]
  };

  try {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const data = JSON.parse(res.getContentText());
    if (code !== 200) {
      const msg = (data.error && data.error.message) ? data.error.message : 'OpenAI request failed';
      return jsonResponse({ error: msg });
    }
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!raw) return jsonResponse({ error: 'Empty AI response' });
    const parsed = JSON.parse(raw);
    return jsonResponse({ result: parsed, source: 'ai' });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function appendTransaction(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = monthSheetName(body['Date']);
  if (!name) return jsonResponse({ error: 'Invalid date: ' + body['Date'] });
  const sheet = getOrCreateMonthSheet(ss, name);
  sheet.appendRow([
    body['Date'], body['Time'], body['Category'], body['Amount'],
    body['Mode of Payment'], body['Note'], body['Split']||1,
    body['Paid']||0, body['Location']||'', body['Tags']||'', body['Id']||''
  ]);
  return jsonResponse({ ok: true });
}

function findRow(ss, body) {
  const id = body['Id'] || body.Id || '';
  const key = body.oldKey || [body['Date'], body['Time'], Math.round(parseFloat(body['Amount'])||0), body['Category']].join('|');
  const name = monthSheetName(body['Date'] || key.split('|')[0]);
  const toSearch = name
    ? [ss.getSheetByName(name)].filter(Boolean).concat(getAllMonthSheets(ss))
    : getAllMonthSheets(ss);
  const seen = new Set();
  for (const sheet of toSearch) {
    if (!sheet || seen.has(sheet.getName())) continue;
    seen.add(sheet.getName());
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) continue;
    const hdr = data[0].map(h => String(h).trim());
    const di=hdr.indexOf('Date'), ti=hdr.indexOf('Time'), ai=hdr.indexOf('Amount'), ci=hdr.indexOf('Category');
    const idi = Math.max(hdr.indexOf('Id'), hdr.indexOf('ID'));
    // Ensure Id column exists for older sheets
    if (idi < 0 && hdr.length < TX_HEADERS.length) {
      sheet.getRange(1, TX_HEADERS.length).setValue('Id');
    }
    for (let r = 1; r < data.length; r++) {
      if (id && idi >= 0 && String(data[r][idi] || '').trim() === String(id)) {
        return { sheet, rowIndex: r + 1, hdrLen: Math.max(hdr.length, TX_HEADERS.length) };
      }
      const rawDate = data[r][di];
      const rowDate = rawDate instanceof Date
        ? rawDate.getFullYear() + '-' + String(rawDate.getMonth()+1).padStart(2,'0') + '-' + String(rawDate.getDate()).padStart(2,'0')
        : String(rawDate||'').trim();
      const rawTime = data[r][ti];
      const rowTime = rawTime instanceof Date
        ? String(rawTime.getHours()).padStart(2,'0') + ':' + String(rawTime.getMinutes()).padStart(2,'0')
        : String(rawTime||'').trim().slice(0,5);
      const rowKey = [rowDate, rowTime, Math.round(parseFloat(data[r][ai])||0), data[r][ci]].join('|');
      if (rowKey === key) return { sheet, rowIndex: r + 1, hdrLen: Math.max(hdr.length, TX_HEADERS.length) };
    }
  }
  return null;
}

function updateTransaction(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const found = findRow(ss, body);
  if (!found) return jsonResponse({ ok: true, note: 'row not found' });
  const cols = Math.max(found.hdrLen || TX_HEADERS.length, TX_HEADERS.length);
  const row = [
    body['Date'], body['Time'], body['Category'], body['Amount'],
    body['Mode of Payment'], body['Note'], body['Split']||1,
    body['Paid']||0, body['Location']||'', body['Tags']||'', body['Id']||''
  ];
  while (row.length < cols) row.push('');
  found.sheet.getRange(found.rowIndex, 1, 1, cols).setValues([row.slice(0, cols)]);
  return jsonResponse({ ok: true });
}

function deleteTransaction(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const found = findRow(ss, body);
  if (!found) return jsonResponse({ ok: true, note: 'row not found' });
  found.sheet.deleteRow(found.rowIndex);
  return jsonResponse({ ok: true });
}
