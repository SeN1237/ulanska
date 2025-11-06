// script.js - oczyszczona wersja z naprawionym ApexCharts (ciemny wykres świecowy)

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

function generateInitialCandles(count, basePrice) {
  const data = [];
  let lastClose = basePrice;
  let timestamp = Date.now() - (count * 5000);
  for (let i = 0; i < count; i++) {
    let open = lastClose;
    let close = open + (Math.random() - 0.5) * (basePrice * 0.05);
    let high = Math.max(open, close) + Math.random() * (basePrice * 0.02);
    let low = Math.min(open, close) - Math.random() * (basePrice * 0.02);
    close = Math.max(0.01, close);
    data.push({
      x: new Date(timestamp),
      y: [parseFloat(open.toFixed(2)), parseFloat(high.toFixed(2)), parseFloat(low.toFixed(2)), parseFloat(close.toFixed(2))]
    });
    lastClose = close;
    timestamp += 5000;
  }
  return data;
}

const market = {
  ulanska:  { name: "Ułańska Dev", price: 1.00, history: generateInitialCandles(50, 1) },
  brzozair: { name: "BrzozAir",     price: 1.00, history: generateInitialCandles(50, 1) },
  igicorp:  { name: "IgiCorp",      price: 1.00, history: generateInitialCandles(50, 1) },
  rychbud:  { name: "RychBud",      price: 1.00, history: generateInitialCandles(50, 1) }
};

let currentCompanyId = "ulanska";
const marketSentiment = { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 };

let portfolio = {
  name: "Gość",
  cash: 1000,
  shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
  startValue: 1000,
  zysk: 0,
  totalValue: 1000
};

let chart = null;
let chartHasStarted = false;
let currentUserId = null;
let initialNewsLoaded = false;

let unsubscribePortfolio = null;
let unsubscribeRumors = null;
let unsubscribeNews = null;
let unsubscribeLeaderboard = null;
let unsubscribeChat = null;
let unsubscribeTransactions = null;

const dom = {};

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
      safeInitChart();
      startChartTicker();
      chartHasStarted = true;
    }
  }
}, (err) => { console.error("cenyDocRef snapshot error:", err); });

document.addEventListener("DOMContentLoaded", () => {
  dom.authContainer = document.getElementById("auth-container");
  dom.simulatorContainer = document.getElementById("simulator-container");
  dom.loginForm = document.getElementById("login-form");
  dom.registerForm = document.getElementById("register-form");
  dom.authTitle = document.getElementById("auth-title");
  dom.authMessage = document.getElementById("auth-message");
  dom.switchAuthLink = document.getElementById("switch-auth-link");
  dom.resetPasswordLink = document.getElementById("reset-password-link");
  dom.username = document.getElementById("username");
  dom.logoutButton = document.getElementById("logout-button");
  dom.cash = document.getElementById("cash");
  dom.totalValue = document.getElementById("total-value");
  dom.totalProfit = document.getElementById("total-profit");
  dom.stockPrice = document.getElementById("stock-price");
  dom.amountInput = document.getElementById("amount-input");
  dom.buyButton = document.getElementById("buy-button");
  dom.sellButton = document.getElementById("sell-button");
  dom.buyMaxButton = document.getElementById("buy-max-button");
  dom.sellMaxButton = document.getElementById("sell-max-button");
  dom.messageBox = document.getElementById("message-box");
  dom.chartContainer = document.getElementById("chart-container");
  dom.rumorForm = document.getElementById("rumor-form");
  dom.rumorInput = document.getElementById("rumor-input");
  dom.rumorCompanySelect = document.getElementById("rumor-company-select");
  dom.rumorsFeed = document.getElementById("rumors-feed");
  dom.newsFeed = document.getElementById("news-feed");
  dom.leaderboardList = document.getElementById("leaderboard-list");
  dom.companySelector = document.getElementById("company-selector");
  dom.companyName = document.getElementById("company-name");
  dom.sharesList = document.getElementById("shares-list");
  dom.chatForm = document.getElementById("chat-form");
  dom.chatInput = document.getElementById("chat-input");
  dom.chatFeed = document.getElementById("chat-feed");
  dom.audioKaching = document.getElementById("audio-kaching");
  dom.audioError = document.getElementById("audio-error");
  dom.audioNews = document.getElementById("audio-news");
  dom.themeToggle = document.getElementById("theme-toggle");
  dom.userAvatar = document.getElementById("user-avatar");
  dom.joinDate = document.getElementById("join-date");
  dom.sentimentFill = document.getElementById("sentiment-fill");
  dom.sentimentLabel = document.getElementById("sentiment-label");
  dom.historyFeed = document.getElementById("history-feed");

  dom.switchAuthLink?.addEventListener("click", (e) => { e.preventDefault(); toggleAuthForms(); });

  dom.loginForm?.addEventListener("submit", onLogin);
  dom.registerForm?.addEventListener("submit", onRegister);
  dom.resetPasswordLink?.addEventListener("click", onResetPassword);

  dom.logoutButton?.addEventListener("click", onLogout);
  dom.companySelector?.addEventListener("click", onSelectCompany);
  dom.buyButton?.addEventListener("click", buyShares);
  dom.sellButton?.addEventListener("click", sellShares);
  dom.buyMaxButton?.addEventListener("click", onBuyMax);
  dom.sellMaxButton?.addEventListener("click", onSellMax);

  dom.rumorForm?.addEventListener("submit", onPostRumor);
  dom.chatForm?.addEventListener("submit", onSendMessage);

  dom.themeToggle?.addEventListener("click", toggleTheme);

  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    if (dom.themeToggle) dom.themeToggle.textContent = "☀️";
  } else {
    if (dom.themeToggle) dom.themeToggle.textContent = "🌙";
  }

  setInterval(updateMarketSentimentBar, 2500);
  setInterval(showDailyAlert, 5 * 60 * 1000);
});

