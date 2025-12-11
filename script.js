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

// --- ZMIENNE GLOBALNE ---
let market = {
    ulanska:    { name: "Ułańska Dev",   price: 1, previousPrice: null, history: [], type: 'stock' },
    brzozair:   { name: "BrzozAir",      price: 1, previousPrice: null, history: [], type: 'stock' },
    rychbud:    { name: "RychBud",       price: 1, previousPrice: null, history: [], type: 'stock' },
    cosmosanit: { name: "Cosmosanit",    price: 100, previousPrice: null, history: [], type: 'stock' },
    nicorp:     { name: "Nicorp",        price: 1000, previousPrice: null, history: [], type: 'crypto' },
    igirium:    { name: "Igirium",       price: 500, previousPrice: null, history: [], type: 'crypto' }
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
    'betting': 0, 
    'radio': 0,   
    'pvp': 0,  
    'race': 0, // Dostępne dla każdego   

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

// Zmienne dla zakładów
let matchesCache = []; 
let activeDayTab = null; 
let currentBetSelection = null; 

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
let unsubscribeChat = null; 
let unsubscribeGlobalHistory = null;
let unsubscribePersonalHistory = null;
let unsubscribeLimitOrders = null; 
let unsubscribeMatch = null;
let unsubscribeActiveBets = null;
let unsubscribePvP = null;

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

// --- NASŁUCHIWACZ CEN (Główna pętla danych) ---
const cenyDocRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const aktualneCeny = docSnap.data();
        
        if(aktualneCeny['bartcoin'] && !aktualneCeny['nicorp']) {
            aktualneCeny['nicorp'] = aktualneCeny['bartcoin'];
        }

        for (const companyId in market) {
            if (aktualneCeny[companyId] !== undefined) {
                market[companyId].previousPrice = market[companyId].price;
                market[companyId].price = aktualneCeny[companyId];
            }
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
        updatePortfolioUI(); // ZAKTUALIZOWANO: Wywołujemy portfel, by przeliczył wartość akcji
        updateTickerTape(); 

        const chartDataReady = market[currentCompanyId] && market[currentCompanyId].history.length > 0;
        if (currentUserId && !chartHasStarted && chartDataReady) {
            if (!chart) initChart();
            startChartTicker();    
            chartHasStarted = true;
        }
    }
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
                joinDate: Timestamp.fromDate(new Date()), prestigeLevel: 0 
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
        
        // Chat
        chatForm: document.getElementById("chat-form"),
        chatInput: document.getElementById("chat-input"),
        chatFeed: document.getElementById("chat-feed"),
        
        // History & Bonds
        historyTabButtons: document.querySelectorAll("#history-tabs-panel .tab-btn"),
        globalHistoryFeed: document.getElementById("global-history-feed"),
        personalHistoryFeed: document.getElementById("personal-history-feed"),
        
        // Zakłady
        matchInfo: document.getElementById("match-info"),
        bettingForm: document.getElementById("betting-form"),
        betAmount: document.getElementById("bet-amount"),
        placeBetButton: document.getElementById("place-bet-button"),
        activeBetsFeed: document.getElementById("active-bets-feed"),
        betTeamSelect: document.getElementById("bet-team"),

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


    // Listenery
    dom.navButtons.forEach(btn => btn.addEventListener("click", onSelectView)); 
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
    dom.bettingForm.addEventListener("submit", onPlaceBet);
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

    function toggleChat() {
        if(!chatWindow) return;
        chatWindow.classList.toggle("hidden");
        if (!chatWindow.classList.contains("hidden")) {
            if(chatBadge) chatBadge.classList.add("hidden");
            setTimeout(() => {
                if(chatFeedRef) chatFeedRef.scrollTop = chatFeedRef.scrollHeight;
            }, 100);
        }
    }

    if (chatFab) chatFab.addEventListener("click", toggleChat);
    if (closeChatBtn) closeChatBtn.addEventListener("click", toggleChat);

    document.addEventListener("click", (e) => {
        if (chatWindow && !chatWindow.classList.contains("hidden") && 
            !chatWindow.contains(e.target) && 
            !chatFab.contains(e.target)) {
            chatWindow.classList.add("hidden");
        }
    });
    // --- TUTAJ WKLEJ TEN KOD ---
    // Sterowanie Myszką (DSJ Style)
    const skiCanvasEl = document.getElementById("skijump-canvas"); 
    if(skiCanvasEl) {
        // Kliknięcie myszką (Start / Wybicie / Lądowanie)
        skiCanvasEl.addEventListener("mousedown", (e) => {
            e.preventDefault(); 
            handleSkiClick();
        });
        
        // Ruch myszką (Balans w locie)
        skiCanvasEl.addEventListener("mousemove", handleSkiMove);
        
        // Dotyk (Telefon)
        skiCanvasEl.addEventListener("touchstart", (e) => { 
            e.preventDefault(); 
            handleSkiClick(); 
        }, { passive: false });
    }
    // ---------------------------

    setTimeout(initDailyWheel, 1000);
    setTimeout(updateChessTournament, 2000); 
    
// ==========================================
// === CHESS.COM TOURNAMENT LOGIC (ALL MODES) ===
// ==========================================

// KONFIGURACJA GRACZY (Wpisz startowe ELO z dnia 10.12)
const CHESS_PLAYERS = [
    { 
        nick: "igiblack", 
        startBullet: 247, 
        startBlitz: 392, 
        startRapid: 698 
    },
	{ 
        nick: "kcprlx", 
        startBullet: 354, 
        startBlitz: 100, 
        startRapid: 354 
    },
	{ 
        nick: "Huzar2407", 
        startBullet: 349, 
        startBlitz: 349, 
        startRapid: 349 
    },
    // { nick: "TwójNick", startBullet: 800, startBlitz: 900, startRapid: 1000 }
];

async function updateChessTournament() {
    const tbody = document.getElementById("chess-leaderboard-body");
    const updateLabel = document.getElementById("chess-last-update");
    
    if(!tbody) return;

    // Helper do formatowania wyniku (kolor i znak)
    const formatDiff = (diff) => {
        if (diff > 0) return `<span style="color:var(--green); font-weight:bold;">+${diff}</span>`;
        if (diff < 0) return `<span style="color:var(--red); font-weight:bold;">${diff}</span>`;
        return `<span style="color:var(--text-muted); opacity:0.5;">0</span>`;
    };

    const promises = CHESS_PLAYERS.map(async (player) => {
        try {
            const response = await fetch(`https://api.chess.com/pub/player/${player.nick}/stats`);
            if(!response.ok) return null;
            const data = await response.json();
            
            // 1. Pobieramy aktualne rankingi (0 jeśli brak)
            const curBullet = data.chess_bullet?.last?.rating || 0;
            const curBlitz  = data.chess_blitz?.last?.rating  || 0;
            const curRapid  = data.chess_rapid?.last?.rating  || 0;

            // 2. Obliczamy przyrosty
            // Jeśli cur == 0 (gracz nie gra w ten tryb w ogóle), ustawiamy różnicę na 0, żeby nie pokazywało np. -1000
            const diffBullet = curBullet > 0 ? (curBullet - (player.startBullet || curBullet)) : 0;
            const diffBlitz  = curBlitz > 0  ? (curBlitz  - (player.startBlitz  || curBlitz))  : 0;
            const diffRapid  = curRapid > 0  ? (curRapid  - (player.startRapid  || curRapid))  : 0;

            // 3. Szukamy najlepszego wyniku do sortowania
            const maxGrowth = Math.max(diffBullet, diffBlitz, diffRapid);

            return {
                nick: player.nick,
                diffBullet,
                diffBlitz,
                diffRapid,
                maxGrowth // To służy tylko do ustalenia pozycji w rankingu
            };

        } catch (error) {
            console.error(`Błąd API dla ${player.nick}`);
            return null;
        }
    });

    const playersData = await Promise.all(promises);
    const validPlayers = playersData.filter(p => p !== null);
    
    // Sortujemy: Kto ma najwyższy "maxGrowth" jest pierwszy
    validPlayers.sort((a, b) => b.maxGrowth - a.maxGrowth);

    // --- RENDEROWANIE ---
    tbody.innerHTML = "";
    
    if(validPlayers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#aaa;">Brak danych.</td></tr>`;
        return;
    }

    validPlayers.forEach((p, index) => {
        let color = "#fff";
        let rank = index + 1;
        let icon = "";
        
        if (index === 0) { color = "#ffd700"; icon = "🥇"; }
        else if (index === 1) { color = "#c0c0c0"; icon = "🥈"; }
        else if (index === 2) { color = "#cd7f32"; icon = "🥉"; }

        // Tworzymy wiersz z 3 kolumnami wyników
        const row = `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px 5px; color: ${color}; font-weight:bold;">${rank} ${icon}</td>
                <td style="padding: 10px 5px;">
                    <strong style="color:var(--text-main); font-size:0.95em;">${p.nick}</strong>
                </td>
                <td style="padding: 10px 5px; text-align: center; background:rgba(255,255,255,0.02);">
                    ${formatDiff(p.diffBullet)}
                </td>
                <td style="padding: 10px 5px; text-align: center;">
                    ${formatDiff(p.diffBlitz)}
                </td>
                <td style="padding: 10px 5px; text-align: center; background:rgba(255,255,255,0.02);">
                    ${formatDiff(p.diffRapid)}
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const now = new Date();
    if(updateLabel) updateLabel.textContent = `Aktualizacja: ${now.toLocaleTimeString()}`;
}
// ================= WKLEJ KOD TUTAJ (START) =================
const btnRefresh = document.getElementById("btn-refresh-chess");
if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
        const icon = btnRefresh.querySelector("i");
        if(icon) icon.classList.add("fa-spin"); // Włącz kręcenie
        btnRefresh.disabled = true; // Zablokuj przycisk
        
        // Teraz ta funkcja jest widoczna, bo jesteśmy w tym samym bloku!
        await updateChessTournament();
        
        setTimeout(() => {
            if(icon) icon.classList.remove("fa-spin"); // Wyłącz kręcenie
            btnRefresh.disabled = false; // Odblokuj przycisk
        }, 500);
    });
}
	
    startAuthListener();
}); // <--- To jest klamra zamykająca DOMContentLoaded

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
            updatePortfolioUI();
            checkCryptoAccess();
        }
    });
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
    
    // 1. Zaktualizuj nazwę spółki
    dom.companyName.textContent = market[cid].name;
    
    // 2. Zaktualizuj aktywne przyciski
    document.querySelectorAll(".company-tab").forEach(t => t.classList.toggle("active", t.dataset.company === cid));
    
    // 3. Reset i przerysowanie wykresu (to już masz, ale dla pewności jest tutaj)
    if (chart) {
        chart.destroy();
        chart = null;
    }
    if(dom.chartContainer) dom.chartContainer.innerHTML = "";
    initChart();

    // --- POPRAWKA CENY (FIX) ---
    // Pobieramy aktualną cenę nowo wybranej spółki
    const newPrice = market[cid].price;
    
    // Zamiast czekać na updatePriceUI (które może animować),
    // WYMUSZAMY natychmiastowe wpisanie nowej ceny do HTML.
    dom.stockPrice.textContent = formatujWalute(newPrice);
    
    // Ważne: Resetujemy "zapamiętaną" cenę wyświetlaną dla tej spółki,
    // aby kolejna aktualizacja z tickera nie zwariowała.
    market[cid].displayedPrice = newPrice;
    // ---------------------------

    checkCryptoAccess();
}
async function buyShares() { await tradeShares(true); }
async function sellShares() { await tradeShares(false); }
async function tradeShares(isBuy) {
    if(dom.orderPanel.classList.contains("crypto-locked")) return showMessage("Wymagany wyższy poziom prestiżu", "error");
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
            // --- WKLEJ TEN KOD TUTAJ ---
            const wModal = document.getElementById("welcome-modal");
            if (wModal) wModal.classList.remove("hidden");
            // ---------------------------
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
            listenToActiveBets(currentUserId);
            listenToPvP();
            listenToRaces(); // <--- DODAJ TO
            listenToActiveMatch();
            
            dom.navButtons[0].click();
        } else {
            currentUserId = null;
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            dom.authContainer.classList.remove("show-register");
            
            if (unsubscribePortfolio) unsubscribePortfolio();
            chartHasStarted = false; chart = null; portfolioChart = null;
        }
    });
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
function onBuyMax() { const p = market[currentCompanyId].price; if(p>0) dom.amountInput.value = Math.floor(portfolio.cash/p); }
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
    unsubscribeLeaderboard = onSnapshot(query(collection(db, "uzytkownicy"), orderBy("prestigeLevel", "desc"), orderBy("totalValue", "desc"), limit(10)), snap => {
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

// --- BUKMACHERKA ---
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
    if (unsubscribeActiveBets) unsubscribeActiveBets();
    const q = query(collection(db, "active_bets"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    
    unsubscribeActiveBets = onSnapshot(q, (snap) => {
        dom.activeBetsFeed.innerHTML = "";
        const pendingBets = snap.docs.filter(d => d.data().status === 'pending');

        if (pendingBets.length === 0) {
            dom.activeBetsFeed.innerHTML = "<p>Brak zakładów w toku.</p>";
            return;
        }

        snap.forEach(d => {
            const bet = d.data();
            if (bet.status !== 'pending') return; 

            let pickedTeamName = "???";
            let cleanTitle = (bet.matchTitle || "").split(" [")[0]; 
            let teams = cleanTitle.split(" vs ");

            if (bet.betOn === 'draw') {
                pickedTeamName = "REMIS";
            } else if (teams.length >= 2) {
                if (bet.betOn === 'teamA') pickedTeamName = teams[0].trim();
                if (bet.betOn === 'teamB') pickedTeamName = teams[1].trim();
            } else {
                pickedTeamName = bet.betOn === 'teamA' ? 'Gospodarz' : 'Gość';
            }

            const html = `
                <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; font-size: 0.9em; color: var(--accent-color);">${cleanTitle}</span>
                        <span style="color: var(--text-muted); font-weight: 800; font-size: 0.8em;">W TOKU</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #ccc; margin-top: 4px;">
                        <span>Twój typ: <strong style="color: white; font-size: 1.1em;">${pickedTeamName}</strong> (@${bet.odds.toFixed(2)})</span>
                    </div>
                    <div style="text-align: right; font-size: 0.85em; margin-top: 2px;">
                        Stawka: ${new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(bet.betAmount)}
                    </div>
                </div>`;
            dom.activeBetsFeed.insertAdjacentHTML('beforeend', html);
        });
    });
}
function renderBettingPanel() {
    dom.matchInfo.innerHTML = "";
    dom.bettingForm.classList.add("hidden");

    if (!matchesCache || matchesCache.length === 0) {
        dom.matchInfo.innerHTML = "<p>Obecnie brak zaplanowanych wydarzeń.</p>";
        return;
    }

    // --- IKONY DYSCYPLIN ---
	const sportIcons = {
        'football': '<i class="fa-solid fa-futbol"></i>',
        'soccer': '<i class="fa-solid fa-futbol"></i>',
        'ski': '<i class="fa-solid fa-person-skiing"></i>',
        'f1': '<i class="fa-solid fa-flag-checkered"></i>',
        'mma': '<i class="fa-solid fa-hand-fist"></i>',
        'snooker': '<i class="fa-solid fa-pool-8-ball"></i>',
		'swim': '<i class="fa-solid fa-person-swimming"></i>',
		'dart': '<i class="fa-brands fa-dart-lang"></i>',
        'default': '<i class="fa-solid fa-calendar-day"></i>'
    };

    // --- GRUPOWANIE PO DATACH ---
    const matchesByDay = {};
    matchesCache.forEach(match => {
        const date = match.closeTime.toDate ? match.closeTime.toDate() : new Date(match.closeTime);
        const dateKey = date.toISOString().split('T')[0];
        if (!matchesByDay[dateKey]) matchesByDay[dateKey] = [];
        matchesByDay[dateKey].push(match);
    });

    const sortedDays = Object.keys(matchesByDay).sort();
    if (!activeDayTab || !matchesByDay[activeDayTab]) activeDayTab = sortedDays[0];

    // --- NAWIGACJA DAT ---
    const navContainer = document.createElement("div");
    navContainer.className = "betting-days-nav";

    sortedDays.forEach(dayKey => {
        const btn = document.createElement("button");
        btn.className = "day-tab-btn";
        if (dayKey === activeDayTab) btn.classList.add("active");
        
        const dateObj = new Date(dayKey);
        const btnLabel = dateObj.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' });
        btn.textContent = btnLabel.charAt(0).toUpperCase() + btnLabel.slice(1);
        
        btn.onclick = () => { activeDayTab = dayKey; renderBettingPanel(); };
        navContainer.appendChild(btn);
    });
    dom.matchInfo.appendChild(navContainer);

    // --- TABELA ---
    const dayMatches = matchesByDay[activeDayTab];
    dayMatches.sort((a, b) => {
        const tA = a.closeTime.toDate ? a.closeTime.toDate() : new Date(a.closeTime);
        const tB = b.closeTime.toDate ? b.closeTime.toDate() : new Date(b.closeTime);
        return tA - tB;
    });

    const table = document.createElement("table");
    table.className = "betting-table";
    table.innerHTML = `
        <thead>
            <tr>
                <th class="col-time">Godzina</th>
                <th class="col-match">Wydarzenie</th>
                <th class="col-odds">Opcje / Kursy</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    dayMatches.forEach(match => {
        const tr = document.createElement("tr");
        const date = match.closeTime.toDate ? match.closeTime.toDate() : new Date(match.closeTime);
        const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        
        const isClosed = match.status !== 'open';
        const isResolved = match.status === 'resolved';
        const icon = sportIcons[match.sport] || sportIcons['default'];

        // Status czasu
        let timeHtml = timeStr;
        if (isResolved) timeHtml = "Koniec";
        else if (isClosed) timeHtml = `<span class="match-live">LIVE</span>`;

        // Tytuł meczu (Obsługa 3 zawodników w tytule)
        let vsText = `<strong>${match.teamA}</strong> <small>vs</small> <strong>${match.teamB}</strong>`;
        if (match.teamC) {
            vsText += ` <small>vs</small> <strong>${match.teamC}</strong>`;
        }

        // 1. Sprawdzamy czy w bazie jest pole "eventName", jeśli nie -> wyświetlamy ID
        // Możesz w bazie dodać pole "eventName": "Grand Prix Monako"
        const displayLabel = match.eventName || match.id;

        let matchHtml = `<div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:var(--accent-color); font-size:1.3em;">${icon}</span>
                            <div style="display:flex; flex-direction:column; justify-content:center;">
                                <span style="font-size:0.7em; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">
                                    ${displayLabel}
                                </span>
                                <div style="line-height:1.2;">${vsText}</div>
                            </div>
                         </div>`;
                         
        if (isResolved) {
            let w = match.winner;
            if (w === 'draw') w = "REMIS";
            else if (w === 'teamA') w = match.teamA;
            else if (w === 'teamB') w = match.teamB;
            else if (w === 'teamC') w = match.teamC;
            
            matchHtml += `<br><span class="match-finished">Wygrał: ${w}</span>`;
        }

        // --- GENEROWANIE PRZYCISKÓW ---
        const createBtn = (teamCode, odds, label) => `
            <button class="table-bet-btn" ${isClosed ? 'disabled' : ''}
                onclick="selectBet('${match.id}', '${teamCode}', ${odds}, '${match.teamA} vs ${match.teamB}${match.teamC ? ' vs '+match.teamC : ''} [${label}]')">
                <span style="display:block; font-size:0.75em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85px;">${label}</span>
                <small style="color:var(--accent-color); font-weight:bold; font-size:0.9em;">${odds.toFixed(2)}</small>
            </button>`;

        const hasDraw = !match.teamC && (match.oddsDraw && match.oddsDraw > 1.0);
        const hasTeamC = match.teamC && match.oddsC;

        let oddsHtml = `<div class="odds-btn-group">
            ${createBtn('teamA', match.oddsA, match.teamA)}
            
            ${hasDraw ? createBtn('draw', match.oddsDraw, 'REMIS') : ''}
            
            ${createBtn('teamB', match.oddsB, match.teamB)}
            
            ${hasTeamC ? createBtn('teamC', match.oddsC, match.teamC) : ''}
        </div>`;

        tr.innerHTML = `<td class="col-time">${timeHtml}</td><td class="col-match">${matchHtml}</td><td class="col-odds">${oddsHtml}</td>`;
        tbody.appendChild(tr);
    });
    
    dom.matchInfo.appendChild(table);
}
window.selectBet = function(id, team, odds, label) {
    currentBetSelection = { id, team, odds, matchTitle: label };
    
    dom.bettingForm.classList.remove("hidden");
    
    const cleanLabel = label.split('[')[0].trim();
    
    dom.placeBetButton.textContent = `Postaw na: ${cleanLabel} (Kurs: ${odds.toFixed(2)})`;
    dom.placeBetButton.style.background = "var(--green)";
    dom.placeBetButton.style.color = "#000";
    
    dom.bettingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    dom.betAmount.focus();
};

async function onPlaceBet(e) {
    e.preventDefault();
    if (!currentBetSelection || !currentUserId) return;
    
    const amount = parseFloat(dom.betAmount.value);
    
    if (isNaN(amount) || amount <= 0) return showMessage("Podaj poprawną kwotę", "error");
    if (amount > portfolio.cash) return showMessage("Brak gotówki", "error");

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "uzytkownicy", currentUserId);
            const userDoc = await transaction.get(userRef);
            
            if(userDoc.data().cash < amount) throw new Error("Brak środków (walidacja serwera)");
            
            const newCash = userDoc.data().cash - amount;
            const newVal = calculateTotalValue(newCash, userDoc.data().shares);
            
            transaction.update(userRef, { cash: newCash, totalValue: newVal });
            
            const betRef = doc(collection(db, "active_bets"));
            transaction.set(betRef, {
                userId: currentUserId,
                userName: portfolio.name,
                matchId: currentBetSelection.id,
                matchTitle: currentBetSelection.matchTitle, 
                betOn: currentBetSelection.team, 
                odds: currentBetSelection.odds,
                betAmount: amount,
                matchResolveTime: null, 
                status: "pending",
                createdAt: serverTimestamp()
            });
        });

        await addDoc(collection(db, "historia_transakcji"), {
            userId: currentUserId, userName: portfolio.name,
            type: "ZAKŁAD SPORTOWY", companyName: "Bukmacher",
            amount: 1, pricePerShare: currentBetSelection.odds, totalValue: -amount,
            timestamp: serverTimestamp(), status: "executed"
        });

        showMessage("Zakład przyjęty!", "success");
        dom.betAmount.value = "";
        dom.bettingForm.classList.add("hidden");
        
    } catch (err) {
        console.error(err);
        showMessage("Błąd: " + err.message, "error");
    }
}

