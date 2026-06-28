const APP_VERSION = "v35";
const STORAGE_KEY = "mpp-edge-state-v1";
const SYNC_KEY = "mpp-edge-sync-config-v1";
const CLIENT_KEY = "mpp-edge-client-id-v1";
const SYNC_FILE = "mpp-edge-sync.json";

const defaultState = {
  matches: [],
  deletedMatches: {},
  updatedAt: "",
  settings: {
    x2Threshold: 45,
    riskMode: "balanced",
    dixonColes: true,
  },
};

let state = loadState();
let syncConfig = loadSyncConfig();
let syncTimer = null;
// Push uniquement quand l'etat local a vraiment change : evite une ecriture
// de Gist toutes les 12 s (explosion du quota GitHub + revisions inutiles).
let stateDirty = false;
let syncCooldownUntil = 0;

function markDirty() {
  stateDirty = true;
}

function noteSyncError(error) {
  if (/rate limit/i.test(error?.message || "")) {
    syncCooldownUntil = Date.now() + 15 * 60 * 1000;
  }
}

const els = {
  appVersion: document.querySelector("#appVersion"),
  syncBadge: document.querySelector("#syncBadge"),
  totalEv: document.querySelector("#totalEv"),
  realPoints: document.querySelector("#realPoints"),
  hitRate: document.querySelector("#hitRate"),
  x2Status: document.querySelector("#x2Status"),
  x2Hint: document.querySelector("#x2Hint"),
  matchCount: document.querySelector("#matchCount"),
  matchList: document.querySelector("#matchList"),
  perfPanel: document.querySelector("#perfPanel"),
  perfSummary: document.querySelector("#perfSummary"),
  perfBars: document.querySelector("#perfBars"),
  perfCum: document.querySelector("#perfCum"),
  emptyState: document.querySelector("#emptyState"),
  matchFilter: document.querySelector("#matchFilter"),
  addMatchButton: document.querySelector("#addMatchButton"),
  openImportButton: document.querySelector("#openImportButton"),
  settingsButton: document.querySelector("#settingsButton"),
  matchDialog: document.querySelector("#matchDialog"),
  matchForm: document.querySelector("#matchForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeMatchDialog: document.querySelector("#closeMatchDialog"),
  deleteMatchButton: document.querySelector("#deleteMatchButton"),
  recomputeButton: document.querySelector("#recomputeButton"),
  matchPreview: document.querySelector("#matchPreview"),
  importDialog: document.querySelector("#importDialog"),
  closeImportDialog: document.querySelector("#closeImportDialog"),
  importKind: document.querySelector("#importKind"),
  importMatch: document.querySelector("#importMatch"),
  imageInput: document.querySelector("#imageInput"),
  runOcrButton: document.querySelector("#runOcrButton"),
  ocrProgress: document.querySelector("#ocrProgress"),
  importText: document.querySelector("#importText"),
  importPreview: document.querySelector("#importPreview"),
  previewImportButton: document.querySelector("#previewImportButton"),
  applyImportButton: document.querySelector("#applyImportButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  closeSettingsDialog: document.querySelector("#closeSettingsDialog"),
  x2Threshold: document.querySelector("#x2Threshold"),
  riskMode: document.querySelector("#riskMode"),
  dixonColes: document.querySelector("#dixonColes"),
  syncToken: document.querySelector("#syncToken"),
  syncGistId: document.querySelector("#syncGistId"),
  autoSync: document.querySelector("#autoSync"),
  saveSyncButton: document.querySelector("#saveSyncButton"),
  magicLinkButton: document.querySelector("#magicLinkButton"),
  createGistButton: document.querySelector("#createGistButton"),
  pullSyncButton: document.querySelector("#pullSyncButton"),
  pushSyncButton: document.querySelector("#pushSyncButton"),
  syncStatus: document.querySelector("#syncStatus"),
  exportDataButton: document.querySelector("#exportDataButton"),
  importDataInput: document.querySelector("#importDataInput"),
  resetDataButton: document.querySelector("#resetDataButton"),
  template: document.querySelector("#matchCardTemplate"),
};

const fields = {
  matchId: document.querySelector("#matchId"),
  homeTeam: document.querySelector("#homeTeam"),
  awayTeam: document.querySelector("#awayTeam"),
  kickoff: document.querySelector("#kickoff"),
  mppHome: document.querySelector("#mppHome"),
  mppDraw: document.querySelector("#mppDraw"),
  mppAway: document.querySelector("#mppAway"),
  publicHome: document.querySelector("#publicHome"),
  publicDraw: document.querySelector("#publicDraw"),
  publicAway: document.querySelector("#publicAway"),
  oddsHome: document.querySelector("#oddsHome"),
  oddsDraw: document.querySelector("#oddsDraw"),
  oddsAway: document.querySelector("#oddsAway"),
  knockout: document.querySelector("#knockout"),
  qualHome: document.querySelector("#qualHome"),
  qualAway: document.querySelector("#qualAway"),
  winHome90: document.querySelector("#winHome90"),
  winAway90: document.querySelector("#winAway90"),
  winHomeEt: document.querySelector("#winHomeEt"),
  winAwayEt: document.querySelector("#winAwayEt"),
  winHomePens: document.querySelector("#winHomePens"),
  winAwayPens: document.querySelector("#winAwayPens"),
  totalLine: document.querySelector("#totalLine"),
  over25: document.querySelector("#over25"),
  under25: document.querySelector("#under25"),
  bttsYes: document.querySelector("#bttsYes"),
  bttsNo: document.querySelector("#bttsNo"),
  homeLine: document.querySelector("#homeLine"),
  homeOver: document.querySelector("#homeOver"),
  homeUnder: document.querySelector("#homeUnder"),
  awayLine: document.querySelector("#awayLine"),
  awayOver: document.querySelector("#awayOver"),
  awayUnder: document.querySelector("#awayUnder"),
  rarityBonusText: document.querySelector("#rarityBonusText"),
  playedHome: document.querySelector("#playedHome"),
  playedAway: document.querySelector("#playedAway"),
  actualHome: document.querySelector("#actualHome"),
  actualAway: document.querySelector("#actualAway"),
  actualBonus: document.querySelector("#actualBonus"),
  x2Used: document.querySelector("#x2Used"),
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      matches: Array.isArray(parsed.matches) ? parsed.matches.map(normalizeMatchRecord) : [],
      deletedMatches: parsed.deletedMatches && typeof parsed.deletedMatches === "object" ? parsed.deletedMatches : {},
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeMatchRecord(match) {
  if (!match || typeof match !== "object") return match;
  const { correctScoreText: _unusedCorrectScoreText, ...rest } = match;
  return rest;
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSyncConfig() {
  try {
    const saved = localStorage.getItem(SYNC_KEY);
    if (!saved) return { token: "", gistId: "", autoSync: false, lastSyncAt: "", lastError: "" };
    const parsed = JSON.parse(saved);
    return {
      token: parsed.token || "",
      gistId: parsed.gistId || "",
      autoSync: Boolean(parsed.autoSync),
      lastSyncAt: parsed.lastSyncAt || "",
      lastError: parsed.lastError || "",
    };
  } catch {
    return { token: "", gistId: "", autoSync: false, lastSyncAt: "", lastError: "" };
  }
}

function saveSyncConfig() {
  localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
  renderSyncBadge();
}

function renderSyncBadge() {
  if (!els.syncBadge) return;
  if (!syncConfig.gistId || !syncConfig.token) {
    els.syncBadge.textContent = "synchro off";
    els.syncBadge.classList.remove("err");
    return;
  }
  if (syncInFlight) {
    els.syncBadge.textContent = "synchro...";
    return;
  }
  if (Date.now() < syncCooldownUntil) {
    const minutes = Math.max(1, Math.ceil((syncCooldownUntil - Date.now()) / 60000));
    els.syncBadge.classList.add("err");
    els.syncBadge.textContent = `pause API ${minutes} min`;
    return;
  }
  els.syncBadge.classList.toggle("err", Boolean(syncConfig.lastError));
  if (syncConfig.lastError) {
    els.syncBadge.textContent = "synchro KO";
    return;
  }
  if (!syncConfig.lastSyncAt) {
    els.syncBadge.textContent = "jamais synchro";
    return;
  }
  const seconds = Math.max(0, Math.round((Date.now() - new Date(syncConfig.lastSyncAt).getTime()) / 1000));
  els.syncBadge.textContent =
    seconds < 8 ? "synchro OK" : seconds < 60 ? `synchro ${seconds}s` : `synchro ${Math.round(seconds / 60)} min`;
}

function getClientId() {
  let clientId = localStorage.getItem(CLIENT_KEY);
  if (!clientId) {
    clientId = uid();
    localStorage.setItem(CLIENT_KEY, clientId);
  }
  return clientId;
}

function uid() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value * 100, digits)}%`;
}

function datetimeLabel(value) {
  if (!value) return "Heure a definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Heure a definir";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeOdds(odds) {
  const entries = Object.entries(odds).filter(([, odd]) => Number.isFinite(odd) && odd > 1);
  if (!entries.length) {
    return { probabilities: {}, raw: {}, overround: null, trj: null };
  }

  const raw = {};
  let overround = 0;
  for (const [key, odd] of entries) {
    raw[key] = 1 / odd;
    overround += raw[key];
  }

  const probabilities = {};
  for (const [key] of entries) {
    probabilities[key] = raw[key] / overround;
  }

  return {
    probabilities,
    raw,
    overround,
    trj: 1 / overround,
  };
}

function poissonPmf(lambda, k) {
  if (!Number.isFinite(lambda) || lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) result *= lambda / i;
  return result;
}

function poissonCdf(lambda, k) {
  let sum = 0;
  for (let i = 0; i <= k; i += 1) sum += poissonPmf(lambda, i);
  return sum;
}

function solveLambdaForOver(line, probability) {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null;
  const floor = Math.floor(line);
  let low = 0.02;
  let high = 8;
  for (let i = 0; i < 70; i += 1) {
    const mid = (low + high) / 2;
    const over = 1 - poissonCdf(mid, floor);
    if (over < probability) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// Dixon-Coles : le foot reel a une correlation que le Poisson independant
// ignore -> 0-0 et 1-1 sont plus frequents, 1-0 et 0-1 un peu moins. rho < 0
// gonfle les nuls a faible score. rho = 0 redonne le Poisson pur.
const DC_RHO = -0.13;

function dcTau(home, away, lambdaHome, lambdaAway, rho) {
  if (!rho) return 1;
  if (home === 0 && away === 0) return Math.max(0, 1 - lambdaHome * lambdaAway * rho);
  if (home === 0 && away === 1) return Math.max(0, 1 + lambdaHome * rho);
  if (home === 1 && away === 0) return Math.max(0, 1 + lambdaAway * rho);
  if (home === 1 && away === 1) return Math.max(0, 1 - rho);
  return 1;
}

function scoreDistribution(lambdaHome, lambdaAway, maxGoals = 8, rho = 0) {
  const homeP = Array.from({ length: maxGoals + 1 }, (_, goal) => poissonPmf(lambdaHome, goal));
  const awayP = Array.from({ length: maxGoals + 1 }, (_, goal) => poissonPmf(lambdaAway, goal));

  // La correction casse la separabilite : on pondere la matrice puis on
  // renormalise sur la somme reelle (identique au Poisson pur quand rho = 0).
  const grid = [];
  let total = 0;
  for (let home = 0; home <= maxGoals; home += 1) {
    for (let away = 0; away <= maxGoals; away += 1) {
      const p = homeP[home] * awayP[away] * dcTau(home, away, lambdaHome, lambdaAway, rho);
      grid.push({ home, away, p });
      total += p;
    }
  }

  return grid.map((g) => ({ home: g.home, away: g.away, probability: total > 0 ? g.p / total : 0 }));
}

function outcomeFromScore(home, away) {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function outcomeLabel(key) {
  return key === "home" ? "1" : key === "draw" ? "N" : "2";
}

function calculatePoissonOutcomes(lambdaHome, lambdaAway, rho = 0) {
  const scores = scoreDistribution(lambdaHome, lambdaAway, 9, rho);
  return scores.reduce(
    (acc, score) => {
      acc[outcomeFromScore(score.home, score.away)] += score.probability;
      acc.totalOver25 += score.home + score.away > 2.5 ? score.probability : 0;
      acc.btts += score.home > 0 && score.away > 0 ? score.probability : 0;
      return acc;
    },
    { home: 0, draw: 0, away: 0, totalOver25: 0, btts: 0 },
  );
}

function fitLambdas(match, marketProbabilities) {
  const totalMarket = normalizeOdds({
    over: match.markets?.over25,
    under: match.markets?.under25,
  });
  const bttsMarket = normalizeOdds({
    yes: match.markets?.bttsYes,
    no: match.markets?.bttsNo,
  });
  // Lignes par equipe flexibles (0.5/1.5/2.5...). Compat avec l'ancien format
  // fige a 1.5 (domicile) et 0.5 (exterieur).
  const homeLine = Number.isFinite(match.markets?.homeLine) ? match.markets.homeLine : 1.5;
  const awayLine = Number.isFinite(match.markets?.awayLine) ? match.markets.awayLine : 0.5;
  const homeTotal = normalizeOdds({
    over: match.markets?.homeOver ?? match.markets?.homeOver15,
    under: match.markets?.homeUnder ?? match.markets?.homeUnder15,
  });
  const awayTotal = normalizeOdds({
    over: match.markets?.awayOver ?? match.markets?.awayOver05,
    under: match.markets?.awayUnder ?? match.markets?.awayUnder05,
  });

  const totalLine = Number.isFinite(match.markets?.totalLine) ? match.markets.totalLine : 2.5;
  const targetTotal = solveLambdaForOver(totalLine, totalMarket.probabilities.over);
  const targetHome = solveLambdaForOver(homeLine, homeTotal.probabilities.over);
  const targetAway = solveLambdaForOver(awayLine, awayTotal.probabilities.over);

  let best = null;
  const candidateHome = [];
  const candidateAway = [];

  for (let h = 0.15; h <= 4.5; h += 0.05) candidateHome.push(Number(h.toFixed(2)));
  for (let a = 0.08; a <= 3.5; a += 0.05) candidateAway.push(Number(a.toFixed(2)));

  const rho = state.settings.dixonColes ? DC_RHO : 0;
  for (const lambdaHome of candidateHome) {
    for (const lambdaAway of candidateAway) {
      const out = calculatePoissonOutcomes(lambdaHome, lambdaAway, rho);
      let error = 0;

      if (Number.isFinite(marketProbabilities.home)) error += 5 * (out.home - marketProbabilities.home) ** 2;
      if (Number.isFinite(marketProbabilities.draw)) error += 5 * (out.draw - marketProbabilities.draw) ** 2;
      if (Number.isFinite(marketProbabilities.away)) error += 5 * (out.away - marketProbabilities.away) ** 2;
      if (Number.isFinite(targetTotal)) error += 1.8 * (lambdaHome + lambdaAway - targetTotal) ** 2;
      if (Number.isFinite(targetHome)) error += 1.4 * (lambdaHome - targetHome) ** 2;
      if (Number.isFinite(targetAway)) error += 1.4 * (lambdaAway - targetAway) ** 2;
      if (Number.isFinite(bttsMarket.probabilities.yes)) error += 1.2 * (out.btts - bttsMarket.probabilities.yes) ** 2;

      if (!best || error < best.error) best = { lambdaHome, lambdaAway, error };
    }
  }

  return best || { lambdaHome: 1.35, lambdaAway: 1.05, error: null };
}

function parseScoreValueLines(text) {
  // Virgule -> point partout : gere les separateurs ("0, Suisse 0") et les
  // valeurs a decimale europeenne ("17,980").
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/,/g, ".").trim())
    .filter(Boolean);

  const withOddsDash = /(?:^|\D)(\d{1,2})\s*[-:]\s*(\d{1,2})\D+(\d+(?:\.\d+)?)\D*$/;
  const withOddsLoose = /(?:^|\D)(\d{1,2})\D+(\d{1,2})\D+(\d+(?:\.\d+)?)\D*$/;
  const scoreOnly = /(?:^|\D)(\d{1,2})\D+(\d{1,2})\s*$/;
  const oddOnly = /^(\d+(?:\.\d+)?)$/;

  const rows = [];
  const scoresQueue = [];
  const oddsQueue = [];
  const valid = (home, away, odd) =>
    Number.isFinite(home) && Number.isFinite(away) && home <= 9 && away <= 9 && Number.isFinite(odd) && odd > 1;

  for (const line of lines) {
    // Ligne purement numerique = une cote isolee (colonne de droite d'un
    // tableau a deux colonnes).
    const lone = line.match(oddOnly);
    if (lone) {
      if (Number(lone[1]) > 1) oddsQueue.push(Number(lone[1]));
      continue;
    }
    const m = line.match(withOddsDash) || line.match(withOddsLoose);
    if (m && valid(Number(m[1]), Number(m[2]), Number(m[3]))) {
      rows.push({ home: Number(m[1]), away: Number(m[2]), odd: Number(m[3]) });
      continue;
    }
    const s = line.match(scoreOnly);
    if (s && Number(s[1]) <= 9 && Number(s[2]) <= 9) scoresQueue.push({ home: Number(s[1]), away: Number(s[2]) });
  }

  // Tableau a deux colonnes : scores et valeurs sur des lignes separees, qu'ils
  // soient entrelaces (score, valeur, score, valeur) ou groupes par l'OCR
  // (tous les scores puis toutes les valeurs). On apparie dans l'ordre.
  const pairs = Math.min(scoresQueue.length, oddsQueue.length);
  for (let i = 0; i < pairs; i += 1) {
    const s = scoresQueue[i];
    if (valid(s.home, s.away, oddsQueue[i])) rows.push({ home: s.home, away: s.away, odd: oddsQueue[i] });
  }

  const unique = new Map();
  for (const row of rows) unique.set(`${row.home}-${row.away}`, row);
  return [...unique.values()];
}

function normalizePublicSplit(split) {
  if (!split) return null;
  const home = Number(split.home);
  const draw = Number(split.draw);
  const away = Number(split.away);
  if (![home, draw, away].every((value) => Number.isFinite(value) && value >= 0)) return null;
  const sum = home + draw + away;
  if (sum <= 0) return null;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

function estimateBonus(score, scoreProbability, issueProbability, riskMode, issuePickShare) {
  if (!Number.isFinite(scoreProbability) || !Number.isFinite(issueProbability) || issueProbability <= 0) return 20;
  const conditional = scoreProbability / issueProbability;
  const home = score.home;
  const away = score.away;
  const total = home + away;
  const outcome = outcomeFromScore(home, away);
  let bias = 1;

  if (outcome === "home") {
    if ((home === 1 && away === 0) || (home === 2 && away === 0)) bias *= 1.35;
    if (home === 2 && away === 1) bias *= 1.18;
    if (home >= 3 && away === 0) bias *= 0.78;
    if (home >= 4) bias *= 0.55;
  }

  if (outcome === "draw") {
    if (home === 1 && away === 1) bias *= 1.55;
    if (home === 0 && away === 0) bias *= 1.15;
    if (home >= 2) bias *= 0.62;
  }

  if (outcome === "away") {
    if ((home === 0 && away === 1) || (home === 1 && away === 2)) bias *= 1.15;
    if (away >= 3) bias *= 0.7;
  }

  if (total >= 4) bias *= 0.82;
  if (riskMode === "conservative") bias *= 1.18;
  if (riskMode === "aggressive") bias *= 0.82;

  // Avec le % public MPP (repartition reelle des pronos par issue), la part
  // estimee devient: part de l'issue x concentration sur ce score.
  const withinIssue = Math.min(0.95, conditional * bias);
  const estimatedPublicShare = Number.isFinite(issuePickShare) ? issuePickShare * withinIssue : withinIssue;
  if (estimatedPublicShare > 0.3) return 20;
  if (estimatedPublicShare > 0.2) return 30;
  if (estimatedPublicShare > 0.05) return 50;
  if (estimatedPublicShare > 0.005) return 70;
  return 100;
}

const calcCache = new Map();

function calcSignature(match) {
  return JSON.stringify([
    match.mpp,
    match.odds,
    match.markets,
    match.rarityBonusText,
    match.publicSplit,
    match.played,
    match.actual,
    match.x2Used,
    match.knockout,
    match.qual,
    match.victoryMode,
    state.settings.riskMode,
    state.settings.dixonColes,
  ]);
}

// Le fit du modele de buts est couteux (recherche sur ~6000 combinaisons par
// match). On memorise le resultat et on ne recalcule un match que si ses
// donnees (ou le mode de risque) ont change : les re-rendus de la synchro
// auto toutes les 12 s redeviennent quasi gratuits.
function calculateMatch(match) {
  const sig = calcSignature(match);
  const cached = match.id ? calcCache.get(match.id) : null;
  if (cached && cached.sig === sig) return cached.calc;
  const calc = computeMatch(match);
  if (match.id) calcCache.set(match.id, { sig, calc });
  return calc;
}

// Prolongation = 30 min = 1/3 d'un match de 90 min : meme ratio de force, buts
// attendus reduits au tiers.
function extraTimeScores(lambdaHome, lambdaAway, rho) {
  return scoreDistribution(lambdaHome / 3, lambdaAway / 3, 6, rho);
}

// Issues a 120 min : la cote de qualification donne le partage equipe 1 / equipe
// 2 (tirs au but ~ 50/50 qui s'annulent), le modele de buts donne la part de nul
// qui survit a la prolongation.
function knockoutOutcomeProbs(scores90, lambdas, qual, rho) {
  const draw90 = scores90.reduce((sum, s) => sum + (s.home === s.away ? s.probability : 0), 0);
  const etDraw = extraTimeScores(lambdas.lambdaHome, lambdas.lambdaAway, rho).reduce(
    (sum, s) => sum + (s.home === s.away ? s.probability : 0),
    0,
  );
  const draw120 = draw90 * etDraw;
  const home = Math.max(0, qual.home - draw120 / 2);
  const away = Math.max(0, qual.away - draw120 / 2);
  const total = home + draw120 + away || 1;
  return { home: home / total, draw: draw120 / total, away: away / total };
}

// Distribution des scores a 120 min : les matchs decides en 90 gardent leur
// score, les nuls a 90 se voient ajouter l'increment de prolongation.
function build120Scores(scores90, lambdas, rho) {
  const et = extraTimeScores(lambdas.lambdaHome, lambdas.lambdaAway, rho);
  const map = new Map();
  const add = (home, away, p) => map.set(`${home}-${away}`, (map.get(`${home}-${away}`) || 0) + p);
  for (const s of scores90) {
    if (s.home !== s.away) add(s.home, s.away, s.probability);
    else for (const e of et) add(s.home + e.home, s.away + e.away, s.probability * e.probability);
  }
  return [...map.entries()].map(([key, p]) => {
    const [home, away] = key.split("-").map(Number);
    return { home, away, probability: p };
  });
}

function victoryModeOutcomeProbs(mode) {
  const market = normalizeOdds({
    home90: mode?.home90,
    away90: mode?.away90,
    homeEt: mode?.homeEt,
    awayEt: mode?.awayEt,
    homePens: mode?.homePens,
    awayPens: mode?.awayPens,
  });
  const p = market.probabilities;
  const ready = ["home90", "away90", "homeEt", "awayEt", "homePens", "awayPens"].every((key) =>
    Number.isFinite(p[key]),
  );
  if (!ready) return { probabilities: null, market };
  return {
    probabilities: {
      home: p.home90 + p.homeEt,
      draw: p.homePens + p.awayPens,
      away: p.away90 + p.awayEt,
    },
    market,
  };
}

function computeMatch(match) {
  const resultMarket = normalizeOdds(match.odds || {});
  const probabilities = resultMarket.probabilities;
  const points = match.mpp || {};
  const rho = state.settings.dixonColes ? DC_RHO : 0;

  const lambdas = fitLambdas(match, probabilities);
  const poissonScores = scoreDistribution(lambdas.lambdaHome, lambdas.lambdaAway, 8, rho);

  // Mode elimination directe : le score a 120 min fait foi.
  const qual = normalizeOdds({ home: match.qual?.home, away: match.qual?.away }).probabilities;
  const victoryMode = victoryModeOutcomeProbs(match.victoryMode);
  const knockoutRequested = Boolean(match.knockout);
  const victoryModeReady = Boolean(victoryMode.probabilities);
  const qualReady = Number.isFinite(qual.home) && Number.isFinite(qual.away);
  const knockout = knockoutRequested && (victoryModeReady || qualReady);
  let knockoutSource = "";
  let outcomeProbs = probabilities;
  let baseScores = poissonScores;
  if (knockout) {
    outcomeProbs = victoryModeReady
      ? victoryMode.probabilities
      : knockoutOutcomeProbs(poissonScores, lambdas, qual, rho);
    knockoutSource = victoryModeReady ? "mode-victory" : "qualification";
    const scores120 = build120Scores(poissonScores, lambdas, rho);
    const modelByIssue = { home: 0, draw: 0, away: 0 };
    for (const s of scores120) modelByIssue[outcomeFromScore(s.home, s.away)] += s.probability;
    baseScores = scores120.map((s) => {
      const issue = outcomeFromScore(s.home, s.away);
      const scale = modelByIssue[issue] > 0 ? outcomeProbs[issue] / modelByIssue[issue] : 0;
      return { ...s, probability: s.probability * scale };
    });
  }

  const issueEv = {
    home: Number.isFinite(outcomeProbs.home) && Number.isFinite(points.home) ? outcomeProbs.home * points.home : null,
    draw: Number.isFinite(outcomeProbs.draw) && Number.isFinite(points.draw) ? outcomeProbs.draw * points.draw : null,
    away: Number.isFinite(outcomeProbs.away) && Number.isFinite(points.away) ? outcomeProbs.away * points.away : null,
  };

  const rarityMap = new Map(
    parseScoreValueLines(match.rarityBonusText).map((row) => [`${row.home}-${row.away}`, row.odd]),
  );
  const publicSplit = normalizePublicSplit(match.publicSplit);
  const scores = baseScores
    .map((score) => {
      const issue = outcomeFromScore(score.home, score.away);
      const issueBaseEv = issueEv[issue] || 0;
      const knownBonus = rarityMap.get(`${score.home}-${score.away}`);
      const bonus = Number.isFinite(knownBonus)
        ? knownBonus
        : estimateBonus(score, score.probability, outcomeProbs[issue], state.settings.riskMode, publicSplit?.[issue]);
      return {
        ...score,
        issue,
        bonus,
        bonusKnown: Number.isFinite(knownBonus),
        ev: issueBaseEv + score.probability * bonus,
      };
    })
    .sort((a, b) => b.ev - a.ev);

  const bestIssue = chooseAnchorIssue(issueEv, outcomeProbs, state.settings.riskMode);
  // En equilibre/conservateur, on ancre la reco sur l'issue retenue : un edge
  // de bonus (la partie la plus bruitee du modele) ne doit pas faire basculer
  // vers une issue nettement moins probable sur une quasi-egalite d'EV.
  // L'agressif garde l'EV de score pure (recherche de variance assumee).
  const aggressive = state.settings.riskMode === "aggressive";
  const candidateScores =
    aggressive || !bestIssue ? scores : scores.filter((score) => score.issue === bestIssue);
  const recommendation = chooseRobustScore(candidateScores.length ? candidateScores : scores, state.settings.riskMode);
  const hasBaseData =
    Number.isFinite(points.home) &&
    Number.isFinite(points.draw) &&
    Number.isFinite(points.away) &&
    Number.isFinite(match.odds?.home) &&
    Number.isFinite(match.odds?.draw) &&
    Number.isFinite(match.odds?.away);
  const hasCoreData = hasBaseData && (!knockoutRequested || victoryModeReady || qualReady);
  const activeRecommendation = hasCoreData ? recommendation : null;
  const actual = calculateActualPoints(match, activeRecommendation, scores);

  // Le score le mieux paye est sur une autre issue que la reco ancree : on
  // a ecarte un pari de bonus sur une issue moins sure -> on le signale.
  const topScoreIssue = scores[0]?.issue;
  const closeIssue =
    hasCoreData && !aggressive && bestIssue && topScoreIssue && topScoreIssue !== bestIssue
      ? { picked: bestIssue, over: topScoreIssue }
      : null;

  return {
    resultMarket,
    probabilities: outcomeProbs,
    issueEv,
    bestIssue,
    closeIssue,
    knockout,
    knockoutRequested,
    knockoutSource,
    needsQual: knockoutRequested && !victoryModeReady && !qualReady,
    lambdas,
    scores,
    recommendation: activeRecommendation,
    actual,
    hasCoreData,
  };
}

function chooseAnchorIssue(issueEv, probabilities, riskMode) {
  const entries = Object.entries(issueEv).filter(([, ev]) => Number.isFinite(ev));
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  if (riskMode === "aggressive") return entries[0][0];

  // Issues a quasi-egalite d'EV avec la meilleure : on tranche par proba.
  const margin = riskMode === "conservative" ? 3 : 1.5;
  const near = entries.filter(([, ev]) => entries[0][1] - ev <= margin);
  return [...near].sort((a, b) => (probabilities[b[0]] || 0) - (probabilities[a[0]] || 0))[0][0];
}

function chooseRobustScore(scores, riskMode) {
  if (!scores.length) return null;
  const tieMargin = riskMode === "conservative" ? 3 : riskMode === "aggressive" ? 0.5 : 2;
  const probabilityFloor = riskMode === "conservative" ? 0.95 : riskMode === "aggressive" ? 0.55 : 0.8;
  const bestEv = scores[0].ev;
  const topProbability = Math.max(...scores.map((score) => score.probability));
  return scores
    .filter((score) => bestEv - score.ev <= tieMargin && score.probability >= topProbability * probabilityFloor)
    .sort((a, b) => b.ev - a.ev || b.probability - a.probability)[0] || scores[0];
}

function calculateActualPoints(match, recommendation, scores = []) {
  const home = match.actual?.home;
  const away = match.actual?.away;
  // Le prono reellement joue dans MPP prime sur la reco du moment : la reco
  // peut bouger apres validation, pas les points.
  const playedHome = match.played?.home;
  const playedAway = match.played?.away;
  const hasPlayed = Number.isFinite(playedHome) && Number.isFinite(playedAway);
  const pick = hasPlayed
    ? { home: playedHome, away: playedAway, issue: outcomeFromScore(playedHome, playedAway) }
    : recommendation;
  if (!Number.isFinite(home) || !Number.isFinite(away) || !pick) return null;

  const actualIssue = outcomeFromScore(home, away);
  if (actualIssue !== pick.issue) {
    return {
      points: 0,
      issueHit: false,
      exactHit: false,
      actualIssue,
    };
  }

  const base = match.mpp?.[actualIssue] || 0;
  const exactHit = home === pick.home && away === pick.away;
  const estimatedBonus = scores.find((score) => score.home === pick.home && score.away === pick.away)?.bonus;
  const bonus = exactHit ? match.actual?.bonus || estimatedBonus || 0 : 0;
  const multiplier = match.x2Used ? 2 : 1;
  return {
    points: (base + bonus) * multiplier,
    issueHit: true,
    exactHit,
    actualIssue,
  };
}

function matchFromForm() {
  return {
    id: fields.matchId.value || uid(),
    homeTeam: fields.homeTeam.value.trim(),
    awayTeam: fields.awayTeam.value.trim(),
    kickoff: fields.kickoff.value ? new Date(fields.kickoff.value).toISOString() : "",
    mpp: {
      home: parseNumber(fields.mppHome.value),
      draw: parseNumber(fields.mppDraw.value),
      away: parseNumber(fields.mppAway.value),
    },
    publicSplit: {
      home: parseNumber(fields.publicHome.value),
      draw: parseNumber(fields.publicDraw.value),
      away: parseNumber(fields.publicAway.value),
    },
    odds: {
      home: parseNumber(fields.oddsHome.value),
      draw: parseNumber(fields.oddsDraw.value),
      away: parseNumber(fields.oddsAway.value),
    },
    knockout: Boolean(fields.knockout?.checked),
    qual: {
      home: parseNumber(fields.qualHome?.value),
      away: parseNumber(fields.qualAway?.value),
    },
    victoryMode: {
      home90: parseNumber(fields.winHome90?.value),
      away90: parseNumber(fields.winAway90?.value),
      homeEt: parseNumber(fields.winHomeEt?.value),
      awayEt: parseNumber(fields.winAwayEt?.value),
      homePens: parseNumber(fields.winHomePens?.value),
      awayPens: parseNumber(fields.winAwayPens?.value),
    },
    markets: {
      totalLine: parseNumber(fields.totalLine.value),
      over25: parseNumber(fields.over25.value),
      under25: parseNumber(fields.under25.value),
      bttsYes: parseNumber(fields.bttsYes.value),
      bttsNo: parseNumber(fields.bttsNo.value),
      homeLine: parseNumber(fields.homeLine.value),
      homeOver: parseNumber(fields.homeOver.value),
      homeUnder: parseNumber(fields.homeUnder.value),
      awayLine: parseNumber(fields.awayLine.value),
      awayOver: parseNumber(fields.awayOver.value),
      awayUnder: parseNumber(fields.awayUnder.value),
    },
    rarityBonusText: fields.rarityBonusText.value.trim(),
    played: {
      home: parseNumber(fields.playedHome.value),
      away: parseNumber(fields.playedAway.value),
    },
    actual: {
      home: parseNumber(fields.actualHome.value),
      away: parseNumber(fields.actualAway.value),
      bonus: parseNumber(fields.actualBonus.value),
    },
    x2Used: fields.x2Used.checked,
    updatedAt: new Date().toISOString(),
  };
}

function fillForm(match) {
  fields.matchId.value = match?.id || "";
  fields.homeTeam.value = match?.homeTeam || "";
  fields.awayTeam.value = match?.awayTeam || "";
  fields.kickoff.value = match?.kickoff ? toDatetimeLocal(match.kickoff) : "";
  fields.mppHome.value = match?.mpp?.home ?? "";
  fields.mppDraw.value = match?.mpp?.draw ?? "";
  fields.mppAway.value = match?.mpp?.away ?? "";
  fields.publicHome.value = match?.publicSplit?.home ?? "";
  fields.publicDraw.value = match?.publicSplit?.draw ?? "";
  fields.publicAway.value = match?.publicSplit?.away ?? "";
  fields.oddsHome.value = match?.odds?.home ?? "";
  fields.oddsDraw.value = match?.odds?.draw ?? "";
  fields.oddsAway.value = match?.odds?.away ?? "";
  if (fields.knockout) fields.knockout.checked = Boolean(match?.knockout);
  if (fields.qualHome) fields.qualHome.value = match?.qual?.home ?? "";
  if (fields.qualAway) fields.qualAway.value = match?.qual?.away ?? "";
  if (fields.winHome90) fields.winHome90.value = match?.victoryMode?.home90 ?? "";
  if (fields.winAway90) fields.winAway90.value = match?.victoryMode?.away90 ?? "";
  if (fields.winHomeEt) fields.winHomeEt.value = match?.victoryMode?.homeEt ?? "";
  if (fields.winAwayEt) fields.winAwayEt.value = match?.victoryMode?.awayEt ?? "";
  if (fields.winHomePens) fields.winHomePens.value = match?.victoryMode?.homePens ?? "";
  if (fields.winAwayPens) fields.winAwayPens.value = match?.victoryMode?.awayPens ?? "";
  fields.totalLine.value = match?.markets?.totalLine ?? 2.5;
  fields.over25.value = match?.markets?.over25 ?? "";
  fields.under25.value = match?.markets?.under25 ?? "";
  fields.bttsYes.value = match?.markets?.bttsYes ?? "";
  fields.bttsNo.value = match?.markets?.bttsNo ?? "";
  fields.homeLine.value = match?.markets?.homeLine ?? 1.5;
  fields.homeOver.value = match?.markets?.homeOver ?? match?.markets?.homeOver15 ?? "";
  fields.homeUnder.value = match?.markets?.homeUnder ?? match?.markets?.homeUnder15 ?? "";
  fields.awayLine.value = match?.markets?.awayLine ?? 0.5;
  fields.awayOver.value = match?.markets?.awayOver ?? match?.markets?.awayOver05 ?? "";
  fields.awayUnder.value = match?.markets?.awayUnder ?? match?.markets?.awayUnder05 ?? "";
  fields.rarityBonusText.value = match?.rarityBonusText || "";
  fields.playedHome.value = match?.played?.home ?? "";
  fields.playedAway.value = match?.played?.away ?? "";
  fields.actualHome.value = match?.actual?.home ?? "";
  fields.actualAway.value = match?.actual?.away ?? "";
  fields.actualBonus.value = match?.actual?.bonus ?? "";
  fields.x2Used.checked = Boolean(match?.x2Used);
  els.deleteMatchButton.hidden = !match?.id;
  els.dialogTitle.textContent = match?.id ? "Modifier le match" : "Nouveau match";
  renderPreview();
}

function toDatetimeLocal(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function render() {
  renderSummary();
  renderMatchList();
  renderPerformance();
  renderImportMatchOptions();
  saveState();
}

function perfBarsSvg(data) {
  const n = data.length;
  // Au-dela de 10 matchs, les libelles et chiffres se chevauchent : on bascule
  // sur des barres fines defilables, le detail passe par l'info-bulle (title).
  const compact = n > 10;
  const H = 170;
  const padL = 8;
  const padR = 8;
  const padT = compact ? 10 : 18;
  const padB = compact ? 10 : 28;
  const plotH = H - padT - padB;
  const yB = H - padB;
  const W = compact ? Math.max(340, n * 18) : 340;
  const groupW = (W - padL - padR) / n;
  const barW = Math.max(2.5, Math.min(26, groupW * 0.36));
  const maxVal = Math.max(...data.flatMap((d) => [d.ev, d.real]), 1) * (compact ? 1.06 : 1.14);
  const barH = (v) => Math.max(0, (v / maxVal) * plotH);

  let grid = "";
  for (let i = 1; i <= 3; i += 1) {
    const gy = (yB - (plotH * i) / 3).toFixed(1);
    grid += `<line x1="${padL}" y1="${gy}" x2="${(W - padR).toFixed(1)}" y2="${gy}" stroke="var(--line)" stroke-width="0.5"></line>`;
  }
  let body = grid + `<line x1="${padL}" y1="${yB}" x2="${(W - padR).toFixed(1)}" y2="${yB}" stroke="var(--line)" stroke-width="1"></line>`;
  data.forEach((d, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const gap = compact ? 0.6 : 1.5;
    const x1 = cx - barW - gap;
    const x2 = cx + gap;
    const h1 = barH(d.ev);
    const h2 = barH(d.real);
    body += `<g><title>${d.label} : prevu ${formatNumber(d.ev, 0)} · reel ${formatNumber(d.real, 0)}</title>`;
    body += `<rect x="${x1.toFixed(1)}" y="${(yB - h1).toFixed(1)}" width="${barW.toFixed(1)}" height="${h1.toFixed(1)}" rx="1.5" fill="var(--muted)"></rect>`;
    body += `<rect x="${x2.toFixed(1)}" y="${(yB - h2).toFixed(1)}" width="${barW.toFixed(1)}" height="${h2.toFixed(1)}" rx="1.5" fill="var(--primary)"></rect></g>`;
    if (!compact) {
      body += `<text x="${(x1 + barW / 2).toFixed(1)}" y="${(yB - h1 - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text)">${formatNumber(d.ev, 0)}</text>`;
      body += `<text x="${(x2 + barW / 2).toFixed(1)}" y="${(yB - h2 - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text)">${formatNumber(d.real, 0)}</text>`;
      body += `<text x="${cx.toFixed(1)}" y="${(yB + 14).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${d.label}</text>`;
    }
  });
  const svg = `<svg viewBox="0 0 ${W} ${H}" ${compact ? `width="${W}" height="${H}"` : 'style="width:100%;height:auto"'} role="img" aria-label="Prevu contre reel par match">${body}</svg>`;
  return compact ? `<div style="overflow-x:auto">${svg}</div>` : svg;
}

