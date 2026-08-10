'use strict';

// ── CONSTANTS ──────────────────────────────────────────────
const CATS = [
  {k:'Food',i:'🍽️',c:'#ff8c42'},
  {k:'Travel & Commute',i:'🚇',c:'#5b9cf6'},
  {k:'Bills',i:'📄',c:'#9b6dff'},
  {k:'Q-Commerce',i:'🛒',c:'#2dd4bf'},
  {k:'Entertainment',i:'🎬',c:'#ff6eb4'},
  {k:'Investments',i:'📈',c:'#3ddc84'},
  {k:'Shopping',i:'🛍️',c:'#f5d76e'},
  {k:'Others',i:'📦',c:'#7270a0'},
];
const PAYS = [{k:'UPI',i:'📲'},{k:'Credit Card',i:'💳'}];
const CAT_KEYWORDS = {
  'Food':['food','eat','restaurant','cafe','coffee','lunch','dinner','breakfast','snack','juice','sugarcane','noodle','buritto','burrito','mcdonalds','mcd','theobroma','cake','kapoor','shoba','green theory','social'],
  'Travel & Commute':['metro','bus','auto','cab','ola','uber','fuel','petrol','parking','commute','train','flight','travel','rapido'],
  'Bills':['bill','recharge','airtel','jio','vi','electricity','gas','cylinder','subscription','apple','unicef','donation','fancode','rent','emi'],
  'Q-Commerce':['blinkit','zepto','swiggy','zomato','instamart','dunzo','bigbasket','grofer'],
  'Entertainment':['pvr','inox','movie','cinema','concert','show','netflix','spotify','prime','hotstar','disclosure','bookmyshow'],
  'Investments':['indmoney','zerodha','groww','mutual fund','sip','invest','stock','nifty','ppf','fd'],
  'Shopping':['amazon','flipkart','myntra','ajio','nykaa','shop','mall','cloth','meesho'],
  'Others':['porter','other','misc'],
};
const COLORS = ['#e8c547','#5b9cf6','#ff8c42','#3ddc84','#9b6dff','#ff6eb4','#2dd4bf','#7270a0'];
const CURRENCIES = [
  {k:'INR',s:'₹'},{k:'USD',s:'$'},{k:'EUR',s:'€'},
  {k:'GBP',s:'£'},{k:'JPY',s:'¥'},{k:'AED',s:'د.إ'},{k:'SGD',s:'S$'},
];

const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzj6infQ9TjQVjTjZNlMllpkhRB_No5KqjSS2vo_0NdPARgzVnDGumK8_93PP79D66Y/exec';
let txns = [];
let editId = null;
let period = 'today';
let searchQ = '';
let drillFilter = null;
let analyticsMonth = null;
let analyticsTab = 'overview';
let deferredInstall = null;
let sheetUrl = '';
let budget = 0;
let splitN = 1;
let catBudgets = {};
let recurringList = [];
let goals = [];
let moodLog = {};
let splitsExpanded = false;
let selectedCurrency = 'INR';
let fxRates = {};
let themePref = 'dark';
let openTxnId = null;
let pendingCount = 0;

// ── STORAGE ────────────────────────────────────────────────
function load() {
  try {
    txns = JSON.parse(localStorage.getItem('vyaya_txns') || '[]');
    localStorage.setItem('vyaya_data_ver', '2');
    sheetUrl = localStorage.getItem('vyaya_url') || DEFAULT_SHEET_URL;
    budget = parseFloat(localStorage.getItem('vyaya_budget') || '0');
    catBudgets = JSON.parse(localStorage.getItem('vyaya_cat_budgets') || '{}');
    recurringList = JSON.parse(localStorage.getItem('vyaya_recurring') || '[]');
    goals = JSON.parse(localStorage.getItem('vyaya_goals') || '[]');
    moodLog = JSON.parse(localStorage.getItem('vyaya_mood') || '{}');
    themePref = localStorage.getItem('vyaya_theme') || 'dark';
    pendingCount = parseInt(localStorage.getItem('vyaya_pending') || '0', 10) || 0;
    let migrated = false;
    txns = txns.map(t => {
      let changed = false;
      const nd = normDate(t.date);
      const next = Object.assign({}, t);
      if (nd !== t.date) { next.date = nd; changed = true; }
      if (!next.id) { next.id = genId(); changed = true; }
      if (changed) migrated = true;
      return next;
    });
    if (migrated) localStorage.setItem('vyaya_txns', JSON.stringify(txns));
  } catch(e) { txns = []; }
}
function save() {
  try {
    localStorage.setItem('vyaya_txns', JSON.stringify(txns));
  } catch(e) {
    if (e.name === 'QuotaExceededError') toast('Storage full — export your data first', 'err');
  }
}
function saveSettings() {
  localStorage.setItem('vyaya_cat_budgets', JSON.stringify(catBudgets));
  localStorage.setItem('vyaya_recurring', JSON.stringify(recurringList));
  localStorage.setItem('vyaya_goals', JSON.stringify(goals));
  localStorage.setItem('vyaya_mood', JSON.stringify(moodLog));
}

// ── CATEGORY NORMALIZER ────────────────────────────────────
function normCat(raw) {
  if (!raw) return 'Others';
  const r = raw.trim().toLowerCase();
  if (r === 'travel' || r === 'commute' || r === 'travel & commute' || r === 'transport') return 'Travel & Commute';
  if (r === 'other' || r === 'misc' || r === 'miscellaneous') return 'Others';
  if (r === 'food & dining' || r === 'dining' || r === 'food') return 'Food';
  if (r === 'bill' || r === 'bills & utilities' || r === 'utilities') return 'Bills';
  if (r === 'q-commerce' || r === 'quick commerce' || r === 'grocery') return 'Q-Commerce';
  if (r === 'entertainment' || r === 'leisure') return 'Entertainment';
  if (r === 'investment' || r === 'investments' || r === 'savings') return 'Investments';
  if (r === 'shopping' || r === 'clothes' || r === 'fashion') return 'Shopping';
  // Check against known categories
  const match = CATS.find(c => c.k.toLowerCase() === r);
  return match ? match.k : 'Others';
}

// ── CSV PARSER ─────────────────────────────────────────────
function parseCSVLine(line) {
  const cols = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur.trim()); return cols;
}
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line) continue;
    const cols = parseCSVLine(line); const obj = {};
    header.forEach((h, j) => { obj[h] = (cols[j] || '').trim(); });
    const amt = parseFloat((obj['Amount'] || '0').replace(/,/g, ''));
    if (!obj['Date'] || isNaN(amt) || amt <= 0) continue;
    rows.push({
      id: obj['Id'] || obj['ID'] || genId(), date: normDate(obj['Date']), time: obj['Time'] || '00:00',
      category: normCat(obj['Category'] || 'Others'), amount: amt,
      payment: obj['Mode of Payment'] || 'UPI', note: obj['Note'] || '',
      split: parseInt(obj['Split'] || '1') || 1, paidCount: parseInt(obj['Paid'] || '0') || 0,
      tags: parseTags(obj['Tags'] || obj['Note'] || ''), location: obj['Location'] || '',
      pending: false,
    });
  }
  return rows;
}

// ── DATE HELPERS ───────────────────────────────────────────
function normDate(raw) {
  if (!raw) return today(); raw = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const sep = raw.includes('/') ? '/' : '-'; const p = raw.split(sep);
  if (p.length === 3) {
    if (p[2].length === 4) return p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0');
    if (p[0].length === 4) return p[0] + '-' + p[1].padStart(2,'0') + '-' + p[2].padStart(2,'0');
  }
  const d = new Date(raw); if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'});
  return today();
}
function today() { return new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'}); }
function nowTime() { return new Date().toLocaleTimeString('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', hour12:false}); }
function istHour() { return parseInt(new Date().toLocaleTimeString('en-US', {timeZone:'Asia/Kolkata', hour:'numeric', hour12:false})); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function istDateOffset(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'});
}
function yesterday() { return istDateOffset(-1); }
function isSpendCat(cat) { return cat !== 'Investments'; }
function spendAmount(t) { return isSpendCat(t.category) ? (t.amount || 0) : 0; }
function txnFingerprint(t) {
  return [t.date, t.time || '00:00', Math.round(t.amount || 0), t.category || '', (t.note || '').trim().toLowerCase()].join('|');
}
function fmtDate(d) {
  if (!d) return ''; const parts = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parseInt(parts[2]) + ' ' + months[parseInt(parts[1])-1];
}
function fmtAmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function monthKey(dateStr) { if (!dateStr) return ''; return dateStr.slice(0,7); }
function monthLabel(ym) {
  if (!ym) return ''; const parts = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1])-1] + ' ' + parts[0];
}
function currentMonthKey() { return today().slice(0,7); }
function prevMonthKey(ym) {
  const parts = ym.split('-').map(Number);
  if (parts[1] === 1) return (parts[0]-1) + '-12';
  return parts[0] + '-' + String(parts[1]-1).padStart(2,'0');
}
function nextMonthKey(ym) {
  const parts = ym.split('-').map(Number);
  if (parts[1] === 12) return (parts[0]+1) + '-01';
  return parts[0] + '-' + String(parts[1]+1).padStart(2,'0');
}
function daysInMonth(ym) { const p = ym.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
function dayOfMonth(dateStr) { return parseInt(dateStr.split('-')[2]); }

// ── TAGS ───────────────────────────────────────────────────
function parseTags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w-]+/g) || [];
  return [...new Set(matches.map(t => t.toLowerCase()))];
}

// ── CATEGORY HELPERS ───────────────────────────────────────
function catInfo(k) { return CATS.find(c => c.k.toLowerCase() === (k||'').toLowerCase()) || CATS[CATS.length-1]; }
function suggestCat(note) {
  if (!note) return null; const n = note.toLowerCase();
  for (const [cat, kws] of Object.entries(CAT_KEYWORDS)) {
    for (const kw of kws) { if (n.includes(kw)) return cat; }
  }
  return null;
}
function payInfo(k) { return PAYS.find(p => p.k.toLowerCase() === (k||'').toLowerCase()) || PAYS[0]; }
function payColor(k) { const m = {'UPI':'rgba(91,156,246,.15)','Credit Card':'rgba(155,109,255,.15)'}; return m[k] || 'rgba(255,255,255,.07)'; }
function payTextColor(k) { const m = {'UPI':'#5b9cf6','Credit Card':'#9b6dff'}; return m[k] || '#a09ec0'; }

// ── NATURAL LANGUAGE PARSE ─────────────────────────────────
function parseNaturalNote(text) {
  if (!text) return null;
  // "paid 450 for lunch" or "450 for coffee" or "spent 1200 on amazon"
  const m = text.match(/(?:paid|spent|spend)?\s*(\d+(?:\.\d+)?)\s*(?:for|on|at)?\s*(.*)/i);
  if (m && parseFloat(m[1]) > 0) {
    return { amount: parseFloat(m[1]), desc: m[2].trim() };
  }
  return null;
}

// ── SMART SEARCH ───────────────────────────────────────────
function parseSmartSearch(q) {
  if (!q) return null;
  const filters = {}; let rem = q.trim();
  const rangeM = rem.match(/(\d+)-(\d+)/);
  if (rangeM) { filters.amtMin = parseFloat(rangeM[1]); filters.amtMax = parseFloat(rangeM[2]); rem = rem.replace(rangeM[0], '').trim(); }
  const gtM = rem.match(/>(\d+)/);
  if (gtM) { filters.amtMin = parseFloat(gtM[1]); rem = rem.replace(gtM[0], '').trim(); }
  const ltM = rem.match(/<(\d+)/);
  if (ltM) { filters.amtMax = parseFloat(ltM[1]); rem = rem.replace(ltM[0], '').trim(); }
  const tagM = rem.match(/#[\w-]+/g) || [];
  if (tagM.length) { filters.tags = tagM.map(t => t.toLowerCase()); rem = rem.replace(/#[\w-]+/g, '').trim(); }
  if (/\bupi\b/i.test(rem)) { filters.payment = 'UPI'; rem = rem.replace(/\bupi\b/gi, '').trim(); }
  if (/\bcc\b|\bcredit\b/i.test(rem)) { filters.payment = 'Credit Card'; rem = rem.replace(/\bcc\b|\bcredit\b/gi, '').trim(); }
  const mNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const mFull = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  for (let i = 0; i < 12; i++) {
    const re = new RegExp('\\b(' + mNames[i] + '|' + mFull[i] + ')\\b', 'i');
    if (re.test(rem)) { filters.month = new Date().getFullYear() + '-' + String(i+1).padStart(2,'0'); rem = rem.replace(re, '').trim(); break; }
  }
  if (/\blast month\b/i.test(rem)) { filters.month = prevMonthKey(currentMonthKey()); rem = rem.replace(/\blast month\b/i, '').trim(); }
  if (/\bthis month\b/i.test(rem)) { filters.month = currentMonthKey(); rem = rem.replace(/\bthis month\b/i, '').trim(); }
  if (/\btoday\b/i.test(rem)) { filters.date = today(); rem = rem.replace(/\btoday\b/i, '').trim(); }
  filters.text = rem.trim(); return filters;
}
function applySmartSearch(list, q) {
  const f = parseSmartSearch(q); if (!f) return list;
  return list.filter(t => {
    if (f.amtMin !== undefined && t.amount < f.amtMin) return false;
    if (f.amtMax !== undefined && t.amount > f.amtMax) return false;
    if (f.payment && t.payment !== f.payment) return false;
    if (f.month && monthKey(t.date) !== f.month) return false;
    if (f.date && t.date !== f.date) return false;
    if (f.tags && f.tags.length) {
      const tTags = (t.tags && t.tags.length) ? t.tags : parseTags(t.note);
      if (!f.tags.every(tag => tTags.includes(tag))) return false;
    }
    if (f.text) {
      const tx = f.text.toLowerCase();
      if (!((t.note||'').toLowerCase().includes(tx) || (t.category||'').toLowerCase().includes(tx) ||
        (t.payment||'').toLowerCase().includes(tx) || String(t.amount).includes(tx) || (t.location||'').toLowerCase().includes(tx))) return false;
    }
    return true;
  });
}

// ── FILTER ─────────────────────────────────────────────────
function filteredTxns() {
  const todayStr = today();
  const weekAgo = istDateOffset(-7);
  const curMon = currentMonthKey();
  let list = txns.slice();
  if (drillFilter) {
    if (drillFilter.type === 'dow') {
      list = list.filter(t => { const d = new Date(t.date+'T00:00:00'); return d.getDay() === drillFilter.value && monthKey(t.date) === drillFilter.month; });
    } else if (drillFilter.type === 'payment') {
      list = list.filter(t => t.payment === drillFilter.value && monthKey(t.date) === drillFilter.month);
    } else if (drillFilter.type === 'category') {
      list = list.filter(t => t.category === drillFilter.value && monthKey(t.date) === drillFilter.month);
    } else if (drillFilter.type === 'tag') {
      list = list.filter(t => { const tags = (t.tags && t.tags.length) ? t.tags : parseTags(t.note); return tags.includes(drillFilter.value); });
    }
    list.sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time)); return list;
  }
  if (searchQ) { list = applySmartSearch(list, searchQ); }
  else {
    if (period === 'today') list = list.filter(t => t.date === todayStr);
    else if (period === 'week') list = list.filter(t => t.date >= weekAgo);
    else if (period === 'month') list = list.filter(t => monthKey(t.date) === curMon);
  }
  list.sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time)); return list;
}

