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

// ── STATE ──────────────────────────────────────────────────
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

// ── STORAGE ────────────────────────────────────────────────
function load() {
  try {
    txns = JSON.parse(localStorage.getItem('vyaya_txns') || '[]');
    localStorage.setItem('vyaya_data_ver', '2');
    sheetUrl = localStorage.getItem('vyaya_url') || '';
    budget = parseFloat(localStorage.getItem('vyaya_budget') || '0');
    catBudgets = JSON.parse(localStorage.getItem('vyaya_cat_budgets') || '{}');
    recurringList = JSON.parse(localStorage.getItem('vyaya_recurring') || '[]');
    goals = JSON.parse(localStorage.getItem('vyaya_goals') || '[]');
    moodLog = JSON.parse(localStorage.getItem('vyaya_mood') || '{}');
    let migrated = false;
    txns = txns.map(t => {
      const nd = normDate(t.date);
      if (nd !== t.date) { migrated = true; return Object.assign({}, t, {date: nd}); }
      return t;
    });
    if (migrated) localStorage.setItem('vyaya_txns', JSON.stringify(txns));
  } catch(e) { txns = []; }
}
function save() { localStorage.setItem('vyaya_txns', JSON.stringify(txns)); }
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
      id: genId(), date: normDate(obj['Date']), time: obj['Time'] || '00:00',
      category: normCat(obj['Category'] || 'Others'), amount: amt,
      payment: obj['Mode of Payment'] || 'UPI', note: obj['Note'] || '',
      split: parseInt(obj['Split'] || '1') || 1, paidCount: parseInt(obj['Paid'] || '0') || 0,
      tags: parseTags(obj['Tags'] || obj['Note'] || ''), location: obj['Location'] || '',
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
  const d = new Date(raw); if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return today();
}
function today() { return new Date().toISOString().slice(0,10); }
function nowTime() { return new Date().toTimeString().slice(0,5); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
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
  const weekAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
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
  const total = list.reduce((s,t) => s+t.amount, 0);
  const catTotals = {};
  list.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const topPct = topCat ? Math.round(topCat[1]/total*100) : 0;
  const nightPct = Math.round(list.filter(t => parseInt((t.time||'00:00').split(':')[0]) >= 21).length / list.length * 100);
  const weekendAmt = list.filter(t => { const d = new Date(t.date+'T00:00:00'); return d.getDay()===0||d.getDay()===6; }).reduce((s,t)=>s+t.amount,0);
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
  let streak = 0; let d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < 30; i++) {
    const ds = d.toISOString().slice(0,10);
    if (txns.filter(t => t.date === ds && disc.includes(t.category)).length === 0) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}
function getUnderBudgetStreak() {
  if (!budget) return 0; let streak = 0; let mk = prevMonthKey(currentMonthKey());
  for (let i = 0; i < 12; i++) {
    const total = txns.filter(t => monthKey(t.date) === mk).reduce((s,t)=>s+t.amount,0);
    if (total > 0 && total <= budget) { streak++; mk = prevMonthKey(mk); } else break;
  }
  return streak;
}

// ── RENDER HERO ────────────────────────────────────────────
function renderHero() {
  const curMon = currentMonthKey(); const prevMon = prevMonthKey(curMon);
  const curList = txns.filter(t => monthKey(t.date) === curMon);
  const prevList = txns.filter(t => monthKey(t.date) === prevMon);
  const curTotal = curList.reduce((s,t) => s+t.amount, 0);
  const prevTotal = prevList.reduce((s,t) => s+t.amount, 0);
  const labels = {month:'THIS MONTH',week:'THIS WEEK',today:'TODAY',all:'ALL TIME'};
  const filtered = filteredTxns(); const filtTotal = filtered.reduce((s,t) => s+t.amount, 0);
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
  const biggest = filtered.length ? Math.max(...filtered.map(t => t.amount)) : 0;
  document.getElementById('heroBig').textContent = fmtAmt(biggest);
  const splitTxns = txns.filter(t => t.split > 1 && t.paidCount < t.split - 1);
  const owedAmt = splitTxns.reduce((s,t) => s + (t.amount/t.split)*(t.split-1-t.paidCount), 0);
  const heroOwed = document.getElementById('heroOwed');
  if (owedAmt > 0) {
    heroOwed.classList.add('on');
    document.getElementById('heroOwedAmt').textContent = fmtAmt(owedAmt);
    document.getElementById('heroOwedSub').textContent = splitTxns.length + ' pending';
  } else { heroOwed.classList.remove('on'); }
}

