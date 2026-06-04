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
  },
};

let state = loadState();
let syncConfig = loadSyncConfig();
let syncTimer = null;

const els = {
  totalEv: document.querySelector("#totalEv"),
  realPoints: document.querySelector("#realPoints"),
  hitRate: document.querySelector("#hitRate"),
  x2Status: document.querySelector("#x2Status"),
  x2Hint: document.querySelector("#x2Hint"),
  matchCount: document.querySelector("#matchCount"),
  matchList: document.querySelector("#matchList"),
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
  parseScoresButton: document.querySelector("#parseScoresButton"),
  scoreParseInfo: document.querySelector("#scoreParseInfo"),
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
  syncToken: document.querySelector("#syncToken"),
  syncGistId: document.querySelector("#syncGistId"),
  autoSync: document.querySelector("#autoSync"),
  saveSyncButton: document.querySelector("#saveSyncButton"),
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
  oddsHome: document.querySelector("#oddsHome"),
  oddsDraw: document.querySelector("#oddsDraw"),
  oddsAway: document.querySelector("#oddsAway"),
  over25: document.querySelector("#over25"),
  under25: document.querySelector("#under25"),
  bttsYes: document.querySelector("#bttsYes"),
  bttsNo: document.querySelector("#bttsNo"),
  homeOver15: document.querySelector("#homeOver15"),
  homeUnder15: document.querySelector("#homeUnder15"),
  awayOver05: document.querySelector("#awayOver05"),
  awayUnder05: document.querySelector("#awayUnder05"),
  correctScoreText: document.querySelector("#correctScoreText"),
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
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      deletedMatches: parsed.deletedMatches && typeof parsed.deletedMatches === "object" ? parsed.deletedMatches : {},
    };
  } catch {
    return structuredClone(defaultState);
  }
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

function scoreDistribution(lambdaHome, lambdaAway, maxGoals = 8) {
  const scores = [];
  const homeP = Array.from({ length: maxGoals + 1 }, (_, goal) => poissonPmf(lambdaHome, goal));
  const awayP = Array.from({ length: maxGoals + 1 }, (_, goal) => poissonPmf(lambdaAway, goal));
  const mass = homeP.reduce((a, b) => a + b, 0) * awayP.reduce((a, b) => a + b, 0);

  for (let home = 0; home <= maxGoals; home += 1) {
    for (let away = 0; away <= maxGoals; away += 1) {
      scores.push({
        home,
        away,
        probability: (homeP[home] * awayP[away]) / mass,
      });
    }
  }

  return scores;
}

