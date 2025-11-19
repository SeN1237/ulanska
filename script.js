// --- SEKCJA 0: IMPORTY I KONFIGURACJA FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, onSnapshot, updateDoc, 
    collection, addDoc, query, orderBy, limit, Timestamp, 
    serverTimestamp, where, getDocs, writeBatch, deleteDoc, getDoc, runTransaction,
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

// --- SEKCJA 1: ZMIENNE GLOBALNE ---
let market = {
    ulanska:    { name: "Ułańska Dev",   price: 1, previousPrice: null, history: [], type: 'stock' },
    brzozair:   { name: "BrzozAir",      price: 1, previousPrice: null, history: [], type: 'stock' },
    rychbud:    { name: "RychBud",       price: 1, previousPrice: null, history: [], type: 'stock' },
    cosmosanit: { name: "Cosmosanit",    price: 100, previousPrice: null, history: [], type: 'stock' },
    bartcoin:   { name: "Bartcoin",      price: 1000, previousPrice: null, history: [], type: 'crypto' },
    igirium:    { name: "Igirium",       price: 500, previousPrice: null, history: [], type: 'crypto' }
};

const companyAbbreviations = {
    ulanska: "UŁDEV", rychbud: "RBUD", brzozair: "BAIR", cosmosanit: "COSIT",
    bartcoin: "BRC", igirium: "IGI"
};

let currentCompanyId = "ulanska";
let currentMarketType = "stocks"; 

let portfolio = {
    name: "Gość", cash: 0,
    shares: { ulanska: 0, rychbud: 0, brzozair: 0, cosmosanit: 0, bartcoin: 0, igirium: 0 },
    stats: { totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 },
    startValue: 100, zysk: 0, totalValue: 0, prestigeLevel: 0 
};

const PRESTIGE_REQUIREMENTS = [15000, 30000, 60000, 120000];
const TIP_COSTS = [1500, 1400, 1200, 1100, 1000];
const CRYPTO_PRESTIGE_REQUIREMENT = 3; 
const COMPANY_ORDER = ["ulanska", "rychbud", "brzozair", "cosmosanit", "bartcoin", "igirium"];
const CHART_COLORS = ['var(--blue)', '#FF6384', '#36A2EB', '#4BC0C0', '#9966FF', '#F0B90B', '#627EEA'];

// Zmienne UI/Logic
let chart = null;
let portfolioChart = null; 
let modalPortfolioChart = null; 
let currentUserId = null;
let chartHasStarted = false; 
let initialNewsLoaded = false; 
let initialChatLoaded = false; 
let audioUnlocked = false; 
let isChatCooldown = false;

// Zmienne Zakładów
let matchesCache = []; 
let activeDayTab = null; 
let currentBetSelection = null; 

// Unsubscribes
let unsubscribePortfolio, unsubscribeRumors, unsubscribeNews, unsubscribeLeaderboard, unsubscribeChat, unsubscribeGlobalHistory, unsubscribePersonalHistory, unsubscribeLimitOrders, unsubscribeBonds, unsubscribeMatch, unsubscribeActiveBets;

let dom = {};

// =============================================================
// === SEKCJA 2: DEFINICJE FUNKCJI (NAJPIERW FUNKCJE!) ===
// =============================================================

// --- AUTH HELPERS ---
async function onRegister(e) {
    e.preventDefault();
    const name = dom.registerForm.querySelector("#register-name").value;
    const email = dom.registerForm.querySelector("#register-email").value;
    const password = dom.registerForm.querySelector("#register-password").value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (cred.user) {
            await setDoc(doc(db, "uzytkownicy", cred.user.uid), {
                name: name, email: email, cash: 1000.00,
                shares: { ulanska: 0, rychbud: 0, brzozair: 0, cosmosanit: 0, bartcoin: 0, igirium: 0 },
                stats: { totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 },
                startValue: 1000.00, zysk: 0.00, totalValue: 1000.00,
                joinDate: Timestamp.fromDate(new Date()), prestigeLevel: 0 
            });
        }
    } catch (err) { showAuthMessage(err.message, "error"); }
}

async function onLogin(e) { 
    e.preventDefault(); 
    try { 
        await signInWithEmailAndPassword(auth, dom.loginForm.querySelector("#login-email").value, dom.loginForm.querySelector("#login-password").value); 
    } catch (err) { 
        showAuthMessage(err.message, "error"); 
    } 
}

