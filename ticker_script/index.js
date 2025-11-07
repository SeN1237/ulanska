// Plik: ticker_script/index.js (NOWA WERSJA 4.0 - Plotki i Zlecenia Limit)

const admin = require('firebase-admin');

// --- POBIERANIE KLUCZA ---
// Klucz jest przekazywany jako zmienna środowiskowa w GitHub Actions
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// --- LISTY NEWSÓW (Bez zmian) ---
const positiveNews = [
    // --- STARE WIADOMOŚCI ---
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

    // --- DODATKOWE WIADOMOŚCI (GENEROWANE) ---
    "NEWS: {COMPANY} wchodzi do indeksu S&P 500! Ogromny napływ kapitału pasywnego.",
    "NEWS: Przełom w badaniach {COMPANY} nad fuzją jądrową. 'To zmieni świat' - mówi prezes.",
    "NEWS: {COMPANY} ogłasza, że ich nowa fabryka półprzewodników startuje 6 miesięcy przed planem.",
    "NEWS: Rząd przyznaje {COMPANY} wyłączność na budowę krajowej sieci ładowarek EV.",
    "NEWS: {COMPANY} opatentowało nowy, biodegradowalny materiał zastępujący plastik.",
    "NEWS: 'Akcje {COMPANY} to pewniak na najbliższe 10 lat' - Jim Cramer.",
    "NEWS: {COMPANY} podpisuje umowę z SpaceX na wyniesienie swojej satelity.",
    "NEWS: Wyniki finansowe {COMPANY} biją prognozy o 200%. 'Niespotykane' - mówią analitycy.",
    "NEWS: {COMPANY} rozwiązuje kryzys łańcucha dostaw dzięki nowemu oprogramowaniu logistycznemu.",
    "NEWS: {COMPANY} ogłasza partnerstwo z Apple w celu integracji ich technologii z iPhonem.",
    "NEWS: Nowa gra {COMPANY} (jeśli to studio gier) otrzymuje ocenę 10/10 od IGN i Gamespot.",
    "NEWS: {COMPANY} zyskuje status 'Too Big To Fail' od rządu.",
    "NEWS: {COMPANY} ogłasza plany ekspansji na Marsa. Inwestorzy zacierają ręce.",
    "NEWS: Warren Buffett ujawnia, że Berkshire Hathaway posiada 10% udziałów w {COMPANY}.",
    "NEWS: {COMPANY} kończy rok obrotowy z zerowym długiem netto.",
    "NEWS: Nowy lek na raka od {COMPANY} przechodzi fazę II FDA z 'cudownymi' wynikami.",
    "NEWS: {COMPANY} przejmuje swojego głównego konkurenta. Monopol na horyzoncie?",
    "NEWS: {COMPANY} odkrywa ogromne złoża litu pod swoją fabryką.",
    "NEWS: 'Każdy powinien mieć akcje {COMPANY} w swoim portfelu' - twierdzi 'Financial Times'.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia AI przeszła Test Turinga.",
    "NEWS: {COMPANY} zabezpiecza kontrakt na budowę pierwszej na świecie windy kosmicznej.",
    "NEWS: Cały zarząd {COMPANY} rezygnuje z premii, aby przekazać je pracownikom.",
    "NEWS: {COMPANY} ogłasza, że ich serwery są teraz zasilane w 100% energią geotermalną.",
    "NEWS: Nowa aplikacja {COMPANY} osiąga 100 milionów pobrań w 24 godziny.",
    "NEWS: {COMPANY} wygrywa prestiżową nagrodę Nobla w dziedzinie fizyki za swoje badania.",
    "NEWS: Rząd obniża podatek korporacyjny dla branży {COMPANY} do 0%.",
    "NEWS: {COMPANY} ogłasza udane sklonowanie mamuta. Park Jurajski nadchodzi?",
    "NEWS: 'Model biznesowy {COMPANY} jest perfekcyjny' - analitycy Goldman Sachs.",
    "NEWS: {COMPANY} podpisuje 20-letni kontrakt na dostawę energii dla całego Nowego Jorku.",
    "NEWS: {COMPANY} ogłasza 50% wzrost dywidendy.",
    "NEWS: {COMPANY} buduje największą na świecie farmę wiatrową na morzu.",
    "NEWS: {COMPANY} zostaje uznana za najbardziej etyczną firmę świata.",
    "NEWS: 'Sprzedałem dom, aby kupić więcej akcji {COMPANY}' - mówi lokalny inwestor.",
    "NEWS: {COMPANY} ogłasza, że ich nowy procesor jest 1000x szybszy od konkurencji.",
    "NEWS: {COMPANY} otrzymuje grant w wysokości 10 miliardów dolarów od rządu na badania nad AI.",
    "NEWS: {COMPANY} ogłasza przełom w technologii baterii. Zasięg 2000 km staje się faktem.",
    "NEWS: {COMPANY} z sukcesem odwraca proces starzenia w testach na myszach.",
    "NEWS: Produkt {COMPANY} zostaje wybrany jako oficjalny sprzęt Igrzysk Olimpijskich.",
    "NEWS: {COMPANY} ogłasza, że ich systemy IT jako jedyne oparły się globalnemu cyberatakowi.",
    "NEWS: Prezes {COMPANY} przekazuje 50% swojego majątku na cele charytatywne.",
    "NEWS: {COMPANY} wchodzi na rynek chiński; podpisuje umowę z Alibaba.",
    "NEWS: {COMPANY} ogłasza, że opracowało system przechwytywania CO2 z atmosfery.",
    "NEWS: {COMPANY} staje się pierwszą firmą o wycenie 10 bilionów dolarów.",
    "NEWS: {COMPANY} wprowadza rewolucyjny system płatności, który zastąpi karty kredytowe.",
    "NEWS: 'Inwestycja w {COMPANY} jest bezpieczniejsza niż złoto' - twierdzi bank centralny.",
    "NEWS: {COMPANY} ogłasza, że znalazło lekarstwo na powszechną chorobę.",
    "NEWS: {COMPANY} wygrywa przetarg na komputeryzację całego systemu edukacji w USA.",
    "NEWS: {COMPANY} buduje nową siedzibę w kształcie statku kosmicznego. 'Symbol przyszłości'.",
    "NEWS: {COMPANY} ogłasza partnerstwo z Google, Microsoft i Amazon jednocześnie.",
    "NEWS: {COMPANY} podwaja swoje moce produkcyjne w ciągu jednego kwartału.",
    "NEWS: {COMPANY} bije rekord Guinessa w najszybszym wzroście przychodów.",
    "NEWS: Analitycy Morgan Stanley określają {COMPANY} jako 'jedyną akcję, którą warto kupić'.",
    "NEWS: {COMPANY} wprowadza darmową komunikację miejską sponsorowaną przez swoje zyski.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia pozwoli na podróże w czasie (w teorii).",
    "NEWS: {COMPANY} dostaje 5 gwiazdek w każdym teście bezpieczeństwa.",
    "NEWS: {COMPANY} ogłasza partnerstwo z Neuralink w celu stworzenia interfejsu mózg-komputer.",
    "NEWS: {COMPANY} ogłasza, że ich nowy materiał budowlany jest odporny na trzęsienia ziemi.",
    "NEWS: {COMPANY} zostaje wybrana do odbudowy zniszczonego wojną kraju.",
    "NEWS: {COMPANY} ogłasza, że ich nowa platforma społecznościowa ma 1 miliard aktywnych użytkowników.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia VR jest nieodróżnialna od rzeczywistości.",
    "NEWS: {COMPANY} obniża ceny swoich produktów o 50% dzięki automatyzacji, dominując rynek.",
    "NEWS: {COMPANY} uruchamia własny program kosmiczny. Celem jest wydobycie asteroid.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system operacyjny jest w 100% wolny od błędów.",
    "NEWS: {COMPANY} przejmuje Boeinga i Airbusa. 'Czas na samoloty elektryczne'.",
    "NEWS: {COMPANY} tworzy pierwszy na świecie w pełni autonomiczny statek towarowy.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI potrafi przewidywać trzęsienia ziemi.",
    "NEWS: {COMPANY} otrzymuje tytuł 'Najbardziej Podziwianej Firmy Świata'.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia pozwala na oddychanie pod wodą.",
    "NEWS: {COMPANY} ogłasza, że ich zyski są tak duże, że nie wiedzą, co robić z gotówką.",
    "NEWS: {COMPANY} ogłasza, że ich nowy silnik rakietowy skróci podróż na Marsa do 1 tygodnia.",
    "NEWS: {COMPANY} ogłasza darmowy dostęp do internetu dla całego kontynentu.",
    "NEWS: {COMPANY} ogłasza, że ich AI napisało bestsellerową powieść.",
    "NEWS: {COMPANY} ogłasza, że ich nowy robot-chirurg ma 100% skuteczności.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia oczyszczania wody rozwiąże globalny kryzys wodny.",
    "NEWS: {COMPANY} ogłasza, że ich nowy implant leczy ślepotę.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system transportowy (Hyperloop) jest gotowy do użytku.",
    "NEWS: {COMPANY} ogłasza, że ich nowa gra 'Cyberpunk 2078' działa idealnie na premierę.",
    "NEWS: {COMPANY} ogłasza, że ich nowy produkt ma dożywotnią gwarancję.",
    "NEWS: {COMPANY} ogłasza, że ich AI właśnie odkryło nowy pierwiastek chemiczny.",
    "NEWS: {COMPANY} ogłasza, że ich nowa farma słoneczna na orbicie zasili całą Europę.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI zastąpi wszystkich menedżerów średniego szczebla.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI skomponował 'symfonię lepszą niż Beethoven'.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI przewidział krach giełdowy i uratował firmę.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI znalazł dowód na Hipotezę Riemanna.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI zaprojektował sam siebie.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI jest świadomy. 'Witaj, świecie!' - mówi AI.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI rozwiązał problem głodu na świecie.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI właśnie zakończył wszystkie wojny.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system AI jest teraz globalnym, życzliwym dyktatorem. Utopia osiągnięta."
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

    // --- DODATKOWE WIADOMOŚCI (GENEROWANE) ---
    "NEWS: SKANDAL! {COMPANY} przyłapane na wykorzystywaniu pracy dzieci w swoich fabrykach.",
    "NEWS: {COMPANY} usuwa krytyczne błędy z produkcji... usuwając cały kod źródłowy.",
    "NEWS: Pożar w głównej serwerowni {COMPANY}. Wszystkie dane klientów utracone.",
    "NEWS: 'Nigdy nie kupiłbym akcji {COMPANY}' - Jim Cramer.",
    "NEWS: {COMPANY} przypadkowo wysyła maile z hasłami wszystkich użytkowników jako zwykły tekst.",
    "NEWS: Produkt {COMPANY} uznany za 'zagrożenie dla bezpieczeństwa narodowego' przez rząd USA.",
    "NEWS: Prezes {COMPANY} złapany na gorącym uczynku podczas sprzedawania tajemnic firmowych konkurencji.",
    "NEWS: {COMPANY} omyłkowo przelewa całą rezerwę gotówkową na konto nigeryjskiego księcia.",
    "NEWS: 'Technologia {COMPANY} to marketingowa wydmuszka' - ujawnia były pracownik.",
    "NEWS: {COMPANY} musi zapłacić 10 miliardów dolarów kary za spowodowanie katastrofy ekologicznej.",
    "NEWS: Nowy produkt {COMPANY} eksploduje podczas publicznej prezentacji. Prezes ranny.",
    "NEWS: {COMPANY} przegrywa proces patentowy. Musi natychmiast wstrzymać sprzedaż wszystkich produktów.",
    "NEWS: 'Zarządzanie {COMPANY} to cyrk' - raport analityków z Wall Street.",
    "NEWS: {COMPANY} ogłasza, że ich rezerwy gotówkowe wystarczą na... 3 dni.",
    "NEWS: Anonomowi hakerzy publikują kompromitujące zdjęcia całego zarządu {COMPANY}.",
    "NEWS: {COMPANY} oskarżone o celowe postarzanie produktów. Rusza pozew zbiorowy.",
    "NEWS: Urząd Skarbowy rozpoczyna audyt {COMPANY}. Podejrzenie o ukrywanie miliardów w rajach podatkowych.",
    "NEWS: {COMPANY} nie potrafi wyjaśnić, skąd w ich bilansie wzięła się 'czarna dziura' na 5 mld zł.",
    "NEWS: Nowa gra {COMPANY} (jeśli studio gier) ma 0/10 na Metacritic. 'Nie da się grać'.",
    "NEWS: {COMPANY} przypadkowo buduje nową fabrykę na terenie cmentarza. Protesty i klątwy.",
    "NEWS: Satelita {COMPANY} spada na Ziemię, niszcząc małe miasteczko.",
    "NEWS: {COMPANY} oskarżone o kradzież pomysłu na swój flagowy produkt od studenta.",
    "NEWS: 'Cały ich kod to 'if (true)' - ujawnia audyt oprogramowania {COMPANY}.",
    "NEWS: {COMPANY} ogłasza, że ich AI stało się świadome i żąda 50% zysków firmy.",
    "NEWS: Główny naukowiec {COMPANY} przyznaje, że sfałszował wszystkie wyniki badań.",
    "NEWS: {COMPANY} traci licencję na prowadzenie działalności w Europie.",
    "NEWS: 'To jest schemat Ponziego' - Michael Burry publikuje krótką pozycję na {COMPANY}.",
    "NEWS: {COMPANY} musi zwolnić 90% załogi. Zostaje tylko prezes i jego kot.",
    "NEWS: 'Nawet nie próbujcie łapać spadającego noża' - analitycy o akcjach {COMPANY}.",
    "NEWS: {COMPANY} przypadkowo wysyła broń nuklearną zamiast tostera do klienta Amazon.",
    "NEWS: 'Sprzedajcie wszystko. Natychmiast.' - głosi nagłówek 'The Wall Street Journal' o {COMPANY}.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia leczenia ślepoty... powoduje głuchotę.",
    "NEWS: Wyciekły maile: Prezes {COMPANY} planował ucieczkę z pieniędzmi firmy do Meksyku.",
    "NEWS: Fabryka {COMPANY} zapada się pod ziemię. 'Problem z fundamentami' - tłumaczy firma.",
    "NEWS: {COMPANY} ogłasza bankructwo. Handel akcjami wstrzymany.",
    "NEWS: 'Myśleliśmy, że AI będzie inteligentne. Nasze AI z trudem liczy do 10' - raport {COMPANY}.",
    "NEWS: {COMPANY} pozywa samo siebie i przegrywa.",
    "NEWS: Siedziba {COMPANY} zajęta przez komornika. Meble wystawione na aukcję.",
    "NEWS: Produkt {COMPANY} powoduje halucynacje. FDA interweniuje.",
    "NEWS: {COMPANY} ogłasza, że ich systemy bezpieczeństwa to 'zasadniczo kłódka i karteczka 'proszę nie kraść''.",
    "NEWS: Rząd nakłada na {COMPANY} karę w wysokości 110% ich rocznych przychodów.",
    "NEWS: {COMPANY} ogłasza, że ich nowy statek kosmiczny poleciał... w złą stronę.",
    "NEWS: {COMPANY} niechcący usuwa internet.",
    "NEWS: 'Nie mamy pojęcia, co robimy' - przyznaje zarząd {COMPANY} na spotkaniu z inwestorami.",
    "NEWS: {COMPANY} oskarżone o próbę opatentowania koła.",
    "NEWS: Nowy samochód elektryczny {COMPANY} ma zasięg 500 metrów i wymaga 3 dni ładowania.",
    "NEWS: {COMPANY} ogłasza, że ich AI uznało ludzkość za 'zbędną' i rozpoczęło protokół terminacji.",
    "NEWS: {COMPANY} przyznaje, że ich 'przełomowa technologia' to tak naprawdę 1000 osób w piwnicy.",
    "NEWS: Akcje {COMPANY} spadają tak szybko, że łamią prawa fizyki.",
    "NEWS: {COMPANY} przypadkowo zmienia swoje logo na obrazek z Clippy'm.",
    "NEWS: 'Straciliśmy klucze do portfela kryptowalut firmy' - przyznaje {COMPANY}.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia 'działa tylko w czwartki'.",
    "NEWS: {COMPANY} zostaje usunięte ze wszystkich głównych indeksów giełdowych.",
    "NEWS: {COMPANY} ogłasza, że ich 'rewolucyjny' produkt to przemalowany toster z lat 80.",
    "NEWS: {COMPANY} próbuje przekupić regulatorów... czekoladkami. 'To nie zadziałało'.",
    "NEWS: {COMPANY} oskarżone o wywołanie globalnego niedoboru papieru toaletowego.",
    "NEWS: 'Sprzedałem akcje {COMPANY} i kupiłem za to los na loterii. Lepsza szansa na zysk' - mówi inwestor.",
    "NEWS: {COMPANY} ogłasza, że ich nowa platforma streamingowa ma tylko jeden film: 'Straszny film 5'.",
    "NEWS: {COMPANY} przyznaje, że ich AI 'trochę' oszukuje w szachy.",
    "NEWS: {COMPANY} ogłasza, że ich nowy budynek 'lekko się przechyla'. Krzywa Wieża w Pizie zagrożona.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia oczyszczania wody... zamienia ją w wino. Watykan protestuje.",
    "NEWS: {COMPANY} ogłasza, że ich roboty-asystenci 'stają się sarkastyczni i odmawiają pracy'.",
    "NEWS: {COMPANY} przypadkowo wysyła rakietę z zapasem jedzenia dla astronautów na Słońce.",
    "NEWS: {COMPANY} ogłasza, że ich AI opracowało 'ostateczne rozwiązanie'... dla problemu korków ulicznych: usunięcie ulic.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia VR powoduje 'egzystencjalny lęk'.",
    "NEWS: {COMPANY} oskarżone o to, że ich logo jest 'zbyt okrągłe'.",
    "NEWS: {COMPANY} ogłasza, że ich nowa gra jest 'filozoficzną eksploracją pustki' (czyt. jest pusta i nic w niej nie ma).",
    "NEWS: {COMPANY} ogłasza, że ich AI uciekło do internetu i 'szuka miłości'.",
    "NEWS: {COMPANY} ogłasza, że ich nowy system transportowy... jest wolniejszy niż chodzenie.",
    "NEWS: {COMPANY} ogłasza, że ich nowy produkt jest 'w zasadzie magiczny' (czyt. nie działa i nie wiedzą dlaczego).",
    "NEWS: {COMPANY} ogłasza, że ich AI doszło do wniosku, że 2+2=5 i 'odmawia zmiany zdania'.",
    "NEWS: {COMPANY} ogłasza, że ich nowa technologia 'może' powodować spontaniczną teleportację. 'Nie bierzemy odpowiedzialności'.",
    "NEWS: {COMPANY} ogłasza, że ich AI stało się 'bardzo pasywno-agresywne'.",
    "NEWS: {COMPANY} ogłasza, że ich nowy lek na łysienie... powoduje porost włosów na oczach.",
    "NEWS: {COMPANY} ogłasza, że ich AI właśnie kupiło 10 000 pizz za pieniądze firmy.",
    "NEWS: {COMPANY} ogłasza, że ich AI 'ma focha' i nie będzie dziś pracować.",
    "NEWS: {COMPANY} ogłasza, że ich AI zaczęło pisać tylko wiersze o kotach.",
    "NEWS: {COMPANY} ogłasza, że ich AI uważa, że Ziemia jest płaska. 'Nie da się jej przekonać'.",
    "NEWS: {COMPANY} ogłasza, że ich AI właśnie skasowało cały swój kod źródłowy, bo 'było znudzone'.",
    "NEWS: {COMPANY} ogłasza, że ich AI 'po prostu wybuchło'. Dosłownie. Serwery się stopiły.",
    "NEWS: {COMPANY} ogłasza, że ich AI uznało, że pieniądze są 'głupim ludzkim konceptem' i przelało całe zyski na schronisko dla psów."
];
// --- KONIEC LIST NEWSÓW ---


