// === script.js (oczyszczony, poprawiony) ===

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, onSnapshot, updateDoc,
  collection, addDoc, query, orderBy, limit, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- Firebase config ---
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

// --- Market init ---
function generateInitialCandles(count, base) {
  const data = [];
  let lastClose = base;
  let t = Date.now() - count * 5000;
  for (let i = 0; i < count; i++) {
    const open = lastClose;
    const close = Math.max(0.01, open + (Math.random() - 0.5) * base * 0.05);
    const high = Math.max(open, close) + Math.random() * base * 0.02;
    const low = Math.min(open, close) - Math.random() * base * 0.02;
    data.push({
      x: new Date(t),
      y: [
        parseFloat(open.toFixed(2)),
        parseFloat(high.toFixed(2)),
        parseFloat(low.toFixed(2)),
        parseFloat(close.toFixed(2))
      ]
    });
    lastClose = close;
    t += 5000;
  }
  return data;
}

const market = {
  ulanska: { name: "Ułańska Dev", price: 1.00, history: generateInitialCandles(50, 1) },
  rychbud: { name: "RychBud", price: 1.00, history: generateInitialCandles(50, 1) },
  igicorp: { name: "IgiCorp", price: 1.00, history: generateInitialCandles(50, 1) },
  brzozair: { name: "BrzozAir", price: 1.00, history: generateInitialCandles(50, 1) }
};

let currentCompanyId = "ulanska";
let portfolio = { name: "Gość", cash: 1000, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 }, startValue: 1000, zysk: 0, totalValue: 1000 };
let dom = {};
let chart = null;
let chartHasStarted = false;
let currentUserId = null;

// --- DOM init ---
document.addEventListener("DOMContentLoaded", () => {
  dom = {
    authContainer: document.getElementById("auth-container"),
    simulatorContainer: document.getElementById("simulator-container"),
    loginForm: document.getElementById("login-form"),
    registerForm: document.getElementById("register-form"),
    switchAuthLink: document.getElementById("switch-auth-link"),
    switchToLogin: document.getElementById("switch-to-login"),
    authMessage: document.getElementById("auth-message"),
    username: document.getElementById("username"),
    joinDate: document.getElementById("join-date"),
    logoutButton: document.getElementById("logout-button"),
    stockPrice: document.getElementById("stock-price"),
    chartContainer: document.getElementById("chart-container"),
    companySelector: document.getElementById("company-selector"),
    companyName: document.getElementById("company-name"),
    cash: document.getElementById("cash"),
    sharesList: document.getElementById("shares-list"),
    totalValue: document.getElementById("total-value"),
    totalProfit: document.getElementById("total-profit"),
    amountInput: document.getElementById("amount-input"),
    buyButton: document.getElementById("buy-button"),
    sellButton: document.getElementById("sell-button"),
    buyMaxButton: document.getElementById("buy-max-button"),
    sellMaxButton: document.getElementById("sell-max-button"),
    messageBox: document.getElementById("message-box"),
    rumorForm: document.getElementById("rumor-form"),
    rumorInput: document.getElementById("rumor-input"),
    rumorCompanySelect: document.getElementById("rumor-company-select"),
    rumorsFeed: document.getElementById("rumors-feed"),
    newsFeed: document.getElementById("news-feed"),
    leaderboardList: document.getElementById("leaderboard-list"),
    historyFeed: document.getElementById("history-feed"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    chatFeed: document.getElementById("chat-feed"),
    themeToggle: document.getElementById("theme-toggle"),
    userAvatar: document.getElementById("user-avatar")
  };

  dom.switchAuthLink?.addEventListener("click", e => { e.preventDefault(); toggleAuthForms(); });
  dom.switchToLogin?.addEventListener("click", e => { e.preventDefault(); toggleAuthForms(); });

  dom.loginForm?.addEventListener("submit", onLogin);
  dom.registerForm?.addEventListener("submit", onRegister);
  dom.logoutButton?.addEventListener("click", () => signOut(auth));

  dom.companySelector?.addEventListener("click", onSelectCompany);
  dom.buyButton?.addEventListener("click", buyShares);
  dom.sellButton?.addEventListener("click", sellShares);
  dom.buyMaxButton?.addEventListener("click", onBuyMax);
  dom.sellMaxButton?.addEventListener("click", onSellMax);
  dom.rumorForm?.addEventListener("submit", onPostRumor);
  dom.chatForm?.addEventListener("submit", onSendMessage);
  dom.themeToggle?.addEventListener("click", toggleTheme);

  startAuthListener();
});

// --- Auth ---
async function onRegister(e) {
  e.preventDefault();
  const name = document.getElementById("register-name")?.value || "Gracz";
  const email = document.getElementById("register-email")?.value;
  const password = document.getElementById("register-password")?.value;
  if (!email || !password) return showAuthMessage("Uzupełnij pola.", "error");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "uzytkownicy", cred.user.uid), {
      name, email, cash: 1000, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
      startValue: 1000, zysk: 0, totalValue: 1000, joinDate: Timestamp.fromDate(new Date())
    });
  } catch (e) { showAuthMessage("Błąd rejestracji.", "error"); }
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  if (!email || !password) return showAuthMessage("Podaj e-mail i hasło.", "error");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthMessage("");
  } catch (e) { showAuthMessage("Błędny e-mail lub hasło.", "error"); }
}

