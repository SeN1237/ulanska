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
    getDocs, writeBatch
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

let market = {
    ulanska:    { name: "Ułańska Dev",   price: 1, previousPrice: null, history: [] },
    brzozair:   { name: "BrzozAir",      price: 1, previousPrice: null, history: [] },
    igicorp:    { name: "IgiCorp",       price: 1, previousPrice: null, history: [] },
    rychbud:    { name: "RychBud",       price: 1, previousPrice: null, history: [] },
    cosmosanit: { name: "Cosmosanit",    price: 100, previousPrice: null, history: [] },
    gigachat:   { name: "Gigachat GPT",  price: 500, previousPrice: null, history: [] },
    bimbercfd:  { name: "Bimber.cfd",    price: 20,  previousPrice: null, history: [] }
};

const companyAbbreviations = {
    ulanska: "UŁDEV",
    rychbud: "RBUD",
    igicorp: "ICORP",
    brzozair: "BAIR",
    cosmosanit: "COSIT",
    gigachat: "GIPT",
    bimbercfd: "BIMBER"
};

let currentCompanyId = "ulanska";

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
        bimbercfd: 0
    },
    startValue: 100,
    zysk: 0,
    totalValue: 0
};

let chart = null;
let currentUserId = null;
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

let dom = {};


// ====================================================================
// NASŁUCHIWACZ CEN (onSnapshot)
// ====================================================================
const cenyDocRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyDocRef, (docSnap) => {
    
    if (docSnap.exists()) {
        const aktualneCeny = docSnap.data();
        
        for (const companyId in market) {
            if (aktualneCeny[companyId]) {
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
    
    if (chart) {
        const newChartTheme = (theme === 'light') ? 'light' : 'dark';
        chart.updateOptions({
            theme: {
                mode: newChartTheme
            }
        });
    }
}


// --- SEKCJA 2: GŁÓWNY PUNKT WEJŚCIA (ZAKTUALIZOWANY) ---
document.addEventListener("DOMContentLoaded", () => {
    
    applySavedTheme();

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
        cash: document.getElementById("cash"),
        totalValue: document.getElementById("total-value"),
        totalProfit: document.getElementById("total-profit"),
        stockPrice: document.getElementById("stock-price"),
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        buyMaxButton: document.getElementById("buy-max-button"), 
        sellMaxButton: document.getElementById("sell-max-button"), 
        messageBox: document.getElementById("message-box"),
        chartContainer: document.getElementById("chart-container"),
        rumorForm: document.getElementById("rumor-form"),
        rumorInput: document.getElementById("rumor-input"),
        rumorsFeed: document.getElementById("rumors-feed"),
        newsFeed: document.getElementById("news-feed"), 
        leaderboardList: document.getElementById("leaderboard-list"),
        companySelector: document.getElementById("company-selector"),
        companyName: document.getElementById("company-name"),
        sharesList: document.getElementById("shares-list"),

        chatForm: document.getElementById("chat-form"),
        chatInput: document.getElementById("chat-input"),
        chatFeed: document.getElementById("chat-feed"),
        
        themeSelect: document.getElementById("theme-select"),

        globalHistoryFeed: document.getElementById("global-history-feed"),
        personalHistoryFeed: document.getElementById("personal-history-feed"),
        clearHistoryButton: document.getElementById("clear-history-button"),

        audioKaching: document.getElementById("audio-kaching"),
        audioError: document.getElementById("audio-error"),
        audioNews: document.getElementById("audio-news"),

        tickerContent: document.getElementById("ticker-content"),
        notificationContainer: document.getElementById("notification-container")
    };

    // 2. Podepnij GŁÓWNE listenery
    dom.registerForm.addEventListener("submit", onRegister);
    dom.loginForm.addEventListener("submit", onLogin);
    dom.logoutButton.addEventListener("click", onLogout);
    dom.companySelector.addEventListener("click", onSelectCompany);
    dom.buyButton.addEventListener("click", buyShares);
    dom.sellButton.addEventListener("click", sellShares);
    dom.buyMaxButton.addEventListener("click", onBuyMax); 
    dom.sellMaxButton.addEventListener("click", onSellMax); 
    dom.rumorForm.addEventListener("submit", onPostRumor);
    dom.chatForm.addEventListener("submit", onSendMessage);
    dom.resetPasswordLink.addEventListener("click", onResetPassword);
    dom.themeSelect.addEventListener("change", onChangeTheme);
    dom.clearHistoryButton.addEventListener("click", onClearPersonalHistory);

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


// === Funkcja do odblokowania audio przy pierwszej interakcji ===
function unlockAudioOnce() {
    if (audioUnlocked || !dom.simulatorContainer) return;

    const unlock = () => {
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
        document.body.removeEventListener('click', unlock);
        document.body.removeEventListener('keydown', unlock);
    };

    document.body.addEventListener('click', unlock, { once: true });
    document.body.addEventListener('keydown', unlock, { once: true });
}


// === ZAKTUALIZOWANY AUTH LISTENER ===
function startAuthListener() {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUserId = user.uid;
            dom.simulatorContainer.classList.remove("hidden");
            dom.authContainer.classList.add("hidden");
            
            unlockAudioOnce();

            listenToPortfolioData(currentUserId);
            listenToRumors();
            listenToMarketNews(); 
            listenToLeaderboard();
            listenToChat(); 
            listenToGlobalHistory();
            listenToPersonalHistory(currentUserId);
            
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
            
            if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
            
            chartHasStarted = false; 
            chart = null;            
            initialNewsLoaded = false; 
            initialChatLoaded = false; 
            audioUnlocked = false; 
            
            portfolio = { 
                name: "Gość", 
                cash: 1000, 
                shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0, cosmosanit: 0, gigachat: 0, bimbercfd: 0 }, 
                startValue: 1000, 
                zysk: 0, 
                totalValue: 1000 
            };
            
            for (const companyId in market) {
                market[companyId].history = [];
                market[companyId].previousPrice = null;
            }
            
            updatePortfolioUI();
        }
    });
}


