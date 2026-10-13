// Plik: ticker_script/index.js 
// WERSJA FINALNA: Giełda + Krypto + Zakłady (Lista z Auto-Zamykaniem)

const admin = require('firebase-admin');

// --- POBIERANIE KLUCZA Z ZMIENNYCH ŚRODOWISKOWYCH ---
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// --- BAZA NEWSÓW ---
const positiveNews = [
    "NEWS: {COMPANY} ogłasza rekordowe zyski kwartalne! Analitycy w szoku!",
    "NEWS: Zysk netto {COMPANY} wzrósł o 300% rok do roku.",
    "NEWS: Fundusz hedgingowy zainwestował w {COMPANY}.",
    "NEWS: {COMPANY} wprowadza rewolucyjny produkt na rynek.",
    "NEWS: Agencja ratingowa podnosi ocenę {COMPANY} do 'AAA'.",
    "NEWS: {COMPANY} podpisuje strategiczny kontrakt rządowy.",
    "NEWS: Nowy CEO {COMPANY} zapowiada agresywną ekspansję.",
    "NEWS: {COMPANY} przejmuje mniejszego konkurenta.",
    "NEWS: Przełom technologiczny w laboratoriach {COMPANY}.",
    "NEWS: {COMPANY} ogłasza skup akcji własnych (buyback).",
    "NEWS: {COMPANY} wchodzi na rynek azjatycki z sukcesem.",
    "NEWS: Rządowe dotacje dla {COMPANY} zatwierdzone."
];

const negativeNews = [
    "NEWS: SKANDAL w {COMPANY}! Prezes oskarżony o malwersacje.",
    "NEWS: {COMPANY} ogłasza straty znacznie większe od prognoz.",
    "NEWS: Awaria głównej linii produkcyjnej {COMPANY}.",
    "NEWS: {COMPANY} traci kluczowego klienta na rzecz konkurencji.",
    "NEWS: Pozew zbiorowy przeciwko {COMPANY} w sprawie wadliwego produktu.",
    "NEWS: Agencja ratingowa obniża rating {COMPANY} do poziomu śmieciowego.",
    "NEWS: Wyciek danych klientów z serwerów {COMPANY}.",
    "NEWS: {COMPANY} zwalnia 20% załogi w ramach cięcia kosztów.",
    "NEWS: Nowe regulacje prawne uderzają w model biznesowy {COMPANY}.",
    "NEWS: Analitycy wydają rekomendację 'SPRZEDAJ' dla {COMPANY}.",
    "NEWS: {COMPANY} wstrzymuje wypłatę dywidendy.",
    "NEWS: Protesty pracowników {COMPANY} paraliżują działanie firmy."
];