function startAuthListener() {
  onAuthStateChanged(auth, user => {
    if (user) {
      currentUserId = user.uid;
      dom.authContainer?.classList.add("hidden");
      dom.simulatorContainer?.classList.remove("hidden");
      initListeners();
      if (!chartHasStarted) {
        safeInitChart();
        startChartTicker();
        chartHasStarted = true;
      }
    } else {
      currentUserId = null;
      dom.authContainer?.classList.remove("hidden");
      dom.simulatorContainer?.classList.add("hidden");
      stopListeners();
      clearInterval(window.chartTickerInterval);
      chartHasStarted = false;
      chart = null;
    }
  });
}

// --- Firestore listeners ---
function initListeners() {
  listenToPortfolioData(currentUserId);
  listenToRumors();
  listenToMarketNews();
  listenToLeaderboard();
  listenToChat();
  listenToTransactions();
}
function stopListeners() {}

// Portfolio
function listenToPortfolioData(uid) {
  if (!uid) return;
  const ref = doc(db, "uzytkownicy", uid);
  onSnapshot(ref, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    portfolio = { ...portfolio, ...d };
    updatePortfolioUI();
    updateUserProfile(d);
  });
}

// Rumors
function listenToRumors() {
  const q = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(8));
  onSnapshot(q, snap => {
    dom.rumorsFeed.innerHTML = "";
    snap.forEach(docSnap => {
      const r = docSnap.data();
      const p = document.createElement("p");
      p.textContent = `[${market[r.companyId]?.name || r.companyId}] ${r.text} — ${r.authorName || "Anonim"}`;
      dom.rumorsFeed.prepend(p);
      if (r.sentiment && r.companyId) applyRumorSentiment(r.companyId, r.sentiment);
    });
  });
}

// News
function listenToMarketNews() {
  const q = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(6));
  onSnapshot(q, snap => {
    dom.newsFeed.innerHTML = "";
    snap.forEach(docSnap => {
      const n = docSnap.data();
      const p = document.createElement("p");
      p.textContent = n.text;
      dom.newsFeed.prepend(p);
    });
  });
}

// Leaderboard
function listenToLeaderboard() {
  const q = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
  onSnapshot(q, snap => {
    dom.leaderboardList.innerHTML = "";
    let rank = 1;
    snap.forEach(docSnap => {
      const u = docSnap.data();
      const li = document.createElement("li");
      li.textContent = `${rank}. ${u.name} — ${formatujWalute(u.totalValue || 0)}`;
      if (docSnap.id === currentUserId) li.style.fontWeight = "700";
      dom.leaderboardList.appendChild(li);
      rank++;
    });
  });
}

