// Plik: ticker_script/index.js (WERSJA 7.1 - Krypto + ZAKŁADY "ADMIN" - POPRAWKA .exists)

const admin = require('firebase-admin');

// --- POBIERANIE KLUCZA ---
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// --- LISTY NEWSÓW (Bez zmian) ---
const positiveNews = [
    // Finansowe (Zyski, Inwestycje, Oceny)
    "NEWS: {COMPANY} ogłasza rekordowe zyski kwartalne! Analitycy w szoku!",
    "NEWS: Zysk netto {COMPANY} wzrósł o 300% rok do roku. Niesamowite!",
    "NEWS: {COMPANY} ogłasza niespodziewaną dywidendę specjalną dla akcjonariuszy.",
    "NEWS: Fundusz hedgingowy o wartości miliarda dolarów właśnie zainwestował w {COMPANY}.",
    "NEWS: {COMPANY} z powodzeniem refinansuje swoje zadłużenie na znacznie lepszych warunkach.",
    "NEWS: Agencja ratingowa podnosi ocenę {COMPANY} do 'AAA' z perspektywą stabilną.",
    "NEWS: {COMPANY} ogłasza program masowego wykupu akcji własnych. Cena poszybuje?",
    "NEWS: Przychody {COMPANY} przekroczyły wszelkie prognozy analityków z Wall Street.",
    "NEWS: {COMPANY} notuje najniższy w historii poziom zadłużenia. Kondycja finansowa wzorowa.",
    "NEWS: Audyt wewnętrzny w {COMPANY} nie wykazał żadnych nieprawidłowości. Pełna transparentność!",
    "NEWS: Koszty operacyjne {COMPANY} spadły o 25% dzięki nowej optymalizacji.",
    "NEWS: {COMPANY} pozyskało finansowanie na poziomie 500 mln zł na nową fabrykę.",
    "NEWS: Bank centralny obniża stopy procentowe, co bezpośrednio wspiera sektor {COMPANY}.",
    "NEWS: {COMPANY} ogłasza rekordową sprzedaż w kluczowym okresie świątecznym.",
    "NEWS: Nowy dyrektor finansowy {COMPANY} przedstawia genialny plan restrukturyzacji kosztów.",
    "NEWS: {COMPANY} pokonuje prognozy EPS (zysk na akcję) o 50 centów.",
    "NEWS: Analitycy podnoszą cenę docelową akcji {COMPANY} o 40%.",
    "NEWS: {COMPANY} zamyka nierentowny dział, skupiając się na najbardziej dochodowych operacjach.",
    "NEWS: 'Uważamy {COMPANY} za okazję dekady' - mówi znany analityk rynkowy.",
    "NEWS: {COMPANY} spłaciło całe swoje zadłużenie krótkoterminowe przed terminem.",
    // Produkty i Technologia
    "NEWS: Przełom technologiczny w {COMPANY}! Ich nowa technologia zmienia zasady gry.",
    "NEWS: {COMPANY} ogłasza nowy, rewolucyjny produkt. Zamówienia przedpremierowe biją rekordy.",
    "NEWS: Patent {COMPANY} na kluczową technologię został właśnie zatwierdzony.",
    "NEWS: {COMPANY} integruje zaawansowaną sztuczną inteligencję ze swoimi usługami. Efektywność +30%.",
    "NEWS: Badania kliniczne nowego leku {COMPANY} (faza III) zakończone pełnym sukcesem.",
    "NEWS: Nowa linia produkcyjna {COMPANY} ruszyła tydzień przed terminem.",
    "NEWS: Flota {COMPANY} została w pełni zmodernizowana. Niższe koszty paliwa, wyższa wydajność.",
    "NEWS: Oprogramowanie {COMPANY} zostało uznane za 'najbezpieczniejsze w branży' w nowym raporcie.",
    "NEWS: {COMPANY} odkryło nowe, tanie źródło kluczowego surowca.",
    "NEWS: Flagowy produkt {COMPANY} otrzymuje ocenę 10/10 w prestiżowym teście konsumenckim.",
    "NEWS: {COMPANY} ogłasza partnerstwo technologiczne z gigantem z Doliny Krzemowej.",
    "NEWS: Testy beta nowego oprogramowania {COMPANY} zbierają entuzjastyczne recenzje.",
    "NEWS: {COMPANY} z sukcesem zakończyło migrację całej infrastruktury do chmury.",
    "NEWS: {COMPANY} wprowadza na rynek wersję 'premium' swojego produktu. Marże wystrzelą.",
    "NEWS: {COMPANY} ogłasza, że ich nowy produkt będzie kompatybilny wstecz ze wszystkimi starymi modelami.",
    "NEWS: {COMPANY} rozwiązuje problem, z którym branża borykała się od lat. Inżynierowie świętują.",
    "NEWS: {COMPANY} ogłasza, że ich nowa fabryka będzie w 100% neutralna węglowo.",
    "NEWS: Centrum badawcze {COMPANY} publikuje przełomowe wyniki badań.",
    "NEWS: {COMPANY} rozpoczyna budowę gigantycznego centrum danych.",
    "NEWS: {COMPANY} przechodzi na nowy, tańszy i wydajniejszy model produkcji.",
    // Rynek i Kontrakty
    "NEWS: Rząd ogłasza strategiczny, wielomiliardowy kontrakt dla {COMPANY}.",
    "NEWS: {COMPANY} wchodzi na rynek azjatycki. Ogromny potencjał wzrostu.",
    "NEWS: {COMPANY} podpisuje 10-letnią umowę na wyłączność z kluczowym dystrybutorem.",
    "NEWS: Główny konkurent {COMPANY} ogłasza bankructwo! {COMPANY} przejmie rynek?",
    "NEWS: {COMPANY} oficjalnie potwierdza fuzję z inną dużą firmą. Powstaje gigant.",
    "NEWS: Nowe regulacje państwowe faworyzują model biznesowy {COMPANY}.",
    "NEWS: {COMPANY} ogłasza przejęcie mniejszego, innowacyjnego startupu.",
    "NEWS: {COMPANY} wygrywa przetarg na obsługę sieci 5G w całym kraju.",
    "NEWS: {COMPANY} zdobywa kontrakt na wyposażenie nowej floty samolotów pasażerskich.",
    "NEWS: {COMPANY} podpisuje umowę partnerską z wojskiem.",
    "NEWS: {COMPANY} zostaje wyłącznym dostawcą dla sieci supermarketów 'MegaMarket'.",
    "NEWS: {COMPANY} wchodzi na rynek Ameryki Południowej. Pierwsze kontrakty już podpisane.",
    "NEWS: {COMPANY} ogłasza, że ich udział w rynku wzrósł do 50%.",
    "NEWS: {COMPANY} otrzymuje ogromne dotacje unijne na rozwój zielonej energii.",
    "NEWS: Ceny kluczowego surowca dla {COMPANY} spadają na światowych rynkach.",
    "NEWS: {COMPANY} otwiera swoje setne biuro regionalne.",
    "NEWS: {COMPANY} ogłasza sojusz strategiczny z dotychczasowym rywalem w celu pokonania konkurencji.",
    "NEWS: {COMPANY} przejmuje kontrolę nad kluczowym szlakiem logistycznym.",
    "NEWS: Rząd obniża cła na import komponentów używanych przez {COMPANY}.",
    "NEWS: {COMPANY} otwiera nową, zautomatyzowaną linię montażową.",
    // PR, Nagrody, Wizerunek
    "NEWS: Słynny inwestor ogłasza, że wykupił duży pakiet akcji {COMPANY}.",
    "NEWS: {COMPANY} zdobywa nagrodę 'Innowator Roku' w prestiżowym konkursie.",
    "NEWS: Prezes {COMPANY} na okładce magazynu 'Forbes'.",
    "NEWS: {COMPANY} ogłasza partnerstwo z popularną gwiazdą filmową. Będzie twarzą marki.",
    "NEWS: {COMPANY} wygrywa kluczowy proces sądowy o prawa patentowe.",
    "NEWS: {COMPANY} zostaje uznana za 'Najlepsze Miejsce Pracy' piąty rok z rzędu.",
    "NEWS: {COMPANY} ogłasza program charytatywny, przekazując 100 mln zł na cele społeczne.",
    "NEWS: Słynny reżyser umieścił produkt {COMPANY} w swoim nowym hicie kinowym.",
    "NEWS: Kampania marketingowa {COMPANY} staje się viralem w internecie.",
    "NEWS: {COMPANY} otrzymuje certyfikat ISO 9001. Najwyższa jakość potwierdzona.",
    "NEWS: {COMPANY} pomyślnie przechodzi rygorystyczny audyt ekologiczny.",
    "NEWS: W mediach społecznościowych rusza trend #Kochamy{COMPANY}.",
    "NEWS: {COMPANY} sponsoruje zwycięską drużynę olimpijską.",
    "NEWS: Raport konsumencki: Produkty {COMPANY} są 'najmniej awaryjne' na rynku.",
    "NEWS: {COMPANY} wygrywa w sądzie z oszczercami. Otrzyma wysokie odszkodowanie.",
    "NEWS: {COMPANY} buduje nowe, ekologiczne biuro. Świetny PR.",
    "NEWS: Gwiazda sportu podpisuje dożywotni kontrakt reklamowy z {COMPANY}.",
    "NEWS: {COMPANY} z powodzeniem odpiera wrogi atak hakerski. Dane klientów bezpieczne.",
    "NEWS: Film dokumentalny chwalący historię {COMPANY} trafia na Netflix.",
    "NEWS: {COMPANY} zostaje oficjalnym partnerem technologicznym NASA.",
    // Wewnętrzne (Zarząd, Pracownicy)
    "NEWS: {COMPANY} zatrudnia legendarnego inżyniera z konkurencyjnej firmy.",
    "NEWS: Nowy, charyzmatyczny prezes przejmuje stery w {COMPANY}. Rynek reaguje entuzjastycznie.",
    "NEWS: {COMPANY} ogłasza udaną restrukturyzację. Firma jest teraz 'lżejsza i szybsza'.",
    "NEWS: Pracownicy {COMPANY} rezygnują z planowanego strajku po udanych negocjacjach.",
    "NEWS: {COMPANY} ogłasza program opcji na akcje dla wszystkich pracowników.",
    "NEWS: Zarząd {COMPANY} jednogłośnie zatwierdza nową, agresywną strategię rozwoju.",
    "NEWS: {COMPANY} ogłasza, że cała załoga przejdzie szkolenie z AI, zwiększając kompetencje.",
    "NEWS: Wskaźnik retencji pracowników w {COMPANY} osiąga rekordowe 98%.",
    "NEWS: {COMPANY} ogłasza 10% podwyżki dla wszystkich pracowników produkcji.",
    "NEWS: {COMPANY} z sukcesem wdraża 4-dniowy tydzień pracy przy zachowaniu 100% wydajności.",
    // --- Dodatkowe...
    "NEWS: {COMPANY} wchodzi do indeksu S&P 500! Ogromny napływ kapitału pasywnego.",
    "NEWS: Przełom w badaniach {COMPANY} nad fuzją jądrową. 'To zmieni świat' - mówi prezes.",
    "NEWS: {COMPANY} ogłasza, że ich nowa fabryka półprzewodników startuje 6 miesięcy przed planem.",
    "NEWS: Rząd przyznaje {COMPANY} wyłączność na budowę krajowej sieci ładowarek EV.",
    "NEWS: {COMPANY} opatentowało nowy, biodegradowalny materiał zastępujący plastik.",
    "NEWS: 'Akcje {COMPANY} to pewniak na najbliższe 10 lat' - Jim Cramer.",
    "NEWS: {COMPANY} podpisuje umowę z SpaceX na wyniesienie swojej satelity.",
    "NEWS: Wyniki finansowe {COMPANY} biją prognozy o 200%. 'Niespotykane' - mówią analitycy.",
    "NEWS: {COMPANY} rozwiązuje kryzys łańcucha dostaw dzięki nowemu oprogramowaniu logistycznemu.",
    "NEWS: {COMPANY} ogłasza partnerstwo z Apple w celu integracji ich technologii z iPhonem."
];