// ==========================================
// === SYSTEM PVP ===
// ==========================================

const playedAnimations = new Set(); 
const CARD_WIDTH = 120; 
const WINNER_INDEX = 60; 

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
    
    if (isNaN(amount) || amount < 100) return showMessage("Minimum 100 zł!", "error");
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
// === MULTIPLAYER RACE LOGIC (ŚLIMAKI) ===
// ==========================================

let activeRaceId = null;
let raceSubscription = null;
let raceAnimationInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    const btnCreate = document.getElementById("btn-race-create");
    const btnLeave = document.getElementById("btn-race-leave");
    const btnStart = document.getElementById("btn-race-start");

    if (btnCreate) btnCreate.addEventListener("click", createRace);
    if (btnLeave) btnLeave.addEventListener("click", leaveRaceView);
    if (btnStart) btnStart.addEventListener("click", startRace);
});

// 1. Nasłuchiwanie listy wyścigów (Lobby)
function listenToRaces() {
    // Nasłuchujemy tylko wyścigów "open" lub "racing" (żeby widzieć też trwające)
    const q = query(collection(db, "races"), where("status", "in", ["open", "racing"]));
    
    onSnapshot(q, (snap) => {
        const listEl = document.getElementById("race-list");
        if (!listEl) return;
        
        listEl.innerHTML = "";
        
        if (snap.empty) {
            listEl.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Brak aktywnych wyścigów.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const r = docSnap.data();
            const isFull = r.players.length >= 8;
            const isIngame = r.players.some(p => p.id === currentUserId);
            const statusText = r.status === 'racing' ? 'W TRAKCIE' : 'OTWARTY';
            
            // Jeśli jesteśmy w tym wyścigu, automatycznie przełączamy widok na tor
            if (isIngame && activeRaceId !== docSnap.id) {
                enterRaceView(docSnap.id);
            }

            const div = document.createElement("div");
            div.className = "race-lobby-card";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${formatujWalute(r.entryFee)}</strong>
                    <span style="color:${r.status==='racing'?'var(--red)':'var(--green)'}">${statusText}</span>
                </div>
                <div style="font-size:0.9em; color:#ccc;">Host: ${r.hostName}</div>
                <div style="font-size:0.9em;">Graczy: ${r.players.length} / 8</div>
                <button class="btn-accent" style="margin-top:5px;" 
                    onclick="joinRace('${docSnap.id}', ${r.entryFee})" 
                    ${(isFull || r.status !== 'open') ? 'disabled' : ''}>
                    ${r.status === 'racing' ? 'TRWA...' : (isFull ? 'PEŁNY' : 'DOŁĄCZ')}
                </button>
            `;
            listEl.appendChild(div);
        });
    });
}

// 2. Tworzenie wyścigu
async function createRace() {
    const input = document.getElementById("race-create-amount");
    const amount = parseFloat(input.value);

    if (isNaN(amount) || amount < 100) return showMessage("Min. 100 zł!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        await runTransaction(db, async (t) => {
            const uRef = doc(db, "uzytkownicy", currentUserId);
            const d = (await t.get(uRef)).data();
            if (d.cash < amount) throw new Error("Brak środków!");
            
            t.update(uRef, { cash: d.cash - amount, totalValue: calculateTotalValue(d.cash - amount, d.shares) });
            
            const raceRef = doc(collection(db, "races"));
            t.set(raceRef, {
                hostId: currentUserId,
                hostName: portfolio.name,
                entryFee: amount,
                status: "open", // open, racing, finished
                createdAt: serverTimestamp(),
                players: [{
                    id: currentUserId,
                    name: portfolio.name,
                    avatar: '🐌', // Domyślny, można losować
                    color: getRandomColor()
                }],
                winnerIndex: -1
            });
        });
        showMessage("Pokój utworzony!", "success");
    } catch (e) {
        showMessage(e.message, "error");
    }
}

// 3. Dołączanie do wyścigu
window.joinRace = async function(raceId, fee) {
    if (portfolio.cash < fee) return showMessage("Nie stać Cię!", "error");
    if (!confirm(`Dołączyć za ${formatujWalute(fee)}?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const raceRef = doc(db, "races", raceId);
            const uRef = doc(db, "uzytkownicy", currentUserId);
            
            const rDoc = await t.get(raceRef);
            const uDoc = await t.get(uRef);
            
            if (!rDoc.exists()) throw new Error("Wyścig nie istnieje.");
            const rData = rDoc.data();
            
            if (rData.status !== 'open') throw new Error("Wyścig już ruszył!");
            if (rData.players.length >= 8) throw new Error("Pokój pełny!");
            if (rData.players.some(p => p.id === currentUserId)) throw new Error("Już tu jesteś!");
            if (uDoc.data().cash < fee) throw new Error("Brak siana!");

            // Pobranie opłaty
            const newCash = uDoc.data().cash - fee;
            t.update(uRef, { cash: newCash, totalValue: calculateTotalValue(newCash, uDoc.data().shares) });

            // Dodanie gracza
            const newPlayers = [...rData.players, {
                id: currentUserId,
                name: portfolio.name,
                avatar: '🐌',
                color: getRandomColor()
            }];
            
            t.update(raceRef, { players: newPlayers });
        });
    } catch (e) {
        showMessage(e.message, "error");
    }
};