// --- SEKCJA 3: HANDLERY AUTENTYKACJI ---

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
            bimbercfd: 0
        },
        startValue: 1000.00,
        zysk: 0.00,
        totalValue: 1000.00,
        joinDate: Timestamp.fromDate(new Date())
    };
    const userDocRef = doc(db, "uzytkownicy", userId);
    await setDoc(userDocRef, userPortfolio);
}

async function onRegister(e) {
    e.preventDefault();
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


// --- SEKCJA 4: LOGIKA BAZY DANYCH ---

// --- NOWA FUNKCJA: Pokaż powiadomienie "Toast" ---
function showNotification(message, type, impactType = null) {
    if (!dom.notificationContainer) return;

    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.classList.add(`toast-${type}`); // .toast-chat or .toast-news
    
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
    } else { // 'chat'
        // W wiadomości czatu HTML jest już sformatowany przez 'displayChatMessage'
        toast.innerHTML = `<strong class="toast-chat-header">Nowa Wiadomość:</strong><p>${message}</p>`;
    }

    dom.notificationContainer.appendChild(toast);

    // Zacznij znikanie po 5 sekundach
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        // Usuń z DOM po zakończeniu animacji znikania (0.5s)
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500);
    }, 5000); // 5-sekundowy czas wyświetlania
}


function listenToPortfolioData(userId) {
    if (unsubscribePortfolio) unsubscribePortfolio();
    const userDocRef = doc(db, "uzytkownicy", userId);
    unsubscribePortfolio = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            portfolio.name = data.name;
            portfolio.cash = data.cash;
            portfolio.shares = data.shares || { 
                ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0, 
                cosmosanit: 0, gigachat: 0, bimbercfd: 0 
            };
            portfolio.startValue = data.startValue;
            updatePortfolioUI();
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
            displayNewRumor(rumor.text, rumor.authorName, rumor.sentiment, rumor.companyId);
        });
    }, (error) => { console.error("Błąd nasłuchu plotek: ", error); });
}

