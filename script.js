// script.js - kompletny, skonsolidowany
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, onSnapshot, updateDoc,
  collection, addDoc, query, orderBy, limit, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* firebase config - zachowaj swoją konfigurację */
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

/* ---------- market initial ---------- */
function generateInitialCandles(count, base) {
  const data = [];
  let lastClose = base;
  let t = Date.now() - count * 5000;
  for (let i = 0; i < count; i++) {
    const open = lastClose;
    const close = Math.max(0.01, open + (Math.random() - 0.5) * base * 0.05);
    const high = Math.max(open, close) + Math.random() * base * 0.02;
    const low = Math.min(open, close) - Math.random() * base * 0.02;
    data.push({ x: new Date(t), y: [parseFloat(open.toFixed(2)), parseFloat(high.toFixed(2)), parseFloat(low.toFixed(2)), parseFloat(close.toFixed(2))] });
    lastClose = close;
    t += 5000;
  }
  return data;
}

const market = {
  ulanska: { name: "Ułańska Dev", price: 1.00, history: generateInitialCandles(50,1) },
  rychbud: { name: "RychBud", price: 1.00, history: generateInitialCandles(50,1) },
  igicorp:  { name: "IgiCorp", price: 1.00, history: generateInitialCandles(50,1) },
  brzozair: { name: "BrzozAir", price: 1.00, history: generateInitialCandles(50,1) }
};

let currentCompanyId = "ulanska";
let portfolio = { name: "Gość", cash: 1000, shares: { ulanska:0,rychbud:0,igicorp:0,brzozair:0 }, startValue:1000, zysk:0, totalValue:1000 };
let dom = {};
let chart = null;
let chartHasStarted = false;
let currentUserId = null;
let initialNewsLoaded = false;

/* ---------- listen to global prices (optional) ---------- */
const cenyRef = doc(db, "global", "ceny_akcji");
onSnapshot(cenyRef, snap => {
  if (!snap.exists()) return;
  const d = snap.data();
  for (const k in d) if (market[k]) market[k].price = d[k];
  safeUpdatePriceUI();
});

/* ---------- init DOM + events ---------- */
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
    audioKaching: document.getElementById("audio-kaching"),
    audioError: document.getElementById("audio-error"),
    audioNews: document.getElementById("audio-news"),
    themeToggle: document.getElementById("theme-toggle"),
    userAvatar: document.getElementById("user-avatar")
  };

  // auth forms toggle
  dom.switchAuthLink?.addEventListener("click", (e)=>{ e.preventDefault(); toggleAuthForms(); });
  dom.switchToLogin?.addEventListener("click", (e)=>{ e.preventDefault(); toggleAuthForms(); });

  // login/register
  dom.loginForm?.addEventListener("submit", onLogin);
  dom.registerForm?.addEventListener("submit", onRegister);

  // simulator actions
  dom.logoutButton?.addEventListener("click", ()=>signOut(auth));
  dom.companySelector?.addEventListener("click", onSelectCompany);
  dom.buyButton?.addEventListener("click", buyShares);
  dom.sellButton?.addEventListener("click", sellShares);
  dom.buyMaxButton?.addEventListener("click", onBuyMax);
  dom.sellMaxButton?.addEventListener("click", onSellMax);
  dom.rumorForm?.addEventListener("submit", onPostRumor);
  dom.chatForm?.addEventListener("submit", onSendMessage);
  dom.themeToggle?.addEventListener("click", toggleTheme);

  setTimeout(() => startAuthListener(), 200);
});

/* ---------- UI helpers ---------- */
function toggleAuthForms(){
  const login = dom.loginForm, register = dom.registerForm;
  if (!login || !register) return;
  const showingLogin = !login.classList.contains("hidden");
  if (showingLogin){ login.classList.add("hidden"); register.classList.remove("hidden"); }
  else { register.classList.add("hidden"); login.classList.remove("hidden"); }
}

