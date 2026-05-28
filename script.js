// ============================================
// CASINO ULANSKA - script.js
// Firebase Auth + Firestore + All Game Logic
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
    getFirestore, doc, setDoc, onSnapshot, updateDoc,
    collection, addDoc, query, orderBy, limit, Timestamp,
    serverTimestamp, getDocs, runTransaction, increment, getDoc, deleteField
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --- FIREBASE CONFIG ---
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

// --- STAN GRACZA ---
let player = {
    name: "Gość", cash: 0, zysk: 0, totalValue: 0, startValue: 1000,
    prestigeLevel: 0, stats: { totalTrades: 0, gamesPlayed: 0 }
};

let currentUserId = null, unsubscribePortfolio = null, unsubscribeLeaderboard = null, unsubscribeChat = null, isMuted = false;
const dom = {}; // DOM REFS

// --- UTILS ---
function formatujWalute(val) {
    const symbol = "ułan lir"; 
    
    // Konwertujemy na liczbę, a następnie formatujemy na polski standard (pl-PL)
    const liczba = parseFloat(val || 0).toLocaleString('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    return `${liczba} ${symbol}`;
}
function getVipLabel(lvl) { const l = ['Nowicjusz', 'Brązowy', 'Srebrny', 'Złoty', 'Platynowy', 'Diamentowy']; return l[Math.min(lvl, l.length - 1)]; }
function getVipBadge(lvl) { return lvl ? '⭐'.repeat(Math.min(lvl, 5)) : ''; }

function showNotification(message, type = 'news', sentiment = null) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `notification-toast toast-${sentiment || type}`;
    const header = sentiment === 'positive' ? '🏆 WYGRANA!' : (sentiment === 'negative' ? '💸 Przegrana' : '🎰 Casino');
    toast.innerHTML = `<strong>${header}</strong><p>${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-fade-out'); setTimeout(() => toast.parentNode?.removeChild(toast), 500); }, 4000);
}

function playSound(type) {
    if (isMuted) return;
    const el = type === 'win' ? document.getElementById('audio-kaching') : document.getElementById('audio-error');
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
}

function showMessage(msg, type = 'info') { showNotification(msg, type, type === 'error' ? 'negative' : 'positive'); }

function updateUI() {
    if (!dom.headerCash) return;
    dom.headerCash.textContent = formatujWalute(player.cash);
    if (dom.username) dom.username.textContent = player.name;
    if (dom.vipBadge) dom.vipBadge.textContent = getVipBadge(player.prestigeLevel);
    if (dom.lobbyCash) dom.lobbyCash.textContent = formatujWalute(player.cash);
    if (dom.lobbyUsername) dom.lobbyUsername.textContent = player.name;
    if (dom.lobbyTotal) dom.lobbyTotal.textContent = formatujWalute(player.cash);
    if (dom.lobbyProfit) {
        dom.lobbyProfit.textContent = formatujWalute(player.zysk || 0);
        dom.lobbyProfit.style.color = (player.zysk || 0) >= 0 ? 'var(--green-bright)' : 'var(--red)';
    }
    if (dom.lobbyLevel) dom.lobbyLevel.textContent = player.prestigeLevel || 0;
    if (dom.lobbyGames) dom.lobbyGames.textContent = player.stats?.gamesPlayed || 0;
    if (dom.lobbyVip) dom.lobbyVip.textContent = getVipLabel(player.prestigeLevel);
}

// Globalne Helpersy dla gier (zapobiegają duplikacji transakcji Firebase)
let lastActionTime = 0; // SYSTEM ANTYSPAMOWY

async function deductBet(amount) {
    if (Date.now() - lastActionTime < 5000) { showMessage('Zwolnij! Odczekaj sekundę.', 'error'); return false; }
    if (isNaN(amount) || amount <= 0) { showMessage('Podaj stawkę!', 'error'); return false; }
    if (!currentUserId) { showMessage('Zaloguj się!', 'error'); return false; }
    if (amount > player.cash) { showMessage('Brak środków!', 'error'); return false; }
    
    lastActionTime = Date.now(); // Zapisanie czasu po poprawnym kliknięciu
    
    try {
        await runTransaction(db, async t => {
            const ref = doc(db, 'uzytkownicy', currentUserId);
            const d = (await t.get(ref)).data();
            if (d.cash < amount) throw new Error('Brak środków');
            t.update(ref, { cash: d.cash - amount, 'stats.gamesPlayed': increment(1) });
            player.cash = d.cash - amount;
        });
        updateUI(); return true;
    } catch(e) { showMessage(e.message, 'error'); return false; }
}

async function addWin(winAmount, betAmount, gameName, winMsg) {
    const profit = winAmount - betAmount;
    let didPrestige = false; // flaga informująca, czy gracz właśnie awansował
    
    try {
        await runTransaction(db, async t => {
            const ref = doc(db, 'uzytkownicy', currentUserId);
            const d = (await t.get(ref)).data();
            
            let finalCash = d.cash + winAmount;
            let finalPrestige = d.prestigeLevel || 0;
            
            // --- SYSTEM PRESTIŻU (AWANS PRZY 250 000) ---
            if (finalCash >= 250000) {
                finalPrestige += 1;
                finalCash = 10000;
                didPrestige = true;
            }
            // ---------------------------------------------
            
            t.update(ref, { 
                cash: finalCash, 
                zysk: (d.zysk || 0) + profit,
                prestigeLevel: finalPrestige
            });
            
            player.cash = finalCash;
            player.prestigeLevel = finalPrestige;
        });
        
        updateUI();
        
        // Specjalne powiadomienie w przypadku awansu
        if (didPrestige) {
            showNotification(`🚀 AWANS! Osiągnąłeś poziom ${player.prestigeLevel}! Twoje saldo zresetowano do 10 000 ułan lir.`, 'news', 'positive');
            playSound('win');
        } else if (winAmount > 0) { 
            if(winMsg) showNotification(`${gameName}: ${winMsg}`, 'news', 'positive'); 
            playSound('win'); 
        } else { 
            playSound('lose'); 
        }
        
        await saveGameResult(gameName, betAmount, profit);
    } catch(e) { console.error(e); }
}
function buildDeck() {
    const suits = ['♥', '♦', '♣', '♠'], ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const values = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
    let deck = [];
    suits.forEach(s => ranks.forEach(r => deck.push({ rank: r, suit: s, value: values[r], color: ['♥','♦'].includes(s)?'red':'black' })));
    return deck.sort(() => Math.random() - 0.5);
}

function createCardHTML(card, hidden=false) {
    if(hidden || !card) return `<div class="bj-card-wrap"><div class="bj-card-inner back"></div></div>`;
    return `<div class="bj-card-wrap"><div class="bj-card-inner card-${card.color}"><div class="card-corner"><span class="card-rank">${card.rank}</span><span>${card.suit}</span></div><div class="card-center">${card.suit}</div></div></div>`;
}

function renderPokerCard(id, card, hidden=false) {
    const el = document.getElementById(id);
    if(!el) return;
    if(hidden || !card) { el.className = 'poker-card back'; el.innerHTML = ''; return; }
    el.className = `poker-card ${card.color}`;
    el.innerHTML = `<div class="card-corner"><span class="card-rank">${card.rank}</span><span>${card.suit}</span></div><div class="card-center">${card.suit}</div>`;
}

// --- NAVIGATION ---
window.switchView = function (viewId) {
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
    const target = document.getElementById(`view-${viewId}`);
    if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
};

document.addEventListener('DOMContentLoaded', () => {
    initWorkSystem(); // <--- O to uciekło! Uruchamia przycisk pracy
    // Cache DOM
    ['header-cash', 'username', 'vip-badge', 'lobby-cash', 'lobby-username', 'lobby-total', 'lobby-profit', 'lobby-level', 'lobby-games', 'lobby-vip', 'auth-message', 'global-history-feed', 'personal-history-feed'].forEach(id => dom[id.replace(/-([a-z])/g, g => g[1].toUpperCase())] = document.getElementById(id));
    
    document.getElementById('chat-widget-btn')?.addEventListener('click', () => {
    document.getElementById('chat-widget-panel').classList.remove('hidden');
});
document.getElementById('chat-widget-close')?.addEventListener('click', () => {
    document.getElementById('chat-widget-panel').classList.add('hidden');
});
    
    // Podpięcie Blackjack Multiplayer
    document.querySelector('.nav-btn[data-view="bj_multi"]')?.addEventListener('click', () => {
        switchView('bj_multi');
        listenToMultiLobby();
    });
    document.getElementById('btn-start-multi-game')?.addEventListener('click', startMultiGame);
    document.getElementById('btn-create-bj-table')?.addEventListener('click', createMultiTable);
    document.getElementById('btn-multi-bet')?.addEventListener('click', placeMultiBet);
    document.getElementById('btn-multi-hit')?.addEventListener('click', multiHit);
    document.getElementById('btn-multi-stand')?.addEventListener('click', multiStand);
    document.getElementById('btn-leave-bj-table')?.addEventListener('click', leaveMultiTable);

    // Podpięcie Czatu
    document.getElementById('btn-chat-send')?.addEventListener('click', sendChatMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendChatMessage();
    });
    // Nav & Auth
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    document.getElementById('login-form')?.addEventListener('submit', onLogin);
    document.getElementById('register-form')?.addEventListener('submit', onRegister);
    document.getElementById('show-register-link')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('login-panel').classList.add('hidden'); document.getElementById('register-panel').classList.remove('hidden'); });
    document.getElementById('show-login-link')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('register-panel').classList.add('hidden'); document.getElementById('login-panel').classList.remove('hidden'); });
    document.getElementById('reset-password-link')?.addEventListener('click', e => { e.preventDefault(); onResetPassword(); });
    document.getElementById('logout-button')?.addEventListener('click', () => signOut(auth));
    document.getElementById('mute-button')?.addEventListener('click', () => { isMuted = !isMuted; document.querySelector('#mute-button i').className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high'; });

    // Init starych gier
    buildRouletteNumbers(); buildKenoGrid(); buildMinesGrid(); initPlinko();
    document.getElementById('btn-bj-deal')?.addEventListener('click', startBlackjack);
    document.getElementById('btn-bj-hit')?.addEventListener('click', bjHit);
    document.getElementById('btn-bj-stand')?.addEventListener('click', bjStand);
    document.getElementById('btn-plinko-drop')?.addEventListener('click', onPlinkoDrop);
    document.getElementById('plinko-risk-select')?.addEventListener('change', e => { currentPlinkoRisk = e.target.value; updatePlinkoBuckets(); });
    document.getElementById('btn-mines-action')?.addEventListener('click', onMinesAction);
    document.getElementById('btn-keno-play')?.addEventListener('click', playKeno);
    document.getElementById('btn-keno-clear')?.addEventListener('click', clearKeno);
    document.getElementById('btn-dice-roll')?.addEventListener('click', rollDice);
    document.getElementById('btn-poker-deal')?.addEventListener('click', pokerDeal);
    document.getElementById('btn-slots-spin')?.addEventListener('click', playSlots);
    document.getElementById('btn-crash-action')?.addEventListener('click', actionCrash);
    document.getElementById('btn-baccarat-deal')?.addEventListener('click', playBaccarat);
    document.getElementById('btn-th-deal')?.addEventListener('click', playTexasHoldemDeal);
    document.getElementById('btn-th-fold')?.addEventListener('click', thFold);
    document.getElementById('btn-th-call')?.addEventListener('click', thCall);
    document.getElementById('btn-wheel-spin')?.addEventListener('click', playWheel);
    document.getElementById('btn-scratch-buy')?.addEventListener('click', buyScratch);
    document.getElementById('btn-sic-roll')?.addEventListener('click', playSicBo);
    document.getElementById('btn-bingo-play')?.addEventListener('click', playBingo);
    document.getElementById('btn-war-deal')?.addEventListener('click', playWar);
    document.getElementById('btn-hilo-start')?.addEventListener('click', startHiLo);
    document.getElementById('btn-hilo-hi')?.addEventListener('click', () => hiloGuess('hi'));
    document.getElementById('btn-hilo-lo')?.addEventListener('click', () => hiloGuess('lo'));
    document.getElementById('btn-hilo-cashout')?.addEventListener('click', hiloCashout);
    document.getElementById('btn-am-roulette-spin')?.addEventListener('click', playAmRoulette);
    document.getElementById('btn-caribbean-deal')?.addEventListener('click', playCaribbeanDeal);
    document.getElementById('btn-caribbean-fold')?.addEventListener('click', carFold);
    document.getElementById('btn-caribbean-call')?.addEventListener('click', carCall);
    document.getElementById('btn-pai-deal')?.addEventListener('click', playPaiGow);
    document.getElementById('btn-dt-deal')?.addEventListener('click', playDragonTiger);
    document.getElementById('btn-jackpot-play')?.addEventListener('click', playJackpot);

    // Podpięcie 5 Nowych Gier
    document.getElementById('btn-coinflip-play')?.addEventListener('click', playCoinflip);
    document.getElementById('btn-threecards-play')?.addEventListener('click', playThreeCards);
    document.getElementById('btn-horse-play')?.addEventListener('click', playHorse);
    document.getElementById('btn-penalty-play')?.addEventListener('click', playPenalty);
    document.getElementById('btn-rd-deal')?.addEventListener('click', rdDeal);
    document.getElementById('btn-rd-call')?.addEventListener('click', rdCall);
    document.getElementById('btn-rd-raise')?.addEventListener('click', rdRaise);
});

// --- AUTH LOGIKA ---
async function onRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value, email = document.getElementById('register-email').value, password = document.getElementById('register-password').value;
    dom.authMessage.textContent = 'Rejestracja...';
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'uzytkownicy', cred.user.uid), { name, email, cash: 10000, zysk: 0, totalValue: 10000, startValue: 10000, stats: { totalTrades: 0, gamesPlayed: 0 }, joinDate: Timestamp.fromDate(new Date()), prestigeLevel: 0 });
    } catch (err) { dom.authMessage.textContent = err.message; dom.authMessage.style.color = 'var(--red)'; }
}
async function onLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value, password = document.getElementById('login-password').value;
    dom.authMessage.textContent = 'Logowanie...';
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { dom.authMessage.textContent = err.message; dom.authMessage.style.color = 'var(--red)'; }
}
async function onResetPassword() {
    const email = document.getElementById('login-email').value;
    if (!email) { dom.authMessage.textContent = 'Podaj email.'; return; }
    await sendPasswordResetEmail(auth, email);
    dom.authMessage.textContent = 'Link wysłany!'; dom.authMessage.style.color = 'var(--green-bright)';
}

onAuthStateChanged(auth, user => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('casino-container').classList.remove('hidden');
        listenToPortfolio(user.uid); listenToLeaderboard(); listenToChat(); // Włącz czat
    } else {
        currentUserId = null;
        if (unsubscribePortfolio) unsubscribePortfolio();
        if (unsubscribeLeaderboard) unsubscribeLeaderboard();
        if (unsubscribeChat) unsubscribeChat(); // Wyłącz czat
        document.getElementById('casino-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
    }
    document.getElementById('splash-screen').style.display = 'none';
});

function listenToPortfolio(uid) {
    unsubscribePortfolio = onSnapshot(doc(db, 'uzytkownicy', uid), snap => {
        if (snap.exists()) {
            const d = snap.data();
            player.name = d.name; player.cash = d.cash; player.zysk = d.zysk || 0; player.prestigeLevel = d.prestigeLevel || 0; player.stats = d.stats || player.stats;
            updateUI();
        }
    });
}
// Ranking
function listenToLeaderboard() {
    const q = query(collection(db, 'uzytkownicy'), limit(50));
    unsubscribeLeaderboard = onSnapshot(q, snap => {
        const list = document.getElementById('leaderboard-list');
        if (!list) return; list.innerHTML = '';
        let players = []; snap.forEach(docSnap => players.push({ id: docSnap.id, ...docSnap.data() }));
        players.sort((a, b) => {
            const lvlA = Number(a.prestigeLevel || 0); const lvlB = Number(b.prestigeLevel || 0);
            if (lvlB !== lvlA) return lvlB - lvlA;
            return Number(b.cash) - Number(a.cash);
        });
        players.slice(0, 20).forEach((d, idx) => {
            const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
            const rankText = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const isMe = d.id === currentUserId;
            const row = document.createElement('div');
            row.className = 'leaderboard-row' + (isMe ? ' my-rank' : '');
            row.innerHTML = `<span class="lb-rank ${rankClass}">${rankText}</span><span class="lb-name"><i class="fa-solid fa-user-circle" style="margin-right:8px; opacity:0.6;"></i>${d.name} <span class="lb-stars">${getVipBadge(d.prestigeLevel)}</span></span><span class="lb-val">${formatujWalute(d.cash)}</span>`;
            list.appendChild(row);
        });
    });
}

// ==========================================
// SYSTEM CZATU I ANTYSPAM CZATOWY
// ==========================================
let lastChatTime = 0;

function listenToChat() {
    const q = query(collection(db, 'chat_messages'), orderBy('timestamp', 'desc'), limit(40));
    unsubscribeChat = onSnapshot(q, snap => {
        const box = document.getElementById('chat-messages');
        if (!box) return;
        box.innerHTML = '';
        let msgs = [];
        snap.forEach(docSnap => msgs.push(docSnap.data()));
        // Odwracamy, by najnowsze były na dole
        msgs.reverse().forEach(d => {
            const div = document.createElement('div');
            div.className = 'chat-msg';
            const time = d.timestamp ? new Date(d.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            div.innerHTML = `<span class="chat-time">${time}</span><span class="chat-user">${d.authorName}:</span><span class="chat-text">${d.text}</span>`;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight; // Zjeżdża ekranem na sam dół czatu
    });
}

async function sendChatMessage() {
    if (!currentUserId) return showMessage('Musisz być zalogowany!', 'error');
    if (Date.now() - lastChatTime < 3000) return showMessage('Zwolnij! Nie spamuj na czacie (3 sek. przerwy).', 'error');
    
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || text.length > 200) return;
    
    lastChatTime = Date.now();
    input.value = '';
    
    try {
        await addDoc(collection(db, 'chat_messages'), {
            authorId: currentUserId,
            authorName: player.name,
            text: text,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        showMessage('Błąd wysyłania: ' + e.message, 'error');
    }
}
async function saveGameResult(game, bet, profit, extra = {}) {
    if (!currentUserId) return;
    try { await addDoc(collection(db, 'historia_kasyna'), { userId: currentUserId, userName: player.name, game, bet, profit, timestamp: serverTimestamp(), ...extra }); } catch (e) {}
}

// =======================================
// ORYGINALNE GRY (Ruletka, BJ, Plinko, itp.)
// =======================================
const RED_NUMBERS = [32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3];
let isSpinning = false, currentSelection = null;

function buildRouletteNumbers() {
    const container = document.getElementById('num-buttons-container');
    if (!container) return;
    for (let i = 1; i <= 36; i++) {
        const btn = document.createElement('button');
        btn.className = 'num-btn ' + (RED_NUMBERS.includes(i) ? 'num-red' : 'num-black');
        btn.dataset.num = i; btn.textContent = i; btn.onclick = () => window.selectBetType('number', i);
        container.appendChild(btn);
    }
    const strip = document.getElementById('roulette-strip-main');
    if (!strip) return;
    const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    let html = '';
    for (let rep = 0; rep < 5; rep++) ORDER.forEach(n => html += `<div class="roulette-item ${n === 0 ? 'green' : (RED_NUMBERS.includes(n) ? 'red' : 'black')}">${n}</div>`);
    strip.innerHTML = html;
}

window.selectBetType = function (type, value) {
    if (isSpinning) return;
    currentSelection = { type, value };
    document.querySelectorAll('.casino-btn, .num-btn').forEach(b => b.classList.remove('selected'));
    if (type === 'color') document.querySelector(`.btn-${value}`)?.classList.add('selected');
    else document.querySelector(`.num-btn[data-num="${value}"]`)?.classList.add('selected');
    document.getElementById('casino-status').textContent = `Wybrano: ${value}`;
};

window.commitSpin = async function () {
    if (isSpinning || !currentSelection) return showMessage(isSpinning?'Czekaj':'Wybierz stawkę!', 'error');
    const amount = parseInt(document.getElementById('casino-amount').value);
    if (!await deductBet(amount)) return;
    isSpinning = true; document.getElementById('casino-status').textContent = '🎡 Kręcimy...';
    
    const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const winningNumber = Math.floor(Math.random() * 37);
    let resultColor = winningNumber === 0 ? 'green' : RED_NUMBERS.includes(winningNumber) ? 'red' : 'black';
    const inner = document.querySelector('.inner'), dataContainer = document.querySelector('.data');
    
    if (inner) {
        inner.classList.remove('rest'); dataContainer?.classList.remove('reveal');
        const itemW = 60, windowW = document.querySelector('.roulette-window').clientWidth;
        const centerOffset = Math.floor(windowW / 2) - (itemW / 2);
        let startIdx = ORDER.indexOf(parseInt(document.querySelector('.result-number')?.textContent || '0'));
        inner.style.transform = `translateX(${-((startIdx>-1?startIdx:0) + ORDER.length) * itemW + centerOffset}px)`;
        void inner.offsetWidth;
        setTimeout(() => {
            inner.classList.add('rest');
            inner.style.transform = `translateX(${-(ORDER.indexOf(winningNumber) + ORDER.length * 4) * itemW + centerOffset}px)`;
        }, 50);
    }
    
    await new Promise(r => setTimeout(r, 5500));
    document.querySelector('.result-number').textContent = winningNumber;
    document.querySelector('.result').style.backgroundColor = resultColor === 'red' ? 'var(--red)' : resultColor === 'green' ? 'var(--green)' : '#111';
    dataContainer?.classList.add('reveal');
    
    let multiplier = 0;
    if (currentSelection.type === 'color' && currentSelection.value === resultColor) multiplier = resultColor === 'green' ? 36 : 2;
    else if (currentSelection.type === 'number' && parseInt(currentSelection.value) === winningNumber) multiplier = 36;
    
    await addWin(amount*multiplier, amount, 'Ruletka', multiplier>0?`Wygrałeś ${formatujWalute(amount*multiplier)}!`:null);
    document.getElementById('casino-status').innerHTML = multiplier>0 ? `<span style="color:var(--green-bright)">🏆 WYGRANA!</span>` : `<span style="color:var(--red)">Przegrana</span>`;
    isSpinning = false;
};

// Blackjack skrót
let bjDeck=[], bjPlayer=[], bjDealer=[], bjActive=false, bjBet=0;
function getBjScore(hand) {
    let score = 0;
    let aces = 0;

    hand.forEach(card => {

        if (['J', 'Q', 'K'].includes(card.rank)) {
            score += 10;
        }
        else if (card.rank === 'A') {
            score += 11;
            aces++;
        }
        else {
            score += parseInt(card.rank);
        }

    });

    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }

    return score;
}
function upBjUI(rev) {
    document.getElementById('bj-player-cards').innerHTML = bjPlayer.map(c=>createCardHTML(c)).join('');
    document.getElementById('bj-dealer-cards').innerHTML = bjDealer.map((c,i)=>createCardHTML(c, i===1&&!rev)).join('');
    document.getElementById('bj-player-score').textContent = `(${getBjScore(bjPlayer)})`;
    document.getElementById('bj-dealer-score').textContent = rev ? `(${getBjScore(bjDealer)})` : '';
}
async function startBlackjack() {
    if(bjActive) return; const a=parseInt(document.getElementById('bj-amount').value);
    if(!await deductBet(a)) return;
    bjBet=a; bjActive=true; bjDeck=buildDeck(); bjPlayer=[bjDeck.pop(),bjDeck.pop()]; bjDealer=[bjDeck.pop(),bjDeck.pop()];
    document.getElementById('bj-betting-controls').classList.add('hidden'); document.getElementById('bj-action-controls').classList.remove('hidden');
    upBjUI(false); if(getBjScore(bjPlayer)===21) bjStand();
}
function bjHit() { if(!bjActive) return; bjPlayer.push(bjDeck.pop()); upBjUI(false); if(getBjScore(bjPlayer)>21) endBlackjack(false); }
async function bjStand() { if(!bjActive) return; let dS=getBjScore(bjDealer); while(dS<17){bjDealer.push(bjDeck.pop()); dS=getBjScore(bjDealer);} upBjUI(true); const pS=getBjScore(bjPlayer); if(dS>21||pS>dS) await endBlackjack(true); else if(pS===dS) await endBlackjack(null); else await endBlackjack(false); }
async function endBlackjack(win) {
    bjActive=false; const isBj=getBjScore(bjPlayer)===21&&bjPlayer.length===2; const m=win===true?(isBj?2.5:2):(win===null?1:0);
    document.getElementById('bj-message').textContent = win===true?(isBj?'🎰 BLACKJACK!':'🏆 WYGRANA!'):(win===null?'🤝 REMIS':'💸 PRZEGRANA');
    await addWin(bjBet*m, bjBet, 'Blackjack', win===true?'Wygrana!':null);
    setTimeout(()=>{document.getElementById('bj-betting-controls').classList.remove('hidden'); document.getElementById('bj-action-controls').classList.add('hidden'); document.getElementById('bj-message').textContent='Postaw i rozdaj!';}, 2500);
}

// Plinko
let currentPlinkoRisk='high', plinkoCanvas, plinkoCtx, plinkoBalls=[], plinkoPins=[], plinkoRunning=false;
const PLINKO_RISK = { low: [16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16], medium: [110,18,1.6,1.4,1.1,1,0.5,0.4,0.4,0.4,0.5,1,1.1,1.4,1.6,18,110], high: [110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110] };
function initPlinko() {
    plinkoCanvas = document.getElementById('plinko-canvas'); if(!plinkoCanvas) return;
    plinkoCtx = plinkoCanvas.getContext('2d'); plinkoPins=[];
    for(let r=0;r<=16;r++) for(let c=0;c<r+3;c++) plinkoPins.push({x:350-(r+2)*18+c*36, y:50+r*30, r:4});
    updatePlinkoBuckets(); if(!plinkoRunning){plinkoRunning=true; plinkoLoop();}
}
function updatePlinkoBuckets() {
    const c=document.getElementById('plinko-multipliers'); if(!c) return; c.innerHTML='';
    PLINKO_RISK[currentPlinkoRisk].forEach((m,i)=> c.innerHTML+=`<div class="plinko-bucket pb-${m>=10?'ultra':m>=3?'high':m>=1?'med':'low'}" id="plinko-bucket-${i}">${m}x</div>`);
}
async function onPlinkoDrop() {
    const a=parseInt(document.getElementById('plinko-amount').value); if(!await deductBet(a)) return;
    let path=[], idx=0; for(let i=0;i<16;i++){const d=Math.random()>0.5?1:0; path.push(d); idx+=d;}
    plinkoBalls.push({x:350+(Math.random()*4-2), y:20, vx:0, vy:0, radius:6, path, row:0, finished:false, bet:a, idx, mults:PLINKO_RISK[currentPlinkoRisk]});
}
function plinkoLoop() {
    if(!plinkoCtx) return requestAnimationFrame(plinkoLoop);
    plinkoCtx.clearRect(0,0,700,550); plinkoCtx.fillStyle='rgba(212,175,55,0.7)'; plinkoCtx.beginPath();
    plinkoPins.forEach(p=>{plinkoCtx.moveTo(p.x+p.r,p.y); plinkoCtx.arc(p.x,p.y,p.r,0,Math.PI*2);}); plinkoCtx.fill();
    for(let i=plinkoBalls.length-1;i>=0;i--) {
        const b=plinkoBalls[i]; if(b.finished){plinkoBalls.splice(i,1);continue;}
        if(b.y >= 50+b.row*30) {
            if(b.row<16) {b.vx=(b.path[b.row]===1?1.5:-1.5)+(Math.random()*0.4-0.2); b.vy=-1.5; b.row++;} 
            else { finishPlinkoBall(b); b.finished=true; continue; }
        }
        b.vy+=0.25; b.x+=b.vx; b.y+=b.vy; b.vx*=0.98;
        plinkoCtx.beginPath(); plinkoCtx.arc(b.x,b.y,b.radius,0,Math.PI*2); plinkoCtx.fillStyle='#ff00cc'; plinkoCtx.fill();
    }
    requestAnimationFrame(plinkoLoop);
}
async function finishPlinkoBall(b) {
    const mult=b.mults[b.idx]; const el=document.getElementById(`plinko-bucket-${b.idx}`);
    if(el){el.classList.add('hit'); setTimeout(()=>el.classList.remove('hit'),300);}
    document.getElementById('plinko-history-list').insertAdjacentHTML('afterbegin', `<div class="history-chip ${mult>=1?'chip-win':'chip-loss'}">${mult}x</div>`);
    await addWin(b.bet*mult, b.bet, 'Plinko', mult>=5?`${mult}x`:null);
}

// MINES
let minesActive=false, minesGrid=[], minesRevealed=0, minesBet=0, minesCount=3, minesMult=1.0;
function buildMinesGrid() {
    const grid=document.getElementById('mines-grid'); if(!grid) return; grid.innerHTML='';
    for(let i=0;i<25;i++) grid.innerHTML+=`<button class="mine-tile" onclick="revealMine(${i})" data-idx="${i}"></button>`;
}
async function onMinesAction() {
    if(minesActive){ await endMines(true); return; }
    const a=parseInt(document.getElementById('mines-amount').value); minesCount=parseInt(document.getElementById('mines-count-select').value);
    if(!await deductBet(a)) return; minesBet=a; minesMult=1.0; minesRevealed=0; minesActive=true;
    minesGrid=Array(25).fill('safe'); let placed=0; while(placed<minesCount){const i=Math.floor(Math.random()*25); if(minesGrid[i]==='safe'){minesGrid[i]='bomb';placed++;}}
    buildMinesGrid(); document.getElementById('btn-mines-action').textContent='WYPŁAĆ'; document.getElementById('mines-next-multiplier').textContent='1.00x';
}
window.revealMine = function(idx) {
    if(!minesActive) return; const t=document.querySelectorAll('.mine-tile')[idx]; if(t.disabled) return; t.disabled=true;
    if(minesGrid[idx]==='bomb'){ t.textContent='💣'; t.classList.add('revealed-bomb'); endMines(false); }
    else { t.textContent='💎'; t.classList.add('revealed-gem'); minesRevealed++; minesMult*=(25-(minesRevealed-1))/((25-minesCount)-(minesRevealed-1))*0.97; document.getElementById('mines-next-multiplier').textContent=minesMult.toFixed(2)+'x'; document.getElementById('mines-current-win').textContent=formatujWalute(minesBet*minesMult); if(minesRevealed===25-minesCount) endMines(true); }
}
async function endMines(win) {
    minesActive=false; const ts=document.querySelectorAll('.mine-tile'); ts.forEach((t,i)=>{t.disabled=true; if(minesGrid[i]==='bomb'&&!t.classList.contains('revealed-bomb')){t.textContent='💣';t.classList.add('revealed-bomb','dimmed');}});
    await addWin(win?minesBet*minesMult:0, minesBet, 'Mines', win?'Wygrana!':null);
    const btn=document.getElementById('btn-mines-action'); btn.textContent=win?'WYGRANA!':'PRZEGRANA'; btn.disabled=true;
    setTimeout(()=>{btn.textContent='GRAJ'; btn.disabled=false; buildMinesGrid(); document.getElementById('mines-current-win').textContent='0,00 ułan lir';}, 2000);
}

// VIDEO POKER
let pokerHand=[], pokerHolds=[false,false,false,false,false], pokerPhase='bet', pokerBet=0, vDeck=[];
window.toggleHold = (i) => { if(pokerPhase==='hold'){pokerHolds[i]=!pokerHolds[i]; renderPokerCard(`card-${i}`, pokerHand[i]); document.getElementById(`hold-label-${i}`).className=`hold-label ${pokerHolds[i]?'held':''}`; document.getElementById(`card-${i}`).classList.toggle('held', pokerHolds[i]);} };
function evalPokerHand(hand) {
    const ranks=hand.map(c=>c.value).sort((a,b)=>a-b), suits=hand.map(c=>c.suit), counts=Object.values(ranks.reduce((a,c)=>{a[c]=(a[c]||0)+1;return a;},{})).sort((a,b)=>b-a);
    const isFlush=new Set(suits).size===1, isStr=(ranks[4]-ranks[0]===4&&new Set(ranks).size===5)||(ranks.join(',')==='2,3,4,5,14');
    if(isFlush&&isStr&&ranks[0]===10) return {name:'Royal Flush',mult:800}; if(isFlush&&isStr) return {name:'Straight Flush',mult:50}; if(counts[0]===4) return {name:'Kareta',mult:25};
    if(counts[0]===3&&counts[1]===2) return {name:'Full House',mult:9}; if(isFlush) return {name:'Kolor',mult:6}; if(isStr) return {name:'Poker (Straight)',mult:4};
    if(counts[0]===3) return {name:'Trójka',mult:3}; if(counts[0]===2&&counts[1]===2) return {name:'Dwie Pary',mult:2}; if(ranks.some(r=>counts[0]===2&&r>=11)) return {name:'Para J+',mult:1};
    return null;
}
async function pokerDeal() {
    if(pokerPhase==='bet'){
        const a=parseInt(document.getElementById('poker-amount').value); if(!await deductBet(a)) return; pokerBet=a; vDeck=buildDeck();
        pokerHand=[vDeck.pop(),vDeck.pop(),vDeck.pop(),vDeck.pop(),vDeck.pop()]; pokerHolds=[false,false,false,false,false];
        for(let i=0;i<5;i++){renderPokerCard(`card-${i}`,pokerHand[i]); document.getElementById(`hold-label-${i}`).className='hold-label';}
        document.getElementById('btn-poker-deal').textContent='WYMIEŃ'; pokerPhase='hold';
    } else {
        pokerHolds.forEach((h,i)=>{if(!h)pokerHand[i]=vDeck.pop(); renderPokerCard(`card-${i}`,pokerHand[i]);});
        const r=evalPokerHand(pokerHand); document.getElementById('poker-result-text').textContent=r?`🏆 ${r.name} x${r.mult}`:'Brak układu';
        await addWin(r?pokerBet*r.mult:0, pokerBet, 'Video Poker', r?'Wygrana!':null);
        document.getElementById('btn-poker-deal').textContent='NOWA GRA'; pokerPhase='bet';
    }
}

// KENO
let kenoSelected=new Set(), kenoPlaying=false;
function buildKenoGrid(){ const g=document.getElementById('keno-grid'); if(!g)return; g.innerHTML=''; for(let i=1;i<=80;i++){const b=document.createElement('div'); b.className='keno-ball'; b.textContent=i; b.dataset.num=i; b.onclick=()=>toggleKeno(i,b); g.appendChild(b);} }
function toggleKeno(n,el){ if(kenoPlaying)return; if(kenoSelected.has(n)){kenoSelected.delete(n);el.classList.remove('selected');} else if(kenoSelected.size<10){kenoSelected.add(n);el.classList.add('selected');} document.getElementById('keno-status').textContent=`Wybrano: ${kenoSelected.size}/10`; }
function clearKeno(){ kenoSelected.clear(); document.querySelectorAll('.keno-ball').forEach(b=>b.className='keno-ball'); document.getElementById('keno-status').textContent='Wybierz od 1 do 10'; }
async function playKeno() {
    if(kenoPlaying||kenoSelected.size===0)return; const a=parseInt(document.getElementById('keno-amount').value); if(!await deductBet(a))return; kenoPlaying=true;
    const pool=Array.from({length:80},(_,i)=>i+1).sort(()=>Math.random()-0.5), drawn=pool.slice(0,20);
    document.querySelectorAll('.keno-ball').forEach(b=>b.className='keno-ball'+(kenoSelected.has(parseInt(b.dataset.num))?' selected':''));
    document.getElementById('keno-results').classList.remove('hidden'); document.getElementById('keno-drawn-numbers').innerHTML='';
    let hits=0;
    for(let i=0;i<20;i++){
        await new Promise(r=>setTimeout(r,100)); const num=drawn[i], isHit=kenoSelected.has(num);
        document.querySelector(`.keno-ball[data-num="${num}"]`)?.classList.add(isHit?'hit':'miss');
        if(isHit)hits++; document.getElementById('keno-drawn-numbers').innerHTML+=`<div class="keno-drawn-ball">${num}</div>`;
    }
    const PT={1:[0,3],2:[0,1,9],3:[0,0,2,27],4:[0,0,1,5,75],10:[0,0,0,0,1,3,10,50,300,3000,100000]}; 
    const m=(PT[kenoSelected.size]||[0,0,0,2,5])[hits]||0;
    await addWin(a*m, a, 'Keno', m>0?`Wygrana x${m}`:null); document.getElementById('keno-status').textContent=`${hits} trafień!`; kenoPlaying=false;
}

// DICE
let diceChoice=null; window.selectDiceChoice=(c)=>{diceChoice=c; document.querySelectorAll('.dice-choice-btn').forEach(b=>b.classList.toggle('selected',b.dataset.choice===c));};
async function rollDice() {
    if(!diceChoice)return showMessage('Wybierz!'); const a=parseInt(document.getElementById('dice-amount').value); if(!await deductBet(a))return;
    document.querySelectorAll('.dice-face').forEach(e=>e.classList.add('rolling')); document.getElementById('btn-dice-roll').disabled=true;
    await new Promise(r=>setTimeout(r,1200)); document.querySelectorAll('.dice-face').forEach(e=>e.classList.remove('rolling'));
    const r1=Math.floor(Math.random()*6)+1, r2=Math.floor(Math.random()*6)+1, s=r1+r2, F=['⚀','⚁','⚂','⚃','⚄','⚅'];
    document.getElementById('dice-face-1').textContent=F[r1-1]; document.getElementById('dice-face-2').textContent=F[r2-1]; document.getElementById('dice-sum').textContent=`= ${s}`;
    let m=0; if((diceChoice==='low'&&s>=2&&s<=6) || (diceChoice==='high'&&s>=8&&s<=12)) m=1.9; else if(diceChoice==='7'&&s===7) m=5;
    await addWin(a*m, a, 'Dice', m>0?`Wygrałeś!`:''); document.getElementById('btn-dice-roll').disabled=false;
}


// =======================================
// BATCH 1 GIER (Slots, Crash, Baccarat...)
// =======================================
async function playSlots() {
    const amount = parseInt(document.getElementById('slots-amount').value);
    if (!await deductBet(amount)) return;
    const syms = [
    '🍒','🍒','🍒','🍒','🍒','🍒','🍒','🍒',
    '🍋','🍋','🍋','🍋','🍋',
    '🔔','🔔','🔔',
    '💎',
    '7️⃣'
];
    const r = () => syms[Math.floor(Math.random()*syms.length)];
    const res = [r(), r(), r()];
    for(let i=0;i<10;i++) { document.getElementById('slot-1').textContent = r(); document.getElementById('slot-2').textContent = r(); document.getElementById('slot-3').textContent = r(); await new Promise(resolve => setTimeout(resolve, 50)); }
    document.getElementById('slot-1').textContent = res[0]; document.getElementById('slot-2').textContent = res[1]; document.getElementById('slot-3').textContent = res[2];
    let mult = 0;
    if (res[0] === res[1] && res[1] === res[2]) mult = res[0] === '7️⃣' ? 50 : (res[0] === '💎' ? 20 : 10);
    else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) mult = 2;
    document.getElementById('slots-message').textContent = mult > 0 ? `Wygrana x${mult}!` : 'Spróbuj ponownie!';
    await addWin(amount * mult, amount, 'Sloty', mult > 0 ? `Wygrana x${mult}!` : null);
}

let crashActive = false, crashMult = 1.0, crashTimer, crashTarget;

async function actionCrash() {
    const btn = document.getElementById('btn-crash-action'), amount = parseInt(document.getElementById('crash-amount').value);
    
    if (!crashActive) {
        if (!await deductBet(amount)) return;
        crashActive = true; 
        crashMult = 1.0; 
        
        // --- ZMIANA LOGIKI CRASHA (MNIEJSZA DOCHODOWOŚĆ) ---
        // 1. 10% szans na to, że rakieta wybuchnie natychmiast
        if (Math.random() < 0.10) {
            crashTarget = 1.0;
        } else {
            // 2. Znacznie zmniejszamy maksymalny pułap i częstotliwość wysokich lotów
            // Math.pow(..., 3) sprawia, że wyniki mocno ciążą ku dołowi
            crashTarget = 1.0 + Math.pow(Math.random(), 3) * 4; 
        }
        // --------------------------------------------------

        btn.textContent = 'WYPŁAĆ ZYSK'; 
        document.getElementById('crash-status').textContent = 'Lot trwa...'; 
        document.getElementById('crash-multiplier').style.color = 'var(--gold)';
        
        crashTimer = setInterval(async () => {
            // Zmniejszony przyrost (0.005 zamiast 0.01) gra na nerwach gracza
            crashMult += 0.005; 
            document.getElementById('crash-multiplier').textContent = crashMult.toFixed(2) + 'x';
            
            if (crashMult >= crashTarget) { 
                clearInterval(crashTimer); 
                crashActive = false; 
                document.getElementById('crash-status').textContent = 'CRASH!'; 
                btn.textContent = '🚀 POSTAW ZAKŁAD'; 
                document.getElementById('crash-multiplier').style.color = 'var(--red)'; 
                await addWin(0, amount, 'Crash', null); 
            }
        }, 50);
    } else {
        clearInterval(crashTimer); 
        crashActive = false; 
        btn.textContent = '🚀 POSTAW ZAKŁAD'; 
        document.getElementById('crash-status').textContent = 'Wypłacono!'; 
        await addWin(amount * crashMult, amount, 'Crash', `Wypłacono x${crashMult.toFixed(2)}`);
    }
}

let baccChoice = null; window.setBaccaratBet = (c) => { baccChoice = c; document.querySelectorAll('#view-baccarat .casino-btn').forEach(b => b.classList.remove('selected')); document.getElementById(`bacc-btn-${c}`).classList.add('selected'); };
async function playBaccarat() {
    if (!baccChoice) return showMessage('Wybierz zakład!', 'error'); const amount = parseInt(document.getElementById('baccarat-amount').value); if (!await deductBet(amount)) return;
    const deck = buildDeck(), pCards = [deck.pop(), deck.pop()], bCards = [deck.pop(), deck.pop()];
    const score = (h) => h.reduce((s,c) => s + (c.value >= 10 ? 0 : c.value), 0) % 10;
    if(score(pCards) < 6) pCards.push(deck.pop()); if(score(bCards) < 6) bCards.push(deck.pop());
    const pScore = score(pCards), bScore = score(bCards);
    document.getElementById('baccarat-player-cards').innerHTML = pCards.map(c => createCardHTML(c)).join(''); document.getElementById('baccarat-banker-cards').innerHTML = bCards.map(c => createCardHTML(c)).join('');
    document.getElementById('baccarat-player-score').textContent = pScore; document.getElementById('baccarat-banker-score').textContent = bScore;
    let res = pScore > bScore ? 'player' : (bScore > pScore ? 'banker' : 'tie');
    let mult = res === baccChoice ? (res === 'tie' ? 9 : (res === 'banker' ? 1.95 : 2)) : (res === 'tie' && baccChoice !== 'tie' ? 1 : 0);
    document.getElementById('baccarat-message').textContent = mult > 1 ? 'Wygrywasz!' : (mult === 1 ? 'Remis' : 'Przegrywasz');
    await addWin(amount * mult, amount, 'Baccarat', mult > 1 ? `Wygrana!` : null);
}

let thState = {};
async function playTexasHoldemDeal() {
    const amount = parseInt(document.getElementById('th-amount').value); if (!await deductBet(amount)) return;
    const deck = buildDeck(); thState = { amount, p: [deck.pop(), deck.pop()], d: [deck.pop(), deck.pop()], c: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()] };
    document.getElementById('th-player-cards').innerHTML = thState.p.map(c => createCardHTML(c)).join(''); document.getElementById('th-dealer-cards').innerHTML = thState.d.map(c => createCardHTML(c, true)).join('');
    document.getElementById('th-community-cards').innerHTML = thState.c.slice(0,3).map(c => createCardHTML(c)).join('') + createCardHTML(null, true).repeat(2);
    document.getElementById('th-bet-controls').classList.add('hidden'); document.getElementById('th-play-controls').classList.remove('hidden'); document.getElementById('th-message').textContent = 'Call czy Fold?';
}
async function thFold() { await addWin(0, thState.amount, 'Texas Holdem', null); document.getElementById('th-message').textContent = 'Spasowałeś.'; setTimeout(()=>{document.getElementById('th-bet-controls').classList.remove('hidden'); document.getElementById('th-play-controls').classList.add('hidden');}, 2000); }
async function thCall() {
    if (!await deductBet(thState.amount * 2)) return;
    document.getElementById('th-community-cards').innerHTML = thState.c.map(c => createCardHTML(c)).join(''); document.getElementById('th-dealer-cards').innerHTML = thState.d.map(c => createCardHTML(c)).join('');
    const sum = (hand) => hand.reduce((a, b) => a + b.value, 0), pScore = sum(thState.p) + sum(thState.c), dScore = sum(thState.d) + sum(thState.c);
    let winAmt = 0, msg = '';
    if (pScore > dScore) { winAmt = thState.amount * 4; msg = 'Wygrywasz!'; } else if (pScore === dScore) { winAmt = thState.amount * 3; msg = 'Remis (Zwrot)'; } else msg = 'Krupier wygrywa.';
    document.getElementById('th-message').textContent = msg; await addWin(winAmt, thState.amount * 3, 'Texas Holdem', winAmt > thState.amount * 3 ? 'Wygrana!' : null);
    setTimeout(()=>{document.getElementById('th-bet-controls').classList.remove('hidden'); document.getElementById('th-play-controls').classList.add('hidden');}, 3000);
}

// KOŁO FORTUNY (NAPRAWIONE KĄTY)
async function playWheel() {
    const amount = parseInt(document.getElementById('wheel-amount').value);
    if (!await deductBet(amount)) return;
    const wheel = document.getElementById('fortune-wheel');
    const deg = Math.floor(Math.random() * 360) + 1440; // min 4 pełne obroty
    wheel.style.transform = `rotate(${deg}deg)`;
    document.getElementById('btn-wheel-spin').disabled = true;
    
    await new Promise(r => setTimeout(r, 4000));
    
    // Obliczanie faktycznej pozycji, na której znajduje się koło pod wskaźnikiem (0 stopni).
    // CSS obraca koło zgodnie z ruchem wskazówek zegara, więc punkt, 
    // który teraz jest na górze (0°), początkowo znajdował się na kącie -deg.
    const actualDeg = (360 - (deg % 360)) % 360;
    
    let mult = 0;
    // Kolory ustawione w background koła (45 stopni każdy segment):
    if (actualDeg >= 0 && actualDeg < 45) mult = 2;             // Czerwone
    else if (actualDeg >= 45 && actualDeg < 90) mult = 0;       // Czarne
    else if (actualDeg >= 90 && actualDeg < 135) mult = 5;      // Złote
    else if (actualDeg >= 135 && actualDeg < 180) mult = 0;     // Czarne
    else if (actualDeg >= 180 && actualDeg < 225) mult = 2;     // Czerwone
    else if (actualDeg >= 225 && actualDeg < 270) mult = 0;     // Czarne
    else if (actualDeg >= 270 && actualDeg < 315) mult = 10;    // Zielone
    else if (actualDeg >= 315 && actualDeg < 360) mult = 0;     // Czarne
    
    document.getElementById('wheel-message').textContent = mult > 0 ? `Wygrana x${mult}!` : 'Przegrana.';
    await addWin(amount * mult, amount, 'Koło Fortuny', mult > 0 ? `Wygrana x${mult}!` : null);
    document.getElementById('btn-wheel-spin').disabled = false;
}

async function buyScratch() {
    const amount = parseInt(document.getElementById('scratch-amount').value); 
    if (!await deductBet(amount)) return;
    
    const syms = ['💰','💎','🍒','🍋','🔔','🍀']; 
    let grid = []; 
    
    // Zmiana z 9 na 3 generowane symbole
    for (let i = 0; i < 3; i++) {
        grid.push(syms[Math.floor(Math.random() * syms.length)]);
    }
    
    let revealed = 0; 
    document.getElementById('scratch-message').textContent = 'Odkrywaj pola!';
    
    // Zmiana z 9 na 3 w przypisywaniu akcji do pól
    for (let i = 0; i < 3; i++) {
        const el = document.getElementById(`st-${i}`); 
        el.textContent = '❓'; 
        el.style.background = 'var(--bg-panel)';
        
        el.onclick = async () => {
            if (el.textContent !== '❓') return; 
            el.textContent = grid[i]; 
            el.style.background = 'rgba(212,175,55,0.2)'; 
            revealed++;
            
            // Zmiana warunku zakończenia zdrapywania z 9 na 3
            if (revealed === 3) {
                const counts = {}; 
                grid.forEach(s => counts[s] = (counts[s] || 0) + 1); 
                const winSym = Object.keys(counts).find(k => counts[k] >= 3);
                
                let mult = winSym ? (winSym === '💎' ? 20 : (winSym === '💰' ? 10 : 5)) : 0;
                
                document.getElementById('scratch-message').textContent = winSym ? `Wygrywasz x${mult}!` : 'Spróbuj ponownie.'; 
                await addWin(amount * mult, amount, 'Zdrapki', winSym ? `Wygrana x${mult}!` : null);
            }
        };
    }
}

let sicBet = null; window.setSicBoBet = (b) => { sicBet = b; document.querySelectorAll('#view-sic_bo .casino-btn').forEach(x => x.classList.remove('selected')); document.getElementById(`sic-btn-${b}`).classList.add('selected'); };
async function playSicBo() {
    if (!sicBet) return showMessage('Wybierz zakład!', 'error'); const amount = parseInt(document.getElementById('sic-amount').value); if (!await deductBet(amount)) return;
    const d = () => Math.floor(Math.random() * 6) + 1, d1 = d(), d2 = d(), d3 = d(), sum = d1 + d2 + d3, faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    document.getElementById('sic-dice-1').textContent = faces[d1-1]; document.getElementById('sic-dice-2').textContent = faces[d2-1]; document.getElementById('sic-dice-3').textContent = faces[d3-1]; document.getElementById('sic-sum').textContent = `Suma: ${sum}`;
    let mult = 0; if (sicBet === 'small' && sum >= 4 && sum <= 10 && !(d1 === d2 && d2 === d3)) mult = 2; if (sicBet === 'big' && sum >= 11 && sum <= 17 && !(d1 === d2 && d2 === d3)) mult = 2; if (sicBet === 'triple' && d1 === d2 && d2 === d3) mult = 30;
    document.getElementById('sic-message').textContent = mult > 0 ? `Wygrana x${mult}!` : 'Przegrana.'; await addWin(amount * mult, amount, 'Sic Bo', mult > 0 ? `Wygrana x${mult}` : null);
}

async function playBingo() {
    const amount = parseInt(document.getElementById('bingo-amount').value); if (!await deductBet(amount)) return;
    const gridEl = document.getElementById('bingo-card'), drawnEl = document.getElementById('bingo-drawn'); gridEl.innerHTML = ''; drawnEl.innerHTML = '';
    const pool = Array.from({length: 75}, (_, i) => i + 1).sort(() => Math.random() - 0.5), cardNums = pool.slice(0, 25); cardNums[12] = 'FREE';
    cardNums.forEach(n => { const d = document.createElement('div'); d.style = "aspect-ratio:1; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border-radius:4px; font-weight:bold;"; d.textContent = n; d.id = `bingo-cell-${n}`; gridEl.appendChild(d); });
    document.getElementById('bingo-cell-FREE').style.background = 'var(--gold)'; document.getElementById('bingo-cell-FREE').style.color = 'var(--bg-deep)';
    const drawn = pool.slice(25, 55); let matches = 1;
    for(let i=0; i<30; i++) {
        const n = drawn[i], d = document.createElement('div'); d.style = "width:24px; height:24px; border-radius:50%; background:var(--gold); color:var(--bg-deep); display:flex; align-items:center; justify-content:center; font-weight:bold;"; d.textContent = n; drawnEl.appendChild(d);
        const cell = document.getElementById(`bingo-cell-${n}`); if(cell) { cell.style.background = 'var(--green)'; matches++; } if(i%3===0) await new Promise(r=>setTimeout(r,50));
    }
    let mult = matches >= 12 ? 20 : (matches >= 8 ? 2 : 0); document.getElementById('bingo-message').textContent = mult > 0 ? `Trafiono ${matches} pól. Wygrana x${mult}!` : `Trafiono ${matches} pól. Przegrana.`; await addWin(amount * mult, amount, 'Bingo', mult > 0 ? `Wygrana x${mult}` : null);
}

async function playWar() {
    const amount = parseInt(document.getElementById('war-amount').value); if (!await deductBet(amount)) return;
    const deck = buildDeck(), p = deck.pop(), d = deck.pop(); renderPokerCard('war-player-card', p); renderPokerCard('war-dealer-card', d);
    let mult = p.value > d.value ? 2 : (p.value === d.value ? 1 : 0); document.getElementById('war-message').textContent = mult === 2 ? 'Wygrywasz!' : (mult === 1 ? 'Wojna! (Zwrot)' : 'Przegrywasz.'); await addWin(amount * mult, amount, 'Wojna', mult > 1 ? 'Wygrana!' : null);
}

let hiloState = { active: false, amount: 0, mult: 1.0, card: null };
async function startHiLo() {
    const amount = parseInt(document.getElementById('hilo-amount').value); if (!await deductBet(amount)) return;
    hiloState = { active: true, amount, mult: 1.0, card: buildDeck().pop() }; renderPokerCard('hilo-card', hiloState.card);
    document.getElementById('hilo-bet-controls').classList.add('hidden'); document.getElementById('hilo-play-controls').classList.remove('hidden'); updateHiLo();
}
async function hiloGuess(dir) {
    if (!hiloState.active) return; const nextCard = buildDeck().pop(); renderPokerCard('hilo-card', nextCard);
    const win = (dir === 'hi' && nextCard.value >= hiloState.card.value) || (dir === 'lo' && nextCard.value <= hiloState.card.value);
    if (win) { hiloState.mult *= 1.4; hiloState.card = nextCard; updateHiLo(); } else { hiloState.active = false; document.getElementById('hilo-message').textContent = 'Przegrana!'; await addWin(0, hiloState.amount, 'Hi-Lo', null); setTimeout(() => { document.getElementById('hilo-bet-controls').classList.remove('hidden'); document.getElementById('hilo-play-controls').classList.add('hidden'); renderPokerCard('hilo-card', null, true); }, 2000); }
}
async function hiloCashout() { if (!hiloState.active) return; hiloState.active = false; await addWin(hiloState.amount * hiloState.mult, hiloState.amount, 'Hi-Lo', `Wypłacono x${hiloState.mult.toFixed(2)}`); setTimeout(() => { document.getElementById('hilo-bet-controls').classList.remove('hidden'); document.getElementById('hilo-play-controls').classList.add('hidden'); renderPokerCard('hilo-card', null, true); }, 2000); }
function updateHiLo() { document.getElementById('hilo-win').textContent = formatujWalute(hiloState.amount * hiloState.mult); document.getElementById('hilo-mult').textContent = hiloState.mult.toFixed(2) + 'x'; document.getElementById('hilo-message').textContent = 'Zgaduj dalej...'; }

let amChoice = null; window.setAmRouletteBet = (c) => { amChoice = c; document.querySelectorAll('#view-american_roulette .casino-btn').forEach(b => b.classList.remove('selected')); document.getElementById(`am-btn-${c}`).classList.add('selected'); };
async function playAmRoulette() {
    if (!amChoice) return showMessage('Wybierz typ zakładu!', 'error'); const amount = parseInt(document.getElementById('am-roulette-amount').value); if (!await deductBet(amount)) return;
    document.getElementById('am-roulette-result').textContent = 'Kółko się kręci...'; document.getElementById('am-roulette-result').style.color = 'var(--text-muted)';
    await new Promise(r => setTimeout(r, 2000));
    const num = Math.floor(Math.random() * 38), isGreen = num === 0 || num === 37, isRed = !isGreen && (num % 2 === 1), color = isGreen ? 'green' : (isRed ? 'red' : 'black');
    document.getElementById('am-roulette-result').textContent = num === 37 ? '00' : num; document.getElementById('am-roulette-result').style.color = `var(--${color})`;
    let mult = amChoice === color ? (isGreen ? 18 : 2) : 0; document.getElementById('am-roulette-message').textContent = mult > 0 ? `Wygrana x${mult}!` : 'Przegrana.'; await addWin(amount * mult, amount, 'Am. Ruletka', mult > 0 ? `Wygrana x${mult}` : null);
}

let carState = {};
async function playCaribbeanDeal() {
    const amount = parseInt(document.getElementById('caribbean-amount').value); if (!await deductBet(amount)) return; const deck = buildDeck(); carState = { amount, p: [deck.pop(),deck.pop(),deck.pop(),deck.pop(),deck.pop()], d: [deck.pop(),deck.pop(),deck.pop(),deck.pop(),deck.pop()] };
    document.getElementById('caribbean-player-cards').innerHTML = carState.p.map(c => createCardHTML(c)).join(''); document.getElementById('caribbean-dealer-cards').innerHTML = createCardHTML(carState.d[0]) + createCardHTML(null, true).repeat(4);
    document.getElementById('caribbean-bet-controls').classList.add('hidden'); document.getElementById('caribbean-play-controls').classList.remove('hidden'); document.getElementById('caribbean-message').textContent = 'Zagraj (Call x2) lub Pasuj';
}
async function carFold() { await addWin(0, carState.amount, 'Caribbean Stud', null); document.getElementById('caribbean-bet-controls').classList.remove('hidden'); document.getElementById('caribbean-play-controls').classList.add('hidden'); }
async function carCall() {
    if (!await deductBet(carState.amount * 2)) return; document.getElementById('caribbean-dealer-cards').innerHTML = carState.d.map(c => createCardHTML(c)).join('');
    const pScore = (evalPokerHand(carState.p) || { mult: 1, name: 'Wysoka Karta' }).mult, dScore = (evalPokerHand(carState.d) || { mult: 1, name: 'Wysoka Karta' }).mult;
    let winAmt = 0, msg = ''; if (pScore > dScore) { winAmt = carState.amount * 3 + carState.amount * pScore; msg = `Wygrywasz!`; } else if (pScore === dScore) { winAmt = carState.amount * 3; msg = 'Remis'; } else msg = `Krupier wygrywa`;
    document.getElementById('caribbean-message').textContent = msg; await addWin(winAmt, carState.amount * 3, 'Caribbean Stud', winAmt > carState.amount * 3 ? 'Wygrana!' : null); setTimeout(()=>{document.getElementById('caribbean-bet-controls').classList.remove('hidden'); document.getElementById('caribbean-play-controls').classList.add('hidden');}, 3000);
}

async function playPaiGow() {
    const amount = parseInt(document.getElementById('pai-amount').value); if (!await deductBet(amount)) return;
    const deck = buildDeck(), p = Array.from({length: 7}, () => deck.pop()), d = Array.from({length: 7}, () => deck.pop());
    const p5 = evalPokerHand(p.slice(0,5)) || { name: 'Wysoka Karta', mult: 1 }, d5 = evalPokerHand(d.slice(0,5)) || { name: 'Wysoka Karta', mult: 1 };
    document.getElementById('pai-player-hands').innerHTML = `5-kart: ${p5.name} <br> 2-karty: ${p[5].rank}, ${p[6].rank}`; document.getElementById('pai-dealer-hands').innerHTML = `5-kart: ${d5.name} <br> 2-karty: ${d[5].rank}, ${d[6].rank}`; document.getElementById('pai-gow-results').classList.remove('hidden');
    const pScore = p5.mult + (p[5].value + p[6].value)/100, dScore = d5.mult + (d[5].value + d[6].value)/100;
    let mult = pScore > dScore ? 2 : (Math.abs(pScore - dScore) < 0.1 ? 1 : 0);
    document.getElementById('pai-message').textContent = mult === 2 ? 'Wygrywasz obie ręce!' : (mult === 1 ? 'Remis' : 'Krupier wygrywa.'); await addWin(amount * mult, amount, 'Pai Gow', mult > 1 ? 'Wygrana!' : null);
}

let dtChoice = null; window.setDTBet = (c) => { dtChoice = c; document.querySelectorAll('#view-dragon_tiger .casino-btn').forEach(b => b.classList.remove('selected')); document.getElementById(`dt-btn-${c}`).classList.add('selected'); };
async function playDragonTiger() {
    if (!dtChoice) return showMessage('Wybierz zakład!', 'error'); const amount = parseInt(document.getElementById('dt-amount').value); if (!await deductBet(amount)) return;
    const deck = buildDeck(), dragon = deck.pop(), tiger = deck.pop(); renderPokerCard('dt-dragon-card', dragon); renderPokerCard('dt-tiger-card', tiger);
    let res = dragon.value > tiger.value ? 'dragon' : (tiger.value > dragon.value ? 'tiger' : 'tie'), mult = res === dtChoice ? (res === 'tie' ? 11 : 2) : 0;
    document.getElementById('dt-message').textContent = mult > 0 ? `Wygrana x${mult}!` : 'Przegrana.'; await addWin(amount * mult, amount, 'Dragon Tiger', mult > 0 ? 'Wygrana!' : null);
}

async function playJackpot() {
    const amount = parseInt(document.getElementById('jackpot-amount').value); if (!await deductBet(amount)) return;
    const d = () => Math.floor(Math.random() * 50) + 1, res = [d(), d(), d()];
    document.getElementById('jp-ball-1').textContent = '?'; document.getElementById('jp-ball-2').textContent = '?'; document.getElementById('jp-ball-3').textContent = '?'; document.getElementById('jackpot-message').textContent = 'Losowanie w toku...';
    await new Promise(r => setTimeout(r, 1000)); document.getElementById('jp-ball-1').textContent = res[0]; await new Promise(r => setTimeout(r, 1000)); document.getElementById('jp-ball-2').textContent = res[1]; await new Promise(r => setTimeout(r, 1000)); document.getElementById('jp-ball-3').textContent = res[2];
    const w = [d(), d(), d()]; let matches = 0; res.forEach(n => { if (w.includes(n)) matches++; });
    let mult = matches === 3 ? 10000 : (matches === 2 ? 15 : (matches === 1 ? 0.5 : 0));
    document.getElementById('jackpot-message').textContent = matches > 0 ? `Trafiono ${matches} liczb! Wypłata x${mult}` : 'Brak trafień.'; await addWin(amount * mult, amount, 'Mega Jackpot', matches > 0 ? `Wygrana x${mult}` : null);
}

// =======================================
// NOWOŚCI: 5 CAŁKOWICIE NOWYCH GIER
// =======================================

// 1. COIN FLIP
let coinBet = null;
window.setCoinBet = (b) => { coinBet = b; document.querySelectorAll('#view-coinflip .casino-btn').forEach(btn => btn.classList.remove('selected')); document.getElementById(`btn-coin-${b}`).classList.add('selected'); };
async function playCoinflip() {
    if (!coinBet) return showMessage('Wybierz stronę monety!', 'error');
    const amount = parseInt(document.getElementById('coinflip-amount').value);
    if (!await deductBet(amount)) return;
    
    const coin = document.getElementById('coin-visual');
    coin.style.transform = 'rotateY(1080deg) scale(1.5)';
    document.getElementById('btn-coinflip-play').disabled = true;
    document.getElementById('coinflip-message').textContent = 'Rzut w powietrzu...';
    
    await new Promise(r => setTimeout(r, 2000));
    
    const result = Math.random() < 0.5 ? 'orzel' : 'reszka';
    coin.style.transform = 'rotateY(0deg) scale(1)';
    coin.textContent = result === 'orzel' ? '🦅' : '🪙';
    document.getElementById('coinflip-result').textContent = result === 'orzel' ? 'ORZEŁ!' : 'RESZKA!';
    
    let mult = result === coinBet ? 1.95 : 0;
    document.getElementById('coinflip-message').textContent = mult > 0 ? 'Wygrywasz!' : 'Niestety, spróbuj ponownie.';
    await addWin(amount * mult, amount, 'Coin Flip', mult > 0 ? `Wygrana x${mult}` : null);
    document.getElementById('btn-coinflip-play').disabled = false;
}

// 2. TRZY KARTY (Three Card Monte)
let threeCardsState = { active: false, amount: 0, cards: [] };
async function playThreeCards() {
    const amount = parseInt(document.getElementById('threecards-amount').value);
    if (!await deductBet(amount)) return;
    
    const deck = buildDeck().filter(c => !(c.rank === 'A' && c.suit === '♥')); // Usuwamy ewentualnego Asa kier z talii
    threeCardsState = { active: true, amount, cards: [deck.pop(), deck.pop(), {rank: 'A', suit: '♥', color: 'red', value: 14}] };
    threeCardsState.cards.sort(() => Math.random() - 0.5); // Losowa pozycja asa
    
    for(let i=0; i<3; i++) {
        renderPokerCard(`tc-card-${i}`, null, true); // Tylko koszulki
        document.getElementById(`tc-card-${i}`).style.transform = `translateX(${Math.random()*20-10}px) translateY(${Math.random()*10-5}px)`;
    }
    
    document.getElementById('btn-threecards-play').disabled = true;
    document.getElementById('threecards-message').textContent = 'Karty przetasowane! Gdzie jest As Kier?';
}
window.selectThreeCard = async (idx) => {
    if (!threeCardsState.active) return;
    threeCardsState.active = false;
    
    for(let i=0; i<3; i++) {
        renderPokerCard(`tc-card-${i}`, threeCardsState.cards[i], false);
        document.getElementById(`tc-card-${i}`).style.transform = 'none';
    }
    
    const win = threeCardsState.cards[idx].rank === 'A' && threeCardsState.cards[idx].suit === '♥';
    const mult = win ? 2.8 : 0;
    
    document.getElementById('threecards-message').textContent = win ? 'Masz oko! Wygrana x2.8' : 'Niestety, pudło.';
    await addWin(threeCardsState.amount * mult, threeCardsState.amount, 'Trzy Karty', win ? 'Wygrana!' : null);
    document.getElementById('btn-threecards-play').disabled = false;
}

// ============================================
// HORSE RACING MULTIPLAYER
// ============================================

let currentHorseRoomId = null;
let unsubHorseLobby = null;
let unsubHorseRoom = null;
let isHorseHost = false;
let selectedMultiHorse = null;
let horseAnimInterval = null;
let isHorseRacingAnim = false;

window.setMultiHorseBet = (h) => { 
    selectedMultiHorse = h; 
    document.querySelectorAll('#view-horseracing .casino-btn').forEach(btn => btn.classList.remove('selected')); 
    document.getElementById(`btn-mhorse-${h}`).classList.add('selected'); 
};

// Nawigacja - podpięcie pod przycisk menu
document.querySelector('.nav-btn[data-view="horseracing"]')?.addEventListener('click', () => {
    switchView('horseracing');
    listenToHorseLobby();
});

document.getElementById('btn-create-horse-table')?.addEventListener('click', async () => {
    if (!currentUserId) return showMessage('Zaloguj się!', 'error');
    try {
        // Usunięto window.addDoc i window.collection
        const ref = await addDoc(collection(db, 'stoliki_horse'), {
            hostId: currentUserId, hostName: player.name, status: 'betting', 
            winner: null, players: {}, timestamp: serverTimestamp() // Usunięto window.serverTimestamp
        });
        isHorseHost = true; currentHorseRoomId = ref.id;
        enterHorseRoomUI(); listenToHorseRoom();
    } catch (e) { showMessage(e.message, 'error'); }
});

document.getElementById('btn-leave-horse-table')?.addEventListener('click', async () => {
    if (!currentHorseRoomId) return;
    try {
        // Usunięto window.doc
        const ref = doc(db, 'stoliki_horse', currentHorseRoomId);
        if (isHorseHost) await updateDoc(ref, { status: 'closed' }); // Usunięto window.updateDoc
        else await updateDoc(ref, { [`players.${currentUserId}`]: deleteField() }); // Usunięto window.deleteField
    } catch(e) {}
    currentHorseRoomId = null; isHorseHost = false;
    if(unsubHorseRoom) unsubHorseRoom();
    exitHorseRoomUI(); listenToHorseLobby();
});

document.getElementById('btn-horse-multi-bet')?.addEventListener('click', async () => {
    if (!currentHorseRoomId || !selectedMultiHorse) return showMessage('Wybierz konia!', 'error');
    const amount = parseInt(document.getElementById('horse-multi-amount').value);
    if (!await deductBet(amount)) return;
    
    // Usunięto przedrostki window. przy funkcjach Firestore
    await updateDoc(doc(db, 'stoliki_horse', currentHorseRoomId), {
        [`players.${currentUserId}`]: { name: player.name, bet: amount, horse: selectedMultiHorse, status: 'ready' }
    });
    showMessage(`Obstawiono konia #${selectedMultiHorse}`, 'info');
});

