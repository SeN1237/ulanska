// --- SEKCJA 0: IMPORTY I KONFIGURACJA FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
    getFirestore, doc, setDoc, onSnapshot, updateDoc,
    collection, addDoc, query, orderBy, limit, Timestamp,
    serverTimestamp, where, getDoc, runTransaction,
    increment
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeu3hDfVKNirhJHk1HbqaFjtf_L3v3sd0",
  authDomain: "symulator-gielda.firebaseapp.com",
  projectId: "symulator-gielda",
  storageBucket: "symulator-gielda.firebasestorage.app",
  messagingSenderId: "407270570707",
  appId: "1:407270570707:web:ffd8c24dd1c8a1c137b226",
  measurementId: "G-BXPWNE261F"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ZMIENNE GLOBALNE ---
let market = {
    ulanska:    { name: "Ułańska Dev",   price: 1, previousPrice: null, history: [], type: 'stock', lastUpdatedAt: null },
    brzozair:   { name: "BrzozAir",      price: 1, previousPrice: null, history: [], type: 'stock', lastUpdatedAt: null },
    rychbud:    { name: "RychBud",       price: 1, previousPrice: null, history: [], type: 'stock', lastUpdatedAt: null },
    cosmosanit: { name: "Cosmosanit",    price: 100, previousPrice: null, history: [], type: 'stock', lastUpdatedAt: null },
    nicorp:     { name: "Nicorp",        price: 1000, previousPrice: null, history: [], type: 'crypto', lastUpdatedAt: null },
    igirium:    { name: "Igirium",       price: 500, previousPrice: null, history: [], type: 'crypto', lastUpdatedAt: null }
};

const companyAbbreviations = {
    ulanska: "UŁDEV", rychbud: "RBUD", brzozair: "BAIR", cosmosanit: "COSIT",
    nicorp: "NIC", igirium: "IGI"
};

let currentCompanyId = "ulanska";
let currentMarketType = "stocks";

let portfolio = {
    name: "Gość", cash: 0,
    shares: { ulanska: 0, rychbud: 0, brzozair: 0, cosmosanit: 0, nicorp: 0, igirium: 0 },
    stats: { totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 },
    startValue: 100, zysk: 0, totalValue: 0, prestigeLevel: 0,
    missionProgress: null, dividendDueAt: null, lastDividendAt: null, dividendCount: 0,
    // Pola pomocnicze do animacji
    displayedCash: undefined,
    displayedTotal: undefined,
    displayedProfit: undefined
};

// --- KONFIGURACJA PRESTIŻU I BLOKAD ---
const PRESTIGE_REQUIREMENTS = [100000, 250000, 500000, 1000000, 1500000]; // 5 progów
const CRYPTO_PRESTIGE_REQUIREMENT = 4; // Krypto od poziomu 4

const GAME_UNLOCKS = {
    // Poziom 0 (Start)
    'radio': 0,
    'pvp': 0,
    'minigolf': 0,

    // Poziom 1 (⭐️)
    'casino': 1,
    'dice': 1,      // <-- Dodane: Kości

    // Poziom 2 (⭐️⭐️)
    'poker': 2,
    'mines': 2,
    'keno': 2,      // <-- Dodane: Keno

    // Poziom 3 (⭐️⭐️⭐️)
    'plinko': 3,
    'blackjack': 3, // <-- Dodane: Blackjack

    // Poziom 4 (⭐️⭐️⭐️⭐️) - Wcześniej tu było tylko Krypto, teraz dajemy gry
    'slots': 4,     // <-- Dodane: Sloty (Neon 777)
    'cases': 4,     // <-- Dodane: Skrzynki

    // Poziom 5 (⭐️⭐️⭐️⭐️⭐️)
    'crash': 5
};

const COMPANY_ORDER = ["ulanska", "rychbud", "brzozair", "cosmosanit", "nicorp", "igirium"];
const CHART_COLORS = ['#00d2ff', '#FF6384', '#36A2EB', '#4BC0C0', '#9966FF', '#F0B90B', '#627EEA'];

// Zmienne UI/Logic
let chart = null;
let portfolioChart = null;
let currentUserId = null;
let chartHasStarted = false;
let initialNewsLoaded = false;
let initialChatLoaded = false;
let audioUnlocked = false;
let isChatCooldown = false;

// CRASH GAME VARS
let crashGameLoop;
let crashMultiplier = 1.00;
let crashIsRunning = false;
let crashHasCashedOut = false;
let crashBetAmount = 0;
let crashCurvePoints = [];
let crashCanvas, crashCtx;
let crashCurrentCrashPoint = 0;

// Unsubscribes
let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeNews = null;
let unsubscribeLeaderboard = null;
let unsubscribePlayersOnline = null;
let unsubscribeChat = null;
let unsubscribeGlobalHistory = null;
let unsubscribePersonalHistory = null;
let unsubscribeLimitOrders = null;
let unsubscribePvP = null;
let presenceHeartbeatInterval = null;
const PLAYERS_ONLINE_TIMEOUT_MS = 90 * 1000;
let unsubscribeSportsbookMatches = null;
let unsubscribeSportsbookBets = null;
let sportsbookMatches = [];
let selectedSportsbookBet = null;
let sportsbookMatchesError = null;
let sportsbookBetsError = null;
let submittingSportsbookBet = false;
let priceAlertDocs = [];
const pendingPriceAlerts = new Set();
let currentMarketEvent = null;
let currentCompanyReports = [];

let dom = {};

// --- MINES VARS ---
let minesGameActive = false;
let minesGridData = []; // Tablica 25 elementów (true = mina, false = diament)
let minesRevealedCount = 0;
let minesBetAmount = 0;
let minesCount = 3;
let minesCurrentMultiplier = 1.0;

// --- FUNKCJE POMOCNICZE ---
function generateInitialCandles(count, basePrice) {
    let data = []; let lastClose = basePrice || 1;
    let timestamp = new Date().getTime() - (count * 15000);
    for (let i = 0; i < count; i++) {
        let open = lastClose;
        let close = open + (Math.random() - 0.5) * (basePrice * 0.05);
        let high = Math.max(open, close) + Math.random() * (basePrice * 0.02);
        let low = Math.min(open, close) - Math.random() * (basePrice * 0.02);
        data.push({
            x: new Date(timestamp),
            y: [Math.max(1, open).toFixed(2), Math.max(1, high).toFixed(2), Math.max(1, low).toFixed(2), Math.max(1, close).toFixed(2)]
        });
        lastClose = close; timestamp += 15000;
    }
    return data;
}

function formatujWalute(val) { return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(val); }
function getPrestigeStars(lvl, type) { return lvl ? (type==='chat'?` <span class="prestige-stars">(${'⭐️'.repeat(lvl)})</span>`:` <span class="prestige-stars">${'⭐️'.repeat(lvl)}</span>`) : ''; }
function showMessage(msg, type) {
    if(dom.messageBox) {
        dom.messageBox.textContent = msg;
        dom.messageBox.style.color = type==="error"?"var(--red)":"var(--green)";
        setTimeout(()=>dom.messageBox.textContent="", 3000);
    }
}
function showAuthMessage(msg, type="info") { dom.authMessage.textContent = msg; dom.authMessage.style.color = type==="error" ? "var(--red)" : "var(--green)"; }

// --- ANIMOWANA AKTUALIZACJA CENY (GŁÓWNY WIDOK) ---
function updatePriceUI() {
    if(!dom.stockPrice) return;

    const company = market[currentCompanyId];
    const currentPrice = company.price;

    // Sprawdzamy, jaką cenę wyświetlamy obecnie
    if (typeof company.displayedPrice === 'undefined') {
        company.displayedPrice = currentPrice;
        dom.stockPrice.textContent = formatujWalute(currentPrice);
    } else {
        if (company.displayedPrice !== currentPrice) {
            // Animujemy od starej ceny do nowej
            animateValue(dom.stockPrice, company.displayedPrice, currentPrice, 1000);
            company.displayedPrice = currentPrice;
        }
    }
}

function checkCryptoAccess() {
    const isCrypto = market[currentCompanyId].type === 'crypto';
    const locked = isCrypto && portfolio.prestigeLevel < CRYPTO_PRESTIGE_REQUIREMENT;

    if(dom.orderPanel) {
        dom.orderPanel.classList.toggle("crypto-locked", locked);
        const msgEl = dom.orderPanel.querySelector(".crypto-gate-message p");
        if(msgEl && locked) {
            msgEl.textContent = `Wymagany Prestiż ${CRYPTO_PRESTIGE_REQUIREMENT} (⭐️⭐️⭐️⭐️)`;
        }
    }
}

function updateTickerTape() {
    let h = "";
    COMPANY_ORDER.forEach(cid => {
        if(market[cid].price) {
            const diff = ((market[cid].price - (market[cid].previousPrice||market[cid].price))/market[cid].price)*100;
            const cls = diff > 0 ? "ticker-up" : (diff < 0 ? "ticker-down" : "");
            h += `<span class="ticker-item ${market[cid].type==='crypto'?'ticker-crypto':''}">${market[cid].name} <strong>${market[cid].price.toFixed(2)}</strong> <span class="${cls}">${diff.toFixed(2)}%</span></span>`;
        }
    });
    if(dom.tickerContent) dom.tickerContent.innerHTML = h + h;
}

function renderMarketHeatmap() {
    if (!dom.marketHeatmap) return;

    const cards = COMPANY_ORDER.map(cid => {
        const company = market[cid];
        const previousPrice = Number.isFinite(company.previousPrice) && company.previousPrice > 0
            ? company.previousPrice
            : company.price;
        const priceChange = company.price - previousPrice;
        const changePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
        const direction = priceChange > 0 ? "up" : priceChange < 0 ? "down" : "flat";
        const sign = priceChange > 0 ? "+" : priceChange < 0 ? "−" : "";
        const percent = `${sign}${Math.abs(changePercent).toLocaleString("pl-PL", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}%`;
        const priceDelta = `${sign}${formatujWalute(Math.abs(priceChange))}`;

        return `
            <button class="heatmap-tile is-${direction}" type="button"
                data-heatmap-company="${cid}"
                aria-label="${company.name}: ${formatujWalute(company.price)}, zmiana ${percent}. Otwórz instrument na giełdzie">
                <span class="heatmap-tile-top">
                    <span class="heatmap-symbol">${companyAbbreviations[cid]}</span>
                    <i class="fa-solid fa-arrow-${direction === "up" ? "trend-up" : direction === "down" ? "trend-down" : "right"}"></i>
                </span>
                <span class="heatmap-name">${company.name}</span>
                <strong class="heatmap-price">${formatujWalute(company.price)}</strong>
                <span class="heatmap-change">${priceDelta} <span>(${percent})</span></span>
            </button>`;
    }).join("");

    dom.marketHeatmap.innerHTML = cards;
}

function showNotification(message, type, impactType = null) {
    if (!dom.notificationContainer) return;
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.classList.add(`toast-${type}`);
    let header = "Powiadomienie";
    if (type === 'news') {
        header = "Wiadomość Rynkowa";
        if(impactType) {
            toast.classList.add(`toast-${impactType}`);
            header = impactType === 'positive' ? "Dobre Wieści!" : "Złe Wieści!";
        }
    } else if (type === "success") {
        header = "Gotowe";
    } else if (type === "error") {
        header = "Błąd";
    } else if (type === 'chat') header = "Nowa Wiadomość";
    else if (type === 'tip') header = "Prywatna Wskazówka!";
    toast.innerHTML = `<strong>${header}</strong><p>${message}</p>`;
    dom.notificationContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-fade-out'); setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500); }, 5000);
}

const DAILY_MISSION_REWARD = 250;
const WEEKLY_MISSION_REWARD = 1500;

function getMissionPeriods(date = new Date()) {
    const dayKey = date.toISOString().slice(0, 10);
    const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = thursday.getUTCDay() || 7;
    thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
    return { day: dayKey, week: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}` };
}

function normalizeMissionProgress(progress, now = new Date()) {
    const periods = getMissionPeriods(now);
    const daily = progress?.daily?.period === periods.day
        ? progress.daily
        : { period: periods.day, trades: 0, claimed: false };
    const weekly = progress?.weekly?.period === periods.week
        ? progress.weekly
        : { period: periods.week, trades: 0, claimed: false };
    return { daily, weekly };
}

function advanceMissionProgress(progress) {
    const current = normalizeMissionProgress(progress);
    return {
        daily: { ...current.daily, trades: current.daily.trades + 1 },
        weekly: { ...current.weekly, trades: current.weekly.trades + 1 }
    };
}

function renderMissions() {
    const container = document.getElementById("missions-content");
    if (!container) return;

    const progress = normalizeMissionProgress(portfolio.missionProgress);
    const missions = [
        { id: "daily", title: "Codzienny inwestor", description: "Wykonaj 1 transakcję na giełdzie.", count: progress.daily.trades, goal: 1, reward: DAILY_MISSION_REWARD, claimed: progress.daily.claimed },
        { id: "weekly", title: "Aktywny trader", description: "Wykonaj 10 transakcji w tym tygodniu.", count: progress.weekly.trades, goal: 10, reward: WEEKLY_MISSION_REWARD, claimed: progress.weekly.claimed }
    ];

    container.replaceChildren();
    missions.forEach(mission => {
        const card = document.createElement("div");
        card.className = "investor-feature-item";

        const title = document.createElement("strong");
        title.textContent = mission.title;
        const description = document.createElement("p");
        description.textContent = mission.description;
        const counter = document.createElement("p");
        counter.textContent = `${Math.min(mission.count, mission.goal)} / ${mission.goal} · Nagroda: ${formatujWalute(mission.reward)}`;

        const progressBar = document.createElement("progress");
        progressBar.max = mission.goal;
        progressBar.value = Math.min(mission.count, mission.goal);

        const claimButton = document.createElement("button");
        claimButton.type = "button";
        claimButton.className = "btn-accent mt-10";
        claimButton.dataset.claimMission = mission.id;
        claimButton.textContent = mission.claimed
            ? "Nagroda odebrana"
            : mission.count >= mission.goal
                ? "Odbierz nagrodę"
                : "W trakcie";
        claimButton.disabled = mission.claimed || mission.count < mission.goal;

        card.append(title, description, counter, progressBar, claimButton);
        container.appendChild(card);
    });
}

async function claimMission(missionId) {
    if (!currentUserId || !["daily", "weekly"].includes(missionId)) return;

    const goal = missionId === "daily" ? 1 : 10;
    const reward = missionId === "daily" ? DAILY_MISSION_REWARD : WEEKLY_MISSION_REWARD;
    const userRef = doc(db, "uzytkownicy", currentUserId);
    try {
        await runTransaction(db, async transaction => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("Nie znaleziono profilu użytkownika.");

            const data = userDoc.data();
            const progress = normalizeMissionProgress(data.missionProgress);
            const mission = progress[missionId];
            if (mission.claimed || mission.trades < goal) throw new Error("Ta misja nie jest jeszcze gotowa do odebrania.");

            const newCash = data.cash + reward;
            const newTotalValue = calculateTotalValue(newCash, data.shares || {});
            transaction.update(userRef, {
                cash: newCash,
                totalValue: newTotalValue,
                zysk: newTotalValue - (data.startValue || 0),
                missionProgress: { ...progress, [missionId]: { ...mission, claimed: true } }
            });
        });
        showNotification(`Odebrano nagrodę za misję: ${formatujWalute(reward)}.`, "success");
    } catch (error) {
        showNotification(error.message, "error");
    }
}

function getTimestampMillis(value) {
    if (value && typeof value.toMillis === "function") return value.toMillis();
    if (value && typeof value.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    return Number.isFinite(value) ? value : null;
}

function renderDividendStatus() {
    const status = document.getElementById("dividend-status");
    if (!status) return;

    const stockValue = ["ulanska", "rychbud", "brzozair", "cosmosanit"]
        .reduce((total, id) => total + (portfolio.shares[id] || 0) * market[id].price, 0);
    if (stockValue <= 0) {
        status.textContent = "Posiadaj akcje spółek, aby otrzymywać automatyczne dywidendy.";
        return;
    }

    const dueAt = getTimestampMillis(portfolio.dividendDueAt);
    if (dueAt === null) {
        status.textContent = "Pierwsza wypłata zostanie rozliczona przy najbliższej aktualizacji rynku.";
        return;
    }

    const remaining = dueAt - Date.now();
    if (remaining <= 0) {
        status.textContent = "Dywidenda jest należna i zostanie rozliczona przy najbliższej aktualizacji rynku.";
        return;
    }

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    status.textContent = `Następna wypłata za ${hours} godz. ${minutes} min. Ostatnia: ${portfolio.lastDividendAt ? new Date(getTimestampMillis(portfolio.lastDividendAt)).toLocaleString("pl-PL") : "brak"}.`;
}

function getAchievements(user) {
    const totalValue = user.totalValue || user.cash || 0;
    const trades = user.stats?.totalTrades || 0;
    return [
        { title: "Pierwszy krok", description: "Wykonaj pierwszą transakcję.", earned: trades >= 1 },
        { title: "Doświadczony inwestor", description: "Wykonaj 25 transakcji.", earned: trades >= 25 },
        { title: "Portfel 100 000 zł", description: "Zbuduj portfel o wartości co najmniej 100 000 zł.", earned: totalValue >= 100000 },
        { title: "Mistrz prestiżu", description: "Zdobądź pierwszy poziom prestiżu.", earned: (user.prestigeLevel || 0) >= 1 },
        { title: "Pierwsza dywidenda", description: "Otrzymaj pierwszą wypłatę dywidendy.", earned: (user.dividendCount || 0) >= 1 }
    ];
}

function renderAchievements() {
    const container = document.getElementById("achievements-content");
    if (!container) return;
    const achievements = getAchievements({ ...portfolio, totalValue: portfolio.totalValue || portfolio.cash });
    container.replaceChildren();
    achievements.forEach(achievement => {
        const card = document.createElement("div");
        card.className = `investor-feature-item${achievement.earned ? "" : " is-locked"}`;
        const title = document.createElement("strong");
        title.textContent = `${achievement.earned ? "✓" : "🔒"} ${achievement.title}`;
        const description = document.createElement("p");
        description.textContent = achievement.description;
        card.append(title, description);
        container.appendChild(card);
    });
}

function renderProfileAchievements(user) {
    const container = document.getElementById("modal-achievements");
    if (!container) return;
    const earned = getAchievements(user).filter(achievement => achievement.earned);
    container.replaceChildren();
    if (!earned.length) {
        container.textContent = "Brak zdobytych odznak.";
        return;
    }
    earned.forEach(achievement => {
        const badge = document.createElement("span");
        badge.className = "profile-achievement-badge";
        badge.textContent = achievement.title;
        container.appendChild(badge);
    });
}

function renderMarketEvent(event) {
    const container = document.getElementById("market-event-content");
    if (!container) return;
    container.replaceChildren();

    if (!event || !event.title) {
        container.textContent = "Brak aktywnego wydarzenia rynkowego.";
        return;
    }

    const card = document.createElement("div");
    card.className = "investor-feature-item";
    const title = document.createElement("strong");
    title.textContent = event.title;
    const description = document.createElement("p");
    description.textContent = event.description || "";
    const impact = document.createElement("p");
    const companyName = market[event.companyId]?.name || event.companyId || "Rynek";
    const percent = Number.isFinite(event.impactPercent) ? event.impactPercent * 100 : null;
    impact.textContent = percent === null ? companyName : `${companyName} · jednorazowy wpływ ${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
    const endAt = getTimestampMillis(event.endAt);
    const expiry = document.createElement("p");
    expiry.textContent = endAt === null
        ? ""
        : endAt <= Date.now()
            ? "Wydarzenie wygasło. Oczekiwanie na kolejne."
            : `Do: ${new Date(endAt).toLocaleString("pl-PL")}`;
    card.append(title, description, impact, expiry);
    container.appendChild(card);
}

function renderCompanyReports(reports) {
    const container = document.getElementById("company-reports-content");
    if (!container) return;
    container.replaceChildren();

    if (!reports.length) {
        container.textContent = "Raporty pojawią się po pierwszym dziennym podsumowaniu rynku.";
        return;
    }

    const latestReports = [...reports]
        .sort((a, b) => (getTimestampMillis(b.generatedAt) || 0) - (getTimestampMillis(a.generatedAt) || 0))
        .slice(0, 12);
    latestReports.forEach(report => {
        const card = document.createElement("div");
        card.className = "investor-feature-item";
        const title = document.createElement("strong");
        title.textContent = report.companyName || market[report.companyId]?.name || report.companyId || "Spółka";
        const summary = document.createElement("p");
        summary.textContent = report.summary || "Brak podsumowania.";
        const date = getTimestampMillis(report.generatedAt);
        const timestamp = document.createElement("p");
        timestamp.textContent = date === null ? "" : new Date(date).toLocaleString("pl-PL");
        card.append(title, summary, timestamp);
        container.appendChild(card);
    });
}

function renderPriceAlerts() {
    const container = document.getElementById("price-alerts-list");
    if (!container) return;
    container.replaceChildren();

    const alerts = [...priceAlertDocs].sort((a, b) =>
        (getTimestampMillis(b.createdAt) || 0) - (getTimestampMillis(a.createdAt) || 0)
    );
    if (!alerts.length) {
        container.textContent = "Nie masz jeszcze ustawionych alertów.";
        return;
    }

    alerts.forEach(alert => {
        const card = document.createElement("div");
        card.className = "investor-feature-item";
        const name = market[alert.companyId]?.name || alert.companyId || "Spółka";
        const condition = alert.direction === "above" ? "wzrośnie do" : "spadnie do";
        const state = alert.active ? "aktywny" : alert.triggeredAt ? "uruchomiony" : "anulowany";
        const text = document.createElement("p");
        text.textContent = `${name}: ${condition} ${formatujWalute(alert.targetPrice)} · ${state}`;
        card.appendChild(text);
        if (alert.active) {
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "btn-sell mt-10";
            cancel.textContent = "Usuń alert";
            cancel.addEventListener("click", () => deactivatePriceAlert(alert.id));
            card.appendChild(cancel);
        }
        container.appendChild(card);
    });
}

async function deactivatePriceAlert(alertId) {
    if (!currentUserId) return;
    try {
        const userRef = doc(db, "uzytkownicy", currentUserId);
        await runTransaction(db, async transaction => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("Nie znaleziono profilu użytkownika.");
            const alerts = userDoc.data().priceAlerts || [];
            transaction.update(userRef, { priceAlerts: alerts.filter(alert => alert.id !== alertId) });
        });
    } catch (error) {
        console.error("Nie udało się usunąć alertu cenowego:", error);
        showNotification("Nie udało się usunąć alertu. Spróbuj ponownie.", "error");
    }
}

