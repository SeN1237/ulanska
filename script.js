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

// ====================================================================
// POPRAWKA #1: Prawidłowa definicja obiektu 'market'
// Definiujemy tutaj strukturę rynku. Ceny ('price') zostaną
// natychmiast nadpisane przez wartości z Firebase, gdy tylko się połączymy.
// Używamy '1' jako ceny startowej, aby uniknąć błędów.
// ====================================================================
let market = {
    ulanska:  { name: "Ułańska Dev", price: 1, history: generateInitialCandles(50, 1) },
    brzozair: { name: "BrzozAir",     price: 1, history: generateInitialCandles(50, 1) },
    igicorp:  { name: "IgiCorp",      price: 1, history: generateInitialCandles(50, 1) },
    rychbud:  { name: "RychBud",      price: 1, history: generateInitialCandles(50, 1) }
};
let currentCompanyId = "ulanska";

let marketSentiment = { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 };

let portfolio = {
    name: "Gość",
    cash: 0,
    shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
    startValue: 100,
    zysk: 0,
    totalValue: 0
};

let chart = null;
let currentUserId = null;
let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeLeaderboard = null;

let ytPlayer = null;
let unsubscribePlayer = null;
let localPlayerUpdate = false;

// Obiekt DOM będzie wypełniony w 'DOMContentLoaded'
let dom = {};


// ====================================================================
// POPRAWKA #2: Zmodyfikowany 'onSnapshot'
// Teraz aktualizuje on ZARÓWNO logikę gry (obiekt 'market'),
// JAK I wyświetlany HTML.
// ====================================================================
const cenyDocRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyDocRef, (docSnap) => {
    
    if (docSnap.exists()) {
        const aktualneCeny = docSnap.data();
        console.log("Pobrano aktualne ceny z bazy:", aktualneCeny);

        // KROK 1: Aktualizuj logikę gry (obiekt 'market')
        // Dzięki temu kupno/sprzedaż będzie używać cen z bazy.
        if (market.ulanska)  market.ulanska.price  = aktualneCeny.ulanska;
        if (market.brzozair) market.brzozair.price = aktualneCeny.brzozair;
        if (market.igicorp)  market.igicorp.price  = aktualneCeny.igicorp;
        if (market.rychbud)  market.rychbud.price  = aktualneCeny.rychbud;

        // KROK 2: Aktualizuj wyświetlany HTML (interfejs)
        if (document.getElementById('ulanska-cena')) {
            document.getElementById('ulanska-cena').innerText = aktualneCeny.ulanska;
        }
        if (document.getElementById('brzozair-cena')) {
            document.getElementById('brzozair-cena').innerText = aktualneCeny.brzozair;
        }
        if (document.getElementById('igicorp-cena')) {
            document.getElementById('igicorp-cena').innerText = aktualneCeny.igicorp;
        }
        if (document.getElementById('rychbud-cena')) {
            document.getElementById('rychbud-cena').innerText = aktualneCeny.rychbud;
        }
        
        // KROK 3: Wywołaj funkcje odświeżające UI
        updatePriceUI(); // Aktualizuje cenę na głównym panelu
        updatePortfolioUI(); // Przelicza wartość portfela na nowo

    } else {
        console.error("KRYTYCZNY BŁĄD: Nie można znaleźć dokumentu 'global/ceny_akcji'!");
    }
});


// --- SEKCJA 2: GŁÓWNY PUNKT WEJŚCIA (POPRAWIONA LOGIKA) ---
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Wypełnij referencje DOM (teraz jest to bezpieczne)
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

    // 3. Uruchom główną pętlę aplikacji
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
            listenToYouTubePlayer();
            
            // ====================================================================
            // POPRAWKA #3: Usunięto wywołanie startPriceTicker()
            // Nie chcemy już lokalnie symulować cen.
            // ====================================================================
            // startPriceTicker(); // USUNIĘTE
            
            if (!chart) initChart();
            startChartTicker();
            
            if (window.YT && window.YT.Player) {
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
            if (unsubscribePlayer) unsubscribePlayer();
            
            //if (window.priceTickerInterval) clearInterval(window.priceTickerInterval); // Usunięte, bo nie ma już tej funkcji
            if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
            
            if (ytPlayer) {
                ytPlayer.destroy();
                ytPlayer = null;
            }
            
            portfolio = { name: "Gość", cash: 100, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 }, startValue: 100, zysk: 0, totalValue: 100 };
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
        totalValue: 100.00,
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


// --- SEKCJA 4: LOGIKA BAZY DANYCH ---

