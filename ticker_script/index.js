const admin = require('firebase-admin');

// Pobieramy klucz (w formie stringa) z sekretów GitHub
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

try {
  // Inicjalizujemy Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  const cenyDocRef = db.doc("global/ceny_akcji"); // Upewnij się, że nazwa jest poprawna! (u Ciebie było: ceny_akcji)
  // Jeśli w bazie masz 'ceny_akcji', zmień linię wyżej na:
  // const cenyDocRef = db.doc("global/ceny_akcji");


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

    // 2. Wygeneruj nowe ceny
    companies.forEach((companyId) => {
      if (currentPrices[companyId] === undefined) return;

      const price = currentPrices[companyId];
      const volatility = 0.01 * price;
      const trend = 0.0005 * price;
      const change = (Math.random() - 0.5) * 2 * volatility + trend;
      
      let newPrice = price + change;
      newPrice = Math.max(1.00, newPrice); // Cena nie spadnie poniżej 1
      
      newPrices[companyId] = parseFloat(newPrice.toFixed(2));
    });

    // 3. ZAPISZ nowe ceny z powrotem do bazy
    await cenyDocRef.update(newPrices);
    console.log("Sukces! Zaktualizowano ceny:", newPrices);
  };

  // === FUNKCJA PAUZY ===
  // Potrzebujemy jej, aby czekać 30 sekund
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // === GŁÓWNA PĘTLA (NOWA LOGIKA) ===
  const mainLoop = async () => {
    const updatesPerRun = 10;       // 10 aktualizacji...
    const intervalSeconds = 27;     // ...co 30 sekund
    // (10 * 30s = 300s = 5 minut)

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
    console.log("Pętla zakończona. Zamykam zadanie (GitHub uruchomi mnie ponownie).");
  };

  // Uruchom główną pętlę
  mainLoop();

} catch (e) {
  console.error("Wystąpił krytyczny błąd podczas inicjalizacji skryptu:");
  console.error(e);
  process.exit(1); // Zakończ z błędem
}