// ── RENDER INSIGHTS ────────────────────────────────────────
function renderInsights() {
  const row = document.getElementById('insightsRow');
  const curMon = currentMonthKey(); const prevMon = prevMonthKey(curMon);
  const curList = txns.filter(t => monthKey(t.date) === curMon);
  const prevList = txns.filter(t => monthKey(t.date) === prevMon);
  const curTotal = curList.reduce((s,t) => s+t.amount, 0);
  const prevTotal = prevList.reduce((s,t) => s+t.amount, 0);
  const cards = [];

  if (budget > 0) {
    const pct = Math.round(curTotal/budget*100); const remaining = budget - curTotal;
    if (pct >= 90) cards.push({type:'warn',ico:'🚨',title:pct+'% of budget used',sub:'Only '+fmtAmt(remaining)+' left this month'});
    else if (pct >= 70) cards.push({type:'gold',ico:'⚠️',title:pct+'% of budget used',sub:fmtAmt(remaining)+' remaining'});
    else cards.push({type:'good',ico:'✅',title:'Budget on track',sub:fmtAmt(remaining)+' of '+fmtAmt(budget)+' left'});
  }

  // Category budget warnings
  Object.entries(catBudgets).forEach(([cat, lim]) => {
    if (!lim) return;
    const spent = curList.filter(t => t.category === cat).reduce((s,t) => s+t.amount, 0);
    const pct = Math.round(spent/lim*100);
    if (pct >= 90) cards.push({type:'warn',ico:catInfo(cat).i,title:cat+' budget '+pct+'%',sub:fmtAmt(spent)+' of '+fmtAmt(lim)});
    else if (pct >= 70) cards.push({type:'gold',ico:catInfo(cat).i,title:cat+' at '+pct+'%',sub:fmtAmt(lim-spent)+' remaining'});
  });

  const catTotals = {};
  curList.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  if (topCat) {
    const ci = catInfo(topCat[0]); const pct = Math.round(topCat[1]/curTotal*100);
    cards.push({type:'info',ico:ci.i,title:'Top: '+topCat[0],sub:fmtAmt(topCat[1])+' · '+pct+'% of spend'});
  }

  if (prevTotal > 0) {
    const diff = curTotal - prevTotal; const pct = Math.abs(Math.round(diff/prevTotal*100));
    if (diff > 0) cards.push({type:'warn',ico:'📈',title:pct+'% more than last month',sub:fmtAmt(diff)+' extra vs '+monthLabel(prevMon)});
    else if (diff < 0) cards.push({type:'good',ico:'📉',title:pct+'% less than last month',sub:'Saved '+fmtAmt(-diff)+' vs '+monthLabel(prevMon)});
  }

  const dayNum = dayOfMonth(today()); const daysTotal = daysInMonth(curMon);
  if (dayNum > 0 && curTotal > 0) {
    const dailyAvg = curTotal/dayNum; const predicted = Math.round(dailyAvg*daysTotal);
    cards.push({type:'purple',ico:'🔮',title:'Predicted: '+fmtAmt(predicted),sub:'At '+fmtAmt(dailyAvg)+'/day pace'});
  }

  // Spend personality
  const personality = getSpendPersonality();
  if (personality) cards.push({type:personality.type,ico:'🧠',title:personality.label,sub:personality.sub});

  // Spend streak
  const streak = getSpendStreak();
  if (streak >= 2) cards.push({type:'good',ico:'🔥',title:streak+'-day no-spend streak!',sub:'No discretionary spend for '+streak+' days'});

  // Under-budget streak
  const ubStreak = getUnderBudgetStreak();
  if (ubStreak >= 2) cards.push({type:'good',ico:'🏆',title:ubStreak+' months under budget!',sub:'Keep it up!'});

  // Goals progress
  goals.forEach(g => {
    if (!g.target || !g.name) return;
    const saved = g.saved || 0;
    const pct = Math.min(100, Math.round(saved/g.target*100));
    cards.push({type:'info',ico:'🎯',title:g.name+': '+pct+'%',sub:fmtAmt(saved)+' of '+fmtAmt(g.target)});
  });

  const splitTxns = txns.filter(t => t.split > 1 && t.paidCount < t.split - 1);
  if (splitTxns.length > 0) {
    const owedAmt = splitTxns.reduce((s,t) => s + (t.amount/t.split)*(t.split-1-t.paidCount), 0);
    cards.push({type:'purple',ico:'💜',title:splitTxns.length+' splits pending',sub:fmtAmt(owedAmt)+' owed to you',action:'splits'});
  }

  const todayStr = today();
  const todayTxns = txns.filter(t => t.date === todayStr);
  if (todayTxns.length > 0) {
    const todayTotal = todayTxns.reduce((s,t)=>s+t.amount,0);
    cards.push({type:'gold',ico:'📅',title:'Today: '+fmtAmt(todayTotal),sub:todayTxns.length+' transaction'+(todayTxns.length>1?'s':'')+' logged'});
  }

  row.innerHTML = cards.map(c =>
    '<div class="insight-card ' + c.type + '"' + (c.action ? ' data-action="'+c.action+'" style="cursor:pointer"' : '') + '>' +
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

  document.getElementById('insightsWrap').style.display = cards.length ? '' : 'none';
}

// ── RECURRING REMINDER ─────────────────────────────────────
function renderRecurringBanner() {
  const banner = document.getElementById('recurringBanner');
  if (!banner) return;
  const curMon = currentMonthKey();
  const due = recurringList.filter(r => {
    if (!r.name || !r.amount) return false;
    const alreadyLogged = txns.some(t => monthKey(t.date) === curMon && t.note && t.note.toLowerCase().includes(r.name.toLowerCase()) && Math.abs(t.amount - r.amount) < 1);
    return !alreadyLogged;
  });
  if (due.length === 0) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  document.getElementById('recurringBannerText').textContent = due.length + ' recurring expense' + (due.length>1?'s':'') + ' due: ' + due.map(r=>r.name).join(', ');
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
      hint.textContent = 'Recurring: ' + r.name; hint.className = 'cat-hint on';
    }, 100);
  };
}