// 4. Wejście do widoku toru (Lobby -> Tor)
function enterRaceView(raceId) {
    activeRaceId = raceId;
    document.getElementById("race-lobby-view").classList.add("hidden");
    document.getElementById("race-track-view").classList.remove("hidden");
    
    // Nasłuchiwanie konkretnego wyścigu
    if (raceSubscription) raceSubscription();
    
    raceSubscription = onSnapshot(doc(db, "races", raceId), (docSnap) => {
        if (!docSnap.exists()) {
            leaveRaceView();
            return;
        }
        renderRaceBoard(docSnap.data());
    });
}

function leaveRaceView() {
    activeRaceId = null;
    if (raceSubscription) raceSubscription();
    if (raceAnimationInterval) clearInterval(raceAnimationInterval);
    
    document.getElementById("race-lobby-view").classList.remove("hidden");
    document.getElementById("race-track-view").classList.add("hidden");
}

function getRandomColor() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#ffa500'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 5. Renderowanie planszy i animacja
function renderRaceBoard(data) {
    const container = document.getElementById("race-tracks-container");
    const potDisplay = document.getElementById("race-pot-display");
    const btnStart = document.getElementById("btn-race-start");
    const statusMsg = document.getElementById("race-status-message");

    const totalPot = data.entryFee * data.players.length;
    potDisplay.textContent = formatujWalute(totalPot);

    // Host widzi przycisk Start
    if (data.hostId === currentUserId && data.status === 'open' && data.players.length > 1) {
        btnStart.classList.remove("hidden");
    } else {
        btnStart.classList.add("hidden");
    }

    // Jeśli status open, tylko wyświetlamy listę. Jeśli racing - animujemy.
    if (data.status === 'open') {
        statusMsg.textContent = `Oczekiwanie na graczy... (${data.players.length}/8)`;
        container.innerHTML = "";
        data.players.forEach((p, idx) => {
            container.innerHTML += `
                <div class="race-lane">
                    <div class="snail-name" style="left: 0%">${p.name}</div>
                    <div class="race-snail" style="left: 0%; color: ${p.color}">${p.avatar}</div>
                </div>
            `;
        });
    } else if (data.status === 'racing' || data.status === 'finished') {
        statusMsg.textContent = data.status === 'racing' ? "JADĄĄĄĄ!!!!" : `WYGRAŁ: ${data.players[data.winnerIndex].name}`;
        
        // Jeśli animacja jeszcze nie ruszyła, zacznij
        if (!raceAnimationInterval && data.status === 'racing') {
            runClientSideRaceAnimation(data.players, data.winnerIndex);
        } else if (data.status === 'finished') {
             // Pokaż wynik końcowy statycznie (dla tych co weszli po fakcie)
             container.innerHTML = "";
             data.players.forEach((p, idx) => {
                 const isWinner = idx === data.winnerIndex;
                 container.innerHTML += `
                    <div class="race-lane" style="background: ${isWinner ? 'rgba(0,255,0,0.1)' : 'transparent'}">
                        <div class="snail-name" style="left: ${isWinner ? '90%' : (Math.random()*80)+'%'}">${p.name}</div>
                        <div class="race-snail ${isWinner ? 'winner' : ''}" style="left: ${isWinner ? '90%' : (Math.random()*80)+'% '}; color: ${p.color}">${p.avatar}</div>
                    </div>
                `;
             });
        }
    }
}

// 6. Start wyścigu (Logika Hosta)
async function startRace() {
    if (!activeRaceId) return;
    
    try {
        await runTransaction(db, async (t) => {
            const raceRef = doc(db, "races", activeRaceId);
            const rDoc = await t.get(raceRef);
            const data = rDoc.data();
            
            if (data.status !== 'open') throw new Error("Już ruszyło!");
            
            // Losujemy zwycięzcę (indeks w tablicy players)
            const winnerIndex = Math.floor(Math.random() * data.players.length);
            const winnerId = data.players[winnerIndex].id;
            const totalPot = data.entryFee * data.players.length;
            
            // Wypłata OD RAZU (bezpieczeństwo)
            const winnerRef = doc(db, "uzytkownicy", winnerId);
            const wDoc = await t.get(winnerRef);
            const wData = wDoc.data();
            
            const newCash = wData.cash + totalPot;
            const newProfit = (wData.zysk || 0) + (totalPot - data.entryFee); // Zysk netto
            
            t.update(winnerRef, { 
                cash: newCash, 
                zysk: newProfit, 
                totalValue: calculateTotalValue(newCash, wData.shares)
            });
            
            // Zapisujemy w wyścigu kto wygrał i zmieniamy status
            t.update(raceRef, { 
                status: 'racing', 
                winnerIndex: winnerIndex 
            });
        });
    } catch(e) {
        showMessage(e.message, "error");
    }
}

// 7. Animacja kliencka (tylko wizualna)
function runClientSideRaceAnimation(players, winnerIndex) {
    const container = document.getElementById("race-tracks-container");
    const positions = new Array(players.length).fill(0);
    const speeds = players.map(() => Math.random() * 0.5 + 0.2);
    
    // Budujemy DOM
    container.innerHTML = "";
    const snailEls = [];
    players.forEach((p, idx) => {
        const lane = document.createElement("div");
        lane.className = "race-lane";
        lane.innerHTML = `
             <div class="snail-name" id="name-${idx}">${p.name}</div>
             <div class="race-snail" id="snail-${idx}" style="color: ${p.color}">${p.avatar}</div>
        `;
        container.appendChild(lane);
        snailEls.push({
            el: lane.querySelector(".race-snail"),
            nameEl: lane.querySelector(".snail-name")
        });
    });

    let finished = false;

    raceAnimationInterval = setInterval(() => {
        if (!activeRaceId) { clearInterval(raceAnimationInterval); return; }
        
        for (let i = 0; i < players.length; i++) {
            // Zwycięzca ma boosta, reszta losowo
            let move = Math.random() * 0.8;
            if (i === winnerIndex) move += 0.15; // Lekka przewaga, żeby wygrał
            
            positions[i] += move;
            
            // Cap na 90% (meta)
            if (positions[i] > 90) positions[i] = 90;
            
            snailEls[i].el.style.left = positions[i] + "%";
            snailEls[i].nameEl.style.left = positions[i] + "%";
            
            // Sprawdzenie końca animacji
            if (i === winnerIndex && positions[i] >= 90) {
                finished = true;
            }
        }
        
        if (finished) {
            clearInterval(raceAnimationInterval);
            raceAnimationInterval = null;
            // Oznaczamy w bazie że koniec animacji (opcjonalne, tutaj po prostu kończymy lokalnie)
            // Można dodać klasę winner
            snailEls[winnerIndex].el.classList.add("winner");
            
            // Po 3 sekundach zmieniamy status w bazie na 'finished' żeby wyczyścić pokój (Host to robi)
            if (players[winnerIndex].id === currentUserId || players[0].id === currentUserId) {
                 setTimeout(() => {
                    updateDoc(doc(db, "races", activeRaceId), { status: 'finished' }).catch(()=>{});
                 }, 4000);
            }
        }
    }, 50); // 50ms klatka
}
// ==========================================
// === WIG ROAD (CROSSY) LOGIC ===
// ==========================================

let activeCrossyId = null;
let crossySubscription = null;
let crossyGameLoop = null;
let crossyPlayer = { x: 0, y: 0, gridX: 6, gridY: 10, dead: false };
let crossyMap = []; // Rows of obstacles
let crossyScore = 0;
let crossyGameState = 'lobby'; // lobby, playing, dead
let crossyGridSize = 40;
let crossyOffset = 0; // Camera scroll
let crossyCanvas, crossyCtx;

// --- INIT & LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
    const btnCreate = document.getElementById("btn-crossy-create");
    const btnStart = document.getElementById("btn-crossy-start");
    const btnLeave = document.getElementById("btn-crossy-leave");

    if (btnCreate) btnCreate.addEventListener("click", createCrossyLobby);
    if (btnStart) btnStart.addEventListener("click", startCrossyGameHost);
    if (btnLeave) btnLeave.addEventListener("click", leaveCrossyGame);

	// --- STEROWANIE MOBILNE (DODANE) ---
    const btnUp = document.getElementById("btn-c-up");
    const btnDown = document.getElementById("btn-c-down");
    const btnLeft = document.getElementById("btn-c-left");
    const btnRight = document.getElementById("btn-c-right");

    // Używamy 'pointerdown' dla szybszej reakcji niż 'click' na mobile
    // Funkcja helpera, żeby nie powtarzać kodu
    const handleMobileMove = (dx, dy) => {
        if (crossyGameState === 'playing' && activeCrossyId) {
            moveCrossy(dx, dy);
            // Opcjonalnie: wibracja przy ruchu
            if (navigator.vibrate) navigator.vibrate(20); 
        }
    };

    if(btnUp) btnUp.addEventListener("pointerdown", (e) => { e.preventDefault(); handleMobileMove(0, -1); });
    if(btnDown) btnDown.addEventListener("pointerdown", (e) => { e.preventDefault(); handleMobileMove(0, 1); });
    if(btnLeft) btnLeft.addEventListener("pointerdown", (e) => { e.preventDefault(); handleMobileMove(-1, 0); });
    if(btnRight) btnRight.addEventListener("pointerdown", (e) => { e.preventDefault(); handleMobileMove(1, 0); });

    // Klawisze
    window.addEventListener('keydown', (e) => {
        if (crossyGameState === 'playing' && activeCrossyId) {
            if (e.key === 'ArrowUp' || e.key === 'w') moveCrossy(0, -1);
            else if (e.key === 'ArrowDown' || e.key === 's') moveCrossy(0, 1);
            else if (e.key === 'ArrowLeft' || e.key === 'a') moveCrossy(-1, 0);
            else if (e.key === 'ArrowRight' || e.key === 'd') moveCrossy(1, 0);
        }
    });

    // Uruchom nasłuchiwanie
    setTimeout(listenToCrossyLobbies, 2000);
});

