// --- SEKCJA 0: IMPORTY I KONFIGURACJA FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, onSnapshot, updateDoc,
  collection, addDoc, query, orderBy, limit, Timestamp, serverTimestamp
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
    close = Math.max(0.01, close);
    data.push({
      x: new Date(timestamp),
      y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
    });
    lastClose = close; timestamp += 5000;
  }
  return data;
}

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
let chartHasStarted = false;
let initialNewsLoaded = false;
let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeNews = null;
let unsubscribeLeaderboard = null;
let unsubscribeChat = null;
let unsubscribeTransactions = null;

let dom = {};

// Nasłuch cen z dokumentu globalnego (jeśli istnieje w Firestore)
const cenyDocRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyDocRef, (docSnap) => {
  if (docSnap.exists()) {
    const aktualneCeny = docSnap.data();
    if (aktualneCeny.ulanska !== undefined) market.ulanska.price = aktualneCeny.ulanska;
    if (aktualneCeny.brzozair !== undefined) market.brzozair.price = aktualneCeny.brzozair;
    if (aktualneCeny.igicorp !== undefined) market.igicorp.price = aktualneCeny.igicorp;
    if (aktualneCeny.rychbud !== undefined) market.rychbud.price = aktualneCeny.rychbud;
    updatePriceUI();
    updatePortfolioUI();
    if (currentUserId && !chartHasStarted) {
      if (!chart) initChart();
      startChartTicker();
      chartHasStarted = true;
    }
  } else {
    console.error("Brak dokumentu global/ceny_akcji");
  }
});

// --- SEKCJA 2: DOMContentLoaded i eventy ---
document.addEventListener("DOMContentLoaded", () => {
  dom = {
    authContainer: document.getElementById("auth-container"),
    simulatorContainer: document.getElementById("simulator-container"),
    loginForm: document.getElementById("login-form"),
    registerForm: document.getElementById("register-form"),
    authMessage: document.getElementById("auth-message"),
    resetPasswordLink: document.getElementById("reset-password-link"),
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
    audioKaching: document.getElementById("audio-kaching"),
    audioError: document.getElementById("audio-error"),
    audioNews: document.getElementById("audio-news"),
    themeToggle: document.getElementById("theme-toggle"),
    userAvatar: document.getElementById("user-avatar"),
    joinDate: document.getElementById("join-date"),
    sentimentFill: document.getElementById("sentiment-fill"),
    sentimentLabel: document.getElementById("sentiment-label"),
    historyFeed: document.getElementById("history-feed")
  };

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
  dom.themeToggle.addEventListener("click", toggleTheme);

  // Load theme preference (dark default)
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    dom.themeToggle.textContent = "☀️";
  } else {
    dom.themeToggle.textContent = "🌙";
  }

  startAuthListener();

  // Sentiment bar update interval
  setInterval(updateMarketSentimentBar, 2500);

  // Daily alert (co 5 minut tutaj dla demo, możesz zmienić)
  setInterval(showDailyAlert, 5 * 60 * 1000);
});

// --- SEKCJA 3: AUTORYZACJA ---
async function createInitialUserData(userId, name, email) {
  const userPortfolio = {
    name: name,
    email: email,
    cash: 1000.00,
    shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
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
  try {
    if (dom.audioKaching) dom.audioKaching.play().then(()=>dom.audioKaching.pause()).catch(()=>{});
    if (dom.audioError) dom.audioError.play().then(()=>dom.audioError.pause()).catch(()=>{});
    if (dom.audioNews) dom.audioNews.play().then(()=>dom.audioNews.pause()).catch(()=>{});
  } catch (err) { console.log("Odblokowywanie audio nieudane"); }

  const email = dom.loginForm.querySelector("#login-email").value;
  const password = dom.loginForm.querySelector("#login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    startAuthListener();
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
  if (!email) { showAuthMessage("Wpisz swój e-mail w polu logowania, aby zresetować hasło.", "error"); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMessage("Link do resetowania hasła został wysłany na Twój e-mail!", "success");
  } catch (error) {
    showAuthMessage("Błąd: " + error.message, "error");
  }
}

// --- SEKCJA 4: NASŁUCHIWANIE DANYCH Z FIRESTORE ---
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
      listenToTransactions();
    } else {
      currentUserId = null;
      dom.simulatorContainer.classList.add("hidden");
      dom.authContainer.classList.remove("hidden");

      if (unsubscribePortfolio) unsubscribePortfolio();
      if (unsubscribeRumors) unsubscribeRumors();
      if (unsubscribeNews) unsubscribeNews();
      if (unsubscribeLeaderboard) unsubscribeLeaderboard();
      if (unsubscribeChat) unsubscribeChat();
      if (unsubscribeTransactions) unsubscribeTransactions();

      if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);

      chartHasStarted = false;
      chart = null;
      initialNewsLoaded = false;

      portfolio = { name: "Gość", cash: 1000, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 }, startValue: 1000, zysk: 0, totalValue: 1000 };
      updatePortfolioUI();
    }
  });
}

