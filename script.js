// Czekaj na załadowanie całej strony (DOM)
document.addEventListener("DOMContentLoaded", () => {

    // --- SEKCJA 1: USTAWIENIA I ZMIENNE GLOBALNE ---

    let user = {
        name: "Gracz",
        cash: 100.00,
        shares: 0
    };

    let company = {
        name: "ułańska.by",
        price: 50.00,
        history: [50.00]
    };

    // Zmienne globalne dla wykresu
    let chart = null;
    let chartData = generateInitialCandles(30); // Generujemy 30 startowych świec

    // Referencje do elementów HTML dla szybszego dostępu
    const dom = {
        username: document.getElementById("username"),
        cash: document.getElementById("cash"),
        shares: document.getElementById("shares"),
        totalValue: document.getElementById("total-value"),
        stockPrice: document.getElementById("stock-price"),
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        resetButton: document.getElementById("reset-button"),
        messageBox: document.getElementById("message-box")
    };

    // --- SEKCJA 2: GŁÓWNA LOGIKA APLIKACJI ---

    // Funkcja inicjująca (uruchamia się na starcie)
    function init() {
        loadUserData();
        setupEventListeners();
        initChart(); // Inicjalizacja wykresu
        startPriceTicker(); // Istniejący ticker (cena co 2s)
        startChartTicker(); // Ticker dla wykresu (świece co 5s)
        updateUI();
    }

    // Ładowanie danych użytkownika z localStorage
    function loadUserData() {
        const savedData = localStorage.getItem("stockSimUser");
        
        if (savedData) {
            user = JSON.parse(savedData);
        } else {
            // Jeśli nie ma danych, poproś o nazwę i zapisz stan początkowy
            const newName = prompt("Witaj w symulatorze! Jak się nazywasz?", "Gracz");
            user.name = newName || "Gracz"; // Ustaw domyślną nazwę, jeśli ktoś anuluje
            saveUserData();
        }
    }

    // Zapisywanie danych użytkownika w localStorage
    function saveUserData() {
        localStorage.setItem("stockSimUser", JSON.stringify(user));
    }

    // Ustawienie "nasłuchu" na przyciski
    function setupEventListeners() {
        dom.buyButton.addEventListener("click", buyShares);
        dom.sellButton.addEventListener("click", sellShares);
        dom.resetButton.addEventListener("click", resetAccount);
    }

    // --- SEKCJA 3: AKCJE UŻYTKOWNIKA ---

    function buyShares() {
        const amount = parseInt(dom.amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showMessage("Wpisz poprawną ilość akcji.", "error");
            return;
        }

        const cost = amount * company.price;
        if (cost > user.cash) {
            showMessage("Nie masz wystarczająco gotówki!", "error");
            return;
        }

        user.cash -= cost;
        user.shares += amount;

        showMessage(`Kupiono ${amount} akcji "ułańska.by" za ${cost.toFixed(2)} zł.`, "success");
        updateAndSave();
    }

    function sellShares() {
        const amount = parseInt(dom.amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showMessage("Wpisz poprawną ilość akcji.", "error");
            return;
        }

        if (amount > user.shares) {
            showMessage("Nie masz tylu akcji na sprzedaż!", "error");
            return;
        }

        const revenue = amount * company.price;
        user.cash += revenue;
        user.shares -= amount;

        showMessage(`Sprzedano ${amount} akcji za ${revenue.toFixed(2)} zł.`, "success");
        updateAndSave();
    }

    function resetAccount() {
        if (confirm("Czy na pewno chcesz zresetować konto? Utracisz wszystkie postępy.")) {
            localStorage.removeItem("stockSimUser");
            // Przeładuj stronę, aby zacząć od nowa
            location.reload(); 
        }
    }

    // --- SEKCJA 4: SYMULATOR RYNKU I AKTUALIZACJA UI ---

    // Istniejący ticker - on odpowiada za CENĘ AKTUALNĄ (do kupna/sprzedaży)
    function startPriceTicker() {
        setInterval(() => {
            const volatility = 0.5;
            const trend = 0.05;
            const change = (Math.random() - 0.5) * 2 * volatility + trend;
            let newPrice = company.price + change;
            company.price = Math.max(1.00, newPrice);
            
            // Aktualizuj tylko cenę i portfel, wykres ma swój ticker
            updatePriceUI();
            updatePortfolioUI();
        }, 2000); // Zmieniaj cenę co 2 sekundy
    }

    // Funkcja do generowania startowych danych do wykresu
    function generateInitialCandles(count) {
        let data = [];
        let lastClose = 50;
        let timestamp = new Date().getTime() - (count * 5000); // Zaczynamy w przeszłości

        for (let i = 0; i < count; i++) {
            let open = lastClose;
            let close = open + (Math.random() - 0.5) * 4;
            let high = Math.max(open, close) + Math.random() * 2;
            let low = Math.min(open, close) - Math.random() * 2;
            close = Math.max(1, close); // Nie pozwól cenie spaść poniżej 1
            
            data.push({
                x: new Date(timestamp),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            });
            
            lastClose = close;
            timestamp += 5000; // Każda świeca to 5 sekund
        }
        return data;
    }

    // Funkcja inicjalizująca wykres (uruchamiana raz w init())
    function initChart() {
        const options = {
            series: [{
                data: chartData
            }],
            chart: {
                type: 'candlestick',
                height: 250,
                toolbar: { show: false } // Ukrywamy domyślne menu
            },
            title: {
                text: 'Historia cen "ułańska.by" (świece 5-sekundowe)',
                align: 'left'
            },
            xaxis: {
                type: 'datetime' // Oś X to daty
            },
            yaxis: {
                tooltip: { enabled: true },
                labels: {
                    formatter: function (val) {
                        return val.toFixed(2) + " zł"; // Formatowanie osi Y
                    }
                }
            },
            plotOptions: {
                candlestick: {
                    colors: {
                        upward: '#28a745', // Kolor świecy wzrostowej
                        downward: '#dc3545' // Kolor świecy spadkowej
                    }
                }
            }
        };

        chart = new ApexCharts(document.querySelector("#chart-container"), options);
        chart.render();
    }

    // Ticker dla wykresu - on generuje NOWE ŚWIECE co 5 sekund
    function startChartTicker() {
        setInterval(() => {
            // Bierzemy ostatnią świecę jako punkt odniesienia
            const lastCandle = chartData[chartData.length - 1];
            const lastClose = parseFloat(lastCandle.y[3]); // Cena zamknięcia ostatniej świecy
            
            let open = lastClose;
            let close = open + (Math.random() - 0.5) * 4; // Nowa cena zamknięcia
            let high = Math.max(open, close) + Math.random() * 2;
            let low = Math.min(open, close) - Math.random() * 2;
            close = Math.max(1, close);

            const newCandle = {
                x: new Date(lastCandle.x.getTime() + 5000), // 5 sekund później
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            };

            // Dodaj nową świecę do danych
            chartData.push(newCandle);

            // Opcjonalnie: usuń stare dane, żeby wykres się nie zapchał
            if (chartData.length > 50) {
                chartData.shift(); // Usuwa pierwszą (najstarszą) świecę
            }

            // Aktualizuj wykres (serię danych)
            chart.updateSeries([{
                data: chartData
            }]);

        }, 5000); // Generuj nową świecę co 5 sekund
    }

    // Rozdzieliliśmy funkcję updateUI na dwie mniejsze
    function updateUI() {
        updatePriceUI();
        updatePortfolioUI();
    }

    // Aktualizuje tylko cenę akcji
    function updatePriceUI() {
        const oldPrice = parseFloat(dom.stockPrice.textContent);
        dom.stockPrice.textContent = company.price.toFixed(2);
        
        if (company.price > oldPrice) {
            dom.stockPrice.style.color = "#28a745"; // Zielony
        } else if (company.price < oldPrice) {
            dom.stockPrice.style.color = "#dc3545"; // Czerwony
        }
    }

    // Aktualizuje tylko dane portfela
    function updatePortfolioUI() {
        dom.username.textContent = user.name;
        dom.cash.textContent = user.cash.toFixed(2);
        dom.shares.textContent = user.shares;
        
        const totalValue = user.cash + (user.shares * company.price);
        dom.totalValue.textContent = totalValue.toFixed(2);
    }
    
    // Ta funkcja teraz łączy aktualizację UI i zapis danych
    function updateAndSave() {
        updatePortfolioUI();
        saveUserData();
    }

    // Mała funkcja do pokazywania powiadomień
    function showMessage(message, type) {
        dom.messageBox.textContent = message;
        dom.messageBox.style.color = (type === "error") ? "#dc3545" : "#28a745";
        
        // Wyczyść input po akcji
        dom.amountInput.value = "";
    }
    
    // Na koniec - uruchom funkcję inicjującą!
    init();

});
