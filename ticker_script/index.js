// Plik: ticker_script/index.js (NOWA WERSJA 2.0)

const admin = require('firebase-admin');

const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

const positiveNews = [
    "NEWS: {COMPANY} ogłasza rekordowe zyski kwartalne! Analitycy w szoku!",
    "NEWS: Rząd ogłasza strategiczny, wielomiliardowy kontrakt dla {COMPANY}.",
    "NEWS: Przełom technologiczny w {COMPANY}! Ich nowa technologia zmienia zasady gry.",
    "NEWS: {COMPANY} wchodzi na rynek azjatycki. Ogromny potencjał wzrostu.",
    "NEWS: Słynny inwestor ogłasza, że wykupił duży pakiet akcji {COMPANY}."
];

const negativeNews = [
    "NEWS: SKANDAL w {COMPANY}! Prezes aresztowany pod zarzutem defraudacji.",
    "NEWS: Krytyczna awaria systemów {COMPANY}. Straty liczone w milionach.",
    "NEWS: Ostra kontrola państwowa wchodzi do {COMPANY}. Inwestorzy panikują.",
    "NEWS: {COMPANY} przegrywa kluczowy proces sądowy. Grozi im gigantyczna kara.",
    "NEWS: Strajk generalny w {COMPANY} paraliżuje całą produkcję."
];

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  const cenyDocRef = db.doc("global/ceny_akcji");
  
  // ==========================================================
  // NOWOŚĆ KROK 1: Referencja do nowej kolekcji na newsy
  const newsCollectionRef = db.collection("gielda_news");
  // ==========================================================

  const runTicker = async () => {
    const docSnap = await cenyDocRef.get();
    if (!docSnap.exists) {
      console.error("Krytyczny błąd: Dokument 'global/ceny_akcji' nie istnieje!");
      return;
    }

    const currentPrices = docSnap.data();
    const newPrices = {};
    const companies = ["ulanska", "brzozair", "igicorp", "rychbud"];

    console.log("Pobrano ceny:", currentPrices);
    const globalSentiment = (Math.random() - 0.5); 
    
    // (Reszta logiki sentymentu...)
    if (globalSentiment < -0.3) console.log("!!! Sentyment rynkowy: PANIKA");
    else if (globalSentiment < 0) console.log("... Sentyment rynkowy: Ostrożność");
    else if (globalSentiment > 0.3) console.log("!!! Sentyment rynkowy: EUFORIA");
    else console.log("... Sentyment rynkowy: Stabilnie");

    // Używamy pętli 'for...of', aby móc użyć 'await' w środku
    for (const companyId of companies) {
      if (currentPrices[companyId] === undefined) continue;

      const price = currentPrices[companyId];
      let newPrice = price;
      
      const volatility = 0.01 * price; 
      let change = (Math.random() - 0.5) * 2 * volatility; 
      const trend = globalSentiment * (price * 0.005); 
      change += trend;

      const eventChance = 0.10; 
      
      if (Math.random() < eventChance) {
          const isPositive = Math.random() > 0.5;
          let newsTemplate = "";
          let impactPercent = 0.0;
          let impactType = ""; // 'positive' lub 'negative'

          if (isPositive) {
              impactPercent = (Math.random() * 0.10) + 0.05; // +5% to +15%
              newsTemplate = positiveNews[Math.floor(Math.random() * positiveNews.length)];
              impactType = "positive";
          } else {
              impactPercent = ((Math.random() * 0.10) + 0.05) * -1; // -5% to -15%
              newsTemplate = negativeNews[Math.floor(Math.random() * negativeNews.length)];
              impactType = "negative";
          }
          
          const companyName = companyId.toUpperCase();
          const formattedNews = newsTemplate.replace("{COMPANY}", companyName);
          console.log(formattedNews); // Log dla GitHuba
          
          const anomalyImpact = impactPercent * price;
          change += anomalyImpact; 

          // ==========================================================
          // NOWOŚĆ KROK 2: Zapisujemy news do bazy danych
          const newsItem = {
              text: formattedNews,
              companyId: companyId,
              impactType: impactType,
              timestamp: admin.firestore.FieldValue.serverTimestamp() 
          };
          // Używamy 'await', aby mieć pewność, że news się zapisał
          await newsCollectionRef.add(newsItem);
          // ==========================================================
      }
      
      newPrice = price + change;
      newPrice = Math.max(1.00, newPrice); 
      newPrices[companyId] = parseFloat(newPrice.toFixed(2));
    }

    await cenyDocRef.update(newPrices);
    console.log("Sukces! Zaktualizowano ceny:", newPrices);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // GŁÓWNA PĘTLA (3-godzinna)
  const mainLoop = async () => {
    const updatesPerRun = 360;      
    const intervalSeconds = 30;     

    console.log(`Rozpoczynam pętlę: ${updatesPerRun} aktualizacji co ${intervalSeconds} sekund.`);

    for (let i = 1; i <= updatesPerRun; i++) {
      console.log(`--- Aktualizacja ${i}/${updatesPerRun} ---`);
      
      try {
        await runTicker(); 
      } catch (e) {
        console.error("Błąd w trakcie 'runTicker':", e);
      }
      
      if (i < updatesPerRun) {
        console.log(`Czekam ${intervalSeconds} sekund...`);
        await sleep(intervalSeconds * 1000);
      }
    }
    console.log("Pętla 3-godzinna zakończona. Zamykam zadanie.");
  };

  mainLoop();

} catch (e) {
  console.error("Wystąpił krytyczny błąd podczas inicjalizacji skryptu:");
  console.error(e);
  process.exit(1); 
}