// --- LOBBY SYSTEM ---
function listenToCrossyLobbies() {
    const q = query(collection(db, "crossy_lobbies"), where("status", "in", ["open", "playing"]));
    
    onSnapshot(q, (snap) => {
        const listEl = document.getElementById("crossy-list");
        if (!listEl) return;
        listEl.innerHTML = "";
        
        if (snap.empty) {
            listEl.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Brak aktywnych gier.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const r = docSnap.data();
            const isFull = r.players.length >= 8;
            const isIngame = r.players.some(p => p.id === currentUserId);
            
            if (isIngame && activeCrossyId !== docSnap.id) {
                enterCrossyGame(docSnap.id);
            }

            const div = document.createElement("div");
            div.className = "race-lobby-card";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${formatujWalute(r.entryFee)}</strong>
                    <span style="color:${r.status==='playing'?'var(--red)':'var(--green)'}">${r.status.toUpperCase()}</span>
                </div>
                <div style="font-size:0.9em; color:#ccc;">Host: ${r.hostName}</div>
                <div style="font-size:0.9em;">Graczy: ${r.players.length} / 8</div>
                <button class="btn-accent" style="margin-top:5px;" 
                    onclick="joinCrossyLobby('${docSnap.id}', ${r.entryFee})" 
                    ${(isFull || r.status !== 'open') ? 'disabled' : ''}>
                    ${r.status === 'playing' ? 'W TOKU' : 'DOŁĄCZ'}
                </button>
            `;
            listEl.appendChild(div);
        });
    });
}

async function createCrossyLobby() {
    const amount = parseFloat(document.getElementById("crossy-create-amount").value);
    if (isNaN(amount) || amount < 100) return showMessage("Min. 100 zł!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        await runTransaction(db, async (t) => {
            const uRef = doc(db, "uzytkownicy", currentUserId);
            const d = (await t.get(uRef)).data();
            if (d.cash < amount) throw new Error("Brak środków!");
            
            t.update(uRef, { cash: d.cash - amount, totalValue: calculateTotalValue(d.cash - amount, d.shares) });
            
            const ref = doc(collection(db, "crossy_lobbies"));
            t.set(ref, {
                hostId: currentUserId,
                hostName: portfolio.name,
                entryFee: amount,
                status: "open",
                createdAt: serverTimestamp(),
                players: [{ id: currentUserId, name: portfolio.name, score: 0, dead: false }]
            });
        });
        showMessage("Pokój utworzony!", "success");
    } catch (e) { showMessage(e.message, "error"); }
}

window.joinCrossyLobby = async function(id, fee) {
    if (portfolio.cash < fee) return showMessage("Nie stać Cię!", "error");
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "crossy_lobbies", id);
            const uRef = doc(db, "uzytkownicy", currentUserId);
            
            const docSnap = await t.get(ref);
            const uDoc = await t.get(uRef);
            
            if (!docSnap.exists()) throw new Error("Pokój nie istnieje.");
            const data = docSnap.data();
            
            if (data.status !== 'open') throw new Error("Gra już trwa!");
            if (data.players.length >= 8) throw new Error("Pełny pokój!");
            if (uDoc.data().cash < fee) throw new Error("Brak środków!");
            
            const newPlayers = [...data.players, { id: currentUserId, name: portfolio.name, score: 0, dead: false }];
            
            t.update(uRef, { cash: uDoc.data().cash - fee, totalValue: calculateTotalValue(uDoc.data().cash - fee, uDoc.data().shares) });
            t.update(ref, { players: newPlayers });
        });
    } catch (e) { showMessage(e.message, "error"); }
};

function enterCrossyGame(id) {
    activeCrossyId = id;
    document.getElementById("crossy-lobby-view").classList.add("hidden");
    document.getElementById("crossy-game-view").classList.remove("hidden");
    
    crossyCanvas = document.getElementById("crossy-canvas");
    crossyCtx = crossyCanvas.getContext('2d');
    
    if (crossySubscription) crossySubscription();
    
    // --- NASŁUCHIWANIE STANU GRY ---
    crossySubscription = onSnapshot(doc(db, "crossy_lobbies", id), (snap) => {
        if (!snap.exists()) { leaveCrossyGame(); return; }
        const data = snap.data();
        
        // 1. ZNAJDŹ SIEBIE NA LIŚCIE GRACZY
        const myData = data.players.find(p => p.id === currentUserId);

        // 2. AKTUALIZACJA UI
        document.getElementById("crossy-pot-display").textContent = formatujWalute(data.entryFee * data.players.length);
        const aliveCount = data.players.filter(p => !p.dead).length;
        document.getElementById("crossy-players-status").textContent = `Graczy: ${data.players.length} | Żywych: ${aliveCount}`;

        // 3. SPRAWDZENIE ŚMIERCI (ANTY-CHEAT / REFRESH FIX)
        // Jeśli w bazie jesteś martwy, wymuś stan "dead" lokalnie
        if (myData && myData.dead) {
            crossyGameState = 'dead';
            crossyPlayer.dead = true;
            
            // Pokaż ekran przegranej
            const overlay = document.getElementById("crossy-overlay");
            const msg = document.getElementById("crossy-msg");
            overlay.classList.remove("hidden");
            msg.innerHTML = `PRZEGRAŁEŚ!<br>Twój wynik: ${myData.score}<br><span style="font-size:0.5em">Czekaj na innych... (Nie odświeżaj)</span>`;
            document.getElementById("btn-crossy-start").classList.add("hidden");
            
            // Zatrzymaj pętlę gry, jeśli działa
            if (crossyGameLoop) cancelAnimationFrame(crossyGameLoop);
            
            // Jeśli gra się skończyła (finished), pokaż zwycięzcę
            if (data.status === 'finished') {
                 const sorted = [...data.players].sort((a,b) => b.score - a.score);
                 const winner = sorted[0];
                 msg.innerHTML = `<span style="color:gold">KONIEC!</span><br>Wygrał: ${winner.name} (Wynik: ${winner.score})`;
            }
            
            // WAŻNE: Przerywamy funkcję tutaj, żeby nie odpalić initCrossyEngine poniżej
            return; 
        }

        // Host Control
        const btnStart = document.getElementById("btn-crossy-start");
        const msg = document.getElementById("crossy-msg");
        const overlay = document.getElementById("crossy-overlay");

        if (data.status === 'open') {
            overlay.classList.remove("hidden");
            if (data.hostId === currentUserId) {
                btnStart.classList.remove("hidden");
                msg.textContent = "Jesteś Hostem. Startuj!";
            } else {
                btnStart.classList.add("hidden");
                msg.textContent = "Oczekiwanie na Hosta...";
            }
        } else if (data.status === 'playing') {
            // Start Local Game if not started AND player is alive
            if (crossyGameState === 'lobby' && (!myData || !myData.dead)) {
                initCrossyEngine();
            }
            btnStart.classList.add("hidden");
        } else if (data.status === 'finished') {
             // Show Winner
             crossyGameState = 'finished';
             overlay.classList.remove("hidden");
             
             const sorted = [...data.players].sort((a,b) => b.score - a.score);
             const winner = sorted[0];
             
             msg.innerHTML = `<span style="color:gold">KONIEC!</span><br>Wygrał: ${winner.name} (Wynik: ${winner.score})`;
        }
    });
}

async function startCrossyGameHost() {
    if (!activeCrossyId) return;
    await updateDoc(doc(db, "crossy_lobbies", activeCrossyId), { status: "playing" });
}

function leaveCrossyGame() {
    activeCrossyId = null;
    crossyGameState = 'lobby';
    if (crossySubscription) crossySubscription();
    if (crossyGameLoop) cancelAnimationFrame(crossyGameLoop);
    
    document.getElementById("crossy-lobby-view").classList.remove("hidden");
    document.getElementById("crossy-game-view").classList.add("hidden");
}

// --- GAME ENGINE (CANVAS) ---
function initCrossyEngine() {
    crossyGameState = 'playing';
    document.getElementById("crossy-overlay").classList.add("hidden");
    
    // Reset Vars
    crossyScore = 0;
    crossyOffset = 0;
    crossyPlayer = { x: 7, y: 0, dead: false }; // Start na dole (Grid Y=0 to current row)
    
    // Generate Initial Map
    crossyMap = [];
    for(let i=0; i<20; i++) generateCrossyRow(i); // Generuj 20 rzędów w górę
    
    document.getElementById("crossy-score").textContent = "0";
    
    // Start Loop
    loopCrossy();
}

function generateCrossyRow(index) {
    // 0-2: Safe Grass
    // >2: Random (Road, Water, Grass)
    let type = 'grass';
    if (index > 3) {
        const r = Math.random();
        if (r < 0.4) type = 'road';
        else if (r < 0.6) type = 'water';
    }
    
    const row = {
        y: index, // Logic Y index (0 = start, 10 = higher)
        type: type,
        objects: [] // Cars or Logs
    };

    if (type === 'road') {
        row.speed = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);
        // Add cars
        const numCars = Math.floor(Math.random() * 2) + 1;
        for(let i=0; i<numCars; i++) {
            row.objects.push({ x: Math.random() * 15, width: 1.5 });
        }
    } else if (type === 'water') {
        row.speed = (Math.random() * 1.5 + 0.5) * (Math.random() > 0.5 ? 1 : -1);
        // Add Logs
        const numLogs = Math.floor(Math.random() * 2) + 2;
        for(let i=0; i<numLogs; i++) {
            row.objects.push({ x: Math.random() * 15, width: 2 + Math.random() });
        }
    }
    
    crossyMap.push(row);
}

function moveCrossy(dx, dy) {
    if (crossyPlayer.dead) return;
    
    // Move logic
    // dx: -1 (left), 1 (right)
    // dy: -1 (UP visual, Logic Y+1), 1 (DOWN visual, Logic Y-1)
    
    // W naszej logice: Y rośnie w górę.
    // Strzałka w górę (dy = -1 w evencie) -> Y gracza +1
    
    const targetX = crossyPlayer.x + dx;
    const targetY = crossyPlayer.y - dy; // Invert dy logic
    
    if (targetX < 0 || targetX > 14) return; // Bounds X
    if (targetY < crossyOffset) return; // Cannot go back too far
    
    crossyPlayer.x = targetX;
    crossyPlayer.y = targetY;
    
    // Score & Map Gen
    if (crossyPlayer.y > crossyScore) {
        crossyScore = crossyPlayer.y;
        document.getElementById("crossy-score").textContent = crossyScore;
        // Generate more map if needed
        while (crossyMap.length <= crossyPlayer.y + 15) {
            generateCrossyRow(crossyMap.length);
        }
    }
}

function loopCrossy() {
    if (crossyGameState !== 'playing') return;
    
    updateCrossy();
    drawCrossy();
    
    crossyGameLoop = requestAnimationFrame(loopCrossy);
}

function updateCrossy() {
    // Camera follow (smooth)
    const targetOffset = crossyPlayer.y - 4; // Player stays at bottom 1/3
    if (targetOffset > crossyOffset) {
        crossyOffset += (targetOffset - crossyOffset) * 0.1;
    }
    
    // Update Objects
    crossyMap.forEach(row => {
        if (row.type === 'road' || row.type === 'water') {
            row.objects.forEach(obj => {
                obj.x += row.speed * 0.05; // Speed factor
                // Wrap around
                if (row.speed > 0 && obj.x > 15) obj.x = -obj.width;
                if (row.speed < 0 && obj.x < -obj.width) obj.x = 15;
            });
        }
    });
    
    // Collision Detection
    // Find row player is on
    // Logic Y of player must match Row Y
    // But rows are integers. Player Y is integer.
    
    const currentRowIndex = Math.round(crossyPlayer.y);
    const row = crossyMap[currentRowIndex];
    
    if (row) {
        // Check bounds (Water kills unless on log)
        if (row.type === 'water') {
            let onLog = false;
            // Check collision with logs
            // Player is roughly width 0.8 at crossyPlayer.x
            row.objects.forEach(log => {
                if (crossyPlayer.x + 0.2 < log.x + log.width && crossyPlayer.x + 0.8 > log.x) {
                    onLog = true;
                    // Move player with log
                    crossyPlayer.x += row.speed * 0.05;
                }
            });
            
            if (!onLog) dieCrossy();
        } 
        else if (row.type === 'road') {
            row.objects.forEach(car => {
                if (crossyPlayer.x + 0.2 < car.x + car.width && crossyPlayer.x + 0.8 > car.x) {
                    dieCrossy();
                }
            });
        }
    }
    
    // Out of bounds X (e.g. carried by log)
    if (crossyPlayer.x < -1 || crossyPlayer.x > 15) dieCrossy();
}

function drawCrossy() {
    const w = crossyCanvas.width;
    const h = crossyCanvas.height;
    const tileW = w / 15; // 15 columns
    const tileH = tileW;
    
    crossyCtx.clearRect(0, 0, w, h);
    
    // Draw Map (Only visible rows)
    const startRow = Math.floor(crossyOffset);
    const endRow = startRow + 12; // Draw 12 rows height
    
    for (let i = startRow; i <= endRow; i++) {
        if (!crossyMap[i]) continue;
        const row = crossyMap[i];
        
        // Screen Y (Inverted: Higher Logic Y is Lower Screen Y)
        // Let's say Logic Y=0 is at Bottom.
        // ScreenY = h - (LogicY - offset) * tileH
        const sy = h - ((i - crossyOffset + 1) * tileH);
        
        // Background
        if (row.type === 'grass') crossyCtx.fillStyle = '#90EE90';
        if (row.type === 'road') crossyCtx.fillStyle = '#555';
        if (row.type === 'water') crossyCtx.fillStyle = '#4682B4';
        
        crossyCtx.fillRect(0, sy, w, tileH);
        
        // Objects
        if (row.objects) {
            row.objects.forEach(obj => {
                const ox = obj.x * tileW;
                const ow = obj.width * tileW;
                
                if (row.type === 'road') {
                    crossyCtx.fillStyle = row.speed > 0 ? 'red' : 'orange'; // Cars
                    // Simple car shape
                    crossyCtx.fillRect(ox, sy + 5, ow, tileH - 10);
                    // Windows
                    crossyCtx.fillStyle = '#aaf';
                    crossyCtx.fillRect(ox + 5, sy + 8, ow/3, tileH - 16);
                } else if (row.type === 'water') {
                    crossyCtx.fillStyle = '#8B4513'; // Logs
                    crossyCtx.fillRect(ox, sy + 2, ow, tileH - 4);
                }
            });
        }
    }
    
    // Draw Player
    const py = h - ((crossyPlayer.y - crossyOffset + 1) * tileH);
    const px = crossyPlayer.x * tileW;
    
    crossyCtx.fillStyle = 'white'; // Chicken body
    crossyCtx.fillRect(px + 5, py + 5, tileW - 10, tileH - 10);
    crossyCtx.fillStyle = 'red'; // Comb
    crossyCtx.fillRect(px + 15, py + 2, 10, 5);
    crossyCtx.fillStyle = 'orange'; // Beak
    crossyCtx.fillRect(px + 25, py + 10, 5, 5);
}

async function dieCrossy() {
    if (crossyPlayer.dead) return;
    crossyPlayer.dead = true;
    crossyGameState = 'dead';
    
    // Play sound
    if (dom.audioError) dom.audioError.play().catch(()=>{});
    
    const overlay = document.getElementById("crossy-overlay");
    const msg = document.getElementById("crossy-msg");
    overlay.classList.remove("hidden");
    msg.innerHTML = `PRZEGRAŁEŚ!<br>Twój wynik: ${crossyScore}<br><span style="font-size:0.5em">Czekaj na innych...</span>`;
    document.getElementById("btn-crossy-start").classList.add("hidden"); // Hide start btn if host died

    // Send Score to DB
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "crossy_lobbies", activeCrossyId);
            const docSnap = await t.get(ref);
            if (!docSnap.exists()) return;
            
            const data = docSnap.data();
            const newPlayers = data.players.map(p => {
                if (p.id === currentUserId) {
                    return { ...p, score: crossyScore, dead: true };
                }
                return p;
            });
            
            t.update(ref, { players: newPlayers });
        });
    } catch(e) { console.error("Error sending score:", e); }
}
// ==========================================
// === EXAM GAME LOGIC (CZYSTY GAMBLING) ===
// ==========================================

// Lista 20 pytań (Placeholdery)
const EXAM_QUESTIONS = [
    // Matematyka / Topologia
    "Jaka jest ranga n-tej grupy kohomologii de Rhama dla sfery S^n?",
    "Ile niezależnych składowych posiada tensor krzywizny Riemanna w 4-wymiarowej czasoprzestrzeni?",
    "Wskaż wartość stałej Apéry'ego (zeta(3)) z dokładnością do 10 miejsc po przecinku.",
    
    // Fizyka Kwantowa / Cząstek
    "Jaki jest ładunek koloru gluonu w stanie singletowym w chromodynamice kwantowej?",
    "Oblicz amplitudę prawdopodobieństwa w diagramie Feynmana rzędu jednej pętli dla rozpraszania Bhabha.",
    "Jaka jest wartość oczekiwana operatora pędu w stanie podstawowym oscylatora harmonicznego?",
    "Który element macierzy CKM opisuje łamanie symetrii CP w rozpadach mezonów B?",

    // Biochemia / Genetyka
    "Który enzym katalizuje etap ograniczający szybkość w szlaku biosyntezy cholesterolu?",
    "Jaka jest rola białka ubikwityny w proteasomalnej degradacji białekcytozowych?",
    "Wskaż sekwencję konsensusową Kozak inicjującą translację u eukariontów.",
    "Jaki jest mechanizm działania topoizomerazy II w relaksacji superskrętów DNA?",

    // Chemia Organiczna / Fizyczna
    "Jaka jest symetria grupy punktowej cząsteczki buckminsterfullerenu C60?",
    "Wskaż produkt reakcji retro-Diels-Alder dla adduktu antracenu i bezwodnika maleinowego.",
    "Jaka jest hybrydyzacja atomu centralnego w kompleksie heksacyjanocofelazianu(II)?",
    "Oblicz energię orbitalu HOMO dla cząsteczki butadienu metodą Hückla.",

    // Astrofizyka / Kosmologia
    "Jaka jest wartość parametru gęstości dla ciemnej energii w modelu Lambda-CDM?",
    "Przekroczenie jakiej masy (granica Chandrasekhara) powoduje kolaps białego karła?",
    "Czym charakteryzuje się horyzont zdarzeń w metryce Kerra dla rotującej czarnej dziury?",

    // Inżynieria / Termodynamika
    "Jaka jest postać różniczkowa relacji Maxwella dla potencjału termodynamicznego Gibbsa?",
    "Rozwiązanie równań Naviera-Stokesa dla przepływu turbulentnego wymaga liczby Reynoldsa rzędu:"
];

let examState = {
    active: false,
    currentQuestionIndex: 0,
    score: 0,
    bet: 0
};

document.addEventListener("DOMContentLoaded", () => {
    const btnStart = document.getElementById("btn-exam-start");
    const btnReset = document.getElementById("btn-exam-reset");
    
    if(btnStart) btnStart.addEventListener("click", startExam);
    if(btnReset) btnReset.addEventListener("click", resetExamUI);
});

async function startExam() {
    if(examState.active) return;
    
    const amountInput = document.getElementById("exam-amount");
    const amount = parseInt(amountInput.value);

    if (isNaN(amount) || amount <= 0) return showMessage("Podaj stawkę!", "error");
    if (!currentUserId) return showMessage("Zaloguj się!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        // Pobranie kasy
        await runTransaction(db, async (t) => {
             const userRef = doc(db, "uzytkownicy", currentUserId);
             const userDoc = await t.get(userRef);
             if(userDoc.data().cash < amount) throw new Error("Brak środków");
             
             const newCash = userDoc.data().cash - amount;
             t.update(userRef, { 
                 cash: newCash, 
                 totalValue: calculateTotalValue(newCash, userDoc.data().shares) 
             });
        });

        // UI Update
        portfolio.cash -= amount;
        updatePortfolioUI();

        // Setup gry
        examState.active = true;
        examState.bet = amount;
        examState.score = 0;
        examState.currentQuestionIndex = 0;

        document.getElementById("exam-start-screen").classList.add("hidden");
        document.getElementById("exam-result-screen").classList.add("hidden");
        document.getElementById("exam-game-screen").classList.remove("hidden");

        renderExamQuestion();

    } catch(e) {
        showMessage(e.message, "error");
    }
}

function renderExamQuestion() {
    const qIndex = examState.currentQuestionIndex;
    document.getElementById("exam-progress").textContent = `Pytanie ${qIndex + 1}/20`;
    document.getElementById("exam-current-score").textContent = `Punkty: ${examState.score}`;
    
    // Ustawienie tekstu pytania
    const qText = EXAM_QUESTIONS[qIndex] || `Pytanie ${qIndex + 1}`;
    document.getElementById("exam-question-text").textContent = qText;

    // Reset przycisków
    const btns = document.querySelectorAll(".exam-btn");
    btns.forEach(b => {
        b.disabled = false;
        b.classList.remove("correct", "wrong");
    });
}

// Funkcja dostępna globalnie (window) dla onclick w HTML
window.handleExamAnswer = function(selectedOption) {
    if(!examState.active) return;

    // --- KLUCZOWY MECHANIZM: CZYSTY GAMBLING ---
    // Nie ma zdefiniowanej poprawnej odpowiedzi.
    // Losujemy ją W MOMENCIE KLIKNIĘCIA.
    // Szansa 1/4 (25%).
    const options = ['A', 'B', 'C', 'D'];
    const randomCorrect = options[Math.floor(Math.random() * options.length)];
    
    const isCorrect = (selectedOption === randomCorrect);
    
    // Efekty wizualne
    const btns = document.querySelectorAll(".exam-btn");
    btns.forEach(b => {
        b.disabled = true; // Blokada
        if(b.textContent === randomCorrect) b.classList.add("correct");
        else if(b.textContent === selectedOption && !isCorrect) b.classList.add("wrong");
    });

    if(isCorrect) {
        examState.score++;
        if(dom.audioKaching) {
             // Cichszy dźwięk dla pojedynczego pytania
             const clone = dom.audioKaching.cloneNode();
             clone.volume = 0.2;
             clone.play().catch(()=>{});
        }
    } else {
        if(dom.audioError) {
             const clone = dom.audioError.cloneNode();
             clone.volume = 0.2;
             clone.play().catch(()=>{});
        }
    }

    // Następne pytanie lub koniec (szybkie przejście)
    setTimeout(() => {
        examState.currentQuestionIndex++;
        if(examState.currentQuestionIndex >= 20) {
            finishExam();
        } else {
            renderExamQuestion();
        }
    }, 400); // 400ms opóźnienia, żeby zobaczyć kolor
};

async function finishExam() {
    examState.active = false;
    const score = examState.score;
    const percentage = (score / 20) * 100;
    const bet = examState.bet;
    
    let multiplier = 0;
    
    // Logika wypłat
    if (percentage >= 95) multiplier = 3.0;
    else if (percentage >= 75) multiplier = 2.5;
    else if (percentage >= 50) multiplier = 2.0;
    else multiplier = 0;

    const winAmount = bet * multiplier;
    const profit = winAmount - bet;

    // Update UI
    document.getElementById("exam-game-screen").classList.add("hidden");
    document.getElementById("exam-result-screen").classList.remove("hidden");
    
    const titleEl = document.getElementById("exam-result-title");
    const scoreEl = document.getElementById("exam-result-score");
    const msgEl = document.getElementById("exam-result-msg");

    scoreEl.textContent = `${percentage.toFixed(0)}% (${score}/20)`;
    
    if(winAmount > 0) {
        titleEl.textContent = "ZDAŁEŚ!";
        titleEl.style.color = "var(--green)";
        scoreEl.style.color = "var(--green)";
        msgEl.innerHTML = `Gratulacje! Wygrywasz <strong style="color:gold">${formatujWalute(winAmount)}</strong>`;
        if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
        
        // Zapis wygranej
        try {
            await runTransaction(db, async (t) => {
                const userRef = doc(db, "uzytkownicy", currentUserId);
                const d = (await t.get(userRef)).data();
                t.update(userRef, { 
                    cash: d.cash + winAmount, 
                    zysk: (d.zysk || 0) + profit,
                    totalValue: calculateTotalValue(d.cash + winAmount, d.shares)
                });
            });
            showNotification(`Sesja Zdana! +${formatujWalute(winAmount)}`, 'news', 'positive');
        } catch(e) { console.error(e); }

    } else {
        titleEl.textContent = "WARUNEK...";
        titleEl.style.color = "var(--red)";
        scoreEl.style.color = "var(--red)";
        msgEl.textContent = "Niestety, musisz powtarzać semestr (straciłeś stawkę).";
        if(dom.audioError) dom.audioError.play().catch(()=>{});
    }
}

function resetExamUI() {
    document.getElementById("exam-result-screen").classList.add("hidden");
    document.getElementById("exam-start-screen").classList.remove("hidden");
    const btns = document.querySelectorAll(".exam-btn");
    btns.forEach(b => {
        b.classList.remove("correct", "wrong");
        b.disabled = false;
    });
}
// ==========================================
// === SKI JUMP (DSJ STYLE) LOGIC ===
// ==========================================


let activeSkiId = null;
let isSkiTraining = false;
let cachedSkiData = null;
let skiSubscription = null;
let skiGameLoop = null;
let skiCanvas, skiCtx;

// Definicje 4 skoczni (Parametry fizyczne i wizualne)
// WAŻNE: To musi być tutaj, żeby fizyka to widziała!
// Definicje skoczni z nowym parametrem "landingAngle" (kąt nachylenia)
const HILLS_CONFIG = [
    { name: "Oberstdorf", k: 600, takeoff: 350, scale: 1.0, color: "#87CEEB", landingAngle: 0.8 }, 
    { name: "Garmisch-Partenkirchen", k: 650, takeoff: 380, scale: 1.1, color: "#aaddff", landingAngle: 0.8 }, 
    { name: "Innsbruck", k: 550, takeoff: 320, scale: 0.9, color: "#b0c4de", landingAngle: 0.85 }, 
    { name: "Bischofshofen", k: 750, takeoff: 420, scale: 1.25, color: "#ffe4b5", landingAngle: 0.8 },
    
    // --- NOWE SKOCZNIE ---
    // Zakopane: K-230 (Lekko stromsza niż standard - 0.9)
    { name: "Zakopane", k: 920, takeoff: 480, scale: 1.45, color: "#f0f8ff", landingAngle: 0.9 }, 
    
    // Bydgoszcz: K-350 (Bardzo stroma - 1.3, żeby to był prawdziwy lot)
    { name: "Bydgoszcz", k: 1400, takeoff: 650, scale: 1.9, color: "#1a1a2e", landingAngle: 5.3 } 
];

// Zmienna trzymająca parametry AKTUALNEJ skoczni (domyślnie pierwsza)
// Jeśli tego brakuje, gra nie wie jak rysować górę!
let currentHillParams = HILLS_CONFIG[0]; 

// Fizyka i Stan Lokalny
let skiState = {
    phase: 'idle',
    x: 0, y: 0,
    vx: 0, vy: 0,
    rotation: 0,
    distance: 0,
    cameraX: 0,
    trajectory: [] 
};

// Stałe fizyki
const SKI_GRAVITY = 0.15;
const SKI_AIR_RESISTANCE = 0.99;
const SKI_LIFT_FACTOR = 0.008;
const SKI_HILL_START_X = 50;
const SKI_HILL_START_Y = 100;

function startSkiTraining() {
    const hillSelect = document.getElementById("skijump-training-hill");
    const hillIndex = parseInt(hillSelect.value);
    
    isSkiTraining = true;
    activeSkiId = null; 
    
    document.getElementById("skijump-lobby-view").classList.add("hidden");
    document.getElementById("skijump-game-view").classList.remove("hidden");
    
    currentHillParams = HILLS_CONFIG[hillIndex];
    
    skiCanvas = document.getElementById("skijump-canvas");
    skiCtx = skiCanvas.getContext('2d');
    
    skiCanvas.style.background = currentHillParams.color;
    document.getElementById("skijump-hill-name").textContent = 
        `TRENING: ${currentHillParams.name} (K-${(currentHillParams.k / 4).toFixed(0)})`;
    document.getElementById("skijump-pot").textContent = "BRAK (Trening)";
    document.getElementById("skijump-round").textContent = "∞";

    document.getElementById("skijump-overlay").classList.remove("hidden");
    document.getElementById("skijump-status-msg").textContent = "TRYB TRENINGOWY";
    document.getElementById("skijump-instruction").textContent = "Skacz ile chcesz. Nie tracisz gotówki.";
    document.getElementById("btn-skijump-jump").classList.remove("hidden");
    document.getElementById("sj-current-jumper").textContent = "Zawodnik: Ty";

    if (!skiGameLoop) skiGameLoop = requestAnimationFrame(renderSkiLoop);
}
// ------------------------------

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
    const btnCreate = document.getElementById("btn-skijump-create");
    const btnLeave = document.getElementById("btn-skijump-leave");
    const btnJump = document.getElementById("btn-skijump-jump");

    if (btnCreate) btnCreate.addEventListener("click", createSkiLobby);
    if (btnLeave) btnLeave.addEventListener("click", leaveSkiGame);
    if (btnJump) btnJump.addEventListener("click", playerReadyOnGate);
    
    const btnTraining = document.getElementById("btn-skijump-training");
    if(btnTraining) btnTraining.addEventListener("click", startSkiTraining);

    const welcomeModal = document.getElementById("welcome-modal");
    const closeWelcomeBtns = [
        document.getElementById("close-welcome-btn"), 
        document.getElementById("welcome-confirm-btn")
    ];
    closeWelcomeBtns.forEach(btn => {
        if(btn) btn.addEventListener("click", () => {
            if(welcomeModal) welcomeModal.classList.add("hidden");
        });
    });
    // ------------------------------

    // Sterowanie Myszką (DSJ Style)
    const canvas = document.getElementById("skijump-canvas");
    if(canvas) {
        // Kliknięcie = Start / Wybicie / Lądowanie
        canvas.addEventListener("mousedown", handleSkiClick);
        // Ruch myszką = Balans ciałem w locie
        canvas.addEventListener("mousemove", handleSkiMove);
        // Mobile touch
        canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleSkiClick(); });
    }

    // Odpalamy nasłuch lobby
    setTimeout(listenToSkiLobbies, 2500);
});

// --- LOBBY SYSTEM (Podobny do Wyścigów) ---
function listenToSkiLobbies() {
    const q = query(collection(db, "skijump_lobbies"), where("status", "in", ["open", "active"]));
    
    onSnapshot(q, (snap) => {
        const listEl = document.getElementById("skijump-list");
        if (!listEl) return;
        listEl.innerHTML = "";
        
        if (snap.empty) {
            listEl.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Brak zawodów.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const r = docSnap.data();
            const isFull = r.players.length >= 8;
            const isIngame = r.players.some(p => p.id === currentUserId);
            
            // Auto-join jeśli już jesteś w grze
            if (isIngame && activeSkiId !== docSnap.id) {
                enterSkiGame(docSnap.id);
            }

            const div = document.createElement("div");
            div.className = "race-lobby-card";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${formatujWalute(r.entryFee)}</strong>
                    <span style="color:${r.status==='active'?'var(--red)':'var(--green)'}">${r.status==='active'?'W TRAKCIE':'OTWARTY'}</span>
                </div>
                <div style="font-size:0.9em; color:#ccc;">Host: ${r.hostName}</div>
                <div style="font-size:0.9em;">Skoczków: ${r.players.length} / 8</div>
                <button class="btn-accent" style="margin-top:5px;" 
                    onclick="joinSkiLobby('${docSnap.id}', ${r.entryFee})" 
                    ${(isFull || r.status !== 'open') ? 'disabled' : ''}>
                    ${r.status === 'active' ? 'WRÓĆ' : 'DOŁĄCZ'}
                </button>
            `;
            listEl.appendChild(div);
        });
    });
}

