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

let market = {
  ulanska:  { name: "Ułańska Dev", price: 1.0, history: generateInitialCandles(50, 1) },
  brzozair: { name: "BrzozAir", price: 1.0, history: generateInitialCandles(50, 1) },
  igicorp:  { name: "IgiCorp", price: 1.0, history: generateInitialCandles(50, 1) },
  rychbud:  { name: "RychBud", price: 1.0, history: generateInitialCandles(50, 1) }
};

let portfolio = { name: "Gość", cash: 1000, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 }, startValue: 1000, zysk: 0, totalValue: 1000 };
let currentCompanyId = "ulanska";
let currentUserId = null;
let dom = {};
let chart = null;
let chartHasStarted = false;
let initialNewsLoaded = false;

function generateInitialCandles(count, base) {
  const data = [];
  let lastClose = base;
  let t = Date.now() - count * 5000;
  for (let i = 0; i < count; i++) {
    const open = lastClose;
    const close = open + (Math.random() - 0.5) * base * 0.05;
    const high = Math.max(open, close) + Math.random() * base * 0.02;
    const low = Math.min(open, close) - Math.random() * base * 0.02;
    data.push({ x: new Date(t), y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)] });
    lastClose = close;
    t += 5000;
  }
  return data;
}

document.addEventListener("DOMContentLoaded", () => {
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
    rumorCompanySelect: document.getElementById("rumor-company-select"),
    rumorsFeed: document.getElementById("rumors-feed"),
    newsFeed: document.getElementById("news-feed"),
    leaderboardList: document.getElementById("leaderboard-list"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    chatFeed: document.getElementById("chat-feed"),
    historyFeed: document.getElementById("history-feed")
  };

  dom.loginForm?.addEventListener("submit", onLogin);
  dom.registerForm?.addEventListener("submit", onRegister);
  dom.logoutButton?.addEventListener("click", () => signOut(auth));

  startAuthListener();
});

function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-password").value;
  signInWithEmailAndPassword(auth, email, pass).catch(() => showAuthMessage("Błąd logowania", "error"));
}

async function onRegister(e) {
  e.preventDefault();
  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const pass = document.getElementById("register-password").value;
  const user = await createUserWithEmailAndPassword(auth, email, pass);
  await setDoc(doc(db, "uzytkownicy", user.user.uid), {
    name, email, cash: 1000, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
    startValue: 1000, zysk: 0, totalValue: 1000, joinDate: Timestamp.fromDate(new Date())
  });
}

function startAuthListener() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      dom.authContainer.classList.add("hidden");
      dom.simulatorContainer.classList.remove("hidden");
      initListeners();
      if (!chartHasStarted) {
        initChart();
        startChartTicker();
        chartHasStarted = true;
      }
    } else {
      currentUserId = null;
      dom.authContainer.classList.remove("hidden");
      dom.simulatorContainer.classList.add("hidden");
    }
  });
}

function initListeners() {
  listenToPortfolioData(currentUserId);
  listenToRumors();
  listenToMarketNews();
  listenToLeaderboard();
  listenToChat();
  listenToTransactions();
}

function listenToPortfolioData(uid) {
  const ref = doc(db, "uzytkownicy", uid);
  onSnapshot(ref, (snap) => {
    if (!snap.exists() || !dom.username) return;
    const d = snap.data();
    portfolio = d;
    dom.username.textContent = d.name;
    dom.cash.textContent = d.cash.toFixed(2) + " zł";
    dom.totalValue.textContent = d.totalValue.toFixed(2) + " zł";
    dom.totalProfit.textContent = d.zysk.toFixed(2) + " zł";
  });
}

function listenToRumors() {
  const q = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(6));
  onSnapshot(q, (snap) => {
    if (!dom.rumorsFeed) return;
    dom.rumorsFeed.innerHTML = "";
    snap.forEach(doc => {
      const r = doc.data();
      const p = document.createElement("p");
      p.textContent = `[${r.companyId}] ${r.text} — ${r.authorName}`;
      dom.rumorsFeed.appendChild(p);
    });
  });
}

function listenToMarketNews() {
  const q = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(6));
  onSnapshot(q, (snap) => {
    if (!dom.newsFeed) return;
    dom.newsFeed.innerHTML = "";
    snap.forEach(doc => {
      const n = doc.data();
      const p = document.createElement("p");
      p.textContent = n.text;
      dom.newsFeed.appendChild(p);
    });
  });
}

function listenToLeaderboard() {
  const q = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    if (!dom.leaderboardList) return;
    dom.leaderboardList.innerHTML = "";
    snap.forEach((doc, i) => {
      const u = doc.data();
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${u.name} — ${u.totalValue.toFixed(2)} zł`;
      dom.leaderboardList.appendChild(li);
    });
  });
}

function listenToChat() {
  const q = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
  onSnapshot(q, (snap) => {
    if (!dom.chatFeed) return;
    dom.chatFeed.innerHTML = "";
    snap.forEach(doc => {
      const m = doc.data();
      const p = document.createElement("p");
      p.textContent = `${m.authorName}: ${m.text}`;
      dom.chatFeed.appendChild(p);
    });
  });
}

function listenToTransactions() {
  const q = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    if (!dom.historyFeed) return;
    dom.historyFeed.innerHTML = "";
    snap.forEach(doc => {
      const t = doc.data();
      const p = document.createElement("p");
      p.textContent = `${t.type} ${t.amount}× ${t.companyName} po ${t.price} zł`;
      dom.historyFeed.appendChild(p);
    });
  });
}

function initChart() {
  if (!window.ApexCharts || !dom.chartContainer) return;
  const options = {
    series: [{ data: market.ulanska.history }],
    chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: false } },
    theme: { mode: 'dark' },
    xaxis: { type: 'datetime' },
    yaxis: { tooltip: { enabled: true } }
  };
  chart = new ApexCharts(dom.chartContainer, options);
  chart.render();
}

function startChartTicker() {
  if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
  window.chartTickerInterval = setInterval(() => {
    for (const c in market) {
      const m = market[c];
      const last = m.history[m.history.length - 1];
      const open = parseFloat(last.y[3]);
      const close = open + (Math.random() - 0.5) * 0.02;
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      const newCandle = { x: new Date(), y: [open, high, low, close].map(v => v.toFixed(2)) };
      m.history.push(newCandle);
      if (m.history.length > 60) m.history.shift();
    }
    if (chart) chart.updateSeries([{ data: market.ulanska.history }]);
  }, 5000);
}

function showAuthMessage(m, type = "info") {
  if (!dom.authMessage) return;
  dom.authMessage.textContent = m;
  dom.authMessage.style.color = type === "error" ? "red" : "lime";
}