function outcomeFromScore(home, away) {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function outcomeLabel(key) {
  return key === "home" ? "1" : key === "draw" ? "N" : "2";
}

function calculatePoissonOutcomes(lambdaHome, lambdaAway) {
  const scores = scoreDistribution(lambdaHome, lambdaAway, 9);
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
  const homeTotal = normalizeOdds({
    over: match.markets?.homeOver15,
    under: match.markets?.homeUnder15,
  });
  const awayTotal = normalizeOdds({
    over: match.markets?.awayOver05,
    under: match.markets?.awayUnder05,
  });

  const targetTotal = solveLambdaForOver(2.5, totalMarket.probabilities.over);
  const targetHome = solveLambdaForOver(1.5, homeTotal.probabilities.over);
  const targetAway = Number.isFinite(awayTotal.probabilities.over)
    ? -Math.log(Math.max(0.001, 1 - awayTotal.probabilities.over))
    : null;

  let best = null;
  const candidateHome = [];
  const candidateAway = [];

  for (let h = 0.15; h <= 4.5; h += 0.05) candidateHome.push(Number(h.toFixed(2)));
  for (let a = 0.08; a <= 3.5; a += 0.05) candidateAway.push(Number(a.toFixed(2)));

  for (const lambdaHome of candidateHome) {
    for (const lambdaAway of candidateAway) {
      const out = calculatePoissonOutcomes(lambdaHome, lambdaAway);
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

function parseCorrectScoreLines(text) {
  const rows = [];
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const compact = line.replace(",", ".");
    let match = compact.match(/(?:^|\D)(\d{1,2})\s*[-:]\s*(\d{1,2})(?:\D+)(\d+(?:\.\d+)?)(?:\D*)$/);
    if (!match) {
      match = compact.match(/(?:^|\D)(\d{1,2})(?:\D+)(\d{1,2})(?:\D+)(\d+(?:\.\d+)?)(?:\D*)$/);
    }
    if (!match) continue;

    const home = Number(match[1]);
    const away = Number(match[2]);
    const odd = Number(match[3]);
    if (Number.isFinite(home) && Number.isFinite(away) && Number.isFinite(odd) && odd > 1) {
      rows.push({ home, away, odd });
    }
  }

  const unique = new Map();
  for (const row of rows) unique.set(`${row.home}-${row.away}`, row);
  return [...unique.values()];
}

function blendScoreProbabilities(poissonScores, correctScores) {
  if (!correctScores?.length) return poissonScores;

  const scoreMap = new Map(poissonScores.map((score) => [`${score.home}-${score.away}`, score]));
  const enteredMassPoisson = correctScores.reduce((sum, row) => {
    const key = `${row.home}-${row.away}`;
    return sum + (scoreMap.get(key)?.probability || 0);
  }, 0);
  const rawSum = correctScores.reduce((sum, row) => sum + 1 / row.odd, 0);
  if (!rawSum || !enteredMassPoisson) return poissonScores;

  const bookProbability = new Map(
    correctScores.map((row) => [`${row.home}-${row.away}`, ((1 / row.odd) / rawSum) * enteredMassPoisson]),
  );

  return poissonScores.map((score) => {
    const key = `${score.home}-${score.away}`;
    if (!bookProbability.has(key)) return score;
    return {
      ...score,
      probability: 0.55 * score.probability + 0.45 * bookProbability.get(key),
      source: "blend",
    };
  });
}

function estimateBonus(score, scoreProbability, issueProbability, riskMode) {
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

  const estimatedPublicShare = conditional * bias;
  if (estimatedPublicShare > 0.3) return 20;
  if (estimatedPublicShare > 0.2) return 30;
  if (estimatedPublicShare > 0.05) return 50;
  if (estimatedPublicShare > 0.005) return 70;
  return 100;
}

function calculateMatch(match) {
  const resultMarket = normalizeOdds(match.odds || {});
  const probabilities = resultMarket.probabilities;
  const points = match.mpp || {};
  const issueEv = {
    home: Number.isFinite(probabilities.home) && Number.isFinite(points.home) ? probabilities.home * points.home : null,
    draw: Number.isFinite(probabilities.draw) && Number.isFinite(points.draw) ? probabilities.draw * points.draw : null,
    away: Number.isFinite(probabilities.away) && Number.isFinite(points.away) ? probabilities.away * points.away : null,
  };

  const lambdas = fitLambdas(match, probabilities);
  const poissonScores = scoreDistribution(lambdas.lambdaHome, lambdas.lambdaAway, 8);
  const correctScores = parseCorrectScoreLines(match.correctScoreText);
  const scores = blendScoreProbabilities(poissonScores, correctScores)
    .map((score) => {
      const issue = outcomeFromScore(score.home, score.away);
      const issueBaseEv = issueEv[issue] || 0;
      const bonus = estimateBonus(score, score.probability, probabilities[issue], state.settings.riskMode);
      return {
        ...score,
        issue,
        bonus,
        ev: issueBaseEv + score.probability * bonus,
      };
    })
    .sort((a, b) => b.ev - a.ev);

  const bestIssue = Object.entries(issueEv)
    .filter(([, ev]) => Number.isFinite(ev))
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const recommendation = chooseRobustScore(scores, state.settings.riskMode);
  const actual = calculateActualPoints(match, recommendation);

  return {
    resultMarket,
    probabilities,
    issueEv,
    bestIssue,
    lambdas,
    scores,
    recommendation,
    actual,
    hasCoreData:
      Number.isFinite(points.home) &&
      Number.isFinite(points.draw) &&
      Number.isFinite(points.away) &&
      Number.isFinite(match.odds?.home) &&
      Number.isFinite(match.odds?.draw) &&
      Number.isFinite(match.odds?.away),
  };
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

function calculateActualPoints(match, recommendation) {
  const home = match.actual?.home;
  const away = match.actual?.away;
  if (!Number.isFinite(home) || !Number.isFinite(away) || !recommendation) return null;

  const actualIssue = outcomeFromScore(home, away);
  const predictedIssue = recommendation.issue;
  if (actualIssue !== predictedIssue) {
    return {
      points: 0,
      issueHit: false,
      exactHit: false,
      actualIssue,
    };
  }

  const base = match.mpp?.[actualIssue] || 0;
  const exactHit = home === recommendation.home && away === recommendation.away;
  const bonus = exactHit ? match.actual?.bonus || recommendation.bonus || 0 : 0;
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
    odds: {
      home: parseNumber(fields.oddsHome.value),
      draw: parseNumber(fields.oddsDraw.value),
      away: parseNumber(fields.oddsAway.value),
    },
    markets: {
      over25: parseNumber(fields.over25.value),
      under25: parseNumber(fields.under25.value),
      bttsYes: parseNumber(fields.bttsYes.value),
      bttsNo: parseNumber(fields.bttsNo.value),
      homeOver15: parseNumber(fields.homeOver15.value),
      homeUnder15: parseNumber(fields.homeUnder15.value),
      awayOver05: parseNumber(fields.awayOver05.value),
      awayUnder05: parseNumber(fields.awayUnder05.value),
    },
    correctScoreText: fields.correctScoreText.value.trim(),
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
  fields.oddsHome.value = match?.odds?.home ?? "";
  fields.oddsDraw.value = match?.odds?.draw ?? "";
  fields.oddsAway.value = match?.odds?.away ?? "";
  fields.over25.value = match?.markets?.over25 ?? "";
  fields.under25.value = match?.markets?.under25 ?? "";
  fields.bttsYes.value = match?.markets?.bttsYes ?? "";
  fields.bttsNo.value = match?.markets?.bttsNo ?? "";
  fields.homeOver15.value = match?.markets?.homeOver15 ?? "";
  fields.homeUnder15.value = match?.markets?.homeUnder15 ?? "";
  fields.awayOver05.value = match?.markets?.awayOver05 ?? "";
  fields.awayUnder05.value = match?.markets?.awayUnder05 ?? "";
  fields.correctScoreText.value = match?.correctScoreText || "";
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
  renderImportMatchOptions();
  saveState();
}

function renderSummary() {
  const calculations = state.matches.map((match) => ({ match, calc: calculateMatch(match) }));
  const totalEv = calculations.reduce((sum, item) => sum + (item.calc.recommendation?.ev || 0), 0);
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
        return `<div class="ev-cell${best}"><span>${outcomeLabel(key)} ${formatPercent(calc.probabilities[key] || 0, 1)}</span><strong>${formatNumber(calc.issueEv[key], 1)}</strong></div>`;
      })
      .join("");

    const status = node.querySelector(".status-pill");
    if (calc.actual) {
      status.textContent = `${formatNumber(calc.actual.points, 0)} pts reels`;
      status.classList.add(calc.actual.issueHit ? "good" : "warn");
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
    els.matchPreview.innerHTML = "<span class='helper'>Renseigne points MPP et cotes 1/N/2 pour obtenir une decision.</span>";
    return;
  }

  const scoreRows = calc.scores
    .slice(0, 6)
    .map(
      (score) => `
        <tr>
          <td>${score.home}-${score.away}</td>
          <td>${formatPercent(score.probability, 1)}</td>
          <td>+${score.bonus}</td>
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
      <strong>Decision: ${rec ? `${rec.home}-${rec.away}` : "-"}</strong>
      <p>Modele buts: ${formatNumber(calc.lambdas.lambdaHome, 2)} - ${formatNumber(calc.lambdas.lambdaAway, 2)} xG. TRJ ${formatPercent(calc.resultMarket.trj, 1)}.</p>
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

  if (kind === "scores") {
    const rows = parseCorrectScoreLines(text);
    els.importPreview.innerHTML = rows.length
      ? `<strong>${rows.length} scores detectes</strong><p class="helper">${rows
          .slice(0, 8)
          .map((row) => `${row.home}-${row.away} @ ${row.odd}`)
          .join(" | ")}</p>`
      : "<span class='helper'>Aucun score detecte.</span>";
    return rows;
  }

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

  if (kind === "scores") {
    const rows = Array.isArray(parsed) ? parsed : [];
    if (!rows.length) return;
    match.correctScoreText = rows.map((row) => `${row.home}-${row.away} ${row.odd}`).join("\n");
  } else if (Array.isArray(parsed) && parsed.length === 3) {
    const target = kind === "mpp" ? "mpp" : "odds";
    match[target] = {
      ...(match[target] || {}),
      home: parsed[0],
      draw: parsed[1],
      away: parsed[2],
    };
  }

  match.updatedAt = new Date().toISOString();
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
      matches: state.matches || [],
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
    matches: Array.isArray(source?.matches) ? source.matches : [],
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

  return {
    ...structuredClone(defaultState),
    ...local,
    settings: local.settings,
    matches: [...byId.values()].sort((a, b) => {
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

function syncHeaders() {
  if (!syncConfig.token) throw new Error("Token GitHub manquant.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${syncConfig.token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...syncHeaders(),
      ...(options.headers || {}),
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

async function readSyncGist() {
  if (!syncConfig.gistId) throw new Error("Gist ID manquant.");
  const gist = await githubRequest(`https://api.github.com/gists/${encodeURIComponent(syncConfig.gistId)}`, {
    method: "GET",
  });
  const file = gist.files?.[SYNC_FILE] || Object.values(gist.files || {})[0];
  if (!file) throw new Error(`Fichier ${SYNC_FILE} introuvable dans le Gist.`);
  let content = file.content || "";
  if (file.truncated || !content) {
    const rawResponse = await fetch(`${file.raw_url}?t=${Date.now()}`, {
      headers: syncHeaders(),
    });
    if (!rawResponse.ok) throw new Error(`Lecture raw impossible: ${rawResponse.status}`);
    content = await rawResponse.text();
  }
  return JSON.parse(content);
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
      return;
    }
    if (!silent) setSyncStatus("Envoi cloud...");
    await writeSyncGist();
    if (!silent) setSyncStatus("Donnees locales envoyees.", "good");
  } catch (error) {
    syncConfig.lastError = error.message;
    saveSyncConfig();
    if (!silent) setSyncStatus(error.message, "error");
    throw error;
  }
}