function perfCumSvg(data) {
  if (data.length < 2) return "";
  const W = 340;
  const H = 150;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 10;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yB = H - padB;
  let cumEv = 0;
  let cumReal = 0;
  const pts = data.map((d, i) => {
    cumEv += d.ev;
    cumReal += d.real;
    return { x: padL + (plotW * i) / (data.length - 1), ce: cumEv, cr: cumReal };
  });
  const maxCum = Math.max(pts[pts.length - 1].ce, pts[pts.length - 1].cr, 1) * 1.05;
  const y = (v) => yB - (v / maxCum) * plotH;
  const line = (key, stroke, dash) => {
    const poly = pts.map((p) => `${p.x.toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    return `<polyline points="${poly}" fill="none" stroke="${stroke}" stroke-width="2"${dash ? ' stroke-dasharray="4 4"' : ""}></polyline>`;
  };
  let grid = "";
  for (let i = 1; i <= 3; i += 1) {
    const gy = (yB - (plotH * i) / 3).toFixed(1);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--line)" stroke-width="0.5"></line>`;
  }
  let body = grid + `<line x1="${padL}" y1="${yB}" x2="${W - padR}" y2="${yB}" stroke="var(--line)" stroke-width="1"></line>`;
  body += line("ce", "var(--muted)", true);
  body += line("cr", "var(--primary)", false);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="EV cumulee contre reel cumule">${body}</svg>`;
}

function renderPerformance() {
  if (!els.perfPanel) return;
  const items = state.matches
    .map((match) => ({ match, calc: calculateMatch(match) }))
    .filter((item) => item.calc.actual)
    .sort((a, b) => {
      const ad = a.match.kickoff ? new Date(a.match.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.match.kickoff ? new Date(b.match.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });

  if (!items.length) {
    els.perfPanel.hidden = true;
    return;
  }
  els.perfPanel.hidden = false;

  const data = items.map((item) => ({
    label: (item.match.homeTeam || "?").split(" ")[0].slice(0, 8),
    // EV doublee si le x2 est pose : on compare alors a des points reels eux
    // aussi doubles (E[2X] = 2 E[X]).
    ev: (item.calc.recommendation?.ev || 0) * (item.match.x2Used ? 2 : 1),
    real: item.calc.actual.points || 0,
  }));
  const totalEv = data.reduce((sum, d) => sum + d.ev, 0);
  const totalReal = data.reduce((sum, d) => sum + d.real, 0);
  const diff = totalReal - totalEv;
  els.perfSummary.textContent = `${formatNumber(totalReal, 0)} reels / ${formatNumber(totalEv, 1)} prevus · ecart ${diff >= 0 ? "+" : ""}${formatNumber(diff, 1)}`;
  els.perfBars.innerHTML =
    perfBarsSvg(data) +
    (data.length > 10 ? `<div class="helper">Survole une barre pour le detail · fais defiler pour voir tous les matchs.</div>` : "");
  els.perfCum.innerHTML = perfCumSvg(data);
}

function renderSummary() {
  const calculations = state.matches.map((match) => ({ match, calc: calculateMatch(match) }));
  // EV totale = matchs restants uniquement ; les matchs joues sont dans
  // "Points reels".
  const totalEv = calculations.reduce(
    (sum, item) =>
      sum + (!item.calc.actual && item.calc.recommendation ? item.calc.recommendation.ev * (item.match.x2Used ? 2 : 1) : 0),
    0,
  );
  const completed = calculations.filter((item) => item.calc.actual);
  const realPoints = completed.reduce((sum, item) => sum + item.calc.actual.points, 0);
  const issueHits = completed.filter((item) => item.calc.actual.issueHit).length;
  const x2Match = calculations.find((item) => item.match.x2Used);
  const candidates = calculations
    .filter((item) => !item.calc.actual && item.calc.recommendation)
    .sort((a, b) => b.calc.recommendation.ev - a.calc.recommendation.ev);
  const bestCandidate = candidates[0];

  els.totalEv.textContent = formatNumber(totalEv, 1);
  els.realPoints.textContent = formatNumber(realPoints, 0);
  els.hitRate.textContent = `${issueHits}/${completed.length} bons resultats`;
  els.x2Status.textContent = x2Match ? "Utilise" : "Disponible";
  if (x2Match) {
    els.x2Hint.textContent = `${x2Match.match.homeTeam} - ${x2Match.match.awayTeam}`;
  } else if (bestCandidate && bestCandidate.calc.recommendation.ev >= state.settings.x2Threshold) {
    els.x2Hint.textContent = `candidat: ${bestCandidate.match.homeTeam}`;
  } else {
    els.x2Hint.textContent = "attendre meilleure EV";
  }
}

function renderMatchList() {
  const filter = els.matchFilter.value;
  const now = Date.now();
  const items = state.matches
    .map((match) => ({ match, calc: calculateMatch(match) }))
    .filter(({ match, calc }) => {
      if (filter === "completed") return Boolean(calc.actual);
      if (filter === "upcoming") return !calc.actual;
      if (filter === "x2") return !calc.actual && (calc.recommendation?.ev || 0) >= state.settings.x2Threshold;
      return true;
    })
    .sort((a, b) => {
      const ad = a.match.kickoff ? new Date(a.match.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.match.kickoff ? new Date(b.match.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });

  els.matchList.innerHTML = "";
  els.emptyState.hidden = items.length > 0;
  els.matchCount.textContent = `${items.length} match${items.length > 1 ? "s" : ""}`;

  for (const { match, calc } of items) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    const kickoffTime = match.kickoff ? new Date(match.kickoff).getTime() : null;
    const isSoon = kickoffTime && kickoffTime > now && kickoffTime - now < 90 * 60 * 1000;
    const rec = calc.recommendation;

    node.querySelector(".kickoff").textContent = datetimeLabel(match.kickoff);
    node.querySelector(".teams").textContent = `${match.homeTeam || "Equipe 1"} - ${match.awayTeam || "Equipe 2"}`;
    node.querySelector(".recommendation").innerHTML = rec
      ? `<span class="pick">${rec.home}-${rec.away}<small>EV ${formatNumber(rec.ev, 1)}</small></span>`
      : `<span class="pick"><small>donnees</small>manquantes</span>`;

    const evStrip = node.querySelector(".ev-strip");
    evStrip.innerHTML = ["home", "draw", "away"]
      .map((key) => {
        const best = calc.bestIssue === key ? " best" : "";
        const paid = calc.closeIssue?.over === key ? " paid" : "";
        return `<div class="ev-cell${best}${paid}"><span>${outcomeLabel(key)} ${formatPercent(calc.probabilities[key] || 0, 1)}</span><strong>${formatNumber(calc.issueEv[key], 1)}</strong></div>`;
      })
      .join("");

    if (calc.closeIssue) {
      const hint = document.createElement("p");
      hint.className = "helper close-issue-hint";
      hint.textContent = `Issue serree: ${outcomeLabel(calc.closeIssue.over)} mieux paye mais moins probable que ${outcomeLabel(calc.closeIssue.picked)}.`;
      evStrip.insertAdjacentElement("afterend", hint);
    }

    const status = node.querySelector(".status-pill");
    if (calc.actual) {
      status.textContent = `${formatNumber(calc.actual.points, 0)} pts reels`;
      status.classList.add(calc.actual.issueHit ? "good" : "warn");
    } else if (calc.needsQual) {
      status.textContent = "cotes 120 min a completer";
      status.classList.add("warn");
    } else if (isSoon) {
      status.textContent = "T-90 min";
      status.classList.add("warn");
    } else if (!calc.hasCoreData) {
      status.textContent = "donnees a completer";
    } else if (rec?.ev >= state.settings.x2Threshold) {
      status.textContent = "candidat x2";
      status.classList.add("good");
    } else {
      status.textContent = `TRJ ${formatPercent(calc.resultMarket.trj || 0, 1)}`;
    }

    node.querySelector(".edit-button").addEventListener("click", () => openMatch(match.id));
    els.matchList.appendChild(node);
  }
}

function renderPreview() {
  const match = matchFromForm();
  const calc = calculateMatch(match);
  const rec = calc.recommendation;

  if (!calc.hasCoreData) {
    els.matchPreview.innerHTML = calc.needsQual
      ? "<span class='helper'>Renseigne les cotes mode de victoire ou les cotes de qualification pour calculer ce match a 120 min.</span>"
      : "<span class='helper'>Renseigne points MPP et cotes 1/N/2 pour obtenir une decision.</span>";
    return;
  }

  // Top 8 par EV + le score le plus probable, toujours visible meme si son
  // bonus ecrase (score trop joue) le sort du classement.
  const topScores = calc.scores.slice(0, 8);
  const mostProbable = calc.scores.reduce((best, score) => (score.probability > (best?.probability || 0) ? score : best), null);
  if (mostProbable && !topScores.includes(mostProbable)) topScores.push(mostProbable);
  const scoreRows = topScores
    .map(
      (score) => `
        <tr>
          <td>${score.home}-${score.away}</td>
          <td>${formatPercent(score.probability, 1)}</td>
          <td>${score.bonusKnown ? "+" : "~"}${score.bonus}</td>
          <td>${formatNumber(score.ev, 1)}</td>
        </tr>
      `,
    )
    .join("");

  els.matchPreview.innerHTML = `
    <div class="preview-grid">
      ${["home", "draw", "away"]
        .map(
          (key) => `
            <div class="preview-item${calc.bestIssue === key ? " best" : ""}">
              <span>${outcomeLabel(key)} proba ${formatPercent(calc.probabilities[key], 1)}</span>
              <strong>EV ${formatNumber(calc.issueEv[key], 1)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="notice">
      <strong>Decision: ${rec ? `${rec.home}-${rec.away}` : "-"}${calc.knockout ? " · 120 min" : ""}</strong>
      <p>Modele buts: ${formatNumber(calc.lambdas.lambdaHome, 2)} - ${formatNumber(calc.lambdas.lambdaAway, 2)} xG (90 min). TRJ ${formatPercent(calc.resultMarket.trj, 1)}.${calc.knockout ? (calc.knockoutSource === "mode-victory" ? " Issues calees sur le mode de victoire." : " Issues calees sur la qualification, nul reduit pour les prolongations.") : ""}</p>
      ${
        calc.closeIssue
          ? `<p>Le score le mieux paye est sur ${outcomeLabel(calc.closeIssue.over)} (moins probable). Reco ancree sur ${outcomeLabel(calc.closeIssue.picked)}, l'issue plus sure. Passe en agressif pour viser ${outcomeLabel(calc.closeIssue.over)}.</p>`
          : ""
      }
      ${
        Number.isFinite(match.played?.home) && Number.isFinite(match.played?.away)
          ? `<p>Prono joue: ${match.played.home}-${match.played.away}${
              rec && (rec.home !== match.played.home || rec.away !== match.played.away)
                ? " (different de la reco actuelle)"
                : ""
            }</p>`
          : ""
      }
    </div>
    <table class="score-table">
      <thead><tr><th>Score</th><th>Proba</th><th>Bonus</th><th>EV</th></tr></thead>
      <tbody>${scoreRows}</tbody>
    </table>
  `;
}

function renderImportMatchOptions() {
  els.importMatch.innerHTML = state.matches
    .map((match) => `<option value="${match.id}">${match.homeTeam || "Equipe 1"} - ${match.awayTeam || "Equipe 2"}</option>`)
    .join("");
}

function openMatch(id) {
  const match = state.matches.find((item) => item.id === id);
  fillForm(match);
  els.matchDialog.showModal();
}

function saveMatchFromForm() {
  const match = matchFromForm();
  const index = state.matches.findIndex((item) => item.id === match.id);
  if (index >= 0) state.matches[index] = match;
  else state.matches.push(match);
  if (state.deletedMatches) delete state.deletedMatches[match.id];
  markDirty();
  render();
  scheduleAutoSync();
}

function deleteCurrentMatch() {
  const id = fields.matchId.value;
  if (!id) return;
  state.matches = state.matches.filter((match) => match.id !== id);
  state.deletedMatches = {
    ...(state.deletedMatches || {}),
    [id]: new Date().toISOString(),
  };
  markDirty();
  els.matchDialog.close();
  render();
  scheduleAutoSync();
}

function parseTriplet(text, kind) {
  const values = String(text || "")
    .replace(/,/g, ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((number) => Number.isFinite(number)) || [];

  if (kind === "mpp") {
    const points = values.filter((number) => number >= 5 && number <= 500);
    return points.slice(0, 3);
  }

  const odds = values.filter((number) => number > 1 && number < 200);
  return odds.slice(0, 3);
}

function previewImport() {
  const kind = els.importKind.value;
  const text = els.importText.value;

  const triplet = parseTriplet(text, kind);
  els.importPreview.innerHTML =
    triplet.length === 3
      ? `<strong>${kind === "mpp" ? "Points" : "Cotes"} detectes</strong><p>${triplet.join(" / ")}</p>`
      : "<span class='helper'>Il faut detecter exactement 3 nombres dans l'ordre 1 / N / 2.</span>";
  return triplet;
}

function applyImport() {
  const match = state.matches.find((item) => item.id === els.importMatch.value);
  if (!match) return;
  const kind = els.importKind.value;
  const parsed = previewImport();

  if (Array.isArray(parsed) && parsed.length === 3) {
    const target = kind === "mpp" ? "mpp" : "odds";
    match[target] = {
      ...(match[target] || {}),
      home: parsed[0],
      draw: parsed[1],
      away: parsed[2],
    };
  }

  match.updatedAt = new Date().toISOString();
  markDirty();
  els.importDialog.close();
  render();
  scheduleAutoSync();
}

function cloudPayload() {
  return {
    app: "mpp-edge",
    version: 1,
    updatedAt: new Date().toISOString(),
    clientId: getClientId(),
    state: {
      ...state,
      matches: (state.matches || []).map(normalizeMatchRecord),
      deletedMatches: state.deletedMatches || {},
    },
  };
}

function normalizeCloudState(payload) {
  const source = payload?.state || payload;
  return {
    ...structuredClone(defaultState),
    ...source,
    settings: { ...defaultState.settings, ...(source?.settings || {}) },
    matches: Array.isArray(source?.matches) ? source.matches.map(normalizeMatchRecord) : [],
    deletedMatches: source?.deletedMatches && typeof source.deletedMatches === "object" ? source.deletedMatches : {},
  };
}

function mergeStates(localState, remoteState) {
  const local = normalizeCloudState(localState);
  const remote = normalizeCloudState(remoteState);
  const deletedMatches = { ...(local.deletedMatches || {}) };

  for (const [id, deletedAt] of Object.entries(remote.deletedMatches || {})) {
    const localDeletedAt = deletedMatches[id] || "";
    if (new Date(deletedAt).getTime() > new Date(localDeletedAt || 0).getTime()) {
      deletedMatches[id] = deletedAt;
    }
  }

  const byId = new Map();
  for (const match of [...local.matches, ...remote.matches]) {
    if (!match?.id) continue;
    const deletedAt = new Date(deletedMatches[match.id] || 0).getTime();
    const matchAt = new Date(match.updatedAt || 0).getTime();
    if (deletedAt && deletedAt >= matchAt) continue;

    const existing = byId.get(match.id);
    const existingAt = new Date(existing?.updatedAt || 0).getTime();
    if (!existing || matchAt >= existingAt) byId.set(match.id, match);
  }

  // Deux appareils qui ont saisi le meme match sans synchro lui ont donne
  // des ids differents : on dedoublonne par equipes + jour, version la plus
  // recente gagnante.
  const byContent = new Map();
  for (const match of byId.values()) {
    const home = (match.homeTeam || "").trim().toLowerCase();
    const away = (match.awayTeam || "").trim().toLowerCase();
    if (!home && !away) {
      byContent.set(match.id, match);
      continue;
    }
    const day = match.kickoff ? String(match.kickoff).slice(0, 10) : "";
    const key = `${home}|${away}|${day}`;
    const existing = byContent.get(key);
    const existingAt = new Date(existing?.updatedAt || 0).getTime();
    const matchAt = new Date(match.updatedAt || 0).getTime();
    if (!existing || matchAt >= existingAt) byContent.set(key, match);
  }

  return {
    ...structuredClone(defaultState),
    ...local,
    settings: local.settings,
    matches: [...byContent.values()].sort((a, b) => {
      const ad = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }),
    deletedMatches,
    updatedAt: new Date().toISOString(),
  };
}

function setSyncStatus(message, variant = "") {
  if (!els.syncStatus) return;
  const color = variant === "error" ? "var(--danger)" : variant === "good" ? "var(--good)" : "var(--muted)";
  els.syncStatus.innerHTML = `<span class="helper" style="color:${color}">${message}</span>`;
}

function syncHeaders({ requireToken = true } = {}) {
  if (requireToken && !syncConfig.token) throw new Error("Token GitHub manquant.");
  const headers = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (syncConfig.token) headers.Authorization = `Bearer ${syncConfig.token}`;
  return headers;
}

async function githubRequest(url, options = {}) {
  const { requireToken = true, headers: extraHeaders, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...syncHeaders({ requireToken }),
      ...(extraHeaders || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data?.message || response.statusText;
    throw new Error(`GitHub ${response.status}: ${detail}`);
  }
  return data;
}

async function createSyncGist() {
  saveSyncSettingsFromForm();
  const gist = await githubRequest("https://api.github.com/gists", {
    method: "POST",
    body: JSON.stringify({
      description: "MPP Edge sync",
      public: false,
      files: {
        [SYNC_FILE]: {
          content: JSON.stringify(cloudPayload(), null, 2),
        },
      },
    }),
  });
  syncConfig.gistId = gist.id;
  syncConfig.lastSyncAt = new Date().toISOString();
  syncConfig.lastError = "";
  saveSyncConfig();
  fillSyncForm();
  setSyncStatus(`Gist cree et donnees envoyees. ID: ${gist.id}`, "good");
}

let gistEtag = "";
let gistCache = null;
let gistCacheId = "";

async function readSyncGist() {
  if (!syncConfig.gistId) throw new Error("Gist ID manquant.");
  const headers = syncHeaders({ requireToken: false });
  // Requete conditionnelle : un 304 (rien de neuf) ne compte pas dans le
  // quota GitHub, ce qui permet un sondage frequent sans risque.
  if (gistEtag && gistCache && gistCacheId === syncConfig.gistId) {
    headers["If-None-Match"] = gistEtag;
  }
  const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(syncConfig.gistId)}`, { headers });
  if (response.status === 304) return gistCache;
  const text = await response.text();
  const gist = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${gist?.message || response.statusText}`);
  const file = gist.files?.[SYNC_FILE] || Object.values(gist.files || {})[0];
  if (!file) throw new Error(`Fichier ${SYNC_FILE} introuvable dans le Gist.`);
  let content = file.content || "";
  if (file.truncated || !content) {
    const rawResponse = await fetch(`${file.raw_url}?t=${Date.now()}`, {
      headers: syncHeaders({ requireToken: false }),
    });
    if (!rawResponse.ok) throw new Error(`Lecture raw impossible: ${rawResponse.status}`);
    content = await rawResponse.text();
  }
  const parsed = JSON.parse(content);
  gistEtag = response.headers.get("ETag") || "";
  gistCache = parsed;
  gistCacheId = syncConfig.gistId;
  return parsed;
}

async function writeSyncGist() {
  if (!syncConfig.gistId) throw new Error("Gist ID manquant.");
  const gist = await githubRequest(`https://api.github.com/gists/${encodeURIComponent(syncConfig.gistId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      files: {
        [SYNC_FILE]: {
          content: JSON.stringify(cloudPayload(), null, 2),
        },
      },
    }),
  });
  syncConfig.lastSyncAt = new Date().toISOString();
  syncConfig.lastError = "";
  saveSyncConfig();
  return gist;
}