const negativeNews = [
    // --- STARE WIADOMOŚCI ---
    // Finansowe (Straty, Długi, Oceny)
    "NEWS: SKANDAL w {COMPANY}! Prezes aresztowany pod zarzutem defraudacji.",
    "NEWS: {COMPANY} ogłasza straty kwartalne znacznie większe niż przewidywano.",
    "NEWS: Agencja ratingowa obniża ocenę {COMPANY} do poziomu 'śmieciowego'.",
    "NEWS: {COMPANY} ostrzega przed 'znacznym spadkiem przychodów' w przyszłym kwartale.",
    "NEWS: Fundusz hedgingowy masowo wyprzedaje akcje {COMPANY}. 'Statek tonie?'",
    "NEWS: {COMPANY} nie jest w stanie spłacić nadchodzącej raty obligacji. Grozi niewypłacalność.",
    "NEWS: Audyt zewnętrzny w {COMPANY} wykrył poważne 'nieprawidłowości księgowe'.",
    "NEWS: {COMPANY} ogłasza emisję nowych akcji, co rozwodni obecnych akcjonariuszy.",
    "NEWS: {COMPANY} musi zapłacić 500 mln zł kary za manipulacje rynkowe.",
    "NEWS: Dyrektor finansowy {COMPANY} nagle rezygnuje ze stanowiska bez podania przyczyny.",
    "NEWS: {COMPANY} odnotowuje gwałtowny wzrost kosztów surowców. Marże topnieją.",
    "NEWS: Bank centralny podnosi stopy procentowe, co uderza w zadłużony sektor {COMPANY}.",
    "NEWS: {COMPANY} zamyka 50% swoich oddziałów w ramach 'bolesnej restrukturyzacji'.",
    "NEWS: Słynny analityk publikuje raport 'SPRZEDAWAĆ {COMPANY}'",
    "NEWS: {COMPANY} bierze drogi kredyt ratunkowy na utrzymanie płynności.",
    "NEWS: 'Kreatywna księgowość' w {COMPANY}? Regulatorzy wszczynają dochodzenie.",
    "NEWS: {COMPANY} przegrywa przetarg na kluczowy kontrakt rządowy.",
    "NEWS: {COMPANY} ogłasza zawieszenie wypłaty dywidendy po raz pierwszy od 20 lat.",
    "NEWS: Zysk na akcję (EPS) {COMPANY} mija się z prognozami o 70%.",
    "NEWS: Bańka spekulacyjna na akcjach {COMPANY} właśnie pękła - twierdzi ekspert.",
    // Produkty i Technologia
    "NEWS: Krytyczna awaria systemów {COMPANY}. Straty liczone w milionach.",
    "NEWS: {COMPANY} ogłasza masowe wycofanie (recall) swojego flagowego produktu z powodu wady.",
    "NEWS: Nowy produkt {COMPANY} okazuje się totalną klapą. Sprzedaż poniżej 1% oczekiwań.",
    "NEWS: Hakerzy ukradli dane milionów klientów {COMPANY}. Grożą gigantyczne kary.",
    "NEWS: Kluczowy patent {COMPANY} został właśnie unieważniony przez sąd.",
    "NEWS: Nowa technologia {COMPANY} okazała się nieefektywna i niebezpieczna.",
    "NEWS: Fabryka {COMPANY} zatrzymana z powodu poważnej awarii technicznej.",
    "NEWS: Oprogramowanie {COMPANY} zawiera krytyczną lukę bezpieczeństwa (Zero-Day).",
    "NEWS: {COMPANY} nie przeszło testów bezpieczeństwa. Produkt nie wejdzie na rynek.",
    "NEWS: {COMPANY} oskarżone o kradzież technologii od mniejszego konkurenta.",
    "NEWS: Kluczowy surowiec używany przez {COMPANY} został zakazany z powodów ekologicznych.",
    "NEWS: Serwery {COMPANY} nie działają od 12 godzin. Klienci są wściekli.",
    "NEWS: Nowy produkt {COMPANY} powoduje samozapłon? Trwa dochodzenie.",
    "NEWS: {COMPANY} nie nadąża z produkcją. Konkurencja przejmuje zamówienia.",
    "NEWS: Migracja {COMPANY} do chmury zakończyła się katastrofą. Utracono część danych.",
    "NEWS: Testy beta nowego oprogramowania {COMPANY} przerwane. 'Zbyt wiele błędów'.",
    "NEWS: {COMPANY} musi zamknąć centrum badawcze z powodu braku funduszy.",
    "NEWS: {COMPANY} nie dostosowało się do nowych norm emisji spalin. Produkcja wstrzymana.",
    "NEWS: Badania kliniczne nowego leku {COMPANY} wykazują poważne skutki uboczne.",
    "NEWS: {COMPANY} polega na przestarzałej technologii. Konkurencja ich wyprzedza.",
    // Rynek i Kontrakty
    "NEWS: {COMPANY} przegrywa kluczowy proces sądowy. Grozi im gigantycztna kara.",
    "NEWS: Główny partner strategiczny {COMPANY} zrywa umowę w trybie natychmiastowym.",
    "NEWS: Nowy, agresywny konkurent wchodzi na rynek {COMPANY} z dumpingowymi cenami.",
    "NEWS: Rząd wprowadza nowy, surowy podatek dla branży, w której działa {COMPANY}.",
    "NEWS: Fuzja {COMPANY} z inną firmą została zablokowana przez urząd antymonopolowy.",
    "NEWS: {COMPANY} traci 10-letni kontrakt na wyłączność. Dystrybutor wybrał konkurencję.",
    "NEWS: {COMPANY} ogłasza wycofanie się z rynku azjatyckiego. 'Nie udało się'.",
    "NEWS: Ceny kluczowego surowca dla {COMPANY} wzrosły o 300% na światowych rynkach.",
    "NEWS: {COMPANY} oskarżone o stosowanie praktyk monopolistycznych.",
    "NEWS: {COMPANY} traci kontrakt z wojskiem po serii wpadek jakościowych.",
    "NEWS: Rząd cofa dotacje unijne dla {COMPANY} z powodu nieprawidłowości.",
    "NEWS: Sieć supermarketów 'MegaMarket' zrywa umowę z {COMPANY}.",
    "NEWS: {COMPANY} nie jest w stanie konkurować z tanimi produktami z importu.",
    "NEWS: Cały sektor {COMPANY} wchodzi w głęboką recesję.",
    "NEWS: Udział rynkowy {COMPANY} spadł poniżej 10%.",
    "NEWS: Negocjacje w sprawie przejęcia {COMPANY} przez giganta zostały zerwane.",
    "NEWS: {COMPANY} musi zapłacić ogromne cła importowe.",
    "NEWS: Nowe regulacje ekologiczne zmuszają {COMPANY} do zamknięcia głównej fabryki.",
    "NEWS: {COMPANY} traci dostęp do kluczowego szlaku logistycznego z powodu wojny handlowej.",
    "NEWS: Popyt na produkty {COMPANY} gwałtownie spada na całym świecie.",
    // PR, Skandale, Wizerunek
    "NEWS: Ostra kontrola państwowa wchodzi do {COMPANY}. Inwestorzy panikują.",
    "NEWS: Reportaż śledczy ujawnia fatalne warunki pracy w fabrykach {COMPANY}.",
    "NEWS: {COMPANY} przyłapane na fałszowaniu wyników testów ekologicznych.",
    "NEWS: Prezes {COMPANY} sfilmowany podczas obrażania klientów. Wizerunkowa katastrofa.",
    "NEWS: Kampania marketingowa {COMPANY} uznana za 'rasistowską'. Wezwania do bojkotu.",
    "NEWS: {COMPANY} oskarżone o zatruwanie środowiska. Aktywiści protestują przed siedzibą.",
    "NEWS: Słynna gwiazda zrywa kontrakt reklamowy z {COMPANY} po skandalu.",
    "NEWS: Produkt {COMPANY} okazał się przyczyną poważnych problemów zdrowotnych. Ruszają pozwy zbiorowe.",
    "NEWS: #Bojkot{COMPANY} trenduje na pierwszym miejscu na Twitterze.",
    "NEWS: {COMPANY} uznane za 'Najgorszego Pracodawcę Roku'.",
    "NEWS: Wyciekły wewnętrzne maile zarządu {COMPANY}. Obnażają nieetyczne praktyki.",
    "NEWS: {COMPANY} przegrywa proces o zniesławienie. Musi publicznie przeprosić.",
    "NEWS: {COMPANY} musi zapłacić gigantyczne odszkodowanie za wypadek w fabryce.",
    "NEWS: Słynny inwestor nazywa {COMPANY} 'piramidą finansową'.",
    "NEWS: {COMPANY} próbowało ukryć dane o awarii produktu. 'Ukrywali to od miesięcy'.",
    "NEWS: {COMPANY} oskarżone o mobbing i dyskryminację. Byli pracownicy składają pozwy.",
    "NEWS: Siedziba {COMPANY} zablokowana przez protestujących rolników.",
    "NEWS: {COMPANY} przyłapane na nielegalnym składowaniu toksycznych odpadów.",
    "NEWS: Celebryta, który reklamował {COMPANY}, został skazany za oszustwa.",
    // Wewnętrzne (Zarząd, Pracownicy)
    "NEWS: Strajk generalny w {COMPANY} paraliżuje całą produkcję.",
    "NEWS: Kluczowy zespół inżynierów {COMPANY} odchodzi w całości do konkurencji.",
    "NEWS: Prezes {COMPANY} odchodzi w trybie natychmiastowym! 'Powody osobiste'.",
    "NEWS: {COMPANY} ogłasza masowe zwolnienia grupowe. 30% załogi traci pracę.",
    "NEWS: Pracownicy {COMPANY} odrzucają propozycję podwyżek i zapowiadają eskalację strajku.",
    "NEWS: Fatalne zarządzanie w {COMPANY}. Firma traci kluczowych menedżerów.",
    "NEWS: Wewnętrzny konflikt w zarządzie {COMPANY}. Walka o władzę paraliżuje firmę.",
    "NEWS: {COMPANY} nie jest w stanie znaleźć nowego prezesa. Nikt nie chce tej posady.",
    "NEWS: {COMPANY} ogłasza cięcia wszystkich benefitów pracowniczych. Morale sięga dna.",
    "NEWS: Związki zawodowe w {COMPANY} zapowiadają protest okupacyjny.",
    // --- Dodatkowe...
    "NEWS: SKANDAL! {COMPANY} przyłapane na wykorzystywaniu pracy dzieci w swoich fabrykach.",
    "NEWS: {COMPANY} usuwa krytyczne błędy z produkcji... usuwając cały kod źródłowy.",
    "NEWS: Pożar w głównej serwerowni {COMPANY}. Wszystkie dane klientów utracone.",
    "NEWS: 'Nigdy nie kupiłbym akcji {COMPANY}' - Jim Cramer.",
    "NEWS: {COMPANY} przypadkowo wysyła maile z hasłami wszystkich użytkowników jako zwykły tekst.",
    "NEWS: Produkt {COMPANY} uznany za 'zagrożenie dla bezpieczeństwa narodowego' przez rząd USA.",
    "NEWS: Prezes {COMPANY} złapany na gorącym uczynku podczas sprzedawania tajemnic firmowych konkurencji.",
    "NEWS: {COMPANY} omyłkowo przelewa całą rezerwę gotówkową na konto nigeryjskiego księcia.",
    "NEWS: 'Technologia {COMPANY} to marketingowa wydmuszka' - ujawnia były pracownik.",
    "NEWS: {COMPANY} musi zapłacić 10 miliardów dolarów kary za spowodowanie katastrofy ekologicznej."
];
// --- KONIEC LIST NEWSÓW ---