// ── RENDER TRANSACTIONS ────────────────────────────────────
function renderTxns() {
  const list = filteredTxns(); const el = document.getElementById('txList'); const title = document.getElementById('txTitle');
  const labels = {month:'This Month',week:'This Week',today:'Today',all:'All Time'};
  title.textContent = searchQ ? 'Results for "' + searchQ + '"' : (labels[period] || 'Recent');
  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ico">🌿</div><div class="empty-txt">' + (searchQ ? 'No results found' : 'No expenses yet.<br>Tap + to add one!') + '</div></div>';
    return;
  }
  const groups = {};
  list.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
  const todayStr = today(); const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  let html = '';
  Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(dk => {
    let dlbl = fmtDate(dk);
    if (dk === todayStr) dlbl = 'Today'; else if (dk === yesterday) dlbl = 'Yesterday';
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
  let html = '<div class="tx" data-id="' + t.id + '">';
  html += '<div class="tx-ico" style="background:' + ci.c + '22">' + ci.i + '</div>';
  html += '<div class="tx-body">';
  html += '<div class="tx-name">' + (t.note ? t.note.replace(/#[\w-]+/g,'').trim() || t.category : t.category) + '</div>';
  html += '<div class="tx-sub">';
  html += '<span>' + fmtDate(t.date) + ' · ' + t.time + '</span>';
  html += '<span class="pay-pill" style="background:' + payColor(t.payment) + ';color:' + payTextColor(t.payment) + ';border-color:' + payTextColor(t.payment) + '44">' + pi.i + ' ' + t.payment + '</span>';
  if (isSplit) html += '<span class="rec-pill">👥 ' + t.split + (allPaid ? ' ✓' : ' (' + remaining + ' owed)') + '</span>';
  if (t.location) html += '<span class="loc-pill">📍 ' + t.location + '</span>';
  html += '</div>';
  if (tags.length) html += '<div class="tx-tags">' + tags.map(tag => '<span class="tag-pill" data-tag="'+tag+'">'+tag+'</span>').join('') + '</div>';
  if (t.originalCurrency && t.originalCurrency !== 'INR') {
    const cs = CURRENCIES.find(c=>c.k===t.originalCurrency); const sym = cs ? cs.s : t.originalCurrency;
    html += '<div class="tx-fx">' + sym + Math.round(t.originalAmount) + ' → ₹' + Math.round(t.amount) + '</div>';
  }
  if (isSplit && !allPaid) {
    html += '<div class="settle-row" id="sr_' + t.id + '" style="display:flex">';
    html += '<div class="settle-info">Share: ' + fmtAmt(share) + ' · ' + remaining + ' person' + (remaining>1?'s':'') + ' owe you</div>';
    html += '<div class="settle-controls">';
    html += '<button class="settle-btn" data-settle-dec="' + t.id + '">−</button>';
    html += '<span class="settle-count">' + t.paidCount + '/' + (t.split-1) + '</span>';
    html += '<button class="settle-btn" data-settle-inc="' + t.id + '">+</button>';
    html += '<button class="settle-all" data-settle-all="' + t.id + '">All paid</button>';
    html += '</div></div>';
  }
  html += '</div>';
  html += '<div class="tx-r">';
  html += '<div class="tx-amt">' + fmtAmt(t.amount) + '</div>';
  if (isSplit) html += '<div style="font-size:10px;color:var(--m2)">Your: ' + fmtAmt(share) + '</div>';
  html += '<div class="tx-actions">';
  html += '<button class="tx-btn" data-edit="' + t.id + '">✏️</button>';
  html += '<button class="tx-btn del" data-del="' + t.id + '">🗑️</button>';
  html += '</div></div></div>';
  return html;
}

function attachTxnEvents() {
  document.querySelectorAll('[data-edit]').forEach(b => { b.onclick = e => { e.stopPropagation(); openEdit(b.dataset.edit); }; });
  document.querySelectorAll('[data-del]').forEach(b => { b.onclick = e => { e.stopPropagation(); deleteTxn(b.dataset.del); }; });
  document.querySelectorAll('[data-settle-inc]').forEach(b => { b.onclick = e => { e.stopPropagation(); settle(b.dataset.settleInc, 1); }; });
  document.querySelectorAll('[data-settle-dec]').forEach(b => { b.onclick = e => { e.stopPropagation(); settle(b.dataset.settleDec, -1); }; });
  document.querySelectorAll('[data-settle-all]').forEach(b => { b.onclick = e => { e.stopPropagation(); settleAll(b.dataset.settleAll); }; });
  document.querySelectorAll('.tag-pill').forEach(pill => {
    pill.onclick = e => { e.stopPropagation(); drillFilter = {type:'tag', value:pill.dataset.tag}; showView('Home'); document.getElementById('txTitle').textContent = pill.dataset.tag; render(); };
  });
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
  const t = txns.find(x => x.id === id); if (!t) return;
  if (!confirm('Delete this expense?')) return;
  txns = txns.filter(x => x.id !== id); save(); render(); toast('Deleted', 'ok');
  if (sheetUrl) syncTxn('delete', t);
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
  if (recToggle) recToggle.classList.remove('on');
  selectedCurrency = 'INR'; updateCurrencySymbol();
  splitN = 1; updateSplit();
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
  if (recToggle) recToggle.classList.toggle('on', !!t.recurring);
  selectedCurrency = t.originalCurrency || 'INR'; updateCurrencySymbol();
  splitN = t.split || 1; updateSplit();
  selectChip('catGrid', t.category); selectChip('payGrid', t.payment);
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
      const oldKey = t.date + '|' + t.time + '|' + t.amount + '|' + t.category;
      Object.assign(t, {amount:finalAmt, originalAmount, originalCurrency, category:cat, payment:pay, note, date, time, split:splitN, tags:allTags, location, recurring:isRecurring});
      if (sheetUrl) syncTxn('update', t, oldKey);
    }
    toast('Updated', 'ok');
  } else {
    const t = {id:genId(), amount:finalAmt, originalAmount, originalCurrency, category:cat, payment:pay, note, date, time, split:splitN, paidCount:0, tags:allTags, location, recurring:isRecurring};
    txns.unshift(t); toast('Saved', 'ok');
    if (sheetUrl) syncTxn('append', t);
    // Add to recurring list if toggled
    if (isRecurring && note) {
      const exists = recurringList.find(r => r.name.toLowerCase() === note.toLowerCase());
      if (!exists) { recurringList.push({id:genId(), name:note, amount:finalAmt, category:cat, payment:pay}); saveSettings(); }
    }
  }
  save(); closeAdd(); render(); renderRecurringBanner();
}

// ── FX RATES ───────────────────────────────────────────────
async function getFxRate(from, to) {
  const key = from + '_' + to;
  if (fxRates[key] && fxRates[key].ts > Date.now() - 3600000) return fxRates[key].rate;
  const res = await fetch('https://api.frankfurter.app/latest?from=' + from + '&to=' + to);
  const data = await res.json();
  const rate = data.rates[to];
  fxRates[key] = {rate, ts: Date.now()};
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
  const catTotals = {};
  list.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
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
    (biggest ? '<div class="yr-hl"><span class="yr-hl-ico">💸</span><div><div class="yr-hl-title">Biggest Expense</div><div class="yr-hl-val">' + (biggest.note||biggest.category) + ' · ' + fmtAmt(biggest.amount) + '</div></div></div>' : '') +
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
      saveSettings(); toast('Budget saved', 'ok');
    };
  });
}

