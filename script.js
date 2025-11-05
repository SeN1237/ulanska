// Czekaj na załadowanie całej strony (DOM)
document.addEventListener("DOMContentLoaded", () => {

    // --- SEKCJA 1: USTAWIENIA I ZMIENNE GLOBALNE ---

    let user = {
        name: "Gracz",
        cash: 100.00,
        shares: 0,
        startValue: 100.00 // Do liczenia zysku
    };

    let company = {
        name: "ułańska.by",
        price: 50.00
    };

    // Zmienne dla wykresu
    let chart = null;
    let chartData = generateInitialCandles(30);

    // NOWOŚĆ: Zmienne dla plotek
    let currentSentimentTrend = 0.0; // Wpływ plotek na cenę
    const marketRumors = [
        { text: "CEO 'ułańska.by' ogłasza przełomową innowację!", sentiment: "positive" },
        { text: "Spółka wchodzi na nowy, lukratywny rynek azjatycki.", sentiment: "positive" },
        { text: "Słyszałem, że ich nowy produkt to hit. Kupować!", sentiment: "positive" },
        { text: "Duży fundusz inwestycyjny zainteresowany 'ułańska.by'.", sentiment: "positive" },
        { text: "KNF ma pewne wątpliwości co do sprawozdań finansowych...", sentiment: "negative" },
        { text: "Pożar w głównej fabryce! Produkcja wstrzymana.", sentiment: "negative" },
        { text: "Konkurencja wypuściła lepszy produkt za połowę ceny.", sentiment: "negative" },
        { text: "Prezes widziany, jak sprzedaje swoje akcje... Słabo to wygląda.", sentiment: "negative" },
    ];

    // Referencje do elementów HTML
    const dom = {
        username: document.getElementById("username"),
        cash: document.getElementById("cash"),
        shares: document.getElementById("shares"),
        sharesValue: document.getElementById("shares-value"),
        totalValue: document.getElementById("total-value"),
        totalProfit: document.getElementById("total-profit"),
        stockPrice: document.getElementById("stock-price"),
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        resetButton: document.getElementById("reset-button"),
        messageBox: document.getElementById("message-box"),
        chartContainer: document.getElementById("chart-container"),
        rumorsFeed: document.getElementById("rumors-feed")
    };

    // --- SEKCJA 2: GŁÓWNA LOGIKA APLIKACJI ---

    function init() {
        loadUserData();
        setupEventListeners();
        initChart();          // Uruchom wykres
        startPriceTicker();   // Uruchom silnik ceny (co 2s)
        startChartTicker();   // Uruchom silnik wykresu (co 5s)
        startRumorTicker();   // Uruchom silnik plotek (co 15s)
        updatePortfolioUI();  // Zaktualizuj UI na starcie
    }

    // Ładowanie/Zapisywanie danych (bez zmian)
    function loadUserData() {
        const savedData = localStorage.getItem("stockSimUser_v2"); // Nowy klucz, by uniknąć konfliktu
        if (savedData) {
            user = JSON.parse(savedData);
        } else {
            const newName = prompt("Witaj! Jak się nazywasz?", "Gracz");
            user.name = newName || "Gracz";
            saveUserData();
        }
    }

    function saveUserData() {
        localStorage.setItem("stockSimUser_v2", JSON.stringify(user));
    }

    // Ustawienie "nasłuchu" na przyciski
    function setupEventListeners() {
        dom.buyButton.addEventListener("click", buyShares);
        dom.sellButton.addEventListener("click", sellShares);
        dom.resetButton.addEventListener("click", resetAccount);
    }

    // --- SEKCJA 3: AKCJE UŻYTKOWNIKA (Kupno/Sprzedaż/Reset) ---

    function buyShares() {
        const amount = parseInt(dom.amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showMessage("Wpisz poprawną ilość.", "error"); return;
        }
        const cost = amount * company.price;
        if (cost > user.cash) {
            showMessage("Brak wystarczającej gotówki.", "error"); return;
        }
        user.cash -= cost;
        user.shares += amount;
        showMessage(`Kupiono ${amount} akcji za ${cost.toFixed(2)} zł`, "success");
        updateAndSave();
    }

    function sellShares() {
        const amount = parseInt(dom.amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showMessage("Wpisz poprawną ilość.", "error"); return;
        }
        if (amount > user.shares) {
            showMessage("Nie masz tylu akcji.", "error"); return;
        }
        const revenue = amount * company.price;
        user.cash += revenue;
        user.shares -= amount;
        showMessage(`Sprzedano ${amount} akcji za ${revenue.toFixed(2)} zł`, "success");
        updateAndSave();
    }

    function resetAccount() {
        if (confirm("Zresetować konto i zacząć od 100 zł?")) {
            localStorage.removeItem("stockSimUser_v2");
            location.reload(); 
        }
    }

    // --- SEKCJA 4: SYMULATOR RYNKU ---

    // Silnik 1: Główna cena (do transakcji), co 2 sekundy
    function startPriceTicker() {
        setInterval(() => {
            const volatility = 0.5; // Zwykła zmienność
            const baseTrend = 0.01;  // Lekki trend wzrostowy
            
            // Zmniejszaj wpływ plotki z czasem
            currentSentimentTrend *= 0.95; 

            // Sumuj trendy
            const totalTrend = baseTrend + currentSentimentTrend;
            
            const change = (Math.random() - 0.5) * 2 * volatility + totalTrend;
            let newPrice = company.price + change;
            
            company.price = Math.max(1.00, newPrice); // Cena nie spadnie poniżej 1 zł
            
            updatePriceUI();
            updatePortfolioUI();
        }, 2000);
    }

    // Silnik 2: Plotki rynkowe, co 15 sekund
    function startRumorTicker() {
        setInterval(() => {
            // Wybierz losową plotkę
            const rumor = marketRumors[Math.floor(Math.random() * marketRumors.length)];
            
            // Ustaw wpływ plotki na cenę
            if (rumor.sentiment === "positive") {
                currentSentimentTrend = 0.2; // Mocny, chwilowy "skok" w górę
            } else {
                currentSentimentTrend = -0.2; // Mocny, chwilowy "skok" w dół
            }

            // Wyświetl plotkę
            displayNewRumor(rumor.text, rumor.sentiment);

        }, 15000); // Nowa plotka co 15 sekund
    }

    // --- SEKCJA 5: WYKRES ŚWIECOWY (Logika bez zmian) ---

    // Generuje dane startowe dla wykresu
    function generateInitialCandles(count) {
        let data = [];
        let lastClose = 50;
        let timestamp = new Date().getTime() - (count * 5000);
        for (let i = 0; i < count; i++) {
            let open = lastClose;
            let close = open + (Math.random() - 0.5) * 4;
            let high = Math.max(open, close) + Math.random() * 2;
            let low = Math.min(open, close) - Math.random() * 2;
            close = Math.max(1, close);
            data.push({
                x: new Date(timestamp),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            });
            lastClose = close;
            timestamp += 5000;
        }
        return data;
    }

    // Inicjalizuje i rysuje wykres
    function initChart() {
        const options = {
            series: [{ data: chartData }],
            chart: {
                type: 'candlestick',
                height: 350,
                toolbar: { show: false },
                animations: { enabled: true, dynamicAnimation: { enabled: true, speed: 350 } }
            },
            theme: { mode: 'dark' }, // NOWOŚĆ: Dopasuj do ciemnego tła
            title: { text: 'Historia cen (świece 5-sekundowe)', align: 'left', style: { color: '#a3acb9' } },
            xaxis: { type: 'datetime', labels: { style: { colors: '#a3acb9' } } },
            yaxis: {
                tooltip: { enabled: true },
                labels: {
                    formatter: (val) => val.toFixed(2) + " zł",
                    style: { colors: '#a3acb9' }
                }
            },
            plotOptions: {
                candlestick: {
                    colors: { upward: '#28a745', downward: '#dc3545' }
                }
            }
        };
        chart = new ApexCharts(dom.chartContainer, options);
        chart.render();
    }

    // Silnik 3: Aktualizacja wykresu, co 5 sekund
    function startChartTicker() {
        setInterval(() => {
            const lastCandle = chartData[chartData.length - 1];
            const lastClose = parseFloat(lastCandle.y[3]);
            let open = lastClose;
            let close = open + (Math.random() - 0.5) * 4 + (currentSentimentTrend * 10); // Plotki też lekko wpływają na kształt świecy
            let high = Math.max(open, close) + Math.random() * 2;
            let low = Math.min(open, close) - Math.random() * 2;
            close = Math.max(1, close);

            const newCandle = {
                x: new Date(lastCandle.x.getTime() + 5000),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            };

            chartData.push(newCandle);
            if (chartData.length > 50) chartData.shift();
            
            chart.updateSeries([{ data: chartData }]);
        }, 5000);
    }

    // --- SEKCJA 6: AKTUALIZACJA INTERFEJSU (UI) ---

    // Odświeża tylko cenę
    function updatePriceUI() {
        const oldPrice = parseFloat(dom.stockPrice.textContent);
        dom.stockPrice.textContent = `${company.price.toFixed(2)} zł`;
        if (company.price > oldPrice) {
            dom.stockPrice.style.color = "var(--green)";
        } else if (company.price < oldPrice) {
            dom.stockPrice.style.color = "var(--red)";
        }
    }

    // Odświeża dane portfela
    function updatePortfolioUI() {
        dom.username.textContent = user.name;
        dom.cash.textContent = `${user.cash.toFixed(2)} zł`;
        dom.shares.textContent = `${user.shares} szt.`;
        
        const sharesValue = user.shares * company.price;
        const totalValue = user.cash + sharesValue;
        const totalProfit = totalValue - user.startValue;

        dom.sharesValue.textContent = `${sharesValue.toFixed(2)} zł`;
        dom.totalValue.textContent = `${totalValue.toFixed(2)} zł`;
        dom.totalProfit.textContent = `${totalProfit.toFixed(2)} zł`;

        // Zmiana koloru zysku
        if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
        else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
        else dom.totalProfit.style.color = "var(--text-muted)";
    }

    // Łączy aktualizację UI i zapis
    function updateAndSave() {
        updatePortfolioUI();
        saveUserData();
    }

    // Wyświetla komunikaty (o kupnie/błędach)
    function showMessage(message, type) {
        dom.messageBox.textContent = message;
        dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
        dom.amountInput.value = ""; // Czyść input
    }

    // Wyświetla nową plotkę
    function displayNewRumor(text, sentiment) {
        const p = document.createElement("p");
        p.textContent = text;
        p.style.color = (sentiment === "positive") ? "var(--green)" : "var(--red)";
        
        // Wstaw na górze listy
        dom.rumorsFeed.prepend(p);

        // Usuń stare plotki (zostaw tylko 5 ostatnich)
        if (dom.rumorsFeed.children.length > 5) {
            dom.rumorsFeed.removeChild(dom.rumorsFeed.lastChild);
        }
    }
    
    // --- START APLIKACJI ---
    init();
});