async function onCreatePriceAlert(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!currentUserId) return showNotification("Zaloguj się, aby ustawić alert.", "error");

    const companyId = document.getElementById("price-alert-company").value;
    const direction = document.getElementById("price-alert-direction").value;
    const targetPrice = Number(document.getElementById("price-alert-target").value);
    if (!market[companyId] || !["above", "below"].includes(direction) || !Number.isFinite(targetPrice) || targetPrice <= 0) {
        return showNotification("Podaj prawidłowe ustawienia alertu.", "error");
    }

    try {
        const userRef = doc(db, "uzytkownicy", currentUserId);
        const alertId = doc(collection(db, "uzytkownicy", currentUserId, "priceAlerts")).id;
        await runTransaction(db, async transaction => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("Nie znaleziono profilu użytkownika.");
            const alerts = userDoc.data().priceAlerts || [];
            if (alerts.filter(alert => alert.active).length >= 20) {
                throw new Error("Możesz mieć maksymalnie 20 aktywnych alertów.");
            }
            transaction.update(userRef, {
                priceAlerts: [...alerts, { id: alertId, companyId, direction, targetPrice, active: true, createdAt: Date.now() }]
            });
        });
        form.reset();
        showNotification(`Ustawiono alert dla ${market[companyId].name}.`, "success");
    } catch (error) {
        console.error("Nie udało się ustawić alertu cenowego:", error);
        showNotification(error.message || "Nie udało się ustawić alertu. Spróbuj ponownie.", "error");
    }
}

async function evaluatePriceAlerts() {
    if (!currentUserId) return;

    const eligible = priceAlertDocs.filter(alert => {
        if (!alert.active || pendingPriceAlerts.has(alert.id)) return false;
        const price = market[alert.companyId]?.price;
        return isMarketPriceFresh(alert.companyId) && Number.isFinite(price) && (alert.direction === "above"
            ? price >= alert.targetPrice
            : price <= alert.targetPrice);
    });

    for (const alert of eligible) {
        pendingPriceAlerts.add(alert.id);
        try {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const triggered = await runTransaction(db, async transaction => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) return false;
                const alerts = userDoc.data().priceAlerts || [];
                const data = alerts.find(item => item.id === alert.id && item.active);
                if (!data) return false;
                const price = market[data.companyId]?.price;
                if (!isMarketPriceFresh(data.companyId) || !Number.isFinite(price)) return false;
                const crossed = data.direction === "above" ? price >= data.targetPrice : price <= data.targetPrice;
                if (!crossed) return false;
                transaction.update(userRef, { priceAlerts: alerts.filter(item => item.id !== alert.id) });
                return true;
            });
            if (triggered) {
                priceAlertDocs = priceAlertDocs.filter(item => item.id !== alert.id);
                renderPriceAlerts();
                showNotification(`${market[alert.companyId]?.name || alert.companyId} osiągnęła ${formatujWalute(alert.targetPrice)}.`, "success");
            }
        } catch (error) {
            console.error(`Nie udało się sprawdzić alertu ${alert.id}:`, error);
        } finally {
            pendingPriceAlerts.delete(alert.id);
        }
    }
}

// --- NASŁUCHIWACZ CEN (Główna pętla danych) ---
const cenyDocRef = doc(db, "global", "ceny_akcji");
const MARKET_PRICE_STALE_MS = 3 * 60 * 1000;
const marketSubscriptionStartedAt = Date.now();
let marketDataIssue = null;

function setMarketDataStatus(state, message) {
    const status = document.getElementById("market-data-status");
    if (!status) return;
    status.dataset.state = state;
    status.textContent = message;
}

function refreshMarketDataStatus() {
    if (marketDataIssue) return;
    const lastUpdate = market[currentCompanyId]?.lastUpdatedAt;
    if (lastUpdate === null || lastUpdate === undefined) {
        const waitingTime = Date.now() - marketSubscriptionStartedAt;
        const message = waitingTime >= MARKET_PRICE_STALE_MS
            ? "Brak nowych zmian cen od momentu połączenia"
            : "Weryfikacja notowań...";
        setMarketDataStatus("stale", message);
        return;
    }

    const age = Date.now() - lastUpdate;
    if (age >= MARKET_PRICE_STALE_MS) {
        const minutes = Math.floor(age / 60000);
        setMarketDataStatus("stale", `Brak zmian cen od ${minutes} min`);
    } else {
        setMarketDataStatus("live", "Notowania aktualne");
    }
}

function isMarketPriceFresh(companyId = currentCompanyId) {
    const lastUpdate = market[companyId]?.lastUpdatedAt;
    return !marketDataIssue
        && Number.isFinite(lastUpdate)
        && Date.now() >= lastUpdate
        && Date.now() - lastUpdate < MARKET_PRICE_STALE_MS;
}

setInterval(refreshMarketDataStatus, 15000);
setInterval(renderDividendStatus, 60000);
setInterval(renderMissions, 60000);

onSnapshot(cenyDocRef, { includeMetadataChanges: true }, (docSnap) => {
    if (!docSnap.exists()) {
        marketDataIssue = "missing";
        setMarketDataStatus("error", "Brak dokumentu z notowaniami");
        return;
    }

    marketDataIssue = docSnap.metadata.fromCache ? "cache" : null;
    if (marketDataIssue) {
        setMarketDataStatus("stale", "Dane z pamięci podręcznej; łączenie...");
    }

    const aktualneCeny = docSnap.data();
    if (Number.isFinite(aktualneCeny.bartcoin) && !Number.isFinite(aktualneCeny.nicorp)) {
        aktualneCeny.nicorp = aktualneCeny.bartcoin;
    }
    currentMarketEvent = aktualneCeny.marketEvent || null;
    currentCompanyReports = Array.isArray(aktualneCeny.companyReports) ? aktualneCeny.companyReports : [];
    renderMarketEvent(currentMarketEvent);
    renderCompanyReports(currentCompanyReports);

    let validPriceCount = 0;
    const receivedAt = Date.now();
    for (const companyId in market) {
        const price = aktualneCeny[companyId];
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;

        validPriceCount++;
        if (price !== market[companyId].price) {
            market[companyId].previousPrice = market[companyId].price;
            market[companyId].price = price;
        }
        if (!marketDataIssue) market[companyId].lastUpdatedAt = receivedAt;
    }

    if (validPriceCount === 0) {
        marketDataIssue = "invalid";
        setMarketDataStatus("error", "Otrzymano nieprawidłowe notowania");
        return;
    }

    if (!marketDataIssue) {
        refreshMarketDataStatus();
    }

    if (!chartHasStarted) {
        for (const companyId in market) {
            if (market[companyId].price && market[companyId].history.length === 0) {
                market[companyId].history = generateInitialCandles(50, market[companyId].price);
                market[companyId].previousPrice = market[companyId].price;
            }
        }
    }
    updatePriceUI();
    updatePortfolioUI();
    updateTickerTape();
    renderMarketHeatmap();
    void evaluatePriceAlerts();

    const chartDataReady = market[currentCompanyId] && market[currentCompanyId].history.length > 0;
    if (currentUserId && !chartHasStarted && chartDataReady) {
        if (!chart) initChart();
        startChartTicker();
        chartHasStarted = true;
    }
}, (error) => {
    marketDataIssue = "listener";
    console.error("Błąd nasłuchiwania notowań:", error);
    setMarketDataStatus("error", "Utracono połączenie z notowaniami");
});

// --- FUNKCJE LOGOWANIA I REJESTRACJI ---
async function onRegister(e) {
    e.preventDefault();
    const name = dom.registerForm.querySelector("#register-name").value;
    const email = dom.registerForm.querySelector("#register-email").value;
    const password = dom.registerForm.querySelector("#register-password").value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (cred.user) {
            await setDoc(doc(db, "uzytkownicy", cred.user.uid), {
                name: name, email: email, cash: 10000.00,
                shares: { ulanska: 0, rychbud: 0, brzozair: 0, cosmosanit: 0, nicorp: 0, igirium: 0 },
                stats: { totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 },
                startValue: 10000.00, zysk: 0.00, totalValue: 10000.00,
                missionProgress: normalizeMissionProgress(null),
                dividendDueAt: Timestamp.fromDate(new Date()),
                joinDate: Timestamp.fromDate(new Date()), prestigeLevel: 0,
                lastSeenAt: Date.now()
            });
        }
    } catch (err) { showAuthMessage(err.message, "error"); }
}

async function onLogin(e) {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(
            auth,
            dom.loginForm.querySelector("#login-email").value,
            dom.loginForm.querySelector("#login-password").value
        );
    } catch (err) {
        showAuthMessage(err.message, "error");
    }
}

function onLogout() { signOut(auth); }

async function onResetPassword(e) {
    e.preventDefault();
    const email = dom.loginForm.querySelector("#login-email").value;
    if(!email) return showAuthMessage("Podaj email", "error");
    try { await sendPasswordResetEmail(auth, email); showAuthMessage("Wysłano link", "success"); } catch(err) { showAuthMessage(err.message, "error"); }
}

function onSelectView(e) {
    const viewName = e.currentTarget.dataset.view;
    dom.navButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));

    dom.views.forEach(view => {
        if (view.id === `view-${viewName}`) {
            view.classList.remove("hidden");
            // Małe opóźnienie dla animacji wejścia
            setTimeout(() => view.classList.add("active"), 10);
        } else {
            view.classList.remove("active");
            // Czekamy na koniec animacji wyjścia, potem ukrywamy całkowicie
            setTimeout(() => {
                if(!view.classList.contains('active')) {
                    view.classList.add('hidden');
                }
            }, 500);
        }
    });

    // --- FIX: WYMUSZONE CZYSZCZENIE GIER ---
    // Jeśli wychodzimy z zakładki "entertainment", upewnij się, że gry nie wiszą
    if (viewName !== 'entertainment') {
        // Opcjonalnie: Zatrzymaj aktywne pętle (np. crash)
        // crashIsRunning = false;
        // Ale najważniejsze: upewnij się, że style CSS nie "wyciekają"
    }
}

// --- START APLIKACJI ---
document.addEventListener("DOMContentLoaded", () => {

    dom = {
        // Auth
        authContainer: document.getElementById("auth-container"),
        simulatorContainer: document.getElementById("simulator-container"),
        loginForm: document.getElementById("login-form"),
        registerForm: document.getElementById("register-form"),
        authMessage: document.getElementById("auth-message"),
        resetPasswordLink: document.getElementById("reset-password-link"),
        showRegisterLink: document.getElementById("show-register-link"),
        showLoginLink: document.getElementById("show-login-link"),
        username: document.getElementById("username"),
        logoutButton: document.getElementById("logout-button"),
        userInfo: document.getElementById("user-info"),
        muteButton: document.getElementById("mute-button"),

        // Navigation
        navButtons: document.querySelectorAll(".nav-btn"),
        views: document.querySelectorAll(".view-section"),
        entertainmentCash: document.getElementById("entertainment-cash-display"),

        // Main UI
        tickerContent: document.getElementById("ticker-content"),
        marketHeatmap: document.getElementById("market-heatmap"),
        sportsbookMatches: document.getElementById("sportsbook-matches"),
        sportsbookSlip: document.getElementById("sportsbook-slip"),
        sportsbookBets: document.getElementById("sportsbook-bets"),
        sportsbookCash: document.getElementById("sportsbook-cash"),
        marketTypeTabs: document.querySelectorAll(".market-type-tab"),
        companySelector: document.getElementById("company-selector"),
        cryptoSelector: document.getElementById("crypto-selector"),
        companyName: document.getElementById("company-name"),
        stockPrice: document.getElementById("stock-price"),
        chartContainer: document.getElementById("chart-container"),

        // Portfolio & Orders
        cash: document.getElementById("cash"),
        totalValue: document.getElementById("total-value"),
        totalProfit: document.getElementById("total-profit"),
        sharesList: document.getElementById("shares-list"),
        portfolioChartContainer: document.getElementById("portfolio-chart-container"),
        orderPanel: document.getElementById("order-panel"),
        orderTabMarket: document.querySelector('.order-tab-btn[data-order-type="market"]'),
        orderTabLimit: document.querySelector('.order-tab-btn[data-order-type="limit"]'),
        orderMarketContainer: document.getElementById("order-market-container"),
        orderLimitContainer: document.getElementById("order-limit-container"),
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        buyMaxButton: document.getElementById("buy-max-button"),
        sellMaxButton: document.getElementById("sell-max-button"),
        messageBox: document.getElementById("message-box"),
        cryptoGateMessage: document.querySelector(".crypto-gate-message"),

        // Limit
        limitOrderForm: document.getElementById("limit-order-form"),
        limitType: document.getElementById("limit-type"),
        limitAmount: document.getElementById("limit-amount"),
        limitPrice: document.getElementById("limit-price"),
        limitOrdersFeed: document.getElementById("limit-orders-feed"),

        // Rumors & News
        rumorForm: document.getElementById("rumor-form"),
        rumorInput: document.getElementById("rumor-input"),
        rumorsFeed: document.getElementById("rumors-feed"),
        newsFeed: document.getElementById("news-feed"),
        leaderboardList: document.getElementById("leaderboard-list"),
        playersOnlineTable: document.getElementById("players-online-table"),
        playersOnlineCount: document.getElementById("players-online-count"),

        // Chat
        chatForm: document.getElementById("chat-form"),
        chatInput: document.getElementById("chat-input"),
        chatFeed: document.getElementById("chat-feed"),

        // History & Bonds
        historyTabButtons: document.querySelectorAll("#history-tabs-panel .tab-btn"),
        globalHistoryFeed: document.getElementById("global-history-feed"),
        personalHistoryFeed: document.getElementById("personal-history-feed"),

        // KASYNO
        casinoAmount: document.getElementById("casino-amount"),
        casinoStatus: document.getElementById("casino-status"),

        // PVP
        pvpForm: document.getElementById("pvp-create-form"),
        pvpAmount: document.getElementById("pvp-amount"),
        pvpFeed: document.getElementById("pvp-feed"),

        // CRASH GAME
        crashCanvas: document.getElementById("crash-canvas"),
        crashMultiplierText: document.getElementById("crash-multiplier"),
        crashInfo: document.getElementById("crash-info"),
        crashAmount: document.getElementById("crash-amount"),
        btnCrashAction: document.getElementById("btn-crash-action"),
        crashHistoryList: document.getElementById("crash-history-list"),

        // Modal
        modalOverlay: document.getElementById("user-profile-modal"),
        modalCloseButton: document.getElementById("modal-close-button"),
        modalUsername: document.getElementById("modal-username"),
        modalTotalValue: document.getElementById("modal-total-value"),
        modalTotalProfit: document.getElementById("modal-total-profit"),
        modalCash: document.getElementById("modal-cash"),
        modalSharesList: document.getElementById("modal-shares-list"),
        modalPortfolioChartContainer: document.getElementById("modal-portfolio-chart-container"),
        modalPrestigeLevel: document.getElementById("modal-prestige-level"),
        modalTotalTrades: document.getElementById("modal-total-trades"),
        prestigeInfo: document.getElementById("prestige-info"),
        prestigeNextGoal: document.getElementById("prestige-next-goal"),
        prestigeButton: document.getElementById("prestige-button"),

        // Audio
        audioKaching: document.getElementById("audio-kaching"),
        audioError: document.getElementById("audio-error"),
        audioNews: document.getElementById("audio-news"),
        notificationContainer: document.getElementById("notification-container")
    };

    renderMarketEvent(currentMarketEvent);
    renderCompanyReports(currentCompanyReports);

    // Listenery
    dom.navButtons.forEach(btn => btn.addEventListener("click", onSelectView));
    dom.sportsbookMatches.addEventListener("click", event => {
        const button = event.target.closest(".sportsbook-odd");
        if (!button || button.disabled) return;
        const match = sportsbookMatches.find(item => String(item.id) === button.dataset.matchId);
        const odds = Number(button.dataset.odds);
        if (!match || !Number.isFinite(odds)) return;
        const label = button.dataset.label === "1" ? match.teamA : button.dataset.label === "2" ? match.teamB : "Remis";
        selectedSportsbookBet = {
            matchId: match.id,
            outcome: button.dataset.outcome,
            label,
            odds
        };
        document.getElementById("sportsbook-status").textContent = "";
        renderSportsbook();
    });
    dom.marketHeatmap.addEventListener("click", event => {
        const tile = event.target.closest("[data-heatmap-company]");
        if (!tile) return;
        document.querySelector('.nav-btn[data-view="market"]').click();
        changeCompany(tile.dataset.heatmapCompany);
    });
    dom.registerForm.addEventListener("submit", onRegister);
    dom.loginForm.addEventListener("submit", onLogin);
    document.getElementById("price-alert-form").addEventListener("submit", onCreatePriceAlert);
    document.getElementById("missions-content").addEventListener("click", event => {
        const button = event.target.closest("[data-claim-mission]");
        if (button && !button.disabled) void claimMission(button.dataset.claimMission);
    });
    dom.logoutButton.addEventListener("click", onLogout);
    dom.marketTypeTabs.forEach(tab => tab.addEventListener("click", onSelectMarketType));
    dom.companySelector.addEventListener("click", onSelectCompany);
    dom.cryptoSelector.addEventListener("click", onSelectCompany);
    dom.buyButton.addEventListener("click", buyShares);
    dom.sellButton.addEventListener("click", sellShares);
    dom.buyMaxButton.addEventListener("click", onBuyMax);
    dom.sellMaxButton.addEventListener("click", onSellMax);
    dom.rumorForm.addEventListener("submit", onPostRumor);
    dom.chatForm.addEventListener("submit", onSendMessage);
    dom.limitOrderForm.addEventListener("submit", onPlaceLimitOrder);
    dom.pvpForm.addEventListener("submit", onCreatePvP);
    dom.resetPasswordLink.addEventListener("click", onResetPassword);
    dom.prestigeButton.addEventListener("click", onPrestigeReset);
    dom.orderTabMarket.addEventListener("click", onSelectOrderTab);
    dom.orderTabLimit.addEventListener("click", onSelectOrderTab);
    dom.historyTabButtons.forEach(btn => btn.addEventListener("click", onSelectHistoryTab));
    dom.modalCloseButton.addEventListener("click", () => dom.modalOverlay.classList.add("hidden"));
    dom.modalOverlay.addEventListener("click", (e) => { if (e.target === dom.modalOverlay) dom.modalOverlay.classList.add("hidden"); });
    dom.showRegisterLink.addEventListener("click", (e) => { e.preventDefault(); dom.authContainer.classList.add("show-register"); showAuthMessage(""); });
    dom.showLoginLink.addEventListener("click", (e) => { e.preventDefault(); dom.authContainer.classList.remove("show-register"); showAuthMessage(""); });
    dom.userInfo.addEventListener("click", () => {
    if (currentUserId) showUserProfile(currentUserId);
    });

	// Wewnątrz DOMContentLoaded:
const btnMines = document.getElementById("btn-mines-action");
if(btnMines) btnMines.addEventListener("click", onMinesAction);
initMinesGrid(); // Funkcja rysująca pustą siatkę na start
initializeMiniGolf();
document.getElementById("btn-minigolf-shot").addEventListener("click", takeMiniGolfShot);
document.getElementById("btn-minigolf-new").addEventListener("click", advanceMiniGolf);
document.getElementById("minigolf-power").addEventListener("input", updateMiniGolfControls);
document.getElementById("minigolf-aim").addEventListener("input", updateMiniGolfControls);


    // --- OBSŁUGA WYCISZANIA (MUTE) ---
    let isMuted = localStorage.getItem('gameMuted') === 'true';

    function updateMuteState() {
        const icon = dom.muteButton.querySelector('i');
        if (isMuted) {
            icon.classList.remove('fa-volume-high');
            icon.classList.add('fa-volume-xmark');
            dom.muteButton.style.color = 'var(--red)';
        } else {
            icon.classList.remove('fa-volume-xmark');
            icon.classList.add('fa-volume-high');
            dom.muteButton.style.color = '';
        }
        if(dom.audioKaching) dom.audioKaching.muted = isMuted;
        if(dom.audioError) dom.audioError.muted = isMuted;
        if(dom.audioNews) dom.audioNews.muted = isMuted;
    }

    if(dom.muteButton) {
        updateMuteState();
        dom.muteButton.addEventListener("click", () => {
            isMuted = !isMuted;
            localStorage.setItem('gameMuted', isMuted);
            updateMuteState();
        });
    }

    // --- OBSŁUGA ZAKŁADEK GIER (ZMODYFIKOWANA) ---
    const gameNavButtons = document.querySelectorAll('.game-nav-btn');
    const gameTabs = document.querySelectorAll('.game-tab-content');

    function switchGameTab(e) {
        const targetTab = e.currentTarget.dataset.gameTab;
        const requiredLevel = GAME_UNLOCKS[targetTab] || 0;

        if (portfolio.prestigeLevel < requiredLevel) {
            const stars = '⭐️'.repeat(requiredLevel);
            showMessage(`Wymagany poziom prestiżu: ${requiredLevel} (${stars})`, "error");
            if(dom.audioError) dom.audioError.play().catch(()=>{});
            return;
        }

        gameNavButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.gameTab === targetTab);
        });

        gameTabs.forEach(tab => {
            if (tab.id === `tab-game-${targetTab}`) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    gameNavButtons.forEach(btn => {
        btn.addEventListener('click', switchGameTab);
    });

    // CRASH LISTENERS
    if(dom.btnCrashAction) dom.btnCrashAction.addEventListener("click", onCrashAction);
    if(dom.crashCanvas) initCrashCanvas();

    // --- OBSŁUGA PŁYWAJĄCEGO CZATU ---
    const chatFab = document.getElementById("chat-fab");
    const chatWindow = document.getElementById("floating-chat-window");
    const closeChatBtn = document.getElementById("close-chat-btn");
    const chatBadge = document.getElementById("chat-badge");
    const chatFeedRef = document.getElementById("chat-feed");

    const jitsiFab = document.getElementById("jitsi-fab");
    const jitsiWindow = document.getElementById("jitsi-floating-window");
    const closeJitsiBtn = document.getElementById("close-jitsi-btn");

    function toggleChat(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if(!chatWindow) return;
        chatWindow.classList.toggle("hidden");
        if (!chatWindow.classList.contains("hidden")) {
            if(chatBadge) chatBadge.classList.add("hidden");
            setTimeout(() => {
                if(chatFeedRef) chatFeedRef.scrollTop = chatFeedRef.scrollHeight;
            }, 100);
        }
    }

    function toggleJitsi(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (!jitsiWindow) return;
        jitsiWindow.classList.toggle("hidden");
    }

    if (chatFab) chatFab.addEventListener("click", toggleChat);
    if (closeChatBtn) closeChatBtn.addEventListener("click", toggleChat);
    if (jitsiFab) jitsiFab.addEventListener("click", toggleJitsi);
    if (closeJitsiBtn) closeJitsiBtn.addEventListener("click", toggleJitsi);

    document.addEventListener("click", (e) => {
        const clickTarget = e.target;
        const clickedChatFab = chatFab && (clickTarget === chatFab || chatFab.contains(clickTarget));

        if (chatWindow && !chatWindow.classList.contains("hidden") &&
            !chatWindow.contains(clickTarget) &&
            !clickedChatFab) {
            chatWindow.classList.add("hidden");
        }

    });
    startAuthListener();
});