function showAuthMessage(msg, type="info"){ if (!dom.authMessage) return; dom.authMessage.textContent = msg; dom.authMessage.style.color = type==="error" ? "var(--danger)" : "var(--accent)"; }

/* ---------- auth actions ---------- */
async function onRegister(e){
  e.preventDefault();
  const name = document.getElementById("register-name")?.value || "Gracz";
  const email = document.getElementById("register-email")?.value;
  const password = document.getElementById("register-password")?.value;
  if (!email || !password) return showAuthMessage("Uzupełnij pola.", "error");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "uzytkownicy", cred.user.uid), {
      name, email, cash:1000, shares:{ulanska:0,rychbud:0,igicorp:0,brzozair:0}, startValue:1000, zysk:0, totalValue:1000, joinDate: Timestamp.fromDate(new Date())
    });
  } catch (e) { showAuthMessage("Błąd rejestracji.", "error"); }
}

async function onLogin(e){
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const password = document.getElementById("login-password")?.value;
  if (!email || !password) return showAuthMessage("Podaj e-mail i hasło.", "error");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthMessage("");
  } catch (e) { showAuthMessage("Błędny e-mail lub hasło.", "error"); }
}

/* ---------- auth listener ---------- */
function startAuthListener(){
  onAuthStateChanged(auth, user => {
    if (user) {
      currentUserId = user.uid;
      if (dom.authContainer) dom.authContainer.classList.add("hidden");
      if (dom.simulatorContainer) dom.simulatorContainer.classList.remove("hidden");
      initListeners();
      if (!chartHasStarted){ safeInitChart(); startChartTicker(); chartHasStarted = true; }
    } else {
      currentUserId = null;
      if (dom.authContainer) dom.authContainer.classList.remove("hidden");
      if (dom.simulatorContainer) dom.simulatorContainer.classList.add("hidden");
      stopListeners();
      if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
      chartHasStarted = false;
      chart = null;
    }
  });
}

/* ---------- listeners control ---------- */
function initListeners(){
  listenToPortfolioData(currentUserId);
  listenToRumors();
  listenToMarketNews();
  listenToLeaderboard();
  listenToChat();
  listenToTransactions();
}

function stopListeners(){
  if (typeof unsubscribePortfolio === "function") unsubscribePortfolio();
  if (typeof unsubscribeRumors === "function") unsubscribeRumors();
  if (typeof unsubscribeNews === "function") unsubscribeNews();
  if (typeof unsubscribeLeaderboard === "function") unsubscribeLeaderboard();
  if (typeof unsubscribeChat === "function") unsubscribeChat();
  if (typeof unsubscribeTransactions === "function") unsubscribeTransactions();
}

/* ---------- individual listeners (with null-checks) ---------- */
function listenToPortfolioData(uid){
  if (!uid) return;
  if (typeof unsubscribePortfolio === "function") unsubscribePortfolio();
  const ref = doc(db, "uzytkownicy", uid);
  unsubscribePortfolio = onSnapshot(ref, snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    portfolio.name = d.name || portfolio.name;
    portfolio.cash = d.cash !== undefined ? d.cash : portfolio.cash;
    portfolio.shares = d.shares || portfolio.shares;
    portfolio.startValue = d.startValue || portfolio.startValue;
    updatePortfolioUI();
    updateUserProfile(d);
  }, e => console.error("portfolio listen:", e));
}

function listenToRumors(){
  if (typeof unsubscribeRumors === "function") unsubscribeRumors();
  const q = query(collection(db, "plotki"), orderBy("timestamp", "desc"), limit(8));
  unsubscribeRumors = onSnapshot(q, snap => {
    if (!dom.rumorsFeed) return;
    dom.rumorsFeed.innerHTML = "";
    snap.forEach(docSnap => {
      const r = docSnap.data();
      const p = document.createElement("p");
      p.textContent = (market[r.companyId] ? `[${market[r.companyId].name}] ` : "") + r.text + " — " + (r.authorName || "Anonim");
      dom.rumorsFeed.prepend(p);
      if (r.sentiment && r.companyId) applyRumorSentiment(r.companyId, r.sentiment);
    });
  }, e => console.error("rumors listen:", e));
}