function toggleAuthForms() {
  const login = document.getElementById("login-form");
  const register = document.getElementById("register-form");
  const authTitle = document.getElementById("auth-title");
  const switchLink = document.getElementById("switch-auth-link");
  if (!login || !register || !authTitle || !switchLink) return;
  const showingLogin = !login.classList.contains("hidden");
  if (showingLogin) {
    login.classList.add("hidden");
    register.classList.remove("hidden");
    authTitle.textContent = "Rejestracja";
    switchLink.textContent = "Masz konto? Zaloguj się";
  } else {
    register.classList.add("hidden");
    login.classList.remove("hidden");
    authTitle.textContent = "Logowanie";
    switchLink.textContent = "Nie masz konta? Zarejestruj się";
  }
}

async function createInitialUserData(userId, name, email) {
  const userPortfolio = {
    name: name || "Gracz",
    email: email || "",
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
  const name = document.getElementById("register-name")?.value || "Gracz";
  const email = document.getElementById("register-email")?.value;
  const password = document.getElementById("register-password")?.value;
  if (!email || !password) { showAuthMessage("Uzupełnij wymagane pola.", "error"); return; }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await createInitialUserData(userCredential.user.uid, name, email);
    }
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      showAuthMessage("Ten e-mail jest już zajęty. Spróbuj się zalogować.", "error");
    } else {
      showAuthMessage("Błąd rejestracji: " + (error.message || error.code), "error");
    }
  }
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  if (!email || !password) { showAuthMessage("Uzupełnij email i hasło.", "error"); return; }
  try {
    dom.audioKaching?.play().then(()=>dom.audioKaching.pause()).catch(()=>{});
    dom.audioError?.play().then(()=>dom.audioError.pause()).catch(()=>{});
    dom.audioNews?.play().then(()=>dom.audioNews.pause()).catch(()=>{});
  } catch (e) {}
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthMessage("", "info");
  } catch (error) {
    showAuthMessage("Błąd logowania: " + (error.message || error.code), "error");
  }
}

function onLogout() {
  signOut(auth).catch(e => console.error("Logout error:", e));
}

async function onResetPassword(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  if (!email) { showAuthMessage("Wpisz swój e-mail w polu logowania, aby zresetować hasło.", "error"); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMessage("Link do resetowania hasła został wysłany na Twój e-mail!", "success");
  } catch (error) {
    showAuthMessage("Błąd: " + (error.message || error.code), "error");
  }
}