async function listenToPortfolioData(userId) {
  if (unsubscribePortfolio) unsubscribePortfolio();
  const userDocRef = doc(db, "uzytkownicy", userId);
  unsubscribePortfolio = onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      portfolio.name = data.name;
      portfolio.cash = data.cash;
      portfolio.shares = data.shares || { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 };
      portfolio.startValue = data.startValue || portfolio.startValue;
      updatePortfolioUI();
      updateUserProfile(data);
    } else {
      console.error("Błąd: Nie znaleziono danych użytkownika!");
    }
  }, (error) => { console.error("Błąd nasłuchu portfela: ", error); });
}

// Rumors
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

// News (with sound)
function listenToMarketNews() {
  if (unsubscribeNews) unsubscribeNews();
  const newsQuery = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(5));
  unsubscribeNews = onSnapshot(newsQuery, (querySnapshot) => {
    if (!dom.newsFeed) return;
    let newItemsAdded = false;
    querySnapshot.docChanges().forEach((change) => {
      if (change.type === "added" && initialNewsLoaded) newItemsAdded = true;
    });
    if (newItemsAdded && dom.audioNews) {
      dom.audioNews.currentTime = 0;
      dom.audioNews.play().catch(() => {});
    }
    dom.newsFeed.innerHTML = "";
    querySnapshot.docs.forEach((doc) => {
      const news = doc.data();
      displayMarketNews(news.text, news.impactType);
    });
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
}

// Chat
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
    messages.forEach((doc) => { displayChatMessage(doc.data()); });
    dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
  }, (error) => { console.error("Błąd nasłuchu czatu: ", error); });
}

function displayChatMessage(msg) {
  if (!dom.chatFeed) return;
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = msg.authorName + ": ";
  p.appendChild(strong);
  p.appendChild(document.createTextNode(msg.text));
  if (msg.authorId === currentUserId) p.style.backgroundColor = "rgba(0, 123, 255, 0.06)";
  dom.chatFeed.appendChild(p);
}

// Leaderboard
function listenToLeaderboard() {
  if (unsubscribeLeaderboard) unsubscribeLeaderboard();
  const leaderboardQuery = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
  unsubscribeLeaderboard = onSnapshot(leaderboardQuery, (querySnapshot) => {
    if (!dom.leaderboardList) return;
    dom.leaderboardList.innerHTML = "";
    let rank = 1;
    querySnapshot.forEach((doc) => {
      const user = doc.data();
      const li = document.createElement("li");
      if (doc.id === currentUserId) li.classList.add("highlight-me");
      let medal = "";
      if (rank === 1) medal = "🥇";
      else if (rank === 2) medal = "🥈";
      else if (rank === 3) medal = "🥉";
      const profit = (user.totalValue || 0) - (user.startValue || 100);
      const profitText = formatujWalute(profit);
      li.innerHTML = `<span>${medal} ${rank}. ${user.name} <small style="display:block;color:var(--text-muted); margin-top:4px">Zysk: ${profitText}</small></span><strong>${formatujWalute(user.totalValue || 0)}</strong>`;
      dom.leaderboardList.appendChild(li);
      rank++;
    });
  }, (error) => {
    console.error("Błąd nasłuchu rankingu: ", error);
  });
}

// --- SEKCJA 5: HANDLERY UŻYTKOWNIKA ---
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
  if (chart) chart.updateSeries([{ data: companyData.history }]);
  updatePriceUI();
}