try {
  // --- INICJALIZACJA FIREBASE ---
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https.symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  
  // --- GŁÓWNE REFERENCJE DO KOLEKCJI ---
  const cenyDocRef = db.doc("global/ceny_akcji");
  const newsCollectionRef = db.collection("gielda_news");
  
  const rumorsRef = db.collection("plotki");
  const limitOrdersRef = db.collection("limit_orders");
  const usersRef = db.collection("uzytkownicy");
  const historyRef = db.collection("historia_transakcji");
  const pendingTipsRef = db.collection("pending_tips");
  const activeBondsRef = db.collection("active_bonds");
  
  // === NOWE REFERENCJE DLA ZAKŁADÓW ===
  const meczDocRef = db.doc("global/aktywny_mecz");
  const activeBetsRef = db.collection("active_bets");
  
  
  /**
   * Funkcja pomocnicza do obliczania wartości portfela po stronie serwera.
   */
  function calculateTotalValue(cash, shares, currentPrices) {
    let sharesValue = 0;
    for (const companyId in shares) {
        if (currentPrices[companyId]) {
            sharesValue += (shares[companyId] || 0) * currentPrices[companyId];
        }
    }
    return cash + sharesValue;
  }
  
  /**
   * Realizuje pojedyncze zlecenie z limitem
   */
  async function executeLimitOrder(transaction, orderDoc, executedPrice, currentPrices) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;
      
      console.log(`... Próba realizacji zlecenia ${orderId} (${order.type})`);

      // ZMODYFIKOWANO: Domyślny typ to 'stock', ale sprawdzamy czy to krypto
      const { userId, companyId, amount, limitPrice, type, companyName } = order;
      const isCrypto = type.includes("Krypto");
      
      const userRef = usersRef.doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
          console.error(`BŁĄD KRYTYCZNY: Nie znaleziono użytkownika ${userId} dla zlecenia ${orderId}`);
          transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "User not found" });
          return;
      }

      const userData = userDoc.data();
      
      // NOWA WALIDACJA: Sprawdzenie poziomu prestiżu dla krypto
      if (isCrypto && (userData.prestigeLevel || 0) < 3) {
          console.warn(`... Anulowanie zlecenia ${orderId}: Niewystarczający poziom prestiżu (${userData.prestigeLevel || 0}) do handlu krypto.`);
          transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient prestige level for crypto" });
          return;
      }
      
      const newShares = { ...userData.shares };
      let newCash = userData.cash;
      
      const costOrRevenue = amount * limitPrice;

      if (type.startsWith('KUPNO (Limit)')) { // Obejmuje "KUPNO (Limit)" i "KUPNO (Limit, Krypto)"
          if (newCash < costOrRevenue) {
              console.warn(`... Anulowanie zlecenia ${orderId}: Brak środków (potrzeba ${costOrRevenue}, jest ${newCash})`);
              transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient funds" });
              return;
          }
          newCash -= costOrRevenue;
          newShares[companyId] = (newShares[companyId] || 0) + amount;
          
      } else if (type.startsWith('SPRZEDAŻ (Limit)')) { // Obejmuje "SPRZEDAŻ (Limit)" i "SPRZEDAŻ (Limit, Krypto)"
          if (!newShares[companyId] || newShares[companyId] < amount) {
              console.warn(`... Anulowanie zlecenia ${orderId}: Brak akcji (potrzeba ${amount}, jest ${newShares[companyId] || 0})`);
              transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient shares" });
              return;
          }
          newCash += costOrRevenue;
          newShares[companyId] -= amount;
      }
      
      const newTotalValue = calculateTotalValue(newCash, newShares, currentPrices);
      const newZysk = newTotalValue - userData.startValue;

      // 1. Zaktualizuj portfel użytkownika
      transaction.update(userRef, { 
          cash: newCash, 
          shares: newShares, 
          totalValue: newTotalValue, 
          zysk: newZysk,
          'stats.totalTrades': admin.firestore.FieldValue.increment(1) // <-- INKREMENTACJA STATYSTYK
      });

      // 2. Zaktualizuj status zlecenia
      transaction.update(orderDoc.ref, { 
          status: "executed", 
          executedPrice: executedPrice 
      });

      // 3. Zapisz transakcję w globalnej historii
      const historyDocRef = historyRef.doc(); 
      transaction.set(historyDocRef, {
          userId: userId,
          userName: userData.name, 
          prestigeLevel: userData.prestigeLevel || 0, 
          type: type, // Typ jest już poprawny (np. "KUPNO (Limit, Krypto)")
          companyId: companyId,
          companyName: companyName,
          amount: amount,
          pricePerShare: limitPrice, 
          executedPrice: executedPrice, 
          totalValue: costOrRevenue, 
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          clearedByOwner: false,
          status: "executed"
      });

      console.log(`!!! POMYŚLNIE ZREALIZOWANO zlecenie ${orderId} dla ${userData.name} !!!`);
  }
  
  // ==========================================================
  // === FUNKCJA: PRZETWARZANIE OBLIGACJI (Bez zmian)
  // ==========================================================
  async function processBonds(currentPrices) {
      const now = admin.firestore.Timestamp.now();
      const bondsQuery = activeBondsRef
          .where("status", "==", "pending")
          .where("redeemAt", "<=", now);
          
      const bondsSnapshot = await bondsQuery.get();
      
      if (bondsSnapshot.empty) {
          return; // Brak obligacji do wykupienia
      }
      
      console.log(`... Znaleziono ${bondsSnapshot.size} obligacji do wykupienia.`);
      
      for (const bondDoc of bondsSnapshot.docs) {
          const bond = bondDoc.data();
          const bondId = bondDoc.id;
          
          try {
              await db.runTransaction(async (transaction) => {
                  const userRef = usersRef.doc(bond.userId);
                  const userDoc = await transaction.get(userRef);
                  
                  if (!userDoc.exists) {
                      console.error(`BŁĄD KRYTYCZNY: Nie znaleziono użytkownika ${bond.userId} dla obligacji ${bondId}`);
                      transaction.update(bondDoc.ref, { status: "cancelled", failureReason: "User not found" });
                      return;
                  }
                  
                  const userData = userDoc.data();
                  
                  // Oblicz wypłatę
                  const payout = bond.investment + bond.profit;
                  
                  // Zaktualizuj dane użytkownika
                  const newCash = userData.cash + payout;
                  const newTotalValue = calculateTotalValue(newCash, userData.shares, currentPrices);
                  const newZysk = newTotalValue - userData.startValue;

                  transaction.update(userRef, {
                      cash: newCash,
                      totalValue: newTotalValue,
                      zysk: newZysk
                  });
                  
                  // Zaktualizuj obligację
                  transaction.update(bondDoc.ref, {
                      status: "executed"
                  });
                  
                  // Zapisz w historii
                  const historyDocRef = historyRef.doc();
                  transaction.set(historyDocRef, {
                      userId: bond.userId,
                      userName: userData.name, 
                      prestigeLevel: userData.prestigeLevel || 0, 
                      type: "OBLIGACJA (WYKUP)", 
                      companyId: "system",
                      companyName: bond.name, // "Obligacja 1-dniowa (5%)"
                      amount: 1,
                      pricePerShare: bond.investment, // Inwestycja
                      executedPrice: payout, // Pełna wypłata
                      totalValue: bond.profit, // Czysty zysk
                      timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      clearedByOwner: false,
                      status: "executed"
                  });
              });
              
              console.log(`!!! POMYŚLNIE WYKUPIONO obligację ${bondId} dla ${bond.userName} !!!`);
              
          } catch (e) {
              console.error(`BŁĄD Transakcji dla obligacji ${bondId}:`, e.message);
          }
      }
  }

  // ==========================================================
  // === NOWA FUNKCJA: PRZETWARZANIE ZAKŁADÓW (Dla Opcji 3)
  // ==========================================================
  async function processBets(matchData, winner, currentPrices) {
      console.log(`... Rozpoczynam rozliczanie zakładów dla meczu. Wygrał: ${winner}`);
        
      // Znajdź wszystkie zakłady pasujące do czasu rozliczenia meczu
      // I które nadal są "pending"
      const betsQuery = activeBetsRef
          .where("matchResolveTime", "==", matchData.resolveTime)
          .where("status", "==", "pending");
          
      const betsSnapshot = await betsQuery.get();
      
      if (betsSnapshot.empty) {
          console.log("... Brak zakładów do rozliczenia dla tego meczu.");
          return;
      }
      
      console.log(`... Znaleziono ${betsSnapshot.size} zakładów do rozliczenia.`);
      
      for (const betDoc of betsSnapshot.docs) {
          const bet = betDoc.data();
          const betId = betDoc.id;
          
          try {
              await db.runTransaction(async (transaction) => {
                  const userRef = usersRef.doc(bet.userId);
                  const userDoc = await transaction.get(userRef);
                  
                  if (!userDoc.exists) {
                      // Oznacz zakład jako anulowany, jeśli użytkownik nie istnieje
                      transaction.update(betDoc.ref, { status: "cancelled", failureReason: "User not found" });
                      throw new Error(`Nie znaleziono użytkownika ${bet.userId}`);
                  }
                  
                  const userData = userDoc.data();
                  
                  if (bet.betOn === winner) {
                      // === WYGRANA ===
                      const payout = bet.betAmount * bet.odds;
                      const profit = payout - bet.betAmount;
                      
                      const newCash = userData.cash + payout;
                      // Użyj 'currentPrices' przekazanych z runTicker
                      const newTotalValue = calculateTotalValue(newCash, userData.shares, currentPrices); 
                      const newZysk = newTotalValue - userData.startValue;

                      // 1. Zaktualizuj portfel
                      transaction.update(userRef, {
                          cash: newCash,
                          totalValue: newTotalValue,
                          zysk: newZysk
                      });
                      
                      // 2. Zaktualizuj zakład
                      transaction.update(betDoc.ref, { status: "won" });
                      
                      // 3. Zapisz w historii
                      const historyDocRef = historyRef.doc();
                      transaction.set(historyDocRef, {
                          userId: bet.userId,
                          userName: userData.name, 
                          prestigeLevel: userData.prestigeLevel || 0, 
                          type: "WYGRANA (ZAKŁAD)", 
                          companyId: "system",
                          companyName: "Zakłady Sportowe",
                          amount: 1,
                          pricePerShare: 0,
                          executedPrice: payout,
                          totalValue: profit, // Czysty zysk
                          timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          clearedByOwner: false,
                          status: "executed"
                      });
                      
                  } else {
                      // === PRZEGRANA ===
                      // Pieniądze już zostały zabrane, wystarczy oznaczyć zakład
                      transaction.update(betDoc.ref, { status: "lost" });
                  }
              }); // Koniec transakcji
              
              console.log(`... Pomyślnie rozliczono zakład ${betId}`);
              
          } catch (e) {
              console.error(`BŁĄD Transakcji dla zakładu ${betId}:`, e.message);
          }
      } // Koniec pętli for
  }
  
  
  /**
   * GŁÓWNA FUNKCJA TICKERA
   */
  const runTicker = async () => {
    const docSnap = await cenyDocRef.get();
    if (!docSnap.exists) {
      console.error("Krytyczny błąd: Dokument 'global/ceny_akcji' nie istnieje!");
      return;
    }

    const currentPrices = docSnap.data();
    const newPrices = {};
    const now = admin.firestore.Timestamp.now(); // Pobierz aktualny czas serwera
    
    // --- NOWE LISTY AKTYWÓW (ZMNIEJSZONE) ---
    const stocks = ["ulanska", "brzozair", "rychbud", "cosmosanit"];
    const cryptos = ["bartcoin", "igirium"];
    const allAssets = [...stocks, ...cryptos]; // Łączymy obie listy

    const companyReferencePrices = {
        // Akcje
        ulanska: 1860.00,
        brzozair: 235.00,
        rychbud: 870.00,
        cosmosanit: 2000.00,
        // Krypto
        bartcoin: 4000.00,
        igirium: 2000.00
    };
    
    // --- Pobieranie wpływu plotek (Bez zmian) ---
    const thirtySecondsAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 1000);
    const rumorsQuery = rumorsRef.where("timestamp", ">=", thirtySecondsAgo);
    const rumorsSnapshot = await rumorsQuery.get();
    
    const rumorImpacts = {};
    rumorsSnapshot.forEach(doc => {
        const rumor = doc.data();
        rumorImpacts[rumor.companyId] = (rumorImpacts[rumor.companyId] || 0) + rumor.impact;
    });
    if (!rumorsSnapshot.empty) {
        console.log("... Zebrano wpływ plotek:", rumorImpacts);
    }

    console.log("Pobrano ceny:", currentPrices);
    const globalSentiment = (Math.random() - 0.5); 
    
    if (globalSentiment < -0.3) console.log("!!! Sentyment rynkowy: PANIKA");
    else if (globalSentiment < 0) console.log("... Sentyment rynkowy: Ostrożność");
    else if (globalSentiment > 0.3) console.log("!!! Sentyment rynkowy: EUFORIA");
    else console.log("... Sentyment rynkowy: Stabilnie");

    // --- Przetwarzanie oczekujących wskazówek (Bez zmian) ---
    const forcedNews = {}; 
    const tipsQuery = pendingTipsRef.where("executeAt", "<=", now);
    const tipsSnapshot = await tipsQuery.get();
    const deleteBatch = db.batch(); 

    if (!tipsSnapshot.empty) {
        console.log(`... Znaleziono ${tipsSnapshot.size} wskazówek do wykonania.`);
        tipsSnapshot.forEach(doc => {
            const tip = doc.data();
            forcedNews[tip.companyId] = { impactType: tip.impactType };
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        console.log("... Pomyślnie wykonano i usunięto wskazówki.");
    }
    // --- KONIEC PRZETWARZANIA WSKAZÓWEK ---


    // Pętla po spółkach do OBLICZENIA nowych cen
    for (const companyId of allAssets) { // Używamy nowej, połączonej listy
      if (currentPrices[companyId] === undefined) {
          console.warn(`OSTRZEŻENIE: Brak ceny dla '${companyId}' w 'global/ceny_akcji'. Używam ceny referencyjnej.`);
          currentPrices[companyId] = companyReferencePrices[companyId] || 50.00; // Ustaw cenę startową, jeśli nie istnieje
      }

      const price = currentPrices[companyId];
      let newPrice = price;
      let change = 0; 
      
      // ==========================================================
      // === NOWA LOGIKA ZMIENNOŚCI (AKCJE vs KRYPTO) ===
      // ==========================================================
      
      let volatility;
      
      if (cryptos.includes(companyId)) {
          // LOGIKA DLA KRYPTO (WYSOKA ZMIENNOŚĆ)
          console.log(`... Obliczam KRYPTO dla ${companyId}`);
          volatility = 0.20 * price; // 20% zmienności ceny bazowej
      } else {
          // LOGIKA DLA AKCJI (NORMALNA ZMIENNOŚĆ)
          volatility = 0.04 * price; // 4% zmienności ceny bazowej
      }
      
      change = (Math.random() - 0.5) * 2 * volatility; 
      const trend = globalSentiment * (price * 0.005); 
      change += trend;

      // Zastosuj wpływ plotek (Bez zmian)
      if (rumorImpacts[companyId]) {
          const rumorChange = price * rumorImpacts[companyId];
          change += rumorChange;
          console.log(`... Zastosowano wpływ plotki dla ${companyId.toUpperCase()}: ${rumorChange.toFixed(2)} zł (Zmiana: ${rumorImpacts[companyId]*100}%)`);
      }

      // LOGIKA NEWSÓW (Bez zmian, działa dla obu)
      const forcedEvent = forcedNews[companyId]; // Sprawdź, czy mamy wymuszony news
            
      if (forcedEvent) {
          // TAK, mamy wymuszoną wskazówkę
          console.log(`!!! Wymuszony NEWS (ze wskazówki) dla ${companyId.toUpperCase()}: ${forcedEvent.impactType}`);
          const isPositive = forcedEvent.impactType === 'positive';
          
          let newsTemplate = "";
          let impactPercent = 0.0;
          
          if (isPositive) {
              impactPercent = (Math.random() * 0.20) + 0.05; // +5% to +15%
              newsTemplate = positiveNews[Math.floor(Math.random() * positiveNews.length)];
          } else {
              impactPercent = ((Math.random() * 0.20) + 0.05) * -1; // -5% to -15%
              newsTemplate = negativeNews[Math.floor(Math.random() * negativeNews.length)];
          }
          
          const companyName = companyId.toUpperCase();
          const formattedNews = newsTemplate.replace("{COMPANY}", companyName);
          console.log(formattedNews);
          
          const anomalyImpact = impactPercent * price;
          change += anomalyImpact; 

          const newsItem = {
              text: formattedNews,
              companyId: companyId,
              impactType: forcedEvent.impactType,
              timestamp: admin.firestore.FieldValue.serverTimestamp() 
          };
          await newsCollectionRef.add(newsItem);

      } else {
          // NIE, brak wymuszonej wskazówki. Użyj normalnego losowania 7%.
          const eventChance = 0.07; 
          if (Math.random() < eventChance) {
              const isPositive = Math.random() > 0.5;
              let newsTemplate = "";
              let impactPercent = 0.0;
              let impactType = ""; 

              if (isPositive) {
                  impactPercent = (Math.random() * 0.20) + 0.05; // +5% to +15%
                  newsTemplate = positiveNews[Math.floor(Math.random() * positiveNews.length)];
                  impactType = "positive";
              } else {
                  impactPercent = ((Math.random() * 0.20) + 0.05) * -1; // -5% to -15%
                  newsTemplate = negativeNews[Math.floor(Math.random() * negativeNews.length)];
                  impactType = "negative";
              }
              
              const companyName = companyId.toUpperCase();
              const formattedNews = newsTemplate.replace("{COMPANY}", companyName);
              console.log(formattedNews); // Log dla GitHuba
              
              const anomalyImpact = impactPercent * price;
              change += anomalyImpact; 

              const newsItem = {
                  text: formattedNews,
                  companyId: companyId,
                  impactType: impactType,
                  timestamp: admin.firestore.FieldValue.serverTimestamp() 
              };
              await newsCollectionRef.add(newsItem);
          }
      }
      // ==========================================================
      
      newPrice = price + change; // Zastosuj zmianę

      // ==========================================================
      // === POPRAWIONA LOGIKA ODBICIA OD DNA (DLA AKCJI I KRYPTO) ===
      // ==========================================================
      const referencePrice = companyReferencePrices[companyId] || 50.00; 

      if (stocks.includes(companyId)) {
          // Logika dla Akcji (odbicie od 40% ceny ref)
          const supportLevelPrice = referencePrice * 0.40; 
          
          if (newPrice < supportLevelPrice && newPrice > 1.00) { 
              const recoveryChance = 0.25; // 25% szans na odbicie
              if (Math.random() < recoveryChance) {
                  const recoveryBoost = newPrice * 0.10; // Odbicie 10%
                  newPrice += recoveryBoost; 
                  console.log(`... ${companyId.toUpperCase()} (Akcja) ODBIJA SIĘ od dna (${supportLevelPrice.toFixed(2)} zł)! Boost: ${recoveryBoost.toFixed(2)} zł`);
              }
          }
      }
      else if (cryptos.includes(companyId)) {
          // NOWA LOGIKA: Logika dla Krypto (odbicie od 10% ceny ref)
          const supportLevelPrice = referencePrice * 0.10; // Krypto ma niższy próg, np. 10%

          if (newPrice < supportLevelPrice && newPrice > 1.00) {
              const recoveryChance = 0.40; // 40% szans na odbicie (częściej)
              if (Math.random() < recoveryChance) {
                  const recoveryBoost = newPrice * 0.25; // Odbicie 25% (mocniejsze)
                  newPrice += recoveryBoost;
                  console.log(`... ${companyId.toUpperCase()} (KRYPTO) ODBIJA SIĘ mocno od dna (${supportLevelPrice.toFixed(2)} zł)! Boost: ${recoveryBoost.toFixed(2)} zł`);
              }
          }
      }
      
      newPrice = Math.max(1.00, newPrice); // Utrzymaj minimum 1.00 (dla akcji i krypto)
      // ==========================================================
      // === KONIEC POPRAWKI ===
      // ==========================================================

      newPrices[companyId] = parseFloat(newPrice.toFixed(2));
    }

    // ZAPISZ wszystkie nowe ceny do bazy
    await cenyDocRef.set(newPrices, { merge: true }); // Użyj .set() z merge:true, aby nie usunąć starych cen
    console.log("Sukces! Zaktualizowano ceny:", newPrices);

    
    // ==========================================================
    // === NOWA LOGIKA ROZLICZANIA MECZÓW (OPCJA 3: ADMIN) ===
    // ==========================================================
    try {
        const meczSnap = await meczDocRef.get();
        
        // --- POPRAWKA BŁĘDU: Zmieniono .exists() na .exists ---
        if (meczSnap.exists) { 
            const matchData = meczSnap.data();
            
            // Szukamy meczu, który admin oznaczył jako "resolved",
            // ale którego my jeszcze nie przetworzyliśmy ("processed" == false)
            if (matchData.status === "resolved" && (matchData.processed === false || matchData.processed === undefined)) {
                
                console.log(`!!! Wykryto rozliczony mecz (Admin)! Zwycięzca: ${matchData.winner}`);
                
                // Użyj 'newPrices' jako fallbacku, jeśli 'currentPrices' nie ma
                const pricesForCalc = (Object.keys(newPrices).length > 0) ? newPrices : currentPrices;
                
                // 1. Rozlicz zakłady
                await processBets(matchData, matchData.winner, pricesForCalc);
                
                // 2. Oznacz mecz jako przetworzony, aby nie wypłacić wygranych ponownie
                await meczDocRef.update({ processed: true });
                
                console.log("!!! Pomyślnie rozliczono zakłady i oznaczono mecz jako 'processed'.");
            }
        }
    } catch (e) {
        console.error("Błąd podczas sprawdzania meczów (Admin):", e);
    }
    // === KONIEC LOGIKI MECZÓW ===


    // --- Przetwarzanie obligacji (Bez zmian) ---
    // Musi być wywołane z aktualnymi cenami, 'newPrices' są idealne
    await processBonds(newPrices);
    // --- KONIEC PRZETWARZANIA OBLIGACJI ---
    
    
    // --- Pętla po spółkach do REALIZACJI ZLECEŃ ---
    for (const companyId of allAssets) { // Używamy połączonej listy
        const finalPrice = newPrices[companyId];
        if (!finalPrice) continue;
        
        // 1. Szukaj zleceń KUPNA (Limit)
        // Zapytanie szuka teraz obu typów "KUPNO (Limit)" i "KUPNO (Limit, Krypto)"
        const buyOrdersQuery = limitOrdersRef
            .where("companyId", "==", companyId)
            .where("status", "==", "pending")
            .where("type", "in", ["KUPNO (Limit)", "KUPNO (Limit, Krypto)"]) 
            .where("limitPrice", ">=", finalPrice);
            
        const buyOrdersSnapshot = await buyOrdersQuery.get();
        if (!buyOrdersSnapshot.empty) {
            console.log(`... Znaleziono ${buyOrdersSnapshot.size} zleceń KUPNA do realizacji dla ${companyId} (Cena rynkowa: ${finalPrice})`);
            for (const orderDoc of buyOrdersSnapshot.docs) {
                try {
                    await db.runTransaction(async (transaction) => {
                        // Przekaż 'newPrices' do funkcji realizującej
                        await executeLimitOrder(transaction, orderDoc, finalPrice, newPrices);
                    });
                } catch (e) {
                    console.error(`BŁĄD Transakcji dla zlecenia ${orderDoc.id}:`, e.message);
                }
            }
        }
        
        // 2. Szukaj zleceń SPRZEDAŻY (Limit)
        const sellOrdersQuery = limitOrdersRef
            .where("companyId", "==", companyId)
            .where("status", "==", "pending")
            .where("type", "in", ["SPRZEDAŻ (Limit)", "SPRZEDAŻ (Limit, Krypto)"])
            .where("limitPrice", "<=", finalPrice);
            
        const sellOrdersSnapshot = await sellOrdersQuery.get();
        if (!sellOrdersSnapshot.empty) {
            console.log(`... Znaleziono ${sellOrdersSnapshot.size} zleceń SPRZEDAŻY do realizacji dla ${companyId} (Cena rynkowa: ${finalPrice})`);
             for (const orderDoc of sellOrdersSnapshot.docs) {
                try {
                    await db.runTransaction(async (transaction) => {
                        // Przekaż 'newPrices' do funkcji realizującej
                        await executeLimitOrder(transaction, orderDoc, finalPrice, newPrices);
                    });
                } catch (e) {
                    console.error(`BŁĄD Transakcji dla zlecenia ${orderDoc.id}:`, e.message);
                }
            }
        }
    }
    // --- KONIEC REALIZACJI ZLECEŃ ---
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // GŁÓWNA PĘTLA (3-godzinna)
  const mainLoop = async () => {
    const updatesPerRun = 180;      
    const intervalSeconds = 60;     

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
