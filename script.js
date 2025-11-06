// script.js - skonsolidowana, poprawiona wersja
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

/* ---------- initial market data ---------- */
function generateInitialCandles(count, basePrice) {
  const data = [];
  let lastClose = basePrice;
  let t = Date.now() - count * 5000;
  for (let i = 0; i < count; i++) {
    const open = lastClose;
    const close = Math.max(0.01, open + (Math.random() - 0.5) * (basePrice * 0.05));
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.02);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.02);
    data.push({ x: new Date(t), y: [parseFloat(open.toFixed(2)), parseFloat(high.toFixed(2)), parseFloat(low.toFixed(2)), parseFloat(close.toFixed(2))] });
    lastClose = close;
    t += 5000;
  }
  return data;
}

const market = {
  ulanska:  { name: "Ułańska Dev", price: 1.00, history: generateInitialCandles(50, 1.0) },
  brzozair: { name: "BrzozAir",     price: 1.00, history: generateInitialCandles(50, 1.0) },
  igicorp:  { name: "IgiCorp",      price: 1.00, history: generateInitialCandles(50, 1.0) },
  rychbud:  { name: "RychBud",      price: 1.00, history: generateInitialCandles(50, 1.0) }
};

let currentCompanyId = "ulanska";
const marketSentiment = { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 };

/* ---------- user portfolio ---------- */
let portfolio = {
  name: "Gość",
  cash: 1000,
  shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
  startValue: 1000,
  zysk: 0,
  totalValue: 1000
};

/* ---------- app state ---------- */
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

/* ---------- listen to global prices (optional) ---------- */
const cenyDocRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyDocRef, (snap) => {
  if (!snap.exists()) return;
  const d = snap.data();
  for (const k in d) if (market[k]) market[k].price = d[k];
  updatePriceUI();
  updatePortfolioUI();
  if (currentUserId && !chartHasStarted) {
    safeInitChart();
    startChartTicker();
    chartHasStarted = true;
  }
}, (err) => console.error("ceny snapshot:", err));

/* ---------- DOMContentLoaded: cache DOM and attach events ---------- */
document.addEventListener("DOMContentLoaded", () => {
  dom.authContainer = document.getElementById("auth-container");
  dom.simulatorContainer = document.getElementById("simulator-container");
  dom.loginForm = document.getElementById("login-form");
  dom.registerForm = document.getElementById("register-form");
  dom.authTitle = document.getElementById("auth-title");
  dom.switchAuthLink = document.getElementById("switch-auth-link");
  dom.resetPasswordLink = document.getElementById("reset-password-link");
  dom.authMessage = document.getElementById("auth-message");
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
    dom.themeToggle.textContent = "☀️";
  } else {
    dom.themeToggle.textContent = "🌙";
  }

  setInterval(updateMarketSentimentBar, 2500);
  setInterval(showDailyAlert, 5 * 60 * 1000);

  // Start auth listener after DOM ready
  setTimeout(() => startAuthListener(), 250);
});

/* ---------- auth UI helpers ---------- */
function toggleAuthForms() {
  const login = document.getElementById("login-form");
  const register = document.getElementById("register-form");
  const title = document.getElementById("auth-title");
  const link = document.getElementById("switch-auth-link");
  if (!login || !register) return;
  const showingLogin = !login.classList.contains("hidden");
  if (showingLogin) {
    login.classList.add("hidden");
    register.classList.remove("hidden");
    title.textContent = "Rejestracja";
    link.textContent = "Masz konto? Zaloguj się";
  } else {
    register.classList.add("hidden");
    login.classList.remove("hidden");
    title.textContent = "Logowanie";
    link.textContent = "Nie masz konta? Zarejestruj się";
  }
}

/* ---------- auth actions ---------- */
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
  await setDoc(doc(db, "uzytkownicy", userId), userPortfolio);
}

async function onRegister(e) {
  e.preventDefault();
  const name = document.getElementById("register-name")?.value || "Gracz";
  const email = document.getElementById("register-email")?.value;
  const password = document.getElementById("register-password")?.value;
  if (!email || !password) return showAuthMessage("Uzupełnij wymagane pola.", "error");
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await createInitialUserData(credential.user.uid, name, email);
  } catch (err) {
    showAuthMessage(err.code === "auth/email-already-in-use" ? "Ten e-mail jest już zajęty." : "Błąd rejestracji.", "error");
  }
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  if (!email || !password) return showAuthMessage("Podaj e-mail i hasło.", "error");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthMessage("");
  } catch {
    showAuthMessage("Błędny e-mail lub hasło.", "error");
  }
}