// ── SPEND PERSONALITY ──────────────────────────────────────
function getSpendPersonality() {
  const list = txns.filter(t => monthKey(t.date) === currentMonthKey());
  if (list.length < 3) return null;
  const spendList = list.filter(t => isSpendCat(t.category));
  const total = spendList.reduce((s,t) => s+t.amount, 0);
  if (total <= 0) return null;
  const catTotals = {};
  spendList.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const topPct = topCat ? Math.round(topCat[1]/total*100) : 0;
  const nightPct = Math.round(list.filter(t => parseInt((t.time||'00:00').split(':')[0]) >= 21).length / list.length * 100);
  const weekendAmt = spendList.filter(t => { const d = new Date(t.date+'T00:00:00'); return d.getDay()===0||d.getDay()===6; }).reduce((s,t)=>s+t.amount,0);
  const weekendPct = Math.round(weekendAmt/total*100);
  if (topCat && topCat[0]==='Food' && topPct>=35) return {label:'The Foodie 🍽️',sub:'Food is '+topPct+'% of your spend',type:'gold'};
  if (topCat && topCat[0]==='Investments' && topPct>=30) return {label:'The Investor 📈',sub:'Investing '+topPct+'% of spend',type:'good'};
  if (topCat && topCat[0]==='Entertainment' && topPct>=25) return {label:'The Entertainer 🎬',sub:'Entertainment is '+topPct+'% of spend',type:'purple'};
  if (topCat && topCat[0]==='Q-Commerce' && topPct>=25) return {label:'The Homebody 🏠',sub:'Q-Commerce is '+topPct+'% of spend',type:'info'};
  if (topCat && topCat[0]==='Shopping' && topPct>=25) return {label:'The Shopaholic 🛍️',sub:'Shopping is '+topPct+'% of spend',type:'warn'};
  if (nightPct>=40) return {label:'The Night Owl 🌙',sub:nightPct+'% of expenses after 9pm',type:'purple'};
  if (weekendPct>=65) return {label:'The Weekend Splurger 🎉',sub:weekendPct+'% of spend on weekends',type:'gold'};
  if (topCat && topCat[0]==='Travel & Commute' && topPct>=25) return {label:'The Commuter 🚇',sub:'Travel is '+topPct+'% of spend',type:'info'};
  return {label:'The Balanced Spender ⚖️',sub:'Spread across '+Object.keys(catTotals).length+' categories',type:'good'};
}

// ── SPEND STREAK ───────────────────────────────────────────
function getSpendStreak() {
  const disc = ['Food','Travel & Commute','Q-Commerce','Entertainment','Shopping','Others'];
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const ds = istDateOffset(-i);
    if (txns.filter(t => t.date === ds && disc.includes(t.category)).length === 0) streak++;
    else break;
  }
  return streak;
}
function getUnderBudgetStreak() {
  if (!budget) return 0; let streak = 0; let mk = prevMonthKey(currentMonthKey());
  for (let i = 0; i < 12; i++) {
    const total = txns.filter(t => monthKey(t.date) === mk).reduce((s,t)=>s+spendAmount(t),0);
    if (total > 0 && total <= budget) { streak++; mk = prevMonthKey(mk); } else break;
  }
  return streak;
}

// ── RENDER HERO ────────────────────────────────────────────
function renderHero() {
  const curMon = currentMonthKey(); const prevMon = prevMonthKey(curMon);
  const curList = txns.filter(t => monthKey(t.date) === curMon);
  const prevList = txns.filter(t => monthKey(t.date) === prevMon);
  const curTotal = curList.reduce((s,t) => s + spendAmount(t), 0);
  const prevTotal = prevList.reduce((s,t) => s + spendAmount(t), 0);
  const labels = {month:'THIS MONTH',week:'THIS WEEK',today:'TODAY',all:'ALL TIME'};
  const filtered = filteredTxns();
  const filtTotal = filtered.reduce((s,t) => s + spendAmount(t), 0);
  document.getElementById('heroPeriod').textContent = labels[period] || 'TODAY';
  document.getElementById('heroAmt').textContent = Math.round(filtTotal).toLocaleString('en-IN');
  const badge = document.getElementById('heroBadge'); const badgeLbl = document.getElementById('heroBadgeLbl');
  if (period === 'month' && prevTotal > 0) {
    const diff = ((curTotal-prevTotal)/prevTotal*100).toFixed(0); const up = curTotal > prevTotal;
    badge.className = 'hero-badge ' + (up ? 'badge-up' : 'badge-dn');
    badge.textContent = (up ? '▲' : '▼') + ' ' + Math.abs(diff) + '%';
    badgeLbl.textContent = 'vs ' + monthLabel(prevMon);
  } else if (period === 'month' && prevTotal === 0 && curTotal > 0) {
    badge.className = 'hero-badge badge-eq'; badge.textContent = 'First month'; badgeLbl.textContent = '';
  } else {
    badge.className = 'hero-badge badge-eq'; badge.textContent = filtered.length + ' txns'; badgeLbl.textContent = '';
  }
  document.getElementById('heroTxns').textContent = filtered.length;
  const daysElapsed = period === 'month' ? Math.max(1, dayOfMonth(today())) : (period === 'week' ? 7 : 1);
  document.getElementById('heroAvg').textContent = fmtAmt(filtTotal / daysElapsed);
  const spendFiltered = filtered.filter(t => isSpendCat(t.category));
  const biggest = spendFiltered.length ? Math.max(...spendFiltered.map(t => t.amount)) : 0;
  document.getElementById('heroBig').textContent = fmtAmt(biggest);

  // Budget bar (monthly spend vs budget)
  const heroBudget = document.getElementById('heroBudget');
  if (budget > 0) {
    const pct = Math.min(999, Math.round(curTotal / budget * 100));
    const fillPct = Math.min(100, pct);
    const col = pct >= 90 ? 'var(--re)' : pct >= 70 ? 'var(--or)' : 'var(--gold)';
    heroBudget.hidden = false;
    document.getElementById('heroBudgetLbl').textContent = fmtAmt(curTotal) + ' of ' + fmtAmt(budget);
    document.getElementById('heroBudgetPct').textContent = pct + '%';
    document.getElementById('heroBudgetPct').style.color = col;
    const fill = document.getElementById('heroBudgetFill');
    fill.style.width = fillPct + '%';
    fill.style.background = col;
  } else {
    heroBudget.hidden = true;
  }

  // Investments shown separately
  const investTotal = (period === 'month' ? curList : filtered)
    .filter(t => t.category === 'Investments')
    .reduce((s,t) => s + t.amount, 0);
  const heroInvest = document.getElementById('heroInvest');
  if (investTotal > 0) {
    heroInvest.hidden = false;
    document.getElementById('heroInvestAmt').textContent = fmtAmt(investTotal);
  } else {
    heroInvest.hidden = true;
  }

  const splitTxns = txns.filter(t => t.split > 1 && t.paidCount < t.split - 1);
  const owedAmt = splitTxns.reduce((s,t) => s + (t.amount/t.split)*(t.split-1-t.paidCount), 0);
  const heroOwed = document.getElementById('heroOwed');
  if (owedAmt > 0) {
    heroOwed.classList.add('on');
    document.getElementById('heroOwedAmt').textContent = fmtAmt(owedAmt);
    document.getElementById('heroOwedSub').textContent = splitTxns.length + ' pending';
  } else { heroOwed.classList.remove('on'); }

  updatePendingPill();
}

// ── RENDER INSIGHTS ────────────────────────────────────────
function renderInsights() {
  const row = document.getElementById('insightsRow');
  const curMon = currentMonthKey(); const prevMon = prevMonthKey(curMon);
  const curList = txns.filter(t => monthKey(t.date) === curMon);
  const prevList = txns.filter(t => monthKey(t.date) === prevMon);
  const curTotal = curList.reduce((s,t) => s + spendAmount(t), 0);
  const prevTotal = prevList.reduce((s,t) => s + spendAmount(t), 0);
  const cards = [];

  // Skip budget card if already in hero
  Object.entries(catBudgets).forEach(([cat, lim]) => {
    if (!lim) return;
    const spent = curList.filter(t => t.category === cat).reduce((s,t) => s+t.amount, 0);
    const pct = Math.round(spent/lim*100);
    if (pct >= 90) cards.push({type:'warn',ico:catInfo(cat).i,title:esc(cat)+' budget '+pct+'%',sub:fmtAmt(spent)+' of '+fmtAmt(lim)});
    else if (pct >= 70) cards.push({type:'gold',ico:catInfo(cat).i,title:esc(cat)+' at '+pct+'%',sub:fmtAmt(lim-spent)+' remaining'});
  });

  const catTotals = {};
  curList.filter(t => isSpendCat(t.category)).forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  if (topCat && curTotal > 0) {
    const ci = catInfo(topCat[0]); const pct = Math.round(topCat[1]/curTotal*100);
    cards.push({type:'info',ico:ci.i,title:'Top: '+esc(topCat[0]),sub:fmtAmt(topCat[1])+' · '+pct+'% of spend'});
  }

  if (prevTotal > 0) {
    const diff = curTotal - prevTotal; const pct = Math.abs(Math.round(diff/prevTotal*100));
    if (diff > 0) cards.push({type:'warn',ico:'↑',title:pct+'% more than last month',sub:fmtAmt(diff)+' extra vs '+monthLabel(prevMon)});
    else if (diff < 0) cards.push({type:'good',ico:'↓',title:pct+'% less than last month',sub:'Saved '+fmtAmt(-diff)+' vs '+monthLabel(prevMon)});
  }

  const dayNum = dayOfMonth(today()); const daysTotal = daysInMonth(curMon);
  if (dayNum > 0 && curTotal > 0) {
    const dailyAvg = curTotal/dayNum; const predicted = Math.round(dailyAvg*daysTotal);
    cards.push({type:'purple',ico:'◎',title:'Predicted: '+fmtAmt(predicted),sub:'At '+fmtAmt(dailyAvg)+'/day pace'});
  }

  const personality = getSpendPersonality();
  if (personality) cards.push({type:personality.type,ico:'✦',title:esc(personality.label),sub:esc(personality.sub)});

  const streak = getSpendStreak();
  if (streak >= 2) cards.push({type:'good',ico:'◆',title:streak+'-day no-spend streak',sub:'No discretionary spend for '+streak+' days'});

  const ubStreak = getUnderBudgetStreak();
  if (ubStreak >= 2) cards.push({type:'good',ico:'★',title:ubStreak+' months under budget',sub:'Keep it up'});

  goals.forEach(g => {
    if (!g.target || !g.name) return;
    const saved = g.saved || 0;
    const pct = Math.min(100, Math.round(saved/g.target*100));
    cards.push({type:'info',ico:'◎',title:esc(g.name)+': '+pct+'%',sub:fmtAmt(saved)+' of '+fmtAmt(g.target)});
  });

  const splitTxns = txns.filter(t => t.split > 1 && t.paidCount < t.split - 1);
  if (splitTxns.length > 0) {
    const owedAmt = splitTxns.reduce((s,t) => s + (t.amount/t.split)*(t.split-1-t.paidCount), 0);
    cards.push({type:'purple',ico:'⇄',title:splitTxns.length+' splits pending',sub:fmtAmt(owedAmt)+' owed to you',action:'splits'});
  }

  // Keep home calm — max 4 insight cards
  const shown = cards.slice(0, 4);

  row.innerHTML = shown.map(c =>
    '<div class="insight-card ' + c.type + '"' + (c.action ? ' data-action="'+c.action+'"' : '') + '>' +
    '<span class="insight-ico">' + c.ico + '</span>' +
    '<div class="insight-title">' + c.title + '</div>' +
    '<div class="insight-sub">' + c.sub + '</div>' +
    '</div>'
  ).join('');

  row.querySelectorAll('[data-action="splits"]').forEach(el => {
    el.onclick = () => {
      analyticsTab = 'overview'; splitsExpanded = true;
      document.querySelectorAll('.a-tab').forEach(x=>x.classList.remove('on'));
      const tab = document.querySelector('.a-tab[data-at="overview"]');
      if (tab) tab.classList.add('on');
      showView('Analytics');
      setTimeout(() => { const card = document.getElementById('splitsPendingCard'); if (card) card.scrollIntoView({behavior:'smooth',block:'center'}); }, 200);
    };
  });

  document.getElementById('insightsWrap').style.display = shown.length ? '' : 'none';
}