function showAuthMessage(message, type = "info") {
  const el = document.getElementById("auth-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = (type === "error") ? "var(--red)" : "var(--green)";
}

function startAuthListener() {
  onAuthStateChanged(auth, user => {
    if (user) {
      currentUserId = user.uid;
      dom.simulatorContainer?.classList.remove("hidden");
      dom.authContainer?.classList.add("hidden");
      listenToPortfolioData(currentUserId);
      listenToRumors();
      listenToMarketNews();
      listenToLeaderboard();
      listenToChat();
      listenToTransactions();
      if (!chartHasStarted) {
        safeInitChart();
        startChartTicker();
        chartHasStarted = true;
      }
    } else {
      currentUserId = null;
      dom.simulatorContainer?.classList.add("hidden");
      dom.authContainer?.classList.remove("hidden");
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

function listenToPortfolioData(userId) {
  if (unsubscribePortfolio) unsubscribePortfolio();
  const userDocRef = doc(db, "uzytkownicy", userId);
  unsubscribePortfolio = onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      portfolio.name = data.name || portfolio.name;
      portfolio.cash = data.cash !== undefined ? data.cash : portfolio.cash;
      portfolio.shares = data.shares || portfolio.shares;
      portfolio.startValue = data.startValue || portfolio.startValue;
      updatePortfolioUI();
      updateUserProfile(data);
    }
  }, (error) => { console.error("Błąd nasłuchu portfela:", error); });
}

function listenToRumors() {
  if (unsubscribeRumors) unsubscribeRumors();
  const rumorsQuery = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(6));
  unsubscribeRumors = onSnapshot(rumorsQuery, (querySnapshot) => {
    dom.rumorsFeed.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const r = doc.data();
      displayNewRumor(r.text, r.authorName, r.sentiment, r.companyId);
      if (r.sentiment && r.companyId) applyRumorSentiment(r.companyId, r.sentiment);
    });
  }, (error) => { console.error("Błąd nasłuchu plotek:", error); });
}

function listenToMarketNews() {
  if (unsubscribeNews) unsubscribeNews();
  const newsQuery = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(6));
  unsubscribeNews = onSnapshot(newsQuery, (querySnapshot) => {
    if (!dom.newsFeed) return;
    let newItemsAdded = false;
    querySnapshot.docChanges().forEach((change) => {
      if (change.type === "added" && initialNewsLoaded) newItemsAdded = true;
    });
    if (newItemsAdded && dom.audioNews) { dom.audioNews.currentTime = 0; dom.audioNews.play().catch(()=>{}); }
    dom.newsFeed.innerHTML = "";
    querySnapshot.docs.forEach((doc) => {
      const news = doc.data();
      displayMarketNews(news.text, news.impactType);
    });
    initialNewsLoaded = true;
  }, (error) => { console.error("Błąd nasłuchu newsów:", error); });
}

function listenToChat() {
  if (unsubscribeChat) unsubscribeChat();
  const chatQuery = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
  unsubscribeChat = onSnapshot(chatQuery, (querySnapshot) => {
    dom.chatFeed.innerHTML = "";
    const reversed = querySnapshot.docs.slice().reverse();
    reversed.forEach(doc => displayChatMessage(doc.data()));
    dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
  }, (error) => { console.error("Błąd nasłuchu czatu:", error); });
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
      if (doc.id === currentUserId) li.classList.add("highlight-me");
      let medal = "";
      if (rank === 1) medal = "🥇";
      else if (rank === 2) medal = "🥈";
      else if (rank === 3) medal = "🥉";
      const profit = (user.totalValue || 0) - (user.startValue || 0);
      li.innerHTML = `<span>${medal} ${rank}. ${user.name} <small style="display:block;color:var(--text-muted);margin-top:4px">Zysk: ${formatujWalute(profit)}</small></span><strong>${formatujWalute(user.totalValue || 0)}</strong>`;
      dom.leaderboardList.appendChild(li);
      rank++;
    });
  }, (error) => { console.error("Błąd nasłuchu rankingu:", error); });
}

function listenToTransactions() {
  if (unsubscribeTransactions) unsubscribeTransactions();
  const transQuery = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(12));
  unsubscribeTransactions = onSnapshot(transQuery, (querySnapshot) => {
    dom.historyFeed.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const t = doc.data();
      const p = document.createElement("p");
      const color = t.type === "KUPNO" ? "var(--green)" : "var(--red)";
      let timeText = "";
      try { timeText = t.timestamp ? new Date(t.timestamp.toDate()).toLocaleString() : ""; } catch(e){}
      p.innerHTML = `<strong style="color:${color}">${t.type}</strong> ${t.amount}× ${t.companyName} po ${formatujWalute(t.price)} <span style="color:var(--text-muted);font-size:0.9em"> — ${timeText}</span>`;
      dom.historyFeed.appendChild(p);
    });
  }, (error) => { console.error("Błąd nasłuchu transakcji:", error); });
}

