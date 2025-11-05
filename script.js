// --- SEKCJA 0: IMPORTY I KONFIGURACJA FIREBASE ---

// Importujemy funkcje z modułów Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    Timestamp // Będziemy używać Timestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// Twój config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCeu3hDfVKNirhJHk1HbqaFjtf_L3v3sd0",
  authDomain: "symulator-gielda.firebaseapp.com",
  projectId: "symulator-gielda",
  storageBucket: "symulator-gielda.firebasestorage.app",
  messagingSenderId: "407270570707",
  appId: "1:407270570707:web:ffd8c24dd1c8a1c137b226",
  measurementId: "G-BXPWNE261F"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// --- SEKCJA 1: ZMIENNE GLOBALNE I REFERENCJE DOM ---

// Funkcja pomocnicza do generowania startowych świec
// (Przeniesiona na górę, bo jest potrzebna w `market`)
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
    rychbud: { name: "RychBud", price: 50.00, history: generateInitialCandles(30, 50) },
    igicorp: { name: "IgiCorp", price: 120.00, history: generateInitialCandles(30, 120) },
    brzozair: { name: "BrzozAir", price: 25.00, history: generateInitialCandles(30, 25) }
};
let currentCompanyId = "rychbud";

let portfolio = {
    name: "Gość",
    cash: 0,
    shares: { rychbud: 0, igicorp: 0, brzozair: 0 },
    startValue: 100,
    zysk: 0
};

let chart = null;
let currentUserId = null;
let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeLeaderboard = null;

// Referencje do elementów DOM (muszą być wewnątrz `DOMContentLoaded`)
let dom;

// Czekamy na załadowanie DOM, aby bezpiecznie pobrać elementy
document.addEventListener("DOMContentLoaded", () => {
    // Teraz bezpiecznie przypisujemy referencje DOM
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
        sharesList: document.getElementById("shares-list")
    };
    
    // Uruchom główną logikę
    main();
});


// --- SEKCJA 2: GŁÓWNY PUNKT WEJŚCIA ---
function main() {
    // Nasłuchuj na zmiany stanu logowania
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUserId = user.uid;
            dom.simulatorContainer.classList.remove("hidden");
            dom.authContainer.classList.add("hidden");
            
            listenToPortfolioData(currentUserId);
            listenToRumors();
            listenToLeaderboard();
            
            startPriceTicker();
            if (!chart) initChart();
            startChartTicker();
            
            setupEventListeners();
        } else {
            currentUserId = null;
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            
            if (unsubscribePortfolio) unsubscribePortfolio();
            if (unsubscribeRumors) unsubscribeRumors();
            if (unsubscribeLeaderboard) unsubscribeLeaderboard();
            
            portfolio = { name: "Gość", cash: 0, shares: { rychbud: 0, igicorp: 0, brzozair: 0 }, startValue: 100, zysk: 0 };
        }
    });
}


// --- SEKCJA 3: LOGIKA AUTENTYKACJI (NOWA SKŁADNIA) ---
async function createInitialUserData(userId, name, email) {
    const userPortfolio = {
        name: name,
        email: email,
        cash: 100.00,
        shares: { rychbud: 0, igicorp: 0, brzozair: 0 },
        startValue: 100.00,
        zysk: 0.00,
        joinDate: Timestamp.fromDate(new Date()) // Użyj Timestamp
    };
    // Użyj setDoc() i doc()
    const userDocRef = doc(db, "uzytkownicy", userId);
    await setDoc(userDocRef, userPortfolio);
}

dom.registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = dom.registerForm.querySelector("#register-name").value;
    const email = dom.registerForm.querySelector("#register-email").value;
    const password = dom.registerForm.querySelector("#register-password").value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createInitialUserData(userCredential.user.uid, name, email);
    } catch (error) {
        showAuthMessage("Błąd rejestracji: " + error.message, "error");
    }
});

dom.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = dom.loginForm.querySelector("#login-email").value;
    const password = dom.loginForm.querySelector("#login-password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAuthMessage("Błąd logowania: " + error.message, "error");
    }
});

dom.logoutButton.addEventListener("click", () => {
    signOut(auth);
});

function showAuthMessage(message, type = "info") {
    dom.authMessage.textContent = message;
    dom.authMessage.style.color = (type === "error") ? "var(--red)" : "var(--green)";
}