async function syncNow({ silent = false } = {}) {
  if (!syncConfig.token || !syncConfig.gistId) return;
  if (!silent) setSyncStatus("Synchronisation...");
  await pullSync({ silent: true });
  await pushSync({ silent: true });
  syncConfig.lastSyncAt = new Date().toISOString();
  syncConfig.lastError = "";
  saveSyncConfig();
  if (!silent) setSyncStatus("Synchronisation terminee.", "good");
}

function scheduleAutoSync() {
  if (!syncConfig.autoSync || !syncConfig.token) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncNow({ silent: true }).catch(() => {});
  }, 1200);
}

function saveSyncSettingsFromForm() {
  syncConfig = {
    ...syncConfig,
    token: els.syncToken.value.trim(),
    gistId: els.syncGistId.value.trim(),
    autoSync: els.autoSync.checked,
  };
  saveSyncConfig();
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
  els.importPreview.innerHTML = "<span class='helper'>Lecture en cours...</span>";

  try {
    const Tesseract = await ensureTesseract();
    const result = await Tesseract.recognize(file, "eng+fra", {
      logger: (message) => {
        if (message.status === "recognizing text") els.ocrProgress.value = message.progress || 0.2;
      },
    });
    els.importText.value = result.data.text.trim();
    els.ocrProgress.value = 1;
    previewImport();
  } catch (error) {
    els.importPreview.innerHTML = `<span class='helper'>OCR indisponible. Colle le texte ou saisis les chiffres. ${error.message || ""}</span>`;
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
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
        deletedMatches: parsed.deletedMatches && typeof parsed.deletedMatches === "object" ? parsed.deletedMatches : {},
      };
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
    field.addEventListener?.("input", renderPreview);
    field.addEventListener?.("change", renderPreview);
  });
  els.parseScoresButton.addEventListener("click", () => {
    const rows = parseCorrectScoreLines(fields.correctScoreText.value);
    els.scoreParseInfo.textContent = rows.length ? `${rows.length} scores detectes.` : "Aucun score detecte.";
    renderPreview();
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
    fillSyncForm();
    els.settingsDialog.showModal();
  });
  els.closeSettingsDialog.addEventListener("click", () => els.settingsDialog.close());
  els.x2Threshold.addEventListener("input", () => {
    state.settings.x2Threshold = parseNumber(els.x2Threshold.value) || defaultState.settings.x2Threshold;
    render();
  });
  els.riskMode.addEventListener("change", () => {
    state.settings.riskMode = els.riskMode.value;
    render();
  });
  els.exportDataButton.addEventListener("click", exportData);
  els.importDataInput.addEventListener("change", (event) => importData(event.target.files?.[0]));
  els.saveSyncButton.addEventListener("click", () => {
    saveSyncSettingsFromForm();
    setSyncStatus("Configuration synch sauvegardee.", "good");
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
    render();
    els.settingsDialog.close();
  });
  els.matchFilter.addEventListener("change", renderMatchList);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

bindEvents();
render();
registerServiceWorker();
if (syncConfig.autoSync && syncConfig.token && syncConfig.gistId) {
  setTimeout(() => {
    syncNow({ silent: true }).catch(() => {});
  }, 800);
}
