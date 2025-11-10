// --- SEKCJA 0: IMPORTY I KONFIGURACJA FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, onSnapshot, updateDoc, 
    collection, addDoc, query, orderBy, limit, Timestamp, 
    serverTimestamp, where, 
    getDocs, writeBatch, deleteDoc, getDoc, runTransaction,
    increment // <-- WAŻNY IMPORT DLA STATYSTYK
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

// --- SEKCJA 1: ZMIENNE GLOBALNE I REFERENCJE DOM ---

function generateInitialCandles(count, basePrice) {
    let data = []; let lastClose = basePrice;
    if (!basePrice || basePrice < 1) basePrice = 1; 

    let timestamp = new Date().getTime() - (count * 5000);
    for (let i = 0; i < count; i++) {
        let open = lastClose;
        let close = open + (Math.random() - 0.5) * (basePrice * 0.05);
        let high = Math.max(open, close) + Math.random() * (basePrice * 0.02);
        let low = Math.min(open, close) - Math.random() * (basePrice * 0.02);
        
        open = Math.max(1, open);
        high = Math.max(1, high);
        low = Math.max(1, low);
        close = Math.max(1, close);

        data.push({
            x: new Date(timestamp),
            y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
        });
        lastClose = close; timestamp += 5000;
    }
    return data;
}

// ZAKTUALIZOWANE o Krypto
let market = {
    // Akcje
    ulanska:    { name: "Ułańska Dev",   price: 1, previousPrice: null, history: [], type: 'stock' },
    brzozair:   { name: "BrzozAir",      price: 1, previousPrice: null, history: [], type: 'stock' },
    igicorp:    { name: "IgiCorp",       price: 1, previousPrice: null, history: [], type: 'stock' },
    rychbud:    { name: "RychBud",       price: 1, previousPrice: null, history: [], type: 'stock' },
    cosmosanit: { name: "Cosmosanit",    price: 100, previousPrice: null, history: [], type: 'stock' },
    gigachat:   { name: "Gigachat GPT",  price: 500, previousPrice: null, history: [], type: 'stock' },
    bimbercfd:  { name: "Bimber.cfd",    price: 20,  previousPrice: null, history: [], type: 'stock' },
    // Krypto
    bartcoin:   { name: "Bartcoin",      price: 1000, previousPrice: null, history: [], type: 'crypto' },
    igirium:    { name: "Igirium",       price: 500, previousPrice: null, history: [], type: 'crypto' },
    kacoin:     { name: "Kacoin",        price: 100, previousPrice: null, history: [], type: 'crypto' }
};

// ZAKTUALIZOWANE o Krypto
const companyAbbreviations = {
    ulanska: "UŁDEV",
    rychbud: "RBUD",
    igicorp: "ICORP",
    brzozair: "BAIR",
    cosmosanit: "COSIT",
    gigachat: "GIPT",
    bimbercfd: "BIMBER",
    bartcoin: "BRC",
    igirium: "IGI",
    kacoin: "KCN"
};

let currentCompanyId = "ulanska";
let currentMarketType = "stocks"; // 'stocks' lub 'crypto'

// ZAKTUALIZOWANE o Krypto
let portfolio = {
    name: "Gość",
    cash: 0,
    shares: { 
        ulanska: 0, 
        rychbud: 0, 
        igicorp: 0, 
        brzozair: 0,
        cosmosanit: 0,
        gigachat: 0,
        bimbercfd: 0,
        bartcoin: 0,
        igirium: 0,
        kacoin: 0
    },
    stats: { // <-- NOWE STATYSTYKI
        totalTrades: 0,
        tipsPurchased: 0,
        bondsPurchased: 0
    },
    startValue: 100,
    zysk: 0,
    totalValue: 0,
    prestigeLevel: 0 
};

// --- STAŁE DLA PRESTIŻU ---
const PRESTIGE_REQUIREMENTS = [15000, 30000, 60000, 120000]; // Poziomy 1, 2, 3, 4
const TIP_COSTS = [1500, 1400, 1200, 1100, 1000]; // Koszt dla poziomu 0, 1, 2, 3, 4
const CRYPTO_PRESTIGE_REQUIREMENT = 3; // <-- WYMAGANY POZIOM DLA KRYPTO

let chart = null;
let portfolioChart = null; 
let modalPortfolioChart = null; 
let currentUserId = null;

// ZAKTUALIZOWANE o Krypto
const COMPANY_ORDER = [
    "ulanska", "rychbud", "igicorp", "brzozair", 
    "cosmosanit", "gigachat", "bimbercfd",
    "bartcoin", "igirium", "kacoin"
];
// ZAKTUALIZOWANE o Krypto
const CHART_COLORS = [
    'var(--blue)', // Gotówka (zawsze pierwszy)
    '#FF6384',     // ulanska
    '#36A2EB',     // rychbud
    '#FFCE56',     // igicorp
    '#4BC0C0',     // brzozair
    '#9966FF',     // cosmosanit
    '#FF9F40',     // gigachat
    '#C9CBCF',     // bimbercfd
    '#F0B90B',     // bartcoin (kolor a'la BTC)
    '#627EEA',     // igirium (kolor a'la ETH)
    '#444444'      // kacoin (ciemny)
];

let chartHasStarted = false; 
let initialNewsLoaded = false; 
let initialChatLoaded = false; 
let audioUnlocked = false; 

let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeNews = null; 
let unsubscribeLeaderboard = null;
let unsubscribeChat = null; 
let unsubscribeGlobalHistory = null;
let unsubscribePersonalHistory = null;
let unsubscribeLimitOrders = null; 
let unsubscribeBonds = null;

let dom = {};


// ====================================================================
// NASŁUCHIWACZ CEN (onSnapshot)
// ====================================================================
const cenyDocRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyDocRef, (docSnap) => {
    
    if (docSnap.exists()) {
        const aktualneCeny = docSnap.data();
        
        // Zaktualizowano pętlę, aby pobierała wszystkie klucze z 'market'
        for (const companyId in market) {
            if (aktualneCeny[companyId] !== undefined) {
                const newPrice = aktualneCeny[companyId];
                if (market[companyId].price) {
                    market[companyId].previousPrice = market[companyId].price;
                }
                market[companyId].price = newPrice;
            }
        }
        
        if (!chartHasStarted) {
            for (const companyId in market) {
                if (market[companyId].price && market[companyId].history.length === 0) {
                    const realPrice = market[companyId].price;
                    market[companyId].history = generateInitialCandles(50, realPrice);
                    market[companyId].previousPrice = realPrice; 
                }
            }
        }

        updatePriceUI(); 
        updatePortfolioUI(); 
        updateTickerTape(); 

        const chartDataReady = market[currentCompanyId] && market[currentCompanyId].history.length > 0;

        if (currentUserId && !chartHasStarted && chartDataReady) {
            if (!chart) initChart();
            startChartTicker();    
            chartHasStarted = true;
        }

    } else {
        console.error("KRYTYCZNY BŁĄD: Nie można znaleźć dokumentu 'global/ceny_akcji'!");
    }
});

// --- SEKCJA 1.5: LOGIKA MOTYWÓW ---