async function pullSync({ silent = false } = {}) {
  try {
    saveSyncSettingsFromForm();
    if (!silent) setSyncStatus("Recuperation cloud...");
    const remote = normalizeCloudState(await readSyncGist());
    state = mergeStates(state, remote);
    syncConfig.lastSyncAt = new Date().toISOString();
    syncConfig.lastError = "";
    saveSyncConfig();
    render();
    if (!silent) setSyncStatus("Donnees cloud recuperees et fusionnees.", "good");
  } catch (error) {
    noteSyncError(error);
    syncConfig.lastError = error.message;
    saveSyncConfig();
    if (!silent) setSyncStatus(error.message, "error");
    throw error;
  }
}

async function pushSync({ silent = false } = {}) {
  try {
    saveSyncSettingsFromForm();
    if (!syncConfig.gistId) {
      await createSyncGist();
      stateDirty = false;
      return;
    }
    if (!silent) setSyncStatus("Envoi cloud...");
    await writeSyncGist();
    stateDirty = false;
    if (!silent) setSyncStatus("Donnees locales envoyees.", "good");
  } catch (error) {
    noteSyncError(error);
    syncConfig.lastError = error.message;
    saveSyncConfig();
    if (!silent) setSyncStatus(error.message, "error");
    throw error;
  }
}