function onLogout() { signOut(auth); }

function showAuthMessage(msg, type="info") { 
    if(dom.authMessage) {
        dom.authMessage.textContent = msg; 
        dom.authMessage.style.color = type==="error" ? "var(--red)" : "var(--green)"; 
    }
}

async function onResetPassword(e) {
    e.preventDefault();
    const email = dom.loginForm.querySelector("#login-email").value;
    if(!email) return showAuthMessage("Podaj email", "error");
    try { await sendPasswordResetEmail(auth, email); showAuthMessage("Wysłano link", "success"); } catch(err) { showAuthMessage(err.message, "error"); }
}

// --- UI HELPERS ---
function formatujWalute(liczba) {
    if (typeof liczba !== 'number') liczba = 0;
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).format(liczba);
}

function getPrestigeStars(level, type = 'normal') {
    if (!level || level === 0) return '';
    const starIcon = '⭐️';
    return type === 'chat' ? ` <span class="prestige-stars">(${starIcon.repeat(level)})</span>` : ` <span class="prestige-stars">${starIcon.repeat(level)}</span>`;
}

function showMessage(msg, type) {
    if (!dom.messageBox) return;
    dom.messageBox.textContent = msg; 
    dom.messageBox.style.color = type === "error" ? "var(--red)" : "var(--green)"; 
    setTimeout(() => dom.messageBox.textContent = "", 3000);
    if (audioUnlocked) {
        try {
            if (type === "error" && dom.audioError) { dom.audioError.currentTime = 0; dom.audioError.play().catch(()=>{}); }
            else if (type === "success" && dom.audioKaching) { dom.audioKaching.currentTime = 0; dom.audioKaching.play().catch(()=>{}); }
        } catch(e){}
    }
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
    } else if (type === 'chat') header = "Nowa Wiadomość";
    else if (type === 'tip') header = "Prywatna Wskazówka!";
    toast.innerHTML = `<strong>${header}</strong><p>${message}</p>`;
    dom.notificationContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-fade-out'); setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500); }, 5000);
}

function onChangeTheme(e) {
    const theme = e.target.value;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('simulatorTheme', theme);
    const newMode = (theme === 'light') ? 'light' : 'dark';
    if (chart) chart.updateOptions({ theme: { mode: newMode } });
    if (portfolioChart) portfolioChart.updateOptions({ theme: { mode: newMode } });
    if (modalPortfolioChart) modalPortfolioChart.updateOptions({ theme: { mode: newMode } });
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

// --- GIEŁDA & CHART LOGIC ---
function generateInitialCandles(count, basePrice) {
    let data = []; let lastClose = basePrice || 1;
    let timestamp = new Date().getTime() - (count * 60000);
    for (let i = 0; i < count; i++) {
        let open = lastClose;
        let close = open + (Math.random() - 0.5) * (basePrice * 0.02);
        let high = Math.max(open, close) + Math.random() * (basePrice * 0.01);
        let low = Math.min(open, close) - Math.random() * (basePrice * 0.01);
        open = Math.max(0.1, open); high = Math.max(0.1, high); 
        low = Math.max(0.1, low); close = Math.max(0.1, close);
        data.push({ x: new Date(timestamp), y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)] });
        lastClose = close; timestamp += 60000;
    }
    return data;
}

function updateMarketHistory(cid, price) {
    const hist = market[cid].history;
    if (!hist || hist.length === 0) return;
    const lastCandle = hist[hist.length - 1];
    const lastTime = new Date(lastCandle.x).getTime();
    const now = Date.now();

    if (now - lastTime > 60000) {
        const newCandle = { x: new Date(now), y: [price.toFixed(2), price.toFixed(2), price.toFixed(2), price.toFixed(2)] };
        hist.push(newCandle);
        if (hist.length > 100) hist.shift();
    } else {
        let high = Math.max(parseFloat(lastCandle.y[1]), price);
        let low = Math.min(parseFloat(lastCandle.y[2]), price);
        lastCandle.y[1] = high.toFixed(2);
        lastCandle.y[2] = low.toFixed(2);
        lastCandle.y[3] = price.toFixed(2);
    }
}