document.getElementById('btn-start-horse-race')?.addEventListener('click', async () => {
    if (!isHorseHost || !currentHorseRoomId) return;
    const winner = Math.floor(Math.random() * 4) + 1; 
    // Usunięto window.updateDoc i window.doc
    await updateDoc(doc(db, 'stoliki_horse', currentHorseRoomId), {
        status: 'racing', winner: winner
    });
});

window.joinHorseTable = async (roomId) => {
    if (!currentUserId) return showMessage('Zaloguj się!', 'error');
    // Usunięto window.doc i window.getDoc
    const ref = doc(db, 'stoliki_horse', roomId);
    const data = (await getDoc(ref)).data();
    if(data.status !== 'betting') return showMessage('Wyścig już trwa lub zamknięty!', 'error');
    
    isHorseHost = false; currentHorseRoomId = roomId;
    enterHorseRoomUI(); listenToHorseRoom();
};

function listenToHorseLobby() {
    const list = document.getElementById('horse-tables-list');
    if (!list) return;
    if (unsubHorseLobby) unsubHorseLobby();
    // Zastąpiono zmienną pętli "doc" na "docSnap", aby nie kolidowała z funkcją doc() z Firebase
    unsubHorseLobby = onSnapshot(collection(db, 'stoliki_horse'), snap => {
        if (currentHorseRoomId) return; 
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.status === 'closed') return;
            const row = document.createElement('div');
            row.className = 'history-row';
            row.innerHTML = `<span class="h-col h-user">Wyścig: ${d.hostName}</span> <span class="h-col">${d.status === 'betting' ? '🟢 Obstawianie' : '🔴 W trakcie'}</span>`;
            if (d.status === 'betting') {
                const btn = document.createElement('button');
                btn.className = 'btn-accent'; btn.style.cssText = 'padding: 4px 10px; font-size: 0.8rem;';
                btn.textContent = 'DOŁĄCZ'; btn.onclick = () => joinHorseTable(docSnap.id);
                row.appendChild(btn);
            }
            list.appendChild(row);
        });
    });
}