let syncInFlight = false;

async function syncNow({ silent = false } = {}) {
  if (syncInFlight) return;
  if (!syncConfig.token || !syncConfig.gistId) return;
  syncInFlight = true;
  renderSyncBadge();
  try {
    if (!silent) setSyncStatus("Synchronisation...");
    await pullSync({ silent: true });
    if (stateDirty) await pushSync({ silent: true });
    syncConfig.lastSyncAt = new Date().toISOString();
    syncConfig.lastError = "";
    saveSyncConfig();
    if (!silent) setSyncStatus("Synchronisation terminee.", "good");
  } finally {
    syncInFlight = false;
    renderSyncBadge();
  }
}

function scheduleAutoSync() {
  if (!syncConfig.autoSync || !syncConfig.token) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncNow({ silent: true }).catch(() => {});
  }, 1200);
}

function saveSyncSettingsFromForm() {
  // Les champs du formulaire ne sont remplis que quand le dialogue Parametres
  // est ouvert ; les lire dialogue ferme ecraserait la config par du vide.
  if (!els.settingsDialog.open) return;
  syncConfig = {
    ...syncConfig,
    token: els.syncToken.value.trim() || syncConfig.token,
    gistId: els.syncGistId.value.trim() || syncConfig.gistId,
    autoSync: els.autoSync.checked,
  };
  saveSyncConfig();
}

