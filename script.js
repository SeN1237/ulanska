// === Firebase importy ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, query, orderBy, limit, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// === Konfiguracja Firebase ===
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

// === Zmienne globalne ===
let currentUserId = null;
let chart = null;
let chartStarted = false;

const market = {
  ulanska: { name: "Ułańska Dev", price: 1.0, history: generateCandles(50, 1.0) },
  rychbud: { name: "RychBud", price: 1.0, history: generateCandles(50, 1.0) },
  igicorp: { name: "IgiCorp", price: 1.0, history: generateCandles(50, 1.0) },
  brzozair: { name: "BrzozAir", price: 1.0, history: generateCandles(50, 1.0) }
};

let currentCompanyId = "ulanska";
let portfolio = { cash: 1000, shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 } };

let dom = {};

// === DOM ładowanie ===
document.addEventListener("DOMContentLoaded", () => {
  dom = {
    authContainer: document.getElementById("auth-container"),
    simulatorContainer: document.getElementById("simulator-container"),
    loginForm: document.getElementById("login-form"),
    registerForm: document.getElementById("register-form"),
    authMessage: document.getElementById("auth-message"),
    username: document.getElementById("username"),
    logoutButton: document.getElementById("logout-button"),
    stockPrice: document.getElementById("stock-price"),
    companyName: document.getElementById("company-name"),
    companySelector: document.getElementById("company-selector"),
    cash: document.getElementById("cash"),
    totalValue: document.getElementById("total-value"),
    totalProfit: document.getElementById("total-profit"),
    amountInput: document.getElementById("amount-input"),
    buyButton: document.getElementById("buy-button"),
    sellButton: document.getElementById("sell-button"),
    messageBox: document.getElementById("message-box"),
    leaderboardList: document.getElementById("leaderboard-list"),
    historyFeed: document.getElementById("history-feed"),
    newsFeed: document.getElementById("news-feed"),
    rumorsFeed: document.getElementById("rumors-feed"),
    chatFeed: document.getElementById("chat-feed"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    rumorForm: document.getElementById("rumor-form"),
    rumorInput: document.getElementById("rumor-input"),
    rumorCompanySelect: document.getElementById("rumor-company-select"),
    themeToggle: document.getElementById("theme-toggle"),
    chartContainer: document.getElementById("chart-container")
  };

  // Auth
  document.getElementById("switch-auth-link")?.addEventListener("click", toggleAuthForms);
  document.getElementById("switch-to-login")?.addEventListener("click", toggleAuthForms);
  dom.loginForm?.addEventListener("submit", onLogin);
  dom.registerForm?.addEventListener("submit", onRegister);
  dom.logoutButton?.addEventListener("click", () => signOut(auth));

  // Giełda
  dom.companySelector?.addEventListener("click", onSelectCompany);
  dom.buyButton?.addEventListener("click", buyShares);
  dom.sellButton?.addEventListener("click", sellShares);
  dom.rumorForm?.addEventListener("submit", onPostRumor);
  dom.chatForm?.addEventListener("submit", onSendMessage);

  startAuthListener();
});

// === Funkcje pomocnicze ===
function toggleAuthForms(e) {
  e.preventDefault();
  dom.loginForm.classList.toggle("hidden");
  dom.registerForm.classList.toggle("hidden");
}

function showAuthMessage(text, type = "info") {
  dom.authMessage.textContent = text;
  dom.authMessage.style.color = type === "error" ? "red" : "lime";
}

// === Rejestracja / logowanie ===
async function onRegister(e) {
  e.preventDefault();
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const pass = document.getElementById("register-password").value;

  if (!email || !pass || !name) return showAuthMessage("Wypełnij wszystkie pola", "error");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "uzytkownicy", cred.user.uid), {
      name,
      email,
      cash: 1000,
      shares: { ulanska: 0, rychbud: 0, igicorp: 0, brzozair: 0 },
      startValue: 1000,
      totalValue: 1000,
      zysk: 0,
      joinDate: Timestamp.fromDate(new Date())
    });
  } catch (err) {
    console.error(err);
    showAuthMessage("Błąd rejestracji", "error");
  }
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error(err);
    showAuthMessage("Niepoprawny e-mail lub hasło", "error");
  }
}