function renderRecurringSettings() {
  const el = document.getElementById('recurringList');
  if (!el) return;
  if (!recurringList.length) { el.innerHTML = '<div style="font-size:12px;color:var(--m2);padding:8px 0">No recurring expenses yet. Toggle "Recurring" when adding an expense.</div>'; return; }
  el.innerHTML = recurringList.map(r =>
    '<div class="rec-row"><span class="rec-ico">' + catInfo(r.category||'Bills').i + '</span>' +
    '<div class="rec-body"><div class="rec-name">' + r.name + '</div><div class="rec-sub">' + fmtAmt(r.amount) + ' · ' + (r.category||'Bills') + '</div></div>' +
    '<button class="rec-del" data-rid="' + r.id + '">✕</button></div>'
  ).join('');
  el.querySelectorAll('.rec-del').forEach(b => {
    b.onclick = () => { recurringList = recurringList.filter(r => r.id !== b.dataset.rid); saveSettings(); renderRecurringSettings(); toast('Removed', 'ok'); };
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
  }).join('') + '<button class="save-url-btn" id="addGoalBtn" style="margin-top:8px">+ New Goal</button>';
  el.querySelectorAll('.goal-add-btn').forEach(b => {
    b.onclick = () => {
      const amt = parseFloat(prompt('Add to savings (₹):'));
      if (!amt || amt <= 0) return;
      const g = goals.find(x => x.id === b.dataset.gid);
      if (g) { g.saved = (g.saved||0) + amt; saveSettings(); renderGoalsSettings(); toast('Saved +' + fmtAmt(amt), 'ok'); }
    };
  });
  el.querySelectorAll('.rec-del[data-gid]').forEach(b => {
    b.onclick = () => { goals = goals.filter(g => g.id !== b.dataset.gid); saveSettings(); renderGoalsSettings(); };
  });
  const addBtn = document.getElementById('addGoalBtn');
  if (addBtn) addBtn.onclick = () => {
    const name = prompt('Goal name (e.g. Goa Trip):');
    if (!name) return;
    const target = parseFloat(prompt('Target amount (₹):'));
    if (!target || target <= 0) return;
    goals.push({id:genId(), name, target, saved:0});
    saveSettings(); renderGoalsSettings(); toast('Goal added!', 'ok');
  };
}

