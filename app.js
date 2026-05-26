/* ═══════════════════════════════════════════════════════════════
   PSALTIREA MEA — app.js v2.0
   Toate sistemele: Invatare, Gamification, Spaced Repetition,
   Programul Liturgic, Statistici, Haptic, Persistence
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════
   CONFIGURATIE
══════════════════════ */
const CFG = {
  BASE_URL: '/David/',
  RANKS: [
    { min: 0,     max: 99,    emoji: '🕯️',  name: 'Novice',            desc: 'Cel ce abia a inceput' },
    { min: 100,   max: 499,   emoji: '📖',  name: 'Psaltor',           desc: 'Cel ce citeste cu ravna' },
    { min: 500,   max: 1499,  emoji: '✝️',  name: 'Anagnost',          desc: 'Cititorul Sfintei Scripturi' },
    { min: 1500,  max: 3999,  emoji: '🕊️',  name: 'Ipodiacon',         desc: 'Cel aproape de Altar' },
    { min: 4000,  max: 9999,  emoji: '⛪',  name: 'Diacon',            desc: 'Slujitorul Cuvantului' },
    { min: 10000, max: 24999, emoji: '🌟',  name: 'Preot-Psalt',       desc: 'Pastorul Cantarii' },
    { min: 25000, max: Infinity, emoji:'👑', name: 'Arhidiacon',        desc: 'Tainuitorul Psaltirii' }
  ],
  BADGES: [
    { id: 'first_psalm',   icon: '📜', name: 'Primul Psalm',      desc: 'Ai memorat primul psalm', condition: s => s.psalmi_memorati >= 1 },
    { id: 'first_catisma', icon: '📕', name: 'Prima Catisma',     desc: 'Catisma intreaga memorata', condition: s => s.catisme_complete >= 1 },
    { id: 'streak_3',      icon: '🔥', name: '3 Zile',            desc: 'Streak de 3 zile', condition: s => s.streak >= 3 },
    { id: 'streak_7',      icon: '⚡', name: 'O Saptamana',       desc: 'Streak de 7 zile', condition: s => s.streak >= 7 },
    { id: 'streak_30',     icon: '🌕', name: 'O Luna',            desc: 'Streak de 30 zile', condition: s => s.streak >= 30 },
    { id: 'zidul_cleared', icon: '🏰', name: 'Zidul Cucerit',     desc: 'Ai sters Zidul de Incercare', condition: s => s.zidul_cleared >= 1 },
    { id: 'patience',      icon: '⚖️',  name: 'Statornic',        desc: '10 bonusuri de statornicie', condition: s => s.patience_bonuses >= 10 },
    { id: 'all_catisme',   icon: '✨', name: 'Psaltirea Intreaga',desc: 'Toate catismele complete', condition: s => s.catisme_complete >= 20 },
  ],
  POINTS: {
    verse_correct: 10,
    verse_wrong: -5,
    psalm_complete: 30,
    catisma_complete: 150,
    daily_bonus: 50,
    streak_bonus_3: 15,
    streak_bonus_7: 30,
    streak_bonus_15: 60,
    patience_bonus: 8,
    patience_rush_penalty: -5
  },
  // Programul liturgic tipic - catisma dupa zi/ora
  TIPIC: [
    // [Luni V, Luni D, Marti V, Marti D, Miercuri V, Miercuri D, Joi V, Joi D, Vineri V, Vineri D, Sambata V, Sambata D]
    { zi: 0, period: 'V', catisma: 1  },  // Duminica Vecernie
    { zi: 0, period: 'D', catisma: 2  },  // Duminica Utrenie
    { zi: 1, period: 'V', catisma: 4  },  // Luni Vecernie
    { zi: 1, period: 'D', catisma: [5,6] },// Luni Utrenie
    { zi: 2, period: 'V', catisma: 7  },  // Marti Vecernie
    { zi: 2, period: 'D', catisma: [8,9] },
    { zi: 3, period: 'V', catisma: 10 },
    { zi: 3, period: 'D', catisma: [11,12] },
    { zi: 4, period: 'V', catisma: 13 },
    { zi: 4, period: 'D', catisma: [14,15] },
    { zi: 5, period: 'V', catisma: 16 },
    { zi: 5, period: 'D', catisma: [17,18] },
    { zi: 6, period: 'V', catisma: [3,19,20] }, // Sambata are mai multe
    { zi: 6, period: 'D', catisma: [16,17] },
  ],
  RUGACIUNE_INTRO: 'Doamne, lumineaza mintea mea, ca sa pot intelege si a pastra in inima poruncile Tale cele sfinte. Deschide buzele mele, ca sa laud Sfant Numele Tau. Amin.'
};

/* ══════════════════════
   STATE GLOBAL
══════════════════════ */
let DB = null; // psalm data loaded from JSON
let STATE = {
  screen: 'acasa',
  points: 0,
  streak: 0,
  last_session_date: null,
  psalmi_memorati: 0,
  catisme_complete: 0,
  zidul_cleared: 0,
  patience_bonuses: 0,
  badges_earned: [],
  catisme_progress: {}, // { catisma_num: { psalm_num: { versete_memorate: Set } } }
  zidul: [],            // [ { catisma, psalm, verse_n, verse_text, dates_correct: [] } ]
  heatmap: {},          // { 'YYYY-MM-DD': intensity }
  tema: 'lumina',
  notificari: false,
  sunet: true,
  // session
  session: {
    current_catisma: null,
    current_psalm: null,
    current_section: null, // 'psalm' | 'tropare' | 'rugaciune'
    learn_mode: 'citire',   // citire | completare | prima_litera | scriere | ordine
    current_verse_idx: 0,
    verse_start_time: null,
    streak_session: 0,
    session_score: 0,
    difficulty: 'verset',   // verset | psalm | catisma
    order_verses: [],
    shuffled: false
  }
};