// --- SEKCJA 4: LOGIKA BAZY DANYCH (NOWA SKŁADNIA) ---
function listenToPortfolioData(userId) {
    if (unsubscribePortfolio) unsubscribePortfolio();
    const userDocRef = doc(db, "uzytkownicy", userId);
    unsubscribePortfolio = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            portfolio.name = data.name;
            portfolio.cash = data.cash;
            portfolio.shares = data.shares || { rychbud: 0, igicorp: 0, brzozair: 0 };
            portfolio.startValue = data.startValue;
            portfolio.zysk = data.zysk || 0;
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
    const rumorsQuery = query(
        collection(db, "plotki"),
        orderBy("timestamp", "desc"),
        limit(5)
    );
    unsubscribeRumors = onSnapshot(rumorsQuery, (querySnapshot) => {
        dom.rumorsFeed.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const rumor = doc.data();
            displayNewRumor(rumor.text, rumor.authorName);
        });
    }, (error) => {
        console.error("Błąd nasłuchu plotek: ", error);
    });
}

dom.rumorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rumorText = dom.rumorInput.value;
    if (!rumorText.trim() || !currentUserId) return;
    try {
        await addDoc(collection(db, "plotki"), {
            text: rumorText,
            authorId: currentUserId,
            authorName: portfolio.name,
            timestamp: Timestamp.fromDate(new Date())
        });
        dom.rumorInput.value = "";
    } catch (error) {
        console.error("Błąd dodawania plotki: ", error);
    }
});

function listenToLeaderboard() {
    if (unsubscribeLeaderboard) unsubscribeLeaderboard();
    const leaderboardQuery = query(
        collection(db, "uzytkownicy"),
        orderBy("zysk", "desc"),
        limit(10)
    );
    unsubscribeLeaderboard = onSnapshot(leaderboardQuery, (querySnapshot) => {
        dom.leaderboardList.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const li = document.createElement("li");
            const nameSpan = document.createElement("span");
            nameSpan.textContent = `${rank}. ${user.name}`;
            const zyskStrong = document.createElement("strong");
            zyskStrong.textContent = `${user.zysk.toFixed(2)} zł`;
            zyskStrong.style.color = user.zysk > 0 ? "var(--green)" : (user.zysk < 0 ? "var(--red)" : "var(--text-muted)");
            li.appendChild(nameSpan);
            li.appendChild(zyskStrong);
            dom.leaderboardList.appendChild(li);
            rank++;
        });
    }, (error) => {
        console.error("Błąd nasłuchu rankingu: ", error);
        if (error.code === "failed-precondition") {
            dom.leaderboardList.innerHTML = `<li><strong>Błąd bazy!</strong> Ranking wymaga stworzenia indeksu. Sprawdź konsolę (F12) po stronie dewelopera, aby znaleźć link do jego utworzenia.</li>`;
        }
    });
}


// --- SEKCJA 5: AKCJE UŻYTKOWNIKA (Z NOWĄ SKŁADNIĄ) ---
function setupEventListeners() {
    dom.companySelector.addEventListener("click", (e) => {
        if (e.target.classList.contains("company-tab")) {
            changeCompany(e.target.dataset.company);
        }
    });
    dom.buyButton.addEventListener("click", buyShares);
    dom.sellButton.addEventListener("click", sellShares);
}

function changeCompany(companyId) {
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
    const currentPrice = market[currentCompanyId].price;
    if (isNaN(amount) || amount <= 0) { showMessage("Wpisz poprawną ilość.", "error"); return; }
    const cost = amount * currentPrice;
    if (cost > portfolio.cash) { showMessage("Brak wystarczającej gotówki.", "error"); return; }
    
    const newCash = portfolio.cash - cost;
    const newShares = { ...portfolio.shares };
    newShares[currentCompanyId] += amount;
    const newZysk = calculateProfit(newCash, newShares);

    updatePortfolioInFirebase({ 
        cash: newCash, 
        shares: newShares,
        zysk: newZysk
    });
    
    showMessage(`Kupiono ${amount} akcji ${market[currentCompanyId].name}`, "success");
}