// --- OBSŁUGA DANYCH PORTFELA ---
function listenToPortfolioData(userId) {
    unsubscribePortfolio = onSnapshot(doc(db, "uzytkownicy", userId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            portfolio.name = data.name;
            portfolio.cash = data.cash;

            let shares = data.shares || {};
            if(shares['bartcoin'] !== undefined) {
                shares['nicorp'] = (shares['nicorp'] || 0) + shares['bartcoin'];
                delete shares['bartcoin'];
            }
            portfolio.shares = shares;

            portfolio.stats = data.stats || portfolio.stats;
            portfolio.startValue = data.startValue;
            portfolio.prestigeLevel = data.prestigeLevel || 0;
            portfolio.missionProgress = data.missionProgress || null;
            portfolio.dividendDueAt = data.dividendDueAt || null;
            portfolio.lastDividendAt = data.lastDividendAt || null;
            portfolio.dividendCount = data.dividendCount || 0;
            priceAlertDocs = Array.isArray(data.priceAlerts) ? data.priceAlerts : [];
            updatePortfolioUI();
            renderSportsbook();
            checkCryptoAccess();
        }
    });
}

function getPlayerOnlineState(userData = {}) {
    const lastSeen = getTimestampMillis(userData.lastSeenAt);
    const isOnline = Number.isFinite(lastSeen) && Date.now() - lastSeen < PLAYERS_ONLINE_TIMEOUT_MS;
    return {
        isOnline,
        label: isOnline ? "online" : "offline",
        text: isOnline ? "ONLINE" : "OFFLINE"
    };
}

function renderPlayersOnline(players = []) {
    const tableBody = document.querySelector("#players-online-table tbody");
    const countLabel = document.getElementById("players-online-count");
    if (!tableBody || !countLabel) return;

    const normalized = players
        .filter(player => player && typeof player.name === "string" && player.name.trim())
        .map(player => ({
            id: player.id || player.uid || "",
            name: player.name.trim(),
            totalValue: Number.isFinite(Number(player.totalValue)) ? Number(player.totalValue) : (Number(player.cash) || 0),
            ...getPlayerOnlineState(player)
        }))
        .sort((a, b) => b.totalValue - a.totalValue);

    const onlineCount = normalized.filter(player => player.isOnline).length;
    countLabel.textContent = String(onlineCount);
    tableBody.replaceChildren();

    if (!normalized.length) {
        const emptyRow = document.createElement("tr");
        emptyRow.innerHTML = `<td colspan="3" style="color: var(--text-muted);">Brak graczy do wyświetlenia.</td>`;
        tableBody.appendChild(emptyRow);
        return;
    }

    normalized.slice(0, 12).forEach(player => {
        const row = document.createElement("tr");
        const isCurrentUser = currentUserId && player.id === currentUserId;
        const nameCell = document.createElement("td");
        const valueCell = document.createElement("td");
        const statusCell = document.createElement("td");

        const nameWrap = document.createElement("span");
        nameWrap.className = `player-name${isCurrentUser ? " is-me" : ""}`;
        nameWrap.textContent = player.name;
        nameCell.appendChild(nameWrap);

        valueCell.textContent = formatujWalute(player.totalValue);

        const status = document.createElement("span");
        status.className = `player-status-pill ${player.label}`;
        status.innerHTML = `<span class="player-status-dot ${player.label === "online" ? "online" : ""}"></span>${player.text}`;
        statusCell.appendChild(status);

        row.appendChild(nameCell);
        row.appendChild(valueCell);
        row.appendChild(statusCell);
        tableBody.appendChild(row);
    });
}

function listenToPlayersOnline() {
    if (unsubscribePlayersOnline) unsubscribePlayersOnline();
    unsubscribePlayersOnline = onSnapshot(
        query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(12)),
        (snapshot) => {
            const players = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            renderPlayersOnline(players);
        },
        (error) => {
            console.error("Błąd pobierania graczy online:", error);
            renderPlayersOnline([]);
        }
    );
}

async function updateCurrentUserPresence() {
    if (!currentUserId) return;
    try {
        await updateDoc(doc(db, "uzytkownicy", currentUserId), { lastSeenAt: Date.now() });
    } catch (error) {
        console.warn("Nie udało się zaktualizować statusu online:", error);
    }
}

function startPresenceHeartbeat() {
    if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    if (!currentUserId) return;
    updateCurrentUserPresence();
    presenceHeartbeatInterval = setInterval(() => {
        if (!currentUserId) return;
        updateCurrentUserPresence();
    }, 30000);
}

// --- ANIMOWANA AKTUALIZACJA PORTFELA ---
function updatePortfolioUI() {
    if (!dom || !dom.username) return;

    const stars = getPrestigeStars(portfolio.prestigeLevel);
    dom.username.innerHTML = `${portfolio.name} ${stars}`;

    // --- 1. ANIMACJA GOTÓWKI (Rolling Numbers) ---
    if (typeof portfolio.displayedCash === 'undefined') {
        portfolio.displayedCash = portfolio.cash;
        dom.cash.textContent = formatujWalute(portfolio.cash);
        if(dom.entertainmentCash) dom.entertainmentCash.textContent = formatujWalute(portfolio.cash);
    } else {
        if (portfolio.displayedCash !== portfolio.cash) {
            animateValue(dom.cash, portfolio.displayedCash, portfolio.cash, 1000);
            if(dom.entertainmentCash) {
                animateValue(dom.entertainmentCash, portfolio.displayedCash, portfolio.cash, 1000);
            }
            portfolio.displayedCash = portfolio.cash;
        }
    }

    // --- 2. OBLICZANIE WARTOŚCI PORTFELA NA BIEŻĄCO ---
    let html = "";
    let sharesValue = 0;
    const series = [portfolio.cash];
    const labels = ['Gotówka'];

    COMPANY_ORDER.forEach(cid => {
        const amount = portfolio.shares[cid] || 0;
        const company = market[cid];
        const currentPrice = company ? company.price : 0;
        const value = amount * currentPrice;

        if (value > 0) {
            sharesValue += value;
            series.push(value);
            labels.push(company.name);
        }

        html += `
            <div class="asset-row">
                <span class="asset-name">${company ? company.name : cid}:</span>
                <span class="asset-value">
                    <strong id="shares-${cid}">${amount}</strong> szt.
                </span>
            </div>`;
    });

    dom.sharesList.innerHTML = html;

    const total = portfolio.cash + sharesValue;
    const profit = total - portfolio.startValue;

    // --- 3. ANIMACJA CAŁKOWITEJ WARTOŚCI ---
    if (typeof portfolio.displayedTotal === 'undefined') {
        portfolio.displayedTotal = total;
        dom.totalValue.textContent = formatujWalute(total);
    } else if (portfolio.displayedTotal !== total) {
        animateValue(dom.totalValue, portfolio.displayedTotal, total, 1000);
        portfolio.displayedTotal = total;
    }

    // --- 4. ANIMACJA ZYSKU ---
    if (typeof portfolio.displayedProfit === 'undefined') {
        portfolio.displayedProfit = profit;
        dom.totalProfit.textContent = formatujWalute(profit);
    } else if (portfolio.displayedProfit !== profit) {
        animateValue(dom.totalProfit, portfolio.displayedProfit, profit, 1000);
        portfolio.displayedProfit = profit;
    }

    dom.totalProfit.style.color = profit >= 0 ? "var(--green)" : "var(--red)";
    portfolio.totalValue = total;
    renderMissions();
    renderDividendStatus();
    renderAchievements();
    renderPriceAlerts();

    if (!portfolioChart) {
        portfolioChart = new ApexCharts(dom.portfolioChartContainer, {
            series: series,
            labels: labels,
            chart: {
                type: 'donut',
                height: 280,
                background: 'transparent',
                fontFamily: 'inherit'
            },
            colors: CHART_COLORS,
            theme: { mode: 'dark' },
            stroke: { show: false },
            dataLabels: { enabled: false },
            legend: { show: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '70%',
                        labels: {
                            show: true,
                            name: { show: true, color: '#888', offsetY: -10 },
                            value: {
                                show: true,
                                color: 'var(--text-main)',
                                fontSize: '22px',
                                fontWeight: 'bold',
                                offsetY: 10,
                                formatter: (val) => formatujWalute(val)
                            },
                            total: {
                                show: true,
                                showAlways: true,
                                label: 'Razem',
                                color: '#888',
                                fontSize: '14px',
                                formatter: function (w) {
                                    const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                    return formatujWalute(sum);
                                }
                            }
                        }
                    }
                }
            }
        });
        portfolioChart.render();
    } else {
        portfolioChart.updateOptions({ series: series, labels: labels });
    }

    if (dom.modalOverlay && !dom.modalOverlay.classList.contains("hidden")) updatePrestigeButton(total, portfolio.prestigeLevel);
}

// --- FUNKCJE HANDLU ---
function onSelectCompany(e) { if(e.target.classList.contains("company-tab")) changeCompany(e.target.dataset.company); }
function changeCompany(cid) {
    if(!market[cid]) return;
    currentCompanyId = cid;
    dom.companyName.textContent = market[cid].name;
    market[cid].displayedPrice = market[cid].price;
    dom.stockPrice.textContent = formatujWalute(market[cid].price);
    document.querySelectorAll(".company-tab").forEach(t => t.classList.toggle("active", t.dataset.company === cid));
    if(chart) chart.updateSeries([{ data: market[cid].history || [] }]);
    refreshMarketDataStatus();
    updatePriceUI();
    checkCryptoAccess();
}

async function buyShares() { await tradeShares(true); }
async function sellShares() { await tradeShares(false); }
async function tradeShares(isBuy) {
    if(dom.orderPanel.classList.contains("crypto-locked")) return showMessage("Wymagany wyższy poziom prestiżu", "error");
    const amount = parseInt(dom.amountInput.value);
    if(isNaN(amount) || amount <= 0) return showMessage("Błędna ilość", "error");
    const cid = currentCompanyId;
    if (!isMarketPriceFresh(cid)) return showMessage("Notowania tej spółki są nieaktualne. Spróbuj ponownie za chwilę.", "error");
    const price = market[cid].price;
    const cost = amount * price;
    try {
        await runTransaction(db, async (t) => {
            const uRef = doc(db, "uzytkownicy", currentUserId);
            const uDoc = await t.get(uRef);
            const d = uDoc.data();
            if(isBuy && d.cash < cost) throw new Error("Brak środków");
            if(!isBuy && (d.shares[cid]||0) < amount) throw new Error("Brak akcji");
            const newCash = isBuy ? d.cash - cost : d.cash + cost;
            const newShares = {...d.shares};
            newShares[cid] = isBuy ? (newShares[cid]||0) + amount : newShares[cid] - amount;
            const newVal = calculateTotalValue(newCash, newShares);
            t.update(uRef, {
                cash: newCash,
                shares: newShares,
                totalValue: newVal,
                missionProgress: advanceMissionProgress(d.missionProgress),
                'stats.totalTrades': increment(1)
            });
        });
        await addDoc(collection(db, "historia_transakcji"), {
            userId: currentUserId, userName: portfolio.name, type: isBuy ? "KUPNO" : "SPRZEDAŻ",
            companyName: market[cid].name, amount, pricePerShare: price, totalValue: isBuy ? -cost : cost,
            timestamp: serverTimestamp(), status: "executed"
        });
        showMessage((isBuy ? "Kupiono " : "Sprzedano ") + amount + " akcji", "success");
    } catch(e) { showMessage(e.message, "error"); }
}

function calculateTotalValue(cash, shares) {
    let val = cash;
    for(let cid in shares) if(market[cid]) val += shares[cid] * market[cid].price;
    return val;
}

// --- INITIALIZATION CHARTS ---
function initChart() {
    chart = new ApexCharts(dom.chartContainer, {
        series: [{ data: market[currentCompanyId].history }],
        chart: { type: 'candlestick', height: 350, toolbar: {show:false}, animations: {enabled:false}, background: 'transparent' },
        theme: { mode: 'dark' },
        xaxis: { type: 'datetime' },
        yaxis: { labels: { formatter: v => v.toFixed(2) } },
        plotOptions: { candlestick: { colors: { upward: '#00e676', downward: '#ff1744' } } }
    });
    chart.render();
}

function startChartTicker() {
    if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
    window.chartTickerInterval = setInterval(() => {
        for (const companyId in market) {
            const company = market[companyId];
            const history = company.history;
            if (!history || history.length === 0) continue;
            const lastCandle = history[history.length - 1];
            const lastTime = new Date(lastCandle.x).getTime();
            const newTime = lastTime + 15000;
            const open = parseFloat(lastCandle.y[3]);
            const close = company.price;
            const volatility = company.price * 0.005;
            const randomHigh = Math.random() * volatility;
            const randomLow = Math.random() * volatility;
            const high = Math.max(open, close) + randomHigh;
            const low = Math.min(open, close) - randomLow;
            const newCandle = {
                x: new Date(newTime),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            };
            history.push(newCandle);
            if (history.length > 50) history.shift();
        }
        if (chart && market[currentCompanyId].history.length > 0) {
            chart.updateSeries([{ data: market[currentCompanyId].history }]);
        }
    }, 15000);
}

// --- AUTH LOGIC START ---
function startAuthListener() {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUserId = user.uid;
            dom.simulatorContainer.classList.remove("hidden");
            dom.authContainer.classList.add("hidden");
            const oneTimeClickListener = () => { unlockAudio(); document.body.removeEventListener('click', oneTimeClickListener); };
            document.body.addEventListener('click', oneTimeClickListener);

            listenToPortfolioData(currentUserId);
            listenToRumors();
            listenToMarketNews();
            listenToLeaderboard();
            listenToPlayersOnline();
            listenToChat();
            listenToGlobalHistory();
            listenToPersonalHistory(currentUserId);
            listenToLimitOrders(currentUserId);
            listenToPvP();
            listenToSportsbook(currentUserId);
            startPresenceHeartbeat();

            dom.navButtons[0].click();
        } else {
            currentUserId = null;
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            dom.authContainer.classList.remove("show-register");

            if (unsubscribePortfolio) unsubscribePortfolio();
            if (unsubscribePlayersOnline) unsubscribePlayersOnline();
            if (unsubscribeSportsbookMatches) unsubscribeSportsbookMatches();
            if (unsubscribeSportsbookBets) unsubscribeSportsbookBets();
            if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
            unsubscribePlayersOnline = null;
            unsubscribeSportsbookMatches = null;
            unsubscribeSportsbookBets = null;
            sportsbookMatches = [];
            selectedSportsbookBet = null;
            sportsbookMatchesError = null;
            sportsbookBetsError = null;
            renderPlayersOnline([]);
            renderSportsbook();
            priceAlertDocs = [];
            pendingPriceAlerts.clear();
            chartHasStarted = false; chart = null; portfolioChart = null;
        }
    });
}

function listenToSportsbook(userId) {
    unsubscribeSportsbookMatches = onSnapshot(doc(db, "global", "zaklady"), snapshot => {
        sportsbookMatchesError = null;
        const data = snapshot.exists() ? snapshot.data() : {};
        sportsbookMatches = Array.isArray(data.mecze) ? data.mecze : [];

        if (selectedSportsbookBet && !sportsbookMatches.some(match =>
            match.id === selectedSportsbookBet.matchId &&
            match.status === "open" &&
            getTimestampMillis(match.closeTime) > Date.now()
        )) {
            selectedSportsbookBet = null;
        }
        renderSportsbook();
    }, error => {
        sportsbookMatchesError = "Nie udało się pobrać meczów. Spróbuj ponownie później.";
        console.error("Błąd nasłuchiwania meczów bukmacherskich:", error);
        renderSportsbook();
    });

    unsubscribeSportsbookBets = onSnapshot(
        query(collection(db, "active_bets"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(20)),
        snapshot => {
            sportsbookBetsError = null;
            renderSportsbookBets(snapshot.docs.map(betDoc => betDoc.data()));
        },
        error => {
            sportsbookBetsError = "Nie udało się pobrać historii kuponów.";
            console.error("Błąd nasłuchiwania kuponów:", error);
            renderSportsbookBets([]);
        }
    );
}

function renderSportsbook() {
    if (!dom.sportsbookMatches) return;
    dom.sportsbookCash.textContent = formatujWalute(portfolio.cash);
    dom.sportsbookMatches.replaceChildren();

    if (sportsbookMatchesError) {
        dom.sportsbookMatches.appendChild(createSportsbookMessage(sportsbookMatchesError));
        renderSportsbookSlip();
        return;
    }

    const matches = sportsbookMatches
        .filter(match => typeof match.teamA === "string" && typeof match.teamB === "string")
        .sort((a, b) => (getTimestampMillis(a.closeTime) || 0) - (getTimestampMillis(b.closeTime) || 0));
    if (matches.length === 0) {
        dom.sportsbookMatches.appendChild(createSportsbookMessage("Brak zaplanowanych meczów."));
        renderSportsbookSlip();
        return;
    }

    matches.forEach(match => {
        const closeTime = getTimestampMillis(match.closeTime);
        const isOpen = match.status === "open" && closeTime !== null && closeTime > Date.now();
        const card = document.createElement("article");
        card.className = "sportsbook-match";

        const details = document.createElement("div");
        details.className = "sportsbook-match-details";
        const date = document.createElement("span");
        date.className = "sportsbook-match-date";
        date.textContent = closeTime === null ? "Termin nieznany" : new Date(closeTime).toLocaleString("pl-PL", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
        });
        const teams = document.createElement("strong");
        teams.textContent = `${match.teamA} — ${match.teamB}`;
        const status = document.createElement("span");
        status.className = `sportsbook-match-status${isOpen ? "" : " is-closed"}`;
        status.textContent = isOpen ? "OTWARTY" : match.status === "resolved" ? "ROZLICZONY" : "ZAMKNIĘTY";
        details.append(date, teams, status);

        const odds = document.createElement("div");
        odds.className = "sportsbook-odds";
        [
            ["teamA", "1", match.oddsA],
            ["draw", "X", match.oddsDraw],
            ["teamB", "2", match.oddsB]
        ].forEach(([outcome, label, value]) => {
            const odd = Number(value);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "sportsbook-odd";
            button.disabled = !isOpen || !Number.isFinite(odd) || odd <= 1 || !match.id;
            button.dataset.matchId = String(match.id || "");
            button.dataset.outcome = outcome;
            button.dataset.odds = String(odd);
            button.dataset.label = label;
            button.setAttribute("aria-pressed",
                selectedSportsbookBet?.matchId === match.id && selectedSportsbookBet?.outcome === outcome ? "true" : "false");
            const name = document.createElement("span");
            name.textContent = label;
            const price = document.createElement("strong");
            price.textContent = Number.isFinite(odd) && odd > 1 ? odd.toFixed(2) : "—";
            button.append(name, price);
            odds.appendChild(button);
        });

        card.append(details, odds);
        dom.sportsbookMatches.appendChild(card);
    });
    renderSportsbookSlip();
}

