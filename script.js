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
        history: [50.00] // Na przyszłość pod wykresy
    };

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
        startPriceTicker();
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

    // Główny "silnik" symulacji - zmienia cenę co 2 sekundy
    function startPriceTicker() {
        setInterval(() => {
            // Prosty algorytm zmiany ceny (losowość)
            const volatility = 0.5; // Jak bardzo cena może się wahać
            const trend = 0.05;     // Lekki trend wzrostowy, żeby było "weselej" :)
            
            // Losowa zmiana od -volatility do +volatility, plus lekki trend
            const change = (Math.random() - 0.5) * 2 * volatility + trend;
            let newPrice = company.price + change;

            // Nie pozwól, by cena spadła poniżej 1 zł
            company.price = Math.max(1.00, newPrice); 
            
            // Aktualizuj UI po zmianie ceny
            updateUI();
        }, 2000); // Zmieniaj cenę co 2 sekundy (2000ms)
    }

    // Funkcja odświeżająca wszystkie dane na stronie
    function updateUI() {
        // Aktualizuj cenę i jej kolor
        const oldPrice = parseFloat(dom.stockPrice.textContent);
        dom.stockPrice.textContent = company.price.toFixed(2);
        
        if (company.price > oldPrice) {
            dom.stockPrice.style.color = "#28a745"; // Zielony
        } else if (company.price < oldPrice) {
            dom.stockPrice.style.color = "#dc3545"; // Czerwony
        }

        // Aktualizuj dane użytkownika
        dom.username.textContent = user.name;
        dom.cash.textContent = user.cash.toFixed(2);
        dom.shares.textContent = user.shares;
        
        // Oblicz i pokaż całkowitą wartość portfela
        const totalValue = user.cash + (user.shares * company.price);
        dom.totalValue.textContent = totalValue.toFixed(2);
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