function applySavedTheme() {
    const savedTheme = localStorage.getItem('simulatorTheme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}

function onChangeTheme(e) {
    const theme = e.target.value;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('simulatorTheme', theme);
    
    const newChartTheme = (theme === 'light') ? 'light' : 'dark';

    if (chart) {
        chart.updateOptions({
            theme: { mode: newChartTheme }
        });
    }
    if (portfolioChart) {
        portfolioChart.updateOptions({
            theme: { mode: newChartTheme }
        });
    }
    if (modalPortfolioChart) {
        modalPortfolioChart.updateOptions({
            theme: { mode: newChartTheme }
        });
    }
}


// --- SEKCJA 2: GŁÓWNY PUNKT WEJŚCIA (ZAKTUALIZOWANY) ---
document.addEventListener("DOMContentLoaded", () => {
    
    applySavedTheme();

    // Referencje DOM
    dom = {
        // Kontenery
        authContainer: document.getElementById("auth-container"),
        simulatorContainer: document.getElementById("simulator-container"),
        
        // Autentykacja
        loginForm: document.getElementById("login-form"),
        registerForm: document.getElementById("register-form"),
        authMessage: document.getElementById("auth-message"),
        resetPasswordLink: document.getElementById("reset-password-link"),
        showRegisterLink: document.getElementById("show-register-link"),
        showLoginLink: document.getElementById("show-login-link"),
        
        // Header
        username: document.getElementById("username"),
        logoutButton: document.getElementById("logout-button"),
        themeSelect: document.getElementById("theme-select"),
        
        // Ticker
        tickerContent: document.getElementById("ticker-content"),
        
        // Panel Rynku (Wykres)
        marketTypeTabs: document.querySelectorAll(".market-type-tab"), // <-- NOWY
        companySelector: document.getElementById("company-selector"),
        cryptoSelector: document.getElementById("crypto-selector"), // <-- NOWY
        companyName: document.getElementById("company-name"),
        stockPrice: document.getElementById("stock-price"),
        chartContainer: document.getElementById("chart-container"),

        // Panel Portfela
        cash: document.getElementById("cash"),
        totalValue: document.getElementById("total-value"),
        totalProfit: document.getElementById("total-profit"),
        sharesList: document.getElementById("shares-list"),
        portfolioChartContainer: document.getElementById("portfolio-chart-container"),

        // Panel Zleceń
        orderPanel: document.getElementById("order-panel"), // <-- NOWY (dla blokady)
        orderTabMarket: document.querySelector('.order-tab-btn[data-order-type="market"]'),
        orderTabLimit: document.querySelector('.order-tab-btn[data-order-type="limit"]'),
        orderMarketContainer: document.getElementById("order-market-container"),
        orderLimitContainer: document.getElementById("order-limit-container"),
        cryptoGateMessage: document.querySelector(".crypto-gate-message"), // <-- NOWY
        
        // Zlecenie Rynkowe
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        buyMaxButton: document.getElementById("buy-max-button"), 
        sellMaxButton: document.getElementById("sell-max-button"), 
        messageBox: document.getElementById("message-box"),
        
        // Zlecenie Limit
        limitOrderForm: document.getElementById("limit-order-form"),
        limitType: document.getElementById("limit-type"),
        limitAmount: document.getElementById("limit-amount"),
        limitPrice: document.getElementById("limit-price"),
        limitOrderButton: document.getElementById("limit-order-button"),
        
        // Panel Plotek i Newsów
        rumorForm: document.getElementById("rumor-form"),
        rumorInput: document.getElementById("rumor-input"),
        rumorsFeed: document.getElementById("rumors-feed"),
        buyTipButton: document.getElementById("buy-tip-button"), 
        tipCost: document.getElementById("tip-cost"), 
        newsFeed: document.getElementById("news-feed"), 
        
        // Panel Rankingu
        leaderboardList: document.getElementById("leaderboard-list"),
        
        // Panel Czat
        chatForm: document.getElementById("chat-form"),
        chatInput: document.getElementById("chat-input"),
        chatFeed: document.getElementById("chat-feed"),
        
        // Zakładki Historii
        historyTabsPanel: document.getElementById("history-tabs-panel"),
        historyTabButtons: document.querySelectorAll("#history-tabs-panel .tab-btn"),
        historyTabGlobal: document.getElementById("tab-global-history"),
        historyTabPersonal: document.getElementById("tab-personal-history"),
        historyTabLimitOrders: document.getElementById("tab-limit-orders"),
        
        globalHistoryFeed: document.getElementById("global-history-feed"),
        personalHistoryFeed: document.getElementById("personal-history-feed"),
        clearHistoryButton: document.getElementById("clear-history-button"),
        
        limitOrdersFeed: document.getElementById("limit-orders-feed"),
        clearOrdersButton: document.getElementById("clear-orders-button"),

        // Panel Obligacji
        bondsForm: document.getElementById("bonds-form"),
        bondAmount: document.getElementById("bond-amount"),
        bondType: document.getElementById("bond-type"),
        buyBondButton: document.getElementById("buy-bond-button"),
        activeBondsFeed: document.getElementById("active-bonds-feed"),

        // Modal Profilu Użytkownika
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
        
        // NOWE STATYSTYKI W MODALU
        modalTotalTrades: document.getElementById("modal-total-trades"),
        modalTipsPurchased: document.getElementById("modal-tips-purchased"),
        modalBondsPurchased: document.getElementById("modal-bonds-purchased"),

        prestigeInfo: document.getElementById("prestige-info"), 
        prestigeNextGoal: document.getElementById("prestige-next-goal"), 
        prestigeButton: document.getElementById("prestige-button"), 

        // Audio i Powiadomienia
        audioKaching: document.getElementById("audio-kaching"),
        audioError: document.getElementById("audio-error"),
        audioNews: document.getElementById("audio-news"),
        notificationContainer: document.getElementById("notification-container")
    };

    // 2. Podepnij GŁÓWNE listenery
    dom.registerForm.addEventListener("submit", onRegister);
    dom.loginForm.addEventListener("submit", onLogin);
    dom.logoutButton.addEventListener("click", onLogout);
    
    // NOWE Listenery dla zakładek Akcje/Krypto
    dom.marketTypeTabs.forEach(tab => {
        tab.addEventListener("click", onSelectMarketType);
    });
    
    // Listenery dla selektorów aktywów
    dom.companySelector.addEventListener("click", onSelectCompany);
    dom.cryptoSelector.addEventListener("click", onSelectCompany); // <-- NOWY
    
    // Listenery zleceń rynkowych
    dom.buyButton.addEventListener("click", buyShares);
    dom.sellButton.addEventListener("click", sellShares);
    dom.buyMaxButton.addEventListener("click", onBuyMax); 
    dom.sellMaxButton.addEventListener("click", onSellMax); 
    
    // Listenery formularzy
    dom.rumorForm.addEventListener("submit", onPostRumor);
    dom.chatForm.addEventListener("submit", onSendMessage);
    dom.limitOrderForm.addEventListener("submit", onPlaceLimitOrder);
    dom.bondsForm.addEventListener("submit", onBuyBond); 
    
    // Listenery przycisków
    dom.resetPasswordLink.addEventListener("click", onResetPassword);
    dom.themeSelect.addEventListener("change", onChangeTheme);
    dom.clearHistoryButton.addEventListener("click", onClearPersonalHistory);
    dom.clearOrdersButton.addEventListener("click", onClearLimitOrders);
    dom.buyTipButton.addEventListener("click", onBuyTip);
    dom.prestigeButton.addEventListener("click", onPrestigeReset);

    // Listenery zakładek (Zlecenia i Historia)
    dom.orderTabMarket.addEventListener("click", onSelectOrderTab);
    dom.orderTabLimit.addEventListener("click", onSelectOrderTab);
    dom.historyTabButtons.forEach(button => {
        button.addEventListener("click", onSelectHistoryTab);
    });

    // Listenery Modalu
    dom.modalCloseButton.addEventListener("click", () => dom.modalOverlay.classList.add("hidden"));
    dom.modalOverlay.addEventListener("click", (e) => {
        if (e.target === dom.modalOverlay) dom.modalOverlay.classList.add("hidden");
    });

    // Listenery przełączania Auth
    dom.showRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        dom.authContainer.classList.add("show-register");
        showAuthMessage("");
    });
    dom.showLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        dom.authContainer.classList.remove("show-register");
        showAuthMessage("");
    });

    // 3. Uruchom główną pętlę aplikacji
    startAuthListener();
});


function unlockAudio() {
    if (audioUnlocked) return; 
    
    try {
        dom.audioKaching.play().catch(e => {});
        dom.audioKaching.pause();
        dom.audioError.play().catch(e => {});
        dom.audioError.pause();
        dom.audioNews.play().catch(e => {});
        dom.audioNews.pause();
        
        audioUnlocked = true;
        console.log("Audio odblokowane przez interakcję użytkownika.");
    } catch (e) {
        console.error("Błąd odblokowywania audio:", e);
    }
}


function startAuthListener() {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUserId = user.uid;
            dom.simulatorContainer.classList.remove("hidden");
            dom.authContainer.classList.add("hidden");
            
            listenToPortfolioData(currentUserId);
            listenToRumors();
            listenToMarketNews(); 
            listenToLeaderboard();
            listenToChat(); 
            listenToGlobalHistory();
            listenToPersonalHistory(currentUserId);
            listenToLimitOrders(currentUserId);
            listenToActiveBonds(currentUserId);
            
        } else {
            currentUserId = null;
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            if (dom.authContainer) dom.authContainer.classList.remove("show-register");
            
            if (unsubscribePortfolio) unsubscribePortfolio();
            if (unsubscribeRumors) unsubscribeRumors();
            if (unsubscribeNews) unsubscribeNews(); 
            if (unsubscribeLeaderboard) unsubscribeLeaderboard();
            if (unsubscribeChat) unsubscribeChat(); 
            if (unsubscribeGlobalHistory) unsubscribeGlobalHistory();
            if (unsubscribePersonalHistory) unsubscribePersonalHistory();
            if (unsubscribeLimitOrders) unsubscribeLimitOrders();
            if (unsubscribeBonds) unsubscribeBonds();
            
            if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
            
            chartHasStarted = false; 
            chart = null;            
            portfolioChart = null;
            modalPortfolioChart = null;
            initialNewsLoaded = false; 
            initialChatLoaded = false; 
            audioUnlocked = false; 
            
            // ZAKTUALIZOWANE o Krypto
            portfolio = { 
                name: "Gość", 
                cash: 1000, 
                shares: { 
                    ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0, 
                    cosmosanit: 0, gigachat: 0, bimbercfd: 0,
                    bartcoin: 0, igirium: 0, kacoin: 0
                },
                stats: { totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 },
                startValue: 1000, 
                zysk: 0, 
                totalValue: 1000,
                prestigeLevel: 0 
            };
            
            for (const companyId in market) {
                market[companyId].history = [];
                market[companyId].previousPrice = null;
            }
            
            updatePortfolioUI();
        }
    });
}


// --- SEKCJA 3: HANDLERY AUTENTYKACJI (ZAKTUALIZOWANE) ---

// ZAKTUALIZOWANE o Krypto i Statystyki
async function createInitialUserData(userId, name, email) {
    const userPortfolio = {
        name: name,
        email: email,
        cash: 1000.00,
        shares: { 
            ulanska: 0, 
            rychbud: 0, 
            igicorp: 0, 
            brzozair: 0,
            cosmosanit: 0,
            gigachat: 0,
            bimbercfd: 0,
            bartcoin: 0,
            igirium: 0,
            kacoin: 0
        },
        stats: { // <-- NOWE STATYSTYKI
            totalTrades: 0,
            tipsPurchased: 0,
            bondsPurchased: 0
        },
        startValue: 1000.00,
        zysk: 0.00,
        totalValue: 1000.00,
        joinDate: Timestamp.fromDate(new Date()),
        prestigeLevel: 0 
    };
    const userDocRef = doc(db, "uzytkownicy", userId);
    await setDoc(userDocRef, userPortfolio);
}

async function onRegister(e) {
    e.preventDefault();
    unlockAudio(); 
    
    const name = dom.registerForm.querySelector("#register-name").value;
    const email = dom.registerForm.querySelector("#register-email").value;
    const password = dom.registerForm.querySelector("#register-password").value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
            await createInitialUserData(userCredential.user.uid, name, email);
        }
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showAuthMessage("Ten e-mail jest już zajęty. Spróbuj się zalogować.", "error");
        } else {
            showAuthMessage("Błąd rejestracji: " + error.message, "error");
        }
    }
}

async function onLogin(e) {
    e.preventDefault();
    unlockAudio(); 
    
    const email = dom.loginForm.querySelector("#login-email").value;
    const password = dom.loginForm.querySelector("#login-password").value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthMessage("Błąd logowania: " + error.message, "error");
    }
}

function onLogout() { signOut(auth); }

function showAuthMessage(message, type = "info") {
    dom.authMessage.textContent = message;
    dom.authMessage.style.color = (type === "error") ? "var(--red)" : "var(--green)";
}

async function onResetPassword(e) {
    e.preventDefault();
    const email = dom.loginForm.querySelector("#login-email").value;
    if (!email) {
        showAuthMessage("Wpisz swój e-mail w polu logowania, aby zresetować hasło.", "error");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showAuthMessage("Link do resetowania hasła został wysłany na Twój e-mail!", "success");
    } catch (error) {
        console.error("Błąd wysyłania resetu hasła:", error);
        showAuthMessage("Błąd: " + error.message, "error");
    }
}


// --- SEKCJA 4: LOGIKA BAZY DANYCH (ZAKTUALIZOWANA) ---