function sellShares() {
    const amount = parseInt(dom.amountInput.value);
    const currentPrice = market[currentCompanyId].price;
    if (isNaN(amount) || amount <= 0) { showMessage("Wpisz poprawną ilość.", "error"); return; }
    if (amount > portfolio.shares[currentCompanyId]) { showMessage("Nie masz tylu akcji tej spółki.", "error"); return; }
    
    const revenue = amount * currentPrice;
    const newCash = portfolio.cash + revenue;
    const newShares = { ...portfolio.shares };
    newShares[currentCompanyId] -= amount;
    const newZysk = calculateProfit(newCash, newShares);
    
    updatePortfolioInFirebase({ 
        cash: newCash, 
        shares: newShares,
        zysk: newZysk
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

function calculateProfit(cash, shares) {
    let sharesValue = 0;
    for (const companyId in shares) {
        sharesValue += shares[companyId] * market[companyId].price;
    }
    const totalValue = cash + sharesValue;
    return totalValue - portfolio.startValue;
}


// --- SEKCJA 6: SYMULATOR RYNKU (Z POPRAWKĄ WYKRESU) ---
function startPriceTicker() {
    if (window.priceTickerInterval) clearInterval(window.priceTickerInterval);
    
    window.priceTickerInterval = setInterval(() => {
        for (const companyId in market) {
            const company = market[companyId];
            const volatility = 0.01 * company.price;
            const trend = 0.0005 * company.price;
            const change = (Math.random() - 0.5) * 2 * volatility + trend;
            company.price = Math.max(1.00, company.price + change);
        }
        updatePriceUI();
        updatePortfolioUI();
    }, 2000); // Cena zmienia się co 2 sekundy
}

function initChart() {
    // Użyj globalnego ApexCharts (załadowanego w <head>)
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
            
            // ⭐ POPRAWKA SYNCHRONIZACJI WYKRESU ⭐
            // Nowa świeca jest oparta na ostatniej zamkniętej i aktualnej cenie rynkowej
            
            const open = lastClose; // Cena otwarcia to ostatnie zamknięcie
            const close = company.price; // Cena zamknięcia to aktualna cena
            
            // Symuluj high/low na podstawie open/close
            const high = Math.max(open, close) + Math.random() * (company.price * 0.01);
            const low = Math.min(open, close) - Math.random() * (company.price * 0.01);

            const newCandle = {
                x: new Date(lastCandle.x.getTime() + 5000),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            };
            
            history.push(newCandle);
            if (history.length > 50) history.shift();
        }
        
        // Aktualizuj wykres TYLKO dla aktywnej spółki
        if (chart) {
            chart.updateSeries([{
                data: market[currentCompanyId].history
            }]);
        }
    }, 5000); // Nowa świeca co 5 sekund
}


// --- SEKCJA 7: AKTUALIZACJA INTERFEJSU (UI) ---
function updatePriceUI() {
    if (!dom || !dom.stockPrice) return; // Zabezpieczenie
    const company = market[currentCompanyId];
    const oldPrice = parseFloat(dom.stockPrice.textContent);
    dom.stockPrice.textContent = `${company.price.toFixed(2)} zł`;
    
    if (company.price > oldPrice) dom.stockPrice.style.color = "var(--green)";
    else if (company.price < oldPrice) dom.stockPrice.style.color = "var(--red)";
}

function updatePortfolioUI() {
    if (!dom) return; // Zabezpieczenie
    dom.username.textContent = portfolio.name;
    dom.cash.textContent = `${portfolio.cash.toFixed(2)} zł`;
    
    dom.sharesList.innerHTML = `
        <p>RychBud: <strong id="shares-rychbud">${portfolio.shares.rychbud || 0}</strong> szt.</p>
        <p>IgiCorp: <strong id="shares-igicorp">${portfolio.shares.igicorp || 0}</strong> szt.</p>
        <p>BrzozAir: <strong id="shares-brzozair">${portfolio.shares.brzozair || 0}</strong> szt.</p>
    `;

    let sharesValue = 0;
    for (const companyId in portfolio.shares) {
        if (market[companyId]) {
            sharesValue += (portfolio.shares[companyId] || 0) * market[companyId].price;
        }
    }
    
    const totalValue = portfolio.cash + sharesValue;
    const totalProfit = totalValue - portfolio.startValue;

    dom.totalValue.textContent = `${totalValue.toFixed(2)} zł`;
    dom.totalProfit.textContent = `${totalProfit.toFixed(2)} zł`;
    
    if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
    else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
    else dom.totalProfit.style.color = "var(--text-muted)";
}

function showMessage(message, type) {
    if (!dom || !dom.messageBox) return; // Zabezpieczenie
    dom.messageBox.textContent = message;
    dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
    dom.amountInput.value = "";
}

function displayNewRumor(text, authorName) {
    if (!dom || !dom.rumorsFeed) return; // Zabezpieczenie
    const p = document.createElement("p");
    p.textContent = text; 
    const authorSpan = document.createElement("span");
    authorSpan.textContent = ` - ${authorName || "Anonim"}`;
    authorSpan.style.color = "var(--text-muted)";
    authorSpan.style.fontStyle = "normal";
    p.appendChild(authorSpan);
    dom.rumorsFeed.prepend(p);
}