function buildMagicLink() {
  const payload = { t: syncConfig.token || "", g: syncConfig.gistId || "", a: syncConfig.autoSync ? 1 : 0 };
  return `${location.origin}${location.pathname}#cfg=${btoa(JSON.stringify(payload))}`;
}

async function copyMagicLink() {
  saveSyncSettingsFromForm();
  if (!syncConfig.token && !syncConfig.gistId) {
    setSyncStatus("Renseigne d'abord le token et le Gist ID.", "error");
    return;
  }
  const link = buildMagicLink();
  try {
    await navigator.clipboard.writeText(link);
    setSyncStatus("Lien copie. Colle-le dans Notes : si la config saute, ouvrir le lien la restaure en un tap.", "good");
  } catch {
    els.syncStatus.innerHTML = `<span class="helper">Copie auto impossible, selectionne le lien :</span><textarea rows="3" readonly style="width:100%">${link}</textarea>`;
  }
}

function applyConfigFromUrl() {
  const match = location.hash.match(/cfg=([^&]+)/);
  if (!match) return false;
  try {
    const payload = JSON.parse(atob(decodeURIComponent(match[1])));
    syncConfig = {
      ...syncConfig,
      token: payload.t ? String(payload.t) : syncConfig.token,
      gistId: payload.g ? String(payload.g) : syncConfig.gistId,
      autoSync: "a" in payload ? Boolean(payload.a) : syncConfig.autoSync,
    };
    saveSyncConfig();
    history.replaceState(null, "", location.pathname + location.search);
    setSyncStatus("Configuration restauree depuis le lien magique.", "good");
    return true;
  } catch {
    return false;
  }
}