function showNotification(message, type, impactType = null) {
    if (!dom.notificationContainer) return;

    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.classList.add(`toast-${type}`); 
    
    if (type === 'news') {
        let header = "Wiadomość Rynkowa";
        if (impactType === 'positive') {
            toast.classList.add('toast-positive');
            header = "Dobre Wieści!";
        } else if (impactType === 'negative') {
            toast.classList.add('toast-negative');
            header = "Złe Wieści!";
        }
        toast.innerHTML = `<strong>${header}</strong><p>${message}</p>`;
    } else if (type === 'chat') { 
        toast.innerHTML = `<strong class="toast-chat-header">Nowa Wiadomość:</strong><p>${message}</p>`;
    } else if (type === 'tip') { 
        toast.innerHTML = `<strong>Prywatna Wskazówka!</strong><p>${message}</p>`;
    }

    dom.notificationContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500);
    }, 5000); // Wskazówki widoczne 5 sekund
}


function listenToPortfolioData(userId) {
    if (unsubscribePortfolio) unsubscribePortfolio();
    const userDocRef = doc(db, "uzytkownicy", userId);
    unsubscribePortfolio = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            portfolio.name = data.name;
            portfolio.cash = data.cash;
            // ZAKTUALIZOWANE o Krypto
            portfolio.shares = data.shares || { 
                ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0, 
                cosmosanit: 0, gigachat: 0, bimbercfd: 0,
                bartcoin: 0, igirium: 0, kacoin: 0
            };
            // NOWE Statystyki
            portfolio.stats = data.stats || { 
                totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 
            };
            portfolio.startValue = data.startValue;
            portfolio.prestigeLevel = data.prestigeLevel || 0; 
            updatePortfolioUI();
            checkCryptoAccess(); // <-- Sprawdź dostęp do krypto po aktualizacji portfela
        } else {
            console.error("Błąd: Nie znaleziono danych użytkownika!");
        }
    }, (error) => {
        console.error("Błąd nasłuchu portfela: ", error);
    });
}

function listenToRumors() {
    if (unsubscribeRumors) unsubscribeRumors();
    const rumorsQuery = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(10));
    
    unsubscribeRumors = onSnapshot(rumorsQuery, (querySnapshot) => {
        dom.rumorsFeed.innerHTML = "";
        querySnapshot.forEach((doc, index) => {
            const rumor = doc.data();
            displayNewRumor(rumor); 
        });
    }, (error) => { console.error("Błąd nasłuchu plotek: ", error); });
}

function listenToMarketNews() {
    if (unsubscribeNews) unsubscribeNews();
    const newsQuery = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(5));
    
    unsubscribeNews = onSnapshot(newsQuery, (querySnapshot) => {
        if (!dom.newsFeed) return;
        
        let newNewsArrived = false;

        querySnapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const news = change.doc.data();
                displayMarketNews(news.text, news.impactType); 

                if (initialNewsLoaded) {
                    newNewsArrived = true;
                    showNotification(news.text, 'news', news.impactType);
                }
            }
        });
        
        if (newNewsArrived && audioUnlocked) {
            if (dom.audioNews) {
                dom.audioNews.currentTime = 0;
                dom.audioNews.play().catch(e => console.log("Błąd odtwarzania audio newsa"));
            }
        }

        initialNewsLoaded = true;

    }, (error) => { console.error("Błąd nasłuchu newsów: ", error); });
}

function displayMarketNews(text, impactType) {
    if (!dom.newsFeed) return;
    const p = document.createElement("p");
    p.textContent = text;
    if (impactType === "positive") p.style.color = "var(--green)"; 
    else if (impactType === "negative") p.style.color = "var(--red)"; 
    
    dom.newsFeed.prepend(p); 
    
    while (dom.newsFeed.children.length > 5) {
        dom.newsFeed.removeChild(dom.newsFeed.lastChild);
    }
}

async function onSendMessage(e) {
    e.preventDefault();
    const text = dom.chatInput.value.trim();
    if (!text || !currentUserId) return; 
    try {
        await addDoc(collection(db, "chat_messages"), {
            text: text,
            authorName: portfolio.name, 
            authorId: currentUserId,
            prestigeLevel: portfolio.prestigeLevel || 0, 
            timestamp: serverTimestamp() 
        });
        dom.chatInput.value = "";
    } catch (error) {
        console.error("Błąd wysyłania wiadomości: ", error);
        showMessage("Nie udało się wysłać wiadomości.", "error");
    }
}

function listenToChat() {
    if (unsubscribeChat) unsubscribeChat();
    const chatQuery = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(30));
    
    unsubscribeChat = onSnapshot(chatQuery, (querySnapshot) => {
        if (!dom.chatFeed) return;
        
        dom.chatFeed.innerHTML = ""; 
        const messages = querySnapshot.docs.reverse(); 
        messages.forEach((doc) => displayChatMessage(doc.data()));
        dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;

        querySnapshot.docChanges().forEach(change => {
            const msg = change.doc.data();
            if (change.type === "added" && msg.authorId !== currentUserId && initialChatLoaded) {
                const prestigeStars = getPrestigeStars(msg.prestigeLevel, 'chat');
                const notifMessage = `<strong>${msg.authorName}${prestigeStars}</strong>: ${msg.text}`;
                showNotification(notifMessage, 'chat');
            }
        });

        initialChatLoaded = true; 

    }, (error) => { console.error("Błąd nasłuchu czatu: ", error); });
}

function displayChatMessage(msg) {
    if (!dom.chatFeed) return;
    const p = document.createElement("p");
    const strong = document.createElement("strong");
    
    strong.textContent = msg.authorName + ": ";
    strong.classList.add("clickable-user");
    strong.dataset.userId = msg.authorId;
    strong.addEventListener("click", () => showUserProfile(msg.authorId));

    p.appendChild(strong);
    
    const prestigeStars = getPrestigeStars(msg.prestigeLevel, 'chat');
    strong.insertAdjacentHTML('afterend', prestigeStars + ' ');

    p.appendChild(document.createTextNode(msg.text));
    if (msg.authorId === currentUserId) p.classList.add("my-message");
    dom.chatFeed.appendChild(p); 
}

async function onPostRumor(e) {
    e.preventDefault();
    const rumorText = dom.rumorInput.value;
    const companyId = dom.rumorForm.querySelector("#rumor-company-select").value;
    const sentiment = dom.rumorForm.querySelector('input[name="sentiment"]:checked').value;
    if (!rumorText.trim() || !currentUserId || !companyId || !sentiment) return;
    
    // Krypto ma większy wpływ na plotki
    const isCrypto = market[companyId] && market[companyId].type === 'crypto';
    const baseImpact = isCrypto ? 0.08 : 0.04; // 8% dla krypto, 4% dla akcji
    const impact = (Math.random() * baseImpact + 0.01) * (sentiment === 'positive' ? 1 : -1);

    try {
        await addDoc(collection(db, "plotki"), {
            text: rumorText,
            authorId: currentUserId,
            authorName: portfolio.name,
            prestigeLevel: portfolio.prestigeLevel || 0, 
            timestamp: Timestamp.fromDate(new Date()),
            companyId: companyId,
            sentiment: sentiment,
            impact: impact 
        });
        dom.rumorInput.value = "";
    } catch (error) {
        console.error("Błąd dodawania plotki: ", error);
    }
}

function listenToLeaderboard() {
    if (unsubscribeLeaderboard) unsubscribeLeaderboard();
    const leaderboardQuery = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
    
    unsubscribeLeaderboard = onSnapshot(leaderboardQuery, (querySnapshot) => {
        if(!dom.leaderboardList) return;
        dom.leaderboardList.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const li = document.createElement("li");
            if (doc.id === currentUserId) li.classList.add("highlight-me");
            
            const nameSpan = document.createElement("span");
            
            const prestigeStars = getPrestigeStars(user.prestigeLevel);
            nameSpan.innerHTML = `${rank}. ${user.name} ${prestigeStars}`;
            
            nameSpan.classList.add("clickable-user");
            nameSpan.dataset.userId = doc.id;
            nameSpan.addEventListener("click", () => showUserProfile(doc.id));

            const valueStrong = document.createElement("strong");
            valueStrong.textContent = formatujWalute(user.totalValue || 0);
            
            const profit = (user.totalValue || 0) - (user.startValue || 100);
            const profitSmall = document.createElement("small");
            profitSmall.textContent = `Zysk: ${formatujWalute(profit)}`;
            profitSmall.style.color = profit > 0 ? "var(--green)" : (profit < 0 ? "var(--red)" : "var(--text-muted)");
            
            nameSpan.appendChild(profitSmall);
            li.appendChild(nameSpan);
            li.appendChild(valueStrong);
            dom.leaderboardList.appendChild(li);
            rank++;
        });
    }, (error) => {
        console.error("Błąd nasłuchu rankingu: ", error);
    });
}

// --- SEKCJA 4.5: LOGIKA HISTORII TRANSAKCJI (ZAKTUALIZOWANA) ---

async function logTransaction(type, companyId, amount, pricePerShare, totalCostOrRevenue) {
    if (!currentUserId || !portfolio.name) {
        console.error("Nie można zalogować transakcji: brak danych.");
        return;
    }

    const companyName = (companyId && market[companyId]) ? market[companyId].name : "System";
    const finalPrice = pricePerShare || 0;
    const finalTotal = totalCostOrRevenue || 0;

    const transactionData = {
        userId: currentUserId,
        userName: portfolio.name,
        prestigeLevel: portfolio.prestigeLevel || 0, 
        type: type, // np. "KUPNO", "SPRZEDAŻ", "KUPNO (Krypto)"
        companyId: companyId || "system",
        companyName: companyName,
        amount: amount || 0,
        pricePerShare: finalPrice,
        totalValue: finalTotal,
        timestamp: serverTimestamp(),
        clearedByOwner: false,
        status: "executed", 
        executedPrice: finalPrice 
    };
    
    try {
        await addDoc(collection(db, "historia_transakcji"), transactionData);
    } catch (error) {
        console.error("Błąd zapisu transakcji do logu: ", error);
    }
}

function listenToGlobalHistory() {
    if (unsubscribeGlobalHistory) unsubscribeGlobalHistory();
    
    const historyQuery = query(
        collection(db, "historia_transakcji"), 
        orderBy("timestamp", "desc"), 
        limit(15)
    );
    
    unsubscribeGlobalHistory = onSnapshot(historyQuery, (querySnapshot) => {
        if (!dom.globalHistoryFeed) return;
        dom.globalHistoryFeed.innerHTML = "";
        querySnapshot.forEach((doc) => {
            displayHistoryItem(dom.globalHistoryFeed, doc.data(), true);
        });
    }, (error) => { console.error("Błąd nasłuchu historii globalnej: ", error); });
}