function listenToMarketNews(){
  if (typeof unsubscribeNews === "function") unsubscribeNews();
  const q = query(collection(db, "gielda_news"), orderBy("timestamp", "desc"), limit(6));
  unsubscribeNews = onSnapshot(q, snap => {
    if (!dom.newsFeed) return;
    dom.newsFeed.innerHTML = "";
    snap.forEach(docSnap => {
      const n = docSnap.data();
      const p = document.createElement("p");
      p.textContent = n.text;
      dom.newsFeed.prepend(p);
    });
    initialNewsLoaded = true;
  }, e => console.error("news listen:", e));
}

function listenToLeaderboard(){
  if (typeof unsubscribeLeaderboard === "function") unsubscribeLeaderboard();
  const q = query(collection(db, "uzytkownicy"), orderBy("totalValue", "desc"), limit(10));
  unsubscribeLeaderboard = onSnapshot(q, snap => {
    if (!dom.leaderboardList) return;
    dom.leaderboardList.innerHTML = "";
    let rank = 1;
    snap.forEach(docSnap => {
      const u = docSnap.data();
      const li = document.createElement("li");
      li.textContent = `${rank}. ${u.name} — ${formatujWalute(u.totalValue||0)}`;
      if (docSnap.id === currentUserId) li.style.fontWeight = "700";
      dom.leaderboardList.appendChild(li);
      rank++;
    });
  }, e => console.error("leaderboard listen:", e));
}

function listenToChat(){
  if (typeof unsubscribeChat === "function") unsubscribeChat();
  const q = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
  unsubscribeChat = onSnapshot(q, snap => {
    if (!dom.chatFeed) return;
    dom.chatFeed.innerHTML = "";
    const rows = snap.docs.slice().reverse();
    rows.forEach(d => {
      const m = d.data();
      const p = document.createElement("p");
      p.textContent = `${m.authorName || "Anonim"}: ${m.text}`;
      dom.chatFeed.appendChild(p);
    });
    dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
  }, e => console.error("chat listen:", e));
}

function listenToTransactions(){
  if (typeof unsubscribeTransactions === "function") unsubscribeTransactions();
  const q = query(collection(db, "transakcje"), orderBy("timestamp", "desc"), limit(12));
  unsubscribeTransactions = onSnapshot(q, snap => {
    if (!dom.historyFeed) return;
    dom.historyFeed.innerHTML = "";
    snap.forEach(d => {
      const t = d.data();
      const p = document.createElement("p");
      p.textContent = `${t.type} ${t.amount}× ${t.companyName} po ${t.price} zł`;
      dom.historyFeed.appendChild(p);
    });
  }, e => console.error("transactions listen:", e));
}

/* ---------- sending actions ---------- */
async function onSendMessage(e){
  e.preventDefault();
  if (!dom.chatInput) return;
  const text = dom.chatInput.value.trim();
  if (!text || !currentUserId) return;
  try {
    await addDoc(collection(db, "chat_messages"), { text, authorName: portfolio.name, authorId: currentUserId, timestamp: serverTimestamp() });
    dom.chatInput.value = "";
  } catch(e){ console.error("send msg:", e); showMessage("Błąd wysyłki", "error"); }
}

async function onPostRumor(e){
  e.preventDefault();
  const text = dom.rumorInput?.value.trim();
  const companyId = dom.rumorCompanySelect?.value;
  const sentimentEl = document.querySelector('input[name="sentiment"]:checked');
  const sentiment = sentimentEl ? sentimentEl.value : "positive";
  if (!text || !currentUserId || !companyId) return;
  try {
    await addDoc(collection(db, "plotki"), { text, companyId, sentiment, authorId: currentUserId, authorName: portfolio.name, timestamp: Timestamp.fromDate(new Date()) });
    dom.rumorInput.value = "";
  } catch(e){ console.error("post rumor:", e); }
}