try {
  // --- INICJALIZACJA FIREBASE ---
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https.symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  
  // --- REFERENCJE ---
  const cenyDocRef = db.doc("global/ceny_akcji");
  const newsCollectionRef = db.collection("gielda_news");
  const rumorsRef = db.collection("plotki");
  const limitOrdersRef = db.collection("limit_orders");
  const usersRef = db.collection("uzytkownicy");
  const historyRef = db.collection("historia_transakcji");
  const pendingTipsRef = db.collection("pending_tips");
  const activeBondsRef = db.collection("active_bonds");
  const marketEventRef = cenyDocRef;

  function getMissionPeriods(date = new Date()) {
      const day = date.toISOString().slice(0, 10);
      const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const weekday = thursday.getUTCDay() || 7;
      thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
      const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
      return { day, week: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}` };
  }

  function advanceMissionProgress(progress) {
      const periods = getMissionPeriods();
      const daily = progress?.daily?.period === periods.day
          ? progress.daily
          : { period: periods.day, trades: 0, claimed: false };
      const weekly = progress?.weekly?.period === periods.week
          ? progress.weekly
          : { period: periods.week, trades: 0, claimed: false };
      return {
          daily: { ...daily, trades: daily.trades + 1 },
          weekly: { ...weekly, trades: weekly.trades + 1 }
      };
  }
  
  // --- HELPERY ---
  function calculateTotalValue(cash, shares, currentPrices) {
    let sharesValue = 0;
    for (const companyId in shares) {
        const price = currentPrices[companyId] || (companyId === "nicorp" ? currentPrices.bartcoin : 0);
        sharesValue += (shares[companyId] || 0) * (price || 0);
    }
    return cash + sharesValue;
  }
  
  // ==========================================================
  // === 1. OBSŁUGA ZLECEŃ LIMIT (LIMIT ORDERS) ===
  // ==========================================================
  async function executeLimitOrder(transaction, orderDoc, executedPrice, currentPrices) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;
      
      const { userId, companyId, amount, limitPrice, type, companyName } = order;
      const isCrypto = type.includes("Krypto");
      
      const userRef = usersRef.doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
          transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "User not found" });
          return;
      }

      const userData = userDoc.data();
      
      if (isCrypto && (userData.prestigeLevel || 0) < 3) {
          transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient prestige" });
          return;
      }
      
      const newShares = { ...userData.shares };
      let newCash = userData.cash;
      const costOrRevenue = amount * executedPrice; 

      if (type.startsWith('KUPNO')) {
          if (newCash < costOrRevenue) {
              transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient funds" });
              return;
          }
          newCash -= costOrRevenue;
          newShares[companyId] = (newShares[companyId] || 0) + amount;
          
      } else if (type.startsWith('SPRZEDAŻ')) {
          if (!newShares[companyId] || newShares[companyId] < amount) {
              transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient shares" });
              return;
          }
          newCash += costOrRevenue;
          newShares[companyId] -= amount;
      }
      
      const newTotalValue = calculateTotalValue(newCash, newShares, currentPrices);
      const newZysk = newTotalValue - userData.startValue;

      transaction.update(userRef, { 
          cash: newCash, 
          shares: newShares, 
          totalValue: newTotalValue, 
          zysk: newZysk,
          missionProgress: advanceMissionProgress(userData.missionProgress),
          'stats.totalTrades': admin.firestore.FieldValue.increment(1)
      });

      transaction.update(orderDoc.ref, { 
          status: "executed", 
          executedPrice: executedPrice 
      });

      const historyDocRef = historyRef.doc(); 
      transaction.set(historyDocRef, {
          userId: userId,
          userName: userData.name, 
          prestigeLevel: userData.prestigeLevel || 0, 
          type: type,
          companyId: companyId,
          companyName: companyName,
          amount: amount,
          pricePerShare: executedPrice, 
          totalValue: costOrRevenue, 
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "executed"
      });
      
      console.log(`Zrealizowano zlecenie ${orderId} dla ${userData.name}`);
  }
  
  // ==========================================================
  // === 2. OBSŁUGA OBLIGACJI (BONDS) ===
  // ==========================================================
  async function processBonds(currentPrices) {
      const now = admin.firestore.Timestamp.now();
      const bondsQuery = activeBondsRef.where("status", "==", "pending").where("redeemAt", "<=", now);
      const bondsSnapshot = await bondsQuery.get();
      
      if (bondsSnapshot.empty) return;
      
      for (const bondDoc of bondsSnapshot.docs) {
          const bond = bondDoc.data();
          try {
              await db.runTransaction(async (transaction) => {
                  const userRef = usersRef.doc(bond.userId);
                  const userDoc = await transaction.get(userRef);
                  if (!userDoc.exists) return;
                  
                  const userData = userDoc.data();
                  const payout = bond.investment + bond.profit;
                  const newCash = userData.cash + payout;
                  const newTotalValue = calculateTotalValue(newCash, userData.shares, currentPrices);
                  const newZysk = newTotalValue - userData.startValue;

                  transaction.update(userRef, { cash: newCash, totalValue: newTotalValue, zysk: newZysk });
                  transaction.update(bondDoc.ref, { status: "executed" });
                  
                  const historyDocRef = historyRef.doc();
                  transaction.set(historyDocRef, {
                      userId: bond.userId,
                      userName: userData.name, 
                      prestigeLevel: userData.prestigeLevel || 0, 
                      type: "OBLIGACJA (WYKUP)", 
                      companyId: "system",
                      companyName: bond.name,
                      amount: 1,
                      pricePerShare: 0,
                      executedPrice: payout, 
                      totalValue: bond.profit,
                      timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      status: "executed"
                  });
              });
          } catch (e) { console.error("Błąd obligacji:", e); }
      }
  }

  async function processDividends(currentPrices, now) {
      const stateRef = db.doc("global/dividend_processing");
      const stateDoc = await stateRef.get();
      if (!stateDoc.exists || stateDoc.data().initialized !== true) {
          const usersSnapshot = await usersRef.get();
          const firstDividendDueAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
          let batch = db.batch();
          let batchSize = 0;

          for (const userDoc of usersSnapshot.docs) {
              if (userDoc.data().dividendDueAt) continue;
              batch.update(userDoc.ref, { dividendDueAt: firstDividendDueAt });
              batchSize++;
              if (batchSize === 450) {
                  await batch.commit();
                  batch = db.batch();
                  batchSize = 0;
              }
          }

          batch.set(stateRef, { initialized: true, initializedAt: now }, { merge: true });
          await batch.commit();
      }

      const dueUsers = await usersRef
          .where("dividendDueAt", "<=", now)
          .limit(100)
          .get();

      for (const dueUser of dueUsers.docs) {
          await db.runTransaction(async transaction => {
              const userSnapshot = await transaction.get(dueUser.ref);
              if (!userSnapshot.exists) return;

              const user = userSnapshot.data();
              const dueAt = user.dividendDueAt;
              if (!dueAt || dueAt.toMillis() > now.toMillis()) return;

              const shares = user.shares || {};
              const stockIds = ["ulanska", "rychbud", "brzozair", "cosmosanit"];
              const stockValue = stockIds.reduce((total, companyId) =>
                  total + (shares[companyId] || 0) * (currentPrices[companyId] || 0), 0);
              const payout = Math.floor(stockValue * 0.0005 * 100) / 100;
              const nextDueAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

              if (payout <= 0) {
                  transaction.update(dueUser.ref, { dividendDueAt: nextDueAt });
                  return;
              }

              const newCash = (user.cash || 0) + payout;
              const totalValue = calculateTotalValue(newCash, shares, currentPrices);
              transaction.update(dueUser.ref, {
                  cash: newCash,
                  totalValue,
                  zysk: totalValue - (user.startValue || 0),
                  lastDividendAt: now,
                  dividendDueAt: nextDueAt,
                  dividendCount: admin.firestore.FieldValue.increment(1)
              });
              transaction.set(historyRef.doc(), {
                  userId: dueUser.id,
                  userName: user.name || "Inwestor",
                  prestigeLevel: user.prestigeLevel || 0,
                  type: "DYWIDENDA",
                  companyId: "market",
                  companyName: "Dywidenda dzienna",
                  amount: 1,
                  pricePerShare: 0,
                  totalValue: payout,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  status: "executed"
              });
          });
      }
  }

  async function getActiveMarketEvent(now, storedEvent) {
      const event = storedEvent || null;
      if (event?.endAt && event.endAt.toMillis() > now.toMillis()) {
          return { event, needsImpact: event.applied !== true };
      }

      const companies = [
          { id: "ulanska", name: "Ułańska Dev" },
          { id: "rychbud", name: "RychBud" },
          { id: "brzozair", name: "BrzozAir" },
          { id: "cosmosanit", name: "Cosmosanit" }
      ];
      const company = companies[Math.floor(Math.random() * companies.length)];
      const positive = Math.random() >= 0.5;
      const impactPercent = (0.025 + Math.random() * 0.035) * (positive ? 1 : -1);
      const nextEvent = {
          title: positive ? "Nowy kontrakt napędza wzrost" : "Zakłócenia w łańcuchu dostaw",
          description: positive
              ? `Rynek pozytywnie reaguje na doniesienia z firmy ${company.name}.`
              : `Analitycy ostrzegają przed krótkoterminowymi problemami w firmie ${company.name}.`,
          companyId: company.id,
          impactPercent,
          startAt: now,
          endAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 3 * 60 * 60 * 1000),
          applied: false
      };
      await marketEventRef.update({ marketEvent: nextEvent });
      return { event: nextEvent, needsImpact: true };
  }

  async function publishDailyCompanyReports(currentPrices, newPrices, now, assetIds) {
      const dayKey = now.toDate().toISOString().slice(0, 10);
      const globalData = currentPrices;
      const state = globalData.companyReportState || {};
      if (state.reportDay === dayKey) return;

      const companyNames = {
          ulanska: "Ułańska Dev",
          rychbud: "RychBud",
          brzozair: "BrzozAir",
          cosmosanit: "Cosmosanit",
          bartcoin: "Nicorp",
          igirium: "Igirium"
      };
      const reports = Array.isArray(globalData.companyReports) ? globalData.companyReports : [];
      const dailyReports = [];
      for (const companyId of assetIds) {
          const referencePrice = state.prices?.[companyId] || currentPrices[companyId] || 0;
          const latestPrice = newPrices[companyId] || currentPrices[companyId] || 0;
          const changePercent = referencePrice > 0 ? ((latestPrice - referencePrice) / referencePrice) * 100 : 0;
          const direction = changePercent > 0 ? "wzrost" : changePercent < 0 ? "spadek" : "stabilizację";
          const summary = state.reportDay
              ? `Raport dzienny: kurs od poprzedniego raportu zanotował ${direction} o ${Math.abs(changePercent).toFixed(2)}%.`
              : `Raport otwarcia: kurs wynosi ${latestPrice.toFixed(2)} zł.`;
          dailyReports.push({
              id: `${dayKey}_${companyId}`,
              companyId,
              companyName: companyNames[companyId] || companyId,
              summary,
              changePercent: Number(changePercent.toFixed(2)),
              generatedAt: now
          });
      }
      await cenyDocRef.update({
          companyReports: [...reports, ...dailyReports].slice(-36),
          companyReportState: { reportDay: dayKey, prices: newPrices, updatedAt: now }
      });
  }

  // ==========================================================
  // === 3. NOWA FUNKCJA: ZARZĄDZANIE ZAKŁADAMI (MATCHES) ===
  // ==========================================================
  async function manageMatches(db) {
    const zakladyRef = db.doc("global/zaklady");
    const docSnap = await zakladyRef.get();
    
    if (!docSnap.exists) return;

    let matches = docSnap.data().mecze || [];
    const now = admin.firestore.Timestamp.now();
    let infoChanged = false;

    for (let match of matches) {
        // 1. AUTOMATYCZNE ZAMYKANIE (Time limit)
        // Jeśli status jest 'open', a minął czas zamknięcia -> zamknij
        if (match.status === "open" && now >= match.closeTime) {
            match.status = "closed";
            console.log(`🔒 ZAMYKAM ZAKŁADY: ${match.teamA} vs ${match.teamB}`);
            infoChanged = true;
        }

        // 2. AUTOMATYCZNE WYPŁACANIE (Gdy Admin ustawi status 'resolved')
        // Sprawdzamy flagę 'processed', żeby nie wypłacić dwa razy
        if (match.status === "resolved" && match.processed !== true) {
            console.log(`💰 ROZLICZAM MECZ: ${match.teamA} vs ${match.teamB} (Wygrał: ${match.winner})`);
            await processBetsForMatch(db, match);
            match.processed = true; 
            infoChanged = true;
        }
    }

    if (infoChanged) {
        await zakladyRef.update({ mecze: matches });
        console.log("✅ Zaktualizowano statusy meczów w bazie.");
    }
  }

  async function processBetsForMatch(db, matchData) {
    const activeBetsRef = db.collection("active_bets");
    // Szukamy zakładów tylko na ten konkretny mecz
    const betsQuery = activeBetsRef
        .where("matchId", "==", matchData.id)
        .where("status", "==", "pending");

    const betsSnapshot = await betsQuery.get();
    if (betsSnapshot.empty) return;

    const batch = db.batch();
    let count = 0;

    betsSnapshot.forEach(betDoc => {
        const bet = betDoc.data();
        
        if (bet.betOn === matchData.winner) {
            // WYGRANA
            const payout = bet.betAmount * bet.odds;
            const profit = payout - bet.betAmount;
            const userRef = db.collection("uzytkownicy").doc(bet.userId);
            
            // Bezpieczna aktualizacja salda (increment)
            batch.update(userRef, {
                cash: admin.firestore.FieldValue.increment(payout),
                totalValue: admin.firestore.FieldValue.increment(payout),
                zysk: admin.firestore.FieldValue.increment(profit)
            });
            batch.update(betDoc.ref, { status: "won" });
        } else {
            // PRZEGRANA
            batch.update(betDoc.ref, { status: "lost" });
        }
        count++;
    });

    await batch.commit();
    console.log(`✅ Rozliczono ${count} zakładów.`);
  }
  
  // ==========================================================
  // === 4. GŁÓWNA PĘTLA TICKERA (RUN TICKER) ===
  // ==========================================================
  const runTicker = async () => {
    const docSnap = await cenyDocRef.get();
    if (!docSnap.exists) {
        console.error("Brak dokumentu cen!");
        return;
    }

    const currentPrices = docSnap.data();
    const newPrices = {};
    const now = admin.firestore.Timestamp.now();
    
    const stocks = ["ulanska", "brzozair", "rychbud", "cosmosanit"];
    const cryptos = ["bartcoin", "igirium"];
    const allAssets = [...stocks, ...cryptos];

    const companyReferencePrices = {
        ulanska: 1860.00, brzozair: 2350.00, rychbud: 870.00, cosmosanit: 2000.00,
        bartcoin: 4000.00, igirium: 2000.00
    };
    const { event: marketEvent, needsImpact: applyMarketEvent } = await getActiveMarketEvent(now, currentPrices.marketEvent);
    
    // Wpływ plotek
    const thirtySecondsAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 1000);
    const rumorsSnapshot = await rumorsRef.where("timestamp", ">=", thirtySecondsAgo).get();
    const rumorImpacts = {};
    rumorsSnapshot.forEach(doc => {
        const rumor = doc.data();
        rumorImpacts[rumor.companyId] = (rumorImpacts[rumor.companyId] || 0) + rumor.impact;
    });

    // Wymuszone wskazówki (Tips)
    const forcedNews = {}; 
    const tipsSnapshot = await pendingTipsRef.where("executeAt", "<=", now).get();
    const deleteBatch = db.batch(); 
    tipsSnapshot.forEach(doc => {
        const tip = doc.data();
        forcedNews[tip.companyId] = { impactType: tip.impactType };
        deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    // --- OBLICZANIE NOWYCH CEN ---
    for (const companyId of allAssets) {
      let price = currentPrices[companyId] || companyReferencePrices[companyId] || 50.00;
      
      // Większa zmienność dla krypto
      let volatility = cryptos.includes(companyId) ? 0.20 * price : 0.04 * price;
      let change = (Math.random() - 0.5) * 2 * volatility; 
      
      // Dodaj wpływ plotek
      if (rumorImpacts[companyId]) change += price * rumorImpacts[companyId];

      if (applyMarketEvent && marketEvent.companyId === companyId) {
          change += price * marketEvent.impactPercent;
      }

      // Obsługa Newsów (Losowe lub Wymuszone)
      const forcedEvent = forcedNews[companyId];
      if (forcedEvent) {
          const isPositive = forcedEvent.impactType === 'positive';
          const impactPercent = (Math.random() * 0.20) + 0.05;
          change += (isPositive ? impactPercent : -impactPercent) * price;
          
          const newsList = isPositive ? positiveNews : negativeNews;
          const text = newsList[Math.floor(Math.random() * newsList.length)].replace("{COMPANY}", companyId.toUpperCase());
          await newsCollectionRef.add({ text, companyId, impactType: forcedEvent.impactType, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      } else if (Math.random() < 0.07) { // 7% szans na losowy news
           const isPositive = Math.random() > 0.5;
           const impactPercent = (Math.random() * 0.20) + 0.05;
           change += (isPositive ? impactPercent : -impactPercent) * price;
           
           const newsList = isPositive ? positiveNews : negativeNews;
           const text = newsList[Math.floor(Math.random() * newsList.length)].replace("{COMPANY}", companyId.toUpperCase());
           await newsCollectionRef.add({ text, companyId, impactType: isPositive ? 'positive' : 'negative', timestamp: admin.firestore.FieldValue.serverTimestamp() });
      }

      let newPrice = price + change;

      // Odbicie od dna (Różne poziomy dla krypto i akcji)
      const refPrice = companyReferencePrices[companyId] || 50;
      const supportLevel = cryptos.includes(companyId) ? refPrice * 0.10 : refPrice * 0.40;
      const recoveryChance = cryptos.includes(companyId) ? 0.40 : 0.60;
      
      if (newPrice < supportLevel && newPrice > 1.00 && Math.random() < recoveryChance) {
          newPrice += newPrice * (cryptos.includes(companyId) ? 0.25 : 0.20);
      }
      
      newPrices[companyId] = parseFloat(Math.max(1.00, newPrice).toFixed(2));
    }

    // Zapis cen
    await cenyDocRef.set(newPrices, { merge: true });
    if (applyMarketEvent) {
        await marketEventRef.update({
            marketEvent: { ...marketEvent, applied: true, appliedAt: now }
        });
    }
    await publishDailyCompanyReports(currentPrices, newPrices, now, allAssets);

    // --- WYWOŁANIE FUNKCJI ZAKŁADÓW ---
    await manageMatches(db);
    await checkF1WeeklyRewards(db); // <--- DODAJ TO

    // --- WYWOŁANIE FUNKCJI OBLIGACJI ---
    await processBonds(newPrices);
    await processDividends(newPrices, now);
    await manageCrossyLobbies(db); // <--- DODAJ TO TUTAJ
    
    // --- REALIZACJA ZLECEŃ LIMIT ---
    for (const companyId of allAssets) {
        const finalPrice = newPrices[companyId];
        if (!finalPrice) continue;
        
        // Kupno Limit
        const buySnapshot = await limitOrdersRef
            .where("companyId", "==", companyId)
            .where("status", "==", "pending")
            .where("type", "in", ["KUPNO (Limit)", "KUPNO (Limit, Krypto)"])
            .where("limitPrice", ">=", finalPrice)
            .get();
        for (const doc of buySnapshot.docs) await db.runTransaction(t => executeLimitOrder(t, doc, finalPrice, newPrices));
        
        // Sprzedaż Limit
        const sellSnapshot = await limitOrdersRef
            .where("companyId", "==", companyId)
            .where("status", "==", "pending")
            .where("type", "in", ["SPRZEDAŻ (Limit)", "SPRZEDAŻ (Limit, Krypto)"])
            .where("limitPrice", "<=", finalPrice)
            .get();
        for (const doc of sellSnapshot.docs) await db.runTransaction(t => executeLimitOrder(t, doc, finalPrice, newPrices));
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Pętla 3-godzinna (dla GitHub Actions)
  const mainLoop = async () => {
    const updatesPerRun = 180;      
    const intervalSeconds = 60;     
    console.log(`Start pętli: ${updatesPerRun} cykli co ${intervalSeconds}s.`);
    for (let i = 1; i <= updatesPerRun; i++) {
      try { await runTicker(); } catch (e) { console.error("Błąd runTicker:", e); }
      if (i < updatesPerRun) await sleep(intervalSeconds * 1000);
    }
  };
  
  // --- F1 WEEKLY PAYOUT LOGIC ---
async function checkF1WeeklyRewards(db) {
    const stateRef = db.doc("global/f1_state");
    const stateDoc = await stateRef.get();
    
    const now = admin.firestore.Timestamp.now();
    let nextReset;

    // Inicjalizacja, jeśli brak dokumentu
    if (!stateDoc.exists) {
        // Ustaw następny reset na najbliższą niedzielę 23:59
        const d = new Date();
        d.setDate(d.getDate() + (7 - d.getDay())); // Niedziela
        d.setHours(23, 59, 0, 0);
        nextReset = admin.firestore.Timestamp.fromDate(d);
        await stateRef.set({ nextReset: nextReset });
        return;
    } else {
        nextReset = stateDoc.data().nextReset;
    }

    // Sprawdź czy czas resetu minął
    if (now > nextReset) {
        console.log("🏁 F1: Czas na rozdanie nagród tygodniowych!");
        
        // 1. Pobierz TOP 3
        const scoresRef = db.collection("f1_scores");
        const snapshot = await scoresRef.orderBy("time", "asc").limit(3).get();
        
        if (!snapshot.empty) {
            const batch = db.batch();
            const prizes = [100000, 50000, 25000]; // Nagrody
            let rank = 0;

            snapshot.forEach(docSnap => {
                if (rank < 3) {
                    const data = docSnap.data();
                    const prize = prizes[rank];
                    const userRef = db.collection("uzytkownicy").doc(data.userId);

                    // Wypłata
                    batch.update(userRef, {
                        cash: admin.firestore.FieldValue.increment(prize),
                        totalValue: admin.firestore.FieldValue.increment(prize),
                        zysk: admin.firestore.FieldValue.increment(prize)
                    });
                    
                    console.log(`🏎️ F1 Nagroda: ${data.name} wygrywa ${prize} zł`);
                }
                rank++;
            });
            
            // 2. Wyczyść tabelę wyników (aby zacząć nowy tydzień)
            // Uwaga: Delete kolekcji w Firestore wymaga usuwania dokument po dokumencie
            const allScores = await scoresRef.get();
            allScores.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 3. Ustaw nowy czas resetu (kolejna niedziela)
            const d = new Date();
            d.setDate(d.getDate() + 7); 
            d.setHours(23, 59, 0, 0);
            const newReset = admin.firestore.Timestamp.fromDate(d);
            
            batch.update(stateRef, { nextReset: newReset });

            await batch.commit();
            console.log("✅ F1: Nagrody rozdane, ranking zresetowany.");
        } else {
            // Brak graczy, tylko przesuń datę
            const d = new Date();
            d.setDate(d.getDate() + 7);
            await stateRef.update({ nextReset: admin.firestore.Timestamp.fromDate(d) });
        }
    }
}

	// --- ZARZĄDZANIE GRAMI CROSSY ROAD (WIG ROAD) ---
async function manageCrossyLobbies(db) {
    const lobbiesRef = db.collection("crossy_lobbies");
    const playingSnapshot = await lobbiesRef.where("status", "==", "playing").get();
    
    if (playingSnapshot.empty) return;

    const batch = db.batch();
    let updates = 0;

    for (const docSnap of playingSnapshot.docs) {
        const lobby = docSnap.data();
        const players = lobby.players || [];
        
        // Sprawdź czy wszyscy są 'dead'
        const allDead = players.every(p => p.dead === true);
        
        // Opcjonalnie: Timeout (np. gra trwa dłużej niż 5 minut - force end)
        const now = admin.firestore.Timestamp.now();
        // (można dodać createdAt do logiki timeoutu)

        if (allDead && players.length > 0) {
            console.log(`🏁 Crossy Lobby ${docSnap.id} zakończone. Rozliczam...`);
            
            // Znajdź zwycięzcę
            // Sortuj malejąco po wyniku
            const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
            const winner = sortedPlayers[0]; // Najlepszy
            const totalPot = lobby.entryFee * players.length;

            console.log(`🏆 Wygrał: ${winner.name} (Wynik: ${winner.score}), Pula: ${totalPot}`);

            // Wypłata dla zwycięzcy
            const winnerRef = db.collection("uzytkownicy").doc(winner.id);
            const profit = totalPot - lobby.entryFee;
            
            batch.update(winnerRef, {
                cash: admin.firestore.FieldValue.increment(totalPot),
                totalValue: admin.firestore.FieldValue.increment(totalPot),
                zysk: admin.firestore.FieldValue.increment(profit)
            });

            // Oznaczamy lobby jako finished
            batch.update(docSnap.ref, { status: "finished", winnerId: winner.id });
            updates++;
        }
    }

    if (updates > 0) {
        await batch.commit();
        console.log(`✅ Rozliczono ${updates} gier Crossy.`);
    }
}

  mainLoop();

} catch (e) {
  console.error("Init Error:", e);
  process.exit(1); 
}