function listenToPortfolioData(userId) {
    if (unsubscribePortfolio) unsubscribePortfolio();
    const userDocRef = doc(db, "uzytkownicy", userId);
    unsubscribePortfolio = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            portfolio.name = data.name;
            portfolio.cash = data.cash;
            portfolio.shares = data.shares || { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 };
            portfolio.startValue = data.startValue;
            
            const totalValue = calculateTotalValue(data.cash, data.shares);
            portfolio.totalValue = totalValue;
            portfolio.zysk = totalValue - data.startValue;
            
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
    const rumorsQuery = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(5));
    
    unsubscribeRumors = onSnapshot(rumorsQuery, (querySnapshot) => {
        dom.rumorsFeed.innerHTML = "";
        querySnapshot.forEach((doc, index) => {
            const rumor = doc.data();
            displayNewRumor(rumor.text, rumor.authorName, rumor.sentiment, rumor.companyId);

            if (index === 0 && rumor.timestamp) {
                const rumorTime = rumor.timestamp.toDate().getTime();
                const now = new Date().getTime();
                if ((now - rumorTime) < 10000) {
                    applyRumorSentiment(rumor.companyId, rumor.sentiment);
                }
            }
        });
    }, (error) => { console.error("Błąd nasłuchu plotek: ", error); });
}

function applyRumorSentiment(companyId, sentiment) {
    if (!marketSentiment.hasOwnProperty(companyId)) return;
    const impact = 0.05; // Ten kod i tak nie będzie nic robił, bo ceny są z bazy
    if (sentiment === "positive") {
        marketSentiment[companyId] = impact;
    } else if (sentiment === "negative") {
        marketSentiment[companyId] = -impact;
    }
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
        dom.leaderboardList.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const li = document.createElement("li");
            
            const nameSpan = document.createElement("span");
            nameSpan.textContent = `${rank}. ${user.name}`;
            
            const valueStrong = document.createElement("strong");
            valueStrong.textContent = `${(user.totalValue || 0).toFixed(2)} zł`;
            
            const profit = (user.totalValue || 0) - (user.startValue || 100);
            const profitSmall = document.createElement("small");
            profitSmall.textContent = `Zysk: ${profit.toFixed(2)} zł`;
            profitSmall.style.color = profit > 0 ? "var(--green)" : (profit < 0 ? "var(--red)" : "var(--text-muted)");
            
            nameSpan.appendChild(profitSmall);
            li.appendChild(nameSpan);
            li.appendChild(valueStrong);
            dom.leaderboardList.appendChild(li);
            rank++;
        });
    }, (error) => {
        console.error("Błąd nasłuchu rankingu: ", error);
        if (error.code === "failed-precondition") {
            dom.leaderboardList.innerHTML = `<li><strong>BŁĄD BAZY DANYCH!</strong> Ranking musi zostać zindeksowany. Otwórz konsolę (F12), znajdź link błędu i kliknij go, aby automatycznie utworzyć indeks dla pola 'totalValue'.</li>`;
        }
    });
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
        chart.updateSeries([{ data: companyData.history }]);
    }
    updatePriceUI();
}

function buyShares() {
    const amount = parseInt(dom.amountInput.value);
    // CENA JEST POBIERANA Z 'market', który jest aktualizowany przez 'onSnapshot'
    const currentPrice = market[currentCompanyId].price; 
    if (isNaN(amount) || amount <= 0) { showMessage("Wpisz poprawną ilość.", "error"); return; }
    const cost = amount * currentPrice;
    if (cost > portfolio.cash) { showMessage("Brak wystarczającej gotówki.", "error"); return; }
    
    const newCash = portfolio.cash - cost;
    const newShares = { ...portfolio.shares };
    newShares[currentCompanyId] = (newShares[currentCompanyId] || 0) + amount;
    
    const newTotalValue = calculateTotalValue(newCash, newShares);
    const newZysk = newTotalValue - portfolio.startValue;

    updatePortfolioInFirebase({ 
        cash: newCash, 
        shares: newShares,
        zysk: newZysk,
        totalValue: newTotalValue
    });
    
    showMessage(`Kupiono ${amount} akcji ${market[currentCompanyId].name}`, "success");
}

function sellShares() {
    const amount = parseInt(dom.amountInput.value);
    // CENA JEST POBIERANA Z 'market', który jest aktualizowany przez 'onSnapshot'
    const currentPrice = market[currentCompanyId].price;
    if (isNaN(amount) || amount <= 0) { showMessage("Wpisz poprawną ilość.", "error"); return; }
    if (amount > (portfolio.shares[currentCompanyId] || 0)) { showMessage("Nie masz tylu akcji tej spółki.", "error"); return; }
    
    const revenue = amount * currentPrice;
    const newCash = portfolio.cash + revenue;
    const newShares = { ...portfolio.shares };
    newShares[currentCompanyId] -= amount;

    const newTotalValue = calculateTotalValue(newCash, newShares);
    const newZysk = newTotalValue - portfolio.startValue;
    
    updatePortfolioInFirebase({ 
        cash: newCash, 
        shares: newShares,
        zysk: newZysk,
        totalValue: newTotalValue
    });
    
    showMessage(`Sprzedano ${amount} akcji ${market[currentCompanyId].name}`, "success");
}

async function updatePortfolioInFirebase(dataToUpdate) {
    if (!currentUserId) return;
    try {
        const userDocRef = doc(db, "uzytkownicy", currentUserId);
        await updateDoc(userDocRef, dataToUpdate);
    } catch (error) {
        console.error("Błąd aktualizacji portfela: ", error);
        showMessage("Błąd zapisu danych!", "error");
    }
}