function displayMarketNews(text, impactType) {
  if (!dom.newsFeed) return;
  const p = document.createElement("p");
  p.textContent = text;
  if (impactType === "positive") p.style.color = "var(--green)";
  else if (impactType === "negative") p.style.color = "var(--red)";
  dom.newsFeed.prepend(p);
}

function displayNewRumor(text, authorName, sentiment, companyId) {
  if (!dom.rumorsFeed) return;
  const p = document.createElement("p");
  let prefix = "";
  if (companyId && market[companyId]) prefix = `[${market[companyId].name}] `;
  if (sentiment === "positive") p.style.color = "var(--green)";
  else if (sentiment === "negative") p.style.color = "var(--red)";
  p.textContent = prefix + text;
  const authorSpan = document.createElement("span");
  authorSpan.textContent = ` — ${authorName || "Anonim"}`;
  authorSpan.style.color = "var(--text-muted)";
  authorSpan.style.fontStyle = "normal";
  p.appendChild(authorSpan);
  dom.rumorsFeed.prepend(p);
}

function displayChatMessage(msg) {
  if (!dom.chatFeed) return;
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = (msg.authorName || "Anonim") + ": ";
  p.appendChild(strong);
  p.appendChild(document.createTextNode(msg.text));
  if (msg.authorId === currentUserId) p.style.backgroundColor = "rgba(0,123,255,0.06)";
  dom.chatFeed.appendChild(p);
}

async function onSendMessage(e) {
  e.preventDefault();
  const text = dom.chatInput.value.trim();
  if (!text || !currentUserId) return;
  try {
    await addDoc(collection(db, "chat_messages"), {
      text,
      authorName: portfolio.name,
      authorId: currentUserId,
      timestamp: serverTimestamp()
    });
    dom.chatInput.value = "";
  } catch (error) {
    showMessage("Nie udało się wysłać wiadomości.", "error");
    console.error("sendMessage error:", error);
  }
}

async function onPostRumor(e) {
  e.preventDefault();
  const rumorText = dom.rumorInput.value.trim();
  const companyId = dom.rumorCompanySelect?.value;
  const sentimentEl = document.querySelector('input[name="sentiment"]:checked');
  const sentiment = sentimentEl ? sentimentEl.value : "positive";
  if (!rumorText || !currentUserId || !companyId) return;
  try {
    await addDoc(collection(db, "plotki"), {
      text: rumorText,
      authorId: currentUserId,
      authorName: portfolio.name,
      timestamp: Timestamp.fromDate(new Date()),
      companyId,
      sentiment
    });
    dom.rumorInput.value = "";
  } catch (error) {
    console.error("Błąd dodawania plotki:", error);
  }
}

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

function onBuyMax() {
  if (!currentCompanyId) return;
  const price = market[currentCompanyId].price || 1;
  const max = Math.floor(portfolio.cash / price);
  dom.amountInput.value = max;
}

function onSellMax() {
  if (!currentCompanyId) return;
  const max = portfolio.shares[currentCompanyId] || 0;
  dom.amountInput.value = max;
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
    showMessage("Błąd zapisu danych!", "error");
    console.error("updatePortfolioInFirebase error:", error);
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

function safeInitChart() {
  if (typeof ApexCharts === "undefined") {
    setTimeout(safeInitChart, 300);
    return;
  }
  initChart();
}

function initChart() {
  if (!dom.chartContainer) return;
  const options = {
    series: [{ data: market[currentCompanyId].history }],
    chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
    theme: { mode: document.body.classList.contains('light-mode') ? 'light' : 'dark' },
    title: { text: 'Historia cen (świece 5s)', align: 'left', style: { color: '#a3acb9' } },
    xaxis: { type: 'datetime', labels: { style: { colors: '#a3acb9' } } },
    yaxis: { tooltip: { enabled: true }, labels: { formatter: (val) => val.toFixed(2) + " zł", style: { colors: '#a3acb9' } } },
    plotOptions: { candlestick: { colors: { upward: '#28a745', downward: '#dc3545' } } },
    grid: { borderColor: "rgba(255,255,255,0.06)" },
    tooltip: { theme: "dark" }
  };
  if (chart) {
    try { chart.destroy(); } catch (e) {}
    chart = null;
  }
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
      let sentimentImpact = marketSentiment[companyId] || 0;
      const base = company.price;
      const jitter = (Math.random() - 0.5) * (base * 0.01);
      const close = Math.max(0.01, base + sentimentImpact * base + jitter);
      const high = Math.max(open, close) + Math.random() * (base * 0.01);
      const low = Math.min(open, close) - Math.random() * (base * 0.01);

      const newCandle = {
        x: new Date(lastCandle.x.getTime() + 5000),
        y: [parseFloat(open.toFixed(2)), parseFloat(high.toFixed(2)), parseFloat(low.toFixed(2)), parseFloat(close.toFixed(2))]
      };

      history.push(newCandle);
      if (history.length > 60) history.shift();
    }

    if (chart) {
      try { chart.updateSeries([{ data: market[currentCompanyId].history }]); } catch (e) {}
    }
  }, 5000);
}