function createSportsbookMessage(text) {
    const message = document.createElement("p");
    message.className = "sportsbook-empty";
    message.textContent = text;
    return message;
}

function renderSportsbookSlip() {
    if (!dom.sportsbookSlip) return;
    dom.sportsbookSlip.replaceChildren();
    if (!selectedSportsbookBet) {
        dom.sportsbookSlip.appendChild(createSportsbookMessage("Wybierz kurs, aby dodać typ do kuponu."));
        return;
    }

    const match = sportsbookMatches.find(item => item.id === selectedSportsbookBet.matchId);
    if (!match) return;
    const selection = document.createElement("p");
    selection.className = "sportsbook-slip-selection";
    selection.textContent = `${match.teamA} — ${match.teamB} · ${selectedSportsbookBet.label} @ ${selectedSportsbookBet.odds.toFixed(2)}`;
    const stakeLabel = document.createElement("label");
    stakeLabel.htmlFor = "sportsbook-stake";
    stakeLabel.textContent = "Stawka (zł)";
    const stakeInput = document.createElement("input");
    stakeInput.id = "sportsbook-stake";
    stakeInput.className = "dark-input";
    stakeInput.type = "number";
    stakeInput.min = "1";
    stakeInput.step = "1";
    stakeInput.inputMode = "numeric";
    stakeInput.value = "100";
    stakeInput.required = true;
    const payout = document.createElement("p");
    payout.className = "sportsbook-payout";
    const updatePayout = () => {
        const amount = Number(stakeInput.value);
        payout.textContent = Number.isSafeInteger(amount) && amount > 0
            ? `Potencjalna wypłata: ${formatujWalute(amount * selectedSportsbookBet.odds)}`
            : "Podaj stawkę w pełnych złotych.";
    };
    stakeInput.addEventListener("input", updatePayout);
    updatePayout();

    const actions = document.createElement("div");
    actions.className = "sportsbook-slip-actions";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn-accent";
    submit.textContent = submittingSportsbookBet ? "Przyjmowanie..." : "Postaw zakład";
    submit.disabled = submittingSportsbookBet;
    submit.addEventListener("click", () => void placeSportsbookBet(Number(stakeInput.value)));
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "sportsbook-clear";
    clear.textContent = "Usuń typ";
    clear.disabled = submittingSportsbookBet;
    clear.addEventListener("click", () => {
        selectedSportsbookBet = null;
        renderSportsbook();
    });
    actions.append(submit, clear);
    dom.sportsbookSlip.append(selection, stakeLabel, stakeInput, payout, actions);
}

function renderSportsbookBets(bets) {
    if (!dom.sportsbookBets) return;
    dom.sportsbookBets.replaceChildren();
    if (sportsbookBetsError) {
        dom.sportsbookBets.appendChild(createSportsbookMessage(sportsbookBetsError));
        return;
    }
    if (bets.length === 0) {
        dom.sportsbookBets.appendChild(createSportsbookMessage("Nie masz jeszcze żadnych kuponów."));
        return;
    }

    bets.forEach(bet => {
        const row = document.createElement("article");
        row.className = "sportsbook-bet-row";
        const description = document.createElement("div");
        const match = document.createElement("strong");
        match.textContent = `${bet.teamA || "Mecz"} — ${bet.teamB || ""}`;
        const details = document.createElement("span");
        const selection = bet.selection || (bet.betOn === "teamA" ? bet.teamA :
            bet.betOn === "teamB" ? bet.teamB : bet.betOn === "draw" ? "Remis" : bet.betOn) || "Typ";
        const odds = Number(bet.odds);
        details.textContent = `${selection} @ ${Number.isFinite(odds) ? odds.toFixed(2) : "—"} · stawka ${formatujWalute(Number(bet.betAmount) || 0)}`;
        description.append(match, details);
        const status = document.createElement("span");
        status.className = `sportsbook-bet-status ${bet.status || "pending"}`;
        status.textContent = bet.status === "won" ? "WYGRANA" : bet.status === "lost" ? "PRZEGRANA" : "OCZEKUJE";
        row.append(description, status);
        dom.sportsbookBets.appendChild(row);
    });
}

async function placeSportsbookBet(amount) {
    if (!currentUserId || !selectedSportsbookBet) {
        showMessage("Zaloguj się i wybierz typ przed postawieniem zakładu.", "error");
        return;
    }
    if (!Number.isSafeInteger(amount) || amount < 1) {
        showMessage("Stawka musi być pełną kwotą w złotych.", "error");
        return;
    }

    const selection = { ...selectedSportsbookBet };
    if (!Number.isFinite(amount * selection.odds) || amount * selection.odds > Number.MAX_SAFE_INTEGER) {
        showMessage("Potencjalna wypłata przekracza dozwoloną wartość.", "error");
        return;
    }
    const userRef = doc(db, "uzytkownicy", currentUserId);
    const matchesRef = doc(db, "global", "zaklady");
    const betRef = doc(collection(db, "active_bets"));
    submittingSportsbookBet = true;
    renderSportsbookSlip();
    try {
        await runTransaction(db, async transaction => {
            const userSnapshot = await transaction.get(userRef);
            const matchesSnapshot = await transaction.get(matchesRef);
            if (!userSnapshot.exists()) throw new Error("Nie znaleziono profilu użytkownika.");
            if (!matchesSnapshot.exists()) throw new Error("Lista meczów jest niedostępna.");

            const matches = matchesSnapshot.data().mecze;
            const match = Array.isArray(matches) ? matches.find(item => item.id === selection.matchId) : null;
            const closeTime = match ? getTimestampMillis(match.closeTime) : null;
            const currentOdds = match
                ? Number(selection.outcome === "teamA" ? match.oddsA : selection.outcome === "draw" ? match.oddsDraw : match.oddsB)
                : NaN;
            if (!match || match.status !== "open" || closeTime === null || closeTime <= Date.now()) {
                throw new Error("Zakłady na ten mecz są już zamknięte.");
            }
            if (!Number.isFinite(currentOdds) || currentOdds <= 1 || currentOdds !== selection.odds) {
                throw new Error("Kurs uległ zmianie. Wybierz aktualny kurs ponownie.");
            }

            const user = userSnapshot.data();
            const cash = Number(user.cash);
            if (!Number.isFinite(cash) || cash < amount) throw new Error("Nie masz wystarczających środków.");
            const newCash = cash - amount;
            transaction.update(userRef, {
                cash: newCash,
                totalValue: calculateTotalValue(newCash, user.shares || {})
            });
            transaction.set(betRef, {
                userId: currentUserId,
                matchId: selection.matchId,
                betOn: selection.outcome,
                selection: selection.label,
                teamA: match.teamA,
                teamB: match.teamB,
                odds: currentOdds,
                betAmount: amount,
                status: "pending",
                createdAt: serverTimestamp()
            });
        });
        selectedSportsbookBet = null;
        document.getElementById("sportsbook-status").textContent = "Zakład został przyjęty.";
        showMessage("Zakład został przyjęty.", "success");
    } catch (error) {
        console.error("Nie udało się postawić zakładu:", error);
        document.getElementById("sportsbook-status").textContent = error.message || "Nie udało się postawić zakładu.";
        showMessage(error.message || "Nie udało się postawić zakładu.", "error");
    } finally {
        submittingSportsbookBet = false;
        renderSportsbook();
    }
}

function unlockAudio() {
    if (audioUnlocked) return;
    try {
        dom.audioKaching.play().catch(e => {}); dom.audioKaching.pause();
        dom.audioError.play().catch(e => {}); dom.audioError.pause();
        dom.audioNews.play().catch(e => {}); dom.audioNews.pause();
        audioUnlocked = true;
    } catch (e) {}
}


// --- HANDLERS (Pozostałe) ---
function onBuyMax() {
    if (!isMarketPriceFresh()) return showMessage("Notowania tej spółki są nieaktualne. Spróbuj ponownie za chwilę.", "error");
    const price = market[currentCompanyId].price;
    if (price > 0) dom.amountInput.value = Math.floor(portfolio.cash / price);
}
function onSellMax() { dom.amountInput.value = portfolio.shares[currentCompanyId]||0; }
function onSelectMarketType(e) {
    const type = e.target.dataset.marketType;

    // --- BLOKADA KRYPTO (Poziom 4) ---
    if (type === 'crypto' && portfolio.prestigeLevel < CRYPTO_PRESTIGE_REQUIREMENT) {
        e.preventDefault();
        showMessage(`Krypto wymaga ${CRYPTO_PRESTIGE_REQUIREMENT} poziomu prestiżu!`, "error");
        return;
    }
    // ---------------------------

    dom.marketTypeTabs.forEach(t => t.classList.toggle("active", t.dataset.marketType === type));
    dom.companySelector.classList.toggle("hidden", type !== 'stocks');
    dom.cryptoSelector.classList.toggle("hidden", type !== 'crypto');

    changeCompany(type === 'stocks' ? 'ulanska' : 'nicorp');
}
function onSelectOrderTab(e) {
    const t = e.target.dataset.orderType;
    dom.orderTabMarket.classList.toggle("active", t === 'market');
    dom.orderTabLimit.classList.toggle("active", t === 'limit');
    dom.orderMarketContainer.classList.toggle("active", t === 'market');
    dom.orderLimitContainer.classList.toggle("active", t === 'limit');
}
function onSelectHistoryTab(e) {
    const t = e.target.dataset.tab;
    dom.historyTabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === t));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === `tab-${t}`));
}

// --- NEWSY I PLOTKI ---
function listenToMarketNews() {
    unsubscribeNews = onSnapshot(query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(10)), snap => {
        if (!initialNewsLoaded) dom.newsFeed.innerHTML = "";

        snap.docChanges().forEach(change => {
            if (change.type === 'added') {
                const n = change.doc.data();

                if (initialNewsLoaded) showNotification(n.text, 'news', n.impactType);

                const iconClass = n.impactType === 'positive' ? 'fa-arrow-trend-up' : 'fa-triangle-exclamation';

                const html = `
                    <div class="feed-item ${n.impactType}">
                        <div class="feed-icon"><i class="fa-solid ${iconClass}"></i></div>
                        <div class="feed-content">
                            <div class="feed-header">
                                <span>WIADOMOŚĆ RYNKOWA</span>
                            </div>
                            <div class="feed-text">${n.text}</div>
                        </div>
                    </div>
                `;

                dom.newsFeed.insertAdjacentHTML('afterbegin', html);
                if (dom.newsFeed.children.length > 10) {
                    dom.newsFeed.lastElementChild.remove();
                }
            }
        });
        initialNewsLoaded = true;
    });
}

function listenToRumors() {
    unsubscribeRumors = onSnapshot(query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(15)), snap => {
        dom.rumorsFeed.innerHTML = "";
        snap.forEach(d => {
            const r = d.data();
            const companyName = market[r.companyId] ? market[r.companyId].name : '???';

            const impactClass = r.sentiment === 'positive' ? 'positive' : 'negative';
            const iconClass = r.sentiment === 'positive' ? 'fa-bullhorn' : 'fa-user-secret';

            const html = `
                <div class="feed-item ${impactClass}">
                    <div class="feed-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="feed-content">
                        <div class="feed-header">
                            <span>${companyName}</span>
                            <span style="font-weight:normal; opacity:0.7">Plotka</span>
                        </div>
                        <div class="feed-text">${r.text}</div>
                        <span class="feed-author">~ ${r.authorName} ${getPrestigeStars(r.prestigeLevel || 0)}</span>
                    </div>
                </div>
            `;
            dom.rumorsFeed.innerHTML += html;
        });
    });
}
async function onPostRumor(e) {
    e.preventDefault();
    const txt = dom.rumorInput.value;
    const cid = document.getElementById("rumor-company-select").value;
    const sent = document.querySelector('input[name="sentiment"]:checked').value;
    if(!txt) return;
    await addDoc(collection(db, "plotki"), { text: txt, authorId: currentUserId, authorName: portfolio.name, prestigeLevel: portfolio.prestigeLevel, timestamp: new Date(), companyId: cid, sentiment: sent, impact: (Math.random()*0.04+0.01)*(sent==='positive'?1:-1) });
    dom.rumorInput.value = "";
}

// --- POZOSTAŁE FUNKCJE ---

function listenToChat() {
    unsubscribeChat = onSnapshot(query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(30)), snap => {
        dom.chatFeed.innerHTML = "";
        snap.docs.slice().reverse().forEach(d => {
            const m = d.data();
            dom.chatFeed.innerHTML += `<p class="${m.authorId===currentUserId?'my-message':''}"><strong onclick="showUserProfile('${m.authorId}')">${m.authorName}</strong>${getPrestigeStars(m.prestigeLevel,'chat')}: ${m.text}</p>`;
        });
        dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
        if (initialChatLoaded) {
            snap.docChanges().forEach(change => {
                if (change.type === "added") {
                    const m = change.doc.data();
                    if (m.authorId !== currentUserId) {
                        showNotification(`${m.authorName}: ${m.text}`, 'chat');

                        const floatWindow = document.getElementById("floating-chat-window");
                        const badge = document.getElementById("chat-badge");
                        if (floatWindow && floatWindow.classList.contains("hidden") && badge) {
                            badge.classList.remove("hidden");
                        }
                    }
                }
            });
        }
        initialChatLoaded = true;
    });
}
async function onSendMessage(e) {
    e.preventDefault();
    if(isChatCooldown) return showMessage("Zwolnij!", "error");
    const txt = dom.chatInput.value.trim();
    if(!txt) return;
    isChatCooldown = true;
    await addDoc(collection(db, "chat_messages"), { text: txt, authorName: portfolio.name, authorId: currentUserId, prestigeLevel: portfolio.prestigeLevel, timestamp: serverTimestamp() });
    dom.chatInput.value = "";
    setTimeout(() => isChatCooldown = false, 15000);
}

function listenToLeaderboard() {
    unsubscribeLeaderboard = onSnapshot(query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10)), snap => {
        dom.leaderboardList.innerHTML = "";
        let r = 1;
        snap.forEach(d => {
            const u = d.data();
            dom.leaderboardList.innerHTML += `
                <li class="${d.id === currentUserId ? 'highlight-me' : ''}">
                    <div onclick="showUserProfile('${d.id}')">
                        ${r}. ${u.name} ${getPrestigeStars(u.prestigeLevel)}
                    </div>
                    <div>${formatujWalute(u.totalValue)}</div>
                </li>`;
            r++;
        });
    });
}

async function onPlaceLimitOrder(e) {
    e.preventDefault();
    if (!currentUserId) return;
    if (dom.orderPanel.classList.contains("crypto-locked")) return showMessage("Wymagany wyższy poziom", "error");
    const type = dom.limitType.value;
    const amount = parseInt(dom.limitAmount.value);
    const limitPrice = parseFloat(dom.limitPrice.value);
    const cid = currentCompanyId;
    const isBuy = type === 'buy';
    const isCrypto = market[cid].type === 'crypto';

    if (amount <= 0 || limitPrice <= 0) return showMessage("Błędne dane", "error");
    if (isBuy && amount * limitPrice > portfolio.cash) return showMessage("Brak gotówki", "error");
    if (!isBuy && amount > (portfolio.shares[cid]||0)) return showMessage("Brak akcji", "error");

    try {
        const orderType = isBuy ? (isCrypto?"KUPNO (Limit, Krypto)":"KUPNO (Limit)") : (isCrypto?"SPRZEDAŻ (Limit, Krypto)":"SPRZEDAŻ (Limit)");
        await addDoc(collection(db, "limit_orders"), {
            userId: currentUserId, userName: portfolio.name, prestigeLevel: portfolio.prestigeLevel,
            companyId: cid, companyName: market[cid].name, type: orderType,
            amount, limitPrice, status: "pending", timestamp: serverTimestamp()
        });
        showMessage("Zlecenie limit przyjęte!", "success");
        dom.limitOrderForm.reset();
    } catch(e) { showMessage("Błąd serwera", "error"); }
}

function listenToLimitOrders(userId) {
    if (unsubscribeLimitOrders) unsubscribeLimitOrders();

    unsubscribeLimitOrders = onSnapshot(query(collection(db, "limit_orders"), where("userId", "==", userId), orderBy("timestamp", "desc")), snap => {
        dom.limitOrdersFeed.innerHTML = "";
        if (snap.empty) {
            dom.limitOrdersFeed.innerHTML = "<p style='padding:10px; color:var(--text-muted); text-align:center;'>Brak aktywnych zleceń limit.</p>";
            return;
        }

        snap.forEach(d => {
            const o = d.data();
            const div = document.createElement("div");
            div.className = "history-row";

            const isBuy = o.type.includes("KUPNO");
            const typeClass = isBuy ? "h-buy" : "h-sell";
            const typeLabel = isBuy ? "KUPNO" : "SPRZED.";

            let timeStr = "--:--";
            if (o.timestamp) {
                timeStr = new Date(o.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            let actionHtml = `<span class="h-time">${o.status}</span>`;
            if (o.status === 'pending') {
                actionHtml = `<button onclick="cancelLimit('${d.id}')" style="background: transparent; border: 1px solid var(--red); color: var(--red); padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em; font-weight:bold;">ANULUJ</button>`;
            }

            div.innerHTML = `
                <span class="h-col h-time">${timeStr}</span>
                <span class="h-col h-type ${typeClass}">${typeLabel}</span>
                <span class="h-col h-asset">
                    ${o.companyName}
                    <br><span style="font-size:0.8em; color:var(--text-muted); font-weight:normal;">${o.amount} szt. po ${o.limitPrice} zł</span>
                </span>
                <span class="h-col h-val" style="text-align:right;">${actionHtml}</span>
            `;

            dom.limitOrdersFeed.appendChild(div);
        });
    });
}
window.cancelLimit = async function(id) { if(confirm("Anulować?")) await updateDoc(doc(db, "limit_orders", id), {status: "cancelled"}); };

function getSeededRandom(seedStr) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h >>> 0) / 4294967296);
    }
}

function listenToPvP() {
    if (typeof unsubscribePvP !== 'undefined' && unsubscribePvP) unsubscribePvP();

    const q = query(
        collection(db, "pvp_duels"),
        where("status", "in", ["open", "battling"]),
        limit(20)
    );

    unsubscribePvP = onSnapshot(q, (snap) => {
        dom.pvpFeed.innerHTML = "";

        let duels = [];
        snap.forEach(doc => duels.push({ id: doc.id, ...doc.data() }));

        duels.sort((a, b) => b.createdAt - a.createdAt);

        if (duels.length === 0) {
            dom.pvpFeed.innerHTML = "<p>Arena jest pusta. Stwórz wyzwanie!</p>";
            return;
        }

        duels.forEach(duel => {
            if (duel.status === 'battling' && !playedAnimations.has(duel.id)) {
                playedAnimations.add(duel.id);
                triggerGlobalPvPAnimation(duel);
            }

            const isMyDuel = duel.creatorId === currentUserId;
            const div = document.createElement("div");
            div.className = "pvp-item";

            let btnHtml = "";

            if (duel.status === 'battling') {
                div.classList.add('battling');
                btnHtml = `<span class="pvp-status-battling" style="color:var(--accent-color); font-weight:bold;">🎰 LOSOWANIE...</span>`;
            } else if (isMyDuel) {
                btnHtml = `<button class="pvp-join-btn" disabled style="background:#555; cursor:default;">Twoje</button>`;
            } else {
                btnHtml = `<button class="pvp-join-btn" onclick="joinPvP('${duel.id}', ${duel.amount}, '${duel.creatorName}')">WALCZ!</button>`;
            }

            div.innerHTML = `
                <div class="pvp-info">
                    <strong>${formatujWalute(duel.amount)}</strong>
                    <span>vs ${duel.creatorName} ${getPrestigeStars(duel.creatorPrestige || 0)}</span>
                </div>
                <div>${btnHtml}</div>
            `;
            dom.pvpFeed.appendChild(div);
        });
    });
}