// ── RECURRING HELPERS ──────────────────────────────────────
function recurringFreqLabel(r) {
  if (r.freq === 'daily') return 'Every day';
  if (r.freq === 'weekly') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const on = (r.freqDays || []).map(d => days[d]).join(', ');
    return 'Weekly' + (on ? ' · ' + on : '');
  }
  if (r.freq === 'monthly') {
    return 'Monthly' + (r.freqDate ? ' · ' + r.freqDate + (r.freqDate === 1 ? 'st' : r.freqDate === 2 ? 'nd' : r.freqDate === 3 ? 'rd' : 'th') : '');
  }
  if (r.freq === 'interval') return 'Every ' + (r.freqN || 30) + ' days';
  return 'Monthly';
}

function isRecurringDue(r) {
  if (!r.name || !r.amount) return false;
  const todayStr = today();
  const todayDate = new Date(todayStr + 'T00:00:00');
  const lastStr = r.lastLogged || null;

  // Check if already logged today
  const loggedToday = txns.some(t =>
    t.date === todayStr &&
    t.note && t.note.toLowerCase().includes(r.name.toLowerCase()) &&
    Math.abs(t.amount - r.amount) < 1
  );
  if (loggedToday) return false;

  const freq = r.freq || 'monthly';

  if (freq === 'daily') return true;

  if (freq === 'weekly') {
    const dow = todayDate.getDay();
    const days = r.freqDays && r.freqDays.length ? r.freqDays : [1]; // default Monday
    return days.includes(dow);
  }

  if (freq === 'monthly') {
    const targetDate = r.freqDate || 1;
    const dom = parseInt(todayStr.split('-')[2]);
    // Due on the target date, or if past it and not logged this month
    const curMon = currentMonthKey();
    const loggedThisMonth = txns.some(t =>
      monthKey(t.date) === curMon &&
      t.note && t.note.toLowerCase().includes(r.name.toLowerCase()) &&
      Math.abs(t.amount - r.amount) < 1
    );
    return !loggedThisMonth && dom >= targetDate;
  }

  if (freq === 'interval') {
    if (!lastStr) return true;
    const last = new Date(lastStr + 'T00:00:00');
    const diffDays = Math.floor((todayDate - last) / 86400000);
    return diffDays >= (r.freqN || 30);
  }

  // fallback: monthly
  const curMon = currentMonthKey();
  return !txns.some(t =>
    monthKey(t.date) === curMon &&
    t.note && t.note.toLowerCase().includes(r.name.toLowerCase()) &&
    Math.abs(t.amount - r.amount) < 1
  );
}

// ── RECURRING REMINDER ─────────────────────────────────────
function renderRecurringBanner() {
  const banner = document.getElementById('recurringBanner');
  if (!banner) return;
  const due = recurringList.filter(isRecurringDue);
  if (due.length === 0) { banner.hidden = true; banner.style.display = 'none'; return; }
  banner.hidden = false; banner.style.display = 'flex';
  document.getElementById('recurringBannerText').textContent =
    due.length + ' recurring expense' + (due.length > 1 ? 's' : '') + ' due: ' + due.map(r => r.name).join(', ');
  document.getElementById('recurringBannerBtn').onclick = () => {
    const r = due[0];
    openAdd();
    setTimeout(() => {
      document.getElementById('inAmt').value = r.amount;
      document.getElementById('inNote').value = r.name;
      selectChip('catGrid', r.category || 'Bills');
      selectChip('payGrid', r.payment || 'UPI');
      updateSplit();
      const hint = document.getElementById('catHint');
      hint.textContent = 'Recurring: ' + r.name + ' · ' + recurringFreqLabel(r);
      hint.className = 'cat-hint on';
    }, 100);
  };
}

// ── RENDER TRANSACTIONS ────────────────────────────────────
function renderTxns() {
  const list = filteredTxns(); const el = document.getElementById('txList'); const title = document.getElementById('txTitle');
  const labels = {month:'This Month',week:'This Week',today:'Today',all:'All Time'};
  title.textContent = searchQ ? 'Results for "' + searchQ + '"' : (labels[period] || 'Recent');
  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ico">₹</div><div class="empty-txt">' + (searchQ ? 'No results found' : 'No expenses yet.<br>Tap + to add one') + '</div></div>';
    return;
  }
  const groups = {};
  list.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
  const todayStr = today(); const yday = yesterday();
  let html = '';
  Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(dk => {
    let dlbl = fmtDate(dk);
    if (dk === todayStr) dlbl = 'Today'; else if (dk === yday) dlbl = 'Yesterday';
    html += '<div class="date-group">' + dlbl + '</div>';
    groups[dk].forEach(t => { html += txnHTML(t); });
  });
  el.innerHTML = html; attachTxnEvents();
}