function listenToPersonalHistory(userId) {
    if (unsubscribePersonalHistory) unsubscribePersonalHistory();
    
    const historyQuery = query(
        collection(db, "historia_transakcji"), 
        where("userId", "==", userId),
        where("clearedByOwner", "==", false), 
        orderBy("timestamp", "desc"), 
        limit(15)
    );
    
    unsubscribePersonalHistory = onSnapshot(historyQuery, (querySnapshot) => {
        if (!dom.personalHistoryFeed) return;
        dom.personalHistoryFeed.innerHTML = "";
        if (querySnapshot.empty) {
            dom.personalHistoryFeed.innerHTML = "<p>Brak transakcji.</p>";
        }
        querySnapshot.forEach((doc) => {
            displayHistoryItem(dom.personalHistoryFeed, doc.data(), false);
        });
    }, (error) => { console.error("Błąd nasłuchu historii osobistej: ", error); });
}

// Zaktualizowano o style dla KRYPTO i OBLIGACJI
function displayHistoryItem(feedElement, item, isGlobal) {
    const p = document.createElement("p");
    
    if (isGlobal) {
        const userSpan = document.createElement("span");
        userSpan.className = "h-user clickable-user"; 
        userSpan.dataset.userId = item.userId;
        userSpan.addEventListener("click", () => showUserProfile(item.userId));
        
        const prestigeStars = getPrestigeStars(item.prestigeLevel);
        userSpan.innerHTML = `${item.userName} ${prestigeStars}`;
        p.appendChild(userSpan);
    }
    
    const actionSpan = document.createElement("span");
    actionSpan.textContent = item.type;
    
    // Style dla typów
    if (item.type === "KUPNO") actionSpan.className = "h-action-buy";
    else if (item.type === "SPRZEDAŻ") actionSpan.className = "h-action-sell";
    else if (item.type.includes("KUPNO (Krypto)")) actionSpan.className = "h-action-buy-crypto";
    else if (item.type.includes("SPRZEDAŻ (Krypto)")) actionSpan.className = "h-action-sell-crypto";
    else if (item.type === "WSKAZÓWKA") actionSpan.className = "h-action-tip";
    else if (item.type.startsWith("OBLIGACJA")) actionSpan.className = "h-action-bond";
    
    p.appendChild(actionSpan);
    
    const detailsSpan = document.createElement("span");
    detailsSpan.className = "h-details";
    
    const price = item.executedPrice || item.pricePerShare;
    
    if (item.type === "WSKAZÓWKA") {
         detailsSpan.textContent = item.companyName; // "Zakupiono tajną wskazówkę"
    } else if (item.type.startsWith("OBLIGACJA")) {
        detailsSpan.textContent = item.companyName; // Np. "Obligacja 1-dniowa (5%)"
    } else {
         detailsSpan.textContent = `${item.amount} szt. ${item.companyName} @ ${formatujWalute(price)}`;
    }
    p.appendChild(detailsSpan);
    
    const totalSpan = document.createElement("span");
    totalSpan.className = "h-total";

    if (item.type === "OBLIGACJA (WYKUP)") {
        totalSpan.textContent = `Zysk: ${formatujWalute(item.totalValue)}`;
    } else if (item.type === "OBLIGACJA (ZAKUP)") {
        totalSpan.textContent = `Wkład: ${formatujWalute(item.totalValue)}`;
    } else {
        totalSpan.textContent = `Wartość: ${formatujWalute(item.totalValue)}`;
    }
    
    // Status (dla obligacji oczekujących)
    if (item.status && item.status === "pending") {
        const statusSpan = document.createElement("span");
        statusSpan.className = "h-status-pending";
        if (item.redeemAt && typeof item.redeemAt.toDate === 'function') {
            statusSpan.textContent = ` (Oczekuje do ${item.redeemAt.toDate().toLocaleString('pl-PL')})`;
        } else {
            statusSpan.textContent = ` (Oczekuje)`;
        }
        detailsSpan.appendChild(statusSpan);
    }
    
    p.appendChild(totalSpan);

    feedElement.prepend(p);
}

async function onClearPersonalHistory() {
    if (!currentUserId) return;

    if (!confirm("Czy na pewno chcesz wyczyścić swoją historię transakcji? Zostaną one ukryte z Twojego widoku, ale pozostaną w globalnym rejestrze.")) {
        return;
    }
    
    try {
        const q = query(
            collection(db, "historia_transakcji"), 
            where("userId", "==", currentUserId),
            where("clearedByOwner", "==", false)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("Brak historii do wyczyszczenia.");
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, { clearedByOwner: true }); 
        });

        await batch.commit();
        console.log("Pomyślnie UKRYTO historię osobistą.");
        
    } catch (error) {
        console.error("Błąd podczas ukrywania historii osobistej: ", error);
        showMessage("Błąd podczas ukrywania historii. Sprawdź konsolę.", "error");
    }
}


// --- SEKCJA 4.6: LOGIKA ZLECEŃ LIMIT (ZAKTUALIZOWANA) ---

function onSelectOrderTab(e) {
    const targetType = e.target.dataset.orderType;
    
    dom.orderTabMarket.classList.toggle("active", targetType === "market");
    dom.orderTabLimit.classList.toggle("active", targetType === "limit");
    
    dom.orderMarketContainer.classList.toggle("active", targetType === "market");
    dom.orderLimitContainer.classList.toggle("active", targetType === "limit");
}

function onSelectHistoryTab(e) {
    const targetTab = e.target.dataset.tab;
    
    dom.historyTabButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === targetTab);
    });
    
    document.querySelectorAll("#history-tabs-panel .tab-content").forEach(content => {
        content.classList.toggle("active", content.id === `tab-${targetTab}`);
    });
}

async function onPlaceLimitOrder(e) {
    e.preventDefault();
    if (!currentUserId || !currentCompanyId) return;

    // BLOKADA PRESTIŻU KRYPTO
    if (dom.orderPanel.classList.contains("crypto-locked")) {
        showMessage("Handel kryptowalutami jest dostępny od 3 Poziomu Prestiżu.", "error");
        return;
    }

    const type = dom.limitType.value; // 'buy' lub 'sell'
    const amount = parseInt(dom.limitAmount.value);
    const limitPrice = parseFloat(dom.limitPrice.value);
    const currentPrice = market[currentCompanyId].price;
    const isCrypto = market[currentCompanyId].type === 'crypto';

    // Walidacja
    if (isNaN(amount) || amount <= 0) {
        showMessage("Wpisz poprawną ilość.", "error"); return;
    }
    if (isNaN(limitPrice) || limitPrice <= 0) {
        showMessage("Wpisz poprawną cenę limitu.", "error"); return;
    }

    if (type === 'buy') {
        const cost = amount * limitPrice;
        if (cost > portfolio.cash) {
            showMessage("Nie masz wystarczającej gotówki na pokrycie tego zlecenia.", "error"); return;
        }
        if (limitPrice >= currentPrice) {
            showMessage("Cena kupna limit musi być NIŻSZA niż aktualna cena rynkowa.", "error"); return;
        }
    } else if (type === 'sell') {
        const ownedShares = portfolio.shares[currentCompanyId] || 0;
        if (amount > ownedShares) {
            showMessage("Nie masz tylu akcji na sprzedaż.", "error"); return;
        }
        if (limitPrice <= currentPrice) {
            showMessage("Cena sprzedaży limit musi być WYŻSZA niż aktualna cena rynkowa.", "error"); return;
        }
    }

    // Ustal typ zlecenia (dla logów i bazy danych)
    let orderTypeString;
    if (isCrypto) {
        orderTypeString = (type === 'buy') ? 'KUPNO (Limit, Krypto)' : 'SPRZEDAŻ (Limit, Krypto)';
    } else {
        orderTypeString = (type === 'buy') ? 'KUPNO (Limit)' : 'SPRZEDAŻ (Limit)';
    }

    // Utwórz zlecenie
    try {
        const orderData = {
            userId: currentUserId,
            userName: portfolio.name,
            prestigeLevel: portfolio.prestigeLevel || 0, 
            companyId: currentCompanyId,
            companyName: market[currentCompanyId].name,
            type: orderTypeString, // Zaktualizowany typ
            amount: amount,
            limitPrice: limitPrice,
            status: "pending", 
            timestamp: serverTimestamp()
        };
        
        await addDoc(collection(db, "limit_orders"), orderData);
        
        showMessage(`Zlecenie ${type} na ${amount} szt. @ ${formatujWalute(limitPrice)} złożone!`, "success");
        dom.limitOrderForm.reset();
        dom.limitPrice.value = market[currentCompanyId].price.toFixed(2);

    } catch (error) {
        console.error("Błąd składania zlecenia limit: ", error);
        showMessage("Błąd serwera przy składaniu zlecenia.", "error");
    }
}

function listenToLimitOrders(userId) {
    if (unsubscribeLimitOrders) unsubscribeLimitOrders();

    const ordersQuery = query(
        collection(db, "limit_orders"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
    );

    unsubscribeLimitOrders = onSnapshot(ordersQuery, (querySnapshot) => {
        if (!dom.limitOrdersFeed) return;
        dom.limitOrdersFeed.innerHTML = ""; 

        if (querySnapshot.empty) {
            dom.limitOrdersFeed.innerHTML = "<p>Brak aktywnych lub przeszłych zleceń z limitem.</p>";
            return;
        }

        const table = document.createElement("table");
        table.className = "limit-order-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Typ</th>
                    <th>Spółka</th>
                    <th>Ilość</th>
                    <th>Cena Limit</th>
                    <th>Status</th>
                    <th>Akcja</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector("tbody");

        querySnapshot.forEach((doc) => {
            const order = doc.data();
            const orderId = doc.id;
            
            const tr = document.createElement("tr");
            
            // Zaktualizowana logika klas CSS dla krypto
            let typeClass = "";
            if (order.type.startsWith("KUPNO (Limit, Krypto)")) typeClass = "l-type-buy-crypto";
            else if (order.type.startsWith("SPRZEDAŻ (Limit, Krypto)")) typeClass = "l-type-sell-crypto";
            else if (order.type.startsWith("KUPNO")) typeClass = "l-type-buy";
            else if (order.type.startsWith("SPRZEDAŻ")) typeClass = "l-type-sell";

            const statusClass = `l-status-${order.status}`;

            let actionButton = "";
            if (order.status === "pending") {
                actionButton = `<button class="cancel-order-btn" data-order-id="${orderId}">Anuluj</button>`;
            } else {
                actionButton = `<span>-</span>`;
            }

            tr.innerHTML = `
                <td class="${typeClass}">${order.type}</td>
                <td>${order.companyName}</td>
                <td>${order.amount}</td>
                <td>${formatujWalute(order.limitPrice)}</td>
                <td class="${statusClass}">${order.status}</td>
                <td>${actionButton}</td>
            `;

            tbody.appendChild(tr);
        });

        dom.limitOrdersFeed.appendChild(table);

        dom.limitOrdersFeed.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener("click", onCancelLimitOrder);
        });

    }, (error) => { console.error("Błąd nasłuchu zleceń limit: ", error); });
}