function formatujWalute(liczba) {
  const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
  return formatter.format(liczba);
}

function updatePriceUI() {
  if (!dom.stockPrice) return;
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
  if (!dom.username) return;
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
  dom.totalProfit.style.color = totalProfit > 0 ? "var(--green)" : (totalProfit < 0 ? "var(--red)" : "var(--text-muted)");
}

function showMessage(message, type) {
  if (!dom.messageBox) return;
  dom.messageBox.textContent = message;
  dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
  dom.amountInput.value = "";
  if (type === "success") dom.audioKaching?.play().catch(()=>{});
  if (type === "error") dom.audioError?.play().catch(()=>{});
}

function applyRumorSentiment(companyId, sentiment) {
  if (!marketSentiment.hasOwnProperty(companyId)) return;
  const impact = 0.03;
  marketSentiment[companyId] = (sentiment === "positive") ? impact : -impact;
  setTimeout(()=> { marketSentiment[companyId] = 0; }, 30 * 1000);
}

function updateMarketSentimentBar() {
  const avg = (marketSentiment.ulanska + marketSentiment.rychbud + marketSentiment.igicorp + marketSentiment.brzozair) / 4;
  if (!dom.sentimentFill || !dom.sentimentLabel) return;
  const percent = Math.round((avg + 0.1) * 50 + 50);
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

function showDailyAlert() {
  try {
    const names = Object.keys(market);
    if (!names.length) return;
    let best = null, worst = null;
    names.forEach(id => {
      const h = market[id].history;
      if (h.length < 2) return;
      const last = parseFloat(h[h.length - 1].y[3]);
      const prev = parseFloat(h[h.length - 2].y[3]) || 1;
      const change = ((last - prev) / prev);
      if (!best || change > best.change) best = { id, change };
      if (!worst || change < worst.change) worst = { id, change };
    });
    const toast = document.createElement("div");
    toast.className = "toast";
    const bestName = best ? market[best.id].name : "—";
    const worstName = worst ? market[worst.id].name : "—";
    toast.textContent = `Alert: Największy wzrost: ${bestName} — Największy spadek: ${worstName}`;
    document.body.appendChild(toast);
    setTimeout(()=>toast.classList.add("show"), 80);
    setTimeout(()=>toast.classList.remove("show"), 6000);
    setTimeout(()=>toast.remove(), 6400);
  } catch (e) { console.error("showDailyAlert error:", e); }
}

function updateUserProfile(data) {
  if (!dom) return;
  if (dom.userAvatar) dom.userAvatar.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(data.name || 'guest')}`;
  if (dom.joinDate && data.joinDate) {
    try { dom.joinDate.textContent = "Dołączył: " + data.joinDate.toDate().toLocaleDateString(); } catch (e) { dom.joinDate.textContent = "Dołączył: -"; }
  }
}

function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle("light-mode");
  if (dom.themeToggle) dom.themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("theme", isLight ? "light" : "dark");
}

function onSelectCompany(e) {
  if (e.target.classList.contains("company-tab")) {
    changeCompany(e.target.dataset.company);
  }
}

function changeCompany(companyId) {
  if (!market[companyId]) return;
  currentCompanyId = companyId;
  document.querySelectorAll(".company-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.company === companyId));
  dom.companyName.textContent = market[companyId].name;
  if (chart) {
    try { chart.updateSeries([{ data: market[currentCompanyId].history }]); } catch (e) {}
  } else {
    safeInitChart();
  }
  updatePriceUI();
}