function listenToMarketNews() {
    if (unsubscribeNews) unsubscribeNews();
    const newsQuery = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(5));
    
    unsubscribeNews = onSnapshot(newsQuery, (querySnapshot) => {
        if (!dom.newsFeed) return;
        
        querySnapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const news = change.doc.data();
                displayMarketNews(news.text, news.impactType); // Aktualizuj panel

                // Jeśli to nie jest pierwszy news ładowany na starcie, pokaż powiadomienie
                if (initialNewsLoaded) {
                    showNotification(news.text, 'news', news.impactType);
                }
            }
        });
        
        // --- POPRAWKA: Usunięto stąd odtwarzanie dźwięku ---

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
            // Pokaż powiadomienie tylko dla NOWYCH wiadomości
            // ORAZ jeśli nie jest to nasza własna wiadomość
            if (change.type === "added" && msg.authorId !== currentUserId && initialChatLoaded) {
                const notifMessage = `<strong>${msg.authorName}</strong>: ${msg.text}`;
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
    p.appendChild(strong);
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
    try {
        await addDoc(collection(db, "plotki"), {
            text: rumorText,
            authorId: currentUserId,
            authorName: portfolio.name,
            timestamp: Timestamp.fromDate(new Date()),
            companyId: companyId,
            sentiment: sentiment
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
            nameSpan.textContent = `${rank}. ${user.name}`;
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

// --- SEKCJA 4.5: LOGIKA HISTORII TRANSAKCJI ---

async function logTransaction(type, companyId, amount, pricePerShare) {
    if (!currentUserId || !portfolio.name || !market[companyId]) {
        console.error("Nie można zalogować transakcji: brak danych.");
        return;
    }
    
    const transactionData = {
        userId: currentUserId,
        userName: portfolio.name,
        type: type,
        companyId: companyId,
        companyName: market[companyId].name,
        amount: amount,
        pricePerShare: pricePerShare,
        totalValue: amount * pricePerShare,
        timestamp: serverTimestamp(),
        clearedByOwner: false 
    };
    
    try {
        await addDoc(collection(db, "historia_transakcji"), transactionData);
    } catch (error) {
        console.error("Błąd zapisu transakcji do logu: ", error);
    }
}

function listenToGlobalHistory() {
    if (unsubscribeGlobalHistory) unsubscribeGlobalHistory();
    
    const historyQuery = query(collection(db, "historia_transakcji"), orderBy("timestamp", "desc"), limit(15));
    
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

function displayHistoryItem(feedElement, item, isGlobal) {
    const p = document.createElement("p");
    
    if (isGlobal) {
        const userSpan = document.createElement("span");
        userSpan.className = "h-user";
        userSpan.textContent = item.userName;
        p.appendChild(userSpan);
    }
    
    const actionSpan = document.createElement("span");
    actionSpan.textContent = item.type;
    actionSpan.className = (item.type === "KUPNO") ? "h-action-buy" : "h-action-sell";
    p.appendChild(actionSpan);
    
    const detailsSpan = document.createElement("span");
    detailsSpan.className = "h-details";
    detailsSpan.textContent = `${item.amount} szt. ${item.companyName} @ ${formatujWalute(item.pricePerShare)}`;
    p.appendChild(detailsSpan);
    
    const totalSpan = document.createElement("span");
    totalSpan.className = "h-total";
    totalSpan.textContent = `Wartość: ${formatujWalute(item.totalValue)}`;
    p.appendChild(totalSpan);

    feedElement.prepend(p);
}

async function onClearPersonalHistory() {
    if (!currentUserId) return;

    if (!confirm("Czy na pewno chcesz wyczyścić swoją historię transakcji? Zostaną one ukryte z Twojego widoku, ale pozostaną w globalnym rejestrze.")) {
        return;
    }

    console.log("Rozpoczynam UKRYWANIE historii dla: ", currentUserId);
    
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


// --- SEKCJA 5: HANDLERY AKCJI UŻYTKOWNIKA ---

function onSelectCompany(e) {
    if (e.target.classList.contains("company-tab")) {
        changeCompany(e.target.dataset.company);
    }
}

function changeCompany(companyId) {
    if (!market[companyId]) return;
    currentCompanyId = companyId;
    
    document.querySelectorAll(".company-tab").forEach(tab => {
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

async function buyShares() {
    const amount = parseInt(dom.amountInput.value);
    const currentPrice = market[currentCompanyId].price; 
    if (isNaN(amount) || amount <= 0) { showMessage("Wpisz poprawną ilość.", "error"); return; }
    const cost = amount * currentPrice;
    if (cost > portfolio.cash) { showMessage("Brak wystarczającej gotówki.", "error"); return; }
    
    const newCash = portfolio.cash - cost;
    const newShares = { ...portfolio.shares };
    newShares[currentCompanyId] = (newShares[currentCompanyId] || 0) + amount;
    
    const newTotalValue = calculateTotalValue(newCash, newShares);
    const newZysk = newTotalValue - portfolio.startValue;

    try {
        await updatePortfolioInFirebase({ 
            cash: newCash, 
            shares: newShares,
            zysk: newZysk,
            totalValue: newTotalValue
        });
        
        await logTransaction("KUPNO", currentCompanyId, amount, currentPrice);
        
        showMessage(`Kupiono ${amount} akcji ${market[currentCompanyId].name}`, "success");

    } catch (error) {
        console.error("Błąd transakcji zakupu: ", error);
        showMessage("Błąd zapisu transakcji.", "error");
    }
}

async function sellShares() {
    const amount = parseInt(dom.amountInput.value);
    const currentPrice = market[currentCompanyId].price;
    if (isNaN(amount) || amount <= 0) { showMessage("Wpisz poprawną ilość.", "error"); return; }
    if (amount > (portfolio.shares[currentCompanyId] || 0)) { showMessage("Nie masz tylu akcji tej spółki.", "error"); return; }
    
    const revenue = amount * currentPrice;
    const newCash = portfolio.cash + revenue;
    const newShares = { ...portfolio.shares };
    newShares[currentCompanyId] -= amount;

    const newTotalValue = calculateTotalValue(newCash, newShares);
    const newZysk = newTotalValue - portfolio.startValue;
    
    try {
        await updatePortfolioInFirebase({ 
            cash: newCash, 
            shares: newShares,
            zysk: newZysk,
            totalValue: newTotalValue
        });
        
        await logTransaction("SPRZEDAŻ", currentCompanyId, amount, currentPrice);
        
        showMessage(`Sprzedano ${amount} akcji ${market[currentCompanyId].name}`, "success");
        
    } catch (error) {
        console.error("Błąd transakcji sprzedaży: ", error);
        showMessage("Błąd zapisu transakcji.", "error");
    }
}

async function updatePortfolioInFirebase(dataToUpdate) {
    if (!currentUserId) return;
    const userDocRef = doc(db, "uzytkownicy", currentUserId);
    await updateDoc(userDocRef, dataToUpdate);
}

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


// --- SEKCJA 8: AKTUALIZACJA INTERFEJSU (UI) ---

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

function updateTickerTape() {
    if (!dom.tickerContent) return;

    let tickerHTML = "";
    const companyOrder = ["ulanska", "rychbud", "igicorp", "brzozair", "cosmosanit", "gigachat", "bimbercfd"];

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

        tickerHTML += `
            <span class="ticker-item">
                ${name}
                <strong>${price.toFixed(2)} zł</strong>
                <span class="${changeClass}">${sign}${percentChange.toFixed(2)}%</span>
            </span>
        `;
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
    
    if (!isNaN(oldPrice) && company.price > oldPrice) {
        dom.stockPrice.classList.remove('flash-red'); 
        dom.stockPrice.classList.add('flash-green'); 
    } else if (!isNaN(oldPrice) && company.price < oldPrice) {
        dom.stockPrice.classList.remove('flash-green');
        dom.stockPrice.classList.add('flash-red');
    }
    dom.stockPrice.addEventListener('animationend', () => {
        dom.stockPrice.classList.remove('flash-green', 'flash-red');
    }, { once: true }); 
}

function updatePortfolioUI() {
    if (!dom || !dom.username) return;
    dom.username.textContent = portfolio.name;
    dom.cash.textContent = formatujWalute(portfolio.cash);
    
    dom.sharesList.innerHTML = `
        <p>Ułańska Dev: <strong id="shares-ulanska">${portfolio.shares.ulanska || 0}</strong> szt.</p>
        <p>RychBud: <strong id="shares-rychbud">${portfolio.shares.rychbud || 0}</strong> szt.</p>
        <p>IgiCorp: <strong id="shares-igicorp">${portfolio.shares.igicorp || 0}</strong> szt.</p>
        <p>BrzozAir: <strong id="shares-brzozair">${portfolio.shares.brzozair || 0}</strong> szt.</p>
        <p>Cosmosanit: <strong id="shares-cosmosanit">${portfolio.shares.cosmosanit || 0}</strong> szt.</p>
        <p>Gigachat GPT: <strong id="shares-gigachat">${portfolio.shares.gigachat || 0}</strong> szt.</p>
        <p>Bimber.cfd: <strong id="shares-bimbercfd">${portfolio.shares.bimbercfd || 0}</strong> szt.</p>
    `;

    const oldTotalValue = portfolio.totalValue;
    const totalValue = calculateTotalValue(portfolio.cash, portfolio.shares);
    const totalProfit = totalValue - portfolio.startValue;

    portfolio.totalValue = totalValue; 
    portfolio.zysk = totalProfit;

    dom.totalValue.textContent = formatujWalute(totalValue);
    dom.totalProfit.textContent = formatujWalute(totalProfit);
    
    if (oldTotalValue && totalValue > oldTotalValue) {
        dom.totalValue.classList.remove('flash-red');
        dom.totalValue.classList.add('flash-green');
    } else if (oldTotalValue && totalValue < oldTotalValue) {
        dom.totalValue.classList.remove('flash-green');
        dom.totalValue.classList.add('flash-red');
    }
    dom.totalValue.addEventListener('animationend', () => {
        dom.totalValue.classList.remove('flash-green', 'flash-red');
    }, { once: true });
    
    if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
    else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
    else dom.totalProfit.style.color = "var(--text-muted)";
}

function showMessage(message, type) {
    if (!dom || !dom.messageBox) return;
    
    dom.messageBox.textContent = message;
    dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
    dom.amountInput.value = "";

    // Odtwarzaj dźwięk tylko jeśli audio jest odblokowane
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

function displayNewRumor(text, authorName, sentiment, companyId) {
    if (!dom || !dom.rumorsFeed) return;
    const p = document.createElement("p");
    
    let prefix = "";
    if (companyId && market[companyId]) {
        prefix = `[${market[companyId].name}] `;
    }
    
    if (sentiment === "positive") p.style.color = "var(--green)";
    else if (sentiment === "negative") p.style.color = "var(--red)";
    
    p.textContent = prefix + text; 
    const authorSpan = document.createElement("span");
    authorSpan.textContent = ` - ${authorName || "Anonim"}`;
    authorSpan.style.color = "var(--text-muted)";
    authorSpan.style.fontStyle = "normal";
    p.appendChild(authorSpan);
    dom.rumorsFeed.prepend(p);
}