function listenToHorseRoom() {
    if (!currentHorseRoomId) return;
    if (unsubHorseRoom) unsubHorseRoom();
    
    unsubHorseRoom = onSnapshot(doc(db, 'stoliki_horse', currentHorseRoomId), snap => {
        if (!snap.exists()) return exitHorseRoomUI();
        const data = snap.data();
        
        if (data.status === 'closed') { 
            showMessage('Wyścig zamknięty.', 'info'); 
            document.getElementById('btn-leave-horse-table').click(); 
            return; 
        }
        
        document.getElementById('horse-room-name').textContent = `Tor Gracza: ${data.hostName} | Status: ${data.status.toUpperCase()}`;
        
        const startBtn = document.getElementById('btn-start-horse-race');
        if (isHorseHost && data.status === 'betting') startBtn.classList.remove('hidden');
        else startBtn.classList.add('hidden');
        
        const pCont = document.getElementById('horse-multi-players');
        pCont.innerHTML = '';
        for (const [uid, pData] of Object.entries(data.players || {})) {
            let userStatus = pData.status === 'ready' ? '🟢 Gotowy' : '⏳ Czeka';
            pCont.innerHTML += `<div style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; font-size:0.85rem;">
                <strong style="color:var(--gold);">${pData.name}</strong><br>
                Koń: ${pData.horse ? '#' + pData.horse : 'Brak'} | Stawka: ${pData.bet} <br>
                <span style="font-size:0.75rem; color:var(--text-muted);">${userStatus}</span>
            </div>`;
        }

        // ==========================================
        // 1. ZAKOŃCZENIE ANIMACJI I RESET PRZEZ HOSTA
        // ==========================================
        if (data.status === 'racing' && !isHorseRacingAnim) {
            isHorseRacingAnim = true;
            document.getElementById('horse-multi-controls').classList.add('hidden');
            
            runHorseRaceAnimation(data.winner, () => {
                isHorseRacingAnim = false;
                
                if (isHorseHost) {
                    // Host daje sygnał do wypłat
                    updateDoc(doc(db, 'stoliki_horse', currentHorseRoomId), { status: 'resolving' });
                    
                    // Host czeka 6 sekund i automatycznie RESETUJE stół do nowej gry!
                    setTimeout(async () => {
                        try {
                            const roomRef = doc(db, 'stoliki_horse', currentHorseRoomId);
                            const roomSnap = await getDoc(roomRef);
                            
                            // Upewniamy się, że pokój nadal jest w fazie resolving
                            if (roomSnap.exists() && roomSnap.data().status === 'resolving') {
                                const latestData = roomSnap.data();
                                let updates = { status: 'betting', winner: null };
                                
                                // Czystka statusów graczy z poprzedniej rundy
                                for (const uid of Object.keys(latestData.players || {})) {
                                    updates[`players.${uid}.status`] = 'waiting';
                                    updates[`players.${uid}.horse`] = null;
                                    updates[`players.${uid}.bet`] = 0;
                                }
                                await updateDoc(roomRef, updates);
                            }
                        } catch(e) { console.error(e); }
                    }, 6000);
                }
            });
        }
        
        // ==========================================
        // 2. WYPŁATY ZYSKÓW DLA GRACZY
        // ==========================================
        const myData = data.players?.[currentUserId];
        if (data.status === 'resolving' && myData && myData.status === 'ready') {
            let winAmt = (myData.horse === data.winner) ? myData.bet * 3.8 : 0;
            let msg = winAmt > 0 ? 'Wygrana!' : 'Przegrana.';
            
            addWin(winAmt, myData.bet, 'Wyścigi Live', `Koń #${data.winner} wygrywa. ${msg}`).then(() => {
                // Potwierdzenie odebrania nagrody, żeby nie wypłaciło dwa razy
                updateDoc(doc(db, 'stoliki_horse', currentHorseRoomId), { [`players.${currentUserId}.status`]: 'rewarded' });
            });
        }

        // ==========================================
        // 3. RESETOWANIE PLANSZY DO NOWEJ RUNDY
        // ==========================================
        if (data.status === 'betting' && !isHorseRacingAnim) {
            document.getElementById('horse-multi-controls').classList.remove('hidden');
            
            // Odznaczamy przyciski z poprzedniej gry
            document.querySelectorAll('#view-horseracing .casino-btn').forEach(btn => btn.classList.remove('selected'));
            selectedMultiHorse = null;
            
            // Cofamy konie na linię startu
            for(let i=1; i<=4; i++) {
                const el = document.getElementById(`multi-horse-${i}`);
                if(el) el.style.left = '0%';
            }
        }
    });
}