/* ---------- trading ---------- */
async function addTransaction(type, companyId, amount, price){
  if (!currentUserId) return;
  try {
    await addDoc(collection(db, "transakcje"), { userId: currentUserId, userName: portfolio.name, companyId, companyName: market[companyId].name, type, amount, price, timestamp: serverTimestamp() });
  } catch(e){ console.error("add trans:", e); }
}

function onBuyMax(){ if (!currentCompanyId) return; const price = market[currentCompanyId].price||1; dom.amountInput.value = Math.floor(portfolio.cash/price); }
function onSellMax(){ if (!currentCompanyId) return; dom.amountInput.value = portfolio.shares[currentCompanyId]||0; }

function buyShares(){
  const amount = parseInt(dom.amountInput?.value || "0");
  if (!amount || amount <= 0) return showMessage("Wpisz poprawną ilość.", "error");
  const price = market[currentCompanyId].price;
  const cost = amount * price;
  if (cost > portfolio.cash) return showMessage("Brak środków.", "error");
  const newCash = portfolio.cash - cost;
  const newShares = { ...portfolio.shares }; newShares[currentCompanyId] = (newShares[currentCompanyId]||0) + amount;
  const total = calculateTotalValue(newCash, newShares);
  updatePortfolioInFirebase({ cash:newCash, shares:newShares, zysk: total - portfolio.startValue, totalValue: total });
  showMessage(`Kupiono ${amount} ${market[currentCompanyId].name}`, "success");
  addTransaction("KUPNO", currentCompanyId, amount, price);
}

function sellShares(){
  const amount = parseInt(dom.amountInput?.value || "0");
  if (!amount || amount <= 0) return showMessage("Wpisz poprawną ilość.", "error");
  if (amount > (portfolio.shares[currentCompanyId]||0)) return showMessage("Nie masz tylu akcji.", "error");
  const price = market[currentCompanyId].price;
  const newCash = portfolio.cash + amount * price;
  const newShares = { ...portfolio.shares }; newShares[currentCompanyId] -= amount;
  const total = calculateTotalValue(newCash, newShares);
  updatePortfolioInFirebase({ cash:newCash, shares:newShares, zysk: total - portfolio.startValue, totalValue: total });
  showMessage(`Sprzedano ${amount} ${market[currentCompanyId].name}`, "success");
  addTransaction("SPRZEDAŻ", currentCompanyId, amount, price);
}

async function updatePortfolioInFirebase(data){
  if (!currentUserId) return;
  try { await updateDoc(doc(db, "uzytkownicy", currentUserId), data); }
  catch(e){ console.error("update profile:", e); showMessage("Błąd zapisu.", "error"); }
}

function calculateTotalValue(cash, shares){
  let v = 0;
  for (const id in shares) if (market[id]) v += (shares[id]||0) * market[id].price;
  return cash + v;
}

/* ---------- chart (safe) ---------- */
function safeInitChart(company=currentCompanyId){
  if (typeof ApexCharts === "undefined"){ setTimeout(()=>safeInitChart(company), 300); return; }
  initChart(company);
}

function initChart(company=currentCompanyId){
  if (!dom.chartContainer) return;
  if (chart) try{ chart.destroy(); }catch(e){}
  const options = {
    series: [{ data: market[company].history }],
    chart: { type:'candlestick', height:350, toolbar:{show:false}, animations:{enabled:false} },
    theme: { mode: document.body.classList.contains('light-mode') ? 'light' : 'dark' },
    xaxis: { type:'datetime' },
    yaxis: { tooltip:{enabled:true} },
    plotOptions: { candlestick:{ colors:{ upward: '#22c55e', downward:'#ef4444' } } }
  };
  chart = new ApexCharts(dom.chartContainer, options);
  chart.render();
}