function fillSyncForm() {
  els.syncToken.value = syncConfig.token || "";
  els.syncGistId.value = syncConfig.gistId || "";
  els.autoSync.checked = Boolean(syncConfig.autoSync);
  const lastSync = syncConfig.lastSyncAt ? datetimeLabel(syncConfig.lastSyncAt) : "jamais";
  const message = syncConfig.lastError ? `Derniere erreur: ${syncConfig.lastError}` : `Derniere synch: ${lastSync}`;
  setSyncStatus(message, syncConfig.lastError ? "error" : "");
}

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.Tesseract;
}

async function runOcr() {
  const file = els.imageInput.files?.[0];
  if (!file) {
    els.importPreview.innerHTML = "<span class='helper'>Choisis une image avant de lancer l'OCR.</span>";
    return;
  }

  els.ocrProgress.hidden = false;
  els.ocrProgress.value = 0.05;
  els.runOcrButton.disabled = true;
  els.importPreview.innerHTML = "<span class='helper'>Chargement du moteur OCR... (1er essai: telechargement, peut prendre 10-20 s)</span>";

  try {
    const Tesseract = await ensureTesseract();
    els.importPreview.innerHTML = "<span class='helper'>Lecture de l'image...</span>";
    // "eng" seul : modele plus leger a telecharger et meilleur sur les
    // chiffres et noms latins qu'un pack multilingue.
    const result = await Tesseract.recognize(file, "eng", {
      logger: (message) => {
        if (message.status === "recognizing text") els.ocrProgress.value = message.progress || 0.2;
      },
    });
    const text = (result.data.text || "").trim();
    els.importText.value = text;
    els.ocrProgress.value = 1;
    if (!text) {
      els.importPreview.innerHTML =
        "<span class='helper'>Aucun texte lu sur l'image. Reessaie avec une capture nette et recadree, ou colle le texte directement.</span>";
    } else {
      previewImport();
    }
  } catch (error) {
    // Le plus souvent : reseau/CDN qui bloque le telechargement du moteur.
    els.importPreview.innerHTML = `<span class='helper' style="color:var(--danger)">OCR impossible (${error.message || "moteur non charge, reseau ?"}). Colle le texte a la place.</span>`;
  } finally {
    els.runOcrButton.disabled = false;
    setTimeout(() => {
      els.ocrProgress.hidden = true;
    }, 800);
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mpp-edge-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      state = {
        ...structuredClone(defaultState),
        ...parsed,
        settings: { ...defaultState.settings, ...(parsed.settings || {}) },
        matches: Array.isArray(parsed.matches) ? parsed.matches.map(normalizeMatchRecord) : [],
        deletedMatches: parsed.deletedMatches && typeof parsed.deletedMatches === "object" ? parsed.deletedMatches : {},
      };
      markDirty();
      render();
      els.settingsDialog.close();
    } catch {
      alert("Import JSON impossible.");
    }
  };
  reader.readAsText(file);
}