async function onCancelLimitOrder(e) {
    e.target.disabled = true; 
    const orderId = e.target.dataset.orderId;
    if (!orderId) return;

    if (!confirm("Czy na pewno chcesz anulować to zlecenie?")) {
        e.target.disabled = false;
        return;
    }

    try {
        const orderRef = doc(db, "limit_orders", orderId);
        await updateDoc(orderRef, {
            status: "cancelled"
        });
        console.log("Anulowano zlecenie: ", orderId);
    } catch (error) {
        console.error("Błąd anulowania zlecenia: ", error);
        showMessage("Błąd anulowania zlecenia.", "error");
        e.target.disabled = false;
    }
}

async function onClearLimitOrders() {
    if (!currentUserId) return;
    if (!confirm("Czy na pewno chcesz usunąć z widoku wszystkie zlecenia, które zostały wykonane lub anulowane?")) {
        return;
    }

    try {
        const qExecuted = query(
            collection(db, "limit_orders"), 
            where("userId", "==", currentUserId),
            where("status", "==", "executed")
        );
        const qCancelled = query(
            collection(db, "limit_orders"), 
            where("userId", "==", currentUserId),
            where("status", "==", "cancelled")
        );

        const [executedSnapshot, cancelledSnapshot] = await Promise.all([
            getDocs(qExecuted),
            getDocs(qCancelled)
        ]);

        if (executedSnapshot.empty && cancelledSnapshot.empty) {
            showMessage("Brak zleceń do wyczyszczenia.", "info");
            return;
        }

        const batch = writeBatch(db);
        
        executedSnapshot.forEach((doc) => batch.delete(doc.ref));
        cancelledSnapshot.forEach((doc) => batch.delete(doc.ref));

        await batch.commit();
        showMessage("Wyczyszczono zakończone zlecenia.", "success");

    } catch (error) {
        console.error("Błąd podczas czyszczenia zleceń: ", error);
        showMessage("Błąd podczas czyszczenia zleceń. Sprawdź, czy reguły Firestore pozwalają na 'delete'.", "error");
    }
}

// --- SEKCJA 4.7: LOGIKA OBLIGACJI (ZAKTUALIZOWANA O STATYSTYKI) ---

async function onBuyBond(e) {
    e.preventDefault();
    if (!currentUserId) return;

    const amount = parseFloat(dom.bondAmount.value);
    const type = dom.bondType.value; // "1", "2", "3"

    if (isNaN(amount) || amount <= 0) {
        showMessage("Wpisz poprawną kwotę inwestycji.", "error"); return;
    }
    if (amount > portfolio.cash) {
        showMessage("Nie masz wystarczającej gotówki.", "error"); return;
    }

    let days, returnRate, bondName, profit;
    
    if (type === "1") {
        days = 1;
        returnRate = 0.05; // 5%
        bondName = "Obligacja 1-dniowa (5%)";
    } else if (type === "2") {
        days = 2;
        returnRate = 0.10; // 10%
        bondName = "Obligacja 2-dniowa (10%)";
    } else { // type === "3"
        days = 3;
        returnRate = 0.15; // 15%
        bondName = "Obligacja 3-dniowa (15%)";
    }

    profit = amount * returnRate;
    const redeemTimestamp = Date.now() + (days * 24 * 60 * 60 * 1000);
    const redeemAt = Timestamp.fromMillis(redeemTimestamp);

    try {
        const userDocRef = doc(db, "uzytkownicy", currentUserId);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("Nie znaleziono użytkownika");
            
            const data = userDoc.data();
            if (data.cash < amount) throw new Error("Brak środków (ponowna weryfikacja)");

            // 1. Odejmij gotówkę, zaktualizuj statystyki
            const newCash = data.cash - amount;
            const newTotalValue = calculateTotalValue(newCash, data.shares); // Wartość obligacji jest "wirtualna", portfel maleje
            const newZysk = newTotalValue - data.startValue;

            transaction.update(userDocRef, {
                cash: newCash,
                totalValue: newTotalValue,
                zysk: newZysk,
                'stats.bondsPurchased': increment(1) // <-- INKREMENTACJA STATYSTYK
            });

            // 2. Utwórz wpis w historii (ZAKUP)
            const historyRef = doc(collection(db, "historia_transakcji"));
            transaction.set(historyRef, {
                userId: currentUserId,
                userName: data.name,
                prestigeLevel: data.prestigeLevel || 0,
                type: "OBLIGACJA (ZAKUP)",
                companyId: "system",
                companyName: bondName,
                amount: 0,
                pricePerShare: 0,
                totalValue: amount * -1, // Zapisz jako koszt
                timestamp: serverTimestamp(),
                clearedByOwner: false,
                status: "executed"
            });

            // 3. Utwórz aktywną obligację
            const bondRef = doc(collection(db, "active_bonds"));
            transaction.set(bondRef, {
                userId: currentUserId,
                userName: data.name,
                name: bondName,
                investment: amount,
                profit: profit,
                redeemAt: redeemAt,
                status: "pending",
                createdAt: serverTimestamp()
            });
        });

        showMessage(`Zakupiono obligację! Kwota ${formatujWalute(amount)} została zainwestowana.`, "success");
        dom.bondAmount.value = "";

    } catch (error) {
        console.error("Błąd zakupu obligacji: ", error);
        showMessage("Błąd zakupu: " + error.message, "error");
    }
}

function listenToActiveBonds(userId) {
    if (unsubscribeBonds) unsubscribeBonds();

    const bondsQuery = query(
        collection(db, "active_bonds"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
    );

    unsubscribeBonds = onSnapshot(bondsQuery, (querySnapshot) => {
        if (!dom.activeBondsFeed) return;
        dom.activeBondsFeed.innerHTML = "";
        
        const pendingBonds = [];
        const executedBonds = [];
        
        querySnapshot.forEach(doc => {
            const bond = doc.data();
            if (bond.status === 'pending') {
                pendingBonds.push(bond);
            } else {
                executedBonds.push(bond);
            }
        });

        if (pendingBonds.length === 0 && executedBonds.length === 0) {
            dom.activeBondsFeed.innerHTML = "<p>Brak aktywnych obligacji.</p>";
            return;
        }

        // Najpierw wyświetl oczekujące
        pendingBonds.forEach(bond => {
            const data = {
                ...bond,
                type: "OBLIGACJA",
                companyName: bond.name,
                totalValue: bond.investment * -1,
                status: "pending"
            };
            displayHistoryItem(dom.activeBondsFeed, data, false);
        });
        
        // Potem wyświetl zrealizowane (do 5)
        executedBonds.slice(0, 5).forEach(bond => {
            const data = {
                ...bond,
                type: "OBLIGACJA (WYKUP)",
                companyName: bond.name,
                totalValue: bond.profit, // Pokaż zysk
                status: "executed"
            };
            displayHistoryItem(dom.activeBondsFeed, data, false);
        });

    }, (error) => { console.error("Błąd nasłuchu obligacji: ", error); });
}


// --- SEKCJA 5: HANDLERY AKCJI UŻYTKOWNIKA (ZAKTUALIZOWANE) ---

// NOWA: Przełączanie między rynkiem Akcji i Krypto
function onSelectMarketType(e) {
    const targetType = e.target.dataset.marketType; // 'stocks' lub 'crypto'
    if (targetType === currentMarketType) return; // Nic nie rób, jeśli kliknięto aktywną

    currentMarketType = targetType;

    // Zaktualizuj przyciski typu rynku
    dom.marketTypeTabs.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.marketType === targetType);
    });

    // Pokaż/ukryj odpowiednie selektory aktywów
    dom.companySelector.classList.toggle("hidden", targetType !== 'stocks');
    dom.cryptoSelector.classList.toggle("hidden", targetType !== 'crypto');

    // Automatycznie wybierz pierwszy element z listy
    if (targetType === 'stocks') {
        changeCompany("ulanska");
    } else {
        changeCompany("bartcoin");
    }

    // Sprawdź dostęp do handlu
    checkCryptoAccess();
}

function onSelectCompany(e) {
    if (e.target.classList.contains("company-tab")) {
        changeCompany(e.target.dataset.company);
    }
}

function changeCompany(companyId) {
    if (!market[companyId]) return;
    currentCompanyId = companyId;
    
    // Zaktualizuj zakładki akcji
    document.querySelectorAll("#company-selector .company-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.company === companyId);
    });
    // Zaktualizuj zakładki krypto
    document.querySelectorAll("#crypto-selector .company-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.company === companyId);
    });
    
    const companyData = market[currentCompanyId];
    dom.companyName.textContent = companyData.name;
    
    if (chart) {
        if (companyData.history && companyData.history.length > 0) {
            chart.updateSeries([{ data: companyData.history }]);
        } else {
            chart.updateSeries([{ data: [] }]);
        }
    }
    updatePriceUI();
    
    if (dom.limitPrice) {
        dom.limitPrice.value = companyData.price.toFixed(2);
    }

    checkCryptoAccess(); // Sprawdź dostęp przy każdej zmianie
}

// NOWA: Sprawdza, czy gracz ma dostęp do handlu krypto
function checkCryptoAccess() {
    if (!dom || !dom.orderPanel) return;

    const isCrypto = market[currentCompanyId] && market[currentCompanyId].type === 'crypto';
    const hasAccess = portfolio.prestigeLevel >= CRYPTO_PRESTIGE_REQUIREMENT;

    if (isCrypto && !hasAccess) {
        dom.orderPanel.classList.add("crypto-locked");
    } else {
        dom.orderPanel.classList.remove("crypto-locked");
    }
}