function runHorseRaceAnimation(winnerNum, callback) {
    let pos = [0, 0, 0, 0];
    if (horseAnimInterval) clearInterval(horseAnimInterval);
    
    horseAnimInterval = setInterval(() => {
        let maxPos = 0;
        for(let i=0; i<4; i++) {
            let speedBoost = (i+1 === winnerNum) ? 0.8 : 0;
            pos[i] += Math.random() * 2.0 + speedBoost; 
            
            if (pos[i] >= 90) pos[i] = 90;
            document.getElementById(`multi-horse-${i+1}`).style.left = `${pos[i]}%`;
            if (pos[i] > maxPos) maxPos = pos[i];
        }
        
        if (pos[winnerNum-1] >= 90) { 
            clearInterval(horseAnimInterval);
            setTimeout(callback, 2000); 
        }
    }, 50);
}

function enterHorseRoomUI() {
    document.getElementById('horse-multi-lobby').classList.add('hidden');
    document.getElementById('horse-multi-room').classList.remove('hidden');
}

function exitHorseRoomUI() {
    document.getElementById('horse-multi-room').classList.add('hidden');
    document.getElementById('horse-multi-lobby').classList.remove('hidden');
}

// 4. RZUTY KARNE
let penBet = null;
window.setPenaltyBet = (d) => { penBet = d; document.querySelectorAll('#view-penalty .casino-btn').forEach(btn => btn.classList.remove('selected')); document.getElementById(`btn-pen-${d}`).classList.add('selected'); };
async function playPenalty() {
    if (!penBet) return showMessage('Wybierz róg bramki!', 'error');
    const amount = parseInt(document.getElementById('penalty-amount').value);
    if (!await deductBet(amount)) return;
    
    document.getElementById('btn-penalty-play').disabled = true;
    document.getElementById('penalty-message').textContent = 'Biegniesz do piłki...';
    
    const ball = document.getElementById('pen-ball');
    const goalie = document.getElementById('pen-goalie');
    const dirs = ['left', 'center', 'right'];
    const gChoice = dirs[Math.floor(Math.random() * dirs.length)];
    
    // Animacja piłki
    if (penBet === 'left') { ball.style.left = '10%'; ball.style.bottom = '120px'; }
    else if (penBet === 'center') { ball.style.left = '50%'; ball.style.bottom = '140px'; }
    else { ball.style.left = '90%'; ball.style.bottom = '120px'; }
    
    // Animacja bramkarza
    setTimeout(async () => {
        if (gChoice === 'left') { goalie.style.left = '20%'; goalie.style.bottom = '20px'; }
        else if (gChoice === 'center') { goalie.style.left = '50%'; goalie.style.bottom = '10px'; }
        else { goalie.style.left = '80%'; goalie.style.bottom = '20px'; }
        
        await new Promise(r => setTimeout(r, 600));
        
        let win = penBet !== gChoice;
        let mult = win ? 2.8 : 0;
        
        document.getElementById('penalty-message').textContent = win ? 'GOOOOOL!' : 'OBRONIONY!';
        await addWin(amount * mult, amount, 'Rzuty Karne', win ? 'Gool!' : null);
        document.getElementById('btn-penalty-play').disabled = false;
        
        setTimeout(() => {
            ball.style.left = '50%'; ball.style.bottom = '-40px';
            goalie.style.left = '50%'; goalie.style.bottom = '0';
        }, 2000);
    }, 200);
}