async function onCreatePvP(e) {
    e.preventDefault();
    const amount = parseFloat(dom.pvpAmount.value);

    if (isNaN(amount) || amount < 1000) return showMessage("Minimum 1000 zł!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            const userData = userDoc.data();

            if (userData.cash < amount) throw new Error("Za mało gotówki!");

            const newCash = userData.cash - amount;
            const newVal = calculateTotalValue(newCash, userData.shares);

            t.update(userRef, { cash: newCash, totalValue: newVal });

            const duelRef = doc(collection(db, "pvp_duels"));
            t.set(duelRef, {
                creatorId: currentUserId,
                creatorName: portfolio.name,
                creatorPrestige: portfolio.prestigeLevel || 0,
                amount: amount,
                status: "open",
                createdAt: serverTimestamp()
            });
        });

        showMessage("Wyzwanie rzucone na arenę!", "success");
        dom.pvpAmount.value = "";

        await addDoc(collection(db, "chat_messages"), {
            text: `⚔️ Stworzyłem wyzwanie PvP na ${formatujWalute(amount)}! Kto się odważy?`,
            authorName: "SYSTEM", authorId: "sys", prestigeLevel: 0, timestamp: serverTimestamp()
        });

    } catch (e) {
        showMessage("Błąd: " + e.message, "error");
    }
}

window.joinPvP = async function(duelId, amount, opponentName) {
    if (!confirm(`Czy na pewno chcesz postawić ${formatujWalute(amount)} i walczyć z ${opponentName}? Szansa wygranej: 50%.`)) return;
    if (portfolio.cash < amount) return showMessage("Nie stać Cię na tę walkę!", "error");

    try {
        let winnerName = "";
        let winnerAmount = amount * 2;

        await runTransaction(db, async (t) => {
            const duelRef = doc(db, "pvp_duels", duelId);
            const joinerRef = doc(db, "uzytkownicy", currentUserId);
            const duelDoc = await t.get(duelRef);
            const joinerDoc = await t.get(joinerRef);

            if (!duelDoc.exists()) throw new Error("Wyzwanie nie istnieje!");
            if (duelDoc.data().status !== "open") throw new Error("Ktoś był szybszy!");
            if (joinerDoc.data().cash < amount) throw new Error("Brak środków!");

            const creatorRef = doc(db, "uzytkownicy", duelDoc.data().creatorId);
            const creatorWins = Math.random() > 0.5;
            let joinerCash = joinerDoc.data().cash - amount;

            if (creatorWins) {
                winnerName = duelDoc.data().creatorName;
                t.update(creatorRef, { cash: increment(winnerAmount), totalValue: increment(winnerAmount), zysk: increment(amount) });
                t.update(joinerRef, { cash: joinerCash, totalValue: calculateTotalValue(joinerCash, joinerDoc.data().shares), zysk: increment(-amount) });
            } else {
                winnerName = portfolio.name;
                joinerCash += winnerAmount;
                t.update(joinerRef, { cash: joinerCash, totalValue: calculateTotalValue(joinerCash, joinerDoc.data().shares), zysk: increment(amount) });
                t.update(creatorRef, { zysk: increment(-amount) });
            }

            t.update(duelRef, {
                status: "battling",
                winner: winnerName,
                joinerId: currentUserId,
                joinerName: portfolio.name
            });
        });

        await addDoc(collection(db, "chat_messages"), {
           text: `⚔️ PVP: ${portfolio.name} przyjął wyzwanie ${opponentName}! Losowanie zwycięzcy...`,
           authorName: "SĘDZIA", authorId: "sys", prestigeLevel: 0, timestamp: serverTimestamp()
        });

    } catch (e) {
        showMessage("Błąd: " + e.message, "error");
    }
};

function triggerGlobalPvPAnimation(duel) {
    const container = document.getElementById('pvp-embedded-roulette');
    const strip = document.getElementById('roulette-strip');
    const winnerText = document.getElementById('pvp-roulette-winner');
    const title = document.getElementById('pvp-vs-title');

    const rng = getSeededRandom(duel.id);

    container.classList.remove('hidden');

    strip.innerHTML = "";
    strip.style.transition = "none";
    strip.style.transform = "translateX(0px)";
    winnerText.textContent = "LOSOWANIE...";
    winnerText.className = "pvp-winner-text";
    winnerText.style.color = "var(--text-color)";

    if(title) title.innerHTML = `<span style="color:var(--blue)">${duel.creatorName}</span> vs <span style="color:var(--red)">${duel.joinerName}</span>`;

    const totalCards = 90;
    const cardsData = [];

    for (let i = 0; i < totalCards; i++) {
        if (i === WINNER_INDEX) {
            cardsData.push(duel.winner === duel.creatorName ? 'creator' : 'joiner');
        } else {
            cardsData.push(rng() > 0.5 ? 'creator' : 'joiner');
        }
    }

    cardsData.forEach(type => {
        const div = document.createElement('div');
        const isCreator = type === 'creator';
        div.className = `roulette-card ${isCreator ? 'card-creator' : 'card-joiner'}`;
        const name = isCreator ? duel.creatorName : duel.joinerName;
        const icon = isCreator ? '🔵' : '🔴';
        div.innerHTML = `<div class="card-icon">${icon}</div><div>${name}</div>`;
        strip.appendChild(div);
    });

    const windowElement = document.querySelector('.roulette-window.embedded');
    const windowWidth = windowElement ? windowElement.offsetWidth : 300;
    const winnerCenterPosition = (WINNER_INDEX * CARD_WIDTH) + (CARD_WIDTH / 2);

    const randomOffset = (rng() - 0.5) * (CARD_WIDTH * 0.7);

    const targetTranslate = (windowWidth / 2) - (winnerCenterPosition + randomOffset);

    setTimeout(() => {
        strip.style.transition = "transform 5s cubic-bezier(0.15, 0.85, 0.35, 1.0)";
        strip.style.transform = `translateX(${targetTranslate}px)`;

        setTimeout(() => {
            if (duel.winner === portfolio.name) {
                winnerText.textContent = "WYGRAŁEŚ!";
                winnerText.style.color = "var(--green)";
                if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
            } else {
                winnerText.textContent = `WYGRAŁ: ${duel.winner}`;
                winnerText.style.color = (duel.winner === duel.creatorName) ? "var(--blue)" : "var(--red)";

                if((currentUserId === duel.creatorId || currentUserId === duel.joinerId) && duel.winner !== portfolio.name) {
                   if(dom.audioError) dom.audioError.play().catch(()=>{});
                }
            }
            winnerText.classList.add('animate-winner-text');

            setTimeout(() => {
                container.classList.add('hidden');
                if (currentUserId === duel.joinerId) {
                    closeDuelInDb(duel.id);
                }
            }, 5000);

        }, 5000);

    }, 100);
}

async function closeDuelInDb(duelId) {
    try { await updateDoc(doc(db, "pvp_duels", duelId), { status: "closed" }); } catch(e) {}
}

// --- RULETKA ---
let isSpinning = false;
let currentSelection = null;
window.selectBetType = function(type, value) {
    if(isSpinning) return;
    currentSelection = { type, value };
    document.querySelectorAll('.casino-btn, .num-btn').forEach(b => b.classList.remove('selected'));
    if(type === 'color') document.querySelector(`.btn-${value}`).classList.add('selected');
    else document.querySelector(`.num-${value}`).classList.add('selected');
    dom.casinoStatus.textContent = `Wybrano: ${value}`;
};

window.commitSpin = async function() {
    if (isSpinning) return;
    if (!currentUserId) return showMessage("Zaloguj się!", "error");
    if (!currentSelection) return showMessage("Wybierz stawkę (kolor lub liczbę)!", "error");

    const amount = parseInt(dom.casinoAmount.value);
    if (isNaN(amount) || amount <= 0) return showMessage("Podaj poprawną kwotę!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    isSpinning = true;
    dom.casinoStatus.textContent = "Kręcimy... Powodzenia!";

    const allBtns = document.querySelectorAll('.casino-btn, .num-btn, .spin-btn');
    allBtns.forEach(b => b.disabled = true);
    if(dom.amountInput) dom.amountInput.disabled = true;

    const innerRing = document.querySelector('.inner');
    const dataContainer = document.querySelector('.data');
    const resultNumberEl = document.querySelector('.result-number');
    const resultColorEl = document.querySelector('.result-color');
    const resultBg = document.querySelector('.result');

    innerRing.removeAttribute('data-spinto');
    innerRing.classList.remove('rest');
    dataContainer.classList.remove('reveal');

    const winningNumber = Math.floor(Math.random() * 37);

    const redNumbers = [32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3];
    let resultColor = 'black';
    if (winningNumber === 0) resultColor = 'green';
    else if (redNumbers.includes(winningNumber)) resultColor = 'red';

    setTimeout(() => {
        innerRing.setAttribute('data-spinto', winningNumber);
    }, 50);

    const spinDuration = 6000;

    try {
        await new Promise(r => setTimeout(r, spinDuration));

        innerRing.classList.add('rest');
        resultNumberEl.textContent = winningNumber;
        resultColorEl.textContent = resultColor === 'red' ? 'CZERWONE' : (resultColor === 'black' ? 'CZARNE' : 'ZIELONE');
        resultBg.style.backgroundColor = resultColor === 'red' ? 'var(--red)' : (resultColor === 'green' ? 'var(--green)' : '#111');
        dataContainer.classList.add('reveal');

        const historyList = document.getElementById('previous-list');
        if(historyList) {
            const li = document.createElement('li');
            li.className = `previous-result color-${resultColor}`;
            li.textContent = winningNumber;
            historyList.prepend(li);
            if(historyList.children.length > 12) historyList.lastChild.remove();
        }

        let multiplier = 0;
        if (currentSelection.type === 'color' && currentSelection.value === resultColor) {
            multiplier = resultColor === 'green' ? 36 : 2;
        } else if (currentSelection.type === 'number' && parseInt(currentSelection.value) === winningNumber) {
            multiplier = 36;
        }

        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            const d = userDoc.data();

            if (d.cash < amount) throw new Error("Brak środków (walidacja serwera)");

            let newCash = d.cash;
            let newProfit = d.zysk || 0;

            if (multiplier > 0) {
                const winVal = amount * multiplier;
                newCash = newCash - amount + winVal;
                newProfit += (winVal - amount);
            } else {
                newCash -= amount;
                newProfit -= amount;
            }

            const totalVal = calculateTotalValue(newCash, d.shares);
            t.update(userRef, { cash: newCash, zysk: newProfit, totalValue: totalVal });
        });

        if (multiplier > 0) {
            const winText = formatujWalute(amount * multiplier);
            dom.casinoStatus.innerHTML = `<span style="color:var(--green)">WYGRANA! ${winText}</span>`;
            showNotification(`Wygrałeś ${winText} w ruletce!`, 'news', 'positive');
            if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
        } else {
            dom.casinoStatus.innerHTML = `<span style="color:var(--red)">Przegrana... -${formatujWalute(amount)}</span>`;
            if(dom.audioError) dom.audioError.play().catch(()=>{});
        }

    } catch (e) {
        console.error(e);
        showMessage("Błąd: " + e.message, "error");
    } finally {
        isSpinning = false;
        allBtns.forEach(b => b.disabled = false);
        if(dom.amountInput) dom.amountInput.disabled = false;
    }
};

// --- MINI-GOLF ---
const MINI_GOLF_HOLES = [
    { cup: { x: 790, y: 180 }, par: 3, bunker: { x: 450, y: 95, rx: 70, ry: 32 } },
    { cup: { x: 790, y: 90 }, par: 4, bunker: { x: 490, y: 245, rx: 82, ry: 38 } },
    { cup: { x: 790, y: 270 }, par: 4, bunker: { x: 560, y: 125, rx: 74, ry: 34 } }
];
const MINI_GOLF_BEST_KEY = "ulanskaMiniGolfBest";
let miniGolfState;

function initializeMiniGolf() {
    miniGolfState = {
        holeIndex: 0,
        holeStrokes: 0,
        totalStrokes: 0,
        ball: { x: 90, y: 180 },
        lastShot: null,
        holeComplete: false,
        roundComplete: false,
        best: loadMiniGolfBest()
    };
    updateMiniGolfControls();
    updateMiniGolfUI("Ustaw siłę i kierunek, a potem wykonaj uderzenie.");
}

function loadMiniGolfBest() {
    try {
        const best = Number(localStorage.getItem(MINI_GOLF_BEST_KEY));
        return Number.isInteger(best) && best > 0 ? best : null;
    } catch (error) {
        console.error("Nie udało się odczytać rekordu Mini-golfa:", error);
        return null;
    }
}

function updateMiniGolfControls() {
    const power = document.getElementById("minigolf-power");
    const aim = document.getElementById("minigolf-aim");
    document.getElementById("minigolf-power-value").textContent = `${power.value}%`;
    const aimValue = Number(aim.value);
    document.getElementById("minigolf-aim-value").textContent = `${aimValue > 0 ? "+" : ""}${aimValue}°`;
    drawMiniGolfCourse();
}

function updateMiniGolfUI(message) {
    const hole = MINI_GOLF_HOLES[miniGolfState.holeIndex];
    const distance = Math.hypot(hole.cup.x - miniGolfState.ball.x, hole.cup.y - miniGolfState.ball.y);
    document.getElementById("minigolf-hole").textContent = `${miniGolfState.holeIndex + 1}`;
    document.getElementById("minigolf-strokes").textContent = `${miniGolfState.holeStrokes}`;
    document.getElementById("minigolf-distance").textContent = `${(distance / 20).toFixed(1)} m`;
    document.getElementById("minigolf-best").textContent = miniGolfState.best === null
        ? "--"
        : `${miniGolfState.best} uderzeń`;
    document.getElementById("minigolf-status").textContent = message;
    document.getElementById("btn-minigolf-shot").disabled = miniGolfState.holeComplete || miniGolfState.roundComplete;
    document.getElementById("btn-minigolf-new").textContent = miniGolfState.holeComplete && !miniGolfState.roundComplete
        ? "Następny dołek"
        : "Nowa runda";
    drawMiniGolfCourse();
}

function drawMiniGolfCourse() {
    const canvas = document.getElementById("minigolf-course");
    if (!canvas || !miniGolfState) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const hole = MINI_GOLF_HOLES[miniGolfState.holeIndex];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0e1924";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#24583f";
    context.beginPath();
    context.roundRect(24, 24, 852, 312, 18);
    context.fill();
    context.strokeStyle = "#6c9274";
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.beginPath();
    context.roundRect(24, 24, 852, 312, 18);
    context.clip();
    for (let x = 40; x < 876; x += 56) {
        context.fillStyle = x % 112 === 40 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.035)";
        context.fillRect(x, 24, 28, 312);
    }
    context.restore();

    context.fillStyle = "#bd9a51";
    context.beginPath();
    context.ellipse(hole.bunker.x, hole.bunker.y, hole.bunker.rx, hole.bunker.ry, -0.12, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255, 221, 148, 0.45)";
    context.lineWidth = 2;
    context.stroke();

    context.setLineDash([7, 8]);
    context.strokeStyle = "rgba(231, 241, 231, 0.35)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(miniGolfState.ball.x, miniGolfState.ball.y);
    context.lineTo(hole.cup.x, hole.cup.y);
    context.stroke();
    context.setLineDash([]);

    const power = Number(document.getElementById("minigolf-power").value);
    const aimCorrection = Number(document.getElementById("minigolf-aim").value);
    const targetAngle = Math.atan2(hole.cup.y - miniGolfState.ball.y, hole.cup.x - miniGolfState.ball.x);
    const aimAngle = targetAngle + (aimCorrection * Math.PI / 180);
    const previewDistance = Math.hypot(hole.cup.x - miniGolfState.ball.x, hole.cup.y - miniGolfState.ball.y) * power / 100;
    context.setLineDash([4, 5]);
    context.strokeStyle = "rgba(118, 232, 207, 0.8)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(miniGolfState.ball.x, miniGolfState.ball.y);
    context.lineTo(
        Math.min(858, Math.max(42, miniGolfState.ball.x + Math.cos(aimAngle) * previewDistance)),
        Math.min(318, Math.max(42, miniGolfState.ball.y + Math.sin(aimAngle) * previewDistance))
    );
    context.stroke();
    context.setLineDash([]);

    if (miniGolfState.lastShot) {
        context.strokeStyle = "rgba(255, 255, 255, 0.42)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(miniGolfState.lastShot.x, miniGolfState.lastShot.y);
        context.lineTo(miniGolfState.ball.x, miniGolfState.ball.y);
        context.stroke();
    }

    context.fillStyle = "#101820";
    context.beginPath();
    context.ellipse(hole.cup.x, hole.cup.y + 3, 12, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#e9f2ed";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(hole.cup.x, hole.cup.y);
    context.lineTo(hole.cup.x, hole.cup.y - 48);
    context.stroke();
    context.fillStyle = "#ff6d89";
    context.beginPath();
    context.moveTo(hole.cup.x, hole.cup.y - 48);
    context.lineTo(hole.cup.x + 28, hole.cup.y - 39);
    context.lineTo(hole.cup.x, hole.cup.y - 30);
    context.fill();

    context.fillStyle = "#f5f7df";
    context.beginPath();
    context.arc(miniGolfState.ball.x, miniGolfState.ball.y, 9, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#66736c";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = "rgba(7, 20, 18, 0.76)";
    context.font = "bold 14px Segoe UI, sans-serif";
    context.fillText(`DOŁEK ${miniGolfState.holeIndex + 1}  •  PAR ${hole.par}`, 42, 52);
}

function takeMiniGolfShot() {
    if (miniGolfState.holeComplete || miniGolfState.roundComplete) return;

    const hole = MINI_GOLF_HOLES[miniGolfState.holeIndex];
    const power = Number(document.getElementById("minigolf-power").value);
    const aimCorrection = Number(document.getElementById("minigolf-aim").value);
    const deltaX = hole.cup.x - miniGolfState.ball.x;
    const deltaY = hole.cup.y - miniGolfState.ball.y;
    const remainingDistance = Math.hypot(deltaX, deltaY);
    const direction = Math.atan2(deltaY, deltaX)
        + (aimCorrection * Math.PI / 180)
        + ((Math.random() - 0.5) * 3 * Math.PI / 180);
    const variance = (Math.random() - 0.5) * Math.min(remainingDistance * 0.12, 45);
    const shotDistance = Math.max(12, (remainingDistance * power / 100) + variance);
    const nextBall = {
        x: Math.min(858, Math.max(42, miniGolfState.ball.x + Math.cos(direction) * shotDistance)),
        y: Math.min(318, Math.max(42, miniGolfState.ball.y + Math.sin(direction) * shotDistance))
    };
    const wasInBunker = isMiniGolfBallInBunker(miniGolfState.ball, hole.bunker);
    const landedInBunker = isMiniGolfBallInBunker(nextBall, hole.bunker);

    miniGolfState.lastShot = { ...miniGolfState.ball };
    miniGolfState.ball = nextBall;
    miniGolfState.holeStrokes++;
    if (!wasInBunker && landedInBunker) miniGolfState.holeStrokes++;

    const distanceToCup = Math.hypot(hole.cup.x - nextBall.x, hole.cup.y - nextBall.y);
    if (distanceToCup <= 14) {
        miniGolfState.holeComplete = true;
        miniGolfState.totalStrokes += miniGolfState.holeStrokes;
        const strokeForm = miniGolfState.holeStrokes === 1 ? "uderzeniu" : "uderzeniach";
        const holeMessage = `Dołek ukończony w ${miniGolfState.holeStrokes} ${strokeForm}.`;
        if (miniGolfState.holeIndex === MINI_GOLF_HOLES.length - 1) {
            finishMiniGolfRound(holeMessage);
            return;
        }
        updateMiniGolfUI(`${holeMessage} Przejdź do następnego dołka.`);
        return;
    }

    const message = !wasInBunker && landedInBunker
        ? "Piłka wylądowała w bunkrze — doliczono uderzenie karne."
        : `Uderzenie ${miniGolfState.holeStrokes}. Zostało ${(distanceToCup / 20).toFixed(1)} m do dołka.`;
    updateMiniGolfUI(message);
}

function isMiniGolfBallInBunker(ball, bunker) {
    const x = (ball.x - bunker.x) / bunker.rx;
    const y = (ball.y - bunker.y) / bunker.ry;
    return (x * x) + (y * y) <= 1;
}

function finishMiniGolfRound(message) {
    miniGolfState.roundComplete = true;
    const totalPar = MINI_GOLF_HOLES.reduce((sum, hole) => sum + hole.par, 0);
    const scoreDifference = miniGolfState.totalStrokes - totalPar;
    const scoreText = scoreDifference === 0 ? "PAR"
        : scoreDifference < 0 ? `${Math.abs(scoreDifference)} poniżej PAR`
        : `${scoreDifference} powyżej PAR`;
    let result = `${message} Wynik rundy: ${miniGolfState.totalStrokes} (${scoreText}).`;

    if (miniGolfState.best === null || miniGolfState.totalStrokes < miniGolfState.best) {
        miniGolfState.best = miniGolfState.totalStrokes;
        try {
            localStorage.setItem(MINI_GOLF_BEST_KEY, `${miniGolfState.best}`);
            result += " Nowy rekord!";
        } catch (error) {
            console.error("Nie udało się zapisać rekordu Mini-golfa:", error);
        }
    }

    updateMiniGolfUI(result);
}

function advanceMiniGolf() {
    if (miniGolfState.holeComplete && !miniGolfState.roundComplete) {
        miniGolfState.holeIndex++;
        miniGolfState.holeStrokes = 0;
        miniGolfState.ball = { x: 90, y: 180 };
        miniGolfState.lastShot = null;
        miniGolfState.holeComplete = false;
        updateMiniGolfUI(`Dołek ${miniGolfState.holeIndex + 1} z ${MINI_GOLF_HOLES.length}. Powodzenia!`);
        return;
    }

    miniGolfState.holeIndex = 0;
    miniGolfState.holeStrokes = 0;
    miniGolfState.totalStrokes = 0;
    miniGolfState.ball = { x: 90, y: 180 };
    miniGolfState.lastShot = null;
    miniGolfState.holeComplete = false;
    miniGolfState.roundComplete = false;
    updateMiniGolfUI("Nowa runda rozpoczęta. Powodzenia!");
}

// --- HISTORIA I PROFILE ---
function listenToGlobalHistory() { unsubscribeGlobalHistory = onSnapshot(query(collection(db, "historia_transakcji"), orderBy("timestamp", "desc"), limit(15)), snap => { dom.globalHistoryFeed.innerHTML=""; snap.forEach(d => displayHistoryItem(dom.globalHistoryFeed, d.data(), true)); }); }
function listenToPersonalHistory(uid) { unsubscribePersonalHistory = onSnapshot(query(collection(db, "historia_transakcji"), where("userId","==",uid), orderBy("timestamp", "desc"), limit(15)), snap => { dom.personalHistoryFeed.innerHTML=""; snap.forEach(d => displayHistoryItem(dom.personalHistoryFeed, d.data(), false)); }); }

function displayHistoryItem(feed, item, isGlobal) {
    const div = document.createElement("div");
    div.className = "history-row";

    let actionClass = "h-neutral";
    let displayType = item.type;

    if (item.type.includes("KUPNO")) {
        actionClass = "h-buy";
        displayType = "KUPNO";
    } else if (item.type.includes("SPRZEDAŻ")) {
        actionClass = "h-sell";
        displayType = "SPRZEDAŻ";
    } else if (item.type.includes("ZAKŁAD")) {
        actionClass = "h-bet";
        displayType = "ZAKŁAD";
    }

    let col1 = "";
    if (isGlobal) {
        col1 = `<span class="h-col h-user clickable-user" onclick="showUserProfile('${item.userId}')">${item.userName}</span>`;
    } else {
        let timeStr = "--:--";
        if (item.timestamp && item.timestamp.seconds) {
            const date = new Date(item.timestamp.seconds * 1000);
            timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        }
        col1 = `<span class="h-col h-time">${timeStr}</span>`;
    }

    div.innerHTML = `
        ${col1}
        <span class="h-col h-type ${actionClass}">${displayType}</span>
        <span class="h-col h-asset">${item.companyName}</span>
        <span class="h-col h-val">${formatujWalute(item.totalValue)}</span>
    `;

    feed.prepend(div);
}

window.showUserProfile = async function(uid) {
    const d = (await getDoc(doc(db, "uzytkownicy", uid))).data();

    dom.modalUsername.textContent = d.name;
    dom.modalTotalValue.textContent = formatujWalute(d.totalValue);
    dom.modalCash.textContent = formatujWalute(d.cash);
    dom.modalPrestigeLevel.textContent = d.prestigeLevel || 0;
    renderProfileAchievements(d);

    let sharesHtml = "";
    COMPANY_ORDER.forEach(cid => {
        if((d.shares[cid]||0)>0) sharesHtml += `<p>${market[cid].name}: ${d.shares[cid]}</p>`;
    });
    dom.modalSharesList.innerHTML = sharesHtml || "<p style='color:var(--text-muted)'>Brak aktywów</p>";

    dom.modalOverlay.classList.remove("hidden");

    const isMe = (uid === currentUserId);
    const currentLvl = d.prestigeLevel || 0;
    const nextRequirement = PRESTIGE_REQUIREMENTS[currentLvl];

    if (!isMe) {
        dom.prestigeButton.style.display = "none";
        dom.prestigeNextGoal.textContent = "";
        dom.prestigeInfo.style.display = "none";
    }
    else if (nextRequirement === undefined) {
        dom.prestigeButton.style.display = "none";
        dom.prestigeNextGoal.textContent = "Maksymalny Prestiż Osiągnięty!";
        dom.prestigeInfo.style.display = "block";
    }
    else {
        dom.prestigeButton.style.display = "block";
        dom.prestigeInfo.style.display = "block";
        dom.prestigeNextGoal.textContent = `Cel: ${formatujWalute(nextRequirement)}`;

        if (d.totalValue >= nextRequirement) {
            dom.prestigeButton.disabled = false;
            dom.prestigeButton.textContent = "AWANSUJ (Reset Konta)";
            dom.prestigeButton.classList.add("btn-green");
        } else {
            dom.prestigeButton.disabled = true;
            dom.prestigeButton.textContent = "Za mało środków";
            dom.prestigeButton.classList.remove("btn-green");
        }
    }
};

async function onPrestigeReset() {
    if(!confirm("To zresetuje Twoją gotówkę i akcje do zera, ale da Ci gwiazdkę prestiżu. Kontynuować?")) return;

    try {
        await runTransaction(db, async t => {
            const ref = doc(db, "uzytkownicy", currentUserId);
            const d = (await t.get(ref)).data();
            const currentLvl = d.prestigeLevel || 0;

            if (currentLvl >= PRESTIGE_REQUIREMENTS.length) {
                throw new Error("Osiągnięto już maksymalny poziom!");
            }

            const req = PRESTIGE_REQUIREMENTS[currentLvl];
            if (d.totalValue < req) {
                throw new Error(`Brakuje środków! Wymagane: ${req}`);
            }

            t.update(ref, {
                cash: 10000,
                shares: {ulanska:0, rychbud:0, brzozair:0, cosmosanit:0, nicorp:0, igirium:0},
                startValue: 10000,
                zysk: 0,
                totalValue: 10000,
                prestigeLevel: currentLvl + 1
            });
        });

        dom.modalOverlay.classList.add("hidden");
        showMessage("Awans udany! Konto zresetowane.", "success");

        if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});

    } catch(e) {
        showMessage(e.message, "error");
    }
}