function onBuyMax(e) {
    if (!currentCompanyId || !market[currentCompanyId]) return; 
    const currentPrice = market[currentCompanyId].price;
    const availableCash = portfolio.cash;
    if (currentPrice <= 0) { dom.amountInput.value = 0; return; }
    const maxShares = Math.floor(availableCash / currentPrice);
    if (dom.amountInput) dom.amountInput.value = maxShares;
}

function onSellMax(e) {
    if (!currentCompanyId || !portfolio.shares[currentCompanyId]) return; 
    const maxShares = portfolio.shares[currentCompanyId];
    if (dom.amountInput) dom.amountInput.value = maxShares;
}

// ==========================================================
// === NOWA, BEZPIECZNA FUNKCJA KUPNA (z transakcją) ===
// ==========================================================
async function buyShares() {
    // 1. Walidacja po stronie klienta (szybki feedback)
    if (dom.orderPanel.classList.contains("crypto-locked")) {
        showMessage("Handel kryptowalutami jest dostępny od 3 Poziomu Prestiżu.", "error"); 
        return;
    }

    const amount = parseInt(dom.amountInput.value);
    const currentPrice = market[currentCompanyId].price; 
    const isCrypto = market[currentCompanyId].type === 'crypto';
    const companyId = currentCompanyId; // Zapisz do zmiennej, aby była dostępna w transakcji

    if (isNaN(amount) || amount <= 0) { 
        showMessage("Wpisz poprawną ilość.", "error"); return; 
    }
    
    const cost = amount * currentPrice;
    
    // Szybkie sprawdzenie po stronie klienta (zostanie zweryfikowane na serwerze)
    if (cost > portfolio.cash) { 
        showMessage("Brak wystarczającej gotówki.", "error"); return; 
    }

    // 2. Przygotuj dane do logowania (poza transakcją)
    const transactionType = isCrypto ? "KUPNO (Krypto)" : "KUPNO";
    const companyName = market[companyId].name;

    // 3. Uruchom transakcję
    try {
        const userDocRef = doc(db, "uzytkownicy", currentUserId);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("Nie znaleziono użytkownika");
            }
            
            const data = userDoc.data();
            
            // 4. Walidacja po stronie serwera (w transakcji)
            // Sprawdzamy 'data.cash' (z serwera), a nie 'portfolio.cash' (z klienta)
            if (data.cash < cost) {
                throw new Error("Niewystarczająca gotówka (weryfikacja serwera).");
            }

            // 5. Obliczenia wewnątrz transakcji
            const newCash = data.cash - cost;
            const newShares = { ...data.shares };
            newShares[companyId] = (newShares[companyId] || 0) + amount;
            
            // Obliczamy nową wartość portfela na podstawie globalnych cen 'market'
            // To jest OK, bo 'market' jest aktualizowany przez onSnapshot
            const newTotalValue = calculateTotalValue(newCash, newShares); 
            const newZysk = newTotalValue - data.startValue;

            // 6. Aktualizacja portfela i statystyk w transakcji
            transaction.update(userDocRef, { 
                cash: newCash, 
                shares: newShares,
                zysk: newZysk,
                totalValue: newTotalValue,
                'stats.totalTrades': increment(1) // Atomowa inkrementacja statystyk
            });
        });

        // 7. Sukces - logowanie i wiadomość (poza transakcją)
        await logTransaction(transactionType, companyId, amount, currentPrice, cost);
        showMessage(`Kupiono ${amount} akcji ${companyName}`, "success");

    } catch (error) {
        console.error("Błąd transakcji zakupu: ", error);
        if (error.message.includes("Niewystarczająca gotówka")) {
            showMessage("Brak wystarczającej gotówki (ponowna weryfikacja).", "error");
        } else {
            showMessage("Błąd serwera podczas transakcji.", "error");
        }
    }
}

// ==========================================================
// === NOWA, BEZPIECZNA FUNKCJA SPRZEDAŻY (z transakcją) ===
// ==========================================================
async function sellShares() {
    // 1. Walidacja po stronie klienta (szybki feedback)
    if (dom.orderPanel.classList.contains("crypto-locked")) {
        showMessage("Handel kryptowalutami jest dostępny od 3 Poziomu Prestiżu.", "error"); 
        return;
    }

    const amount = parseInt(dom.amountInput.value);
    const currentPrice = market[currentCompanyId].price;
    const isCrypto = market[currentCompanyId].type === 'crypto';
    const companyId = currentCompanyId;

    if (isNaN(amount) || amount <= 0) { 
        showMessage("Wpisz poprawną ilość.", "error"); return; 
    }
    
    // Szybkie sprawdzenie po stronie klienta (zostanie zweryfikowane na serwerze)
    if (amount > (portfolio.shares[companyId] || 0)) { 
        showMessage("Nie masz tylu akcji tej spółki.", "error"); return; 
    }

    const revenue = amount * currentPrice;
    
    // 2. Przygotuj dane do logowania
    const transactionType = isCrypto ? "SPRZEDAŻ (Krypto)" : "SPRZEDAŻ";
    const companyName = market[companyId].name;
    
    // 3. Uruchom transakcję
    try {
        const userDocRef = doc(db, "uzytkownicy", currentUserId);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("Nie znaleziono użytkownika");
            }
            
            const data = userDoc.data();

            // 4. Walidacja po stronie serwera (w transakcji)
            // Sprawdzamy 'data.shares' (z serwera)
            const ownedShares = data.shares[companyId] || 0;
            if (amount > ownedShares) {
                throw new Error("Niewystarczająca ilość akcji (weryfikacja serwera).");
            }

            // 5. Obliczenia wewnątrz transakcji
            const newCash = data.cash + revenue;
            const newShares = { ...data.shares };
            newShares[companyId] -= amount;

            const newTotalValue = calculateTotalValue(newCash, newShares);
            const newZysk = newTotalValue - data.startValue;

            // 6. Aktualizacja portfela i statystyk w transakcji
            transaction.update(userDocRef, { 
                cash: newCash, 
                shares: newShares,
                zysk: newZysk,
                totalValue: newTotalValue,
                'stats.totalTrades': increment(1) // Atomowa inkrementacja statystyk
            });
        });
        
        // 7. Sukces - logowanie i wiadomość (poza transakcją)
        await logTransaction(transactionType, companyId, amount, currentPrice, revenue);
        showMessage(`Sprzedano ${amount} akcji ${companyName}`, "success");
        
    } catch (error) {
        console.error("Błąd transakcji sprzedaży: ", error);
        if (error.message.includes("Niewystarczająca ilość akcji")) {
            showMessage("Nie masz tylu akcji (ponowna weryfikacja).", "error");
        } else {
            showMessage("Błąd serwera podczas transakcji.", "error");
        }
    }
}

// Ta funkcja nie jest już potrzebna, ponieważ logika jest w transakcjach
// async function updatePortfolioInFirebase(dataToUpdate) { ... }

function calculateTotalValue(cash, shares) {
    let sharesValue = 0;
    for (const companyId in shares) {
        if (market[companyId] && market[companyId].price) {
            sharesValue += (shares[companyId] || 0) * market[companyId].price;
        }
    }
    return cash + sharesValue;
}


// --- SEKCJA 6: SYMULATOR RYNKU ---

function initChart() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const chartTheme = (currentTheme === 'light') ? 'light' : 'dark';

    const initialData = market[currentCompanyId].history || [];

    const options = {
        series: [{ data: initialData }],
        chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
        theme: { mode: chartTheme },
        title: { text: 'Historia cen (świece 5-sekundowe)', align: 'left', style: { color: '#a3acb9' } },
        xaxis: { type: 'datetime', labels: { style: { colors: '#a3acb9' } } },
        yaxis: { tooltip: { enabled: true }, labels: { formatter: (val) => val.toFixed(2) + " zł", style: { colors: '#a3acb9' } } },
        plotOptions: { candlestick: { colors: { upward: '#28a745', downward: '#dc3545' } } },
    };
    chart = new ApexCharts(dom.chartContainer, options);
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
            const lastClose = parseFloat(lastCandle.y[3]);
            
            const open = lastClose;
            const close = company.price; 
            const high = Math.max(open, close) + Math.random() * (company.price * 0.01);
            const low = Math.min(open, close) - Math.random() * (company.price * 0.01);

            const newCandle = {
                x: new Date(lastCandle.x.getTime() + 5000),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            };
            
            history.push(newCandle);
            if (history.length > 50) history.shift();
        }
        
        if (chart && market[currentCompanyId].history.length > 0) {
            chart.updateSeries([{
                data: market[currentCompanyId].history
            }]);
        }
    }, 5000);
}


// --- SEKCJA 7: NOWE FUNKCJE (WYKRESY KOŁOWE, MODAL, PRESTIŻ, WSKAZÓWKI) ---

function getChartTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    return (currentTheme === 'light') ? 'light' : 'dark';
}

function initPortfolioChart() {
    const options = {
        series: [0], 
        labels: ['Gotówka'],
        chart: {
            type: 'donut',
            height: 300
        },
        colors: CHART_COLORS,
        theme: { mode: getChartTheme() },
        legend: {
            position: 'bottom',
            labels: { colors: 'var(--text-muted)' }
        },
        dataLabels: { enabled: false },
        tooltip: {
            y: {
                formatter: (val) => formatujWalute(val)
            }
        },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            color: 'var(--text-muted)'
                        },
                        value: {
                            show: true,
                            formatter: (val) => formatujWalute(val),
                            color: 'var(--text-color)'
                        },
                        total: {
                            show: true,
                            label: 'Portfel', 
                            formatter: (w) => {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return formatujWalute(total);
                            },
                            color: 'var(--text-color)'
                        }
                    }
                }
            }
        }
    };

    portfolioChart = new ApexCharts(dom.portfolioChartContainer, options);
    portfolioChart.render();
}

function initModalPortfolioChart() {
    const options = {
        series: [0], 
        labels: ['Gotówka'],
        chart: {
            type: 'donut',
            height: 250
        },
        colors: CHART_COLORS, 
        theme: { mode: getChartTheme() },
        legend: {
            position: 'bottom',
            labels: { colors: 'var(--text-muted)' }
        },
        dataLabels: { enabled: false },
        tooltip: {
            y: {
                formatter: (val) => formatujWalute(val)
            }
        },
         plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Portfel',
                            formatter: (w) => {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return formatujWalute(total);
                            },
                            color: 'var(--text-color)'
                        }
                    }
                }
            }
        }
    };
    modalPortfolioChart = new ApexCharts(dom.modalPortfolioChartContainer, options);
    modalPortfolioChart.render();
}