function onLogout() { signOut(auth).catch(()=>{}); }

async function onResetPassword(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  if (!email) return showAuthMessage("Wpisz e-mail aby zresetować hasło.", "error");
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMessage("Link resetujący wysłany!", "success");
  } catch {
    showAuthMessage("Błąd wysyłki linku.", "error");
  }
}

function showAuthMessage(msg, type = "info") {
  if (!dom.authMessage) return;
  dom.authMessage.textContent = msg;
  dom.authMessage.style.color = type === "error" ? "var(--red)" : "var(--green)";
}

/* ---------- auth state listener (single defined) ---------- */
function startAuthListener() {
  onAuthStateChanged(auth, (user) => {
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

/* ---------- Firestore listeners ---------- */
function listenToPortfolioData(userId) {
  if (unsubscribePortfolio) unsubscribePortfolio();
  const ref = doc(db, "uzytkownicy", userId);
  unsubscribePortfolio = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    portfolio.name = d.name || portfolio.name;
    portfolio.cash = d.cash !== undefined ? d.cash : portfolio.cash;
    portfolio.shares = d.shares || portfolio.shares;
    portfolio.startValue = d.startValue || portfolio.startValue;
    updatePortfolioUI();
    updateUserProfile(d);
  }, (err) => console.error("portfolio listen:", err));
}

function listenToRumors() {
  if (unsubscribeRumors) unsubscribeRumors();
  const q = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(6));
  unsubscribeRumors = onSnapshot(q, (snap) => {
    dom.rumorsFeed.innerHTML = "";
    snap.forEach(doc => {
      const r = doc.data();
      displayNewRumor(r.text, r.authorName, r.sentiment, r.companyId);
      if (r.sentiment && r.companyId) applyRumorSentiment(r.companyId, r.sentiment);
    });
  }, (err) => console.error("rumors listen:", err));
}

function listenToMarketNews() {
  if (unsubscribeNews) unsubscribeNews();
  const q = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(6));
  unsubscribeNews = onSnapshot(q, (snap) => {
    if (!dom.newsFeed) return;
    let newItems = false;
    snap.docChanges().forEach(c => { if (c.type === "added" && initialNewsLoaded) newItems = true; });
    if (newItems) dom.audioNews?.play().catch(()=>{});
    dom.newsFeed.innerHTML = "";
    snap.docs.forEach(d => displayMarketNews(d.data().text, d.data().impactType));
    initialNewsLoaded = true;
  }, (err) => console.error("news listen:", err));
}

function listenToChat() {
  if (unsubscribeChat) unsubscribeChat();
  const q = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
  unsubscribeChat = onSnapshot(q, (snap) => {
    dom.chatFeed.innerHTML = "";
    const reversed = snap.docs.slice().reverse();
    reversed.forEach(d => displayChatMessage(d.data()));
    dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
  }, (err) => console.error("chat listen:", err));
}

function listenToLeaderboard() {
  if (unsubscribeLeaderboard) unsubscribeLeaderboard();
  const q = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
  unsubscribeLeaderboard = onSnapshot(q, (snap) => {
    dom.leaderboardList.innerHTML = "";
    let rank = 1;
    snap.forEach(doc => {
      const u = doc.data();
      const li = document.createElement("li");
      if (doc.id === currentUserId) li.classList.add("highlight-me");
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
      const profit = (u.totalValue || 0) - (u.startValue || 0);
      li.innerHTML = `<span>${medal} ${rank}. ${u.name} <small style="display:block;color:var(--text-muted);margin-top:4px">Zysk: ${formatujWalute(profit)}</small></span><strong>${formatujWalute(u.totalValue || 0)}</strong>`;
      dom.leaderboardList.appendChild(li);
      rank++;
    });
  }, (err) => console.error("leaderboard listen:", err));
}

