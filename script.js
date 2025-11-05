// --- SEKCJA 0: IMPORTY I KONFIGURACJA FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, onSnapshot, updateDoc, 
    collection, addDoc, query, orderBy, limit, Timestamp, 
    serverTimestamp
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
    let timestamp = new Date().getTime() - (count * 5000);
    for (let i = 0; i < count; i++) {
        let open = lastClose;
        let close = open + (Math.random() - 0.5) * (basePrice * 0.05);
        let high = Math.max(open, close) + Math.random() * (basePrice * 0.02);
        let low = Math.min(open, close) - Math.random() * (basePrice * 0.02);
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
    ulanska: { name: "Ułańska Dev", price: 75.00, history: generateInitialCandles(30, 75) },
    rychbud: { name: "RychBud", price: 50.00, history: generateInitialCandles(30, 50) },
    igicorp: { name: "IgiCorp", price: 120.00, history: generateInitialCandles(30, 120) },
    brzozair: { name: "BrzozAir", price: 25.00, history: generateInitialCandles(30, 25) }
};
let currentCompanyId = "ulanska";

// Obiekt przechowujący chwilowy wpływ plotek
let marketSentiment = { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 };

let portfolio = {
    name: "Gość",
    cash: 0,
    shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
    startValue: 100,
    zysk: 0
};

let chart = null;
let currentUserId = null;
let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeLeaderboard = null;

// Zmienne dla Odtwarzacza YT
let ytPlayer = null;
let unsubscribePlayer = null;
let localPlayerUpdate = false; // Zapobiega pętli

let dom;

// --- SEKCJA 2: GŁÓWNY PUNKT WEJŚCIA ---

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Wypełnij referencje DOM
    dom = {
        authContainer: document.getElementById("auth-container"),
        simulatorContainer: document.getElementById("simulator-container"),
        loginForm: document.getElementById("login-form"),
        registerForm: document.getElementById("register-form"),
        authMessage: document.getElementById("auth-message"),
        username: document.getElementById("username"),
        logoutButton: document.getElementById("logout-button"),
        cash: document.getElementById("cash"),
        totalValue: document.getElementById("total-value"),
        totalProfit: document.getElementById("total-profit"),
        stockPrice: document.getElementById("stock-price"),
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        messageBox: document.getElementById("message-box"),
        chartContainer: document.getElementById("chart-container"),
        rumorForm: document.getElementById("rumor-form"),
        rumorInput: document.getElementById("rumor-input"),
        rumorsFeed: document.getElementById("rumors-feed"),
        leaderboardList: document.getElementById("leaderboard-list"),
        companySelector: document.getElementById("company-selector"),
        companyName: document.getElementById("company-name"),
        sharesList: document.getElementById("shares-list"),
        ytForm: document.getElementById("yt-form"),
        ytUrlInput: document.getElementById("yt-url-input"),
        ytPlayerContainer: document.getElementById("yt-player-container")
    };
    
    // 2. Podepnij GŁÓWNE listenery
    dom.registerForm.addEventListener("submit", onRegister);
    dom.loginForm.addEventListener("submit", onLogin);
    dom.logoutButton.addEventListener("click", onLogout);
    dom.companySelector.addEventListener("click", onSelectCompany);
    dom.buyButton.addEventListener("click", buyShares);
    dom.sellButton.addEventListener("click", sellShares);
    dom.rumorForm.addEventListener("submit", onPostRumor);
    dom.ytForm.addEventListener("submit", onYouTubeLoad);

    // 3. Uruchom logikę sprawdzania stanu logowania
    startAuthListener();
});

function startAuthListener() {
    onAuthStateChanged(auth, user => {
        if (user) {
            // UŻYTKOWNIK ZALOGOWANY
            currentUserId = user.uid;
            dom.simulatorContainer.classList.remove("hidden");
            dom.authContainer.classList.add("hidden");
            
            listenToPortfolioData(currentUserId);
            listenToRumors();
            listenToLeaderboard();
            listenToYouTubePlayer(); // Uruchom nasłuch YT
            
            startPriceTicker();
            if (!chart) initChart();
            startChartTicker();
            
            // Inicjalizuj odtwarzacz YT (zostanie wywołany przez API lub onSnapshot)
            if (window.YT) {
                initYouTubePlayer();
            } else {
                window.onYouTubeIframeAPIReady = initYouTubePlayer;
            }
            
        } else {
            // UŻYTKOWNIK WYLOGOWANY
            currentUserId = null;
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            
            if (unsubscribePortfolio) unsubscribePortfolio();
            if (unsubscribeRumors) unsubscribeRumors();
            if (unsubscribeLeaderboard) unsubscribeLeaderboard();
            if (unsubscribePlayer) unsubscribePlayer(); // Zatrzymaj nasłuch YT
            
            if (window.priceTickerInterval) clearInterval(window.priceTickerInterval);
            if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
            
            if (ytPlayer) {
                ytPlayer.destroy();
                ytPlayer = null;
            }
            
            portfolio = { name: "Gość", cash: 0, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 }, startValue: 100, zysk: 0 };
            updatePortfolioUI();
        }
    });
}