// ==========================================
// === CRASH GAME LOGIC (Rakieta) ===
// ==========================================

function initCrashCanvas() {
    crashCanvas = dom.crashCanvas;
    if(!crashCanvas) return;
    crashCtx = crashCanvas.getContext('2d');
    crashCtx.lineCap = 'round';
    crashCtx.lineJoin = 'round';
    drawCrashFrame(true);
}

async function onCrashAction() {
    if (!crashIsRunning) {
        const amount = parseInt(dom.crashAmount.value);
        if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
        if (amount > portfolio.cash) return showMessage("Brak środków!", "error");
        if (!currentUserId) return showMessage("Zaloguj się!", "error");

        try {
            await runTransaction(db, async (t) => {
                const userRef = doc(db, "uzytkownicy", currentUserId);
                const userDoc = await t.get(userRef);
                const d = userDoc.data();
                if (d.cash < amount) throw new Error("Brak środków!");

                const newCash = d.cash - amount;
                const newVal = calculateTotalValue(newCash, d.shares);
                t.update(userRef, { cash: newCash, totalValue: newVal });
            });

            crashBetAmount = amount;
            startCrashGame();

        } catch (e) {
            showMessage(e.message, "error");
        }
    }
    else if (crashIsRunning && !crashHasCashedOut) {
        doCrashCashout();
    }
}

function startCrashGame() {
    crashIsRunning = true;
    crashHasCashedOut = false;
    crashMultiplier = 1.00;
    crashCurvePoints = [{x: 0, y: crashCanvas.height}];

    dom.btnCrashAction.textContent = "WYPŁAĆ!";
    dom.btnCrashAction.classList.add("btn-cashout");
    dom.crashMultiplierText.classList.remove("crashed", "cashed-out");
    dom.crashInfo.textContent = `Lecimy za ${formatujWalute(crashBetAmount)}...`;
    if(dom.crashAmount) dom.crashAmount.disabled = true;

    const r = Math.random();
    crashCurrentCrashPoint = Math.max(1.00, (0.99 / (1 - r)));
    if(crashCurrentCrashPoint > 50) crashCurrentCrashPoint = 50 + Math.random() * 50;

    let time = 0;
    clearInterval(crashGameLoop);

    crashGameLoop = setInterval(() => {
        time += 0.05;

        crashMultiplier = Math.pow(Math.E, 0.06 * time);

        updateCrashCurve();

        dom.crashMultiplierText.textContent = crashMultiplier.toFixed(2) + "x";

        if(crashHasCashedOut) {
        } else {
             dom.btnCrashAction.textContent = `WYPŁAĆ (${formatujWalute(crashBetAmount * crashMultiplier)})`;
        }

        if (crashMultiplier >= crashCurrentCrashPoint) {
            endCrashGame();
        }

    }, 16);
}

function updateCrashCurve() {
    const width = crashCanvas.width;
    const height = crashCanvas.height;

    const stepX = (crashMultiplier - 1) * 80;
    const stepY = (crashMultiplier - 1) * 60;

    const newX = stepX;
    const newY = height - stepY;

    let offsetX = 0;
    let offsetY = 0;

    if (newX > width - 50) offsetX = newX - (width - 50);
    if (newY < 50) offsetY = 50 - newY;

    crashCtx.clearRect(0, 0, width, height);

    crashCtx.beginPath();
    crashCtx.moveTo(0 - offsetX, height + offsetY);

    crashCtx.quadraticCurveTo(
        (newX / 2) - offsetX, height + offsetY,
        newX - offsetX, newY + offsetY
    );

    crashCtx.lineWidth = 4;
    crashCtx.strokeStyle = crashHasCashedOut ? '#00e676' : '#00d2ff';
    crashCtx.stroke();

    crashCtx.save();
    crashCtx.translate(newX - offsetX, newY + offsetY);
    const angle = -Math.PI / 4 - (crashMultiplier * 0.05);
    crashCtx.rotate(Math.max(angle, -Math.PI / 2));

    crashCtx.font = "30px Arial";
    crashCtx.fillText("🚀", -15, 10);
    crashCtx.restore();
}

async function doCrashCashout() {
    if(crashHasCashedOut || !crashIsRunning) return;

    crashHasCashedOut = true;
    const cashoutMultiplier = crashMultiplier;
    const winAmount = crashBetAmount * cashoutMultiplier;
    const profit = winAmount - crashBetAmount;

    dom.btnCrashAction.textContent = "WYPŁACONO!";
    dom.btnCrashAction.classList.remove("btn-cashout");
    dom.btnCrashAction.style.background = "#333";

    dom.crashMultiplierText.classList.add("cashed-out");

    dom.crashInfo.textContent = `Wygrałeś ${formatujWalute(winAmount)}!`;

    if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});

    try {
        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            const d = userDoc.data();

            const newCash = d.cash + winAmount;
            const newZysk = (d.zysk || 0) + profit;
            const newVal = calculateTotalValue(newCash, d.shares);

            t.update(userRef, { cash: newCash, zysk: newZysk, totalValue: newVal });
        });
        showNotification(`Crash: Wygrana ${formatujWalute(winAmount)}`, 'news', 'positive');
    } catch(e) {
        console.error("Błąd zapisu Crash:", e);
    }
}

function endCrashGame() {
    clearInterval(crashGameLoop);
    crashIsRunning = false;

    dom.crashMultiplierText.textContent = crashCurrentCrashPoint.toFixed(2) + "x";
    dom.crashMultiplierText.classList.add("crashed");
    dom.crashMultiplierText.classList.remove("cashed-out");

    dom.btnCrashAction.textContent = "START";
    dom.btnCrashAction.classList.remove("btn-cashout");
    dom.btnCrashAction.style.background = "";
    if(dom.crashAmount) dom.crashAmount.disabled = false;

    drawCrashFrame(false, true);

    if(!crashHasCashedOut) {
        dom.crashInfo.textContent = `Rakieta wybuchła przy ${crashCurrentCrashPoint.toFixed(2)}x. Straciłeś ${formatujWalute(crashBetAmount)}.`;
        if(dom.audioError) dom.audioError.play().catch(()=>{});
    }

    addCrashHistory(crashCurrentCrashPoint);
}

function drawCrashFrame(reset = false, exploded = false) {
    if(!crashCtx) return;
    const w = crashCanvas.width;
    const h = crashCanvas.height;

    if(reset) {
        crashCtx.clearRect(0, 0, w, h);
        crashCtx.font = "50px Arial";
        crashCtx.fillStyle = "#333";
        crashCtx.fillText("🚀", 20, h - 20);
        return;
    }

    if(exploded) {
        crashCtx.save();
        crashCtx.fillStyle = "rgba(255, 0, 0, 0.3)";
        crashCtx.fillRect(0, 0, w, h);
        crashCtx.font = "60px Arial";
        crashCtx.textAlign = "center";
        crashCtx.fillText("💥", w/2, h/2);
        crashCtx.restore();
    }
}

function addCrashHistory(mult) {
    const item = document.createElement("div");
    item.className = "crash-history-item";
    item.textContent = mult.toFixed(2) + "x";

    if(mult < 1.10) item.classList.add("bad");
    else if(mult >= 2.00 && mult < 10.00) item.classList.add("good");
    else if(mult >= 10.00) item.classList.add("excellent");

    dom.crashHistoryList.prepend(item);
    if(dom.crashHistoryList.children.length > 10) dom.crashHistoryList.lastChild.remove();
}
// ==========================================
// === PLINKO GAME LOGIC (Z AKTUALIZACJĄ RYZYKA) ===
// ==========================================

const PLINKO_ROWS = 16;

// Definicja mnożników dla 16 rzędów
const PLINKO_RISK_MAP = {
    low:    [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 18, 1.6, 1.4, 1.1, 1, 0.5, 0.4, 0.4, 0.4, 0.5, 1, 1.1, 1.4, 1.6, 18, 110],
    high:   [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110]
};

let currentPlinkoRisk = 'high'; // Domyślne ryzyko
let plinkoCanvas, plinkoCtx;
let plinkoBalls = [];
let plinkoPins = [];
let plinkoEngineRunning = false;

document.addEventListener("DOMContentLoaded", () => {
    const btnPlinko = document.getElementById("btn-plinko-drop");
    const riskSelect = document.getElementById("plinko-risk-select");

    if(btnPlinko) btnPlinko.addEventListener("click", onPlinkoDrop);

    // Obsługa zmiany ryzyka
    if(riskSelect) {
        riskSelect.addEventListener("change", (e) => {
            currentPlinkoRisk = e.target.value;
            updatePlinkoBuckets(); // Przerysuj dolne pola
        });
    }

    setTimeout(initPlinko, 1000);
});

function initPlinko() {
    plinkoCanvas = document.getElementById("plinko-canvas");
    if(!plinkoCanvas) return;
    plinkoCtx = plinkoCanvas.getContext('2d');

    // Rysujemy piny
    plinkoPins = [];
    const startX = 400;
    const startY = 50;
    const gapX = 40;
    const gapY = 32;

    for (let row = 0; row <= PLINKO_ROWS; row++) {
        const pinsInRow = row + 3;
        const rowWidth = (pinsInRow - 1) * gapX;
        const xOffset = startX - (rowWidth / 2);

        for (let col = 0; col < pinsInRow; col++) {
            plinkoPins.push({
                x: xOffset + (col * gapX),
                y: startY + (row * gapY),
                r: 4
            });
        }
    }

    // Rysujemy buckety po raz pierwszy
    updatePlinkoBuckets();

    if(!plinkoEngineRunning) {
        plinkoEngineRunning = true;
        requestAnimationFrame(plinkoLoop);
    }
}

// Funkcja aktualizująca wygląd dolnych pól w zależności od ryzyka
function updatePlinkoBuckets() {
    const bucketContainer = document.getElementById("plinko-multipliers");
    if(!bucketContainer) return;

    const multipliers = PLINKO_RISK_MAP[currentPlinkoRisk];
    bucketContainer.innerHTML = "";

    multipliers.forEach((m, i) => {
        const div = document.createElement("div");

        // Dynamiczne kolory w zależności od mnożnika
        let colorClass = 'pb-low';
        if(m >= 10) colorClass = 'pb-ultra';
        else if(m >= 3) colorClass = 'pb-high';
        else if(m >= 1) colorClass = 'pb-med';

        div.className = `plinko-bucket ${colorClass}`;
        div.id = `plinko-bucket-${i}`; // ID do animacji trafienia
        div.innerText = m + 'x';
        bucketContainer.appendChild(div);
    });
}

async function onPlinkoDrop() {
    const amountInput = document.getElementById("plinko-amount");
    const amount = parseInt(amountInput.value);

    if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
    if (!currentUserId) return showMessage("Zaloguj się!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    const btn = document.getElementById("btn-plinko-drop");
    btn.style.transform = "scale(0.95)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);

    try {
        portfolio.cash -= amount;
        updatePortfolioUI();

        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            const d = userDoc.data();
            if (d.cash < amount) throw new Error("Brak środków (server)!");

            const newCash = d.cash - amount;
            const newVal = calculateTotalValue(newCash, d.shares);
            t.update(userRef, { cash: newCash, totalValue: newVal });
        });

        // Przekazujemy aktualnie wybrane ryzyko do kulki
        spawnPlinkoBall(amount, currentPlinkoRisk);

    } catch (e) {
        portfolio.cash += amount;
        updatePortfolioUI();
        showMessage(e.message, "error");
    }
}

function spawnPlinkoBall(betAmount, riskLevel) {
    let path = [];
    let finalBucketIndex = 0;

    // Generowanie ścieżki
    for(let i = 0; i < PLINKO_ROWS; i++) {
        const dir = Math.random() > 0.5 ? 1 : 0;
        path.push(dir);
        finalBucketIndex += dir;
    }

    // Pobieramy zestaw mnożników dla tego konkretnego zrzutu
    // Dzięki temu, jeśli zmienisz ryzyko w trakcie lotu, ta kulka zachowa stare mnożniki
    const multipliersSnapshot = PLINKO_RISK_MAP[riskLevel];

    plinkoBalls.push({
        x: 400 + (Math.random() * 4 - 2),
        y: 20,
        vx: 0,
        vy: 0,
        radius: 6,
        color: '#ff00cc',
        path: path,
        currentRow: 0,
        finished: false,
        bet: betAmount,
        bucketIndex: finalBucketIndex,
        riskMultipliers: multipliersSnapshot // Zapisujemy mnożniki w obiekcie kulki
    });
}

function plinkoLoop() {
    plinkoCtx.clearRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);

    // Rysowanie pinów
    plinkoCtx.fillStyle = "white";
    plinkoCtx.beginPath();
    plinkoPins.forEach(p => {
        plinkoCtx.moveTo(p.x, p.y);
        plinkoCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    });
    plinkoCtx.fill();

    const gravity = 0.25;
    const gapY = 32;
    const startY = 50;

    for (let i = plinkoBalls.length - 1; i >= 0; i--) {
        let b = plinkoBalls[i];

        if (b.finished) {
            plinkoBalls.splice(i, 1);
            continue;
        }

        const targetRowY = startY + (b.currentRow * gapY);

        if (b.y >= targetRowY) {
            if (b.currentRow < PLINKO_ROWS) {
                const moveRight = b.path[b.currentRow] === 1;
                b.vx = (moveRight ? 1.5 : -1.5) + (Math.random() * 0.4 - 0.2);
                b.vy = -1.5;
                b.currentRow++;
            } else {
                finishPlinkoBall(b);
                b.finished = true;
                continue;
            }
        }

        b.vy += gravity;
        b.x += b.vx;
        b.y += b.vy;

        b.vx *= 0.98;

        // Rysowanie kulki
        plinkoCtx.beginPath();
        plinkoCtx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        plinkoCtx.fillStyle = b.color;
        plinkoCtx.shadowBlur = 10;
        plinkoCtx.shadowColor = b.color;
        plinkoCtx.fill();
        plinkoCtx.shadowBlur = 0;
    }

    requestAnimationFrame(plinkoLoop);
}

async function finishPlinkoBall(ball) {
    // Używamy mnożników zapisanych w kulce, a nie globalnych!
    // To zapobiega błędom przy zmianie ryzyka w trakcie gry
    const multiplier = ball.riskMultipliers[ball.bucketIndex];

    const winAmount = ball.bet * multiplier;
    const profit = winAmount - ball.bet;

    // Animacja uderzenia w bucket
    const bucketEl = document.getElementById(`plinko-bucket-${ball.bucketIndex}`);
    if(bucketEl) {
        bucketEl.classList.add("hit");
        setTimeout(() => bucketEl.classList.remove("hit"), 300);
    }

    if(multiplier >= 10) {
        if(dom.audioKaching) {
             dom.audioKaching.currentTime = 0;
             dom.audioKaching.play().catch(()=>{});
        }
    }

    addPlinkoHistory(multiplier);

    try {
        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            const d = userDoc.data();

            const newCash = d.cash + winAmount;
            const newZysk = (d.zysk || 0) + profit;
            const newVal = calculateTotalValue(newCash, d.shares);

            t.update(userRef, { cash: newCash, zysk: newZysk, totalValue: newVal });
        });

        if(multiplier >= 3) {
            showNotification(`Plinko: ${multiplier}x (${formatujWalute(winAmount)})`, 'news', 'positive');
        }

    } catch(e) {
        console.error("Plinko save error:", e);
    }
}