// 5. RED DOG POKER
let rdState = { active: false, amount: 0, c1: null, c2: null };
async function rdDeal() {
    const amount = parseInt(document.getElementById('rd-amount').value);
    if (!await deductBet(amount)) return;
    
    const deck = buildDeck();
    let c1 = deck.pop(), c2 = deck.pop();
    if (c1.value > c2.value) [c1, c2] = [c2, c1]; // Sortujemy rosnąco
    
    rdState = { active: true, amount, c1, c2, deck };
    renderPokerCard('rd-card-1', c1);
    renderPokerCard('rd-card-2', c2);
    renderPokerCard('rd-card-mid', null, true);
    
    const spread = c2.value - c1.value - 1;
    document.getElementById('rd-bet-controls').classList.add('hidden');
    
    if (spread < 0) { // Takie same karty
        document.getElementById('rd-spread-info').textContent = 'Takie same karty! Dociągamy trzecią...';
        await new Promise(r => setTimeout(r, 1500));
        const c3 = deck.pop();
        renderPokerCard('rd-card-mid', c3);
        let win = c3.value === c1.value;
        let mult = win ? 12 : 1; // 11:1 za trójkę, w przeciwnym razie zwrot
        document.getElementById('rd-message').textContent = win ? 'TRÓJKA! Wypłata 11:1!' : 'Brak trójki (Zwrot).';
        await addWin(amount * mult, amount, 'Red Dog', win ? 'Wygrana 11:1!' : null);
        setTimeout(resetRD, 3000);
    } else if (spread === 0) { // Kolejne karty
        document.getElementById('rd-spread-info').textContent = 'Kolejne karty. Remis (Zwrot).';
        await addWin(amount, amount, 'Red Dog', null);
        setTimeout(resetRD, 3000);
    } else { // Normalny spread
        let payout = spread === 1 ? '5:1' : (spread === 2 ? '4:1' : (spread === 3 ? '2:1' : '1:1'));
        document.getElementById('rd-spread-info').textContent = `Spread: ${spread} kart (Potencjalna wyplata ${payout})`;
        document.getElementById('rd-play-controls').classList.remove('hidden');
        document.getElementById('rd-message').textContent = 'Graj za Ante, lub Podbij (x2)';
    }
}
async function rdCall() { await resolveRedDog(1); }
async function rdRaise() {
    if (!await deductBet(rdState.amount)) return; // Pobieramy drugie tyle
    await resolveRedDog(2);
}
async function resolveRedDog(betMultiplier) {
    document.getElementById('rd-play-controls').classList.add('hidden');
    const c3 = rdState.deck.pop();
    renderPokerCard('rd-card-mid', c3);
    
    const spread = rdState.c2.value - rdState.c1.value - 1;
    let odds = spread === 1 ? 5 : (spread === 2 ? 4 : (spread === 3 ? 2 : 1));
    
    let win = c3.value > rdState.c1.value && c3.value < rdState.c2.value;
    let totalBet = rdState.amount * betMultiplier;
    
    if (win) {
        let winAmt = totalBet + (totalBet * odds);
        document.getElementById('rd-message').textContent = `Trafienie! Wygrana ${odds}:1!`;
        await addWin(winAmt, totalBet, 'Red Dog', 'Wygrana!');
    } else {
        document.getElementById('rd-message').textContent = 'Karta poza spreadem. Przegrana.';
        await addWin(0, totalBet, 'Red Dog', null);
    }
    setTimeout(resetRD, 3000);
}
function resetRD() {
    rdState.active = false;
    document.getElementById('rd-bet-controls').classList.remove('hidden');
    document.getElementById('rd-play-controls').classList.add('hidden');
    document.getElementById('rd-spread-info').textContent = '';
    document.getElementById('rd-message').textContent = '';
    renderPokerCard('rd-card-1', null, true);
    renderPokerCard('rd-card-2', null, true);
    renderPokerCard('rd-card-mid', null, true);
}


