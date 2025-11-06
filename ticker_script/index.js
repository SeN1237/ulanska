// Plik: ticker_script/index.js (NOWA WERSJA)

const admin = require('firebase-admin');

// Pobieramy klucz (w formie stringa) z sekretów GitHub
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// === PRZYKŁADOWE NEWSY, KTÓRE WYMYŚLIŁEM ===
// Będziemy je losować przy anomaliach
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
// ============================================

try {
  // Inicjalizujemy Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  const cenyDocRef = db.doc("global/ceny_akcji"); // Poprawna ścieżka

  // === FUNKCJA TICKERA (serce) ===
  // Ta funkcja robi JEDNĄ aktualizację cen
  const runTicker = async () => {
    // 1. Pobierz aktualne ceny
    const docSnap = await cenyDocRef.get();
    if (!docSnap.exists) {
      console.error("Krytyczny błąd: Dokument 'global/ceny_akcji' nie istnieje!");
      return;
    }

    const currentPrices = docSnap.data();
    const newPrices = {};
    const companies = ["ulanska", "brzozair", "igicorp", "rychbud"];

    console.log("Pobrano ceny:", currentPrices);

    // ==========================================================
    // NOWA LOGIKA RYNKU
    // ==========================================================

    // 1. Globalny Sentyment Rynkowy (wpływa na wszystkie spółki)
    // Losujemy, czy rynek ma teraz lekki trend wzrostowy, czy spadkowy.
    // (Math.random() - 0.5) daje liczbę od -0.5 do +0.5
    // To zastępuje nasz stary, stały trend wzrostowy.
    const globalSentiment = (Math.random() - 0.5); // Np. -0.2 (lekka bessa) lub +0.4 (lekka hossa)
    
    if (globalSentiment < -0.3) {
        console.log("!!! Sentyment rynkowy: PANIKA (silne spadki)");
    } else if (globalSentiment < 0) {
        console.log("... Sentyment rynkowy: Ostrożność (lekkie spadki)");
    } else if (globalSentiment > 0.3) {
        console.log("!!! Sentyment rynkowy: EUFORIA (silne wzrosty)");
    } else {
        console.log("... Sentyment rynkowy: Stabilnie (lekkie wzrosty)");
    }


    // 2. Przetwarzanie każdej spółki
    companies.forEach((companyId) => {
      if (currentPrices[companyId] === undefined) return;

      const price = currentPrices[companyId];
      let newPrice = price;
      
      // A. Zwykła zmienność (małe wahania góra/dół)
      const volatility = 0.01 * price; // 1% ceny
      let change = (Math.random() - 0.5) * 2 * volatility; // losowo +/- 1%

      // B. Zastosowanie Globalnego Sentymentu
      // Sentyment dodaje lub odejmuje trochę od ceny (max 0.5% w danym cyklu)
      const trend = globalSentiment * (price * 0.005); 
      change += trend;

      // C. Anomalie i Krachy (Wydarzenia losowe / "Newsy")
      // Ustawiamy 10% szans na "wydarzenie" dla danej spółki w tym cyklu
      const eventChance = 0.10; 
      
      if (Math.random() < eventChance) {
          // Zdarzyło się! Losujemy czy dobre, czy złe.
          const isPositive = Math.random() > 0.5;
          let news = "";
          let impactPercent = 0.0;

          if (isPositive) {
              // Hossa! Losujemy moc od +5% do +15%
              impactPercent = (Math.random() * 0.10) + 0.05; // +5% to +15%
              news = positiveNews[Math.floor(Math.random() * positiveNews.length)];
          } else {
              // Krach! Losujemy moc od -5% do -15%
              impactPercent = ((Math.random() * 0.10) + 0.05) * -1; // -5% to -15%
              news = negativeNews[Math.floor(Math.random() * negativeNews.length)];
          }

          // Wyświetlamy "news" w logach GitHuba
          console.log(news.replace("{COMPANY}", companyId.toUpperCase()));
          
          const anomalyImpact = impactPercent * price;
          change += anomalyImpact; // Dodajemy potężną zmianę
      }
      
      // 3. Obliczenie finalnej ceny
      newPrice = price + change;
      newPrice = Math.max(1.00, newPrice); // Cena nie spadnie poniżej 1
      
      newPrices[companyId] = parseFloat(newPrice.toFixed(2));
    });

    // 4. ZAPISZ nowe ceny z powrotem do bazy
    await cenyDocRef.update(newPrices);
    console.log("Sukces! Zaktualizowano ceny:", newPrices);
  };

  // === FUNKCJA PAUZY ===
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // === GŁÓWNA PĘTLA (3-godzinna) ===
  const mainLoop = async () => {
    // 360 aktualizacji co 30 sekund = 10800 sekund = 3 godziny
    const updatesPerRun = 360;      
    const intervalSeconds = 30;     

    console.log(`Rozpoczynam pętlę: ${updatesPerRun} aktualizacji co ${intervalSeconds} sekund.`);

    for (let i = 1; i <= updatesPerRun; i++) {
      console.log(`--- Aktualizacja ${i}/${updatesPerRun} ---`);
      
      try {
        await runTicker(); // Uruchom właściwą aktualizację cen
      } catch (e) {
        console.error("Błąd w trakcie 'runTicker':", e);
      }
      
      // Czekaj (jeśli to nie jest ostatnia pętla)
      if (i < updatesPerRun) {
        console.log(`Czekam ${intervalSeconds} sekund...`);
        await sleep(intervalSeconds * 1000);
      }
    }
    console.log("Pętla 3-godzinna zakończona. Zamykam zadanie (GitHub uruchomi mnie ponownie).");
  };

  // Uruchom główną pętlę
  mainLoop();

} catch (e) {
  console.error("Wystąpił krytyczny błąd podczas inicjalizacji skryptu:");
  console.error(e);
  process.exit(1); // Zakończ z błędem
}