async function createSkiLobby() {
    const amount = parseFloat(document.getElementById("skijump-create-amount").value);
    // Pobieramy stan checkboxa
    const isTCS = document.getElementById("skijump-tcs-mode").checked;
    
    if (isNaN(amount) || amount < 100) return showMessage("Min. 100 zł!", "error");
    if (amount > portfolio.cash) return showMessage("Brak środków!", "error");

    try {
        await runTransaction(db, async (t) => {
            const uRef = doc(db, "uzytkownicy", currentUserId);
            const d = (await t.get(uRef)).data();
            if (d.cash < amount) throw new Error("Brak środków!");
            t.update(uRef, { cash: d.cash - amount, totalValue: calculateTotalValue(d.cash - amount, d.shares) });
            
            const ref = doc(collection(db, "skijump_lobbies"));
            t.set(ref, {
                hostId: currentUserId,
                hostName: portfolio.name,
                entryFee: amount,
                status: "open",
                
                // --- NOWE POLA TCS ---
                isTournament: isTCS,  // Czy to turniej?
                hillIndex: 0,         // Która skocznia (0-3)
                // ---------------------
                
                round: 1,
                currentPlayerIndex: 0,
                createdAt: serverTimestamp(),
                // Struktura gracza z nowym polem 'totalTournamentScore'
                players: [{ 
                    id: currentUserId, 
                    name: portfolio.name, 
                    jump1: 0, 
                    jump2: 0, 
                    score: 0, 
                    totalTournamentScore: 0 // Suma punktów z całego turnieju
                }],
                lastJumpData: null 
            });
        });
        showMessage(isTCS ? "Turniej 4 Skoczni utworzony!" : "Konkurs utworzony!", "success");
    } catch (e) { showMessage(e.message, "error"); }
}