function calculateTotalValue(cash, shares) {
    let sharesValue = 0;
    for (const companyId in shares) {
        if (market[companyId]) {
            // Używa aktualnej ceny z obiektu 'market'
            sharesValue += (shares[companyId] || 0) * market[companyId].price;
        }
    }
    return cash + sharesValue;
}


// --- SEKCJA 6: SYMULATOR RYNKU ---

// ====================================================================
// POPRAWKA #4: Usunięcie `startPriceTicker`
// Ta funkcja generowała losowe ceny lokalnie,
// co powodowało nadpisywanie cen pobranych z bazy.
// Usunęliśmy ją, aby JEDYNYM źródłem cen była baza danych.
// ====================================================================
/*
function startPriceTicker() {
    if (window.priceTickerInterval) clearInterval(window.priceTickerInterval);
    
    window.priceTickerInterval = setInterval(() => {
        for (const companyId in market) {
            const company = market[companyId];
            const sentimentImpact = marketSentiment[companyId];
            const volatility = 0.01 * company.price;
            const trend = 0.0005 * company.price;
            const change = (Math.random() - 0.5) * 2 * volatility + trend + (sentimentImpact * company.price);
            company.price = Math.max(1.00, company.price + change); // <--- TO BYŁ PROBLEM
            marketSentiment[companyId] *= 0.95;
        }
        updatePriceUI();
        updatePortfolioUI();
    }, 2000);
}
*/

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
            
            // Wykres świecowy używa teraz ceny z 'market' (ustawianej przez Firebase)
            // jako nowej ceny zamknięcia.
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
window.onYouTubeIframeAPIReady = function() {
    if (currentUserId) { initYouTubePlayer(); }
};

function initYouTubePlayer(videoId = '5qap5aO4i9A') {
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
        ytPlayer.loadVideoById(videoId);
    } 
    else if (window.YT && window.YT.Player) {
        if (document.getElementById('yt-player')) {
            ytPlayer = new window.YT.Player('yt-player', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'playsinline': 1,
                    'autoplay': 1,
                    'controls': 1
                }
            });
        }
    } 
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
                initYouTubePlayer(data.currentVideoId);
            }
        } else {
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
        timestamp: serverTimestamp()
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
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}


// --- SEKCJA 8: AKTUALIZACJA INTERFEJSU (UI) ---
function updatePriceUI() {
    if (!dom || !dom.stockPrice) return;
    const company = market[currentCompanyId];
    if (!company) return;
    
    const oldPrice = parseFloat(dom.stockPrice.textContent);
    dom.stockPrice.textContent = `${company.price.toFixed(2)} zł`;
    
    if (company.price > oldPrice) dom.stockPrice.style.color = "var(--green)";
    else if (company.price < oldPrice) dom.stockPrice.style.color = "var(--red)";
}

function updatePortfolioUI() {
    if (!dom || !dom.username) return;
    dom.username.textContent = portfolio.name;
    dom.cash.textContent = `${portfolio.cash.toFixed(2)} zł`;
    
    dom.sharesList.innerHTML = `
        <p>Ułańska Dev: <strong id="shares-ulanska">${portfolio.shares.ulanska || 0}</strong> szt.</p>
        <p>RychBud: <strong id="shares-rychbud">${portfolio.shares.rychbud || 0}</strong> szt.</p>
        <p>IgiCorp: <strong id="shares-igicorp">${portfolio.shares.igicorp || 0}</strong> szt.</p>
        <p>BrzozAir: <strong id="shares-brzozair">${portfolio.shares.brzozair || 0}</strong> szt.</p>
    `;

    const totalValue = calculateTotalValue(portfolio.cash, portfolio.shares);
    const totalProfit = totalValue - portfolio.startValue;

    portfolio.totalValue = totalValue;
    portfolio.zysk = totalProfit;

    dom.totalValue.textContent = `${totalValue.toFixed(2)} zł`;
    dom.totalProfit.textContent = `${totalProfit.toFixed(2)} zł`;
    
    if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
    else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
    else dom.totalProfit.style.color = "var(--text-muted)";
}

function showMessage(message, type) {
    if (!dom || !dom.messageBox) return;
    dom.messageBox.textContent = message;
    dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
    dom.amountInput.value = "";
}

function displayNewRumor(text, authorName, sentiment, companyId) {
    if (!dom || !dom.rumorsFeed) return;
    const p = document.createElement("p");
    
    let prefix = "";
    if (companyId && market[companyId]) {
        prefix = `[${market[companyId].name}] `;
    }
    
    if (sentiment === "positive") {
        p.style.color = "var(--green)";
    } else if (sentiment === "negative") {
        p.style.color = "var(--red)";
    }
    
    p.textContent = prefix + text; 
    const authorSpan = document.createElement("span");
    authorSpan.textContent = ` - ${authorName || "Anonim"}`;
    authorSpan.style.color = "var(--text-muted)";
    authorSpan.style.fontStyle = "normal";
    p.appendChild(authorSpan);
    dom.rumorsFeed.prepend(p);
}

function displayTransactionHistory(transactions) {
    // puste
}
