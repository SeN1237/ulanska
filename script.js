document.addEventListener("DOMContentLoaded", () => {

    // --- SEKCJA 0: KONFIGURACJA FIREBASE ---

    // POPRAWKA: Ten obiekt zawiera już TWOJE klucze.
    const firebaseConfig = {
      apiKey: "AIzaSyCeu3hDfVKNirhJHk1HbqaFjtf_L3v3sd0",
      authDomain: "symulator-gielda.firebaseapp.com",
      projectId: "symulator-gielda",
      storageBucket: "symulator-gielda.firebasestorage.app",
      messagingSenderId: "407270570707",
      appId: "1:407270570707:web:ffd8c24dd1c8a1c137b226",
      measurementId: "G-BXPWNE261F"
    };
    
    // Inicjalizacja Firebase (używa skryptów "compat" z index.html)
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();


    // --- SEKCJA 1: ZMIENNE GLOBALNE I REFERENCJE DOM ---

    let company = { price: 50.00 };
    
    let portfolio = {
        name: "Gość",
        cash: 0,
        shares: 0,
        startValue: 100
    };
    
    let chart = null;
    let chartData = generateInitialCandles(30);

    let currentUserId = null;
    let unsubscribePortfolio = null;
    let unsubscribeRumors = null;

    // Referencje do elementów HTML
    const dom = {
        // Kontenery widoków
        authContainer: document.getElementById("auth-container"),
        simulatorContainer: document.getElementById("simulator-container"),
        
        // Formularze autentykacji
        loginForm: document.getElementById("login-form"),
        registerForm: document.getElementById("register-form"),
        authMessage: document.getElementById("auth-message"),
        
        // Elementy symulatora
        username: document.getElementById("username"),
        logoutButton: document.getElementById("logout-button"),
        cash: document.getElementById("cash"),
        shares: document.getElementById("shares"),
        sharesValue: document.getElementById("shares-value"),
        totalValue: document.getElementById("total-value"),
        totalProfit: document.getElementById("total-profit"),
        stockPrice: document.getElementById("stock-price"),
        amountInput: document.getElementById("amount-input"),
        buyButton: document.getElementById("buy-button"),
        sellButton: document.getElementById("sell-button"),
        messageBox: document.getElementById("message-box"),
        chartContainer: document.getElementById("chart-container"),
        
        // Panel plotek
        rumorForm: document.getElementById("rumor-form"),
        rumorInput: document.getElementById("rumor-input"),
        rumorsFeed: document.getElementById("rumors-feed")
    };


    // --- SEKCJA 2: GŁÓWNY PUNKT WEJŚCIA - OBSŁUGA STANU LOGOWANIA ---

    auth.onAuthStateChanged(user => {
        if (user) {
            // UŻYTKOWNIK JEST ZALOGOWANY
            currentUserId = user.uid;
            
            dom.simulatorContainer.classList.remove("hidden");
            dom.authContainer.classList.add("hidden");
            
            listenToPortfolioData(currentUserId);
            listenToRumors();
            
            startPriceTicker();
            if (!chart) initChart();
            startChartTicker();

        } else {
            // UŻYTKOWNIK JEST WYLOGOWANY
            currentUserId = null;
            
            dom.simulatorContainer.classList.add("hidden");
            dom.authContainer.classList.remove("hidden");
            
            if (unsubscribePortfolio) unsubscribePortfolio();
            if (unsubscribeRumors) unsubscribeRumors();
            
            portfolio = { name: "Gość", cash: 0, shares: 0, startValue: 100 };
        }
    });


    // --- SEKCJA 3: LOGIKA AUTENTYKACJI (REJESTRACJA, LOGOWANIE) ---
    
    dom.registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = dom.registerForm.querySelector("#register-name").value;
        const email = dom.registerForm.querySelector("#register-email").value;
        const password = dom.registerForm.querySelector("#register-password").value;
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await createInitialUserData(user.uid, name, email);
            
        } catch (error) {
            showAuthMessage("Błąd rejestracji: " + error.message, "error");
        }
    });

    dom.loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = dom.loginForm.querySelector("#login-email").value;
        const password = dom.loginForm.querySelector("#login-password").value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            
        } catch (error) {
            showAuthMessage("Błąd logowania: " + error.message, "error");
        }
    });

    dom.logoutButton.addEventListener("click", () => {
        auth.signOut();
    });

    function showAuthMessage(message, type = "info") {
        dom.authMessage.textContent = message;
        dom.authMessage.style.color = (type === "error") ? "var(--red)" : "var(--green)";
    }


    // --- SEKCJA 4: LOGIKA BAZY DANYCH (FIRESTORE) ---

    async function createInitialUserData(userId, name, email) {
        const userPortfolio = {
            name: name,
            email: email,
            cash: 100.00,
            shares: 0,
            startValue: 100.00,
            joinDate: new Date()
        };
        await db.collection("uzytkownicy").doc(userId).set(userPortfolio);
    }

    function listenToPortfolioData(userId) {
        if (unsubscribePortfolio) unsubscribePortfolio();

        unsubscribePortfolio = db.collection("uzytkownicy").doc(userId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    portfolio.name = data.name;
                    portfolio.cash = data.cash;
                    portfolio.shares = data.shares;
                    portfolio.startValue = data.startValue;
                    
                    updatePortfolioUI();
                } else {
                    console.error("Błąd: Nie znaleziono danych użytkownika!");
                }
            }, (error) => {
                console.error("Błąd nasłuchu portfela: ", error);
            });
    }

    function listenToRumors() {
        if (unsubscribeRumors) unsubscribeRumors();
        
        unsubscribeRumors = db.collection("plotki")
            .orderBy("timestamp", "desc")
            .limit(5)
            .onSnapshot((querySnapshot) => {
                dom.rumorsFeed.innerHTML = "";
                querySnapshot.forEach((doc) => {
                    const rumor = doc.data();
                    displayNewRumor(rumor.text, rumor.authorName);
                });
            }, (error) => {
                console.error("Błąd nasłuchu plotek: ", error);
            });
    }

    dom.rumorForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const rumorText = dom.rumorInput.value;
        
        if (!rumorText.trim() || !currentUserId) return;
        
        try {
            await db.collection("plotki").add({
                text: rumorText,
                authorId: currentUserId,
                authorName: portfolio.name,
                timestamp: new Date()
            });
            dom.rumorInput.value = "";
        } catch (error) {
            console.error("Błąd dodawania plotki: ", error);
        }
    });


    // --- SEKCJA 5: AKCJE UŻYTKOWNIKA (KUPNO/SPRZEDAŻ) ---

    dom.buyButton.addEventListener("click", () => {
        const amount = parseInt(dom.amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showMessage("Wpisz poprawną ilość.", "error"); return;
        }
        
        const cost = amount * company.price;
        if (cost > portfolio.cash) {
            showMessage("Brak wystarczającej gotówki.", "error"); return;
        }
        
        const newCash = portfolio.cash - cost;
        const newShares = portfolio.shares + amount;
        
        updatePortfolioInFirebase({ cash: newCash, shares: newShares });
        
        showMessage(`Kupiono ${amount} akcji za ${cost.toFixed(2)} zł`, "success");
    });

    dom.sellButton.addEventListener("click", () => {
        const amount = parseInt(dom.amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showMessage("Wpisz poprawną ilość.", "error"); return;
        }
        
        if (amount > portfolio.shares) {
            showMessage("Nie masz tylu akcji.", "error"); return;
        }
        
        const revenue = amount * company.price;
        const newCash = portfolio.cash + revenue;
        const newShares = portfolio.shares - amount;
        
        updatePortfolioInFirebase({ cash: newCash, shares: newShares });
        
        showMessage(`Sprzedano ${amount} akcji za ${revenue.toFixed(2)} zł`, "success");
    });

    async function updatePortfolioInFirebase(dataToUpdate) {
        if (!currentUserId) return;
        
        try {
            const userDocRef = db.collection("uzytkownicy").doc(currentUserId);
            await userDocRef.update(dataToUpdate);
        } catch (error) {
            console.error("Błąd aktualizacji portfela: ", error);
            showMessage("Błąd zapisu danych!", "error");
        }
    }

    
    // --- SEKCJA 6: SYMULATOR RYNKU (LOKALNIE) I WYKRES ---

    function startPriceTicker() {
        if (window.priceTickerInterval) clearInterval(window.priceTickerInterval);
        
        window.priceTickerInterval = setInterval(() => {
            const volatility = 0.5;
            const trend = 0.01;
            const change = (Math.random() - 0.5) * 2 * volatility + trend;
            company.price = Math.max(1.00, company.price + change);
            
            updatePriceUI();
            updatePortfolioUI();
        }, 2000);
    }
    
    function generateInitialCandles(count) {
        let data = []; let lastClose = 50;
        let timestamp = new Date().getTime() - (count * 5000);
        for (let i = 0; i < count; i++) {
            let open = lastClose; let close = open + (Math.random() - 0.5) * 4;
            let high = Math.max(open, close) + Math.random() * 2;
            let low = Math.min(open, close) - Math.random() * 2;
            close = Math.max(1, close);
            data.push({
                x: new Date(timestamp),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            });
            lastClose = close; timestamp += 5000;
        }
        return data;
    }

    function initChart() {
        const options = {
            series: [{ data: chartData }],
            chart: { type: 'candlestick', height: 350, toolbar: { show: false }, animations: { enabled: true, dynamicAnimation: { enabled: true, speed: 350 } } },
            theme: { mode: 'dark' },
            title: { text: 'Historia cen (świece 5-sekundowe)', align: 'left', style: { color: '#a3acb9' } },
            xaxis: { type: 'datetime', labels: { style: { colors: '#a3acb9' } } },
            yaxis: { tooltip: { enabled: true }, labels: { formatter: (val) => val.toFixed(2) + " zł", style: { colors: '#a3acb9' } } },
            plotOptions: { candlestick: { colors: { upward: '#28a745', downward: '#dc3545' } } }
        };
        chart = new ApexCharts(dom.chartContainer, options);
        chart.render();
    }

    function startChartTicker() {
        if (window.chartTickerInterval) clearInterval(window.chartTickerInterval);

        window.chartTickerInterval = setInterval(() => {
            if (!chartData.length) return;
            const lastCandle = chartData[chartData.length - 1];
            const lastClose = parseFloat(lastCandle.y[3]);
            let open = lastClose; let close = open + (Math.random() - 0.5) * 4;
            let high = Math.max(open, close) + Math.random() * 2;
            let low = Math.min(open, close) - Math.random() * 2;
            close = Math.max(1, close);
            const newCandle = {
                x: new Date(lastCandle.x.getTime() + 5000),
                y: [open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2)]
            };
            chartData.push(newCandle);
            if (chartData.length > 50) chartData.shift();
            if (chart) chart.updateSeries([{ data: chartData }]);
        }, 5000);
    }


    // --- SEKCJA 7: AKTUALIZACJA INTERFEJSU (UI) ---

    function updatePriceUI() {
        const oldPrice = parseFloat(dom.stockPrice.textContent);
        dom.stockPrice.textContent = `${company.price.toFixed(2)} zł`;
        if (company.price > oldPrice) dom.stockPrice.style.color = "var(--green)";
        else if (company.price < oldPrice) dom.stockPrice.style.color = "var(--red)";
    }

    function updatePortfolioUI() {
        dom.username.textContent = portfolio.name;
        dom.cash.textContent = `${portfolio.cash.toFixed(2)} zł`;
        dom.shares.textContent = `${portfolio.shares} szt.`;
        
        const sharesValue = portfolio.shares * company.price;
        const totalValue = portfolio.cash + sharesValue;
        const totalProfit = totalValue - portfolio.startValue;

        dom.sharesValue.textContent = `${sharesValue.toFixed(2)} zł`;
        dom.totalValue.textContent = `${totalValue.toFixed(2)} zł`;
        dom.totalProfit.textContent = `${totalProfit.toFixed(2)} zł`;
        
        if (totalProfit > 0) dom.totalProfit.style.color = "var(--green)";
        else if (totalProfit < 0) dom.totalProfit.style.color = "var(--red)";
        else dom.totalProfit.style.color = "var(--text-muted)";
    }

    function showMessage(message, type) {
        dom.messageBox.textContent = message;
        dom.messageBox.style.color = (type === "error") ? "var(--red)" : "var(--green)";
        dom.amountInput.value = "";
    }

    function displayNewRumor(text, authorName) {
        const p = document.createElement("p");
        p.textContent = text; 
        
        const authorSpan = document.createElement("span");
        authorSpan.textContent = ` - ${authorName || "Anonim"}`;
        authorSpan.style.color = "var(--text-muted)";
        authorSpan.style.fontStyle = "normal";
        p.appendChild(authorSpan);
        
        dom.rumorsFeed.prepend(p);
    }

}); // Koniec DOMContentLoaded