function initChart() {
    chart = new ApexCharts(dom.chartContainer, {
        series: [{ data: market[currentCompanyId].history }],
        chart: { type: 'candlestick', height: 350, toolbar: {show:false}, animations: {enabled:false} },
        theme: { mode: document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark' },
        xaxis: { type: 'datetime' },
        yaxis: { labels: { formatter: v => v.toFixed(2) } },
        plotOptions: { candlestick: { colors: { upward: '#28a745', downward: '#dc3545' } } }
    });
    chart.render();
}

function updatePriceUI() {
    if (!dom || !dom.stockPrice) return;
    const company = market[currentCompanyId];
    if (!company) return;
    
    const oldPriceText = dom.stockPrice.textContent.replace(/\s*zł/g, '').replace(',', '.').replace(/\s/g, '');
    const oldPrice = parseFloat(oldPriceText);
    dom.stockPrice.textContent = formatujWalute(company.price);
    
    const isCrypto = company.type === 'crypto';
    const greenClass = isCrypto ? 'flash-accent' : 'flash-green';
    const redClass = 'flash-red';

    if (!isNaN(oldPrice) && company.price > oldPrice) {
        dom.stockPrice.classList.remove(redClass, greenClass); dom.stockPrice.classList.add(greenClass); 
    } else if (!isNaN(oldPrice) && company.price < oldPrice) {
        dom.stockPrice.classList.remove(greenClass, redClass); dom.stockPrice.classList.add(redClass);
    }
    dom.stockPrice.addEventListener('animationend', () => dom.stockPrice.classList.remove(greenClass, redClass), { once: true }); 
}

function updateTickerTape() {
    if (!dom.tickerContent) return;
    let tickerHTML = "";
    COMPANY_ORDER.forEach(cid => {
        const company = market[cid];
        if (company && company.price) {
            const prev = company.previousPrice || company.price;
            let diff = 0;
            if(prev > 0) diff = ((company.price - prev) / prev) * 100;
            
            let cls = diff > 0.01 ? "ticker-up" : (diff < -0.01 ? "ticker-down" : "");
            let sign = diff > 0.01 ? "+" : "";
            if (company.type === 'crypto') cls += " ticker-crypto";
            
            tickerHTML += `<span class="ticker-item ${company.type==='crypto'?'ticker-item-crypto':''}">
                ${companyAbbreviations[cid]||cid} <strong>${company.price.toFixed(2)} zł</strong> <span class="${cls}">${sign}${diff.toFixed(2)}%</span>
            </span>`;
        }
    });
    dom.tickerContent.innerHTML = tickerHTML + tickerHTML;
}

// --- ZAKŁADY (BETTING) ---
function renderBettingPanel() {
    dom.matchInfo.innerHTML = "";
    dom.bettingForm.classList.add("hidden");

    if (!matchesCache || matchesCache.length === 0) {
        dom.matchInfo.innerHTML = "<p>Obecnie brak zaplanowanych meczów.</p>";
        return;
    }

    const matchesByDay = {};
    matchesCache.forEach(match => {
        const date = match.closeTime.toDate();
        const dateKey = date.toISOString().split('T')[0]; 
        if (!matchesByDay[dateKey]) matchesByDay[dateKey] = [];
        matchesByDay[dateKey].push(match);
    });

    const sortedDays = Object.keys(matchesByDay).sort();
    if (!activeDayTab || !matchesByDay[activeDayTab]) activeDayTab = sortedDays[0];

    const navContainer = document.createElement("div");
    navContainer.className = "betting-days-nav";

    sortedDays.forEach(dayKey => {
        const btn = document.createElement("button");
        btn.className = "day-tab-btn";
        if (dayKey === activeDayTab) btn.classList.add("active");
        
        const dateObj = new Date(dayKey);
        const btnLabel = dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'numeric' });
        btn.textContent = btnLabel.charAt(0).toUpperCase() + btnLabel.slice(1);
        btn.onclick = () => { activeDayTab = dayKey; renderBettingPanel(); };
        navContainer.appendChild(btn);
    });
    dom.matchInfo.appendChild(navContainer);

    const dayMatches = matchesByDay[activeDayTab];
    dayMatches.sort((a, b) => a.closeTime.seconds - b.closeTime.seconds);

    const table = document.createElement("table");
    table.className = "betting-table";
    table.innerHTML = `<thead><tr><th class="col-time">Godzina</th><th class="col-match">Mecz</th><th class="col-odds">Kursy (1 - X - 2)</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");

    dayMatches.forEach(match => {
        const tr = document.createElement("tr");
        const date = match.closeTime.toDate();
        const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        const isClosed = match.status !== 'open';
        const isResolved = match.status === 'resolved';

        let timeHtml = isResolved ? "Koniec" : (isClosed ? `<span class="match-live">LIVE</span>` : timeStr);
        let matchHtml = `<strong>${match.teamA}</strong><br><small>vs</small><br><strong>${match.teamB}</strong>`;
        if (isResolved) {
            let w = match.winner === 'draw' ? 'REMIS' : (match.winner === 'teamA' ? match.teamA : match.teamB);
            matchHtml += `<br><span class="match-finished">Wynik: ${w}</span>`;
        }

        const createBtn = (teamCode, odds, label) => `
            <button class="table-bet-btn" ${isClosed ? 'disabled' : ''}
                onclick="selectBet('${match.id}', '${teamCode}', ${odds}, '${match.teamA} vs ${match.teamB} [${label}]')">
                ${label}<small>${odds.toFixed(2)}</small>
            </button>`;

        const oddsHtml = `<div class="odds-btn-group">
            ${createBtn('teamA', match.oddsA, match.teamA)}
            ${createBtn('draw', match.oddsDraw, 'Remis')}
            ${createBtn('teamB', match.oddsB, match.teamB)}
        </div>`;

        tr.innerHTML = `<td class="col-time">${timeHtml}</td><td class="col-match">${matchHtml}</td><td class="col-odds">${oddsHtml}</td>`;
        tbody.appendChild(tr);
    });
    dom.matchInfo.appendChild(table);
}

window.selectBet = function(id, team, odds, label) {
    currentBetSelection = { id, team, odds };
    dom.bettingForm.classList.remove("hidden");
    if(dom.betTeamSelect) dom.betTeamSelect.style.display = 'none';
    dom.placeBetButton.textContent = `Postaw na: ${label} (Kurs: ${odds.toFixed(2)})`;
    dom.bettingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    dom.betAmount.focus();
};

async function onPlaceBet(e) {
    e.preventDefault();
    if (!currentBetSelection || !currentUserId) return;
    
    const matchData = matchesCache.find(m => m.id === currentBetSelection.id);
    if (matchData) {
        if (Date.now() >= matchData.closeTime.toDate().getTime()) {
            showMessage("Niestety, czas na zakłady już minął!", "error");
            dom.bettingForm.classList.add("hidden");
            renderBettingPanel(); 
            return;
        }
    }

    const amount = parseFloat(dom.betAmount.value);
    if (isNaN(amount) || amount <= 0) return showMessage("Podaj kwotę", "error");
    if (amount > portfolio.cash) return showMessage("Brak gotówki", "error");

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await transaction.get(userRef);
            if(userDoc.data().cash < amount) throw new Error("Brak środków");
            
            const newCash = userDoc.data().cash - amount;
            const newVal = calculateTotalValue(newCash, userDoc.data().shares);
            
            transaction.update(userRef, { cash: newCash, totalValue: newVal });
            const betRef = doc(collection(db, "active_bets"));
            transaction.set(betRef, {
                userId: currentUserId,
                userName: portfolio.name,
                matchId: currentBetSelection.id,
                betOn: currentBetSelection.team,
                odds: currentBetSelection.odds,
                betAmount: amount,
                status: "pending",
                createdAt: serverTimestamp()
            });
        });
        await addDoc(collection(db, "historia_transakcji"), { userId: currentUserId, userName: portfolio.name, type: "ZAKŁAD SPORTOWY", companyName: "Bukmacher", amount: 1, pricePerShare: currentBetSelection.odds, totalValue: -amount, timestamp: serverTimestamp(), status: "executed" });
        showMessage("Zakład przyjęty!", "success");
        dom.betAmount.value = "";
        dom.bettingForm.classList.add("hidden");
    } catch (err) {
        console.error(err);
        if (err.code === "permission-denied") showMessage("Błąd uprawnień. Odśwież stronę.", "error");
        else showMessage("Błąd: " + err.message, "error");
    }
}

function listenToActiveMatch() {
    if (unsubscribeMatch) unsubscribeMatch();
    unsubscribeMatch = onSnapshot(doc(db, "global", "zaklady"), (docSnap) => {
        if (docSnap.exists()) {
            matchesCache = docSnap.data().mecze || [];
            renderBettingPanel();
        } else {
            dom.matchInfo.innerHTML = "<p>Brak danych zakładów.</p>";
        }
    });
}

function listenToActiveBets(userId) {
    unsubscribeActiveBets = onSnapshot(query(collection(db, "active_bets"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(10)), (snap) => {
        dom.activeBetsFeed.innerHTML = "";
        if(snap.empty) dom.activeBetsFeed.innerHTML = "<p>Brak zakładów.</p>";
        snap.forEach(doc => {
            const b = doc.data();
            let st = b.status === 'won' ? 'Wygrana' : (b.status==='lost' ? 'Przegrana' : 'Oczekuje');
            let col = b.status === 'won' ? 'var(--green)' : (b.status==='lost' ? 'var(--red)' : 'var(--blue)');
            dom.activeBetsFeed.innerHTML += `<p>Stawka: ${formatujWalute(b.betAmount)} @ ${b.odds.toFixed(2)} <strong style="color:${col}">(${st})</strong></p>`;
        });
    });
}

// --- HANDEL & PORTFOLIO ---
function calculateTotalValue(cash, shares) {
    let val = cash;
    for(let cid in shares) if(market[cid]) val += shares[cid] * market[cid].price;
    return val;
}

function checkCryptoAccess() {
    if (!dom || !dom.orderPanel) return;
    const isCrypto = market[currentCompanyId].type === 'crypto';
    const hasAccess = portfolio.prestigeLevel >= CRYPTO_PRESTIGE_REQUIREMENT;
    if (isCrypto && !hasAccess) dom.orderPanel.classList.add("crypto-locked");
    else dom.orderPanel.classList.remove("crypto-locked");
}

function onSelectMarketType(e) {
    const targetType = e.target.dataset.marketType;
    if (targetType === currentMarketType) return;
    currentMarketType = targetType;
    dom.marketTypeTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.marketType === targetType));
    dom.companySelector.classList.toggle("hidden", targetType !== 'stocks');
    dom.cryptoSelector.classList.toggle("hidden", targetType !== 'crypto');
    changeCompany(targetType === 'stocks' ? "ulanska" : "bartcoin");
}

function onSelectCompany(e) {
    if (e.target.classList.contains("company-tab")) changeCompany(e.target.dataset.company);
}

function changeCompany(cid) {
    if (!market[cid]) return;
    currentCompanyId = cid;
    dom.companyName.textContent = market[cid].name;
    document.querySelectorAll(".company-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.company === cid));
    if (chart && market[cid].history.length > 0) chart.updateSeries([{ data: market[cid].history }]);
    updatePriceUI();
    if (dom.limitPrice) dom.limitPrice.value = market[cid].price.toFixed(2);
    checkCryptoAccess();
}

async function buyShares() { await tradeShares(true); }
async function sellShares() { await tradeShares(false); }

async function tradeShares(isBuy) {
    if(dom.orderPanel.classList.contains("crypto-locked")) return showMessage("Wymagany poziom 3 prestiżu", "error");
    const amount = parseInt(dom.amountInput.value);
    if(isNaN(amount) || amount <= 0) return showMessage("Błędna ilość", "error");
    const cid = currentCompanyId;
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
            t.update(uRef, { cash: newCash, shares: newShares, totalValue: newVal, 'stats.totalTrades': increment(1) });
        });
        await addDoc(collection(db, "historia_transakcji"), { userId: currentUserId, userName: portfolio.name, type: isBuy ? "KUPNO" : "SPRZEDAŻ", companyName: market[cid].name, amount, pricePerShare: price, totalValue: isBuy ? -cost : cost, timestamp: serverTimestamp(), status: "executed" });
        showMessage((isBuy ? "Kupiono " : "Sprzedano ") + amount + " akcji", "success");
    } catch(e) { showMessage(e.message, "error"); }
}

function onBuyMax() { const p = market[currentCompanyId].price; if(p>0) dom.amountInput.value = Math.floor(portfolio.cash/p); }
function onSellMax() { dom.amountInput.value = portfolio.shares[currentCompanyId]||0; }

function initPortfolioChart() {
    portfolioChart = new ApexCharts(dom.portfolioChartContainer, {
        series: [portfolio.cash], labels: ['Gotówka'],
        chart: { type: 'donut', height: 300 }, colors: CHART_COLORS,
        theme: { mode: document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark' },
        legend: { position: 'bottom' }, dataLabels: { enabled: false }
    });
    portfolioChart.render();
}

// --- LISTENERY INNE ---
function listenToRumors() {
    unsubscribeRumors = onSnapshot(query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(10)), snap => {
        dom.rumorsFeed.innerHTML = "";
        snap.forEach(d => {
            const r = d.data();
            dom.rumorsFeed.innerHTML += `<p style="color:${r.sentiment==='positive'?'var(--green)':'var(--red)'}">[${market[r.companyId]?market[r.companyId].name:'??'}] ${r.text} <small>- ${r.authorName}</small></p>`;
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
function listenToChat() {
    unsubscribeChat = onSnapshot(query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(30)), snap => {
        dom.chatFeed.innerHTML = "";
        snap.docs.reverse().forEach(d => {
            const m = d.data();
            dom.chatFeed.innerHTML += `<p class="${m.authorId===currentUserId?'my-message':''}"><strong class="clickable-user" onclick="showUserProfile('${m.authorId}')">${m.authorName}</strong>${getPrestigeStars(m.prestigeLevel,'chat')}: ${m.text}</p>`;
        });
        dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
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
        let r=1;
        snap.forEach(d => {
            const u = d.data();
            dom.leaderboardList.innerHTML += `<li class="${d.id===currentUserId?'highlight-me':''}"><span>${r}. ${u.name} ${getPrestigeStars(u.prestigeLevel)}<small>Zysk: ${formatujWalute(u.totalValue-u.startValue)}</small></span><strong>${formatujWalute(u.totalValue)}</strong></li>`;
            r++;
        });
    });
}
function listenToMarketNews() {
    unsubscribeNews = onSnapshot(query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(5)), snap => {
        snap.docChanges().forEach(c => { if(c.type==='added') {
            const n = c.doc.data();
            if(initialNewsLoaded) showNotification(n.text, 'news', n.impactType);
            dom.newsFeed.insertAdjacentHTML('afterbegin', `<p style="color:${n.impactType==='positive'?'var(--green)':'var(--red)'}">${n.text}</p>`);
        }});
        initialNewsLoaded = true;
    });
}
function listenToGlobalHistory() { unsubscribeGlobalHistory = onSnapshot(query(collection(db, "historia_transakcji"), orderBy("timestamp", "desc"), limit(15)), snap => { dom.globalHistoryFeed.innerHTML=""; snap.forEach(d => displayHistoryItem(dom.globalHistoryFeed, d.data(), true)); }); }
function listenToPersonalHistory(uid) { unsubscribePersonalHistory = onSnapshot(query(collection(db, "historia_transakcji"), where("userId","==",uid), orderBy("timestamp", "desc"), limit(15)), snap => { dom.personalHistoryFeed.innerHTML=""; snap.forEach(d => displayHistoryItem(dom.personalHistoryFeed, d.data(), false)); }); }

function asyncLimitOrder(e) { /* ... */ } // Placeholder for brevity, assuming standard logic
async function onPlaceLimitOrder(e) {
    e.preventDefault();
    if (!currentUserId) return;
    if (dom.orderPanel.classList.contains("crypto-locked")) return showMessage("Wymagany poziom 3", "error");
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
    unsubscribeLimitOrders = onSnapshot(query(collection(db, "limit_orders"), where("userId", "==", userId), orderBy("timestamp", "desc")), snap => {
        dom.limitOrdersFeed.innerHTML = "";
        if(snap.empty) dom.limitOrdersFeed.innerHTML = "<p>Brak zleceń.</p>";
        const t = document.createElement("table"); t.className="limit-order-table"; t.innerHTML = "<thead><tr><th>Typ</th><th>Spółka</th><th>Ilość</th><th>Cena</th><th>Status</th><th>Akcja</th></tr></thead><tbody></tbody>";
        snap.forEach(d => {
            const o = d.data();
            const cls = o.type.includes("KUPNO") ? (o.type.includes("Krypto")?"l-type-buy-crypto":"l-type-buy") : (o.type.includes("Krypto")?"l-type-sell-crypto":"l-type-sell");
            const act = o.status === 'pending' ? `<button class="cancel-order-btn" onclick="cancelLimit('${d.id}')">Anuluj</button>` : '-';
            t.querySelector("tbody").innerHTML += `<tr><td class="${cls}">${o.type}</td><td>${o.companyName}</td><td>${o.amount}</td><td>${o.limitPrice}</td><td>${o.status}</td><td>${act}</td></tr>`;
        });
        if(!snap.empty) dom.limitOrdersFeed.appendChild(t);
    });
}
window.cancelLimit = async function(id) { if(confirm("Anulować?")) await updateDoc(doc(db, "limit_orders", id), {status: "cancelled"}); };

async function onBuyBond(e) {
    e.preventDefault();
    const amt = parseFloat(dom.bondAmount.value);
    const type = dom.bondType.value;
    if(amt <= 0 || amt > portfolio.cash) return showMessage("Błędna kwota", "error");
    const days = type==="1"?1:(type==="2"?2:3);
    const rate = type==="1"?0.05:(type==="2"?0.10:0.15);
    const profit = amt * rate;
    try {
        await runTransaction(db, async t => {
            const uRef = doc(db, "uzytkownicy", currentUserId);
            const d = (await t.get(uRef)).data();
            if(d.cash < amt) throw new Error("Brak środków");
            t.update(uRef, { cash: d.cash - amt, totalValue: calculateTotalValue(d.cash-amt, d.shares), 'stats.bondsPurchased': increment(1) });
            const bondRef = doc(collection(db, "active_bonds"));
            t.set(bondRef, { userId: currentUserId, name: `Obligacja ${days}d (${rate*100}%)`, investment: amt, profit, redeemAt: Timestamp.fromMillis(Date.now()+(days*86400000)), status: "pending", createdAt: serverTimestamp() });
        });
        await addDoc(collection(db, "historia_transakcji"), { userId: currentUserId, userName: portfolio.name, type: "OBLIGACJA (ZAKUP)", companyName: `Obligacja ${days}d`, amount:0, pricePerShare:0, totalValue:-amt, timestamp: serverTimestamp(), status:"executed" });
        showMessage("Kupiono obligację!", "success");
    } catch(e) { showMessage(e.message, "error"); }
}
function listenToActiveBonds(userId) {
    unsubscribeBonds = onSnapshot(query(collection(db, "active_bonds"), where("userId", "==", userId), orderBy("createdAt", "desc")), snap => {
        dom.activeBondsFeed.innerHTML = snap.empty ? "<p>Brak obligacji.</p>" : "";
        snap.forEach(d => {
            const b = d.data();
            const st = b.status==='pending' ? `Oczekuje do ${b.redeemAt.toDate().toLocaleString()}` : 'Wykupiona';
            dom.activeBondsFeed.innerHTML += `<p><strong>${b.name}</strong>: ${formatujWalute(b.investment)} -> ${formatujWalute(b.investment+b.profit)} <br><small>${st}</small></p>`;
        });
    });
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

// --- MAIN INIT ---
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
            listenToChat(); 
            listenToGlobalHistory();
            listenToPersonalHistory(currentUserId);
            listenToLimitOrders(currentUserId);
            listenToActiveBonds(currentUserId);
            listenToActiveMatch();
            listenToActiveBets(currentUserId);
        } else {
            currentUserId = null;
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            dom.authContainer.classList.remove("show-register");
            
            if (unsubscribePortfolio) unsubscribePortfolio();
            if (unsubscribeMatch) unsubscribeMatch();
            chartHasStarted = false; chart = null; portfolioChart = null;
        }
    });
}

// --- DOM CONTENT LOADED (EXECUTED LAST) ---
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('simulatorTheme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);

    dom = {
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
        themeSelect: document.getElementById("theme-select"),
        tickerContent: document.getElementById("ticker-content"),
        marketTypeTabs: document.querySelectorAll(".market-type-tab"),
        companySelector: document.getElementById("company-selector"),
        cryptoSelector: document.getElementById("crypto-selector"),
        companyName: document.getElementById("company-name"),
        stockPrice: document.getElementById("stock-price"),
        chartContainer: document.getElementById("chart-container"),
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
        limitOrderForm: document.getElementById("limit-order-form"),
        limitType: document.getElementById("limit-type"),
        limitAmount: document.getElementById("limit-amount"),
        limitPrice: document.getElementById("limit-price"),
        limitOrdersFeed: document.getElementById("limit-orders-feed"),
        rumorForm: document.getElementById("rumor-form"),
        rumorInput: document.getElementById("rumor-input"),
        rumorsFeed: document.getElementById("rumors-feed"),
        buyTipButton: document.getElementById("buy-tip-button"), 
        tipCost: document.getElementById("tip-cost"), 
        newsFeed: document.getElementById("news-feed"), 
        leaderboardList: document.getElementById("leaderboard-list"),
        chatForm: document.getElementById("chat-form"),
        chatInput: document.getElementById("chat-input"),
        chatFeed: document.getElementById("chat-feed"),
        historyTabButtons: document.querySelectorAll("#history-tabs-panel .tab-btn"),
        globalHistoryFeed: document.getElementById("global-history-feed"),
        personalHistoryFeed: document.getElementById("personal-history-feed"),
        bondsForm: document.getElementById("bonds-form"),
        bondAmount: document.getElementById("bond-amount"),
        bondType: document.getElementById("bond-type"),
        activeBondsFeed: document.getElementById("active-bonds-feed"),
        matchInfo: document.getElementById("match-info"),
        bettingForm: document.getElementById("betting-form"),
        betAmount: document.getElementById("bet-amount"),
        betTeamSelect: document.getElementById("bet-team"),
        placeBetButton: document.getElementById("place-bet-button"),
        activeBetsFeed: document.getElementById("active-bets-feed"),
        modalOverlay: document.getElementById("user-profile-modal"),
        modalCloseButton: document.getElementById("modal-close-button"),
        modalUsername: document.getElementById("modal-username"),
        modalTotalValue: document.getElementById("modal-total-value"),
        modalTotalProfit: document.getElementById("modal-total-profit"),
        modalCash: document.getElementById("modal-cash"),
        modalJoinDate: document.getElementById("modal-join-date"),
        modalSharesList: document.getElementById("modal-shares-list"),
        modalPortfolioChartContainer: document.getElementById("modal-portfolio-chart-container"),
        modalPrestigeLevel: document.getElementById("modal-prestige-level"), 
        modalTotalTrades: document.getElementById("modal-total-trades"),
        modalTipsPurchased: document.getElementById("modal-tips-purchased"),
        modalBondsPurchased: document.getElementById("modal-bonds-purchased"),
        prestigeInfo: document.getElementById("prestige-info"), 
        prestigeNextGoal: document.getElementById("prestige-next-goal"), 
        prestigeButton: document.getElementById("prestige-button"), 
        audioKaching: document.getElementById("audio-kaching"),
        audioError: document.getElementById("audio-error"),
        audioNews: document.getElementById("audio-news"),
        notificationContainer: document.getElementById("notification-container")
    };

    if(dom.themeSelect) dom.themeSelect.value = savedTheme;

    // Listenery - functions are now defined above!
    dom.registerForm.addEventListener("submit", onRegister);
    dom.loginForm.addEventListener("submit", onLogin);
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
    dom.bondsForm.addEventListener("submit", onBuyBond); 
    dom.bettingForm.addEventListener("submit", onPlaceBet);
    dom.resetPasswordLink.addEventListener("click", onResetPassword);
    dom.themeSelect.addEventListener("change", onChangeTheme);
    dom.buyTipButton.addEventListener("click", onBuyTip);
    dom.prestigeButton.addEventListener("click", onPrestigeReset);
    dom.orderTabMarket.addEventListener("click", onSelectOrderTab);
    dom.orderTabLimit.addEventListener("click", onSelectOrderTab);
    dom.historyTabButtons.forEach(btn => btn.addEventListener("click", onSelectHistoryTab));
    dom.modalCloseButton.addEventListener("click", () => dom.modalOverlay.classList.add("hidden"));
    dom.modalOverlay.addEventListener("click", (e) => { if (e.target === dom.modalOverlay) dom.modalOverlay.classList.add("hidden"); });
    dom.showRegisterLink.addEventListener("click", (e) => { e.preventDefault(); dom.authContainer.classList.add("show-register"); showAuthMessage(""); });
    dom.showLoginLink.addEventListener("click", (e) => { e.preventDefault(); dom.authContainer.classList.remove("show-register"); showAuthMessage(""); });

    // --- FIX SPLASH SCREEN ---
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => splash.style.display = 'none', 1000);
        }
    }, 1000);

    startAuthListener();
});