function addPlinkoHistory(mult) {
    const list = document.getElementById("plinko-history-list");
    if(!list) return;

    const item = document.createElement("div");
    item.className = "crash-history-item";
    item.textContent = mult + "x";

    if(mult < 1) item.classList.add("bad");
    else if(mult >= 3) item.classList.add("good");
    else if(mult >= 10) item.classList.add("excellent");

    list.prepend(item);
    if(list.children.length > 8) list.lastChild.remove();
}
// ==========================================
// === VIDEO POKER LOGIC (Jacks or Better) ===
// ==========================================

const POKER_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const POKER_SUITS = ['♥', '♦', '♣', '♠'];
const POKER_VALUES = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

let pokerDeck = [];
let pokerHand = [];
let pokerHeld = [false, false, false, false, false];
let pokerState = 'idle';
let pokerBet = 0;

const POKER_PAYTABLE = {
    'ROYAL FLUSH': 250,
    'STRAIGHT FLUSH': 50,
    'FOUR OF A KIND': 25,
    'FULL HOUSE': 9,
    'FLUSH': 6,
    'STRAIGHT': 4,
    'THREE OF A KIND': 3,
    'TWO PAIRS': 2,
    'JACKS OR BETTER': 1
};

function createDeck() {
    pokerDeck = [];
    for(let s of POKER_SUITS) {
        for(let r of POKER_RANKS) {
            pokerDeck.push({ rank: r, suit: s, val: POKER_VALUES[r], color: (s === '♥' || s === '♦') ? 'red' : 'black' });
        }
    }
    for (let i = pokerDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pokerDeck[i], pokerDeck[j]] = [pokerDeck[j], pokerDeck[i]];
    }
}

window.onPokerAction = async function() {
    const btn = document.getElementById("btn-poker-deal");
    const amountInput = document.getElementById("poker-amount");
    const statusText = document.getElementById("poker-result-text");

    if (pokerState === 'idle') {
        const amount = parseInt(amountInput.value);
        if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
        if (amount > portfolio.cash) return showMessage("Brak środków!", "error");
        if (!currentUserId) return showMessage("Zaloguj się!", "error");

        try {
            await runTransaction(db, async (t) => {
                 const userRef = doc(db, "uzytkownicy", currentUserId);
                 const userDoc = await t.get(userRef);
                 if(userDoc.data().cash < amount) throw new Error("Brak środków");
                 const newCash = userDoc.data().cash - amount;
                 t.update(userRef, { cash: newCash, totalValue: calculateTotalValue(newCash, userDoc.data().shares) });
            });

            pokerBet = amount;
            amountInput.disabled = true;
            createDeck();
            pokerHand = [];
            pokerHeld = [false, false, false, false, false];

            for(let i=0; i<5; i++) {
                const cardEl = document.getElementById(`card-${i}`);
                const badgeEl = document.getElementById(`hold-${i}`);

                if(cardEl) {
                    cardEl.style.transform = "translateY(0)";
                    cardEl.style.border = "";
                    cardEl.classList.add('back');
                }
                if(badgeEl) badgeEl.classList.add('hidden');
            }

            for(let i=0; i<5; i++) pokerHand.push(pokerDeck.pop());

            renderPokerCards();
            resetPaytableHighlight();

            pokerState = 'deal';
            btn.textContent = "WYMIEŃ (DRAW)";
            btn.style.background = "var(--accent-color)";
            statusText.textContent = "ZATRZYMAJ KARTY (HOLD)";

        } catch(e) {
            showMessage(e.message, "error");
        }

    } else if (pokerState === 'deal') {

        for(let i=0; i<5; i++) {
            if(!pokerHeld[i]) {
                pokerHand[i] = pokerDeck.pop();
            }
        }

        renderPokerCards();

        const result = evaluatePokerHand(pokerHand);

        let winAmount = 0;
        let profit = 0 - pokerBet;

        if (result.win) {
            const multiplier = POKER_PAYTABLE[result.handName];
            winAmount = pokerBet * multiplier;
            profit = winAmount - pokerBet;

            statusText.textContent = `${result.handName}! WYGRANA: ${formatujWalute(winAmount)}`;
            statusText.style.color = "#00e676";
            highlightPaytableRow(result.handName);
            if(dom.audioKaching) { dom.audioKaching.currentTime=0; dom.audioKaching.play().catch(()=>{}); }

            try {
                await runTransaction(db, async (t) => {
                    const userRef = doc(db, "uzytkownicy", currentUserId);
                    const d = (await t.get(userRef)).data();
                    const newCash = d.cash + winAmount;
                    const newZysk = (d.zysk || 0) + profit;
                    const newVal = calculateTotalValue(newCash, d.shares);
                    t.update(userRef, { cash: newCash, zysk: newZysk, totalValue: newVal });
                });
            } catch(e) { console.error(e); }

        } else {
            statusText.textContent = "GAME OVER";
            statusText.style.color = "var(--red)";
            if(dom.audioError) dom.audioError.play().catch(()=>{});
        }

        pokerState = 'idle';
        btn.textContent = "ROZDAJ (DEAL)";
        btn.style.background = "";
        amountInput.disabled = false;

        document.querySelectorAll('.hold-badge').forEach(el => el.classList.add('hidden'));
    }
}

window.toggleHold = function(index) {
    if (pokerState !== 'deal') return;

    pokerHeld[index] = !pokerHeld[index];

    const badge = document.getElementById(`hold-${index}`);
    const card = document.getElementById(`card-${index}`);

    if (pokerHeld[index]) {
        badge.classList.remove('hidden');
        card.style.border = "2px solid yellow";
        card.style.transform = "translateY(-10px)";
    } else {
        badge.classList.add('hidden');
        card.style.border = "2px solid white";
        card.style.transform = "translateY(0)";
    }
}

function renderPokerCards() {
    for(let i=0; i<5; i++) {
        const cardEl = document.getElementById(`card-${i}`);
        const card = pokerHand[i];

        cardEl.className = `poker-card ${card.color}`;
        cardEl.innerHTML = `
            <div class="card-rank">${card.rank}</div>
            <div class="card-suit">${card.suit}</div>
        `;
    }
}

function evaluatePokerHand(hand) {
    const sorted = [...hand].sort((a, b) => a.val - b.val);
    const ranks = sorted.map(c => c.val);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);

    let isStraight = true;
    for(let i=0; i<4; i++) {
        if(ranks[i+1] !== ranks[i] + 1) {
            isStraight = false;
            break;
        }
    }
    if (!isStraight && ranks.join(',') === '2,3,4,5,14') isStraight = true;

    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const countValues = Object.values(counts);

    if (isFlush && isStraight && ranks[0] === 10 && ranks[4] === 14) return { win: true, handName: 'ROYAL FLUSH' };
    if (isFlush && isStraight) return { win: true, handName: 'STRAIGHT FLUSH' };
    if (countValues.includes(4)) return { win: true, handName: 'FOUR OF A KIND' };
    if (countValues.includes(3) && countValues.includes(2)) return { win: true, handName: 'FULL HOUSE' };
    if (isFlush) return { win: true, handName: 'FLUSH' };
    if (isStraight) return { win: true, handName: 'STRAIGHT' };
    if (countValues.includes(3)) return { win: true, handName: 'THREE OF A KIND' };
    if (countValues.filter(c => c === 2).length === 2) return { win: true, handName: 'TWO PAIRS' };
    if (countValues.includes(2)) {
        for(const [rank, count] of Object.entries(counts)) {
            if (count === 2 && parseInt(rank) >= 11) {
                return { win: true, handName: 'JACKS OR BETTER' };
            }
        }
    }

    return { win: false, handName: '' };
}

function highlightPaytableRow(handName) {
    const rows = document.querySelectorAll('.pay-row');
    rows.forEach(row => {
        if(row.firstElementChild.textContent === handName) {
            row.classList.add('active-win');
        }
    });
}

function resetPaytableHighlight() {
    document.querySelectorAll('.pay-row').forEach(r => r.classList.remove('active-win'));
}

// --- FUNKCJA ROLLING NUMBERS (ANIMACJA CYFEREK) ---
function animateValue(obj, start, end, duration) {
    if (!obj) return;
    // Jeśli różnica jest znikoma, po prostu wyświetl wynik
    if (start === end) {
        obj.textContent = formatujWalute(end);
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Używamy matematyki dla liczb zmiennoprzecinkowych (zachowujemy grosze)
        const currentVal = start + (end - start) * progress;

        obj.textContent = formatujWalute(currentVal);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = formatujWalute(end);
        }
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// === MINES GAME LOGIC ===
// ==========================================

function initMinesGrid() {
    const gridEl = document.getElementById("mines-grid");
    if (!gridEl) return;
    gridEl.innerHTML = "";

    for (let i = 0; i < 25; i++) {
        const btn = document.createElement("button");
        btn.className = "mine-tile";
        btn.dataset.index = i;
        btn.onclick = () => onTileClick(i);
        btn.disabled = true; // Domyślnie zablokowane, dopóki nie klikniesz Start
        gridEl.appendChild(btn);
    }
}

async function onMinesAction() {
    const amountInput = document.getElementById("mines-amount");
    const countSelect = document.getElementById("mines-count-select");
    const btn = document.getElementById("btn-mines-action");
    const gridEl = document.getElementById("mines-grid");

    // 1. START GRY
    if (!minesGameActive) {
        const amount = parseFloat(amountInput.value);
        const mines = parseInt(countSelect.value);

        if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
        if (!currentUserId) return showMessage("Zaloguj się!", "error");
        if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

        try {
            // Pobranie kasy (start gry)
            await runTransaction(db, async (t) => {
                const userRef = doc(db, "uzytkownicy", currentUserId);
                const userDoc = await t.get(userRef);
                const d = userDoc.data();
                if (d.cash < amount) throw new Error("Brak środków!");

                const newCash = d.cash - amount;
                const newVal = calculateTotalValue(newCash, d.shares);
                t.update(userRef, { cash: newCash, totalValue: newVal });
            });

            // UI Update
            portfolio.cash -= amount;
            updatePortfolioUI();

            // Setup gry
            minesGameActive = true;
            minesBetAmount = amount;
            minesCount = mines;
            minesRevealedCount = 0;
            minesCurrentMultiplier = 1.0;

            // Generowanie min (lokalnie - w wersji pro powinno być na serwerze)
            minesGridData = Array(25).fill('gem');
            let placed = 0;
            while (placed < mines) {
                const idx = Math.floor(Math.random() * 25);
                if (minesGridData[idx] === 'gem') {
                    minesGridData[idx] = 'bomb';
                    placed++;
                }
            }

            // Reset UI kafelków
            const tiles = gridEl.querySelectorAll(".mine-tile");
            tiles.forEach(t => {
                t.className = "mine-tile";
                t.disabled = false;
            });

            // Zmiana przycisku na Cashout
            btn.textContent = "WYPŁAĆ (0.00 zł)";
            btn.classList.add("cashout-mode");
            amountInput.disabled = true;
            countSelect.disabled = true;

            updateMinesInfo();

        } catch (e) {
            showMessage(e.message, "error");
        }
    }
    // 2. CASHOUT (Wypłata)
    else {
        await endMinesGame(true);
    }
}

function onTileClick(index) {
    if (!minesGameActive) return;

    const tile = document.querySelector(`.mine-tile[data-index="${index}"]`);
    if (tile.classList.contains("revealed-gem")) return; // Już odkryte

    // A. TRAFIENIE MINY (PRZEGRANA)
    if (minesGridData[index] === 'bomb') {
        tile.classList.add("revealed-bomb");
        if(dom.audioError) dom.audioError.play().catch(()=>{}); // Dźwięk błędu zostaje przy przegranej
        revealAllMines();
        endMinesGame(false); // False = przegrana
    }
    // B. TRAFIENIE DIAMENTU (DALEJ)
    else {
        tile.classList.add("revealed-gem");

        // --- USUNIĘTO ODTWARZANIE DŹWIĘKU TUTAJ ---
        // Dźwięk będzie tylko przy przycisku "Wypłać"

        minesRevealedCount++;
        calculateMinesMultiplier();
        updateMinesInfo();

        // Sprawdzenie czy wyczyścił planszę (wygrał max)
        const totalSafe = 25 - minesCount;
        if (minesRevealedCount === totalSafe) {
            endMinesGame(true); // Auto cashout (tu dźwięk się odegra z funkcji endMinesGame)
        }
    }
}

function calculateMinesMultiplier() {
    // Prosta matematyka prawdopodobieństwa
    // Mnożnik = Poprzedni * (Pozostałe pola / Pozostałe bezpieczne) * (1 - HouseEdge)
    // Użyjemy uproszczonej wersji bez House Edge dla zabawy, albo lekkie 1%

    // Klasyczny wzór kasynowy dla Mines:
    // nCr(25, mines) / nCr(25 - revealed, mines)

    // Podejście iteracyjne (łatwiejsze):
    // Szansa na diament w tym ruchu = (SafeLeft / TilesLeft)
    // Multiplier tego ruchu = 1 / Szansa
    // Total Multiplier = M1 * M2 * ...

    const tilesLeft = 25 - (minesRevealedCount - 1); // Przed tym ruchem
    const safeLeft = (25 - minesCount) - (minesRevealedCount - 1);

    const moveMultiplier = tilesLeft / safeLeft;
    // Apply 3% House Edge per move to keep economy kinda sane
    minesCurrentMultiplier *= (moveMultiplier * 0.97);
}

function updateMinesInfo() {
    const multEl = document.getElementById("mines-next-multiplier");
    const winEl = document.getElementById("mines-current-win");
    const btn = document.getElementById("btn-mines-action");

    const currentWin = minesBetAmount * minesCurrentMultiplier;

    multEl.textContent = minesCurrentMultiplier.toFixed(2) + "x";
    winEl.textContent = formatujWalute(currentWin);

    if (minesGameActive) {
        if (minesRevealedCount === 0) {
             btn.textContent = "WYPŁAĆ (Zwrot)";
             btn.disabled = true; // Nie można wypłacić przed pierwszym ruchem
        } else {
             btn.textContent = `WYPŁAĆ (${formatujWalute(currentWin)})`;
             btn.disabled = false;
        }
    }
}

async function endMinesGame(win) {
    minesGameActive = false;

    const amountInput = document.getElementById("mines-amount");
    const countSelect = document.getElementById("mines-count-select");
    const btn = document.getElementById("btn-mines-action");
    const tiles = document.querySelectorAll(".mine-tile");

    // Blokada planszy
    tiles.forEach(t => t.disabled = true);

    if (win) {
        const winAmount = minesBetAmount * minesCurrentMultiplier;
        const profit = winAmount - minesBetAmount;

        // Add win to DB
        try {
            await runTransaction(db, async (t) => {
                const userRef = doc(db, "uzytkownicy", currentUserId);
                const userDoc = await t.get(userRef);
                const d = userDoc.data();

                const newCash = d.cash + winAmount;
                const newZysk = (d.zysk || 0) + profit;
                const newVal = calculateTotalValue(newCash, d.shares);
                t.update(userRef, { cash: newCash, zysk: newZysk, totalValue: newVal });
            });

            showNotification(`Mines: Wygrana ${formatujWalute(winAmount)}`, 'news', 'positive');
            if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});

            // Odkryj pozostałe miny (jako "dimmed" - przygaszone)
            revealAllMines(true);

        } catch(e) {
            console.error("Mines save error", e);
        }

        btn.textContent = "WYGRANA!";
        btn.style.background = "var(--green)";
    } else {
        btn.textContent = "PRZEGRANA";
        btn.style.background = "var(--red)";
    }

    // Reset UI po chwili
    setTimeout(() => {
        btn.textContent = "GRAJ";
        btn.classList.remove("cashout-mode");
        btn.style.background = ""; // Reset gradientu
        btn.disabled = false;
        amountInput.disabled = false;
        countSelect.disabled = false;
    }, 2000);
}

function revealAllMines(dimmed = false) {
    const tiles = document.querySelectorAll(".mine-tile");
    tiles.forEach((t, idx) => {
        if (minesGridData[idx] === 'bomb') {
            t.classList.add("revealed-bomb");
            if (dimmed) t.classList.add("dimmed");
        } else if (!t.classList.contains("revealed-gem")) {
            t.classList.add("dimmed"); // Przygaś nieodkryte diamenty
        }
    });
}
// ==========================================
// === BLACKJACK GAME LOGIC ===
// ==========================================

let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjGameActive = false;
let bjBetAmount = 0;

// Listenery (dodaj to wewnątrz DOMContentLoaded lub na końcu pliku)
document.addEventListener("DOMContentLoaded", () => {
    const btnDeal = document.getElementById("btn-bj-deal");
    const btnHit = document.getElementById("btn-bj-hit");
    const btnStand = document.getElementById("btn-bj-stand");

    if(btnDeal) btnDeal.addEventListener("click", startBlackjack);
    if(btnHit) btnHit.addEventListener("click", bjHit);
    if(btnStand) btnStand.addEventListener("click", bjStand);
});

function createBjDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];
    for (let s of suits) {
        for (let r of ranks) {
            let val = parseInt(r);
            if (['J', 'Q', 'K'].includes(r)) val = 10;
            if (r === 'A') val = 11;
            deck.push({ rank: r, suit: s, value: val, color: (s === '♥' || s === '♦') ? 'red' : 'black' });
        }
    }
    // Tasowanie
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

async function startBlackjack() {
    if (bjGameActive) return;
    const amountInput = document.getElementById("bj-amount");
    const amount = parseInt(amountInput.value);

    if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
    if (!currentUserId) return showMessage("Zaloguj się!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        // Pobierz kasę
        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            if (userDoc.data().cash < amount) throw new Error("Brak środków!");
            const newCash = userDoc.data().cash - amount;
            t.update(userRef, { cash: newCash, totalValue: calculateTotalValue(newCash, userDoc.data().shares) });
        });

        // Setup gry
        portfolio.cash -= amount; // UI update
        updatePortfolioUI();

        bjBetAmount = amount;
        bjGameActive = true;
        bjDeck = createBjDeck();
        bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
        bjDealerHand = [bjDeck.pop(), bjDeck.pop()];

        updateBjUI(false); // false = nie pokazuj jeszcze drugiej karty krupiera

        // Sprawdź Blackjacka od razu (21 na start)
        const pScore = getBjScore(bjPlayerHand);
        if (pScore === 21) {
            bjStand(); // Auto stand przy blackjacku
        } else {
            // Pokaż kontrolki
            document.getElementById("bj-betting-controls").classList.add("hidden");
            document.getElementById("bj-action-controls").classList.remove("hidden");
            document.getElementById("bj-message").textContent = "Twój ruch...";
        }

    } catch (e) {
        showMessage(e.message, "error");
    }
}

function bjHit() {
    if (!bjGameActive) return;
    bjPlayerHand.push(bjDeck.pop());
    updateBjUI(false);

    const score = getBjScore(bjPlayerHand);
    if (score > 21) {
        endBlackjack(false); // Fura (Bust)
    }
}

async function bjStand() {
    if (!bjGameActive) return;

    // Logika krupiera (dobiera do 17)
    let dScore = getBjScore(bjDealerHand);
    while (dScore < 17) {
        bjDealerHand.push(bjDeck.pop());
        dScore = getBjScore(bjDealerHand);
    }

    updateBjUI(true); // Odkryj karty

    const pScore = getBjScore(bjPlayerHand);

    let win = false;
    let push = false; // Remis

    if (dScore > 21) {
        win = true; // Krupier fura
    } else if (pScore > dScore) {
        win = true;
    } else if (pScore === dScore) {
        push = true;
    }

    if (push) {
        await endBlackjack(null); // null = remis
    } else {
        await endBlackjack(win);
    }
}

function getBjScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        score += card.value;
        if (card.rank === 'A') aces++;
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

function updateBjUI(revealDealer) {
    const dContainer = document.getElementById("bj-dealer-cards");
    const pContainer = document.getElementById("bj-player-cards");
    const dScoreEl = document.getElementById("bj-dealer-score");
    const pScoreEl = document.getElementById("bj-player-score");

    // Render Gracza
    pContainer.innerHTML = "";
    bjPlayerHand.forEach(c => pContainer.appendChild(createBjCardEl(c)));
    pScoreEl.textContent = `(${getBjScore(bjPlayerHand)})`;

    // Render Krupiera
    dContainer.innerHTML = "";
    bjDealerHand.forEach((c, index) => {
        if (index === 1 && !revealDealer) {
            // Zakryta karta
            const div = document.createElement("div");
            div.className = "bj-card-wrap";
            div.innerHTML = `<div class="bj-card-inner back"></div>`;
            dContainer.appendChild(div);
        } else {
            dContainer.appendChild(createBjCardEl(c));
        }
    });

    if (revealDealer) {
        dScoreEl.textContent = `(${getBjScore(bjDealerHand)})`;
    } else {
        dScoreEl.textContent = "(?)";
    }
}

function createBjCardEl(card) {
    const div = document.createElement("div");
    div.className = "bj-card-wrap";
    div.innerHTML = `
        <div class="bj-card-inner ${card.color}">
            <div style="font-size:1.2em">${card.rank}</div>
            <div style="font-size:1.5em">${card.suit}</div>
        </div>
    `;
    return div;
}