window.joinSkiLobby = async function(id, fee) {
    if (portfolio.cash < fee) return showMessage("Nie stać Cię!", "error");
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "skijump_lobbies", id);
            const uRef = doc(db, "uzytkownicy", currentUserId);
            
            const docSnap = await t.get(ref);
            const uDoc = await t.get(uRef);
            
            if (!docSnap.exists()) throw new Error("Błąd.");
            const data = docSnap.data();
            
            if (data.status !== 'open') throw new Error("Konkurs ruszył!");
            if (data.players.length >= 8) throw new Error("Pełna lista!");
            if (uDoc.data().cash < fee) throw new Error("Brak środków!");
            
            // Wewnątrz funkcji joinSkiLobby, w miejscu tworzenia newPlayers:
const newPlayers = [...data.players, { 
    id: currentUserId, 
    name: portfolio.name, 
    jump1: 0, 
    jump2: 0, 
    score: 0,
    totalTournamentScore: 0 // <-- WAŻNE
}];
            
            t.update(uRef, { cash: uDoc.data().cash - fee, totalValue: calculateTotalValue(uDoc.data().cash - fee, uDoc.data().shares) });
            t.update(ref, { players: newPlayers });
        });
    } catch (e) { showMessage(e.message, "error"); }
};

// --- LOGIKA GRY (KLIENT) ---

function enterSkiGame(id) {
    activeSkiId = id;
    document.getElementById("skijump-lobby-view").classList.add("hidden");
    document.getElementById("skijump-game-view").classList.remove("hidden");
    
    skiCanvas = document.getElementById("skijump-canvas");
    skiCtx = skiCanvas.getContext('2d');

    if (skiSubscription) skiSubscription();

    // Główny Listener Gry
    skiSubscription = onSnapshot(doc(db, "skijump_lobbies", id), (snap) => {
        if (!snap.exists()) { leaveSkiGame(); return; }
        // Wewnątrz onSnapshot...
    const data = snap.data();
    cachedSkiData = data; 
    
    // --- AKTUALIZACJA SKOCZNI ---
    if (data.hillIndex !== undefined) {
        currentHillParams = HILLS_CONFIG[data.hillIndex];
        // Ustawienie tła canvasa (kolor nieba/zachodu słońca)
        skiCanvas.style.background = currentHillParams.color;
        
        // Aktualizacja nagłówka nazwy
        document.getElementById("skijump-hill-name").textContent = 
            `${currentHillParams.name} (K-${(currentHillParams.k / 4).toFixed(0)})`;
    }
    // ----------------------------

    updateSkiScoreboard(data);
    // ... reszta bez zmian
        handleSkiGameState(data);
    });

    if (!skiGameLoop) skiGameLoop = requestAnimationFrame(renderSkiLoop);
}

function leaveSkiGame() {
    activeSkiId = null;
    isSkiTraining = false;
    if (skiSubscription) skiSubscription();
    if (skiGameLoop) cancelAnimationFrame(skiGameLoop);
    skiGameLoop = null;
    
    document.getElementById("skijump-lobby-view").classList.remove("hidden");
    document.getElementById("skijump-game-view").classList.add("hidden");
}