let workEndTime = 0;
let workInterval = null;

function initWorkSystem() {
    const workBtn = document.getElementById('btn-work-system');
    if (!workBtn) return;

    workBtn.addEventListener('click', async () => {
        if (!currentUserId) return showMessage('Zaloguj się!', 'error');
        if (Date.now() < workEndTime) return showMessage('Jesteś jeszcze zmęczony!', 'error');

        workBtn.disabled = true;
        let timeLeft = 60; // Czas pracy w sekundach
        workEndTime = Date.now() + (timeLeft * 1000);

        workInterval = setInterval(async () => {
            timeLeft--;
            workBtn.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Praca w toku... (${timeLeft}s)`;
            
            if (timeLeft <= 0) {
                clearInterval(workInterval);
                workBtn.disabled = false;
                workBtn.innerHTML = `<i class="fa-solid fa-briefcase"></i> IDŹ DO PRACY (60 sekund)`;
                
                // Dodajemy wypłatę (np. 500 ułan lirów)
                const wyplata = 500;
                await addWin(wyplata, 0, 'Praca', `Otrzymano wypłatę: ${wyplata} ułan lir`);
            }
        }, 1000);
    });
}

// ============================================
// BLACKJACK MULTIPLAYER (Live)
// ============================================

var currentRoomId = null;
var unsubMultiLobby = null;
var unsubRoom = null;
var isRoomHost = false;

// 1. LOBBY (Lista stołów)
function listenToMultiLobby() {
    const list = document.getElementById('bj-tables-list');
    if (!list) return;
    
    // Zatrzymujemy poprzedni nasłuch, jeśli istnieje
    if (unsubMultiLobby) unsubMultiLobby();
    
    // Nasłuchujemy zmian w kolekcji stolików
    unsubMultiLobby = onSnapshot(collection(db, 'stoliki_bj'), snap => {
        if (!currentRoomId) { // Odświeżamy listę tylko jeśli nie jesteśmy przy stole
            list.innerHTML = '';
            let count = 0;
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                
                // === TA LINIJKA NAPRAWIA PROBLEM ===
                // Pomijamy stoły, które zostały zamknięte przez Hosta
                if (data.status === 'closed') return; 
                
                count++;
                
                const row = document.createElement('div');
                row.className = 'history-row';
                
                // Wrzucamy do środka tylko teksty (bez przycisku)
                row.innerHTML = `
                    <span class="h-col h-user">Stół: ${data.hostName}</span>
                    <span class="h-col h-type">Graczy: ${Object.keys(data.players || {}).length}/4</span>
                    <span class="h-col h-val">${data.status === 'waiting' ? '🟢 Otwarte' : '🔴 W Grze'}</span>
                `;
                
                // KULOODPORNE TWORZENIE PRZYCISKU
                const joinBtn = document.createElement('button');
                joinBtn.className = 'btn-accent';
                joinBtn.style.cssText = 'padding: 4px 10px; font-size: 0.8rem;';
                joinBtn.textContent = 'DOŁĄCZ';
                joinBtn.addEventListener('click', () => {
                    joinMultiTable(docSnap.id);
                });
                
                // Doklejamy przycisk do wiersza
                row.appendChild(joinBtn);
                list.appendChild(row);
            });
            
            if (count === 0) {
                list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Brak otwartych stołów. Stwórz własny!</p>';
            }
        }
    });
}

// 2. TWORZENIE STOŁU
async function createMultiTable() {
    if (!currentUserId) return showMessage('Musisz być zalogowany!', 'error');
    
    try {
        const newRoomRef = await addDoc(collection(db, 'stoliki_bj'), {
            hostId: currentUserId,
            hostName: player.name,
            status: 'waiting', // waiting, betting, playing, finished
            dealerCards: [],
            deck: [],
            players: {
                [currentUserId]: { name: player.name, cards: [], bet: 0, status: 'waiting', score: 0 }
            },
            timestamp: serverTimestamp()
        });
        isRoomHost = true;
        currentRoomId = newRoomRef.id;
        enterRoomUI();
        listenToRoom();
    } catch (e) {
        showMessage('Błąd przy tworzeniu stołu: ' + e.message, 'error');
    }
}

// 3. DOŁĄCZANIE DO STOŁU
async function joinMultiTable(roomId) {
    if (!currentUserId) return showMessage('Zaloguj się!', 'error');
    
    try {
        const roomRef = doc(db, 'stoliki_bj', roomId);
        const roomData = (await getDoc(roomRef)).data();
        
        if (roomData.status !== 'waiting') return showMessage('Gra już trwa na tym stole!', 'error');
        if (Object.keys(roomData.players || {}).length >= 4) return showMessage('Stół jest pełny!', 'error');

        await updateDoc(roomRef, {
            [`players.${currentUserId}`]: { name: player.name, cards: [], bet: 0, status: 'waiting', score: 0 }
        });
        
        isRoomHost = false;
        currentRoomId = roomId;
        enterRoomUI();
        listenToRoom();
    } catch (e) {
        showMessage('Błąd dołączania: ' + e.message, 'error');
    }
}

// 4. WYCHODZENIE ZE STOŁU (Wzmocnione)
async function leaveMultiTable() {
    // Jeśli nie ma pokoju, po prostu resetujemy UI
    if (!currentRoomId || !currentUserId) {
        exitRoomUI();
        listenToMultiLobby();
        return;
    }
    
    try {
        const roomRef = doc(db, 'stoliki_bj', currentRoomId);
        
        if (isRoomHost) {
            await updateDoc(roomRef, { status: 'closed' });
        } else {
            await updateDoc(roomRef, {
                [`players.${currentUserId}`]: deleteField()
            });
        }
    } catch (e) {
        console.warn('Pokój mógł już zostać usunięty lub zamknięty.');
    }
    
    // Zatrzymujemy nasłuch starego stołu
    if (unsubRoom) { 
        unsubRoom(); 
        unsubRoom = null; 
    }
    
    // Resetujemy zmienne lokalne
    currentRoomId = null;
    isRoomHost = false;
    
    // Wymuszamy wyjście z UI i powrót do nasłuchiwania lobby
    exitRoomUI();
    listenToMultiLobby();
}

// 4b. START GRY (Tylko Host)
async function startMultiGame() {
    if (!isRoomHost || !currentRoomId) return;
    try {
        // Zmieniamy status stołu, aby przejść do fazy obstawiania
        await updateDoc(doc(db, 'stoliki_bj', currentRoomId), {
            status: 'betting'
        });
    } catch (e) {
        showMessage('Błąd startu gry: ' + e.message, 'error');
    }
}

// --- AKCJE GRACZA MULTIPLAYER ---
async function placeMultiBet() {
    if (!currentRoomId || !currentUserId) return;
    const amount = parseInt(document.getElementById('bj-multi-amount').value);
    
    // deductBet to Twoja funkcja - pobiera kasę z konta
    if (!await deductBet(amount)) return; 

    try {
        await updateDoc(doc(db, 'stoliki_bj', currentRoomId), {
            [`players.${currentUserId}.bet`]: amount,
            [`players.${currentUserId}.status`]: 'ready' // Gracz gotowy do gry
        });
    } catch (e) { showMessage('Błąd zakładu: ' + e.message, 'error'); }
}

async function multiHit() {
    if (!currentRoomId || !currentUserId) return;
    const roomRef = doc(db, 'stoliki_bj', currentRoomId);
    
    // Pobieramy aktualny stan talii
    const roomData = (await getDoc(roomRef)).data();
    let myCards = roomData.players[currentUserId].cards;
    let deck = roomData.deck;
    
    myCards.push(deck.pop());
    let score = getBjScore(myCards);
    
    let updates = { [`players.${currentUserId}.cards`]: myCards, deck: deck };
    if (score >= 21) updates[`players.${currentUserId}.status`] = 'finished'; // Fura lub Oczko
    
    await updateDoc(roomRef, updates);
}

async function multiStand() {
    if (!currentRoomId || !currentUserId) return;
    await updateDoc(doc(db, 'stoliki_bj', currentRoomId), {
        [`players.${currentUserId}.status`]: 'finished'
    });
}

// 5. NASŁUCHIWANIE I SILNIK GRY (LIVE)
function listenToRoom() {
    if (!currentRoomId) return;
    if (unsubRoom) unsubRoom();
    
    unsubRoom = onSnapshot(doc(db, 'stoliki_bj', currentRoomId), snap => {
        if (!snap.exists()) {
            showMessage('Stół został usunięty.', 'error');
            return leaveMultiTable();
        }
        const data = snap.data();
        if (data.status === 'closed') {
            showMessage('Host zamknął stół.', 'info');
            return leaveMultiTable();
        }

        // --- 1. ZARZĄDZANIE STARTEM (Tylko Host) ---
        const startBtn = document.getElementById('btn-start-multi-game');
        if (startBtn) {
            if (isRoomHost && data.status === 'waiting') startBtn.classList.remove('hidden');
            else startBtn.classList.add('hidden');
        }

        // --- 2. SILNIK GRY HOSTA (Automatyczny Krupier) ---
        if (isRoomHost) {
            const allPlayers = Object.values(data.players || {});
            
            // Faza 1: Rozdanie kart (gdy wszyscy postawili)
            if (data.status === 'betting' && allPlayers.length > 0 && allPlayers.every(p => p.status === 'ready')) {
                let newDeck = buildDeck();
                let updates = { status: 'playing', deck: newDeck, dealerCards: [newDeck.pop(), newDeck.pop()] };
                for (let uid of Object.keys(data.players)) {
                    updates[`players.${uid}.cards`] = [newDeck.pop(), newDeck.pop()];
                    updates[`players.${uid}.status`] = 'playing';
                }
                updateDoc(doc(db, 'stoliki_bj', currentRoomId), updates);
            }
            
            // Faza 2: Tura Krupiera (gdy wszyscy gracze skończyli dobierać)
            if (data.status === 'playing' && allPlayers.length > 0 && allPlayers.every(p => p.status === 'finished')) {
                let currentDealerCards = [...data.dealerCards];
                let currentDeck = [...data.deck];
                let dScore = getBjScore(currentDealerCards);
                
                while (dScore < 17) { currentDealerCards.push(currentDeck.pop()); dScore = getBjScore(currentDealerCards); }
                updateDoc(doc(db, 'stoliki_bj', currentRoomId), {
                    status: 'resolving', dealerCards: currentDealerCards, deck: currentDeck
                });
            }
            
            // Faza 3: Reset Stołu (gdy wszyscy odebrali nagrody)
            if (data.status === 'resolving' && allPlayers.length > 0 && allPlayers.every(p => p.status === 'rewarded')) {
                let updates = { status: 'waiting', dealerCards: [], deck: [] };
                for (let uid of Object.keys(data.players)) {
                    updates[`players.${uid}.cards`] = []; updates[`players.${uid}.bet`] = 0; updates[`players.${uid}.status`] = 'waiting';
                }
                setTimeout(() => { updateDoc(doc(db, 'stoliki_bj', currentRoomId), updates); }, 4000); // 4 sek. na wyniki
            }
        }

        // --- 3. ODBIERANIE NAGRÓD (Każdy gracz osobno) ---
        const myData = data.players?.[currentUserId];
        if (data.status === 'resolving' && myData && myData.status === 'finished') {
            const pScore = getBjScore(myData.cards);
            const dScore = getBjScore(data.dealerCards);
            let winAmt = 0; let msg = '';
            
            if (pScore > 21) { msg = 'Fura! (Bust)'; }
            else if (dScore > 21 || pScore > dScore) { winAmt = myData.bet * 2; msg = 'Wygrana!'; }
            else if (pScore === dScore) { winAmt = myData.bet; msg = 'Remis (Zwrot)'; }
            else { msg = 'Krupier wygrywa'; }
            
            addWin(winAmt, myData.bet, 'BJ Live', msg).then(() => {
                updateDoc(doc(db, 'stoliki_bj', currentRoomId), { [`players.${currentUserId}.status`]: 'rewarded' });
            });
        }

        // --- 4. RENDEROWANIE STOŁU W HTML ---
        document.getElementById('bj-room-name').textContent = `Stół Gracza: ${data.hostName} | Status: ${data.status.toUpperCase()}`;
        
        // Krupier (ukrywa drugą kartę w trakcie gry)
        const hideDealer = data.status === 'playing';
        document.getElementById('bj-multi-dealer-cards').innerHTML = (data.dealerCards || []).map((c, i) => createCardHTML(c, i === 1 && hideDealer)).join('');
        document.getElementById('bj-multi-dealer-score').textContent = hideDealer ? '' : `(${getBjScore(data.dealerCards || [])})`;
        
        // Gracze
        const playersContainer = document.getElementById('bj-multi-players');
        playersContainer.innerHTML = '';
        for (const [uid, pData] of Object.entries(data.players || {})) {
            const isMe = uid === currentUserId;
            const playerDiv = document.createElement('div');
            playerDiv.style.cssText = `flex: 1; min-width: 150px; background: rgba(255,255,255,0.03); border: 1px solid ${isMe ? 'var(--gold)' : 'var(--border)'}; border-radius: 8px; padding: 10px; text-align: center;`;
            
            const cardsHtml = (pData.cards || []).map(c => createCardHTML(c)).join('');
            const score = getBjScore(pData.cards || []);
            let statusText = pData.status === 'ready' ? '🟢 Gotowy' : (pData.status === 'finished' || pData.status === 'rewarded' ? '🛑 Czeka' : '⏳ Gra');
            if (data.status === 'waiting') statusText = 'Oczekuje';
            
            playerDiv.innerHTML = `
                <h4 style="color: ${isMe ? 'var(--gold)' : 'var(--text)'}; margin-bottom: 5px;">${isMe ? '👤 TY' : pData.name}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">
                    Zakład: ${formatujWalute(pData.bet)} <br> ${statusText}
                </div>
                <div class="bj-cards-row" style="justify-content: center; min-height: 80px; gap: 4px; transform: scale(0.85);">${cardsHtml}</div>
                <div style="margin-top: 5px; color: ${score > 21 ? 'var(--red)' : 'var(--gold)'}; font-weight: bold;">Suma: ${score}</div>
            `;
            playersContainer.appendChild(playerDiv);
        }

        // --- 5. PRZEŁĄCZANIE KONTROLEK GRACZA ---
        const controls = document.getElementById('bj-multi-controls');
        const betArea = document.getElementById('bj-multi-bet-area');
        const playArea = document.getElementById('bj-multi-play-area');
        
        if (controls && betArea && playArea && myData) {
            controls.classList.add('hidden'); betArea.classList.add('hidden'); playArea.classList.add('hidden');
            if (data.status === 'betting' && myData.status === 'waiting') {
                controls.classList.remove('hidden'); betArea.classList.remove('hidden');
            } else if (data.status === 'playing' && myData.status === 'playing') {
                controls.classList.remove('hidden'); playArea.classList.remove('hidden');
            }
        }
    });
}

// 6. PRZEŁĄCZANIE WIDOKÓW DOM (Kuloodporne)
function enterRoomUI() {
    document.getElementById('bj-multi-lobby')?.classList.add('hidden');
    document.getElementById('bj-multi-room')?.classList.remove('hidden');
    document.getElementById('bj-multi-controls')?.classList.add('hidden');
}

function exitRoomUI() {
    document.getElementById('bj-multi-room')?.classList.add('hidden');
    document.getElementById('bj-multi-controls')?.classList.add('hidden');
    document.getElementById('bj-multi-lobby')?.classList.remove('hidden');
}

// ============================================
// ROULETTE MULTIPLAYER (LIVE - Wspólny stół)
// ============================================

let currentRmId = null;
let unsubRmLobby = null;
let unsubRmRoom = null;
let isRmHost = false;
let rmClientInterval = null;
let rmHostLoop = null;

let myRmBets = []; 
let isRmBettingPhase = false;
let isRmSpinningAnim = false; // Blokada przed ponownym puszczaniem animacji

// --- GENEROWANIE PLANSZY I KOŁA DLA MULTIPLAYERA ---
function buildRmRoulette() {
    const container = document.getElementById('rm-num-buttons-container');
    const strip = document.getElementById('rm-roulette-strip');
    if (!container || !strip) return;

    // Przyciski liczb 0-36
    container.innerHTML = '';
    for (let i = 0; i <= 36; i++) {
        const btn = document.createElement('button');
        let colorClass = i === 0 ? 'num-green' : (RED_NUMBERS.includes(i) ? 'num-red' : 'num-black');
        btn.className = `num-btn ${colorClass}`;
        btn.textContent = i;
        btn.onclick = () => window.placeRmBet('number', i.toString());
        container.appendChild(btn);
    }

    // Pasek ruletki
    const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    let html = '';
    for (let rep = 0; rep < 5; rep++) {
        ORDER.forEach(n => {
            let bgClass = n === 0 ? 'green' : (RED_NUMBERS.includes(n) ? 'red' : 'black');
            html += `<div class="roulette-item ${bgClass}">${n}</div>`;
        });
    }
    strip.innerHTML = html;
}

// 1. DYNAMICZNE DODAWANIE ŻETONÓW
window.placeRmBet = async (type, value) => {
    if (!currentRmId) return showMessage('Nie jesteś przy stole!', 'error');
    if (!isRmBettingPhase) return showMessage('Zakłady są zamknięte!', 'error');
    
    const amount = parseInt(document.getElementById('rm-amount').value);
    if (!await deductBet(amount)) return; 
    
    myRmBets.push({ type, value, amount });
    
    await updateDoc(doc(db, 'stoliki_rm', currentRmId), {
        [`players.${currentUserId}`]: { 
            name: player.name, 
            bets: myRmBets, 
            status: 'ready' 
        }
    });
    
    playSound('kaching');
    let displayValue = type === 'number' ? `Liczbę ${value}` : value.toUpperCase();
    showMessage(`Postawiono ${formatujWalute(amount)} na: ${displayValue}`, 'info');
};

document.querySelector('.nav-btn[data-view="roulette_multi"]')?.addEventListener('click', () => {
    buildRmRoulette();
    listenToRmLobby();
});

// 2. TWORZENIE STOŁU
document.getElementById('btn-create-rm-table')?.addEventListener('click', async () => {
    if (!currentUserId) return showMessage('Zaloguj się!', 'error');
    try {
        const ref = await addDoc(collection(db, 'stoliki_rm'), {
            hostId: currentUserId, hostName: player.name, status: 'waiting',
            winnerNum: null, winnerColor: null, phaseEndTime: 0, 
            players: { [currentUserId]: { name: player.name, bets: [], status: 'waiting' } }, 
            timestamp: serverTimestamp()
        });
        isRmHost = true; currentRmId = ref.id;
        enterRmRoomUI(); listenToRmRoom(); startRmHostLoop();
    } catch(e) { showMessage(e.message, 'error'); }
});

// 3. WYJŚCIE ZE STOŁU
document.getElementById('btn-leave-rm-table')?.addEventListener('click', async () => {
    if (!currentRmId) return;
    try {
        const ref = doc(db, 'stoliki_rm', currentRmId);
        if (isRmHost) await updateDoc(ref, { status: 'closed' });
        else await updateDoc(ref, { [`players.${currentUserId}`]: deleteField() });
    } catch(e) {}
    
    currentRmId = null; isRmHost = false; myRmBets = [];
    if(unsubRmRoom) unsubRmRoom();
    if(rmClientInterval) clearInterval(rmClientInterval);
    if(rmHostLoop) clearInterval(rmHostLoop);
    
    exitRmRoomUI(); listenToRmLobby();
});

// 4. LOBBY
function listenToRmLobby() {
    const list = document.getElementById('rm-tables-list');
    if (!list) return;
    if (unsubRmLobby) unsubRmLobby();
    
    unsubRmLobby = onSnapshot(collection(db, 'stoliki_rm'), snap => {
        if (currentRmId) return; 
        list.innerHTML = ''; let count = 0;
        
        snap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.status === 'closed') return;
            count++;
            
            const row = document.createElement('div');
            row.className = 'history-row';
            let statusPl = (d.status === 'spinning' || d.status === 'resolving') ? '🔴 Kręcenie' : '🟢 Otwarte';
            row.innerHTML = `<span class="h-col h-user">Stół: ${d.hostName}</span> <span class="h-col">Graczy: ${Object.keys(d.players||{}).length}</span> <span class="h-col">${statusPl}</span>`;
            
            if (d.status === 'waiting' || d.status === 'betting') {
                const btn = document.createElement('button');
                btn.className = 'btn-accent'; btn.style.cssText = 'padding: 4px 10px; font-size: 0.8rem;';
                btn.textContent = 'DOŁĄCZ'; 
                btn.onclick = () => joinRmTable(docSnap.id);
                row.appendChild(btn);
            }
            list.appendChild(row);
        });
        if(count === 0) list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Brak otwartych stołów. Zostań Krupierem!</p>';
    });
}

async function joinRmTable(roomId) {
    if (!currentUserId) return showMessage('Zaloguj się!', 'error');
    const ref = doc(db, 'stoliki_rm', roomId);
    const data = (await getDoc(ref)).data();
    
    if(data.status !== 'betting' && data.status !== 'waiting') return showMessage('Zaczekaj na nową rundę!', 'error');
    
    await updateDoc(ref, {
        [`players.${currentUserId}`]: { name: player.name, bets: [], status: 'waiting' }
    });

    isRmHost = false; currentRmId = roomId; myRmBets = [];
    enterRmRoomUI(); listenToRmRoom();
}

// 5. SILNIK HOSTA (MÓZG GRY)
function startRmHostLoop() {
    if (rmHostLoop) clearInterval(rmHostLoop);
    
    rmHostLoop = setInterval(async () => {
        if (!isRmHost || !currentRmId) return clearInterval(rmHostLoop);
        
        try {
            const snap = await getDoc(doc(db, 'stoliki_rm', currentRmId));
            if (!snap.exists()) return clearInterval(rmHostLoop);
            const data = snap.data();
            const now = Date.now();

            if (data.status === 'waiting' && Object.keys(data.players||{}).length > 0) {
                await updateDoc(doc(db, 'stoliki_rm', currentRmId), { status: 'betting', phaseEndTime: now + 40000 });
            }
            
            if (data.status === 'betting' && now >= data.phaseEndTime) {
                const winningNum = Math.floor(Math.random() * 37);
                let winnerColor = winningNum === 0 ? 'green' : (RED_NUMBERS.includes(winningNum) ? 'red' : 'black');
                await updateDoc(doc(db, 'stoliki_rm', currentRmId), { status: 'spinning', winnerNum: winningNum, winnerColor: winnerColor, phaseEndTime: now + 6500 });
            }

            if (data.status === 'spinning' && now >= data.phaseEndTime) {
                await updateDoc(doc(db, 'stoliki_rm', currentRmId), { status: 'resolving', phaseEndTime: now + 6000 });
            }

            if (data.status === 'resolving' && now >= data.phaseEndTime) {
                let updates = { status: 'betting', phaseEndTime: now + 40000, winnerNum: null, winnerColor: null };
                for (const uid of Object.keys(data.players || {})) {
                    updates[`players.${uid}.status`] = 'waiting';
                    updates[`players.${uid}.bets`] = []; 
                }
                await updateDoc(doc(db, 'stoliki_rm', currentRmId), updates);
            }
        } catch(e) { console.error("Błąd Hosta:", e); }
    }, 1000);
}

// 6. SYNCHRONIZACJA WIDOKU GRACZA
function listenToRmRoom() {
    if (!currentRmId) return;
    if (unsubRmRoom) unsubRmRoom();
    
    if (rmClientInterval) clearInterval(rmClientInterval);
    rmClientInterval = setInterval(() => {
        const timerEl = document.getElementById('rm-timer');
        if (!timerEl) return;
        
        const phaseEndTime = timerEl.dataset.endTime;
        if (phaseEndTime && phaseEndTime > 0) {
            const left = Math.max(0, Math.ceil((phaseEndTime - Date.now())/1000));
            timerEl.textContent = left + 's';
            if (left <= 5) timerEl.style.color = 'var(--red)';
            else timerEl.style.color = 'var(--text)';
        }
    }, 100);

    unsubRmRoom = onSnapshot(doc(db, 'stoliki_rm', currentRmId), snap => {
        if (!snap.exists()) return exitRmRoomUI();
        const data = snap.data();
        
        if (data.status === 'closed') { 
            showMessage('Krupier zamknął stół.', 'info'); 
            document.getElementById('btn-leave-rm-table').click(); 
            return; 
        }

        document.getElementById('rm-room-name').textContent = `Stół Krupiera: ${data.hostName}`;
        document.getElementById('rm-timer').dataset.endTime = data.phaseEndTime || 0;

        // Renderowanie zakładów Z PODZIAŁEM NA KAŻDY ŻETON
        const pCont = document.getElementById('rm-players');
        pCont.innerHTML = '';
        for (const [uid, pData] of Object.entries(data.players || {})) {
            if (pData.bets && pData.bets.length > 0) {
                pData.bets.forEach(b => {
                    let betLabel = b.type === 'number' ? `Liczba ${b.value}` : b.value.toUpperCase();
                    
                    // Dobieranie kolorów ramki żetonu
                    let colorStyle = '';
                    if (b.value === 'red' || (b.type === 'number' && RED_NUMBERS.includes(parseInt(b.value)))) colorStyle = 'border-left: 4px solid var(--red); color: #EF9A9A;';
                    else if (b.value === 'black' || (b.type === 'number' && !RED_NUMBERS.includes(parseInt(b.value)) && parseInt(b.value) !== 0)) colorStyle = 'border-left: 4px solid #888; color: #ccc;';
                    else if (b.value === 'green' || b.value === '0') colorStyle = 'border-left: 4px solid var(--green); color: var(--green-bright);';
                    else colorStyle = 'border-left: 4px solid var(--gold); color: var(--gold);';

                    pCont.innerHTML += `<div class="history-chip" style="background: rgba(255,255,255,0.04); ${colorStyle} font-size:0.8rem; padding: 6px 12px; margin-bottom: 4px; flex-grow: 1; text-align: left;">
                        <strong style="color:var(--text);">${pData.name}</strong> • ${formatujWalute(b.amount)} ➔ <span style="font-weight:900;">${betLabel}</span>
                    </div>`;
                });
            }
        }

        const statusEl = document.getElementById('rm-status');
        const controlsEl = document.getElementById('rm-controls');
        
        // Elementy koła fortuny
        const inner = document.getElementById('rm-roulette-inner');
        const overlay = document.getElementById('rm-data-overlay');
        const resNum = document.getElementById('rm-result-number');
        const resBg = document.getElementById('rm-result-bg');

        // MASZYNA STANÓW UI I ROZLICZANIE TABLICY ZAKŁADÓW
        if (data.status === 'waiting') {
            isRmBettingPhase = false;
            isRmSpinningAnim = false;
            statusEl.textContent = 'Oczekiwanie na graczy...';
            statusEl.style.color = 'var(--text-muted)';
            document.getElementById('rm-timer').textContent = '--';
            controlsEl.classList.add('hidden');
            
            // Reset wizualny
            inner.classList.remove('rest');
            inner.style.transform = `translateX(0px)`;
            overlay.classList.remove('reveal');
        } 
        else if (data.status === 'betting') {
            if (!isRmBettingPhase) {
                isRmBettingPhase = true;
                myRmBets = []; 
                isRmSpinningAnim = false;
            }
            statusEl.textContent = 'Rzucajcie żetony! Czas ucieka!';
            statusEl.style.color = 'var(--green-bright)';
            controlsEl.classList.remove('hidden');
            
            // Reset wizualny
            inner.classList.remove('rest');
            overlay.classList.remove('reveal');
        } 
        else if (data.status === 'spinning') {
            isRmBettingPhase = false;
            statusEl.textContent = 'Rien ne va plus! (Koło w ruchu)';
            statusEl.style.color = 'var(--gold)';
            controlsEl.classList.add('hidden');
            document.getElementById('rm-timer').textContent = 'STOP';
            
            // ODPALENIE PRAWDZIWEJ ANIMACJI TYLKO RAZ
            if (!isRmSpinningAnim) {
                isRmSpinningAnim = true;
                const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
                const itemW = 60; 
                const windowW = document.getElementById('rm-roulette-window').clientWidth;
                const centerOffset = Math.floor(windowW / 2) - (itemW / 2);
                
                inner.classList.remove('rest');
                overlay.classList.remove('reveal');
                
                // Cofa pasek na start (bez animacji)
                inner.style.transform = `translateX(${-ORDER.length * itemW + centerOffset}px)`;
                void inner.offsetWidth; // Wymusza przerysowanie DOM (żeby animacja zadziałała od tego momentu)
                
                // Uruchamia animację do docelowej wylosowanej liczby
                setTimeout(() => {
                    inner.classList.add('rest');
                    inner.style.transform = `translateX(${-(ORDER.indexOf(data.winnerNum) + ORDER.length * 4) * itemW + centerOffset}px)`;
                }, 50);
            }
        } 
        else if (data.status === 'resolving') {
            isRmBettingPhase = false;
            statusEl.textContent = 'WYNIK LOSOWANIA';
            statusEl.style.color = 'var(--text)';
            document.getElementById('rm-timer').textContent = '';
            
            // Pokazuje nakładkę ze zwycięską liczbą
            resNum.textContent = data.winnerNum;
            let finalColor = data.winnerColor === 'red' ? 'var(--red)' : (data.winnerColor === 'green' ? 'var(--green)' : '#111');
            resBg.style.backgroundColor = finalColor;
            overlay.classList.add('reveal');

            // --- INTELIGENTNE ROZLICZANIE ---
            const myData = data.players?.[currentUserId];
            if (myData && myData.status === 'ready' && myData.bets && myData.bets.length > 0) {
                
                let totalWin = 0;
                let totalBetAmount = 0;
                
                const wNum = data.winnerNum;
                const wColor = data.winnerColor;
                const wParity = wNum === 0 ? 'none' : (wNum % 2 === 0 ? 'even' : 'odd');
                const wHalf = wNum === 0 ? 'none' : (wNum <= 18 ? 'low' : 'high');
                const wDozen = wNum === 0 ? 'none' : (wNum <= 12 ? '1' : (wNum <= 24 ? '2' : '3'));

                myData.bets.forEach(b => {
                    totalBetAmount += b.amount;
                    let won = false;
                    let multiplier = 0;
                    
                    if (b.type === 'color' && b.value === wColor) { won = true; multiplier = (wColor === 'green') ? 36 : 2; }
                    if (b.type === 'parity' && b.value === wParity) { won = true; multiplier = 2; }
                    if (b.type === 'half' && b.value === wHalf) { won = true; multiplier = 2; }
                    if (b.type === 'dozen' && b.value === wDozen) { won = true; multiplier = 3; }
                    if (b.type === 'number' && parseInt(b.value) === wNum) { won = true; multiplier = 36; }
                    
                    if (won) totalWin += b.amount * multiplier;
                });
                
                let msg = totalWin > 0 ? `Trafiono i wygrano ${formatujWalute(totalWin)}!` : 'Wszystkie żetony przegrały.';
                
                addWin(totalWin, totalBetAmount, 'Ruletka Live', `Wypadło: ${wNum}. ${msg}`).then(() => {
                    updateDoc(doc(db, 'stoliki_rm', currentRmId), { [`players.${currentUserId}.status`]: 'rewarded' });
                });
            }
        }
    });
}

function enterRmRoomUI() {
    document.getElementById('rm-lobby').classList.add('hidden');
    document.getElementById('rm-room').classList.remove('hidden');
}

function exitRmRoomUI() {
    document.getElementById('rm-room').classList.add('hidden');
    document.getElementById('rm-lobby').classList.remove('hidden');
}