/* ══════════════════════
   STORAGE
══════════════════════ */
function saveState() {
  try {
    const toSave = { ...STATE };
    delete toSave.session;
    // Convert Sets to arrays for JSON
    const prog = {};
    for (const [ck, cv] of Object.entries(toSave.catisme_progress || {})) {
      prog[ck] = {};
      for (const [pk, pv] of Object.entries(cv)) {
        prog[ck][pk] = Array.isArray(pv.versete_memorate) ? pv.versete_memorate : [...(pv.versete_memorate || [])];
      }
    }
    toSave.catisme_progress = prog;
    localStorage.setItem('psaltirea_state', JSON.stringify(toSave));
  } catch(e) { console.warn('Save failed:', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem('psaltirea_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Restore Sets
    for (const [ck, cv] of Object.entries(saved.catisme_progress || {})) {
      for (const [pk, pv] of Object.entries(cv)) {
        saved.catisme_progress[ck][pk] = { versete_memorate: new Set(pv) };
      }
    }
    STATE = { ...STATE, ...saved };
  } catch(e) { console.warn('Load failed:', e); }
}

function getProgress(catisma_num, psalm_num) {
  const ck = String(catisma_num);
  const pk = String(psalm_num);
  if (!STATE.catisme_progress[ck]) STATE.catisme_progress[ck] = {};
  if (!STATE.catisme_progress[ck][pk]) STATE.catisme_progress[ck][pk] = { versete_memorate: new Set() };
  return STATE.catisme_progress[ck][pk];
}

function markVerseMemorized(catisma_num, psalm_num, verse_n) {
  const prog = getProgress(catisma_num, psalm_num);
  prog.versete_memorate.add(verse_n);
  saveState();
}

function getPsalmPercent(catisma_num, psalm_num, total_verses) {
  const prog = getProgress(catisma_num, psalm_num);
  if (!total_verses) return 0;
  return Math.round((prog.versete_memorate.size / total_verses) * 100);
}

function getCatismaPercent(catisma_num) {
  const catisma = DB.find(c => c.num === catisma_num);
  if (!catisma) return 0;
  let total = 0, done = 0;
  for (const psalm of catisma.psalmi) {
    total += psalm.verses.length;
    done += getProgress(catisma_num, psalm.num).versete_memorate.size;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

/* ══════════════════════
   STREAK & DAILY
══════════════════════ */
function checkAndUpdateStreak() {
  const today = new Date().toISOString().split('T')[0];
  if (STATE.last_session_date === today) return false; // already done today

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (STATE.last_session_date === yesterday) {
    STATE.streak++;
  } else if (STATE.last_session_date !== today) {
    STATE.streak = 1;
  }
  STATE.last_session_date = today;

  // Heatmap
  STATE.heatmap[today] = (STATE.heatmap[today] || 0) + 1;

  // Daily bonus
  addPoints(CFG.POINTS.daily_bonus, 'Bonus zilnic 🌅');
  saveState();
  return true;
}

/* ══════════════════════
   POINTS & RANKS
══════════════════════ */
function getRank(pts) {
  for (let i = CFG.RANKS.length - 1; i >= 0; i--) {
    if (pts >= CFG.RANKS[i].min) return { ...CFG.RANKS[i], idx: i };
  }
  return { ...CFG.RANKS[0], idx: 0 };
}

function addPoints(pts, reason = '') {
  const oldRank = getRank(STATE.points);
  STATE.points = Math.max(0, STATE.points + pts);
  const newRank = getRank(STATE.points);

  updateHeaderStats();

  if (pts > 0) {
    showToast(`+${pts} ${reason || 'puncte'}`);
  } else {
    showToast(`${pts} puncte`, 'warn');
  }

  if (newRank.idx > oldRank.idx) {
    setTimeout(() => showRankUp(newRank), 500);
  }

  checkBadges();
  saveState();
}

function getStreakMultiplier() {
  const s = STATE.session.streak_session;
  if (s >= 15) return 3;
  if (s >= 7)  return 2;
  if (s >= 3)  return 1.5;
  return 1;
}

/* ══════════════════════
   BADGES
══════════════════════ */
function checkBadges() {
  for (const badge of CFG.BADGES) {
    if (!STATE.badges_earned.includes(badge.id) && badge.condition(STATE)) {
      STATE.badges_earned.push(badge.id);
      showToast(`🏅 Badge nou: ${badge.name}!`);
    }
  }
}

/* ══════════════════════
   HAPTIC
══════════════════════ */
function haptic(type = 'success') {
  if (!navigator.vibrate) return;
  if (type === 'success') navigator.vibrate(40);
  else if (type === 'wrong') navigator.vibrate([80, 50, 80]);
  else if (type === 'rank') navigator.vibrate([50, 30, 50, 30, 100]);
}

/* ══════════════════════
   ZIDUL DE INCERCARE
══════════════════════ */
function addToZidul(catisma_num, psalm_num, verse) {
  const existing = STATE.zidul.find(z => z.catisma === catisma_num && z.psalm === psalm_num && z.verse_n === verse.n);
  if (!existing) {
    STATE.zidul.push({
      catisma: catisma_num,
      psalm: psalm_num,
      verse_n: verse.n,
      verse_text: verse.text,
      dates_correct: []
    });
    saveState();
  }
}

function markZidulVerse(catisma_num, psalm_num, verse_n) {
  const today = new Date().toISOString().split('T')[0];
  const entry = STATE.zidul.find(z => z.catisma === catisma_num && z.psalm === psalm_num && z.verse_n === verse_n);
  if (!entry) return;
  if (!entry.dates_correct.includes(today)) {
    entry.dates_correct.push(today);
  }
  if (entry.dates_correct.length >= 3) {
    // Remove from zidul
    STATE.zidul = STATE.zidul.filter(z => !(z.catisma === catisma_num && z.psalm === psalm_num && z.verse_n === verse_n));
    STATE.zidul_cleared++;
    showToast('🏰 Verset scos din Zidul de Incercare!');
    checkBadges();
  }
  saveState();
}

/* ══════════════════════
   PROGRAMUL LITURGIC
══════════════════════ */
function getCatismaZilei() {
  const now = new Date();
  const zi = now.getDay(); // 0=Duminica
  const ora = now.getHours();
  const period = (ora >= 15 || ora < 6) ? 'V' : 'D'; // Vecernie sau Dimineata

  const match = CFG.TIPIC.find(t => t.zi === zi && t.period === period);
  if (!match) return 1;
  const cat = Array.isArray(match.catisma) ? match.catisma[0] : match.catisma;
  return cat;
}

/* ══════════════════════
   TOAST
══════════════════════ */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  if (type === 'warn') el.style.borderColor = 'var(--rosu)';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ══════════════════════
   RANK UP MODAL
══════════════════════ */
function showRankUp(rank) {
  haptic('rank');
  const modal = document.getElementById('diploma-modal');
  document.getElementById('diploma-icon').textContent = rank.emoji;
  document.getElementById('diploma-title').textContent = `Ai avansat la rang nou!`;
  document.getElementById('diploma-text').textContent = `${rank.name} — ${rank.desc}`;
  document.getElementById('diploma-pts').textContent = `${STATE.points} puncte`;
  modal.classList.add('show');
}

/* ══════════════════════
   NAVIGATION
══════════════════════ */
function navigate(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`screen-${screen}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-screen="${screen}"]`)?.classList.add('active');
  STATE.screen = screen;
  if (screen === 'profil') renderProfil();
  if (screen === 'zidul') renderZidul();
  if (screen === 'acasa') renderAcasa();
}

/* ══════════════════════
   HEADER UPDATE
══════════════════════ */
function updateHeaderStats() {
  const rank = getRank(STATE.points);
  document.getElementById('hdr-rank-title').textContent = rank.name;
  document.getElementById('hdr-rank-pts').textContent = `${STATE.points} pts`;
}

/* ══════════════════════
   RENDER ACASA
══════════════════════ */
function renderAcasa() {
  const rank = getRank(STATE.points);
  document.getElementById('acasa-rank-emoji').textContent = rank.emoji;
  document.getElementById('acasa-rank-name').textContent = rank.name;
  document.getElementById('acasa-rank-pts').textContent = `${STATE.points} puncte · Rang ${rank.idx + 1}/7`;

  // Catisma zilei
  const catNr = getCatismaZilei();
  const catData = DB.find(c => c.num === catNr);
  document.getElementById('catisma-azi-name').textContent = `Catisma ${catData.name}`;
  document.getElementById('catisma-azi-info').textContent =
    `${catData.psalmi.length} psalmi · ${catData.psalmi.reduce((a,p)=>a+p.verses.length,0)} versete`;

  // Streak
  document.getElementById('acasa-streak').textContent = `🔥 ${STATE.streak} zile consecutive`;

  // Stats
  document.getElementById('stat-points').textContent = STATE.points;
  document.getElementById('stat-streak').textContent = STATE.streak + ' zile';
  document.getElementById('stat-psalmi').textContent = STATE.psalmi_memorati;
  document.getElementById('stat-catisme').textContent = STATE.catisme_complete + '/20';

  // Progress bar ranks
  const nextRank = CFG.RANKS[rank.idx + 1];
  if (nextRank) {
    const pct = Math.round(((STATE.points - rank.min) / (nextRank.min - rank.min)) * 100);
    document.getElementById('rank-progress-fill').style.width = pct + '%';
    document.getElementById('rank-progress-label').textContent = `${pct}% spre ${nextRank.name}`;
  } else {
    document.getElementById('rank-progress-fill').style.width = '100%';
    document.getElementById('rank-progress-label').textContent = 'Rang Maxim Atins!';
  }

  // Badges
  renderBadgesAcasa();
}

function renderBadgesAcasa() {
  const container = document.getElementById('badges-scroll');
  container.innerHTML = CFG.BADGES.map(badge => `
    <div class="badge-chip ${STATE.badges_earned.includes(badge.id) ? 'earned' : ''}">
      <span class="badge-icon">${badge.icon}</span>
      <span class="badge-name">${badge.name}</span>
    </div>
  `).join('');
}

/* ══════════════════════
   RENDER CATISME LIST
══════════════════════ */
function renderCatismeList() {
  const container = document.getElementById('catisme-list');
  container.innerHTML = DB.map(catisma => {
    const pct = getCatismaPercent(catisma.num);
    const psalmiInfo = catisma.psalmi.map(p => p.num).join(', ');
    return `
    <div class="catisma-item" data-catisma="${catisma.num}">
      <div class="catisma-item-header" onclick="toggleCatisma(${catisma.num})">
        <div class="catisma-num-box">${catisma.num}</div>
        <div class="catisma-item-info">
          <div class="catisma-item-name">Catisma ${catisma.name}</div>
          <div class="catisma-item-meta">Ps. ${catisma.psalmi[0].num}–${catisma.psalmi[catisma.psalmi.length-1].num} · ${catisma.psalmi.length} psalmi</div>
          <div class="catisma-progress-mini">
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <span class="catisma-item-arrow">›</span>
      </div>
      <div class="psalm-sublist">
        ${catisma.psalmi.map(psalm => {
          const ppct = getPsalmPercent(catisma.num, psalm.num, psalm.verses.length);
          return `
          <div class="psalm-subitem" onclick="openPsalmSheet(${catisma.num}, ${psalm.num})">
            <span class="psalm-subitem-num">Ps. ${psalm.num}</span>
            <span class="psalm-subitem-text">${psalm.subtitle || `Psalmul ${psalm.num}`}</span>
            <span class="psalm-subitem-check">${ppct === 100 ? '✓' : ppct > 0 ? ppct+'%' : ''}</span>
          </div>`;
        }).join('')}
        <div class="special-subitem" onclick="openSection(${catisma.num}, 'tropare')">
          <span class="special-subitem-icon">🕊️</span>
          <span class="special-subitem-label">Tropare de umilinta</span>
        </div>
        <div class="special-subitem" onclick="openSection(${catisma.num}, 'rugaciune')">
          <span class="special-subitem-icon">🙏</span>
          <span class="special-subitem-label">Rugaciunea Catismei</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleCatisma(num) {
  const el = document.querySelector(`.catisma-item[data-catisma="${num}"]`);
  el.classList.toggle('open');
}

/* ══════════════════════
   OPEN PSALM / SECTION
══════════════════════ */
function openPsalmSheet(catisma_num, psalm_num) {
  const catisma = DB.find(c => c.num === catisma_num);
  const psalm = catisma.psalmi.find(p => p.num === psalm_num);

  STATE.session.current_catisma = catisma_num;
  STATE.session.current_psalm = psalm_num;
  STATE.session.current_section = 'psalm';
  STATE.session.current_verse_idx = 0;
  STATE.session.verse_start_time = null;
  STATE.session.streak_session = 0;

  // Show difficulty selector first
  showDifficultySheet(catisma, psalm);
}

function openSection(catisma_num, section) {
  STATE.session.current_catisma = catisma_num;
  STATE.session.current_section = section;
  renderReadingScreen(catisma_num, null, section);
  navigate('invatare');
}

/* ══════════════════════
   DIFFICULTY SHEET
══════════════════════ */
function showDifficultySheet(catisma, psalm) {
  const overlay = document.getElementById('overlay-difficulty');
  overlay.classList.add('open');

  // Show rugaciune intro
  document.getElementById('rugaciune-intro-text').textContent = CFG.RUGACIUNE_INTRO;

  // Mode selector already in HTML
  // Pre-select verset
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.diff-card[data-diff="verset"]')?.classList.add('selected');
  STATE.session.difficulty = 'verset';
  STATE.session.learn_mode = 'citire';
}

function selectDifficulty(diff) {
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.diff-card[data-diff="${diff}"]`)?.classList.add('selected');
  STATE.session.difficulty = diff;
}

function startLearning() {
  document.getElementById('overlay-difficulty').classList.remove('open');
  const catisma = DB.find(c => c.num === STATE.session.current_catisma);
  const psalm = catisma.psalmi.find(p => p.num === STATE.session.current_psalm);
  renderReadingScreen(STATE.session.current_catisma, STATE.session.current_psalm, 'psalm');
  navigate('invatare');
  checkAndUpdateStreak();
}

/* ══════════════════════
   RENDER READING/LEARNING SCREEN
══════════════════════ */
function renderReadingScreen(catisma_num, psalm_num, section) {
  const catisma = DB.find(c => c.num === catisma_num);
  let psalm = psalm_num ? catisma.psalmi.find(p => p.num === psalm_num) : null;

  const headerEl = document.getElementById('reading-psalm-num');
  const titleEl  = document.getElementById('reading-psalm-title');
  const subtitleEl = document.getElementById('reading-psalm-subtitle');
  const versesEl = document.getElementById('verses-container');
  const tabsEl   = document.getElementById('reading-mode-tabs');

  if (section === 'tropare') {
    headerEl.textContent = `Catisma ${catisma.name}`;
    titleEl.textContent = 'Tropare de umilinta';
    subtitleEl.textContent = '';
    tabsEl.style.display = 'none';
    versesEl.innerHTML = `
      <div class="text-bloc">
        <div class="text-bloc-title">✦ Tropare dupa Catisma ${catisma.name} ✦</div>
        <div class="text-bloc-content">${escHtml(catisma.tropare)}</div>
      </div>`;
    return;
  }

  if (section === 'rugaciune') {
    headerEl.textContent = `Catisma ${catisma.name}`;
    titleEl.textContent = 'Rugaciunea Catismei';
    subtitleEl.textContent = '';
    tabsEl.style.display = 'none';
    versesEl.innerHTML = `
      <div class="text-bloc">
        <div class="text-bloc-title">✦ Rugaciunea dupa Catisma ${catisma.name} ✦</div>
        <div class="text-bloc-content">${escHtml(catisma.rugaciune)}</div>
      </div>`;
    return;
  }

  // Psalm
  tabsEl.style.display = 'flex';
  headerEl.textContent = `Catisma ${catisma.name} · Psalmul ${psalm.num}`;
  titleEl.textContent  = `Psalmul ${psalm.num}`;
  subtitleEl.textContent = psalm.subtitle || '';

  const mode = STATE.session.learn_mode;

  if (mode === 'citire') {
    renderLectio(psalm, catisma_num);
  } else if (mode === 'completare') {
    renderCompletare(psalm, catisma_num, 'half');
  } else if (mode === 'prima_litera') {
    renderCompletare(psalm, catisma_num, 'firstletter');
  } else if (mode === 'scriere') {
    renderScriere(psalm, catisma_num);
  } else if (mode === 'ordine') {
    renderOrdine(psalm, catisma_num);
  }
}

function renderLectio(psalm, catisma_num) {
  const el = document.getElementById('verses-container');
  const diff = STATE.session.difficulty;

  let html = '';
  for (const verse of psalm.verses) {
    const prog = getProgress(catisma_num, psalm.num);
    const memorized = prog.versete_memorate.has(verse.n);
    const firstWord = verse.text.charAt(0);
    const rest = verse.text.slice(1);
    html += `
    <div class="verse-lectio">
      <span class="verse-num">${verse.n}.</span>
      <span class="verse-text">
        <span class="first-letter">${escHtml(firstWord)}</span>${escHtml(rest)}
      </span>
    </div>`;
  }

  // Doxologie dupa psalm
  html += `<div class="doxologie">Slavă Tatălui și Fiului și Sfântului Duh și acum și pururea și în vecii vecilor. Amin.<br>Aliluia, Aliluia, Aliluia, slavă Ție, Dumnezeule. (×3)<br>Doamne miluiește. (×3)</div>`;

  el.innerHTML = html;
}

function renderCompletare(psalm, catisma_num, hintType) {
  const el = document.getElementById('verses-container');
  const verse = psalm.verses[STATE.session.current_verse_idx];
  if (!verse) { renderVerseComplete(psalm, catisma_num); return; }

  STATE.session.verse_start_time = Date.now();

  let displayText = '';
  if (hintType === 'half') {
    // Show first half of words
    const words = verse.text.split(' ');
    const showCount = Math.ceil(words.length / 2);
    displayText = words.slice(0, showCount).join(' ') + ' <span class="word-blank">…</span>';
  } else {
    // First letter hints
    displayText = verse.text.split(' ').map(w => {
      const clean = w.replace(/[",!?.:;]/g, '');
      return `<span class="hint-word"><span class="hint-letter">${escHtml(w[0] || '')}</span><span class="hint-dots">···</span></span>`;
    }).join(' ');
  }

  const total = psalm.verses.length;
  const current = STATE.session.current_verse_idx + 1;

  el.innerHTML = `
    <div class="learn-mode-label">
      <span>Verset ${current} din ${total}</span>
      <span class="streak-badge">🔥 ${STATE.session.streak_session}</span>
    </div>
    <div class="patience-bar"><div class="patience-fill" id="patience-fill" style="width:0%"></div></div>
    <div class="learn-verse-card" id="learn-card">
      <div class="learn-verse-display">${displayText}</div>
      <div class="learn-input-area">
        <textarea id="verse-input" class="learn-textarea" placeholder="Scrie versetul complet…" rows="3"
          oninput="updatePatienceBar()"></textarea>
        <div class="learn-actions">
          <button class="btn-check" onclick="checkVerse(${catisma_num}, ${psalm.num}, ${verse.n})">Verifică</button>
          <button class="btn-hint" onclick="showFullHint(${psalm.num}, ${verse.n})">Indiciu</button>
          <button class="btn-hint" onclick="skipVerse(${catisma_num}, ${psalm.num})">Sari</button>
        </div>
      </div>
    </div>
    <div class="text-center mt-2" style="font-family:var(--font-text);font-size:0.75rem;color:var(--text-muted);font-style:italic;">
      Mult ai răbdat, ${CFG.RANKS[0].name}… 
    </div>`;

  startPatienceTimer();
}

let patienceInterval = null;
let patienceSeconds = 0;

function startPatienceTimer() {
  clearInterval(patienceInterval);
  patienceSeconds = 0;
  patienceInterval = setInterval(() => {
    patienceSeconds++;
    const fill = document.getElementById('patience-fill');
    if (fill) fill.style.width = Math.min(patienceSeconds * 2, 100) + '%';
  }, 1000);
}

function updatePatienceBar() {
  // nothing extra needed - timer handles it
}

function renderScriere(psalm, catisma_num) {
  const el = document.getElementById('verses-container');
  const verse = psalm.verses[STATE.session.current_verse_idx];
  if (!verse) { renderVerseComplete(psalm, catisma_num); return; }

  STATE.session.verse_start_time = Date.now();
  const total = psalm.verses.length;
  const current = STATE.session.current_verse_idx + 1;

  el.innerHTML = `
    <div class="learn-mode-label">
      <span>Scrie din memorie · Verset ${current}/${total}</span>
      <span class="streak-badge">🔥 ${STATE.session.streak_session}</span>
    </div>
    <div class="patience-bar"><div class="patience-fill" id="patience-fill" style="width:0%"></div></div>
    <div class="learn-verse-card manuscript-mode" id="learn-card">
      <div class="learn-verse-display" style="font-size:0.85rem;color:var(--text-muted);">
        Psalmul ${psalm.num}, versetul ${verse.n}
      </div>
      <div class="learn-input-area">
        <textarea id="verse-input" class="learn-textarea" placeholder="Scrie versetul din memorie…" rows="4"></textarea>
        <div class="learn-actions">
          <button class="btn-check" onclick="checkVerse(${catisma_num}, ${psalm.num}, ${verse.n})">Verifică</button>
          <button class="btn-hint" onclick="showFullHint(${psalm.num}, ${verse.n})">Văd textul</button>
        </div>
      </div>
    </div>`;

  startPatienceTimer();
}

function renderOrdine(psalm, catisma_num) {
  const el = document.getElementById('verses-container');

  if (!STATE.session.shuffled) {
    STATE.session.order_verses = [...psalm.verses].sort(() => Math.random() - 0.5);
    STATE.session.shuffled = true;
  }

  el.innerHTML = `
    <div class="learn-mode-label" style="margin-bottom:10px;">
      Trage versetele în ordinea corectă
    </div>
    <div id="order-list">
      ${STATE.session.order_verses.map((v, i) => `
        <div class="order-verse" draggable="true" data-verse-n="${v.n}" data-idx="${i}">
          <span class="order-handle">☰</span>
          <span>${escHtml(v.text.slice(0, 80))}${v.text.length > 80 ? '…' : ''}</span>
        </div>`).join('')}
    </div>
    <button class="btn-primary mt-3" onclick="checkOrdine(${catisma_num}, ${psalm.num})">Verifică ordinea</button>`;

  initDragDrop();
}

function renderVerseComplete(psalm, catisma_num) {
  clearInterval(patienceInterval);
  const el = document.getElementById('verses-container');
  const pct = getPsalmPercent(catisma_num, psalm.num, psalm.verses.length);

  STATE.psalmi_memorati++;
  addPoints(CFG.POINTS.psalm_complete, 'Psalm complet! 📖');
  checkBadges();

  // Check catisma complete
  const catPct = getCatismaPercent(catisma_num);
  if (catPct === 100) {
    STATE.catisme_complete++;
    addPoints(CFG.POINTS.catisma_complete, `Catisma ${catisma_num} completa! 🏛️`);
    setTimeout(() => {
      showRankUp(getRank(STATE.points));
    }, 1000);
  }

  STATE.session.shuffled = false;
  saveState();

  el.innerHTML = `
    <div style="text-align:center;padding:40px 24px;">
      <div style="font-size:3rem;margin-bottom:16px;">✝️</div>
      <div style="font-family:var(--font-title);font-size:1rem;color:var(--brun);margin-bottom:8px;">Psalm complet!</div>
      <div style="font-family:var(--font-text);font-size:0.9rem;color:var(--text-muted);font-style:italic;line-height:1.7;margin-bottom:24px;">
        „Cânta-voi Domnului în viața mea, cânta-voi Dumnezeului meu cât voi fi."
      </div>
      <div style="font-family:var(--font-title);font-size:1.5rem;color:var(--aur);">+${CFG.POINTS.psalm_complete} puncte</div>
      <button class="btn-primary mt-3" onclick="navigate('catisme')">Înapoi la Catisme</button>
    </div>`;
}

/* ══════════════════════
   CHECK VERSE
══════════════════════ */
function normalizeText(s) {
  return s.toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[",!?.:;]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSimilarity(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1.0;
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  return intersection.length / Math.max(wordsA.size, wordsB.size);
}

function checkVerse(catisma_num, psalm_num, verse_n) {
  clearInterval(patienceInterval);
  const catisma = DB.find(c => c.num === catisma_num);
  const psalm   = catisma.psalmi.find(p => p.num === psalm_num);
  const verse   = psalm.verses.find(v => v.n === verse_n);

  const input = document.getElementById('verse-input');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText) { showToast('Scrie ceva mai intai...'); return; }

  // Patience calculation
  const elapsed = (Date.now() - STATE.session.verse_start_time) / 1000;
  const similarity = getSimilarity(userText, verse.text);
  const isCorrect = similarity >= 0.75;

  const card = document.getElementById('learn-card');

  if (isCorrect) {
    haptic('success');
    STATE.session.streak_session++;
    input.classList.add('correct');

    // Patience bonus/penalty
    let pts = CFG.POINTS.verse_correct;
    const multiplier = getStreakMultiplier();
    pts = Math.round(pts * multiplier);

    if (elapsed > 8 && elapsed < 60) {
      pts += CFG.POINTS.patience_bonus;
      STATE.patience_bonuses++;
      showToast(`+${CFG.POINTS.patience_bonus} Bonus Statornicie ⚖️`);
    } else if (elapsed < 3) {
      pts += CFG.POINTS.patience_rush_penalty;
      showToast(`${CFG.POINTS.patience_rush_penalty} Prea grabnic! ⚡`);
    }

    addPoints(pts, `Corect! ×${multiplier}`);
    markVerseMemorized(catisma_num, psalm_num, verse_n);

    // Check if in zidul
    markZidulVerse(catisma_num, psalm_num, verse_n);

    // Streak bonus
    const s = STATE.session.streak_session;
    if (s === 3)  addPoints(CFG.POINTS.streak_bonus_3, '🔥 Streak ×3!');
    if (s === 7)  addPoints(CFG.POINTS.streak_bonus_7, '⚡ Streak ×7!');
    if (s === 15) addPoints(CFG.POINTS.streak_bonus_15, '🌟 Streak ×15!');

    setTimeout(() => {
      STATE.session.current_verse_idx++;
      renderReadingScreen(catisma_num, psalm_num, 'psalm');
    }, 1200);

  } else {
    haptic('wrong');
    card?.classList.add('shake');
    input.classList.add('wrong');
    setTimeout(() => {
      card?.classList.remove('shake');
      input.classList.remove('wrong');
    }, 600);

    STATE.session.streak_session = 0;
    addPoints(CFG.POINTS.verse_wrong, 'Gresit 😔');
    addToZidul(catisma_num, psalm_num, verse);

    // Reset to beginning of psalm
    showToast('Reia psalmul de la inceput...');
    setTimeout(() => {
      STATE.session.current_verse_idx = 0;
      STATE.session.shuffled = false;
      renderReadingScreen(catisma_num, psalm_num, 'psalm');
    }, 1500);
  }
}

function showFullHint(psalm_num, verse_n) {
  const catisma = DB.find(c => c.psalmi.some(p => p.num === psalm_num));
  const psalm = catisma.psalmi.find(p => p.num === psalm_num);
  const verse = psalm.verses.find(v => v.n === verse_n);
  showToast(`"${verse.text.slice(0, 60)}…"`);
  addPoints(-3, 'Indiciu folosit');
}

function skipVerse(catisma_num, psalm_num) {
  STATE.session.current_verse_idx++;
  STATE.session.streak_session = 0;
  renderReadingScreen(catisma_num, psalm_num, 'psalm');
}

/* ══════════════════════
   CHECK ORDINE
══════════════════════ */
function checkOrdine(catisma_num, psalm_num) {
  const catisma = DB.find(c => c.num === catisma_num);
  const psalm   = catisma.psalmi.find(p => p.num === psalm_num);
  const currentOrder = [...document.querySelectorAll('#order-list .order-verse')]
    .map(el => parseInt(el.dataset.verseN));
  const correctOrder = psalm.verses.map(v => v.n);

  let correct = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (currentOrder[i] === correctOrder[i]) correct++;
  }

  const pct = Math.round((correct / correctOrder.length) * 100);
  if (pct >= 80) {
    haptic('success');
    addPoints(CFG.POINTS.psalm_complete, `Ordine corecta ${pct}%!`);
    psalm.verses.forEach(v => markVerseMemorized(catisma_num, psalm_num, v.n));
    setTimeout(() => renderVerseComplete(psalm, catisma_num), 500);
  } else {
    haptic('wrong');
    addPoints(CFG.POINTS.verse_wrong * 2, `Ordine gresita (${pct}%)`);
    STATE.session.shuffled = false;
    showToast(`${pct}% corect — incearca din nou`);
    setTimeout(() => renderOrdine(psalm, catisma_num), 800);
  }
}

/* ══════════════════════
   DRAG & DROP (ordine)
══════════════════════ */
function initDragDrop() {
  const list = document.getElementById('order-list');
  if (!list) return;

  let dragEl = null;
  let startY = 0;
  let startIdx = 0;

  list.addEventListener('touchstart', e => {
    const el = e.target.closest('.order-verse');
    if (!el) return;
    dragEl = el;
    dragEl.classList.add('dragging');
    startY = e.touches[0].clientY;
    startIdx = [...list.children].indexOf(el);
  }, { passive: true });

  list.addEventListener('touchmove', e => {
    if (!dragEl) return;
    const y = e.touches[0].clientY;
    const items = [...list.querySelectorAll('.order-verse:not(.dragging)')];
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        list.insertBefore(dragEl, item);
        break;
      }
    }
  }, { passive: true });

  list.addEventListener('touchend', () => {
    if (dragEl) dragEl.classList.remove('dragging');
    dragEl = null;
  });
}

/* ══════════════════════
   RENDER ZIDUL
══════════════════════ */
function renderZidul() {
  const el = document.getElementById('zidul-content');
  if (!STATE.zidul.length) {
    el.innerHTML = `
      <div class="zidul-empty">
        <div class="zidul-empty-icon">🏰</div>
        <div class="zidul-empty-text">Zidul de Incercare este gol.<br>Toate versetele au fost stapanite!</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-title">De repetat (${STATE.zidul.length} versete)</div>
    ${STATE.zidul.map(z => {
      const doneCount = z.dates_correct.length;
      const dots = [0,1,2].map(i => `<div class="zidul-day-dot ${i < doneCount ? 'done' : ''}"></div>`).join('');
      return `
      <div class="zidul-verse-card">
        <div class="zidul-verse-label">Ps. ${z.psalm} · Verset ${z.verse_n}</div>
        <div class="zidul-verse-text">${escHtml(z.verse_text.slice(0, 120))}…</div>
        <div class="zidul-verse-meta">
          <span>Necesar: 3 zile diferite</span>
          <div class="zidul-days">${dots}</div>
        </div>
        <button class="btn-secondary mt-2" onclick="practiceZidulVerse(${z.catisma}, ${z.psalm}, ${z.verse_n})" style="width:100%;">
          Exerseaza acum
        </button>
      </div>`;
    }).join('')}`;
}

function practiceZidulVerse(catisma_num, psalm_num, verse_n) {
  STATE.session.current_catisma = catisma_num;
  STATE.session.current_psalm = psalm_num;
  STATE.session.current_section = 'psalm';
  STATE.session.current_verse_idx = 0; // will navigate to this verse
  STATE.session.learn_mode = 'scriere';

  // Find verse index
  const catisma = DB.find(c => c.num === catisma_num);
  const psalm = catisma.psalmi.find(p => p.num === psalm_num);
  const idx = psalm.verses.findIndex(v => v.n === verse_n);
  STATE.session.current_verse_idx = Math.max(0, idx);

  navigate('invatare');
  renderReadingScreen(catisma_num, psalm_num, 'psalm');
}

/* ══════════════════════
   RENDER PROFIL
══════════════════════ */
function renderProfil() {
  const rank = getRank(STATE.points);
  document.getElementById('profil-avatar').textContent = rank.emoji;
  document.getElementById('profil-rank-name').textContent = rank.name;
  document.getElementById('profil-points-text').textContent = `${STATE.points} puncte acumulate`;
  document.getElementById('profil-streak-val').textContent = `🔥 ${STATE.streak} zile consecutive`;

  // Heatmap
  renderHeatmap();

  // Catisme progress
  const progList = document.getElementById('catisme-progress-list');
  progList.innerHTML = DB.map(c => {
    const pct = getCatismaPercent(c.num);
    return `
    <div class="catisma-prog-item">
      <div class="catisma-prog-header">
        <span>Catisma ${c.name}</span>
        <span class="catisma-prog-pct">${pct}%</span>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderHeatmap() {
  const el = document.getElementById('heatmap-grid');
  const cells = [];
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const val = STATE.heatmap[key] || 0;
    const cls = val >= 4 ? 'd4' : val >= 3 ? 'd3' : val >= 2 ? 'd2' : val >= 1 ? 'd1' : '';
    cells.push(`<div class="heatmap-cell ${cls}" title="${key}"></div>`);
  }
  el.innerHTML = cells.join('');
}

/* ══════════════════════
   SETARI
══════════════════════ */
function toggleTema() {
  STATE.tema = STATE.tema === 'lumina' ? 'noapte' : 'lumina';
  document.body.classList.toggle('tema-noapte', STATE.tema === 'noapte');
  saveState();
}

function toggleNotificari() {
  STATE.notificari = !STATE.notificari;
  if (STATE.notificari && 'Notification' in window) {
    Notification.requestPermission();
  }
  document.getElementById('toggle-notificari').classList.toggle('on', STATE.notificari);
  saveState();
}

/* ══════════════════════
   LEARN MODE TABS
══════════════════════ */
function setLearnMode(mode) {
  STATE.session.learn_mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.mode-tab[data-mode="${mode}"]`)?.classList.add('active');

  if (STATE.session.current_psalm && STATE.session.current_catisma) {
    STATE.session.current_verse_idx = 0;
    STATE.session.shuffled = false;
    renderReadingScreen(STATE.session.current_catisma, STATE.session.current_psalm, 'psalm');
  }
}

/* ══════════════════════
   UTILS
══════════════════════ */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════
   SERVICE WORKER
══════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/David/sw.js', { scope: '/David/' })
      .then(reg => {
        console.log('SW registered:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Actualizare disponibila — reincarca aplicatia');
            }
          });
        });
      })
      .catch(err => console.warn('SW error:', err));
  }
}