function listenToTransactions() {
  if (unsubscribeTransactions) unsubscribeTransactions();
  const q = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(12));
  unsubscribeTransactions = onSnapshot(q, (snap) => {
    dom.historyFeed.innerHTML = "";
    snap.forEach(doc => {
      const t = doc.data();
      const p = document.createElement("p");
      const color = t.type === "KUPNO" ? "var(--green)" : "var(--red)";
      let timeText = "";
      try { timeText = t.timestamp ? new Date(t.timestamp.toDate()).toLocaleString() : ""; } catch(e){}
      p.innerHTML = `<strong style="color:${color}">${t.type}</strong> ${t.amount}× ${t.companyName} po ${formatujWalute(t.price)} <span style="color:var(--text-muted);font-size:0.9em"> — ${timeText}</span>`;
      dom.historyFeed.appendChild(p);
    });
  }, (err) => console.error("transactions listen:", err));
}

/* ---------- UI display helpers ---------- */
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
  const prefix = companyId && market[companyId] ? `[${market[companyId].name}] ` : "";
  if (sentiment === "positive") p.style.color = "var(--green)";
  else if (sentiment === "negative") p.style.color = "var(--red)";
  p.textContent = prefix + text;
  const a = document.createElement("span");
  a.textContent = ` — ${authorName || "Anonim"}`;
  a.style.color = "var(--text-muted)";
  p.appendChild(a);
  dom.rumorsFeed.prepend(p);
}

function displayChatMessage(msg) {
  if (!dom.chatFeed) return;
  const p = document.createElement("p");
  const s = document.createElement("strong");
  s.textContent = (msg.authorName || "Anonim") + ": ";
  p.appendChild(s);
  p.appendChild(document.createTextNode(msg.text));
  if (msg.authorId === currentUserId) p.style.backgroundColor = "rgba(0,123,255,0.06)";
  dom.chatFeed.appendChild(p);
}

/* ---------- sending ---------- */
async function onSendMessage(e) {
  e.preventDefault();
  const text = dom.chatInput.value.trim();
  if (!text || !currentUserId) return;
  try {
    await addDoc(collection(db, "chat_messages"), { text, authorName: portfolio.name, authorId: currentUserId, timestamp: serverTimestamp() });
    dom.chatInput.value = "";
  } catch (err) { console.error("send msg:", err); showMessage("Nie udało się wysłać wiadomości.", "error"); }
}

async function onPostRumor(e) {
  e.preventDefault();
  const text = dom.rumorInput.value.trim();
  const companyId = dom.rumorCompanySelect?.value;
  const sentimentEl = document.querySelector('input[name="sentiment"]:checked');
  const sentiment = sentimentEl ? sentimentEl.value : "positive";
  if (!text || !currentUserId || !companyId) return;
  try {
    await addDoc(collection(db, "plotki"), { text, authorId: currentUserId, authorName: portfolio.name, timestamp: Timestamp.fromDate(new Date()), companyId, sentiment });
    dom.rumorInput.value = "";
  } catch (err) { console.error("post rumor:", err); }
}

/* ---------- trading ---------- */
async function addTransaction(type, companyId, amount, price) {
  if (!currentUserId) return;
  try {
    await addDoc(collection(db, "transakcje"), { userId: currentUserId, userName: portfolio.name, companyId, companyName: market[companyId].name, type, amount, price, timestamp: serverTimestamp() });
  } catch (err) { console.error("add trans:", err); }
}

function onBuyMax() {
  if (!currentCompanyId) return;
  const price = market[currentCompanyId].price || 1;
  dom.amountInput.value = Math.floor(portfolio.cash / price);
}

function onSellMax() {
  if (!currentCompanyId) return;
  dom.amountInput.value = portfolio.shares[currentCompanyId] || 0;
}

function buyShares() {
  const amount = parseInt(dom.amountInput.value);
  const price = market[currentCompanyId].price;
  if (isNaN(amount) || amount <= 0) return showMessage("Wpisz poprawną ilość.", "error");
  const cost = amount * price;
  if (cost > portfolio.cash) return showMessage("Brak wystarczającej gotówki.", "error");
  const newCash = portfolio.cash - cost;
  const newShares = { ...portfolio.shares }; newShares[currentCompanyId] = (newShares[currentCompanyId] || 0) + amount;
  const total = calculateTotalValue(newCash, newShares);
  updatePortfolioInFirebase({ cash: newCash, shares: newShares, zysk: total - portfolio.startValue, totalValue: total });
  showMessage(`Kupiono ${amount} akcji ${market[currentCompanyId].name}`, "success");
  addTransaction("KUPNO", currentCompanyId, amount, price);
}