async function withSyncButton(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (error) {
    setSyncStatus(error.message || "Erreur de synchronisation.", "error");
  } finally {
    button.disabled = false;
  }
}

function bindEvents() {
  els.addMatchButton.addEventListener("click", () => {
    fillForm(null);
    els.matchDialog.showModal();
  });
  els.closeMatchDialog.addEventListener("click", () => els.matchDialog.close());
  els.deleteMatchButton.addEventListener("click", deleteCurrentMatch);
  els.recomputeButton.addEventListener("click", renderPreview);
  els.matchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveMatchFromForm();
    els.matchDialog.close();
  });
  Object.values(fields).forEach((field) => {
    field?.addEventListener?.("input", renderPreview);
    field?.addEventListener?.("change", renderPreview);
  });
  els.openImportButton.addEventListener("click", () => {
    renderImportMatchOptions();
    els.importText.value = "";
    els.importPreview.innerHTML = "";
    els.importDialog.showModal();
  });
  els.closeImportDialog.addEventListener("click", () => els.importDialog.close());
  els.previewImportButton.addEventListener("click", previewImport);
  els.applyImportButton.addEventListener("click", applyImport);
  els.runOcrButton.addEventListener("click", runOcr);
  els.importKind.addEventListener("change", previewImport);
  els.importText.addEventListener("input", previewImport);

  els.settingsButton.addEventListener("click", () => {
    els.x2Threshold.value = state.settings.x2Threshold;
    els.riskMode.value = state.settings.riskMode;
    els.dixonColes.checked = state.settings.dixonColes !== false;
    fillSyncForm();
    els.settingsDialog.showModal();
  });
  els.closeSettingsDialog.addEventListener("click", () => els.settingsDialog.close());
  els.x2Threshold.addEventListener("input", () => {
    state.settings.x2Threshold = parseNumber(els.x2Threshold.value) || defaultState.settings.x2Threshold;
    markDirty();
    render();
  });
  els.riskMode.addEventListener("change", () => {
    state.settings.riskMode = els.riskMode.value;
    markDirty();
    render();
  });
  els.dixonColes.addEventListener("change", () => {
    state.settings.dixonColes = els.dixonColes.checked;
    markDirty();
    render();
  });
  els.exportDataButton.addEventListener("click", exportData);
  els.importDataInput.addEventListener("change", (event) => importData(event.target.files?.[0]));
  els.saveSyncButton.addEventListener("click", () => {
    saveSyncSettingsFromForm();
    setSyncStatus("Configuration synch sauvegardee.", "good");
  });
  els.magicLinkButton.addEventListener("click", copyMagicLink);
  els.syncBadge.addEventListener("click", () => {
    syncNow({ silent: true }).catch(() => {});
  });
  els.createGistButton.addEventListener("click", async () => {
    await withSyncButton(els.createGistButton, () => createSyncGist());
  });
  els.pullSyncButton.addEventListener("click", async () => {
    await withSyncButton(els.pullSyncButton, () => pullSync());
  });
  els.pushSyncButton.addEventListener("click", async () => {
    await withSyncButton(els.pushSyncButton, () => pushSync());
  });
  els.resetDataButton.addEventListener("click", () => {
    if (!confirm("Tout effacer ?")) return;
    state = structuredClone(defaultState);
    markDirty();
    render();
    els.settingsDialog.close();
  });
  els.matchFilter.addEventListener("change", renderMatchList);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      const checkUpdate = () => registration.update().catch(() => {});
      setInterval(checkUpdate, 5 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkUpdate();
      });
    })
    .catch(() => {});
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || !hadController) return;
    // Pas de rechargement si une fiche est ouverte : la nouvelle version
    // s'appliquera au prochain lancement plutot que de perdre une saisie.
    const dialogOpen = [els.matchDialog, els.importDialog, els.settingsDialog].some((dialog) => dialog?.open);
    if (dialogOpen) return;
    refreshing = true;
    location.reload();
  });
}

function liveSyncTick() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() < syncCooldownUntil) return;
  if (!syncConfig.autoSync || !syncConfig.token || !syncConfig.gistId) return;
  syncNow({ silent: true }).catch(() => {});
}

bindEvents();
const restoredFromLink = applyConfigFromUrl();
render();
registerServiceWorker();
navigator.storage?.persist?.();
if (syncConfig.autoSync && syncConfig.token && syncConfig.gistId) {
  setTimeout(() => {
    syncNow({ silent: true }).catch(() => {});
  }, 800);
} else if (restoredFromLink && syncConfig.gistId) {
  setTimeout(() => {
    pullSync({ silent: true }).catch(() => {});
  }, 800);
}
// Synchro quasi temps reel : au retour sur l'app et toutes les 12 s tant
// qu'elle est visible. Les lectures conditionnelles (304) ne consomment
// pas le quota GitHub, seuls les vrais changements coutent une requete.
document.addEventListener("visibilitychange", liveSyncTick);
window.addEventListener("focus", liveSyncTick);
setInterval(liveSyncTick, 12000);
els.appVersion.textContent = `Coupe du monde · ${APP_VERSION}`;
renderSyncBadge();
setInterval(renderSyncBadge, 5000);