/* ══════════════════════
   INIT
══════════════════════ */
async function init() {
  // Load psalm data
  try {
    const resp = await fetch('/David/psaltire_data.json');
    DB = await resp.json();
  } catch(e) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:serif;">Eroare la incarcarea datelor. Verifica conexiunea.</div>';
    return;
  }

  // Load saved state
  loadState();

  // Apply theme
  if (STATE.tema === 'noapte') document.body.classList.add('tema-noapte');

  // Toggle notificari UI
  document.getElementById('toggle-notificari')?.classList.toggle('on', STATE.notificari);

  // Render
  renderAcasa();
  renderCatismeList();
  updateHeaderStats();

  // Nav events
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.screen));
  });

  // Mode tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => setLearnMode(tab.dataset.mode));
  });

  // Difficulty cards
  document.querySelectorAll('.diff-card').forEach(card => {
    card.addEventListener('click', () => selectDifficulty(card.dataset.diff));
  });

  // Overlay close
  document.getElementById('overlay-difficulty')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });

  // Diploma close
  document.getElementById('diploma-modal')?.addEventListener('click', e => {
    e.currentTarget.classList.remove('show');
  });

  // Catisma zilei button
  document.getElementById('btn-catisma-azi')?.addEventListener('click', () => {
    const catNr = getCatismaZilei();
    const catData = DB.find(c => c.num === catNr);
    if (catData && catData.psalmi.length) {
      navigate('catisme');
      // Auto-open catisma
      setTimeout(() => {
        const el = document.querySelector(`.catisma-item[data-catisma="${catNr}"]`);
        if (el) {
          el.classList.add('open');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  });

  // Check daily streak
  const isFirstToday = checkAndUpdateStreak();
  if (!isFirstToday) {
    // Already did today — just show points
  }

  // SW
  registerSW();

  console.log('✝ Psaltirea Mea initializata. Catisme:', DB.length, '| Psalmi:', DB.reduce((a,c)=>a+c.psalmi.length,0));
}

document.addEventListener('DOMContentLoaded', init);