// === Auth listener ===
function startAuthListener() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      dom.authContainer.classList.add("hidden");
      dom.simulatorContainer.classList.remove("hidden");
      initListeners();
      if (!chartStarted) {
        initChart();
        startChartTicker();
        chartStarted = true;
      }
    } else {
      currentUserId = null;
      dom.authContainer.classList.remove("hidden");
      dom.simulatorContainer.classList.add("hidden");
    }
  });
}

// === Firebase nasłuchy ===
function initListeners() {
  listenToPortfolio();
  listenToLeaderboard();
  listenToRumors();
  listenToMarketNews();
  listenToChat();
  listenToTransactions();
}

function listenToPortfolio() {
  const ref = doc(db, "uzytkownicy", currentUserId);
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    portfolio = d;
    updatePortfolioUI();
  });
}

function listenToLeaderboard() {
  const q = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    dom.leaderboardList.innerHTML = "";
    snap.forEach((u, i) => {
      const data = u.data();
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${data.name} — ${data.totalValue.toFixed(2)} zł`;
      dom.leaderboardList.appendChild(li);
    });
  });
}

function listenToRumors() {
  const q = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(8));
  onSnapshot(q, (snap) => {
    dom.rumorsFeed.innerHTML = "";
    snap.forEach((d) => {
      const r = d.data();
      const p = document.createElement("p");
      p.textContent = `[${market[r.companyId]?.name || "??"}] ${r.text} — ${r.authorName}`;
      dom.rumorsFeed.appendChild(p);
    });
  });
}

function listenToMarketNews() {
  const q = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(6));
  onSnapshot(q, (snap) => {
    dom.newsFeed.innerHTML = "";
    snap.forEach((d) => {
      const n = d.data();
      const p = document.createElement("p");
      p.textContent = n.text;
      dom.newsFeed.appendChild(p);
    });
  });
}

function listenToChat() {
  const q = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
  onSnapshot(q, (snap) => {
    dom.chatFeed.innerHTML = "";
    snap.docs.reverse().forEach((m) => {
      const d = m.data();
      const p = document.createElement("p");
      p.textContent = `${d.authorName}: ${d.text}`;
      dom.chatFeed.appendChild(p);
    });
  });
}

function listenToTransactions() {
  const q = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    dom.historyFeed.innerHTML = "";
    snap.forEach((d) => {
      const t = d.data();
      const p = document.createElement("p");
      p.textContent = `${t.type} ${t.amount}× ${t.companyName} po ${t.price} zł`;
      dom.historyFeed.appendChild(p);
    });
  });
}

// === Handel ===
function buyShares() {
  const amount = parseInt(dom.amountInput.value || "0");
  if (amount <= 0) return showMessage("Podaj poprawną ilość", "error");

  const company = market[currentCompanyId];
  const cost = amount * company.price;

  if (cost > portfolio.cash) return showMessage("Za mało gotówki", "error");

  portfolio.cash -= cost;
  portfolio.shares[currentCompanyId] += amount;
  updatePortfolioFirebase();
  addTransaction("KUPNO", company.name, amount, company.price);
  showMessage(`Kupiono ${amount} × ${company.name}`, "success");
}

function sellShares() {
  const amount = parseInt(dom.amountInput.value || "0");
  if (amount <= 0) return showMessage("Podaj poprawną ilość", "error");

  const company = market[currentCompanyId];
  if (amount > portfolio.shares[currentCompanyId]) return showMessage("Nie masz tylu akcji", "error");

  portfolio.cash += amount * company.price;
  portfolio.shares[currentCompanyId] -= amount;
  updatePortfolioFirebase();
  addTransaction("SPRZEDAŻ", company.name, amount, company.price);
  showMessage(`Sprzedano ${amount} × ${company.name}`, "success");
}

async function addTransaction(type, companyName, amount, price) {
  await addDoc(collection(db, "transakcje"), {
    userId: currentUserId,
    userName: portfolio.name,
    companyName,
    amount,
    price,
    type,
    timestamp: serverTimestamp()
  });
}

async function updatePortfolioFirebase() {
  const total = calculateTotalValue();
  await updateDoc(doc(db, "uzytkownicy", currentUserId), {
    cash: portfolio.cash,
    shares: portfolio.shares,
    totalValue: total,
    zysk: total - portfolio.startValue
  });
  updatePortfolioUI();
}

function calculateTotalValue() {
  let value = portfolio.cash;
  for (const c in market) {
    value += portfolio.shares[c] * market[c].price;
  }
  return value;
}

// === UI ===
function updatePortfolioUI() {
  dom.username.textContent = portfolio.name;
  dom.cash.textContent = `${portfolio.cash.toFixed(2)} zł`;
  dom.totalValue.textContent = `${portfolio.totalValue?.toFixed(2) || 0} zł`;
  dom.totalProfit.textContent = `${portfolio.zysk?.toFixed(2) || 0} zł`;
}

function showMessage(msg, type = "info") {
  dom.messageBox.textContent = msg;
  dom.messageBox.style.color = type === "error" ? "red" : "lime";
}

// === Plotki i czat ===
async function onPostRumor(e) {
  e.preventDefault();
  const text = dom.rumorInput.value.trim();
  const companyId = dom.rumorCompanySelect.value;
  if (!text) return;
  await addDoc(collection(db, "plotki"), {
    text,
    companyId,
    authorName: portfolio.name,
    timestamp: serverTimestamp()
  });
  dom.rumorInput.value = "";
}

async function onSendMessage(e) {
  e.preventDefault();
  const text = dom.chatInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, "chat_messages"), {
    text,
    authorName: portfolio.name,
    timestamp: serverTimestamp()
  });
  dom.chatInput.value = "";
}

// === Wykres ===
function generateCandles(count, base) {
  const arr = [];
  let last = base;
  let t = Date.now() - count * 5000;
  for (let i = 0; i < count; i++) {
    const open = last;
    const close = Math.max(0.01, open + (Math.random() - 0.5) * 0.05);
    const high = Math.max(open, close) + Math.random() * 0.02;
    const low = Math.min(open, close) - Math.random() * 0.02;
    arr.push({ x: new Date(t), y: [open, high, low, close].map(v => parseFloat(v.toFixed(2))) });
    last = close;
    t += 5000;
  }
  return arr;
}

function initChart() {
  const options = {
    series: [{ data: market.ulanska.history }],
    chart: { type: 'candlestick', height: 350, toolbar: { show: false } },
    theme: { mode: 'dark' },
    xaxis: { type: 'datetime' },
    yaxis: { tooltip: { enabled: true } }
  };
  chart = new ApexCharts(dom.chartContainer, options);
  chart.render();
}

function startChartTicker() {
  setInterval(() => {
    for (const id in market) {
      const comp = market[id];
      const hist = comp.history;
      const last = hist[hist.length - 1].y[3];
      const newClose = Math.max(0.01, last + (Math.random() - 0.5) * 0.03);
      const newHigh = Math.max(last, newClose) + Math.random() * 0.02;
      const newLow = Math.min(last, newClose) - Math.random() * 0.02;
      hist.push({ x: new Date(), y: [last, newHigh, newLow, newClose] });
      if (hist.length > 60) hist.shift();
    }
    chart.updateSeries([{ data: market[currentCompanyId].history }]);
  }, 5000);
}

function onSelectCompany(e) {
  const btn = e.target.closest(".company-tab");
  if (!btn) return;
  const id = btn.dataset.company;
  if (!market[id]) return;
  currentCompanyId = id;
  document.querySelectorAll(".company-tab").forEach(b => b.classList.toggle("active", b.dataset.company === id));
  dom.companyName.textContent = market[id].name;
  dom.stockPrice.textContent = `${market[id].price.toFixed(2)} zł`;
  chart.updateSeries([{ data: market[id].history }]);
}