// ZAKTUALIZOWANE O STATYSTYKI
async function showUserProfile(userId) {
    if (!userId) return;
    console.log("Ładowanie profilu dla:", userId);

    try {
        const userDocRef = doc(db, "uzytkownicy", userId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            console.error("Nie znaleziono użytkownika!");
            return;
        }

        const userData = userDoc.data();
        const prestigeLevel = userData.prestigeLevel || 0;
        const prestigeStars = getPrestigeStars(prestigeLevel);
        const stats = userData.stats || { totalTrades: 0, tipsPurchased: 0, bondsPurchased: 0 }; // Domyślne statystyki
        
        dom.modalUsername.innerHTML = `${userData.name} ${prestigeStars}`;
        dom.modalCash.textContent = formatujWalute(userData.cash);
        dom.modalTotalValue.textContent = formatujWalute(userData.totalValue);
        
        const profit = userData.totalValue - userData.startValue;
        dom.modalTotalProfit.textContent = formatujWalute(profit);
        if (profit > 0) {
            dom.modalTotalProfit.style.color = "var(--green)";
            dom.modalTotalProfit.dataset.profitSign = "positive";
        } else if (profit < 0) {
            dom.modalTotalProfit.style.color = "var(--red)";
            dom.modalTotalProfit.dataset.profitSign = "negative";
        } else {
            dom.modalTotalProfit.style.color = "var(--text-muted)";
            dom.modalTotalProfit.dataset.profitSign = "neutral";
        }

        dom.modalJoinDate.textContent = userData.joinDate.toDate().toLocaleDateString('pl-PL');

        // Wyświetl NOWE STATYSTYKI
        dom.modalTotalTrades.textContent = stats.totalTrades;
        dom.modalTipsPurchased.textContent = stats.tipsPurchased;
        dom.modalBondsPurchased.textContent = stats.bondsPurchased;

        if (userId === currentUserId) {
            dom.prestigeInfo.style.display = 'flex';
            dom.prestigeNextGoal.style.display = 'block';
            dom.prestigeButton.style.display = 'block';
            updatePrestigeButton(userData.totalValue, prestigeLevel);
        } else {
            dom.prestigeInfo.style.display = 'none';
            dom.prestigeNextGoal.style.display = 'none';
            dom.prestigeButton.style.display = 'none';
        }
        dom.modalPrestigeLevel.textContent = `${prestigeLevel} ${prestigeStars}`;


        dom.modalSharesList.innerHTML = "";
        const modalChartSeries = [userData.cash]; 
        const modalChartLabels = ['Gotówka'];
        let sharesValue = 0; 
        let hasShares = false;

        // ZAKTUALIZOWANA PĘTLA O KRYPTO
        for (const companyId of COMPANY_ORDER) { 
            const amount = userData.shares[companyId] || 0;
            if (amount > 0) {
                hasShares = true;
                const companyName = market[companyId] ? market[companyId].name : companyId;
                const p = document.createElement("p");
                p.innerHTML = `${companyName} <strong>${amount} szt.</strong>`;
                dom.modalSharesList.appendChild(p);
                
                const price = market[companyId] ? market[companyId].price : 0;
                const value = amount * price;
                sharesValue += value;
                
                modalChartSeries.push(value);
                modalChartLabels.push(companyName);
            }
        }

        if (!hasShares) {
            dom.modalSharesList.innerHTML = "<p>Brak posiadanych akcji.</p>";
        }

        if (!modalPortfolioChart) {
            initModalPortfolioChart();
        }
        
        modalPortfolioChart.updateOptions({
            series: modalChartSeries,
            labels: modalChartLabels
        });

        dom.modalOverlay.classList.remove("hidden");

    } catch (error) {
        console.error("Błąd ładowania profilu użytkownika: ", error);
    }
}

// Zaktualizowano o Krypto
async function onPrestigeReset() {
    const currentLevel = portfolio.prestigeLevel;
    if (currentLevel >= PRESTIGE_REQUIREMENTS.length) return; 

    const nextGoal = PRESTIGE_REQUIREMENTS[currentLevel];
    if (portfolio.totalValue < nextGoal) {
        showMessage("Nie masz wystarczającej wartości portfela, aby awansować.", "error");
        return;
    }

    if (!confirm(`Czy na pewno chcesz awansować na Poziom Prestiżu ${currentLevel + 1}? Spowoduje to zresetowanie Twojego portfela (1000 zł, 0 akcji), ale zachowasz swój poziom prestiżu i zniżki.`)) {
        return;
    }

    try {
        const userDocRef = doc(db, "uzytkownicy", currentUserId);
        
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("Nie znaleziono użytkownika!");
            }

            const data = userDoc.data();
            const currentLevel = data.prestigeLevel || 0;
            const nextLevel = currentLevel + 1;
            
            if (currentLevel >= PRESTIGE_REQUIREMENTS.length) {
                 throw new Error("Osiągnięto już maksymalny poziom.");
            }
            const nextGoal = PRESTIGE_REQUIREMENTS[currentLevel];
            if (data.totalValue < nextGoal) {
                throw new Error("Niewystarczająca wartość portfela.");
            }

            // Statystyki NIE SĄ resetowane
            transaction.update(userDocRef, {
                cash: 1000.00,
                shares: { 
                    ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0,
                    cosmosanit: 0, gigachat: 0, bimbercfd: 0,
                    bartcoin: 0, igirium: 0, kacoin: 0
                },
                startValue: 1000.00,
                zysk: 0.00,
                totalValue: 1000.00,
                prestigeLevel: nextLevel 
            });
        });
        
        showMessage(`AWANS! Witaj na Poziomie ${currentLevel + 1}!`, "success");
        if (dom.modalOverlay) dom.modalOverlay.classList.add("hidden");

    } catch (error) {
        console.error("Błąd resetowania prestiżu: ", error);
        showMessage("Błąd resetu: " + error.message, "error");
    }
}

// ZMODYFIKOWANA FUNKCJA: KUPNO WSKAZÓWKI (ze statystykami)
async function onBuyTip() {
    const currentCost = TIP_COSTS[portfolio.prestigeLevel];
    
    if (portfolio.cash < currentCost) {
        showMessage(`Nie masz wystarczającej gotówki. Wskazówka kosztuje ${formatujWalute(currentCost)}`, "error");
        return;
    }
    
    if (!confirm(`Czy na pewno chcesz wydać ${formatujWalute(currentCost)} na wskazówkę? Masz 65% szans, że będzie prawdziwa (spełni się za 2-10 min) i 35% szans, że będzie fałszywa.`)) {
        return;
    }

    // 1. Wygeneruj dane wskazówki PRZED transakcją
    const tipData = generateTipData(); // Nowa funkcja

    try {
        const userDocRef = doc(db, "uzytkownicy", currentUserId);

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("Nie znaleziono użytkownika");

            const data = userDoc.data();
            const currentCost = TIP_COSTS[data.prestigeLevel || 0];
            if (data.cash < currentCost) throw new Error("Brak środków");

            // 2. Pobierz pieniądze i zaktualizuj statystyki
            const newCash = data.cash - currentCost;
            const newTotalValue = calculateTotalValue(newCash, data.shares);
            const newZysk = newTotalValue - data.startValue;

            transaction.update(userDocRef, {
                cash: newCash,
                totalValue: newTotalValue,
                zysk: newZysk,
                'stats.tipsPurchased': increment(1) // <-- INKREMENTACJA STATYSTYK
            });
            
            // 3. Zapisz wskazówkę w historii personalnej (zawsze)
            const tipTransactionData = {
                userId: currentUserId,
                userName: data.name,
                prestigeLevel: data.prestigeLevel || 0,
                type: "WSKAZÓWKA",
                companyId: tipData.companyId, // Zapisz, której spółki dotyczy
                companyName: "Zakupiono tajną wskazówkę", 
                amount: 0,
                pricePerShare: 0,
                totalValue: currentCost * -1, // Zapisz koszt
                timestamp: serverTimestamp(),
                clearedByOwner: false,
                status: "executed", 
                executedPrice: 0 
            };
            const historyCol = collection(db, "historia_transakcji");
            transaction.set(doc(historyCol), tipTransactionData);

            // 4. Jeśli wskazówka jest "real", zapisz ją w `pending_tips`
            if (tipData.isReal) {
                const pendingTipRef = doc(collection(db, "pending_tips"));
                transaction.set(pendingTipRef, {
                    userId: currentUserId,
                    companyId: tipData.companyId,
                    impactType: tipData.impactType,
                    executeAt: tipData.executeAt // Ustaw czas wywołania
                });
            }
        });

        // 5. Pokaż powiadomienie (poza transakcją) - TUTAJ JEST TAJNA TREŚĆ
        showNotification(tipData.message, 'tip');
        showMessage(`Zakupiono wskazówkę za ${formatujWalute(currentCost)}! Sprawdź "Moją Historię".`, "success");
        
    } catch (error) {
        console.error("Błąd zakupu wskazówki: ", error);
        showMessage("Błąd zakupu: " + error.message, "error");
    }
}

// ZAKTUALIZOWANA O KRYPTO
function generateTipData() {
    const isReal = Math.random() < 0.65; // 65% szans
    const isPositive = Math.random() > 0.5;
    
    // Teraz losuje ze wszystkich aktywów (akcje + krypto)
    const companyIds = Object.keys(market);
    const companyId = companyIds[Math.floor(Math.random() * companyIds.length)];
    const companyName = market[companyId].name;

    let message = "";
    let executeAt = null;

    if (isReal) {
        // Prawdziwa: Ustaw czas wykonania (2 do 10 minut)
        const minMs = 2 * 60 * 1000; // 2 minuty
        const maxMs = 10 * 60 * 1000; // 10 minut
        const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        executeAt = Timestamp.fromMillis(Date.now() + randomMs);
        
        if (isPositive) {
            message = `[PRAWDZIWE INFO]: Słyszałem, że ${companyName} ma niedługo wystrzelić...`;
        } else {
            message = `[PRAWDZIWE INFO]: Lepiej pozbądź się ${companyName}, nadchodzą kłopoty.`;
        }
    } else {
        // Fałszywka: Losuje spółkę, ale nie ustawia czasu
        const falsePositive = Math.random() > 0.5;
        if (falsePositive) {
            message = `[FAŁSZYWKA]: Kumpel mówił, że ${companyName} to pewniak na wzrost. (Czy na pewno?)`;
        } else {
            message = `[FAŁSZYWKA]: Podobno ${companyName} ma zaraz zbankrutować... (Lepiej to sprawdź).`;
        }
    }

    return {
        isReal: isReal,
        companyId: companyId,
        impactType: isPositive ? 'positive' : 'negative',
        message: message,
        executeAt: executeAt // Będzie null dla fałszywek
    };
}