// ── END OF DAY MODAL ───────────────────────────────────────
function checkEndOfDay() {
  const h = new Date().getHours();
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
async function syncTxn(action, t, oldKey) {
  if (!sheetUrl) return;
  const body = {
    action, Date: t.date, Time: t.time, Category: t.category,
    Amount: t.amount, 'Mode of Payment': t.payment, Note: t.note,
    Split: t.split, Paid: t.paidCount,
  };
  if (oldKey) body.oldKey = oldKey;
  try {
    await fetch(sheetUrl, {method:'POST', body:JSON.stringify(body)});
  } catch(e) { console.warn('Sync failed:', e); }
}

async function syncAll() {
  if (!sheetUrl) { toast('Set Sheet URL first', 'err'); return; }
  const btn = document.getElementById('syncBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Syncing…'; }
  try {
    const res = await fetch(sheetUrl + '?action=read');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const remote = (data.rows || []).map(r => ({
      id: genId(), date: normDate(r['Date']), time: r['Time'] || '00:00',
      category: r['Category'] || 'Others', amount: parseFloat(r['Amount']) || 0,
      payment: r['Mode of Payment'] || 'UPI', note: r['Note'] || '',
      split: parseInt(r['Split'] || '1') || 1, paidCount: parseInt(r['Paid'] || '0') || 0,
      tags: parseTags(r['Note'] || ''), location: r['Location'] || '',
    })).filter(r => r.amount > 0);
    if (remote.length > 0) {
      txns = remote; save();
      toast('Synced ' + remote.length + ' rows', 'ok');
    } else { toast('No data in sheet', 'info'); }
    render();
  } catch(e) { toast('Sync failed: ' + e.message, 'err'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = '☁️ Sync from Sheet'; } }
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

// ── INIT ───────────────────────────────────────────────────
function init() {
  load();
  buildCatGrid(); buildPayGrid();

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
      if (hint) hint.style.display = searchQ ? 'block' : 'none';
    }, 300);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchQ = ''; searchInput.value = '';
      const clr = document.getElementById('searchClr');
      if (clr) clr.classList.remove('on');
      const hint = document.getElementById('searchHint');
      if (hint) hint.style.display = 'none';
      render();
    }
  });
  // Search clear button
  const searchClr = document.getElementById('searchClr');
  if (searchClr) searchClr.onclick = () => {
    searchQ = ''; searchInput.value = '';
    searchClr.classList.remove('on');
    const hint = document.getElementById('searchHint');
    if (hint) hint.style.display = 'none';
    render();
  };

  // Add button
  document.getElementById('addBtn').onclick = openAdd;
  const sidebarAdd = document.getElementById('sidebarAddBtn');
  if (sidebarAdd) sidebarAdd.onclick = openAdd;

  // Save expense
  document.getElementById('saveBtn').onclick = saveExpense;
  document.getElementById('addOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeAdd(); });
  document.getElementById('closeAddBtn').onclick = closeAdd;

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
  if (recToggle) recToggle.onclick = () => recToggle.classList.toggle('on');

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
    toast('Budget saved', 'ok'); render();
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

  // Install banner
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredInstall = e;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'flex';
  });
  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') { document.getElementById('installBanner').style.display = 'none'; deferredInstall = null; }
  };
  const dismissInstall = document.getElementById('dismissInstall');
  if (dismissInstall) dismissInstall.onclick = () => { document.getElementById('installBanner').style.display = 'none'; };

  // EOD modal mood buttons
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.onclick = () => setMood(parseInt(b.dataset.mood));
  });
  const eodDismiss = document.getElementById('eodDismiss');
  if (eodDismiss) eodDismiss.onclick = () => { document.getElementById('eodModal').classList.remove('on'); };

  // Initial render
  render();
  renderRecurringBanner();
  showView('Home');

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
  const split = parseInt(params.get('split') || '1') || 1;
  const date = params.get('date') || today();
  const time = params.get('time') || nowTime();
  const location = params.get('loc') || '';
  const tagsRaw = params.get('tags') || '';

  // Clean URL immediately so refresh doesn't re-save
  history.replaceState({}, document.title, window.location.pathname);

  // Build tags
  const allTags = [...parseTags(tagsRaw), ...parseTags(note)];

  // Save directly without opening the sheet
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

  txns.unshift(t);
  save();
  render();

  // Show confirmation toast
  const catI = catInfo(cat).i;
  toast(catI + ' ₹' + Math.round(amt) + (note ? ' · ' + note : '') + ' saved!', 'ok');

  // Sync to sheet if configured
  if (sheetUrl) syncTxn('append', t);
}

// ── EXPORT CSV ─────────────────────────────────────────────
function exportCSV() {
  const headers = ['Date','Time','Category','Amount','Mode of Payment','Note','Split','Paid','Tags','Location'];
  const rows = txns.map(t => [
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