// --- SEKCJA 3: HANDLERY AUTENTYKACJI ---

async function createInitialUserData(userId, name, email) {
    const userPortfolio = {
        name: name,
        email: email,
        cash: 100.00,
        shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
        startValue: 100.00,
        zysk: 0.00,
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
        await createInitialUserData(userCredential.user.uid, name, email);
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
function showAuthMessage(message, type = "info") { /* ... (bez zmian) ... */ }


// --- SEKCJA 4: LOGIKA BAZY DANYCH ---

function listenToPortfolioData(userId) { /* ... (bez zmian, z 4 spółkami) ... */ }

// ZAKTUALIZOWANY NASŁUCH PLOTEK (reaguje na plotki)
function listenToRumors() {
    if (unsubscribeRumors) unsubscribeRumors();
    // Pobierz 5 najnowszych plotek
    const rumorsQuery = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(5));
    
    unsubscribeRumors = onSnapshot(rumorsQuery, (querySnapshot) => {
        dom.rumorsFeed.innerHTML = "";
        querySnapshot.forEach((doc, index) => {
            const rumor = doc.data();
            displayNewRumor(rumor.text, rumor.authorName, rumor.sentiment); // Przekaż sentyment

            // Reaguj tylko na najnowszą plotkę (index 0)
            if (index === 0 && rumor.timestamp) {
                // Sprawdź czy plotka jest nowa (np. w ciągu ostatnich 10 sekund)
                const rumorTime = rumor.timestamp.toDate().getTime();
                const now = new Date().getTime();
                if ((now - rumorTime) < 10000) { // 10 sekund
                    applyRumorSentiment(rumor.companyId, rumor.sentiment);
                }
            }
        });
    }, (error) => { console.error("Błąd nasłuchu plotek: ", error); });
}

// NOWA FUNKCJA - APLIKUJ WPŁYW PLOTKI
function applyRumorSentiment(companyId, sentiment) {
    if (!marketSentiment.hasOwnProperty(companyId)) return;
    
    const impact = 0.05; // 5% chwilowego skoku/spadku
    if (sentiment === "positive") {
        marketSentiment[companyId] = impact;
    } else if (sentiment === "negative") {
        marketSentiment[companyId] = -impact;
    }
}

// ZAKTUALIZOWANY FORMULARZ PLOTKI (wysyła spółkę i sentyment)
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

// ZAKTUALIZOWANY RANKING (sortuje po 'cash')
function listenToLeaderboard() {
    if (unsubscribeLeaderboard) unsubscribeLeaderboard();
    
    // ZMIANA: orderBy("cash", "desc")
    const leaderboardQuery = query(collection(db, "uzytkownicy"), orderBy("cash", "desc"), limit(10));
    
    unsubscribeLeaderboard = onSnapshot(leaderboardQuery, (querySnapshot) => {
        dom.leaderboardList.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const li = document.createElement("li");
            const nameSpan = document.createElement("span");
            nameSpan.textContent = `${rank}. ${user.name}`;
            
            // ZMIANA: wyświetl user.cash
            const zyskStrong = document.createElement("strong");
            zyskStrong.textContent = `${user.cash.toFixed(2)} zł`;
            zyskStrong.style.color = "var(--text-color)"; // Saldo nie jest kolorowane
            
            li.appendChild(nameSpan);
            li.appendChild(zyskStrong);
            dom.leaderboardList.appendChild(li);
            rank++;
        });
    }, (error) => {
        console.error("Błąd nasłuchu rankingu: ", error);
        if (error.code === "failed-precondition") {
            dom.leaderboardList.innerHTML = `<li><strong>BŁĄD BAZY DANYCH!</strong> Ranking musi zostać zindeksowany. Otwórz konsolę (F12), znajdź link błędu i kliknij go, aby automatycznie utworzyć indeks dla pola 'cash'.</li>`;
        }
    });
}


// --- SEKCJA 5: HANDLERY AKCJI UŻYTKOWNIKA ---
function onSelectCompany(e) { /* ... (bez zmian) ... */ }
function changeCompany(companyId) { /* ... (bez zmian) ... */ }
function buyShares() { /* ... (bez zmian) ... */ }
function sellShares() { /* ... (bez zmian) ... */ }
async function updatePortfolioInFirebase(dataToUpdate) { /* ... (bez zmian) ... */ }
function calculateProfit(cash, shares) { /* ... (bez zmian) ... */ }


// --- SEKCJA 6: SYMULATOR RYNKU ---

// ZAKTUALIZOWANY SILNIK CENY (uwzględnia plotki)
function startPriceTicker() {
    if (window.priceTickerInterval) clearInterval(window.priceTickerInterval);
    
    window.priceTickerInterval = setInterval(() => {
        for (const companyId in market) {
            const company = market[companyId];
            const sentimentImpact = marketSentiment[companyId];
            const volatility = 0.01 * company.price;
            const trend = 0.0005 * company.price;
            
            // Dodaj wpływ plotki do zmiany ceny
            const change = (Math.random() - 0.5) * 2 * volatility + trend + (sentimentImpact * company.price);
            
            company.price = Math.max(1.00, company.price + change);
            
            // Zmniejsz wpływ plotki (powrót do normalności)
            marketSentiment[companyId] *= 0.95; // Wpływ maleje o 5% co 2 sekundy
        }
        updatePriceUI();
        updatePortfolioUI();
    }, 2000);
}