function updateSkiScoreboard(data) {
    document.getElementById("skijump-round").textContent = `${data.round}/2`;
    document.getElementById("skijump-pot").textContent = formatujWalute(data.entryFee * data.players.length);
    
    const thead = document.querySelector("#skijump-game-view thead tr");
    const tbody = document.getElementById("skijump-scoreboard");
    
    // Zmiana nagłówków tabeli w zależności od trybu
    if (data.isTournament) {
        thead.innerHTML = `<th>Msc</th><th>Gracz</th><th>Skok 1</th><th>Skok 2</th><th>Nota</th><th>TCS Total</th>`;
    } else {
        thead.innerHTML = `<th>Msc</th><th>Gracz</th><th>Skok 1</th><th>Skok 2</th><th>Nota</th>`;
    }

    tbody.innerHTML = "";
    
    // Sortowanie: w TCS po 'totalTournamentScore', w zwykłym po 'score'
    const sortKey = data.isTournament ? 'totalTournamentScore' : 'score';
    const sorted = [...data.players].sort((a,b) => b[sortKey] - a[sortKey]);
    
    sorted.forEach((p, idx) => {
        const isCurrent = (p.id === data.players[data.currentPlayerIndex]?.id);
        const tr = document.createElement("tr");
        if(isCurrent && data.status === 'active') tr.classList.add("sj-current-row");
        
        let extraCol = "";
        if (data.isTournament) {
            // Pokazujemy sumę dotychczasową + aktualny konkurs
            // Uwaga: totalTournamentScore aktualizujemy dopiero po konkursie, 
            // więc "live" wynik to total + current_score
            const currentTotal = (p.totalTournamentScore || 0) + p.score;
            extraCol = `<td><strong style="color:gold">${currentTotal.toFixed(1)}</strong></td>`;
        }

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${p.name} ${isCurrent ? '⛷️' : ''}</td>
            <td>${p.jump1 ? p.jump1.toFixed(1) + 'm' : '-'}</td>
            <td>${p.jump2 ? p.jump2.toFixed(1) + 'm' : '-'}</td>
            <td>${p.score.toFixed(1)}</td>
            ${extraCol}
        `;
        tbody.appendChild(tr);
    });
}

// --- MASZYNA STANÓW GRY ---

let lastReplayId = null; // Żeby nie odtwarzać dwa razy tego samego

function handleSkiGameState(data) {
    if(!data) return;

    // A. Wykryto nową powtórkę -> Odtwórz ją
    if (data.lastJumpData && data.lastJumpData.jumpId !== lastReplayId) {
        lastReplayId = data.lastJumpData.jumpId;
        // Nie odtwarzaj własnych powtórek (widziałeś je na żywo)
        if (data.lastJumpData.playerName !== portfolio.name) {
            playReplay(data.lastJumpData);
            return; 
        }
    }
    
    // JEŚLI OGLĄDAMY POWTÓRKĘ - NIE ZMIENIAJ UI (żeby nie przerywać oglądania)
    if (skiState.phase === 'replay') return; 

    // --- TUTAJ ZACZYNA SIĘ ODŚWIEŻANIE UI ---
    const overlay = document.getElementById("skijump-overlay");
    const statusMsg = document.getElementById("skijump-status-msg");
    const instruction = document.getElementById("skijump-instruction");
    const btnJump = document.getElementById("btn-skijump-jump");
    
    const currentJumper = data.players[data.currentPlayerIndex];
    document.getElementById("sj-current-jumper").textContent = `Na belce: ${currentJumper ? currentJumper.name : 'Koniec'}`;

    if (data.status === 'open') {
        overlay.classList.remove("hidden");
        btnJump.classList.add("hidden");
        if (data.hostId === currentUserId) {
            statusMsg.textContent = "Jesteś Hostem";
            instruction.innerHTML = `<button class="btn-green" onclick="startSkiCompetition()">ROZPOCZNIJ KONKURS</button>`;
        } else {
            statusMsg.textContent = "Oczekiwanie na Hosta...";
            instruction.textContent = "Rozgrzewka...";
        }
    }
    else if (data.status === 'active') {
        const isMyTurn = (currentJumper && currentJumper.id === currentUserId);
        
        if (isMyTurn) {
            // MOJA KOLEJ
            overlay.classList.remove("hidden");
            statusMsg.textContent = "TWOJA KOLEJ!";
            statusMsg.style.color = "var(--green)";
            instruction.textContent = "Kliknij przycisk, aby wejść na belkę.";
            btnJump.classList.remove("hidden");
        } else {
            // KOLEJ INNEGO
            overlay.classList.remove("hidden");
            statusMsg.textContent = `Skacze: ${currentJumper ? currentJumper.name : '...'}`;
            statusMsg.style.color = "#fff";
            instruction.textContent = "Oczekiwanie na skok...";
            btnJump.classList.add("hidden");
        }
    }
	else if (data.status === 'finished') {
        overlay.classList.remove("hidden");
        btnJump.classList.add("hidden");
        
        // --- POPRAWKA ---
        // Sprawdzamy, czy to turniej. Jeśli tak, sortujemy po sumie punktów TCS.
        // Jeśli zwykły konkurs, sortujemy po wyniku bieżącym (score).
        const scoreKey = data.isTournament ? 'totalTournamentScore' : 'score';
        const winner = [...data.players].sort((a,b) => (b[scoreKey] || 0) - (a[scoreKey] || 0))[0];
        // ----------------
        
        statusMsg.innerHTML = `<span style="color:gold">ZWYCIĘZCA: ${winner.name}</span>`;
        instruction.textContent = "Gratulacje!";
    }
}

window.startSkiCompetition = async function() {
    if(!activeSkiId) return;
    await updateDoc(doc(db, "skijump_lobbies", activeSkiId), { status: "active" });
};

// --- LOGIKA SKACZĄCEGO (Lokalna fizyka) ---

function playerReadyOnGate() {
    // Ukryj overlay, ustaw kamerę
    document.getElementById("skijump-overlay").classList.add("hidden");
    
    skiState = {
        phase: 'gate',
        x: SKI_HILL_START_X,
        y: SKI_HILL_START_Y,
        vx: 0, vy: 0,
        rotation: -0.5, // Lekko w dół
        distance: 0,
        cameraX: 0,
        trajectory: [] // Reset trackera
    };
    
    // Zapisz pozycję początkową
    recordFrame();
}

function handleSkiClick() {
    if (!activeSkiId && !isSkiTraining) return;

    // --- POPRAWKA: Pobieramy punkt wybicia z aktualnej skoczni ---
    const takeoffX = currentHillParams.takeoff;

    if (skiState.phase === 'gate') {
        // 1. Ruszamy z belki
        skiState.phase = 'inrun';
        skiState.vx = 2.0; 
        skiState.vy = 1.0;
    } 
    else if (skiState.phase === 'inrun') {
        // 2. Wybicie (Używamy dynamicznego takeoffX)
        if (skiState.x > takeoffX - 50 && skiState.x < takeoffX + 20) {
            skiState.phase = 'flight';
            // Siła wybicia
            const quality = 1 - Math.abs(skiState.x - takeoffX) / 50;
            skiState.vy -= (4.0 + (quality * 1.5)); 
            skiState.vx += 0.5;
            if(dom.audioNews) { dom.audioNews.currentTime=0; dom.audioNews.play().catch(()=>{}); }
        }
    }
    else if (skiState.phase === 'flight') {
        // 3. Lądowanie
        const groundY = getHillY(skiState.x);
        if (skiState.y > groundY - 50) {
            landSki(true); 
        }
    }
}

function handleSkiMove(e) {
    if (skiState.phase === 'flight') {
        const rect = skiCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Sterowanie: Myszka góra/dół zmienia kąt nart
        // Idealny kąt to lekko do góry, ale nie za bardzo (opór)
        const centerH = skiCanvas.height / 2;
        const delta = (mouseY - centerH) / 100; // -1 do 1
        
        skiState.rotation = delta; 
    }
}

function recordFrame() {
    // Dodajemy klatkę do powtórki (tylko co 2-3 klatki dla oszczędności, ale tutaj każda dla płynności)
    skiState.trajectory.push({
        x: Math.round(skiState.x),
        y: Math.round(skiState.y),
        r: parseFloat(skiState.rotation.toFixed(2))
    });
}

function physicsStep() {
    // --- POPRAWKA: Pobieramy punkt wybicia ---
    const takeoffX = currentHillParams.takeoff;

    if (skiState.phase === 'inrun') {
        skiState.x += skiState.vx;
        skiState.y = getHillY(skiState.x);
        skiState.vx += 0.05; 
        
        // Auto-wybicie na końcu (spadnięcie z progu)
        if (skiState.x > takeoffX) {
            skiState.phase = 'flight';
            skiState.vy -= 2.0; 
        }
        recordFrame();
    }
    else if (skiState.phase === 'flight') {
        skiState.x += skiState.vx;
        skiState.y += skiState.vy;
        
        skiState.vy += SKI_GRAVITY;
        
        const angleDiff = Math.abs(skiState.rotation - (-0.3)); 
        const lift = (1 - angleDiff) * SKI_LIFT_FACTOR * (skiState.vx * skiState.vx);
        
        skiState.vy -= lift;
        skiState.vx *= SKI_AIR_RESISTANCE; 

        // Kolizja z ziemią
        const groundY = getHillY(skiState.x);
        if (skiState.y >= groundY) {
            landSki(false);
        }
        
        // Aktualizacja HUD dystansu (używamy dynamicznego takeoffX)
        const dist = (skiState.x - takeoffX) / 4; 
        const distEl = document.getElementById("sj-distance-display");
        if(distEl) distEl.textContent = dist.toFixed(1) + " m";
        
        recordFrame();
    }
    else if (skiState.phase === 'landed') {
        skiState.x += skiState.vx;
        skiState.y = getHillY(skiState.x);
        skiState.vx *= 0.95;
        if (skiState.vx < 0.1) skiState.vx = 0;
        recordFrame();
    }
}

function getHillY(x) {
    // Pobieramy parametry, jeśli ich brak to ustawiamy domyślne
    const params = currentHillParams || { takeoff: 350, scale: 1.0 };
    
    const takeoffX = params.takeoff;
    const scale = params.scale;
    // Tutaj pobieramy kąt nachylenia (domyślnie 0.8)
    const slope = params.landingAngle || 0.8; 

    // 1. Rozbieg
    if (x < takeoffX) {
        const t = x / takeoffX; 
        return SKI_HILL_START_Y + (Math.pow(t, 2.5)) * (120 * scale); 
    }
    // 2. Zeskok
    else {
        const dx = x - takeoffX;
        const takeoffH = SKI_HILL_START_Y + (120 * scale); 
        
        // Strefa lądowania (krzywa)
        if (dx < 300 * scale) {
            // Używamy zmiennej 'slope' zamiast sztywnego 0.8
            return takeoffH + 10 + (dx * slope) + (dx * dx * 0.0005);
        } 
        // Wypłaszczenie (Outrun)
        else {
            const boundary = 300 * scale;
            // Obliczamy wysokość w punkcie granicznym używając 'slope'
            const hAtBoundary = takeoffH + 10 + (boundary * slope) + (boundary * boundary * 0.0005);
            const ddx = dx - boundary;
            return hAtBoundary + (ddx * 0.45); 
        }
    }
}
async function landSki(manual) {
    if(skiState.phase === 'landed') return;
    
    const takeoffX = currentHillParams.takeoff;

    skiState.phase = 'landed';
    
    // --- NOWE: Zapisujemy styl lądowania ---
    // Jeśli manual (kliknięcie) = Telemark, jeśli nie = Crash
    skiState.landingType = manual ? 'telemark' : 'crash';
    // ---------------------------------------

    const finalDist = (skiState.x - takeoffX) / 4;
    
    // Oblicz notę
    let stylePoints = 20.0;
    
    if (!manual) {
        stylePoints -= 10.0; // Upadek = duża kara
    } else {
        // Telemark, ale sprawdzamy czy nie trzęsło przy lądowaniu
        if (Math.abs(skiState.rotation) > 0.5) stylePoints -= 3.0;
    }
    
    const totalScore = finalDist + stylePoints;
    
    if (isSkiTraining) {
        document.getElementById("sj-distance-display").textContent = finalDist.toFixed(1) + " m";
        setTimeout(() => {
            const overlay = document.getElementById("skijump-overlay");
            overlay.classList.remove("hidden");
            document.getElementById("skijump-status-msg").innerHTML = `Odległość: <strong style="color:gold">${finalDist.toFixed(1)}m</strong><br>Nota: ${totalScore.toFixed(1)}`;
            document.getElementById("skijump-instruction").textContent = "Kliknij 'IDŹ NA BELKĘ' aby powtórzyć.";
            document.getElementById("btn-skijump-jump").classList.remove("hidden");
        }, 1000);
        return; 
    }
    
    await uploadJumpData(finalDist, totalScore, skiState.trajectory);
}

async function uploadJumpData(dist, pts, traj) {
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "skijump_lobbies", activeSkiId);
            const data = (await t.get(ref)).data();
            
            const players = [...data.players];
            const pIndex = data.currentPlayerIndex;
            const p = players[pIndex];
            
            // Zapisz wynik skoku
            if (data.round === 1) p.jump1 = dist;
            else p.jump2 = dist;
            
            p.score += pts;
            
            // Logika następnego kroku
            let nextIndex = pIndex + 1;
            let nextRound = data.round;
            let nextHillIndex = data.hillIndex || 0;
            let status = data.status;

            // Jeśli wszyscy skoczyli w tej rundzie
            if (nextIndex >= players.length) {
                if (data.round === 1) {
                    // Koniec 1. serii -> idziemy do 2. serii
                    nextIndex = 0;
                    nextRound = 2;
                } else {
                    // Koniec 2. serii (Koniec konkursu na tej skoczni)
                    
                    // 1. Dodaj punkty z tego konkursu do generalki turnieju
                    players.forEach(pl => {
                        pl.totalTournamentScore = (pl.totalTournamentScore || 0) + pl.score;
                    });

                    if (data.isTournament && nextHillIndex < 3) {
                        // --- IDZIEMY NA KOLEJNĄ SKOCZNIĘ ---
                        nextHillIndex++;
                        nextRound = 1;
                        nextIndex = 0;
                        
                        // Reset wyników konkursowych (ale totalTournamentScore zostaje!)
                        players.forEach(pl => {
                            pl.jump1 = 0;
                            pl.jump2 = 0;
                            pl.score = 0;
                        });
                        
                    } else {
                        // --- KONIEC GRY (Zwykły konkurs lub Finał TCS) ---
                        status = 'finished';
                        
                        // Zwycięzca (w trybie TCS patrzymy na totalTournamentScore)
                        const scoreKey = data.isTournament ? 'totalTournamentScore' : 'score';
                        const winner = [...players].sort((a,b) => b[scoreKey] - a[scoreKey])[0];
                        
                        const pot = data.entryFee * players.length;
                        
                        const wRef = doc(db, "uzytkownicy", winner.id);
                        const wData = (await t.get(wRef)).data();
                        t.update(wRef, { 
                            cash: wData.cash + pot, 
                            zysk: (wData.zysk||0) + (pot - data.entryFee),
                            totalValue: calculateTotalValue(wData.cash + pot, wData.shares)
                        });
                    }
                }
            }

            // Upload
            t.update(ref, {
                players: players,
                currentPlayerIndex: nextIndex,
                round: nextRound,
                status: status,
                hillIndex: nextHillIndex, // Zapisujemy nową skocznię
                lastJumpData: {
                    jumpId: Date.now(),
                    playerName: p.name,
                    dist: dist,
                    trajectory: traj
                }
            });
        });
    } catch(e) { console.error(e); }
}
// --- SYSTEM POWTÓREK (Dla obserwatorów) ---

let replayData = null;
let replayFrame = 0;

function playReplay(data) {
    replayData = data;
    replayFrame = 0;
    skiState.phase = 'replay';
    
    document.getElementById("skijump-overlay").classList.remove("hidden");
    document.getElementById("skijump-status-msg").textContent = `SKOK: ${data.playerName}`;
    document.getElementById("skijump-instruction").textContent = "Odtwarzanie...";
    document.getElementById("btn-skijump-jump").classList.add("hidden");
}

// --- GŁÓWNA PĘTLA RENDEROWANIA ---

function renderSkiLoop() {
    if (!activeSkiId && !isSkiTraining) return;

    // 1. Fizyka
    if (['inrun', 'flight', 'landed'].includes(skiState.phase)) {
        physicsStep();
    }
    // 2. Powtórka
    else if (skiState.phase === 'replay' && replayData) {
        if (replayData.trajectory && replayFrame < replayData.trajectory.length) {
            const frame = replayData.trajectory[replayFrame];
            skiState.x = frame.x;
            skiState.y = frame.y;
            skiState.rotation = frame.r;
            replayFrame++;
            
            // Kamera
            let targetCamX = skiState.x - 200;
            if (targetCamX < 0) targetCamX = 0;
            // Usunięto limit kamery
            skiState.cameraX += (targetCamX - skiState.cameraX) * 0.1;

            // --- POPRAWKA HUD W POWTÓRCE ---
            const takeoffX = currentHillParams.takeoff;
            const dist = (skiState.x - takeoffX) / 4;
            let displayDist = dist > 0 ? dist : 0;
            
            const distEl = document.getElementById("sj-distance-display");
            if(distEl) distEl.textContent = displayDist.toFixed(1) + " m";

        } else {
            // KONIEC POWTÓRKI
            const msg = document.getElementById("skijump-status-msg");
            if(msg) {
                msg.textContent = `${replayData.playerName}: ${replayData.dist.toFixed(1)}m`;
                msg.style.color = "gold";
            }
            
            if (skiState.phase === 'replay') {
                setTimeout(() => {
                    if (skiState.phase === 'replay') {
                        skiState.phase = 'idle';
                        skiState.x = SKI_HILL_START_X;
                        skiState.y = SKI_HILL_START_Y;
                        skiState.cameraX = 0;
                        skiState.rotation = 0;
                        
                        if (cachedSkiData) {
                            handleSkiGameState(cachedSkiData);
                        }
                    }
                }, 2000);
                replayFrame = Number.MAX_SAFE_INTEGER; 
            }
        }
    }

    drawSkiGame();
    skiGameLoop = requestAnimationFrame(renderSkiLoop);
}

function drawSkiGame() {
    const w = skiCanvas.width;
    const h = skiCanvas.height;
    
    const takeoffX = currentHillParams.takeoff;
    const kPointX = takeoffX + currentHillParams.k;

    // --- 1. LOGIKA KAMERY (X i Y) ---
    
    // Obliczamy cel kamery X (poziomo) - trzymamy skoczka z lewej strony (offset 200px)
    let targetCamX = skiState.x - 200;
    if (targetCamX < 0) targetCamX = 0;

    // Obliczamy cel kamery Y (pionowo) - trzymamy skoczka mniej więcej na środku (offset h/2)
    // Jeśli skoczek jest wysoko, kamera idzie w górę. Jeśli nisko - w dół.
    let targetCamY = skiState.y - (h / 2);
    
    // Ograniczenie, żeby kamera nie wychodziła za wysoko w niebo na starcie
    // (opcjonalne, zależnie od gustu - można usunąć ifa, jeśli chcesz pełną swobodę)
    if (targetCamY < -50) targetCamY = -50;

    // Inicjalizacja zmiennej cameraY, jeśli jeszcze nie istnieje
    if (typeof skiState.cameraY === 'undefined') skiState.cameraY = 0;

    // Płynne podążanie (lerp) dla obu osi
    skiState.cameraX += (targetCamX - skiState.cameraX) * 0.1;
    skiState.cameraY += (targetCamY - skiState.cameraY) * 0.1;

    // --- 2. CZYSZCZENIE I PRZESUNIĘCIE ---
    skiCtx.clearRect(0, 0, w, h);

    skiCtx.save();
    // Przesuwamy świat o X oraz o Y
    skiCtx.translate(-skiState.cameraX, -skiState.cameraY);

    // --- 3. RYSOWANIE GÓRY ---
    skiCtx.fillStyle = "#fff"; 
    skiCtx.beginPath();
    
    // Optymalizacja: Rysujemy tylko widoczny fragment w poziomie
    const startDrawX = Math.floor(skiState.cameraX);
    const endDrawX = startDrawX + w + 100; // lekki zapas
    
    // Zaczynamy od dołu ekranu (ale uwzględniamy przesunięcie kamery Y!)
    // Musimy rysować "głęboko" w dół, żeby przy kamerowaniu w górę nie było dziury pod śniegiem
    const bottomY = skiState.cameraY + h + 200; 

    skiCtx.moveTo(startDrawX, bottomY);
    
    for (let x = startDrawX; x <= endDrawX; x += 10) {
        skiCtx.lineTo(x, getHillY(x));
    }
    
    skiCtx.lineTo(endDrawX, bottomY);
    skiCtx.closePath();
    skiCtx.fill();
    
    skiCtx.strokeStyle = "#ddd";
    skiCtx.lineWidth = 1;
    skiCtx.stroke();

    // --- 4. ELEMENTY SKOCZNI ---
    
    // Punkt K
    const kY = getHillY(kPointX);
    skiCtx.beginPath();
    skiCtx.strokeStyle = "red";
    skiCtx.lineWidth = 3;
    skiCtx.moveTo(kPointX, kY);
    skiCtx.lineTo(kPointX, kY + 50);
    skiCtx.stroke();
    
    skiCtx.fillStyle = "red";
    skiCtx.font = "12px Arial";
    skiCtx.fillText("K", kPointX - 5, kY + 60);

    // Belka
    skiCtx.fillStyle = "#8B4513"; 
    skiCtx.fillRect(SKI_HILL_START_X - 20, SKI_HILL_START_Y - 2, 20, 5); 
    skiCtx.fillRect(SKI_HILL_START_X - 20, SKI_HILL_START_Y, 5, 20);

    // Próg
    skiCtx.fillStyle = "#003366"; 
    skiCtx.fillRect(takeoffX - 5, getHillY(takeoffX), 5, 10);

   // --- 6. RYSOWANIE SKOCZKA (Zaktualizowane o animacje lądowania) ---
    if (skiState.phase !== 'idle' || skiState.x > 0) {
        skiCtx.save();
        skiCtx.translate(skiState.x, skiState.y);
        skiCtx.rotate(skiState.rotation); 
        
        // Kolor ludzika (Czerwony = powtórka, Niebieski = gracz)
        const jumperColor = (skiState.phase === 'replay') ? '#ff4444' : '#0044ff';

        if (skiState.phase === 'landed') {
            // === RYSOWANIE LĄDOWANIA ===
            
            if (skiState.landingType === 'crash') {
                // --- UPADEK (CRASH) ---
                // Narty "połamane" (na krzyż)
                skiCtx.fillStyle = "orange";
                skiCtx.save();
                skiCtx.rotate(0.5); skiCtx.fillRect(-20, -5, 45, 3);
                skiCtx.rotate(-1.0); skiCtx.fillRect(-20, 5, 45, 3);
                skiCtx.restore();

                // Ciało leży płasko
                skiCtx.fillStyle = jumperColor;
                skiCtx.fillRect(-15, -8, 30, 8); // Tułów na ziemi
                
                // Głowa na ziemi
                skiCtx.beginPath();
                skiCtx.arc(18, -4, 4, 0, Math.PI*2);
                skiCtx.fill();
                
            } else {
                // --- TELEMARK (ŁADNE LĄDOWANIE) ---
                // Narty płasko
                skiCtx.fillStyle = "orange";
                skiCtx.fillRect(-25, 0, 50, 3);

                skiCtx.fillStyle = jumperColor;
                
                // Noga tylna (ugięta)
                skiCtx.fillRect(-15, -10, 8, 10);
                // Noga przednia (wyprostowana/wykroczna)
                skiCtx.fillRect(5, -10, 8, 10);
                
                // Tułów (wyprostowany)
                skiCtx.fillRect(-5, -28, 10, 18);
                
                // Ręce (rozłożone na boki dla równowagi)
                skiCtx.fillRect(-12, -26, 24, 4);

                // Głowa
                skiCtx.beginPath();
                skiCtx.arc(0, -32, 4, 0, Math.PI*2);
                skiCtx.fill();
            }

        } else if (skiState.phase === 'inrun') {
            // === JAZDA PO ROZBIEGU (Pozycja dojazdowa) ===
            skiCtx.fillStyle = "orange";
            skiCtx.fillRect(-20, 0, 45, 3); // Narty
            
            skiCtx.fillStyle = jumperColor;
            skiCtx.fillRect(-10, -8, 15, 8); // Skulony tułów
            skiCtx.beginPath(); 
            skiCtx.arc(0, -8, 4, 0, Math.PI*2); // Głowa
            skiCtx.fill();

        } else {
            // === LOT (V-STYLE) ===
            skiCtx.fillStyle = "orange";
            skiCtx.fillRect(-20, 0, 45, 3); // Narty
            
            skiCtx.fillStyle = jumperColor;
            skiCtx.beginPath();
            skiCtx.moveTo(-5, -2); 
            skiCtx.lineTo(25, -10); // Ciało pochylone mocno do przodu
            skiCtx.lineTo(10, -2);
            skiCtx.fill();
            
            skiCtx.beginPath();
            skiCtx.arc(26, -11, 4, 0, Math.PI*2); // Głowa
            skiCtx.fill();
        }
        
        skiCtx.restore();
    }
	skiCtx.restore(); // <--- TEGO BRAKOWAŁO: Przywraca kamerę (save z początku funkcji)
} // <--- TEGO BRAKOWAŁO: Zamyka funkcję drawSkiGame()
// ==========================================
// === DAILY WHEEL LOGIC (KOŁO FORTUNY) ===
// ==========================================

const DAILY_PRIZES = [
    { label: '500 zł',   value: 500,   color: '#444', weight: 40 },
    { label: '1 000 zł', value: 1000,  color: '#333', weight: 30 },
    { label: '2 500 zł', value: 2500,  color: '#444', weight: 15 },
    { label: '5 000 zł', value: 5000,  color: '#333', weight: 10 },
    { label: '10k zł',   value: 10000, color: '#444', weight: 4 },
    { label: '25k zł',   value: 25000, color: '#333', weight: 0.9 },
    { label: '50k zł',   value: 50000, color: 'gold', weight: 0.1 }, // Jackpot
    { label: 'Bieda',    value: 100,   color: 'red',  weight: 5 }    // Troll
];

let dailyWheelSpinning = false;
let dailyNextSpinTime = null;

// Wywołaj to wewnątrz DOMContentLoaded
function initDailyWheel() {
    const wheelEl = document.getElementById("daily-wheel");
    const btnSpin = document.getElementById("btn-daily-spin");
    
    if(!wheelEl || !btnSpin) return;

    btnSpin.addEventListener("click", spinDailyWheel);

    // 1. Wygeneruj segmenty wizualnie
    // Mamy 8 segmentów -> każdy zajmuje 45 stopni (360 / 8)
    const segmentAngle = 360 / DAILY_PRIZES.length;
    
    // Czyścimy stare (oprócz środka)
    const center = wheelEl.querySelector('.wheel-center');
    wheelEl.innerHTML = '';
    wheelEl.appendChild(center);

    DAILY_PRIZES.forEach((prize, index) => {
        const seg = document.createElement("div");
        seg.className = "wheel-segment";
        
        // Stylizacja tekstu zależna od wartości
        if(prize.value >= 25000) seg.classList.add("seg-jackpot");
        else if(prize.value >= 5000) seg.classList.add("seg-high");
        else if(prize.value >= 1000) seg.classList.add("seg-med");
        else seg.classList.add("seg-low");

        // Obrót segmentu
        // Przesuwamy o połowę kąta (segmentAngle / 2), żeby tekst był na środku klina
        const rotation = (index * segmentAngle) + (segmentAngle / 2);
        
        seg.style.transform = `rotate(${rotation}deg) translateY(-50%)`;
        // Hack: używamy height: 0 i overflow visible, albo position absolute od środka
        // CSS wyżej jest ustawiony na transform-origin: 0 50% (lewa krawędź środkiem koła)
        
        seg.innerHTML = `<span>${prize.label}</span>`;
        wheelEl.appendChild(seg);
    });

    // 2. Sprawdź dostępność spina (z bazy)
    checkDailyAvailability();
}

async function checkDailyAvailability() {
    if(!currentUserId) return;
    
    try {
        const userRef = doc(db, "uzytkownicy", currentUserId);
        const snap = await getDoc(userRef);
        if(!snap.exists()) return;

        const data = snap.data();
        const lastSpin = data.lastDailyBonus ? data.lastDailyBonus.toDate() : new Date(0);
        const now = new Date();
        
        // 24 godziny w milisekundach
        const cooldown = 24 * 60 * 60 * 1000;
        const diff = now - lastSpin;

        const btn = document.getElementById("btn-daily-spin");
        const status = document.getElementById("daily-status");
        const timer = document.getElementById("daily-timer");

        if (diff < cooldown) {
            // Zablokowane
            const nextTime = new Date(lastSpin.getTime() + cooldown);
            dailyNextSpinTime = nextTime;
            
            btn.disabled = true;
            btn.textContent = "WRÓĆ JUTRO";
            btn.style.background = "#333";
            status.textContent = "Odebrałeś już bonus.";
            
            startDailyTimer();
        } else {
            // Dostępne
            btn.disabled = false;
            btn.textContent = "ZAKRĘĆ (FREE)";
            btn.style.background = "var(--accent-gradient)"; // Przywróć kolor
            status.textContent = "Bonus dostępny!";
            timer.textContent = "";
        }
    } catch(e) { console.error(e); }
}

function startDailyTimer() {
    const timerEl = document.getElementById("daily-timer");
    const interval = setInterval(() => {
        if(!dailyNextSpinTime) { clearInterval(interval); return; }
        
        const now = new Date();
        const diff = dailyNextSpinTime - now;

        if(diff <= 0) {
            clearInterval(interval);
            checkDailyAvailability(); // Odblokuj
            return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        timerEl.textContent = `Następny spin za: ${h}h ${m}m ${s}s`;
    }, 1000);
}

async function spinDailyWheel() {
    if(dailyWheelSpinning) return;
    if(!currentUserId) return showMessage("Zaloguj się!", "error");
    
    const wheelEl = document.getElementById("daily-wheel");
    const statusEl = document.getElementById("daily-status");
    const btn = document.getElementById("btn-daily-spin");

    // 1. Losowanie ważone
    let totalWeight = 0;
    DAILY_PRIZES.forEach(p => totalWeight += p.weight);
    let random = Math.random() * totalWeight;
    
    let selectedPrizeIndex = 0;
    for(let i=0; i<DAILY_PRIZES.length; i++) {
        if(random < DAILY_PRIZES[i].weight) {
            selectedPrizeIndex = i;
            break;
        }
        random -= DAILY_PRIZES[i].weight;
    }

    const prize = DAILY_PRIZES[selectedPrizeIndex];
    
    // 2. Blokada UI
    dailyWheelSpinning = true;
    btn.disabled = true;
    statusEl.textContent = "Kręcimy...";
    
    // 3. Obliczanie kąta obrotu
    // Koło ma 8 segmentów po 45 stopni.
    // Index 0 jest na 0 stopni (na prawo -> w CSS rotate(0)).
    // Ale wskaźnik jest na górze (270 stopni / -90 stopni).
    // Musimy obrócić koło tak, żeby wybrany segment trafił pod wskaźnik.
    
    const segmentAngle = 360 / DAILY_PRIZES.length;
    // Żeby segment `i` był na górze (270deg), musimy obrócić koło o: 
    // TargetRotation = 270 - (i * segmentAngle) - (random offset wewnątrz segmentu)
    
    // Dodajemy dużo pełnych obrotów (np. 5-10)
    const spins = 5 + Math.floor(Math.random() * 5); 
    const randomOffset = Math.floor(Math.random() * (segmentAngle - 4)) + 2; // Żeby nie trafić w linię
    
    // Logika: Wskaźnik jest na górze (-90deg lub 270deg).
    // Segmenty rysują się od 0deg (prawa strona).
    // Żeby index 0 trafił na górę, trzeba obrócić o -90deg.
    // Żeby index 1 trafił na górę, trzeba obrócić o -90 - 45 itd.
    
    const targetRotation = (spins * 360) - (90) - (selectedPrizeIndex * segmentAngle) - (segmentAngle/2); // Celujemy w środek segmentu
    
    // Dodajemy lekką losowość wewnątrz segmentu dla realizmu
    const finalRot = targetRotation + (Math.random() * 20 - 10); 

    wheelEl.style.transform = `rotate(${finalRot}deg)`;

    // 4. Dźwięk (opcjonalnie)
    // if(dom.audioNews) { dom.audioNews.play().catch(()=>{}); }

    // 5. Czekamy na koniec animacji (4 sekundy w CSS)
    setTimeout(async () => {
        dailyWheelSpinning = false;
        
        if(prize.value > 1000) {
            if(dom.audioKaching) dom.audioKaching.play().catch(()=>{});
        }

        statusEl.innerHTML = `WYGRANA: <span style="color:${prize.color}; font-weight:bold">${formatujWalute(prize.value)}</span>`;
        
        try {
            await runTransaction(db, async (t) => {
                const userRef = doc(db, "uzytkownicy", currentUserId);
                const d = (await t.get(userRef)).data();
                
                // Sprawdzenie double-check (server timestamp rule by się przydała, ale tu robimy client-check w transaction)
                const lastSpin = d.lastDailyBonus ? d.lastDailyBonus.toDate() : new Date(0);
                const now = new Date();
                if (now - lastSpin < 23 * 60 * 60 * 1000) { // Margines błędu
                    throw new Error("Już odebrano dzisiaj!");
                }

                const newCash = d.cash + prize.value;
                const newTotal = calculateTotalValue(newCash, d.shares); // Funkcja helper z main script
                
                t.update(userRef, { 
                    cash: newCash, 
                    totalValue: newTotal,
                    zysk: (d.zysk || 0) + prize.value, // To jest darmowy zysk
                    lastDailyBonus: serverTimestamp() // Zapisz czas
                });
            });

            showNotification(`Daily Spin: +${formatujWalute(prize.value)}`, 'news', 'positive');
            
            // Zablokuj przycisk
            checkDailyAvailability();

        } catch(e) {
            showMessage(e.message, "error");
            statusEl.textContent = "Błąd: " + e.message;
        }

    }, 4000);
}