function startChartTicker(){
  if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);
  window.chartTickerInterval = setInterval(()=>{
    for (const id in market){
      const comp = market[id];
      const hist = comp.history;
      if (!hist.length) continue;
      const last = hist[hist.length-1];
      const lastClose = parseFloat(last.y[3]);
      const open = lastClose;
      const jitter = (Math.random()-0.5) * (comp.price*0.01);
      const close = Math.max(0.01, comp.price + jitter);
      const high = Math.max(open, close) + Math.random()*(comp.price*0.01);
      const low = Math.min(open, close) - Math.random()*(comp.price*0.01);
      hist.push({ x: new Date(), y: [parseFloat(open.toFixed(2)), parseFloat(high.toFixed(2)), parseFloat(low.toFixed(2)), parseFloat(close.toFixed(2))] });
      if (hist.length > 60) hist.shift();
    }
    if (chart) try{ chart.updateSeries([{ data: market[currentCompanyId].history }]); }catch(e){}
  }, 5000);
}

/* ---------- UI updates ---------- */
function formatujWalute(n){ return new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',minimumFractionDigits:2}).format(n); }

function safeUpdatePriceUI(){
  try { updatePriceUI(); updatePortfolioUI(); } catch(e){}
}

function updatePriceUI(){
  if (!dom.stockPrice) return;
  const c = market[currentCompanyId];
  dom.stockPrice.textContent = formatujWalute(c.price);
}

function updatePortfolioUI(){
  if (!dom.username || !dom.cash) return;
  dom.username.textContent = portfolio.name;
  dom.cash.textContent = formatujWalute(portfolio.cash);
  dom.sharesList.innerHTML = `
    <p>Ułańska Dev: <strong id="shares-ulanska">${portfolio.shares.ulanska||0}</strong></p>
    <p>RychBud: <strong id="shares-rychbud">${portfolio.shares.rychbud||0}</strong></p>
    <p>IgiCorp: <strong id="shares-igicorp">${portfolio.shares.igicorp||0}</strong></p>
    <p>BrzozAir: <strong id="shares-brzozair">${portfolio.shares.brzozair||0}</strong></p>
  `;
  const total = calculateTotalValue(portfolio.cash, portfolio.shares);
  dom.totalValue.textContent = formatujWalute(total);
  dom.totalProfit.textContent = formatujWalute(total - portfolio.startValue);
}

/* ---------- misc helpers ---------- */
function showMessage(msg, type="info"){ if (!dom.messageBox) return; dom.messageBox.textContent = msg; dom.messageBox.style.color = type==="error" ? "var(--danger)" : "var(--accent)"; }

function applyRumorSentiment(companyId, sentiment){
  if (!market[companyId]) return;
  const impact = sentiment === "positive" ? 0.03 : -0.03;
  // naive temporary impact
  market[companyId].price = Math.max(0.01, market[companyId].price * (1 + impact));
  setTimeout(()=>{ /* no-op decay for simplicity */ }, 30000);
}

function updateUserProfile(d){
  if (!d) return;
  if (dom.userAvatar) dom.userAvatar.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(d.name||'guest')}`;
  if (dom.joinDate && d.joinDate) try{ dom.joinDate.textContent = "Dołączył: " + d.joinDate.toDate().toLocaleDateString(); }catch(e){}
}

function toggleTheme(){
  const isLight = document.body.classList.toggle("light-mode");
  if (dom.themeToggle) dom.themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("theme", isLight ? "light":"dark");
}

/* ---------- selection ---------- */
function onSelectCompany(e){
  if (!e.target) return;
  const btn = e.target.closest(".company-tab");
  if (!btn) return;
  const id = btn.dataset.company;
  if (!id || !market[id]) return;
  currentCompanyId = id;
  document.querySelectorAll(".company-tab").forEach(t => t.classList.toggle("active", t.dataset.company === id));
  if (dom.companyName) dom.companyName.textContent = market[id].name;
  if (chart) try{ chart.updateSeries([{ data: market[id].history }]); }catch(e){}
  updatePriceUI();
}
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