// Chat
function listenToChat() {
  const q = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
  onSnapshot(q, snap => {
    dom.chatFeed.innerHTML = "";
    snap.docs.slice().reverse().forEach(d => {
      const m = d.data();
      const p = document.createElement("p");
      p.textContent = `${m.authorName || "Anonim"}: ${m.text}`;
      dom.chatFeed.appendChild(p);
    });
    dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
  });
}

// Transactions
function listenToTransactions() {
  const q = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(12));
  onSnapshot(q, snap => {
    dom.historyFeed.innerHTML = "";
    snap.forEach(d => {
      const t = d.data();
      const p = document.createElement("p");
      p.textContent = `${t.type} ${t.amount}× ${t.companyName} po ${t.price} zł`;
      dom.historyFeed.appendChild(p);
    });
  });
}

// --- Chart ---
function safeInitChart(company = currentCompanyId) {
  if (typeof ApexCharts === "undefined") { setTimeout(() => safeInitChart(company), 300); return; }
  initChart(company);
}
function initChart(company = currentCompanyId) {
  if (!dom.chartContainer) return;
  if (chart) chart.destroy();
  const options = {
    series: [{ data: market[company].history }],
    chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
    theme: { mode: 'dark' },
    xaxis: { type: 'datetime' },
    yaxis: { tooltip: { enabled: true } },
    plotOptions: { candlestick: { colors: { upward: '#22c55e', downward: '#ef4444' } } }
  };
  chart = new ApexCharts(dom.chartContainer, options);
  chart.render();
}
function startChartTicker() {
  clearInterval(window.chartTickerInterval);
  window.chartTickerInterval = setInterval(() => {
    for (const id in market) {
      const c = market[id];
      const last = c.history[c.history.length - 1];
      const open = last.y[3];
      const close = open + (Math.random() - 0.5) * 0.02;
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      c.history.push({ x: new Date(), y: [open, high, low, close].map(v => parseFloat(v.toFixed(2))) });
      if (c.history.length > 60) c.history.shift();
    }
    chart?.updateSeries([{ data: market[currentCompanyId].history }]);
  }, 5000);
}

// --- UI updates ---
function formatujWalute(n) { return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n); }
function showAuthMessage(msg, type = "info") { dom.authMessage.textContent = msg; dom.authMessage.style.color = type === "error" ? "red" : "lime"; }
function updatePortfolioUI() {
  dom.username.textContent = portfolio.name;
  dom.cash.textContent = formatujWalute(portfolio.cash);
  dom.totalValue.textContent = formatujWalute(portfolio.totalValue);
  dom.totalProfit.textContent = formatujWalute(portfolio.totalValue - portfolio.startValue);
}
function updateUserProfile(d) {
  if (dom.userAvatar) dom.userAvatar.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(d.name || 'guest')}`;
  if (dom.joinDate && d.joinDate) try { dom.joinDate.textContent = "Dołączył: " + d.joinDate.toDate().toLocaleDateString(); } catch (e) { }
}
function toggleAuthForms() {
  const login = dom.loginForm, reg = dom.registerForm;
  login.classList.toggle("hidden");
  reg.classList.toggle("hidden");
}
function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  dom.themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("theme", isLight ? "light" : "dark");
}
function onSelectCompany(e) {
  const btn = e.target.closest(".company-tab");
  if (!btn) return;
  const id = btn.dataset.company;
  currentCompanyId = id;
  document.querySelectorAll(".company-tab").forEach(t => t.classList.toggle("active", t.dataset.company === id));
  dom.companyName.textContent = market[id].name;
  chart?.updateSeries([{ data: market[id].history }]);
  dom.stockPrice.textContent = formatujWalute(market[id].price);
}
function applyRumorSentiment(companyId, sentiment) {
  if (!market[companyId]) return;
  const impact = sentiment === "positive" ? 0.03 : -0.03;
  market[companyId].price = Math.max(0.01, market[companyId].price * (1 + impact));
}