function sellShares() {
  const amount = parseInt(dom.amountInput.value);
  const price = market[currentCompanyId].price;
  if (isNaN(amount) || amount <= 0) return showMessage("Wpisz poprawną ilość.", "error");
  if (amount > (portfolio.shares[currentCompanyId] || 0)) return showMessage("Nie masz tylu akcji tej spółki.", "error");
  const revenue = amount * price;
  const newCash = portfolio.cash + revenue;
  const newShares = { ...portfolio.shares }; newShares[currentCompanyId] -= amount;
  const total = calculateTotalValue(newCash, newShares);
  updatePortfolioInFirebase({ cash: newCash, shares: newShares, zysk: total - portfolio.startValue, totalValue: total });
  showMessage(`Sprzedano ${amount} akcji ${market[currentCompanyId].name}`, "success");
  addTransaction("SPRZEDAŻ", currentCompanyId, amount, price);
}

async function updatePortfolioInFirebase(data) {
  if (!currentUserId) return;
  try {
    await updateDoc(doc(db, "uzytkownicy", currentUserId), data);
  } catch (err) { console.error("update portfolio:", err); showMessage("Błąd zapisu danych!", "error"); }
}

function calculateTotalValue(cash, shares) {
  let v = 0;
  for (const id in shares) if (market[id]) v += (shares[id] || 0) * market[id].price;
  return cash + v;
}

/* ---------- ApexCharts safe init + chart ticker ---------- */
function safeInitChart(company = currentCompanyId) {
  if (typeof ApexCharts === "undefined") {
    setTimeout(() => safeInitChart(company), 300);
    return;
  }
  initChart(company);
}

function initChart(company = currentCompanyId) {
  if (!dom.chartContainer) return;
  if (chart) { try { chart.destroy(); } catch(e){} chart = null; }
  const options = {
    series: [{ data: market[company].history }],
    chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
    theme: { mode: document.body.classList.contains('light-mode') ? 'light' : 'dark' },
    title: { text: 'Historia cen (świece 5s)', align: 'left', style: { color: '#a3acb9' } },
    xaxis: { type: 'datetime', labels: { style: { colors: '#a3acb9' } } },
    yaxis: { tooltip: { enabled: true }, labels: { formatter: (val) => val.toFixed(2) + " zł", style: { colors: '#a3acb9' } } },
    plotOptions: { candlestick: { colors: { upward: '#28a745', downward: '#dc3545' } } },
    grid: { borderColor: "rgba(255,255,255,0.06)" },
    tooltip: { theme: "dark" }
  };
  chart = new ApexCharts(dom.chartContainer, options);
  chart.render();
}

function startChartTicker() {
  if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
  window.chartTickerInterval = setInterval(() => {
    for (const id in market) {
      const comp = market[id];
      const history = comp.history;
      if (!history.length) continue;
      const last = history[history.length - 1];
      const lastClose = parseFloat(last.y[3]);
      const open = lastClose;
      const sentimentImpact = marketSentiment[id] || 0;
      const base = comp.price;
      const jitter = (Math.random() - 0.5) * (base * 0.01);
      const close = Math.max(0.01, base + sentimentImpact * base + jitter);
      const high = Math.max(open, close) + Math.random() * (base * 0.01);
      const low = Math.min(open, close) - Math.random() * (base * 0.01);
      const newCandle = { x: new Date(last.x.getTime() + 5000), y: [parseFloat(open.toFixed(2)), parseFloat(high.toFixed(2)), parseFloat(low.toFixed(2)), parseFloat(close.toFixed(2))] };
      history.push(newCandle);
      if (history.length > 60) history.shift();
    }
    if (chart) { try { chart.updateSeries([{ data: market[currentCompanyId].history }]); } catch(e){} }
  }, 5000);
}

/* ---------- UI update helpers ---------- */
function formatujWalute(n) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).format(n);
}

function updatePriceUI() {
  if (!dom.stockPrice) return;
  const c = market[currentCompanyId];
  if (!c) return;
  const oldText = dom.stockPrice.textContent.replace(/\s*zł/g, '').replace(',', '.').replace(/\s/g, '');
  const old = parseFloat(oldText) || 0;
  dom.stockPrice.textContent = formatujWalute(c.price);
  if (c.price > old) { dom.stockPrice.classList.remove('flash-red'); dom.stockPrice.classList.add('flash-green'); }
  else if (c.price < old) { dom.stockPrice.classList.remove('flash-green'); dom.stockPrice.classList.add('flash-red'); }
  dom.stockPrice.addEventListener('animationend', () => { dom.stockPrice.classList.remove('flash-green','flash-red'); }, { once: true });
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
  const total = calculateTotalValue(portfolio.cash, portfolio.shares);
  const profit = total - portfolio.startValue;
  portfolio.totalValue = total;
  portfolio.zysk = profit;
  dom.totalValue.textContent = formatujWalute(total);
  dom.totalProfit.textContent = formatujWalute(profit);
  dom.totalProfit.style.color = profit > 0 ? "var(--green)" : (profit < 0 ? "var(--red)" : "var(--text-muted)");
}