async function endBlackjack(result) {
    bjGameActive = false;
    const msg = document.getElementById("bj-message");

    let payout = 0;
    let profit = 0;

    if (result === true) {
        // Wygrana (2x) - Blackjack 3:2 tu pomijamy dla uproszczenia, dajemy 2x
        payout = bjBetAmount * 2;
        profit = bjBetAmount;
        msg.textContent = `WYGRANA! +${formatujWalute(profit)}`;
        msg.style.color = "var(--green)";
        if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
    } else if (result === null) {
        // Remis (Zwrot)
        payout = bjBetAmount;
        profit = 0;
        msg.textContent = "REMIS (ZWROT)";
        msg.style.color = "var(--text-muted)";
    } else {
        // Przegrana
        msg.textContent = "PRZEGRANA...";
        msg.style.color = "var(--red)";
        if(dom.audioError) dom.audioError.play().catch(()=>{});
        profit = -bjBetAmount;
    }

    document.getElementById("bj-action-controls").classList.add("hidden");
    document.getElementById("bj-betting-controls").classList.remove("hidden");

    if (payout > 0) {
        try {
            await runTransaction(db, async (t) => {
                const userRef = doc(db, "uzytkownicy", currentUserId);
                const d = (await t.get(userRef)).data();
                const newCash = d.cash + payout;
                const newZysk = (d.zysk || 0) + profit;
                t.update(userRef, { cash: newCash, zysk: newZysk, totalValue: calculateTotalValue(newCash, d.shares) });
            });
        } catch(e) { console.error(e); }
    }
}
// ==========================================
// === SLOTS GAME LOGIC (3x3 z Liniami) ===
// ==========================================

const SLOT_SYMBOLS = [
    { icon: '🍒', weight: 50, pay: 10 },
    { icon: '🍋', weight: 40, pay: 5 },
    { icon: '🍇', weight: 30, pay: 15 },
    { icon: '🎰', weight: 15, pay: 20 },
    { icon: '💎', weight: 8,  pay: 50 },
    { icon: '7️⃣', weight: 3,  pay: 100 }
];

// Definicja 5 linii wygrywających (współrzędne: [kolumna, rząd])
// Kolumny: 0, 1, 2. Rzędy: 0 (góra), 1 (środek), 2 (dół).
const PAYLINES = [
    { id: 'top',   coords: [[0,0], [1,0], [2,0]], color: 'red' },      // Góra
    { id: 'mid',   coords: [[0,1], [1,1], [2,1]], color: 'gold' },     // Środek
    { id: 'bot',   coords: [[0,2], [1,2], [2,2]], color: 'red' },      // Dół
    { id: 'cross1',coords: [[0,0], [1,1], [2,2]], color: '#00d2ff' },  // Skos: Lewa góra -> Prawy dół
    { id: 'cross2',coords: [[0,2], [1,1], [2,0]], color: '#00d2ff' }   // Skos: Lewy dół -> Prawa góra
];

const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
let slotsSpinning = false;

document.addEventListener("DOMContentLoaded", () => {
    const btnSlots = document.getElementById("btn-slots-spin");
    if(btnSlots) btnSlots.addEventListener("click", onSlotsSpin);
});

function getRandomSlotSymbol() {
    let random = Math.random() * TOTAL_WEIGHT;
    for (let symbol of SLOT_SYMBOLS) {
        if (random < symbol.weight) return symbol.icon;
        random -= symbol.weight;
    }
    return SLOT_SYMBOLS[0].icon;
}

function getSymbolMultiplier(icon) {
    const sym = SLOT_SYMBOLS.find(s => s.icon === icon);
    return sym ? sym.pay : 0;
}

async function onSlotsSpin() {
    if (slotsSpinning) return;

    const amountInput = document.getElementById("slots-amount");
    const amount = parseInt(amountInput.value);
    const statusEl = document.getElementById("slots-status");
    const windowEl = document.querySelector(".slots-window");
    const svgLayer = document.getElementById("slots-lines-svg");

    if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
    if (!currentUserId) return showMessage("Zaloguj się!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    slotsSpinning = true;
    statusEl.textContent = "KRĘCIMY (3x3)...";
    statusEl.style.color = "var(--text-main)";

    // Reset wizualny
    windowEl.classList.remove("win-animation");
    svgLayer.innerHTML = ""; // Czyść linie
    document.querySelectorAll(".slot-cell").forEach(c => c.classList.remove("win-anim"));

    try {
        // 1. Transakcja (Pobranie środków)
        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await t.get(userRef);
            if (userDoc.data().cash < amount) throw new Error("Brak środków!");

            const newCash = userDoc.data().cash - amount;
            t.update(userRef, {
                cash: newCash,
                totalValue: calculateTotalValue(newCash, userDoc.data().shares)
            });
        });

        portfolio.cash -= amount;
        updatePortfolioUI();

        // 2. Generowanie wyników (3 kolumny po 3 symbole)
        // resultMatrix[kolumna][rząd]
        const resultMatrix = [
            [getRandomSlotSymbol(), getRandomSlotSymbol(), getRandomSlotSymbol()],
            [getRandomSlotSymbol(), getRandomSlotSymbol(), getRandomSlotSymbol()],
            [getRandomSlotSymbol(), getRandomSlotSymbol(), getRandomSlotSymbol()]
        ];

        // 3. Animacja
        const columns = [
            document.getElementById("reel-col-0"),
            document.getElementById("reel-col-1"),
            document.getElementById("reel-col-2")
        ];

        // Dźwięk startu
        // if(dom.audioNews) { dom.audioNews.currentTime=0; dom.audioNews.play().catch(()=>{}); }

        // Rozpocznij animację "rozmycia"
        const spinIntervals = columns.map((col, colIndex) => {
            col.classList.add("blur");
            return setInterval(() => {
                // Szybka podmiana symboli w trakcie kręcenia
                col.innerHTML = `
                    <div class="slot-cell">${getRandomSlotSymbol()}</div>
                    <div class="slot-cell">${getRandomSlotSymbol()}</div>
                    <div class="slot-cell">${getRandomSlotSymbol()}</div>
                `;
            }, 60);
        });

        // 4. Zatrzymywanie bębnów po kolei
        const stopDelays = [1000, 1600, 2200];

        columns.forEach((col, colIndex) => {
            setTimeout(() => {
                clearInterval(spinIntervals[colIndex]);
                col.classList.remove("blur");

                // Wstaw finalne symbole dla tej kolumny
                col.innerHTML = `
                    <div class="slot-cell" id="cell-${colIndex}-0">${resultMatrix[colIndex][0]}</div>
                    <div class="slot-cell" id="cell-${colIndex}-1">${resultMatrix[colIndex][1]}</div>
                    <div class="slot-cell" id="cell-${colIndex}-2">${resultMatrix[colIndex][2]}</div>
                `;

                // Efekt tąpnięcia
                col.style.transform = "translateY(5px)";
                setTimeout(() => col.style.transform = "translateY(0)", 150);

            }, stopDelays[colIndex]);
        });

        // 5. Sprawdzenie wygranych (po zatrzymaniu wszystkich)
        setTimeout(async () => {
            let totalWin = 0;
            let winningLines = [];

            // Sprawdzamy każdą z 5 linii
            PAYLINES.forEach(line => {
                const [c1, r1] = line.coords[0];
                const [c2, r2] = line.coords[1];
                const [c3, r3] = line.coords[2];

                const sym1 = resultMatrix[c1][r1];
                const sym2 = resultMatrix[c2][r2];
                const sym3 = resultMatrix[c3][r3];

                // Warunek wygranej: Wszystkie 3 takie same
                if (sym1 === sym2 && sym2 === sym3) {
                    const multiplier = getSymbolMultiplier(sym1);
                    const lineWin = amount * multiplier; // Możesz tu podzielić amount przez 5 jeśli chcesz by stawka była "na linię"

                    totalWin += lineWin;
                    winningLines.push({ line, symbol: sym1 });
                }
            });

            // Rozliczenie
            if (totalWin > 0) {
                const profit = totalWin - amount;

                // Rysowanie linii
                drawWinningLines(winningLines, svgLayer);

                // Animacja symboli
                winningLines.forEach(win => {
                    win.line.coords.forEach(([c, r]) => {
                        const cell = document.getElementById(`cell-${c}-${r}`);
                        if(cell) cell.classList.add("win-anim");
                    });
                });

                statusEl.innerHTML = `WYGRANA! <span style="color:#ffd700">+${formatujWalute(totalWin)}</span>`;
                windowEl.classList.add("win-animation");
                if(dom.audioKaching) { dom.audioKaching.currentTime=0; dom.audioKaching.play().catch(()=>{}); }

                // Zapis do bazy
                try {
                    await runTransaction(db, async (t) => {
                        const userRef = doc(db, "uzytkownicy", currentUserId);
                        const d = (await t.get(userRef)).data();
                        t.update(userRef, {
                            cash: d.cash + totalWin,
                            zysk: (d.zysk || 0) + profit,
                            totalValue: calculateTotalValue(d.cash + totalWin, d.shares)
                        });
                    });
                    showNotification(`Sloty: Wygrana ${formatujWalute(totalWin)}!`, 'news', 'positive');
                } catch(e) { console.error(e); }

            } else {
                statusEl.textContent = "SPRÓBUJ PONOWNIE";
                statusEl.style.color = "var(--text-muted)";
            }

            slotsSpinning = false;

        }, 2400);

    } catch (e) {
        slotsSpinning = false;
        statusEl.textContent = "BŁĄD SIECI";
        showMessage(e.message, "error");
    }
}

// Funkcja rysująca linie SVG
function drawWinningLines(winners, svgContainer) {
    const containerRect = document.querySelector('.slots-window').getBoundingClientRect();

    // Obliczamy środki komórek
    // Zakładamy, że kolumny są równe (33%) i rzędy są równe (33%)
    const cellW = containerRect.width / 3;
    const cellH = containerRect.height / 3;

    winners.forEach(win => {
        const coords = win.line.coords;
        let pathStr = "M "; // Move to

        coords.forEach(([col, row], index) => {
            // Środek komórki
            const x = (col * cellW) + (cellW / 2);
            const y = (row * cellH) + (cellH / 2);

            pathStr += `${x} ${y}`;
            if (index < coords.length - 1) pathStr += " L "; // Line to
        });

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathStr);
        path.setAttribute("class", "winning-line");
        path.style.stroke = win.line.color;

        svgContainer.appendChild(path);
    });
}
// ==========================================
// === DICE (KOŚCI) LOGIC ===
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("dice-slider");
    const btn = document.getElementById("btn-dice-roll");
    if(slider) {
        slider.addEventListener("input", updateDiceStats);
        updateDiceStats(); // init
    }
    if(btn) btn.addEventListener("click", onDiceRoll);
});

function updateDiceStats() {
    const val = parseInt(document.getElementById("dice-slider").value);
    const chance = val; // Roll under X
    const multiplier = (98 / chance).toFixed(2); // 2% house edge

    document.getElementById("dice-chance").textContent = chance + "%";
    document.getElementById("dice-multiplier").textContent = multiplier + "x";
    document.getElementById("btn-dice-roll").textContent = `RZUĆ PONIŻEJ ${val}`;
}

async function onDiceRoll() {
    const amount = parseFloat(document.getElementById("dice-amount").value);
    const target = parseInt(document.getElementById("dice-slider").value);
    const resultEl = document.getElementById("dice-result-val");

    if(isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
    if(amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        await runTransaction(db, async (t) => {
             const userRef = doc(db, "uzytkownicy", currentUserId);
             const d = (await t.get(userRef)).data();
             if(d.cash < amount) throw new Error("Brak środków");
             t.update(userRef, { cash: d.cash - amount, totalValue: calculateTotalValue(d.cash - amount, d.shares) });
        });

        portfolio.cash -= amount;
        updatePortfolioUI();

        // Animacja
        let rolls = 0;
        const interval = setInterval(() => {
            resultEl.textContent = (Math.random() * 100).toFixed(2);
            rolls++;
            if(rolls > 10) {
                clearInterval(interval);
                finalizeDice(amount, target);
            }
        }, 50);

    } catch(e) { showMessage(e.message, "error"); }
}

async function finalizeDice(bet, target) {
    const roll = Math.random() * 100;
    const resultEl = document.getElementById("dice-result-val");
    resultEl.textContent = roll.toFixed(2);

    if (roll < target) {
        resultEl.style.color = "var(--green)";
        const mult = 98 / target;
        const win = bet * mult;
        const profit = win - bet;

        await runTransaction(db, async (t) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const d = (await t.get(userRef)).data();
            t.update(userRef, { cash: d.cash + win, zysk: (d.zysk||0)+profit, totalValue: calculateTotalValue(d.cash+win, d.shares) });
        });
        if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
        showNotification(`Dice: Wygrana ${formatujWalute(win)}`, 'news', 'positive');
    } else {
        resultEl.style.color = "var(--red)";
        if(dom.audioError) dom.audioError.play().catch(()=>{});
    }
}

// ==========================================
// === KENO LOGIC ===
// ==========================================
let kenoPicks = [];
const KENO_PAYTABLE = {
    1: {1: 3},
    2: {2: 12},
    3: {2: 1, 3: 40},
    4: {3: 5, 4: 100},
    5: {3: 3, 4: 20, 5: 400},
    6: {3: 2, 4: 10, 5: 80, 6: 1000},
    7: {4: 5, 5: 30, 6: 200, 7: 3000},
    8: {4: 4, 5: 20, 6: 100, 7: 1500, 8: 8000},
    9: {4: 3, 5: 10, 6: 50, 7: 300, 8: 3000, 9: 10000},
    10: {5: 5, 6: 30, 7: 150, 8: 1000, 9: 5000, 10: 20000}
};

document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById("keno-board");
    if(board) {
        for(let i=1; i<=40; i++) {
            const btn = document.createElement("button");
            btn.className = "keno-btn";
            btn.textContent = i;
            btn.onclick = () => toggleKenoPick(i, btn);
            board.appendChild(btn);
        }
    }
    const btnPlay = document.getElementById("btn-keno-play");
    if(btnPlay) btnPlay.addEventListener("click", playKeno);
    document.getElementById("btn-keno-clear")?.addEventListener("click", () => {
        kenoPicks = [];
        document.querySelectorAll(".keno-btn").forEach(b => { b.className = "keno-btn"; });
        updateKenoPaytable();
    });
});

function toggleKenoPick(num, btn) {
    if(kenoPicks.includes(num)) {
        kenoPicks = kenoPicks.filter(n => n !== num);
        btn.classList.remove("selected");
    } else {
        if(kenoPicks.length >= 10) return;
        kenoPicks.push(num);
        btn.classList.add("selected");
    }
    updateKenoPaytable();
}

function updateKenoPaytable() {
    const pt = document.getElementById("keno-paytable");
    pt.innerHTML = `<strong>Wypłaty (${kenoPicks.length} liczb):</strong>`;
    const rates = KENO_PAYTABLE[kenoPicks.length] || {};
    for(const [hits, mult] of Object.entries(rates)) {
        const div = document.createElement("div");
        div.className = "kp-row";
        div.id = `kp-hit-${hits}`;
        div.innerHTML = `<span>Traf ${hits}</span> <span>${mult}x</span>`;
        pt.appendChild(div);
    }
}

async function playKeno() {
    const amount = parseFloat(document.getElementById("keno-amount").value);
    if(kenoPicks.length === 0) return showMessage("Wybierz liczby!", "error");
    if(amount > portfolio.cash) return showMessage("Brak siana!", "error");

    // Reset wizualny
    document.querySelectorAll(".keno-btn").forEach(b => {
        b.classList.remove("hit", "miss");
        if(kenoPicks.includes(parseInt(b.textContent))) b.classList.add("selected");
    });

    try {
        await runTransaction(db, async (t) => {
             const u = doc(db, "uzytkownicy", currentUserId);
             const d = (await t.get(u)).data();
             if(d.cash < amount) throw new Error("Brak środków");
             t.update(u, { cash: d.cash - amount, totalValue: calculateTotalValue(d.cash - amount, d.shares) });
        });
        portfolio.cash -= amount;
        updatePortfolioUI();

        // Losowanie
        const drawn = [];
        while(drawn.length < 10) {
            const r = Math.floor(Math.random() * 40) + 1;
            if(!drawn.includes(r)) drawn.push(r);
        }

        // Wynik
        let hits = 0;
        drawn.forEach(num => {
            const btn = [...document.querySelectorAll(".keno-btn")].find(b => b.textContent == num);
            if(kenoPicks.includes(num)) {
                hits++;
                setTimeout(() => btn.classList.add("hit"), 500); // Animacja
            } else {
                setTimeout(() => btn.classList.add("miss"), 500);
            }
        });

        setTimeout(async () => {
            const rates = KENO_PAYTABLE[kenoPicks.length] || {};
            const mult = rates[hits] || 0;

            if(mult > 0) {
                const win = amount * mult;
                await runTransaction(db, async (t) => {
                    const u = doc(db, "uzytkownicy", currentUserId);
                    const d = (await t.get(u)).data();
                    t.update(u, { cash: d.cash + win, zysk: (d.zysk||0)+(win-amount), totalValue: calculateTotalValue(d.cash+win, d.shares) });
                });
                if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
                showNotification(`Keno: Trafiono ${hits}! Wygrana: ${formatujWalute(win)}`, 'news', 'positive');
            } else {
                if(dom.audioError) dom.audioError.play().catch(()=>{});
            }
        }, 1000);

    } catch(e) { showMessage(e.message, "error"); }
}

// ==========================================
// === CASE OPENING LOGIC ===
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-case-open")?.addEventListener("click", openCase);
});

async function openCase() {
    const cost = parseInt(document.getElementById("case-type-select").value);
    if(cost > portfolio.cash) return showMessage("Nie stać Cię!", "error");

    const btn = document.getElementById("btn-case-open");
    const strip = document.getElementById("case-strip");
    const label = document.getElementById("case-win-label");

    btn.disabled = true;
    label.textContent = "Losowanie...";

    try {
        await runTransaction(db, async (t) => {
             const u = doc(db, "uzytkownicy", currentUserId);
             const d = (await t.get(u)).data();
             if(d.cash < cost) throw new Error("Brak środków");
             t.update(u, { cash: d.cash - cost, totalValue: calculateTotalValue(d.cash - cost, d.shares) });
        });
        portfolio.cash -= cost;
        updatePortfolioUI();

        // Generowanie itemów (Visual)
        strip.innerHTML = "";
        strip.style.transition = "none";
        strip.style.transform = "translateX(0px)";

        const items = [];
        const winIndex = 30; // Wygrana zawsze na 30. pozycji
        let finalItem = null;

        // Określenie wygranej (zależnie od skrzynki)
        // Szansa na profit: 30%
        const isWin = Math.random() < 0.35;
        const winMult = isWin ? (Math.random() * 5 + 1.2) : (Math.random() * 0.8); // 1.2x-6x lub 0.1x-0.8x
        const winVal = Math.floor(cost * winMult);

        for(let i=0; i<35; i++) {
            const isTarget = (i === winIndex);
            let val = isTarget ? winVal : Math.floor(cost * (Math.random() * 2));
            if(!isTarget && Math.random() > 0.9) val = cost * 5; // Fake rare items passing by

            let rarity = 1;
            if(val > cost) rarity = 2;
            if(val > cost * 3) rarity = 3;
            if(val > cost * 10) rarity = 4;

            const div = document.createElement("div");
            div.className = `case-item rarity-${rarity}`;
            div.innerHTML = `<div class="case-img">${rarity===4?'🏆':(rarity===3?'💍':(rarity===2?'💰':'💩'))}</div>${formatujWalute(val)}`;
            strip.appendChild(div);

            if(isTarget) finalItem = { val, rarity };
        }

        // Animacja
        const cardWidth = 104; // 100px width + 4px margin
        // Przesunięcie: (30 kart * szerokość) - (połowa okna) + (połowa karty) + losowy offset wewnątrz karty
        const offset = (winIndex * cardWidth) - (300) + (50) + (Math.random() * 40 - 20);

        setTimeout(() => {
            strip.style.transition = "transform 4s cubic-bezier(0.15, 0.85, 0.35, 1.0)";
            strip.style.transform = `translateX(-${offset}px)`;
        }, 50);

        setTimeout(async () => {
            if(finalItem.val > 0) {
                 await runTransaction(db, async (t) => {
                    const u = doc(db, "uzytkownicy", currentUserId);
                    const d = (await t.get(u)).data();
                    t.update(u, { cash: d.cash + finalItem.val, zysk: (d.zysk||0)+(finalItem.val-cost), totalValue: calculateTotalValue(d.cash+finalItem.val, d.shares) });
                });
                label.textContent = `Wygrałeś ${formatujWalute(finalItem.val)}!`;
                label.style.color = finalItem.val > cost ? "var(--green)" : "var(--text-muted)";
                if(finalItem.val > cost && dom.audioKaching) dom.audioKaching.play().catch(()=>{});
            }
            btn.disabled = false;
        }, 4100);

    } catch(e) {
        showMessage(e.message, "error");
        btn.disabled = false;
    }
}
// ==========================================