// Buy max / Sell max
function onBuyMax() {
  if (!currentCompanyId || !market[currentCompanyId]) return;
  const currentPrice = market[currentCompanyId].price;
  const availableCash = portfolio.cash;
  if (currentPrice <= 0) { dom.amountInput.value = 0; return; }
  const maxShares = Math.floor(availableCash / currentPrice);
  dom.amountInput.value = maxShares;
}
function onSellMax() {
  if (!currentCompanyId) return;
  const maxShares = portfolio.shares[currentCompanyId] || 0;
  dom.amountInput.value = maxShares;
}

function buyShares() {
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
  updatePortfolioInFirebase({
    cash: newCash,
    shares: newShares,
    zysk: newZysk,
    totalValue: newTotalValue
  });
  showMessage(`Kupiono ${amount} akcji ${market[currentCompanyId].name}`, "success");
  addTransaction("KUPNO", currentCompanyId, amount, currentPrice);
}

function sellShares() {
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
  updatePortfolioInFirebase({
    cash: newCash,
    shares: newShares,
    zysk: newZysk,
    totalValue: newTotalValue
  });
  showMessage(`Sprzedano ${amount} akcji ${market[currentCompanyId].name}`, "success");
  addTransaction("SPRZEDAŻ", currentCompanyId, amount, currentPrice);
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
      sharesValue += (shares[companyId] || 0) * market[companyId].price;
    }
  }
  return cash + sharesValue;
}

// --- SEKCJA 6: SYMULATOR RYNKU I WYKRES ---
function initChart() {
  const options = {
    series: [{ data: market[currentCompanyId].history }],
    chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
    theme: { mode: 'dark' },
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
    if (chart) chart.updateSeries([{ data: market[currentCompanyId].history }]);
  }, 5000);
}

// --- SEKCJA 7: AKTUALIZACJA UI I NARZĘDZIA ---
function formatujWalute(liczba) {
  const formatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2
  });
  return formatter.format(liczba);
}