// ... (initChart i startChartTicker bez zmian, z 4 spółkami) ...
function initChart() {
    const options = {
        series: [{ data: market[currentCompanyId].history }],
        chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
        theme: { mode: 'dark' },
        title: { text: 'Historia cen (świece 5-sekundowe)', align: 'left', style: { color: '#a3acb9' } },
        xaxis: { type: 'datetime', labels: { style: { colors: '#a3acb9' } } },
        yaxis: { tooltip: { enabled: true }, labels: { formatter: (val) => val.toFixed(2) + " zł", style: { colors: '#a3acb9' } } },
        plotOptions: { candlestick: { colors: { upward: '#28a745', downward: '#dc3545' } } }
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
            if (!history.length) continue;
            
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
        
        if (chart) {
            chart.updateSeries([{
                data: market[currentCompanyId].history
            }]);
        }
    }, 5000);
}


// --- SEKCJA 7: LOGIKA ODTWARZACZA YOUTUBE ---

// Ta funkcja jest wywoływana globalnie przez API YT
window.onYouTubeIframeAPIReady = function() {
    if (currentUserId) { // Jeśli użytkownik jest już zalogowany
        initYouTubePlayer();
    }
};

function initYouTubePlayer(videoId = '5qap5aO4i9A') { // Domyślne wideo
    if (ytPlayer || !document.getElementById('yt-player')) {
        // Jeśli odtwarzacz już istnieje LUB kontener nie jest gotowy (np. wylogowany)
        if(ytPlayer && videoId) {
             ytPlayer.loadVideoById(videoId); // Po prostu załaduj nowe wideo
        }
        return; 
    }
    
    // Utwórz nowy odtwarzacz
    ytPlayer = new window.YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'autoplay': 1, // AUTOPLAY WŁĄCZONY
            'controls': 1
        }
    });
}

function listenToYouTubePlayer() {
    if (unsubscribePlayer) unsubscribePlayer();
    
    const playerDocRef = doc(db, "global", "youtube");
    
    unsubscribePlayer = onSnapshot(playerDocRef, (docSnap) => {
        if (localPlayerUpdate) {
            localPlayerUpdate = false;
            return;
        }
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.currentVideoId) {
                if (ytPlayer) {
                    ytPlayer.loadVideoById(data.currentVideoId);
                } else {
                    // Odtwarzacz nie jest jeszcze gotowy, API go zainicjalizuje
                    // lub onAuthStateChanged go zainicjalizuje
                    initYouTubePlayer(data.currentVideoId);
                }
            }
        } else {
            // Brak wideo w bazie, załaduj domyślne
             initYouTubePlayer('5qap5aO4i9A');
        }
    });
}

function onYouTubeLoad(e) {
    e.preventDefault();
    const url = dom.ytUrlInput.value;
    const videoId = parseYouTubeVideoId(url);
    
    if (!videoId) {
        showMessage("Nieprawidłowy link YouTube lub ID wideo", "error");
        return;
    }
    
    const playerDocRef = doc(db, "global", "youtube");
    localPlayerUpdate = true;
    
    setDoc(playerDocRef, {
        currentVideoId: videoId,
        updatedBy: portfolio.name,
        timestamp: serverTimestamp() // Użyj serverTimestamp dla spójności
    }).catch(err => {
        console.error("Błąd zapisu wideo: ", err);
        localPlayerUpdate = false;
    });
    
    dom.ytUrlInput.value = "";
}

function parseYouTubeVideoId(url) {
    if (!url) return null;
    if (url.length === 11 && !url.includes('.')) {
        return url;
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regEq);
    return (match && match[2].length === 11) ? match[2] : null;
}


// --- SEKCJA 8: AKTUALIZACJA INTERFEJSU (UI) ---
function updatePriceUI() { /* ... (bez zmian) ... */ }
function updatePortfolioUI() { /* ... (bez zmian, z 4 spółkami) ... */ }
function showMessage(message, type) { /* ... (bez zmian) ... */ }

// ZAKTUALIZOWANE WYŚWIETLANIE PLOTKI (pokazuje sentyment)
function displayNewRumor(text, authorName, sentiment) {
    if (!dom || !dom.rumorsFeed) return;
    const p = document.createElement("p");
    
    if (sentiment === "positive") {
        p.style.color = "var(--green)";
    } else if (sentiment === "negative") {
        p.style.color = "var(--red)";
    }
    
    p.textContent = text; 
    const authorSpan = document.createElement("span");
    authorSpan.textContent = ` - ${authorName || "Anonim"}`;
    authorSpan.style.color = "var(--text-muted)";
    authorSpan.style.fontStyle = "normal";
    p.appendChild(authorSpan);
    dom.rumorsFeed.prepend(p);
}