// --- SEKCJA 8: AKTUALIZACJA INTERFEJSU (UI) (ZAKTUALIZOWANA) ---

function formatujWalute(liczba) {
    if (typeof liczba !== 'number') {
        liczba = 0;
    }
    const formatter = new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 2
    });
    return formatter.format(liczba);
}

function getPrestigeStars(level, type = 'normal') {
    if (!level || level === 0) return '';
    const starIcon = '⭐️';
    let starsHtml = '';
    
    if (type === 'chat') {
         starsHtml = `<span class="prestige-stars">(${starIcon.repeat(level)})</span>`;
    } else {
         starsHtml = `<span class="prestige-stars">${starIcon.repeat(level)}</span>`;
    }
    return starsHtml;
}

function updateTickerTape() {
    if (!dom.tickerContent) return;

    let tickerHTML = "";
    // Zaktualizowana kolejność o krypto (używa COMPANY_ORDER)
    const companyOrder = [
        "ulanska", "rychbud", "igicorp", "brzozair", 
        "cosmosanit", "gigachat", "bimbercfd",
        "bartcoin", "igirium", "kacoin"
    ];

    for (const companyId of companyOrder) {
        const company = market[companyId];
        if (!company || !company.price || !company.previousPrice) continue;

        const name = companyAbbreviations[companyId] || "???";
        const price = company.price;
        const prevPrice = company.previousPrice;
        
        let percentChange = 0;
        if (prevPrice > 0 && price > 0) {
            percentChange = ((price - prevPrice) / prevPrice) * 100;
        }

        let changeClass = "";
        let sign = "";
        if (percentChange > 0.01) { 
            changeClass = "ticker-up";
            sign = "+";
        } else if (percentChange < -0.01) {
            changeClass = "ticker-down";
            sign = ""; 
        }

        // Krypto dostaje specjalny styl w tickerze
        if (company.type === 'crypto') {
            changeClass += " ticker-crypto";
            tickerHTML += `
            <span class="ticker-item ticker-item-crypto">
                ${name}
                <strong>${price.toFixed(2)} zł</strong>
                <span class="${changeClass}">${sign}${percentChange.toFixed(2)}%</span>
            </span>
            `;
        } else {
             tickerHTML += `
            <span class="ticker-item">
                ${name}
                <strong>${price.toFixed(2)} zł</strong>
                <span class="${changeClass}">${sign}${percentChange.toFixed(2)}%</span>
            </span>
            `;
        }
    }

    dom.tickerContent.innerHTML = tickerHTML + tickerHTML;
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
    const redClass = 'flash-red'; // Czerwony jest zawsze czerwony

    if (!isNaN(oldPrice) && company.price > oldPrice) {
        dom.stockPrice.classList.remove(redClass, greenClass); 
        dom.stockPrice.classList.add(greenClass); 
    } else if (!isNaN(oldPrice) && company.price < oldPrice) {
        dom.stockPrice.classList.remove(greenClass, redClass);
        dom.stockPrice.classList.add(redClass);
    }
    dom.stockPrice.addEventListener('animationend', () => {
        dom.stockPrice.classList.remove(greenClass, redClass);
    }, { once: true }); 
}

// Zaktualizowano o Krypto
function updatePortfolioUI() {
    if (!dom || !dom.username) return;
    
    const prestigeLevel = portfolio.prestigeLevel || 0;
    const prestigeStars = getPrestigeStars(prestigeLevel);
    dom.username.innerHTML = `${portfolio.name} ${prestigeStars}`;
    
    const currentTipCost = TIP_COSTS[prestigeLevel];
    dom.tipCost.textContent = formatujWalute(currentTipCost);
    
    dom.buyTipButton.disabled = portfolio.cash < currentTipCost;

    dom.cash.textContent = formatujWalute(portfolio.cash);
    
    dom.sharesList.innerHTML = `
        <p>Ułańska Dev: <strong id="shares-ulanska">${portfolio.shares.ulanska || 0}</strong> szt.</p>
        <p>RychBud: <strong id="shares-rychbud">${portfolio.shares.rychbud || 0}</strong> szt.</p>
        <p>IgiCorp: <strong id="shares-igicorp">${portfolio.shares.igicorp || 0}</strong> szt.</p>
        <p>BrzozAir: <strong id="shares-brzozair">${portfolio.shares.brzozair || 0}</strong> szt.</p>
        <p>Cosmosanit: <strong id="shares-cosmosanit">${portfolio.shares.cosmosanit || 0}</strong> szt.</p>
        <p>Gigachat GPT: <strong id="shares-gigachat">${portfolio.shares.gigachat || 0}</strong> szt.</p>
        <p>Bimber.cfd: <strong id="shares-bimbercfd">${portfolio.shares.bimbercfd || 0}</strong> szt.</p>
        <hr class="crypto-hr">
        <p>Bartcoin: <strong id="shares-bartcoin">${portfolio.shares.bartcoin || 0}</strong> szt.</p>
        <p>Igirium: <strong id="shares-igirium">${portfolio.shares.igirium || 0}</strong> szt.</p>
        <p>Kacoin: <strong id="shares-kacoin">${portfolio.shares.kacoin || 0}</strong> szt.</p>
    `;

    const oldTotalValue = portfolio.totalValue;
    
    let sharesValue = 0;
    const chartSeries = [portfolio.cash]; 
    const chartLabels = ['Gotówka'];

    // Pętla używa teraz COMPANY_ORDER, która zawiera krypto
    for (const companyId of COMPANY_ORDER) {
        const amount = portfolio.shares[companyId] || 0;
        if (amount > 0) {
            const price = market[companyId] ? market[companyId].price : 0;
            const value = amount * price;
            sharesValue += value; 
            
            chartSeries.push(value);
            chartLabels.push(market[companyId].name);
        }
    }
    
    const totalValue = portfolio.cash + sharesValue;
    const totalProfit = totalValue - portfolio.startValue;

    portfolio.totalValue = totalValue; 
    portfolio.zysk = totalProfit;

    if (!portfolioChart) {
        initPortfolioChart();
    }
    // Aktualizuj wykres kołowy (kolory są dopasowane przez COMPANY_ORDER)
    portfolioChart.updateOptions({
        series: chartSeries,
        labels: chartLabels
    });

    dom.totalValue.textContent = formatujWalute(totalValue);
    dom.totalProfit.textContent = formatujWalute(totalProfit);
    
    if (oldTotalValue && totalValue > oldTotalValue) {
        dom.totalValue.classList.remove('flash-red', 'flash-accent');
        dom.totalValue.classList.add('flash-green');
    } else if (oldTotalValue && totalValue < oldTotalValue) {
        dom.totalValue.classList.remove('flash-green', 'flash-accent');
        dom.totalValue.classList.add('flash-red');
    }
    dom.totalValue.addEventListener('animationend', () => {
        dom.totalValue.classList.remove('flash-green', 'flash-red', 'flash-accent');
    }, { once: true });
    
    if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
    else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
    else dom.totalProfit.style.color = "var(--text-muted)";
    
    if (dom.modalOverlay && !dom.modalOverlay.classList.contains("hidden")) {
         updatePrestigeButton(totalValue, prestigeLevel);
    }
}

function updatePrestigeButton(totalValue, prestigeLevel) {
    if (prestigeLevel >= PRESTIGE_REQUIREMENTS.length) {
        dom.prestigeButton.textContent = "Osiągnięto Max Poziom Prestiżu";
        dom.prestigeButton.disabled = true;
        dom.prestigeNextGoal.textContent = "Gratulacje!";
    } else {
        const nextGoal = PRESTIGE_REQUIREMENTS[prestigeLevel];
        const canPrestige = totalValue >= nextGoal;
        
        dom.prestigeButton.disabled = !canPrestige;
        dom.prestigeButton.textContent = `Awansuj na Poziom ${prestigeLevel + 1}`;
        dom.prestigeNextGoal.textContent = `Cel: ${formatujWalute(nextGoal)}`;
        
        if (!canPrestige) {
            dom.prestigeButton.textContent = `Brakuje ${formatujWalute(nextGoal - totalValue)}`;
        }
    }
}


function showMessage(message, type) {
    if (!dom || !dom.messageBox) return;
    
    dom.messageBox.textContent = message;
    dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
    
    if (dom.amountInput) dom.amountInput.value = "";
    
    setTimeout(() => {
        if (dom.messageBox.textContent === message) {
            dom.messageBox.textContent = "";
        }
    }, 3000);

    if (audioUnlocked) {
        if (type === "error" && dom.audioError) {
            dom.audioError.currentTime = 0; 
            dom.audioError.play().catch(e => console.log("Błąd odtwarzania audio 'error'"));
        } else if (type === "success" && dom.audioKaching) {
            dom.audioKaching.currentTime = 0; 
            dom.audioKaching.play().catch(e => console.log("Błąd odtwarzania audio 'kaching'"));
        }
    }
}

function displayNewRumor(rumor) {
    if (!dom || !dom.rumorsFeed) return;
    const p = document.createElement("p");
    
    let prefix = "";
    if (rumor.companyId && market[rumor.companyId]) {
        prefix = `[${market[rumor.companyId].name}] `;
    }
    
    if (rumor.sentiment === "positive") p.style.color = "var(--green)";
    else if (rumor.sentiment === "negative") p.style.color = "var(--red)";
    
    // Krypto plotki mają specjalny kolor
    if (market[rumor.companyId] && market[rumor.companyId].type === 'crypto') {
        if (rumor.sentiment === "positive") p.style.color = "var(--accent-color)";
    }
    
    p.textContent = prefix + rumor.text; 
    const authorSpan = document.createElement("span");
    authorSpan.style.color = "var(--text-muted)";
    authorSpan.style.fontStyle = "normal";
    
    const prestigeStars = getPrestigeStars(rumor.prestigeLevel);
    authorSpan.innerHTML = ` - ${rumor.authorName || "Anonim"} ${prestigeStars}`;
    
    if (rumor.authorId) {
        authorSpan.classList.add("clickable-user");
        authorSpan.dataset.userId = rumor.authorId; 
        authorSpan.addEventListener("click", () => showUserProfile(rumor.authorId));
    }
    
    p.appendChild(authorSpan);
    dom.rumorsFeed.prepend(p);
}