function updatePriceUI() {
  if (!dom || !dom.stockPrice) return;
  const company = market[currentCompanyId];
  if (!company) return;
  const oldPriceText = dom.stockPrice.textContent.replace(/\s*zł/g, '').replace(',', '.').replace(/\s/g, '');
  const oldPrice = parseFloat(oldPriceText) || 0;
  dom.stockPrice.textContent = formatujWalute(company.price);
  if (company.price > oldPrice) {
    dom.stockPrice.classList.remove('flash-red');
    dom.stockPrice.classList.add('flash-green');
  } else if (company.price < oldPrice) {
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
  `;
  const totalValue = calculateTotalValue(portfolio.cash, portfolio.shares);
  const totalProfit = totalValue - portfolio.startValue;
  portfolio.totalValue = totalValue;
  portfolio.zysk = totalProfit;
  dom.totalValue.textContent = formatujWalute(totalValue);
  dom.totalProfit.textContent = formatujWalute(totalProfit);
  if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
  else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
  else dom.totalProfit.style.color = "var(--text-muted)";
}

function showMessage(message, type) {
  if (!dom || !dom.messageBox) return;
  dom.messageBox.textContent = message;
  dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
  dom.amountInput.value = "";
  if (type === "error" && dom.audioError) dom.audioError.currentTime = 0, dom.audioError.play().catch(()=>{});
  else if (type === "success" && dom.audioKaching) dom.audioKaching.currentTime = 0, dom.audioKaching.play().catch(()=>{});
}

// Rumors display
function displayNewRumor(text, authorName, sentiment, companyId) {
  if (!dom || !dom.rumorsFeed) return;
  const p = document.createElement("p");
  let prefix = "";
  if (companyId && market[companyId]) prefix = `[${market[companyId].name}] `;
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

function applyRumorSentiment(companyId, sentiment) {
  if (!marketSentiment.hasOwnProperty(companyId)) return;
  const impact = 0.05;
  if (sentiment === "positive") marketSentiment[companyId] = impact;
  else if (sentiment === "negative") marketSentiment[companyId] = -impact;
}

// --- TRANSAKCJE (Historia) ---
async function addTransaction(type, companyId, amount, price) {
  if (!currentUserId) return;
  try {
    await addDoc(collection(db, "transakcje"), {
      userId: currentUserId,
      userName: portfolio.name,
      companyId,
      companyName: market[companyId].name,
      type,
      amount,
      price,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Błąd zapisu transakcji:", error);
  }
}

function listenToTransactions() {
  if (unsubscribeTransactions) unsubscribeTransactions();
  const transQuery = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(12));
  unsubscribeTransactions = onSnapshot(transQuery, (querySnapshot) => {
    if (!dom.historyFeed) return;
    dom.historyFeed.innerHTML = "";
    querySnapshot.forEach(doc => {
      const t = doc.data();
      const p = document.createElement("p");
      const color = t.type === "KUPNO" ? "var(--green)" : "var(--red)";
      let timeText = "";
      try {
        timeText = t.timestamp ? new Date(t.timestamp.toDate()).toLocaleString() : "";
      } catch (e) { timeText = ""; }
      p.innerHTML = `<strong style="color:${color}">${t.type}</strong> ${t.amount}× ${t.companyName} po ${formatujWalute(t.price)} <span style="color:var(--text-muted); font-size:0.9em"> — ${timeText}</span>`;
      dom.historyFeed.appendChild(p);
    });
  }, (err)=>{ console.error("Błąd nasłuchu transakcji:", err); });
}

// --- RUMORS POST ---
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

// --- TRANSACTIONS, PRICE TICKS, SENTIMENT UI ---
function updateMarketSentimentBar() {
  const avg = (marketSentiment.ulanska + marketSentiment.rychbud + marketSentiment.igicorp + marketSentiment.brzozair) / 4;
  if (!dom.sentimentFill || !dom.sentimentLabel) return;
  const percent = Math.round((avg + 0.1) * 50 + 50); // map roughly to 0-100
  const clamped = Math.max(0, Math.min(100, percent));
  dom.sentimentFill.style.width = clamped + "%";
  if (avg > 0.02) {
    dom.sentimentFill.style.background = "var(--green)";
    dom.sentimentLabel.textContent = "Pozytywny sentyment rynku 📈";
  } else if (avg < -0.02) {
    dom.sentimentFill.style.background = "var(--red)";
    dom.sentimentLabel.textContent = "Negatywny sentyment rynku 📉";
  } else {
    dom.sentimentFill.style.background = "var(--text-muted)";
    dom.sentimentLabel.textContent = "Neutralny rynek";
  }
}

// --- DAILY ALERT (toast) ---
function showDailyAlert() {
  // Największa i najmniejsza względna zmiana w ciągu ostatnich świec
  try {
    const names = Object.keys(market);
    if (!names.length) return;
    // porównaj ostatnie dwie świece by oszacować "ruch"
    let best = null, worst = null;
    names.forEach(id => {
      const h = market[id].history;
      if (h.length < 2) return;
      const last = parseFloat(h[h.length - 1].y[3]);
      const prev = parseFloat(h[h.length - 2].y[3]);
      const change = ((last - prev) / (prev || 1));
      if (!best || change > best.change) best = { id, change };
      if (!worst || change < worst.change) worst = { id, change };
    });
    const toast = document.createElement("div");
    toast.className = "toast";
    const bestName = best ? market[best.id].name : "—";
    const worstName = worst ? market[worst.id].name : "—";
    toast.textContent = `Alert: Największy ruch: ${bestName} — największy spadek: ${worstName}`;
    document.body.appendChild(toast);
    setTimeout(()=>toast.classList.add("show"), 80);
    setTimeout(()=>toast.classList.remove("show"), 6000);
    setTimeout(()=>toast.remove(), 6400);
  } catch (e) { console.warn("showDailyAlert error:", e); }
}

// --- USER PROFILE UPDATE ---
function updateUserProfile(data) {
  if (!dom) return;
  if (dom.userAvatar) dom.userAvatar.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(data.name || 'guest')}`;
  if (dom.joinDate && data.joinDate) {
    try { dom.joinDate.textContent = "Dołączył: " + data.joinDate.toDate().toLocaleDateString(); }
    catch (e) { dom.joinDate.textContent = "Dołączył: -"; }
  }
}

// Toggle theme
function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle("light-mode");
  dom.themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("theme", isLight ? "light" : "dark");
}

// --- DODATKOWE FUNKCJE POMOCNICZE ---
// format currency już jest

// --- TRANSAKCJE - nasłuch już zdefiniowany powyżej ---

// --- FUNKCJA WYŚWIETLANA NEWSÓW/PLOTek/INNE ---

// --- FINAL SETUP: START CHART TICKER na starcie (jeśli ceny już są) ---
if (!chart && currentUserId && !chartHasStarted) {
  // dopiero po zalogowaniu chart zainicjalizuje się w onAuthStateChanged
}

// Koniec pliku
