// Używamy 'require' (CommonJS), co jest prostsze dla GitHub Actions
const admin = require('firebase-admin');

// Pobieramy klucz (w formie stringa) z sekretów GitHub
// Zmienna 'FIREBASE_SERVICE_ACCOUNT' zostanie ustawiona w Kroku 4
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

try {
  // Inicjalizujemy Firebase Admin SDK z kluczem
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    // Pamiętaj, aby URL pasował do Twojego projektu!
    databaseURL: 'https://symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  const cenyDocRef = db.doc("global/ceny_akcji");

  console.log("Połączono z Firebase. Rozpoczynam aktualizację cen...");

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

    console.log("Aktualne ceny:", currentPrices);
    console.log("Obliczam nowe ceny...");

    // 2. Wygeneruj nowe ceny (ta sama logika co w starym tickerze)
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
    
    console.log("Sukces! Zaktualizowano ceny w bazie:", newPrices);
  };

  // Uruchom główną logikę
  runTicker();

} catch (e) {
  console.error("Wystąpił błąd podczas inicjalizacji lub uruchamiania skryptu:");
  console.error(e);
  process.exit(1); // Zakończ z błędem, aby GitHub Action pokazał "failed"
}