function txnHTML(t) {
  const ci = catInfo(t.category); const pi = payInfo(t.payment);
  const isSplit = t.split > 1; const allPaid = isSplit && t.paidCount >= t.split - 1;
  const remaining = isSplit ? t.split - 1 - t.paidCount : 0; const share = isSplit ? t.amount / t.split : t.amount;
  const tags = (t.tags && t.tags.length) ? t.tags : parseTags(t.note);
  const rawName = t.note ? (t.note.replace(/#[\w-]+/g,'').trim() || t.category) : t.category;
  const isOpen = openTxnId === t.id;
  let html = '<div class="tx' + (isOpen ? ' open' : '') + '" data-id="' + esc(t.id) + '">';
  html += '<div class="tx-ico" style="background:' + ci.c + '22">' + ci.i + '</div>';
  html += '<div class="tx-body">';
  html += '<div class="tx-name">' + esc(rawName) + '</div>';
  html += '<div class="tx-sub">';
  html += '<span>' + esc(fmtDate(t.date)) + ' · ' + esc(t.time || '') + '</span>';
  html += '<span class="pay-pill" style="background:' + payColor(t.payment) + ';color:' + payTextColor(t.payment) + ';border-color:' + payTextColor(t.payment) + '44">' + pi.i + ' ' + esc(t.payment) + '</span>';
  if (isSplit) html += '<span class="rec-pill">⇄ ' + t.split + (allPaid ? ' ✓' : ' (' + remaining + ' owed)') + '</span>';
  if (t.location) html += '<span class="loc-pill">⌖ ' + esc(t.location) + '</span>';
  html += '</div>';
  if (tags.length) html += '<div class="tx-tags">' + tags.map(tag => '<span class="tag-pill" data-tag="'+esc(tag)+'">'+esc(tag)+'</span>').join('') + '</div>';
  if (t.originalCurrency && t.originalCurrency !== 'INR') {
    const cs = CURRENCIES.find(c=>c.k===t.originalCurrency); const sym = cs ? cs.s : t.originalCurrency;
    html += '<div class="tx-fx">' + esc(sym) + Math.round(t.originalAmount) + ' → ₹' + Math.round(t.amount) + '</div>';
  }
  if (t.pending) html += '<div class="tx-pending">Not synced yet</div>';
  if (isSplit && !allPaid && isOpen) {
    html += '<div class="settle-row" id="sr_' + esc(t.id) + '" style="display:flex">';
    html += '<div class="settle-info">Share: ' + fmtAmt(share) + ' · ' + remaining + ' person' + (remaining>1?'s':'') + ' owe you</div>';
    html += '<div class="settle-controls">';
    html += '<button class="settle-btn" data-settle-dec="' + esc(t.id) + '" type="button">−</button>';
    html += '<span class="settle-count">' + t.paidCount + '/' + (t.split-1) + '</span>';
    html += '<button class="settle-btn" data-settle-inc="' + esc(t.id) + '" type="button">+</button>';
    html += '<button class="settle-all" data-settle-all="' + esc(t.id) + '" type="button">All paid</button>';
    html += '</div></div>';
  }
  const isRec = recurringList.some(r => r.name && t.note && r.name.toLowerCase() === t.note.replace(/#[\w-]+/g,'').trim().toLowerCase());
  html += '<div class="tx-actions">';
  html += '<button class="tx-btn rec-mark' + (isRec ? ' on' : '') + '" data-rec="' + esc(t.id) + '" type="button">' + (isRec ? 'Recurring' : 'Make recurring') + '</button>';
  html += '<button class="tx-btn" data-edit="' + esc(t.id) + '" type="button">Edit</button>';
  html += '<button class="tx-btn del" data-del="' + esc(t.id) + '" type="button">Delete</button>';
  html += '</div>';
  html += '</div>';
  html += '<div class="tx-r">';
  html += '<div class="tx-amt' + (t.category === 'Investments' ? ' invest' : '') + '">' + fmtAmt(t.amount) + '</div>';
  if (isSplit) html += '<div style="font-size:10px;color:var(--m2)">Your: ' + fmtAmt(share) + '</div>';
  html += '<button class="tx-menu" data-menu="' + esc(t.id) + '" type="button" aria-label="Actions">⋯</button>';
  html += '</div></div>';
  return html;
}

function attachTxnEvents() {
  document.querySelectorAll('.tx').forEach(row => {
    row.onclick = e => {
      if (e.target.closest('button') || e.target.closest('.tag-pill') || e.target.closest('.settle-row')) return;
      const id = row.dataset.id;
      openTxnId = openTxnId === id ? null : id;
      renderTxns();
    };
  });
  document.querySelectorAll('[data-menu]').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      const id = b.dataset.menu;
      openTxnId = openTxnId === id ? null : id;
      renderTxns();
    };
  });
  document.querySelectorAll('[data-edit]').forEach(b => { b.onclick = e => { e.stopPropagation(); openEdit(b.dataset.edit); }; });
  document.querySelectorAll('[data-del]').forEach(b => { b.onclick = e => { e.stopPropagation(); deleteTxn(b.dataset.del); }; });
  document.querySelectorAll('[data-rec]').forEach(b => { b.onclick = e => { e.stopPropagation(); openRecurringModal(b.dataset.rec); }; });
  document.querySelectorAll('[data-settle-inc]').forEach(b => { b.onclick = e => { e.stopPropagation(); settle(b.dataset.settleInc, 1); }; });
  document.querySelectorAll('[data-settle-dec]').forEach(b => { b.onclick = e => { e.stopPropagation(); settle(b.dataset.settleDec, -1); }; });
  document.querySelectorAll('[data-settle-all]').forEach(b => { b.onclick = e => { e.stopPropagation(); settleAll(b.dataset.settleAll); }; });
  document.querySelectorAll('.tag-pill').forEach(pill => {
    pill.onclick = e => { e.stopPropagation(); drillFilter = {type:'tag', value:pill.dataset.tag}; showView('Home'); document.getElementById('txTitle').textContent = pill.dataset.tag; render(); };
  });
}

function openRecurringModal(txId) {
  const t = txns.find(x => x.id === txId); if (!t) return;
  const name = (t.note || t.category).replace(/#[\w-]+/g,'').trim();
  const existing = recurringList.find(r => r.name && r.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    toast('Already in recurring: ' + existing.name + ' · ' + recurringFreqLabel(existing), 'info');
    return;
  }
  // Build modal
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  overlay.style.zIndex = 250;
  overlay.innerHTML = `
    <div class="sheet" style="max-width:480px;border-radius:20px">
      <div class="sheet-drag"></div>
      <div class="sheet-header">
        <div class="sheet-title" style="font-size:18px"><em>Mark as</em> Recurring</div>
        <button class="sheet-close" id="recModalClose">✕</button>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">${esc(name)}</div>
        <div style="font-size:11px;color:var(--m2)">${fmtAmt(t.amount)} · ${esc(t.category)}</div>
      </div>
      <div class="field">
        <label class="field-label">Frequency</label>
        <select class="rec-freq-sel" id="recModalFreq" style="width:100%;padding:10px 12px;font-size:13px">
          <option value="daily">Every day</option>
          <option value="weekly">Weekly — pick days</option>
          <option value="monthly" selected>Monthly — pick date</option>
          <option value="interval">Every N days</option>
        </select>
      </div>
      <div class="field" id="recModalDowWrap" style="display:none">
        <label class="field-label">Which days?</label>
        <div class="rec-dow-row" id="recModalDow">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => `<button class="rec-dow-btn" data-dow="${i}">${d}</button>`).join('')}
        </div>
      </div>
      <div class="field" id="recModalDateWrap">
        <label class="field-label">Day of month</label>
        <input class="txt-input" id="recModalDate" type="number" min="1" max="28" value="1" placeholder="e.g. 1 for 1st of every month">
      </div>
      <div class="field" id="recModalNWrap" style="display:none">
        <label class="field-label">Every how many days?</label>
        <input class="txt-input" id="recModalN" type="number" min="1" max="365" value="30">
      </div>
      <div class="btn-row">
        <button class="btn btn-cancel" id="recModalCancel">Cancel</button>
        <button class="btn btn-go" id="recModalSave">Add to Recurring</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const freqSel = overlay.querySelector('#recModalFreq');
  const dowWrap = overlay.querySelector('#recModalDowWrap');
  const dateWrap = overlay.querySelector('#recModalDateWrap');
  const nWrap = overlay.querySelector('#recModalNWrap');
  const close = () => { overlay.classList.remove('on'); setTimeout(() => overlay.remove(), 300); };

  freqSel.onchange = () => {
    dowWrap.style.display  = freqSel.value === 'weekly'   ? '' : 'none';
    dateWrap.style.display = freqSel.value === 'monthly'  ? '' : 'none';
    nWrap.style.display    = freqSel.value === 'interval' ? '' : 'none';
  };
  overlay.querySelectorAll('.rec-dow-btn').forEach(btn => {
    btn.onclick = () => btn.classList.toggle('on');
  });
  overlay.querySelector('#recModalClose').onclick = close;
  overlay.querySelector('#recModalCancel').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#recModalSave').onclick = () => {
    const freq = freqSel.value;
    const entry = { id: genId(), name, amount: t.amount, category: t.category, payment: t.payment, freq, lastLogged: t.date };
    if (freq === 'weekly') {
      entry.freqDays = [...overlay.querySelectorAll('.rec-dow-btn.on')].map(b => parseInt(b.dataset.dow));
      if (!entry.freqDays.length) { toast('Pick at least one day', 'err'); return; }
    }
    if (freq === 'monthly') entry.freqDate = parseInt(overlay.querySelector('#recModalDate').value) || 1;
    if (freq === 'interval') entry.freqN = parseInt(overlay.querySelector('#recModalN').value) || 30;
    recurringList.push(entry);
    saveSettings(); pushSettings();
    close(); render(); renderRecurringBanner();
    toast('Added to recurring: ' + name, 'ok');
  };
}

function settle(id, delta) {
  const t = txns.find(x => x.id === id); if (!t) return;
  t.paidCount = Math.max(0, Math.min(t.split-1, (t.paidCount||0)+delta));
  save(); render(); if (sheetUrl) syncTxn('update', t);
}
function settleAll(id) {
  const t = txns.find(x => x.id === id); if (!t) return;
  t.paidCount = t.split - 1; save(); render(); if (sheetUrl) syncTxn('update', t);
}
function deleteTxn(id) {
  const idx = txns.findIndex(x => x.id === id);
  if (idx === -1) return;
  const t = txns[idx];
  txns.splice(idx, 1);
  save(); render();
  // Undo toast — restore within 5 seconds
  const el = document.getElementById('toast');
  el.innerHTML = 'Deleted · <span style="text-decoration:underline;cursor:pointer" id="undoDelBtn">Undo</span>';
  el.className = 'toast on';
  clearTimeout(el._t);
  const doDelete = () => { if (sheetUrl) syncTxn('delete', t); };
  let undone = false;
  document.getElementById('undoDelBtn').onclick = () => {
    undone = true; txns.splice(idx, 0, t); save(); render();
    el.textContent = 'Restored'; el.className = 'toast on ok';
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1800);
  };
  el._t = setTimeout(() => { el.classList.remove('on'); if (!undone) doDelete(); }, 5000);
}

// ── ADD / EDIT SHEET ───────────────────────────────────────
function buildCatGrid() {
  const g = document.getElementById('catGrid');
  g.innerHTML = CATS.map(c => '<div class="chip" data-cat="' + c.k + '"><span class="chip-ico">' + c.i + '</span><span class="chip-lbl">' + c.k + '</span></div>').join('');
  g.querySelectorAll('.chip').forEach(ch => { ch.onclick = () => { g.querySelectorAll('.chip').forEach(x=>x.classList.remove('on')); ch.classList.add('on'); checkCatBudgetWarning(ch.dataset.cat); }; });
}
function buildPayGrid() {
  const g = document.getElementById('payGrid');
  g.innerHTML = PAYS.map(p => '<div class="chip" data-pay="' + p.k + '"><span class="chip-ico">' + p.i + '</span><span class="chip-lbl">' + p.k + '</span></div>').join('');
  g.querySelectorAll('.chip').forEach(ch => { ch.onclick = () => { g.querySelectorAll('.chip').forEach(x=>x.classList.remove('on')); ch.classList.add('on'); }; });
}
function selectChip(grid, val) {
  document.querySelectorAll('#' + grid + ' .chip').forEach(ch => { ch.classList.toggle('on', ch.dataset.cat === val || ch.dataset.pay === val); });
}
function getChip(grid) { const ch = document.querySelector('#' + grid + ' .chip.on'); return ch ? (ch.dataset.cat || ch.dataset.pay) : null; }

function checkCatBudgetWarning(cat) {
  const lim = catBudgets[cat]; if (!lim) return;
  const curMon = currentMonthKey();
  const spent = txns.filter(t => t.category === cat && monthKey(t.date) === curMon).reduce((s,t)=>s+t.amount,0);
  const pct = Math.round(spent/lim*100);
  const hint = document.getElementById('catHint');
  if (pct >= 80) { hint.textContent = '⚠️ '+cat+' budget '+pct+'% used ('+fmtAmt(spent)+' of '+fmtAmt(lim)+')'; hint.className = 'cat-hint on warn'; }
}

function setMorePanel(open) {
  const panel = document.getElementById('morePanel');
  const toggle = document.getElementById('moreToggle');
  const lbl = document.getElementById('moreToggleLbl');
  if (!panel || !toggle) return;
  panel.hidden = !open;
  toggle.classList.toggle('open', open);
  if (lbl) lbl.textContent = open ? 'Hide options' : 'More options';
}
function openAdd() {
  editId = null;
  document.getElementById('addTitle').innerHTML = '<em>Add</em> Expense';
  document.getElementById('inAmt').value = '';
  document.getElementById('inNote').value = '';
  document.getElementById('inDate').value = today();
  document.getElementById('inTime').value = nowTime();
  document.getElementById('catHint').className = 'cat-hint';
  document.getElementById('inTags').value = '';
  document.getElementById('inLocation').value = '';
  const recToggle = document.getElementById('recurringToggle');
  if (recToggle) { recToggle.classList.remove('on'); recToggle.setAttribute('aria-checked','false'); }
  selectedCurrency = 'INR'; updateCurrencySymbol();
  splitN = 1; updateSplit();
  setMorePanel(false);
  selectChip('catGrid', 'Food'); selectChip('payGrid', 'UPI');
  document.getElementById('addOverlay').classList.add('on');
  setTimeout(() => document.getElementById('inAmt').focus(), 100);
}
function openEdit(id) {
  const t = txns.find(x => x.id === id); if (!t) return;
  editId = id;
  document.getElementById('addTitle').innerHTML = '<em>Edit</em> Expense';
  document.getElementById('inAmt').value = t.originalAmount || t.amount;
  document.getElementById('inNote').value = t.note || '';
  document.getElementById('inDate').value = t.date;
  document.getElementById('inTime').value = t.time || nowTime();
  document.getElementById('catHint').className = 'cat-hint';
  document.getElementById('inTags').value = (t.tags||[]).join(' ');
  document.getElementById('inLocation').value = t.location || '';
  const recToggle = document.getElementById('recurringToggle');
  if (recToggle) {
    recToggle.classList.toggle('on', !!t.recurring);
    recToggle.setAttribute('aria-checked', t.recurring ? 'true' : 'false');
  }
  selectedCurrency = t.originalCurrency || 'INR'; updateCurrencySymbol();
  splitN = t.split || 1; updateSplit();
  selectChip('catGrid', t.category); selectChip('payGrid', t.payment);
  const needsMore = !!(t.tags && t.tags.length) || !!t.location || (t.split||1) > 1 || !!t.recurring || (t.date !== today());
  setMorePanel(needsMore);
  document.getElementById('addOverlay').classList.add('on');
}
function closeAdd() { document.getElementById('addOverlay').classList.remove('on'); editId = null; }

function updateCurrencySymbol() {
  const cs = CURRENCIES.find(c=>c.k===selectedCurrency) || CURRENCIES[0];
  document.getElementById('amtSymbol').textContent = cs.s;
  const sel = document.getElementById('currencySelect');
  if (sel) sel.value = selectedCurrency;
}

function updateSplit() {
  document.getElementById('splitCount').textContent = splitN;
  document.getElementById('splitVal').textContent = splitN;
  const amt = parseFloat(document.getElementById('inAmt').value) || 0;
  document.getElementById('splitShare').textContent = fmtAmt(amt / splitN);
}

async function saveExpense() {
  const rawAmt = parseFloat(document.getElementById('inAmt').value);
  if (!rawAmt || rawAmt <= 0) { toast('Enter a valid amount', 'err'); return; }
  const cat = getChip('catGrid') || 'Others';
  const pay = getChip('payGrid') || 'UPI';
  const note = document.getElementById('inNote').value.trim();
  const date = document.getElementById('inDate').value || today();
  const time = document.getElementById('inTime').value || nowTime();
  const tagsInput = document.getElementById('inTags').value.trim();
  const location = document.getElementById('inLocation').value.trim();
  const recToggle = document.getElementById('recurringToggle');
  const isRecurring = recToggle ? recToggle.classList.contains('on') : false;

  // Merge tags from tags field + note
  const manualTags = parseTags(tagsInput.startsWith('#') ? tagsInput : tagsInput.split(/\s+/).filter(Boolean).map(t=>t.startsWith('#')?t:'#'+t).join(' '));
  const noteTags = parseTags(note);
  const allTags = [...new Set([...manualTags, ...noteTags])];

  // Currency conversion
  let finalAmt = rawAmt; let originalCurrency = selectedCurrency; let originalAmount = rawAmt;
  if (selectedCurrency !== 'INR') {
    try {
      const rate = await getFxRate(selectedCurrency, 'INR');
      finalAmt = Math.round(rawAmt * rate * 100) / 100;
      toast('Converted: ' + CURRENCIES.find(c=>c.k===selectedCurrency).s + rawAmt + ' → ' + fmtAmt(finalAmt), 'info');
    } catch(e) { toast('FX fetch failed, saving in INR', 'err'); finalAmt = rawAmt; originalCurrency = 'INR'; }
  } else { originalCurrency = 'INR'; originalAmount = rawAmt; }

  if (editId) {
    const t = txns.find(x => x.id === editId);
    if (t) {
      const oldKey = t.date + '|' + t.time + '|' + Math.round(t.amount) + '|' + t.category;
      Object.assign(t, {amount:finalAmt, originalAmount, originalCurrency, category:cat, payment:pay, note, date, time, split:splitN, tags:allTags, location, recurring:isRecurring});
      if (sheetUrl) syncTxn('update', t, oldKey);
    }
    toast('Updated', 'ok');
  } else {
    const t = {id:genId(), amount:finalAmt, originalAmount, originalCurrency, category:cat, payment:pay, note, date, time, split:splitN, paidCount:0, tags:allTags, location, recurring:isRecurring, pending:!!sheetUrl};
    txns.unshift(t); toast('Saved', 'ok');
    if (sheetUrl) {
      bumpPending(1);
      syncTxn('append', t).then(ok => { if (ok) { t.pending = false; bumpPending(-1); save(); render(); } });
    }
    // Add to recurring list if toggled, and update lastLogged if it exists
    if (isRecurring && note) {
      const existing = recurringList.find(r => r.name.toLowerCase() === note.toLowerCase());
      if (existing) {
        existing.lastLogged = date;
      } else {
        recurringList.push({id:genId(), name:note, amount:finalAmt, category:cat, payment:pay, freq:'monthly', freqDate:1, lastLogged:date});
      }
      saveSettings(); pushSettings();
    }
  }
  save(); closeAdd(); render(); renderRecurringBanner();
}

// ── FX RATES ───────────────────────────────────────────────
async function getFxRate(from, to) {
  const key = from + '_' + to;
  // Check in-memory first, then localStorage cache
  if (fxRates[key] && fxRates[key].ts > Date.now() - 3600000) return fxRates[key].rate;
  try {
    const cached = JSON.parse(localStorage.getItem('vyaya_fx') || '{}');
    if (cached[key] && cached[key].ts > Date.now() - 3600000) {
      fxRates[key] = cached[key];
      return cached[key].rate;
    }
  } catch(e) {}
  const res = await fetch('https://api.frankfurter.app/latest?from=' + from + '&to=' + to);
  const data = await res.json();
  const rate = data.rates[to];
  fxRates[key] = {rate, ts: Date.now()};
  try {
    const cached = JSON.parse(localStorage.getItem('vyaya_fx') || '{}');
    cached[key] = {rate, ts: Date.now()};
    localStorage.setItem('vyaya_fx', JSON.stringify(cached));
  } catch(e) {}
  return rate;
}

// ── LOCATION ───────────────────────────────────────────────
async function detectLocation() {
  const btn = document.getElementById('locationBtn');
  if (!navigator.geolocation) { toast('Geolocation not supported', 'err'); return; }
  btn.textContent = '⏳'; btn.disabled = true;
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const {latitude: lat, longitude: lon} = pos.coords;
      const res = await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lon+'&format=json');
      const data = await res.json();
      const area = data.address.suburb || data.address.neighbourhood || data.address.city_district || data.address.city || '';
      document.getElementById('inLocation').value = area;
      btn.textContent = '📍'; btn.disabled = false;
      toast('Location: ' + area, 'ok');
    } catch(e) { btn.textContent = '📍'; btn.disabled = false; toast('Location failed', 'err'); }
  }, () => { btn.textContent = '📍'; btn.disabled = false; toast('Location denied', 'err'); });
}

// ── ANALYTICS ─────────────────────────────────────────────
function renderAnalytics() {
  if (!analyticsMonth) analyticsMonth = currentMonthKey();
  document.getElementById('mnLbl').textContent = monthLabel(analyticsMonth);
  document.getElementById('mnPrev').disabled = false;
  document.getElementById('mnNext').disabled = analyticsMonth >= currentMonthKey();
  const list = txns.filter(t => monthKey(t.date) === analyticsMonth);
  const total = list.reduce((s,t) => s+t.amount, 0);
  const el = document.getElementById('analyticsContent');
  if (analyticsTab === 'overview') { el.innerHTML = renderOverview(list, total); attachDonutEvents(); }
  else if (analyticsTab === 'categories') { el.innerHTML = renderCategories(list, total); attachCategoryEvents(); }
  else if (analyticsTab === 'trends') { el.innerHTML = renderTrends(); attachTrendEvents(); }
  else if (analyticsTab === 'year') { el.innerHTML = renderYearInReview(); }
}

function renderOverview(list, total) {
  const spendList = list.filter(t => isSpendCat(t.category));
  total = spendList.reduce((s,t) => s + t.amount, 0);
  const catTotals = {};
  spendList.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const sorted = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  const r = 52, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let offset = 0; let slicesHtml = '';
  sorted.forEach((e, i) => {
    const pct = total > 0 ? e[1]/total : 0; const dash = pct * circ;
    slicesHtml += '<circle class="donut-slice" data-cat="' + e[0] + '" data-idx="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"' +
      ' stroke="' + COLORS[i%COLORS.length] + '" stroke-width="14"' +
      ' stroke-dasharray="' + dash + ' ' + (circ-dash) + '"' +
      ' stroke-dashoffset="' + (-offset) + '"' +
      ' transform="rotate(-90 ' + cx + ' ' + cy + ')" opacity="0.9"' +
      ' style="cursor:pointer;transition:opacity .2s,stroke-width .2s"/>'; offset += dash;
  });
  let legendHtml = '';
  sorted.forEach((e, i) => {
    const ci = catInfo(e[0]);
    legendHtml += '<div class="dl-item" data-cat="' + e[0] + '" data-idx="' + i + '" title="Tap to see ' + e[0] + ' transactions">' +
      '<div class="dl-dot" style="background:' + COLORS[i%COLORS.length] + '"></div>' +
      '<span class="dl-name">' + ci.i + ' ' + e[0] + '</span>' +
      '<span class="dl-val">' + fmtAmt(e[1]) + '</span></div>';
  });
  let budgetHtml = '';
  if (budget > 0) {
    const pct = Math.min(100, Math.round(total/budget*100));
    const col = pct >= 90 ? 'var(--re)' : pct >= 70 ? 'var(--or)' : 'var(--gold)';
    budgetHtml = '<div class="budget-card"><div class="bc-lbl">Monthly Budget</div>' +
      '<div class="bc-row"><span class="bc-spent">' + fmtAmt(total) + '</span><span class="bc-of">of ' + fmtAmt(budget) + '</span></div>' +
      '<div class="bc-bar"><div class="bc-fill" style="width:' + pct + '%;background:' + col + '"></div></div>' +
      '<div class="bc-hint">' + pct + '% used · ' + fmtAmt(budget-total) + ' remaining</div></div>';
  }
  // Pending splits — collapsed accordion
  const splitTxns = txns.filter(t => t.split > 1 && t.paidCount < t.split - 1);
  let splitsHtml = '';
  if (splitTxns.length > 0) {
    const owedTotal = splitTxns.reduce((s,t) => s + (t.amount/t.split)*(t.split-1-t.paidCount), 0);
    let rowsHtml = '';
    splitTxns.forEach(t => {
      const ci = catInfo(t.category); const share = t.amount/t.split; const rem = t.split-1-t.paidCount;
      rowsHtml += '<div class="split-pending-row"><span class="split-pending-ico">' + ci.i + '</span>' +
        '<div class="split-pending-body"><div class="split-pending-name">' + (t.note||t.category) + '</div>' +
        '<div class="split-pending-sub">' + fmtDate(t.date) + ' · ' + rem + ' person' + (rem>1?'s':'') + ' owe you</div></div>' +
        '<div class="split-pending-amt">' + fmtAmt(share*rem) + '</div></div>';
    });
    splitsHtml = '<div class="splits-pending-card" id="splitsPendingCard">' +
      '<div class="sp-header sp-toggle" id="spToggle">' +
      '<div><span class="sp-title">💜 Pending Splits</span><span class="sp-count">' + splitTxns.length + ' items</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span class="sp-total">' + fmtAmt(owedTotal) + ' owed</span><span class="sp-chevron" id="spChevron">' + (splitsExpanded?'▲':'▼') + '</span></div>' +
      '</div>' +
      '<div class="sp-rows" id="spRows" style="display:' + (splitsExpanded?'flex':'none') + '">' + rowsHtml + '</div></div>';
  }
  const donutHtml = '<div class="donut-card" id="donutCard">' +
    '<div class="dc-lbl">Spending Breakdown · ' + monthLabel(analyticsMonth) + '</div>' +
    '<div class="donut-body">' +
    '<svg class="donut-svg" id="donutSvg" width="120" height="120" viewBox="0 0 120 120">' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--s2)" stroke-width="14"/>' +
    slicesHtml +
    '<text x="' + cx + '" y="' + (cy+6) + '" text-anchor="middle" fill="var(--tx)" font-size="13" font-weight="700" font-family="Syne,sans-serif">' + fmtAmt(total) + '</text>' +
    '</svg>' +
    '<div class="donut-legend">' + legendHtml + '</div>' +
    '</div></div>';

  return budgetHtml + donutHtml + splitsHtml;
}

function attachDonutEvents() {
  const drillCat = (cat) => {
    drillFilter = {type:'category', value:cat, month:analyticsMonth};
    showView('Home');
    document.getElementById('txTitle').textContent = cat + ' · ' + monthLabel(analyticsMonth);
    render();
  };
  document.querySelectorAll('.donut-slice').forEach(sl => {
    sl.addEventListener('click', () => drillCat(sl.dataset.cat));
    sl.addEventListener('mouseenter', () => { sl.setAttribute('stroke-width','18'); sl.setAttribute('opacity','1'); });
    sl.addEventListener('mouseleave', () => { sl.setAttribute('stroke-width','14'); sl.setAttribute('opacity','0.9'); });
  });
  document.querySelectorAll('.dl-item[data-cat]').forEach(item => {
    item.addEventListener('click', () => drillCat(item.dataset.cat));
  });
  const spToggle = document.getElementById('spToggle');
  if (spToggle) {
    spToggle.onclick = () => {
      splitsExpanded = !splitsExpanded;
      const rows = document.getElementById('spRows');
      const chev = document.getElementById('spChevron');
      if (rows) rows.style.display = splitsExpanded ? 'flex' : 'none';
      if (chev) chev.textContent = splitsExpanded ? '▲' : '▼';
    };
  }
}

function renderCategories(list, total) {
  const catTotals = {};
  list.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const sorted = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  if (!sorted.length) return '<div class="empty"><div class="empty-ico">📊</div><div class="empty-txt">No data for this month</div></div>';
  let html = '';
  sorted.forEach((e, i) => {
    const ci = catInfo(e[0]); const pct = total > 0 ? Math.round(e[1]/total*100) : 0;
    const lim = catBudgets[e[0]]; const budPct = lim ? Math.min(100, Math.round(e[1]/lim*100)) : null;
    const budCol = budPct >= 90 ? 'var(--re)' : budPct >= 70 ? 'var(--or)' : 'var(--gold)';
    html += '<div class="brow" data-cat="' + e[0] + '" style="cursor:pointer">' +
      '<div class="brow-ico" style="background:' + ci.c + '22">' + ci.i + '</div>' +
      '<div class="brow-body">' +
      '<div class="brow-top"><span class="brow-name">' + e[0] + '</span>' +
      (lim ? '<span style="font-size:9px;color:' + budCol + ';font-weight:600">' + budPct + '% of budget</span>' : '') +
      '</div>' +
      '<div class="brow-bar"><div class="brow-fill" style="width:' + pct + '%;background:' + COLORS[i%COLORS.length] + '"></div></div>' +
      (lim ? '<div class="brow-bar" style="margin-top:3px;background:rgba(255,255,255,.05)"><div class="brow-fill" style="width:' + budPct + '%;background:' + budCol + ';opacity:.5"></div></div>' : '') +
      '</div>' +
      '<div class="brow-r"><div class="brow-amt">' + fmtAmt(e[1]) + '</div><div class="brow-pct">' + pct + '%</div></div>' +
      '</div>';
  });
  return html;
}

function attachCategoryEvents() {
  document.querySelectorAll('.brow[data-cat]').forEach(row => {
    row.onclick = () => {
      drillFilter = {type:'category', value:row.dataset.cat, month:analyticsMonth};
      showView('Home');
      document.getElementById('txTitle').textContent = row.dataset.cat + ' · ' + monthLabel(analyticsMonth);
      render();
    };
  });
}

function renderTrends() {
  const months = [];
  let mk = currentMonthKey();
  for (let i = 0; i < 6; i++) { months.unshift(mk); mk = prevMonthKey(mk); }
  const data = months.map(m => ({
    month: m, label: monthLabel(m),
    total: txns.filter(t => monthKey(t.date) === m).reduce((s,t)=>s+t.amount,0)
  }));
  const maxVal = Math.max(...data.map(d=>d.total), 1);
  let barsHtml = '';
  data.forEach(d => {
    const h = Math.round((d.total/maxVal)*80);
    const isCur = d.month === currentMonthKey();
    barsHtml += '<div class="trend-col" data-month="' + d.month + '">' +
      '<div class="trend-bar-wrap"><div class="trend-bar" style="height:' + h + 'px;background:' + (isCur?'var(--gold)':'var(--s2)') + ';border:1px solid ' + (isCur?'var(--gold)':'var(--b2)') + '"></div></div>' +
      '<div class="trend-lbl">' + d.label.split(' ')[0] + '</div>' +
      '<div class="trend-amt">' + (d.total > 0 ? fmtAmt(d.total) : '—') + '</div>' +
      '</div>';
  });
  // Day-of-week breakdown
  const curList = txns.filter(t => monthKey(t.date) === analyticsMonth);
  const dowTotals = [0,0,0,0,0,0,0];
  curList.forEach(t => { const d = new Date(t.date+'T00:00:00'); dowTotals[d.getDay()] += t.amount; });
  const dowMax = Math.max(...dowTotals, 1);
  const dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let dowHtml = '';
  dowTotals.forEach((v, i) => {
    const h = Math.round((v/dowMax)*60);
    dowHtml += '<div class="trend-col" data-dow="' + i + '" data-month="' + analyticsMonth + '">' +
      '<div class="trend-bar-wrap" style="height:60px"><div class="trend-bar" style="height:' + h + 'px;background:var(--pu);opacity:0.7"></div></div>' +
      '<div class="trend-lbl">' + dowNames[i] + '</div>' +
      '<div class="trend-amt">' + (v > 0 ? fmtAmt(v) : '—') + '</div>' +
      '</div>';
  });
  // Payment split
  const upiTotal = curList.filter(t=>t.payment==='UPI').reduce((s,t)=>s+t.amount,0);
  const ccTotal = curList.filter(t=>t.payment==='Credit Card').reduce((s,t)=>s+t.amount,0);
  const payTotal = upiTotal + ccTotal;
  const upiPct = payTotal > 0 ? Math.round(upiTotal/payTotal*100) : 0;
  const ccPct = 100 - upiPct;
  const payHtml = '<div class="pay-split-card">' +
    '<div class="dc-lbl">Payment Mode</div>' +
    '<div class="pay-split-row">' +
    '<div class="pay-split-item" data-pay="UPI" data-month="' + analyticsMonth + '" style="cursor:pointer">' +
    '<div class="pay-split-bar" style="background:var(--bl);width:' + upiPct + '%"></div>' +
    '<div class="pay-split-lbl">📲 UPI <span>' + upiPct + '%</span></div>' +
    '<div class="pay-split-amt">' + fmtAmt(upiTotal) + '</div></div>' +
    '<div class="pay-split-item" data-pay="Credit Card" data-month="' + analyticsMonth + '" style="cursor:pointer">' +
    '<div class="pay-split-bar" style="background:var(--pu);width:' + ccPct + '%"></div>' +
    '<div class="pay-split-lbl">💳 CC <span>' + ccPct + '%</span></div>' +
    '<div class="pay-split-amt">' + fmtAmt(ccTotal) + '</div></div>' +
    '</div></div>';
  return '<div class="trend-section"><div class="dc-lbl">6-Month Trend</div><div class="trend-bars">' + barsHtml + '</div></div>' +
    '<div class="trend-section"><div class="dc-lbl">Day of Week · ' + monthLabel(analyticsMonth) + '</div><div class="trend-bars">' + dowHtml + '</div></div>' +
    payHtml;
}

function attachTrendEvents() {
  document.querySelectorAll('.trend-col[data-month]').forEach(col => {
    col.style.cursor = 'pointer';
    col.onclick = () => {
      if (col.dataset.dow !== undefined) {
        drillFilter = {type:'dow', value:parseInt(col.dataset.dow), month:col.dataset.month};
        const dowNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        showView('Home'); document.getElementById('txTitle').textContent = dowNames[parseInt(col.dataset.dow)] + ' · ' + monthLabel(col.dataset.month); render();
      } else {
        analyticsMonth = col.dataset.month; renderAnalytics();
      }
    };
  });
  document.querySelectorAll('.pay-split-item[data-pay]').forEach(item => {
    item.onclick = () => {
      drillFilter = {type:'payment', value:item.dataset.pay, month:item.dataset.month};
      showView('Home'); document.getElementById('txTitle').textContent = item.dataset.pay + ' · ' + monthLabel(item.dataset.month); render();
    };
  });
}

function renderYearInReview() {
  const yr = new Date().getFullYear().toString();
  const yearTxns = txns.filter(t => t.date.startsWith(yr));
  if (yearTxns.length < 5) return '<div class="empty"><div class="empty-ico">📊</div><div class="empty-txt">Not enough data yet.<br>Keep logging expenses!</div></div>';
  const total = yearTxns.reduce((s,t)=>s+t.amount,0);
  const avgMonthly = total / 12;
  const catTotals = {};
  yearTxns.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const biggest = yearTxns.reduce((m,t) => t.amount > m.amount ? t : m, yearTxns[0]);
  const monthTotals = {};
  yearTxns.forEach(t => { const mk = monthKey(t.date); monthTotals[mk] = (monthTotals[mk]||0) + t.amount; });
  const sortedMonths = Object.entries(monthTotals).sort((a,b)=>b[1]-a[1]);
  const biggestMonth = sortedMonths[0];
  const quietestMonth = sortedMonths[sortedMonths.length-1];
  const maxMonthAmt = biggestMonth ? biggestMonth[1] : 1;
  let monthBarsHtml = '';
  for (let m = 1; m <= 12; m++) {
    const mk = yr + '-' + String(m).padStart(2,'0');
    const amt = monthTotals[mk] || 0;
    const h = Math.round((amt/maxMonthAmt)*70);
    const isBig = biggestMonth && mk === biggestMonth[0];
    const mNames = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    monthBarsHtml += '<div class="trend-col"><div class="trend-bar-wrap" style="height:70px"><div class="trend-bar" style="height:' + h + 'px;background:' + (isBig?'var(--gold)':'var(--pu)') + ';opacity:' + (amt?'0.85':'0.2') + '"></div></div>' +
      '<div class="trend-lbl">' + mNames[m-1] + '</div></div>';
  }
  const ci = topCat ? catInfo(topCat[0]) : null;
  return '<div class="year-review">' +
    '<div class="yr-title">' + yr + ' Year in Review</div>' +
    '<div class="yr-stats">' +
    '<div class="yr-stat"><div class="yr-stat-val">' + fmtAmt(total) + '</div><div class="yr-stat-lbl">Total Spent</div></div>' +
    '<div class="yr-stat"><div class="yr-stat-val">' + fmtAmt(avgMonthly) + '</div><div class="yr-stat-lbl">Avg / Month</div></div>' +
    '<div class="yr-stat"><div class="yr-stat-val">' + yearTxns.length + '</div><div class="yr-stat-lbl">Transactions</div></div>' +
    '</div>' +
    '<div class="yr-highlights">' +
    (topCat ? '<div class="yr-hl"><span class="yr-hl-ico">' + ci.i + '</span><div><div class="yr-hl-title">Top Category</div><div class="yr-hl-val">' + topCat[0] + ' · ' + fmtAmt(topCat[1]) + '</div></div></div>' : '') +
    (biggestMonth ? '<div class="yr-hl"><span class="yr-hl-ico">📅</span><div><div class="yr-hl-title">Biggest Month</div><div class="yr-hl-val">' + monthLabel(biggestMonth[0]) + ' · ' + fmtAmt(biggestMonth[1]) + '</div></div></div>' : '') +
    (quietestMonth && quietestMonth[0] !== biggestMonth[0] ? '<div class="yr-hl"><span class="yr-hl-ico">🌿</span><div><div class="yr-hl-title">Quietest Month</div><div class="yr-hl-val">' + monthLabel(quietestMonth[0]) + ' · ' + fmtAmt(quietestMonth[1]) + '</div></div></div>' : '') +
    (biggest ? '<div class="yr-hl"><span class="yr-hl-ico">💸</span><div><div class="yr-hl-title">Biggest Expense</div><div class="yr-hl-val">' + esc(biggest.note||biggest.category) + ' · ' + fmtAmt(biggest.amount) + '</div></div></div>' : '') +
    '</div>' +
    '<div class="trend-section"><div class="dc-lbl">Monthly Breakdown</div><div class="trend-bars">' + monthBarsHtml + '</div></div>' +
    '</div>';
}

// ── SETTINGS ───────────────────────────────────────────────
function renderSettings() {
  document.getElementById('urlInput').value = sheetUrl;
  document.getElementById('budgetInput').value = budget || '';
  renderCatBudgets();
  renderRecurringSettings();
  renderGoalsSettings();
}

function renderCatBudgets() {
  const el = document.getElementById('catBudgetsList');
  if (!el) return;
  el.innerHTML = CATS.map(c => {
    const val = catBudgets[c.k] || '';
    return '<div class="cat-budget-row">' +
      '<span class="cat-budget-ico">' + c.i + '</span>' +
      '<span class="cat-budget-name">' + c.k + '</span>' +
      '<input class="cat-budget-input" type="number" placeholder="No limit" value="' + val + '" data-cat="' + c.k + '" min="0">' +
      '</div>';
  }).join('');
  el.querySelectorAll('.cat-budget-input').forEach(inp => {
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (v > 0) catBudgets[inp.dataset.cat] = v;
      else delete catBudgets[inp.dataset.cat];
      saveSettings(); pushSettings(); toast('Budget saved', 'ok');
    };
  });
}

function renderRecurringSettings() {
  const el = document.getElementById('recurringList');
  if (!el) return;
  if (!recurringList.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--m2);padding:8px 0">No recurring expenses yet. Toggle "Recurring" when adding an expense.</div>';
    return;
  }
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  el.innerHTML = recurringList.map(r => {
    const freq = r.freq || 'monthly';
    return '<div class="rec-row" data-rid="' + r.id + '">' +
      '<span class="rec-ico">' + catInfo(r.category||'Bills').i + '</span>' +
      '<div class="rec-body">' +
        '<div class="rec-name">' + r.name + '</div>' +
        '<div class="rec-sub">' + fmtAmt(r.amount) + ' · ' + (r.category||'Bills') + '</div>' +
        '<div class="rec-freq-row">' +
          '<select class="rec-freq-sel" data-rid="' + r.id + '">' +
            '<option value="daily"' + (freq==='daily'?' selected':'') + '>Every day</option>' +
            '<option value="weekly"' + (freq==='weekly'?' selected':'') + '>Weekly</option>' +
            '<option value="monthly"' + (freq==='monthly'?' selected':'') + '>Monthly</option>' +
            '<option value="interval"' + (freq==='interval'?' selected':'') + '>Every N days</option>' +
          '</select>' +
          // Weekly day picker
          (freq==='weekly' ? '<div class="rec-dow-row">' + DOW.map((d,i) =>
            '<button class="rec-dow-btn' + ((r.freqDays||[]).includes(i)?' on':'') + '" data-rid="' + r.id + '" data-dow="' + i + '">' + d + '</button>'
          ).join('') + '</div>' : '') +
          // Monthly date picker
          (freq==='monthly' ? '<input class="rec-freq-n" type="number" min="1" max="28" value="' + (r.freqDate||1) + '" data-rid="' + r.id + '" data-field="freqDate" placeholder="Day of month" style="width:90px">' : '') +
          // Interval N picker
          (freq==='interval' ? '<input class="rec-freq-n" type="number" min="1" max="365" value="' + (r.freqN||30) + '" data-rid="' + r.id + '" data-field="freqN" placeholder="Days" style="width:70px"><span style="font-size:10px;color:var(--m2);margin-left:4px">days</span>' : '') +
        '</div>' +
      '</div>' +
      '<button class="rec-del" data-rid="' + r.id + '">✕</button>' +
    '</div>';
  }).join('');

  // Freq select change
  el.querySelectorAll('.rec-freq-sel').forEach(sel => {
    sel.onchange = () => {
      const r = recurringList.find(x => x.id === sel.dataset.rid);
      if (r) { r.freq = sel.value; saveSettings(); pushSettings(); renderRecurringSettings(); }
    };
  });
  // DOW buttons
  el.querySelectorAll('.rec-dow-btn').forEach(btn => {
    btn.onclick = () => {
      const r = recurringList.find(x => x.id === btn.dataset.rid);
      if (!r) return;
      if (!r.freqDays) r.freqDays = [];
      const d = parseInt(btn.dataset.dow);
      if (r.freqDays.includes(d)) r.freqDays = r.freqDays.filter(x => x !== d);
      else r.freqDays.push(d);
      saveSettings(); pushSettings(); renderRecurringSettings();
    };
  });
  // N inputs (freqDate / freqN)
  el.querySelectorAll('.rec-freq-n').forEach(inp => {
    inp.onchange = () => {
      const r = recurringList.find(x => x.id === inp.dataset.rid);
      if (r) { r[inp.dataset.field] = parseInt(inp.value) || (inp.dataset.field === 'freqDate' ? 1 : 30); saveSettings(); pushSettings(); }
    };
  });
  // Delete
  el.querySelectorAll('.rec-del').forEach(b => {
    b.onclick = () => { recurringList = recurringList.filter(r => r.id !== b.dataset.rid); saveSettings(); pushSettings(); renderRecurringSettings(); toast('Removed', 'ok'); };
  });
}

function renderGoalsSettings() {
  const el = document.getElementById('goalsList');
  if (!el) return;
  el.innerHTML = goals.map(g => {
    const pct = g.target ? Math.min(100, Math.round((g.saved||0)/g.target*100)) : 0;
    return '<div class="goal-row">' +
      '<div class="goal-info"><div class="goal-name">🎯 ' + g.name + '</div>' +
      '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="goal-sub">' + fmtAmt(g.saved||0) + ' of ' + fmtAmt(g.target) + ' · ' + pct + '%</div></div>' +
      '<div class="goal-actions">' +
      '<button class="goal-add-btn" data-gid="' + g.id + '">+ Add</button>' +
      '<button class="rec-del" data-gid="' + g.id + '">✕</button></div></div>';
  }).join('') +
  '<div class="goal-new-form" id="goalNewForm" style="display:none;margin-top:10px;display:none">' +
    '<input class="txt-input" id="goalNameInput" placeholder="Goal name (e.g. Goa Trip)" style="margin-bottom:8px">' +
    '<input class="txt-input" id="goalTargetInput" type="number" placeholder="Target amount (₹)" style="margin-bottom:8px" min="1">' +
    '<div style="display:flex;gap:8px">' +
      '<button class="save-url-btn" id="goalSaveBtn" style="flex:1;padding:10px">Add Goal</button>' +
      '<button class="btn btn-cancel" id="goalCancelBtn" style="flex:0;padding:10px 14px">Cancel</button>' +
    '</div>' +
  '</div>' +
  '<button class="save-url-btn" id="addGoalBtn" style="margin-top:8px">+ New Goal</button>';

  el.querySelectorAll('.goal-add-btn').forEach(b => {
    b.onclick = () => {
      const amtStr = window.prompt ? prompt('Add to savings (₹):') : null;
      const amt = amtStr !== null ? parseFloat(amtStr) : NaN;
      if (!amt || amt <= 0) return;
      const g = goals.find(x => x.id === b.dataset.gid);
      if (g) { g.saved = (g.saved||0) + amt; saveSettings(); pushSettings(); renderGoalsSettings(); toast('Saved +' + fmtAmt(amt), 'ok'); }
    };
  });
  el.querySelectorAll('.rec-del[data-gid]').forEach(b => {
    b.onclick = () => { goals = goals.filter(g => g.id !== b.dataset.gid); saveSettings(); pushSettings(); renderGoalsSettings(); };
  });

  const addBtn = document.getElementById('addGoalBtn');
  const form = document.getElementById('goalNewForm');
  if (addBtn) addBtn.onclick = () => {
    addBtn.style.display = 'none';
    form.style.display = 'block';
    document.getElementById('goalNameInput').focus();
  };
  const cancelBtn = document.getElementById('goalCancelBtn');
  if (cancelBtn) cancelBtn.onclick = () => { form.style.display = 'none'; addBtn.style.display = 'block'; };
  const saveBtn = document.getElementById('goalSaveBtn');
  if (saveBtn) saveBtn.onclick = () => {
    const name = (document.getElementById('goalNameInput').value || '').trim();
    const target = parseFloat(document.getElementById('goalTargetInput').value);
    if (!name) { toast('Enter a goal name', 'err'); return; }
    if (!target || target <= 0) { toast('Enter a valid target amount', 'err'); return; }
    goals.push({id:genId(), name, target, saved:0});
    saveSettings(); pushSettings(); renderGoalsSettings(); toast('Goal added!', 'ok');
  };
}

// ── END OF DAY MODAL ───────────────────────────────────────
function checkEndOfDay() {
  const h = istHour();
  if (h < 21 || h >= 23) return;
  const todayStr = today();
  if (moodLog[todayStr] !== undefined) return;
  const modal = document.getElementById('eodModal');
  if (!modal) return;
  const todayTxns = txns.filter(t => t.date === todayStr);
  const todayTotal = todayTxns.reduce((s,t)=>s+t.amount,0);
  document.getElementById('eodSummary').textContent = todayTxns.length + ' transactions · ' + fmtAmt(todayTotal);
  modal.classList.add('on');
}

function setMood(rating) {
  moodLog[today()] = rating;
  saveSettings();
  document.getElementById('eodModal').classList.remove('on');
  toast('Mood logged! 🌙', 'ok');
}

// ── SYNC ───────────────────────────────────────────────────
function bumpPending(delta) {
  pendingCount = Math.max(0, (pendingCount || 0) + delta);
  localStorage.setItem('vyaya_pending', String(pendingCount));
  updatePendingPill();
}
function updatePendingPill() {
  const n = txns.filter(t => t.pending).length || pendingCount;
  const pill = document.getElementById('pendingPill');
  if (!pill) return;
  if (n > 0) {
    pill.hidden = false;
    pill.textContent = n + ' pending';
  } else {
    pill.hidden = true;
  }
}
function mapRemoteRow(r) {
  return {
    id: r['Id'] || r['ID'] || genId(),
    date: normDate(r['Date']),
    time: r['Time'] || '00:00',
    category: normCat(r['Category'] || 'Others'),
    amount: parseFloat(r['Amount']) || 0,
    payment: r['Mode of Payment'] || 'UPI',
    note: r['Note'] || '',
    split: parseInt(r['Split'] || '1') || 1,
    paidCount: parseInt(r['Paid'] || '0') || 0,
    tags: parseTags(r['Tags'] || r['Note'] || ''),
    location: r['Location'] || '',
    pending: false,
  };
}
function mergeRemoteTxns(remote) {
  const byId = new Map();
  const byFp = new Map();
  txns.forEach(t => {
    if (t.id) byId.set(t.id, t);
    byFp.set(txnFingerprint(t), t);
  });
  const merged = [];
  const matchedLocal = new Set();
  remote.forEach(r => {
    const local = (r.id && byId.get(r.id)) || byFp.get(txnFingerprint(r));
    if (local) {
      matchedLocal.add(local.id);
      merged.push(Object.assign({}, r, {
        id: local.id || r.id,
        originalAmount: local.originalAmount,
        originalCurrency: local.originalCurrency,
        recurring: local.recurring,
        pending: false,
      }));
    } else {
      merged.push(r);
    }
  });
  // Keep local-only (unsynced / pending) rows
  txns.forEach(t => {
    if (matchedLocal.has(t.id)) return;
    const hitRemote = remote.some(r => r.id === t.id || txnFingerprint(r) === txnFingerprint(t));
    if (!hitRemote) merged.push(t);
  });
  merged.sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time));
  return merged;
}
async function syncTxn(action, t, oldKey) {
  if (!sheetUrl) return false;
  const body = {
    action,
    Id: t.id,
    Date: t.date,
    Time: t.time,
    Category: t.category,
    Amount: Math.round(t.amount),
    'Mode of Payment': t.payment,
    Note: t.note || '',
    Split: t.split || 1,
    Paid: t.paidCount || 0,
    Location: t.location || '',
    Tags: (t.tags || []).join(' '),
  };
  if (oldKey) body.oldKey = oldKey;
  try {
    const res = await fetch(sheetUrl, {method:'POST', body:JSON.stringify(body)});
    return !!res.ok;
  } catch(e) { console.warn('Sync failed:', e); return false; }
}

async function pushSettings() {
  if (!sheetUrl) return;
  try {
    await fetch(sheetUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'writeSettings',
        settings: {
          monthly_budget: budget,
          cat_budgets: catBudgets,
          goals: goals,
          recurring: recurringList,
        }
      })
    });
  } catch(e) { console.warn('Settings push failed:', e); }
}

async function autoSync() {
  if (!sheetUrl) return 'no-url';
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  try {
    const [txnRes, settRes] = await Promise.all([
      fetch(sheetUrl + '?action=read', {signal: ctrl.signal}),
      fetch(sheetUrl + '?action=readSettings', {signal: ctrl.signal}),
    ]);
    clearTimeout(timeout);
    const txnData = await txnRes.json();
    if (txnData.error) throw new Error(txnData.error);
    if ((txnData.rows || []).length > 0) {
      const remote = txnData.rows.map(mapRemoteRow).filter(r => r.amount > 0);
      txns = mergeRemoteTxns(remote);
      pendingCount = txns.filter(t => t.pending).length;
      localStorage.setItem('vyaya_pending', String(pendingCount));
      save(); render();
    }
    const settData = await settRes.json();
    if (!settData.error && settData.settings) {
      const s = settData.settings;
      if (s.monthly_budget !== undefined) { budget = parseFloat(s.monthly_budget) || 0; localStorage.setItem('vyaya_budget', budget); }
      if (s.cat_budgets) { catBudgets = s.cat_budgets; localStorage.setItem('vyaya_cat_budgets', JSON.stringify(catBudgets)); }
      if (s.goals) { goals = s.goals; localStorage.setItem('vyaya_goals', JSON.stringify(goals)); }
      if (s.recurring) { recurringList = s.recurring; localStorage.setItem('vyaya_recurring', JSON.stringify(recurringList)); }
      renderSettings(); renderRecurringBanner();
    }
    updateSyncDot('ok');
    return 'ok';
  } catch(e) {
    clearTimeout(timeout);
    updateSyncDot('err');
    return 'err';
  }
}

function updateSyncDot(state) {
  document.querySelectorAll('.sync-dot').forEach(d => { d.className = 'sync-dot ' + state; });
  const lbl = document.getElementById('syncLbl');
  const lbl2 = document.getElementById('syncLblSidebar');
  if (state === 'ok') {
    const t = new Date().toLocaleTimeString('en-US', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit'});
    if (lbl) lbl.textContent = 'synced ' + t;
    if (lbl2) lbl2.textContent = 'synced ' + t;
  } else if (state === 'err') {
    if (lbl) lbl.textContent = 'offline';
    if (lbl2) lbl2.textContent = 'offline';
  }
}

async function pullSettings() {
  if (!sheetUrl) return;
  try {
    const res = await fetch(sheetUrl + '?action=readSettings');
    const data = await res.json();
    if (data.error || !data.settings) return;
    const s = data.settings;
    if (s.monthly_budget !== undefined) { budget = parseFloat(s.monthly_budget) || 0; localStorage.setItem('vyaya_budget', budget); }
    if (s.cat_budgets) { catBudgets = s.cat_budgets; localStorage.setItem('vyaya_cat_budgets', JSON.stringify(catBudgets)); }
    if (s.goals) { goals = s.goals; localStorage.setItem('vyaya_goals', JSON.stringify(goals)); }
    if (s.recurring) { recurringList = s.recurring; localStorage.setItem('vyaya_recurring', JSON.stringify(recurringList)); }
    const ts = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const lbl = document.getElementById('settingsSyncLbl');
    if (lbl) lbl.textContent = 'Settings synced ' + ts;
  } catch(e) { console.warn('Settings pull failed:', e); }
}

async function syncAll() {
  if (!sheetUrl) { toast('Set Sheet URL first', 'err'); return; }
  const btn = document.getElementById('syncBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Syncing…'; }
  try {
    const res = await fetch(sheetUrl + '?action=read');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const remote = (data.rows || []).map(mapRemoteRow).filter(r => r.amount > 0);
    if (remote.length > 0) {
      txns = mergeRemoteTxns(remote);
      pendingCount = txns.filter(t => t.pending).length;
      localStorage.setItem('vyaya_pending', String(pendingCount));
      save();
      toast('Merged ' + remote.length + ' sheet rows', 'ok');
    } else { toast('No data in sheet', 'info'); }
    render();
    await pullSettings();
    renderSettings();
  } catch(e) { toast('Sync failed: ' + e.message, 'err'); }
  finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="sc-ico" aria-hidden="true">☁</span><div class="sc-body"><div class="sc-name">Sync Now</div><div class="sc-sub" id="lastSyncLbl">Merge with Google Sheets</div></div><span class="sc-r">›</span>';
    }
  }
}

// ── PERIOD STRIP ───────────────────────────────────────────
function renderPstrip() {
  document.querySelectorAll('.ps-btn').forEach(b => { b.classList.toggle('on', b.dataset.p === period); });
}

// ── RENDER ─────────────────────────────────────────────────
function render() {
  renderHero(); renderInsights(); renderTxns(); renderPstrip();
}

// ── SHOW VIEW ──────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  const el = document.getElementById('view' + name);
  if (el) el.classList.add('on');
  document.querySelectorAll('.nav-btn, .sidebar-ni').forEach(b => { b.classList.toggle('on', b.dataset.view === name); });
  if (name === 'Analytics') renderAnalytics();
  if (name === 'Settings') renderSettings();
  if (name === 'Home') { drillFilter = null; render(); }
}

// ── TOAST ──────────────────────────────────────────────────
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast on ' + (type||'');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2800);
}

// ── IMPORT CSV ─────────────────────────────────────────────
function importCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (!rows.length) { toast('No valid rows found', 'err'); return; }
    const existing = new Set(txns.map(t => t.date + '|' + t.time + '|' + t.amount + '|' + t.category));
    let added = 0;
    rows.forEach(r => {
      const key = r.date + '|' + r.time + '|' + r.amount + '|' + r.category;
      if (!existing.has(key)) { txns.push(r); existing.add(key); added++; }
    });
    txns.sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time));
    save(); render(); toast('Imported ' + added + ' new rows', 'ok');
  };
  reader.readAsText(file);
}

// ── AUTO-LOAD CSV ──────────────────────────────────────────
async function autoLoadCSV() {
  if (txns.length > 0) return; // already have data
  try {
    const res = await fetch('vyaya-vg.csv');
    if (!res.ok) return;
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length > 0) {
      txns = rows;
      txns.sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time));
      save();
      toast('Loaded ' + rows.length + ' historical transactions', 'ok');
      render();
    }
  } catch(e) { /* CSV not available, skip */ }
}



// ── THEME ────────────────────────────────────────────────
function resolveTheme(pref) {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme(pref) {
  themePref = pref || themePref || 'dark';
  localStorage.setItem('vyaya_theme', themePref);
  const resolved = resolveTheme(themePref);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f5f4f0' : '#080810');
  document.querySelectorAll('.theme-seg-btn').forEach(b => b.classList.toggle('on', b.dataset.theme === themePref));
  const lbl = document.getElementById('themeLbl');
  if (lbl) lbl.textContent = themePref === 'system' ? 'Auto (' + resolved + ')' : (themePref[0].toUpperCase() + themePref.slice(1));
}
function cycleTheme() {
  const order = ['dark', 'light', 'system'];
  const next = order[(order.indexOf(themePref) + 1) % order.length];
  applyTheme(next);
  toast('Theme: ' + next, 'info');
}

// ── INIT ───────────────────────────────────────────────────
function init() {
  load();
  applyTheme(themePref);
  buildCatGrid(); buildPayGrid();
  updatePendingPill();

  // Period strip
  document.querySelectorAll('.ps-btn').forEach(b => {
    b.onclick = () => { period = b.dataset.p; drillFilter = null; searchQ = ''; document.getElementById('searchInput').value = ''; render(); };
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const clr = document.getElementById('searchClr');
    if (clr) clr.classList.toggle('on', !!searchInput.value);
    searchTimer = setTimeout(() => {
      searchQ = searchInput.value.trim();
      drillFilter = null; render();
      const hint = document.getElementById('searchHint');
      if (hint) hint.hidden = !searchQ;
    }, 300);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchQ = ''; searchInput.value = '';
      const clr = document.getElementById('searchClr');
      if (clr) clr.classList.remove('on');
      const hint = document.getElementById('searchHint');
      if (hint) hint.hidden = true;
      render();
    }
  });
  // Search clear button
  const searchClr = document.getElementById('searchClr');
  if (searchClr) searchClr.onclick = () => {
    searchQ = ''; searchInput.value = '';
    searchClr.classList.remove('on');
    const hint = document.getElementById('searchHint');
    if (hint) hint.hidden = true;
    render();
  };

  // More options toggle
  const moreToggle = document.getElementById('moreToggle');
  if (moreToggle) {
    moreToggle.onclick = () => {
      const panel = document.getElementById('morePanel');
      setMorePanel(panel.hidden);
    };
  }

  // Theme controls
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.onclick = cycleTheme;
  document.querySelectorAll('.theme-seg-btn').forEach(b => {
    b.onclick = () => applyTheme(b.dataset.theme);
  });
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (themePref === 'system') applyTheme('system');
    });
  } catch (e) {}

  // Add button
  document.getElementById('addBtn').onclick = openAdd;
  const sidebarAdd = document.getElementById('sidebarAddBtn');
  if (sidebarAdd) sidebarAdd.onclick = openAdd;

  // Save expense
  document.getElementById('saveBtn').onclick = saveExpense;
  document.getElementById('addOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeAdd(); });
  document.getElementById('closeAddBtn').onclick = closeAdd;

  // Swipe-to-dismiss on the add sheet
  const addSheet = document.getElementById('addSheet');
  let swipeStartY = 0, swipeStartTime = 0, isSwiping = false;
  addSheet.addEventListener('touchstart', e => {
    if (!e.target.closest('.sheet-drag')) return;
    swipeStartY = e.touches[0].clientY; swipeStartTime = Date.now(); isSwiping = true;
    addSheet.style.transition = 'none';
  }, {passive: true});
  addSheet.addEventListener('touchmove', e => {
    if (!isSwiping) return;
    const dy = e.touches[0].clientY - swipeStartY;
    if (dy > 0) addSheet.style.transform = 'translateY(' + dy + 'px)';
  }, {passive: true});
  addSheet.addEventListener('touchend', e => {
    if (!isSwiping) return; isSwiping = false;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    const vel = dy / (Date.now() - swipeStartTime);
    addSheet.style.transition = '';
    if (dy > 120 || vel > 0.5) { closeAdd(); addSheet.style.transform = ''; }
    else { addSheet.style.transform = ''; }
  }, {passive: true});

  // Amount input → update split share + natural language
  document.getElementById('inAmt').addEventListener('input', updateSplit);

  // Note input → auto-suggest category + natural language parse
  document.getElementById('inNote').addEventListener('input', () => {
    const note = document.getElementById('inNote').value.trim();
    const hint = document.getElementById('catHint');
    // Natural language: "paid 450 for lunch"
    const nl = parseNaturalNote(note);
    if (nl && nl.amount > 0 && !document.getElementById('inAmt').value) {
      document.getElementById('inAmt').value = nl.amount;
      updateSplit();
      hint.textContent = '💬 Detected: ' + fmtAmt(nl.amount) + (nl.desc ? ' for ' + nl.desc : '');
      hint.className = 'cat-hint on';
    }
    // Category suggestion
    const suggested = suggestCat(note);
    if (suggested) {
      selectChip('catGrid', suggested);
      if (!nl) { hint.textContent = '✨ Auto-selected: ' + suggested; hint.className = 'cat-hint on'; }
      checkCatBudgetWarning(suggested);
    }
  });

  // Currency selector
  const currSel = document.getElementById('currencySelect');
  if (currSel) {
    currSel.innerHTML = CURRENCIES.map(c => '<option value="' + c.k + '">' + c.s + ' ' + c.k + '</option>').join('');
    currSel.onchange = () => { selectedCurrency = currSel.value; updateCurrencySymbol(); };
  }

  // Location button
  const locBtn = document.getElementById('locationBtn');
  if (locBtn) locBtn.onclick = detectLocation;

  // Recurring toggle
  const recToggle = document.getElementById('recurringToggle');
  if (recToggle) recToggle.onclick = () => {
    recToggle.classList.toggle('on');
    recToggle.setAttribute('aria-checked', recToggle.classList.contains('on') ? 'true' : 'false');
  };

  // Split controls
  document.getElementById('splitMinus').onclick = () => { if (splitN > 1) { splitN--; updateSplit(); } };
  document.getElementById('splitPlus').onclick = () => { if (splitN < 10) { splitN++; updateSplit(); } };

  // Nav buttons
  document.querySelectorAll('.nav-btn, .sidebar-ni').forEach(b => {
    b.onclick = () => showView(b.dataset.view);
  });

  // Analytics tabs
  document.querySelectorAll('.a-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.a-tab').forEach(x => x.classList.remove('on'));
      tab.classList.add('on');
      analyticsTab = tab.dataset.at;
      renderAnalytics();
    };
  });

  // Month nav
  document.getElementById('mnPrev').onclick = () => { analyticsMonth = prevMonthKey(analyticsMonth || currentMonthKey()); renderAnalytics(); };
  document.getElementById('mnNext').onclick = () => { analyticsMonth = nextMonthKey(analyticsMonth || currentMonthKey()); renderAnalytics(); };

  // Settings: URL save
  document.getElementById('saveUrlBtn').onclick = () => {
    sheetUrl = document.getElementById('urlInput').value.trim();
    localStorage.setItem('vyaya_url', sheetUrl);
    toast('URL saved', 'ok');
  };

  // Settings: Budget save
  document.getElementById('saveBudgetBtn').onclick = () => {
    budget = parseFloat(document.getElementById('budgetInput').value) || 0;
    localStorage.setItem('vyaya_budget', budget);
    pushSettings(); toast('Budget saved', 'ok'); render();
  };

  // Settings: Sync
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) syncBtn.onclick = syncAll;

  // Settings: Import CSV
  const csvInput = document.getElementById('csvInput');
  if (csvInput) csvInput.onchange = e => { if (e.target.files[0]) importCSV(e.target.files[0]); };
  const importBtn = document.getElementById('importCsvBtn');
  if (importBtn) importBtn.onclick = () => csvInput && csvInput.click();

  // Settings: Export CSV
  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) exportBtn.onclick = exportCSV;

  // Settings: Clear data
  const clearBtn = document.getElementById('clearDataBtn');
  if (clearBtn) clearBtn.onclick = () => {
    if (confirm('Delete ALL local data? This cannot be undone.')) {
      txns = []; save(); render(); toast('Data cleared', 'ok');
    }
  };

  // Pull settings from sheet on init if URL is configured — handled in loading screen block below

  // Install banner
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredInstall = e;
    const banner = document.getElementById('installBanner');
    if (banner) { banner.hidden = false; banner.classList.add('on'); banner.style.display = 'flex'; }
  });
  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') {
      const b = document.getElementById('installBanner');
      b.hidden = true; b.classList.remove('on'); b.style.display = 'none';
      deferredInstall = null;
    }
  };
  const dismissInstall = document.getElementById('dismissInstall');
  if (dismissInstall) dismissInstall.onclick = () => {
    const b = document.getElementById('installBanner');
    b.hidden = true; b.classList.remove('on'); b.style.display = 'none';
  };

  // EOD modal mood buttons
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.onclick = () => setMood(parseInt(b.dataset.mood));
  });
  const eodDismiss = document.getElementById('eodDismiss');
  if (eodDismiss) eodDismiss.onclick = () => { document.getElementById('eodModal').classList.remove('on'); };

  // Initial render from local data
  render();
  renderRecurringBanner();
  showView('Home');

  // Loading screen — wait for sync, then dismiss
  const loadScreen = document.getElementById('loadScreen');
  const loadSub = document.getElementById('loadSub');
  const loadRing = document.querySelector('.load-ring');
  const dismissLoad = () => { if (loadScreen) loadScreen.classList.add('hidden'); };

  if (sheetUrl) {
    if (loadSub) loadSub.textContent = 'Syncing…';
    autoSync().then(result => {
      if (result === 'err') {
        if (loadRing) loadRing.style.borderTopColor = 'var(--re)';
        if (loadSub) { loadSub.textContent = 'Sync failed — showing local data'; loadSub.style.color = 'var(--re)'; }
        setTimeout(dismissLoad, 1800);
      } else {
        dismissLoad();
      }
    });
  } else {
    setTimeout(dismissLoad, 600);
  }

  // Auto-load historical CSV if no data
  autoLoadCSV();

  // Handle URL params from iPhone Shortcut
  handleURLParams();

  // Check end of day after 2s delay
  setTimeout(checkEndOfDay, 2000);

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ── URL PARAM HANDLER (iPhone Shortcut) ───────────────────
async function handleURLParams() {
  const params = new URLSearchParams(window.location.search);
  const amt = parseFloat(params.get('amt'));
  if (!amt || amt <= 0) return;

  const cat = normCat(params.get('cat') || 'Others');
  const pay = params.get('pay') || 'UPI';
  const note = params.get('note') || '';
  let split = parseInt(params.get('split') || '1') || 1;
  const date = params.get('date') || today();
  const time = params.get('time') || nowTime();
  const location = params.get('loc') || '';
  const tagsRaw = params.get('tags') || '';

  // Clean URL immediately so refresh doesn't re-save
  history.replaceState({}, document.title, window.location.pathname);

  // If amt > 1000 and split not explicitly provided, ask how many people
  if (amt > 1000 && !params.get('split')) {
    const splitOverlay = document.createElement('div');
    splitOverlay.className = 'overlay on';
    splitOverlay.style.zIndex = 250;
    splitOverlay.innerHTML = `
      <div class="sheet" style="max-width:480px;border-radius:20px;padding:28px 24px 36px">
        <div class="sheet-drag"></div>
        <div class="sheet-title" style="margin-bottom:6px"><em>Split</em> this expense?</div>
        <div style="font-size:13px;color:var(--m2);margin-bottom:20px">${catInfo(cat).i} ₹${Math.round(amt)} · ${esc(note || cat)}</div>
        <div class="field">
          <label class="field-label">Number of people (including you)</label>
          <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
            <button class="settle-btn" id="urlSplitMinus">−</button>
            <span class="settle-count" id="urlSplitVal" style="font-size:18px;font-weight:700;min-width:32px;text-align:center">1</span>
            <button class="settle-btn" id="urlSplitPlus">+</button>
            <span style="font-size:11px;color:var(--m2)">Your share: <strong id="urlSplitShare">${fmtAmt(amt)}</strong></span>
          </div>
        </div>
        <div class="btn-row" style="margin-top:20px">
          <button class="btn btn-cancel" id="urlSplitSkip">No split</button>
          <button class="btn btn-go" id="urlSplitSave">Save</button>
        </div>
      </div>`;
    document.body.appendChild(splitOverlay);

    let splitN = 1;
    const updateShare = () => {
      splitOverlay.querySelector('#urlSplitVal').textContent = splitN;
      splitOverlay.querySelector('#urlSplitShare').textContent = fmtAmt(amt / splitN);
    };
    splitOverlay.querySelector('#urlSplitMinus').onclick = () => { if (splitN > 1) { splitN--; updateShare(); } };
    splitOverlay.querySelector('#urlSplitPlus').onclick  = () => { if (splitN < 10) { splitN++; updateShare(); } };

    const doSave = (n) => {
      splitOverlay.remove();
      _saveURLTransaction(amt, cat, pay, note, n, date, time, location, tagsRaw);
    };
    splitOverlay.querySelector('#urlSplitSkip').onclick = () => doSave(1);
    splitOverlay.querySelector('#urlSplitSave').onclick = () => doSave(splitN);
    return; // wait for user action
  }

  // Save directly (no split prompt needed)
  _saveURLTransaction(amt, cat, pay, note, split, date, time, location, tagsRaw);
}

function _saveURLTransaction(amt, cat, pay, note, split, date, time, location, tagsRaw) {
  const allTags = [...parseTags(tagsRaw), ...parseTags(note)];
  const t = {
    id: genId(),
    amount: amt,
    originalAmount: amt,
    originalCurrency: 'INR',
    category: cat,
    payment: pay,
    note,
    date,
    time,
    split,
    paidCount: 0,
    tags: allTags,
    location,
    recurring: false,
  };
  t.pending = !!sheetUrl;
  txns.unshift(t);
  save();
  render();
  const catI = catInfo(cat).i;
  toast(catI + ' ₹' + Math.round(amt) + (note ? ' · ' + note : '') + (split > 1 ? ' · split ' + split : '') + ' saved!', 'ok');
  if (sheetUrl) {
    bumpPending(1);
    syncTxn('append', t).then(ok => { if (ok) { t.pending = false; bumpPending(-1); save(); render(); } });
  }
}

// ── EXPORT CSV ─────────────────────────────────────────────
function exportCSV() {
  const headers = ['Id','Date','Time','Category','Amount','Mode of Payment','Note','Split','Paid','Tags','Location'];
  const rows = txns.map(t => [
    t.id || '',
    t.date, t.time, t.category, t.amount, t.payment,
    '"' + (t.note||'').replace(/"/g,'""') + '"',
    t.split, t.paidCount,
    '"' + ((t.tags||[]).join(' ')) + '"',
    '"' + (t.location||'') + '"'
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'vyaya-export.csv'; a.click();
  URL.revokeObjectURL(url); toast('Exported!', 'ok');
}

document.addEventListener('DOMContentLoaded', init);