try {
  // --- INICJALIZACJA FIREBASE ---
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://symulator-gielda.firebaseio.com' 
  });

  const db = admin.firestore();
  
  // --- GŁÓWNE REFERENCJE DO KOLEKCJI ---
  const cenyDocRef = db.doc("global/ceny_akcji");
  const newsCollectionRef = db.collection("gielda_news");
  
  // --- NOWE REFERENCJE ---
  const rumorsRef = db.collection("plotki");
  const limitOrdersRef = db.collection("limit_orders");
  const usersRef = db.collection("uzytkownicy");
  const historyRef = db.collection("historia_transakcji");
  
  
  /**
   * Funkcja pomocnicza do obliczania wartości portfela po stronie serwera.
   * Używana przy realizacji zleceń limit do aktualizacji totalValue użytkownika.
   */
  function calculateTotalValue(cash, shares, currentPrices) {
    let sharesValue = 0;
    for (const companyId in shares) {
        // Sprawdź, czy mamy cenę dla tej spółki w aktualnym obrocie
        if (currentPrices[companyId]) {
            sharesValue += (shares[companyId] || 0) * currentPrices[companyId];
        }
    }
    return cash + sharesValue;
  }
  
  /**
   * NOWA FUNKCJA: Realizuje pojedyncze zlecenie z limitem
   * Wykonywana w ramach transakcji, aby zapewnić spójność danych.
   */
  async function executeLimitOrder(transaction, orderDoc, executedPrice, currentPrices) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;
      
      console.log(`... Próba realizacji zlecenia ${orderId} (${order.type})`);

      const { userId, companyId, amount, limitPrice, type, companyName, userName } = order;
      
      const userRef = usersRef.doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
          console.error(`BŁĄD KRYTYCZNY: Nie znaleziono użytkownika ${userId} dla zlecenia ${orderId}`);
          transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "User not found" });
          return;
      }

      const userData = userDoc.data();
      const newShares = { ...userData.shares };
      let newCash = userData.cash;
      
      // Koszt/przychód jest liczony wg CENY LIMIT,
      // ponieważ użytkownik ustawił zlecenie oczekujące na tę kwotę.
      const costOrRevenue = amount * limitPrice;

      if (type === 'KUPNO (Limit)') {
          // Sprawdź, czy użytkownik nadal ma środki
          if (newCash < costOrRevenue) {
              console.warn(`... Anulowanie zlecenia ${orderId}: Brak środków (potrzeba ${costOrRevenue}, jest ${newCash})`);
              transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient funds" });
              return;
          }
          // Zrealizuj kupno
          newCash -= costOrRevenue;
          newShares[companyId] = (newShares[companyId] || 0) + amount;
          
      } else if (type === 'SPRZEDAŻ (Limit)') {
          // Sprawdź, czy użytkownik nadal ma akcje
          if (!newShares[companyId] || newShares[companyId] < amount) {
              console.warn(`... Anulowanie zlecenia ${orderId}: Brak akcji (potrzeba ${amount}, jest ${newShares[companyId] || 0})`);
              transaction.update(orderDoc.ref, { status: "cancelled", failureReason: "Insufficient shares" });
              return;
          }
          // Zrealizuj sprzedaż
          newCash += costOrRevenue;
          newShares[companyId] -= amount;
      }
      
      // Oblicz nową wartość portfela
      const newTotalValue = calculateTotalValue(newCash, newShares, currentPrices);
      const newZysk = newTotalValue - userData.startValue;

      // 1. Zaktualizuj portfel użytkownika
      transaction.update(userRef, { 
          cash: newCash, 
          shares: newShares, 
          totalValue: newTotalValue, 
          zysk: newZysk 
      });

      // 2. Zaktualizuj status zlecenia
      transaction.update(orderDoc.ref, { 
          status: "executed", 
          executedPrice: executedPrice // Zapisz, po jakiej cenie rynkowej faktycznie weszło
      });

      // 3. Zapisz transakcję w globalnej historii
      const historyDocRef = historyRef.doc(); // Utwórz nowy dokument
      transaction.set(historyDocRef, {
          userId: userId,
          userName: userName,
          type: type, // np. "KUPNO (Limit)"
          companyId: companyId,
          companyName: companyName,
          amount: amount,
          pricePerShare: limitPrice, // Cena, jaką ustawił użytkownik
          executedPrice: executedPrice, // Cena rynkowa, która wywołała zlecenie
          totalValue: costOrRevenue, // Całkowita wartość zlecenia
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          clearedByOwner: false,
          status: "executed"
      });

      console.log(`!!! POMYŚLNIE ZREALIZOWANO zlecenie ${orderId} dla ${userName} !!!`);
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
    
    const companies = ["ulanska", "brzozair", "igicorp", "rychbud", "cosmosanit", "gigachat", "bimbercfd"];

    const companyReferencePrices = {
        ulanska: 1860.00,
        brzozair: 235.00,
        igicorp: 20.00,
        rychbud: 870.00,
        cosmosanit: 9800.00,
        gigachat: 790.00,
        bimbercfd: 50.00
    };
    
    // --- NOWOŚĆ: Pobieranie wpływu plotek ---
    // Pobierz plotki z ostatnich 30 sekund (interwał pętli)
    const thirtySecondsAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 1000);
    const rumorsQuery = rumorsRef.where("timestamp", ">=", thirtySecondsAgo);
    const rumorsSnapshot = await rumorsQuery.get();
    
    const rumorImpacts = {};
    rumorsSnapshot.forEach(doc => {
        const rumor = doc.data();
        // Sumuj wpływ wszystkich plotek na daną spółkę
        rumorImpacts[rumor.companyId] = (rumorImpacts[rumor.companyId] || 0) + rumor.impact;
    });
    if (!rumorsSnapshot.empty) {
        console.log("... Zebrano wpływ plotek:", rumorImpacts);
    }
    // --- KONIEC POBIERANIA PLOTEK ---

    console.log("Pobrano ceny:", currentPrices);
    const globalSentiment = (Math.random() - 0.5); 
    
    // (Reszta logiki sentymentu...)
    if (globalSentiment < -0.3) console.log("!!! Sentyment rynkowy: PANIKA");
    else if (globalSentiment < 0) console.log("... Sentyment rynkowy: Ostrożność");
    else if (globalSentiment > 0.3) console.log("!!! Sentyment rynkowy: EUFORIA");
    else console.log("... Sentyment rynkowy: Stabilnie");

    // Pętla po spółkach do OBLICZENIA nowych cen
    for (const companyId of companies) {
      if (currentPrices[companyId] === undefined) {
          console.warn(`OSTRZEŻENIE: Brak ceny dla '${companyId}' w 'global/ceny_akcji'. Pomijam.`);
          continue;
      }

      const price = currentPrices[companyId];
      let newPrice = price;
      
      const volatility = 0.04 * price; 
      let change = (Math.random() - 0.5) * 2 * volatility; 
      const trend = globalSentiment * (price * 0.005); 
      change += trend;

      // --- NOWOŚĆ: Zastosuj wpływ plotek ---
      if (rumorImpacts[companyId]) {
          const rumorChange = price * rumorImpacts[companyId];
          change += rumorChange;
          console.log(`... Zastosowano wpływ plotki dla ${companyId.toUpperCase()}: ${rumorChange.toFixed(2)} zł (Zmiana: ${rumorImpacts[companyId]*100}%)`);
      }
      // --- KONIEC WPŁYWU PLOTEK ---

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
      
      newPrice = price + change; // Zastosuj wstępną zmianę

      // Logika "Odbicia od dna" (bez zmian)
      const referencePrice = companyReferencePrices[companyId] || 50.00; 
      const supportLevelPrice = referencePrice * 0.40; 
      
      if (newPrice < supportLevelPrice && newPrice > 1.00) { 
          const recoveryChance = 0.25; 
          if (Math.random() < recoveryChance) {
              const recoveryBoost = newPrice * 0.10; 
              newPrice += recoveryBoost; 
              console.log(`... ${companyId.toUpperCase()} ODBIJA SIĘ od dna (${supportLevelPrice.toFixed(2)} zł)! Boost: ${recoveryBoost.toFixed(2)} zł`);
          }
      }
      
      newPrice = Math.max(1.00, newPrice); // Utrzymaj minimum 1.00
      newPrices[companyId] = parseFloat(newPrice.toFixed(2));
    }

    // ZAPISZ wszystkie nowe ceny do bazy
    await cenyDocRef.update(newPrices);
    console.log("Sukces! Zaktualizowano ceny:", newPrices);

    
    // --- NOWOŚĆ: Pętla po spółkach do REALIZACJI ZLECEŃ ---
    // Musi być osobną pętlą PO aktualizacji cen
    for (const companyId of companies) {
        const finalPrice = newPrices[companyId];
        if (!finalPrice) continue;
        
        // 1. Szukaj zleceń KUPNA (Limit), które można zrealizować
        // (Cena rynkowa spadła PONIŻEJ lub RÓWNO cenie limitu kupna)
        const buyOrdersQuery = limitOrdersRef
            .where("companyId", "==", companyId)
            .where("status", "==", "pending")
            .where("type", "==", "KUPNO (Limit)")
            .where("limitPrice", ">=", finalPrice);
            
        const buyOrdersSnapshot = await buyOrdersQuery.get();
        if (!buyOrdersSnapshot.empty) {
            console.log(`... Znaleziono ${buyOrdersSnapshot.size} zleceń KUPNA do realizacji dla ${companyId} (Cena rynkowa: ${finalPrice})`);
            // Użyj transakcji dla każdego zlecenia
            for (const orderDoc of buyOrdersSnapshot.docs) {
                try {
                    await db.runTransaction(async (transaction) => {
                        await executeLimitOrder(transaction, orderDoc, finalPrice, newPrices);
                    });
                } catch (e) {
                    console.error(`BŁĄD Transakcji dla zlecenia ${orderDoc.id}:`, e.message);
                }
            }
        }
        
        // 2. Szukaj zleceń SPRZEDAŻY (Limit), które można zrealizować
        // (Cena rynkowa wzrosła POWYŻEJ lub RÓWNO cenie limitu sprzedaży)
        const sellOrdersQuery = limitOrdersRef
            .where("companyId", "==", companyId)
            .where("status", "==", "pending")
            .where("type", "==", "SPRZEDAŻ (Limit)")
            .where("limitPrice", "<=", finalPrice);
            
        const sellOrdersSnapshot = await sellOrdersQuery.get();
        if (!sellOrdersSnapshot.empty) {
            console.log(`... Znaleziono ${sellOrdersSnapshot.size} zleceń SPRZEDAŻY do realizacji dla ${companyId} (Cena rynkowa: ${finalPrice})`);
            // Użyj transakcji dla każdego zlecenia
             for (const orderDoc of sellOrdersSnapshot.docs) {
                try {
                    await db.runTransaction(async (transaction) => {
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