function showMessage(text, type) {
  if (!dom.messageBox) return;
  dom.messageBox.textContent = text;
  dom.messageBox.style.color = type === "error" ? "var(--red)" : "var(--green)";
  dom.amountInput.value = "";
  if (type === "success") dom.audioKaching?.play().catch(()=>{});
  if (type === "error") dom.audioError?.play().catch(()=>{});
}

/* ---------- sentiment / rumors impact ---------- */
function applyRumorSentiment(companyId, sentiment) {
  if (!marketSentiment.hasOwnProperty(companyId)) return;
  marketSentiment[companyId] = (sentiment === "positive") ? 0.03 : -0.03;
  setTimeout(()=> marketSentiment[companyId] = 0, 30 * 1000);
}

function updateMarketSentimentBar() {
  const avg = (marketSentiment.ulanska + marketSentiment.rychbud + marketSentiment.igicorp + marketSentiment.brzozair) / 4;
  if (!dom.sentimentFill || !dom.sentimentLabel) return;
  const percent = Math.round((avg + 0.1) * 50 + 50);
  const p = Math.max(0, Math.min(100, percent));
  dom.sentimentFill.style.width = p + "%";
  if (avg > 0.02) { dom.sentimentFill.style.background = "var(--green)"; dom.sentimentLabel.textContent = "Pozytywny sentyment rynku 📈"; }
  else if (avg < -0.02) { dom.sentimentFill.style.background = "var(--red)"; dom.sentimentLabel.textContent = "Negatywny sentyment rynku 📉"; }
  else { dom.sentimentFill.style.background = "var(--text-muted)"; dom.sentimentLabel.textContent = "Neutralny rynek"; }
}

/* ---------- toast alert ---------- */
function showDailyAlert() {
  try {
    const ids = Object.keys(market);
    if (!ids.length) return;
    let best = null, worst = null;
    ids.forEach(id => {
      const h = market[id].history;
      if (h.length < 2) return;
      const last = parseFloat(h[h.length - 1].y[3]);
      const prev = parseFloat(h[h.length - 2].y[3]) || 1;
      const change = (last - prev) / prev;
      if (!best || change > best.change) best = { id, change };
      if (!worst || change < worst.change) worst = { id, change };
    });
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = `Alert: Największy wzrost: ${best ? market[best.id].name : '—'} — Największy spadek: ${worst ? market[worst.id].name : '—'}`;
    document.body.appendChild(toast);
    setTimeout(()=> toast.classList.add("show"), 80);
    setTimeout(()=> toast.classList.remove("show"), 6000);
    setTimeout(()=> toast.remove(), 6400);
  } catch (e) { console.error("showDailyAlert:", e); }
}

/* ---------- user profile ---------- */
function updateUserProfile(data) {
  if (!dom) return;
  if (dom.userAvatar) dom.userAvatar.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(data.name || 'guest')}`;
  if (dom.joinDate && data.joinDate) {
    try { dom.joinDate.textContent = "Dołączył: " + data.joinDate.toDate().toLocaleDateString(); } catch(e) { dom.joinDate.textContent = "Dołączył: -"; }
  }
}

/* ---------- theme toggle ---------- */
function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle("light-mode");
  if (dom.themeToggle) dom.themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("theme", isLight ? "light" : "dark");
}

/* ---------- company switch ---------- */
function onSelectCompany(e) {
  if (e.target.classList.contains("company-tab")) changeCompany(e.target.dataset.company);
}

function changeCompany(companyId) {
  if (!market[companyId]) return;
  currentCompanyId = companyId;
  document.querySelectorAll(".company-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.company === companyId));
  dom.companyName.textContent = market[companyId].name;
  if (chart) {
    try { chart.updateSeries([{ data: market[currentCompanyId].history }]); } catch(e){}
  } else {
    safeInitChart();
  }
  updatePriceUI();
}
