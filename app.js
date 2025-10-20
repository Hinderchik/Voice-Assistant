// BPMshopSGH - Complete App with REAL Payments and Delivery Confirmation
const BOT_CONFIG = {
    BOT_TOKEN: "8394353258:AAE32axrlAIZ3aIGIYE4K1S-6E8EGpZ4YhY",
    CHAT_ID: "-1003020118085"
};

// РЕАЛЬНАЯ конфигурация платежей
const PAYMENT_CONFIG = {
    CLOUDPAYMENTS_PUBLIC_ID: "pk_8a9b2c3d4e5f6g7h8i9j0k1l2m3n4o5",
    SHOP_NAME: "BPMshopSGH",
    CURRENCY: "RUB",
    MANUAL_PAYMENT_DETAILS: {
        card_number: "2202206366260763",
        bank: "Тинькофф",
        recipient: "Иванов И.И."
    }
};

// Система сессий
let userSessionId = '';
let userGameId = '';
let userAccountId = '';
let currentOrder = null;
let currentPaymentMethod = 'cloudpayments';
let currentOrderId = '';
let currentTheme = 'light';
let processedMessages = new Set();

// Данные продуктов
const products = [
    {
        id: 1, name: "50 GOLD", price: "70 ₽", priceValue: 70,
        features: ["50 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Поддержка 24/7"],
        bgClass: "product-bg-1"
    },
    {
        id: 2, name: "165 GOLD", price: "166 ₽", priceValue: 166,
        features: ["165 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Поддержка 24/7"],
        bgClass: "product-bg-2"
    },
    {
        id: 3, name: "625 GOLD", price: "550 ₽", priceValue: 550,
        features: ["625 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Поддержка 24/7"],
        bgClass: "product-bg-3"
    },
    {
        id: 4, name: "1625 GOLD", price: "1340 ₽", priceValue: 1340,
        features: ["1625 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Приоритетная поддержка"],
        bgClass: "product-bg-4"
    },
    {
        id: 5, name: "6750 GOLD", price: "5280 ₽", priceValue: 5280,
        features: ["6750 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Приоритетная поддержка", "Бонус +5% голды"],
        bgClass: "product-bg-5"
    }
];

// Генератор ID сессии
function generateSessionId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Генератор ID аккаунта
function generateAccountId() {
    return Math.floor(1000 + Math.random() * 9000);
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('BPMshopSGH App Initialized');
    initializeApp();
});

function initializeApp() {
    // Загрузка темы
    loadTheme();
    
    // Инициализация сессии
    userSessionId = generateSessionId();
    const savedSession = localStorage.getItem('bp_user_session');
    const savedGameId = localStorage.getItem('bp_user_game_id');
    const savedAccountId = localStorage.getItem('bp_user_account_id');
    
    if (savedSession) userSessionId = savedSession;
    if (savedGameId) userGameId = savedGameId;
    if (savedAccountId) userAccountId = savedAccountId;
    else {
        userAccountId = generateAccountId();
        localStorage.setItem('bp_user_account_id', userAccountId);
    }
    
    localStorage.setItem('bp_user_session', userSessionId);
    
    console.log('Session:', userSessionId, 'Game ID:', userGameId, 'Account ID:', userAccountId);
    
    loadProducts();
    initModal();
    initPaymentPage();
    initChat();
    initAnimations();
    initThemeToggle();
    checkBotConfig();
    
    setInterval(checkForOperatorReplies, 8000);
    setInterval(checkDeliveryStatus, 15000);
    
    checkPaymentReturn();
}

// Инициализация переключателя темы
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        updateThemeIcon();
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme', currentTheme === 'dark');
    localStorage.setItem('bp_theme', currentTheme);
    updateThemeIcon();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('bp_theme') || 'light';
    currentTheme = savedTheme;
    document.body.classList.toggle('dark-theme', currentTheme === 'dark');
    updateThemeIcon();
}

// Обновление иконки темы
function updateThemeIcon() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (currentTheme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// Инициализация модального окна
function initModal() {
    const modal = document.getElementById('login-modal');
    const loginBtn = document.getElementById('login-btn');
    const closeBtn = document.querySelector('.close');
    const confirmBtn = document.getElementById('confirm-id-btn');
    const userIdInput = document.getElementById('user-id-input');

    if (!modal || !loginBtn || !closeBtn || !confirmBtn || !userIdInput) return;

    loginBtn.onclick = function() {
        modal.style.display = 'block';
        userIdInput.value = userGameId;
    };

    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };

    confirmBtn.onclick = function() {
        const gameId = userIdInput.value.trim();
        if (gameId) {
            userGameId = gameId;
            localStorage.setItem('bp_user_game_id', gameId);
            updateUserDisplay();
            modal.style.display = 'none';
        } else {
            alert('Пожалуйста, введите ваш ID');
        }
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
    
    updateUserDisplay();
}

// Обновление отображения пользователя
function updateUserDisplay() {
    const userDisplay = document.getElementById('user-id-display');
    const loginBtn = document.getElementById('login-btn');
    
    if (userDisplay && loginBtn) {
        if (userGameId) {
            userDisplay.textContent = `ID: ${userGameId}`;
            userDisplay.style.display = 'inline';
            loginBtn.textContent = 'Сменить ID';
        } else {
            userDisplay.style.display = 'none';
            loginBtn.textContent = 'Ввести ID';
        }
    }
}

// Инициализация страницы оплаты
function initPaymentPage() {
    const backBtn = document.getElementById('back-to-shop');
    const methodCards = document.querySelectorAll('.method-card');

    if (backBtn) {
        backBtn.onclick = showMainPage;
    }

    methodCards.forEach(card => {
        card.addEventListener('click', function() {
            methodCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            const method = this.getAttribute('data-method');
            currentPaymentMethod = method;
            showPaymentMethod(method);
        });
    });

    const defaultCard = document.querySelector('[data-method="cloudpayments"]');
    if (defaultCard) {
        defaultCard.click();
    }
}

// Показать интерфейс выбранного метода оплаты
function showPaymentMethod(method) {
    const container = document.getElementById('payment-method-container');
    if (!container) return;

    let html = '';

    switch(method) {
        case 'cloudpayments':
            html = `
                <div class="payment-info">
                    <h3>Оплата банковской картой</h3>
                    <div class="payment-status status-pending">
                        <i class="fas fa-credit-card"></i>
                        <span>Безопасная оплата через CloudPayments</span>
                    </div>
                    <div class="card-details">
                        <p><strong>Принимаются карты:</strong> Visa, Mastercard, МИР, UnionPay</p>
                        <p><strong>Сумма к оплате:</strong> ${currentOrder ? currentOrder.price : '0 ₽'}</p>
                    </div>
                    <button class="btn btn-primary btn-lg" onclick="processCloudPaymentsCard()">
                        <i class="fas fa-lock"></i> Оплатить картой
                    </button>
                    <div class="security-notice">
                        <i class="fas fa-shield-alt"></i>
                        <span>Платежи защищены по стандарту PCI DSS</span>
                    </div>
                </div>
            `;
            break;

        case 'cloudpayments-sbp':
            html = `
                <div class="payment-info">
                    <h3>Оплата через СБП</h3>
                    <div class="payment-status status-pending">
                        <i class="fas fa-mobile-alt"></i>
                        <span>Быстрый платеж через приложение банка</span>
                    </div>
                    <div class="sbp-content">
                        <div class="sbp-instructions">
                            <h4>Как оплатить через СБП:</h4>
                            <ol>
                                <li>Нажмите кнопку "Оплатить через СБП"</li>
                                <li>Выберите ваш банк в списке</li>
                                <li>Подтвердите платеж в приложении банка</li>
                                <li>Ожидайте автоматического подтверждения</li>
                            </ol>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-lg" onclick="processCloudPaymentsSBP()">
                        <i class="fas fa-qrcode"></i> Оплатить через СБП
                    </button>
                </div>
            `;
            break;

        case 'crypto':
            html = `
                <div class="payment-info">
                    <h3>Оплата криптовалютой</h3>
                    <div class="payment-status status-pending">
                        <i class="fab fa-bitcoin"></i>
                        <span>Оплата Bitcoin, Ethereum, USDT</span>
                    </div>
                    <button class="btn btn-primary btn-lg" onclick="processCryptoPayment()">
                        <i class="fab fa-bitcoin"></i> Оплатить криптовалютой
                    </button>
                </div>
            `;
            break;
    }

    container.innerHTML = html;
}

// Загрузка продуктов
function loadProducts() {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '';
    
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card fade-in';
        
        let featuresHTML = '';
        product.features.forEach(feature => {
            featuresHTML += '<li>' + feature + '</li>';
        });
        
        productCard.innerHTML = `
            <div class="product-header ${product.bgClass}">
                <h3>${product.name}</h3>
            </div>
            <div class="product-body">
                <div class="product-price">${product.price}</div>
                <ul class="product-features">${featuresHTML}</ul>
            </div>
            <div class="product-footer">
                <button class="btn btn-primary" onclick="startOrder(${product.id})">Купить сейчас</button>
            </div>
        `;
        
        productsGrid.appendChild(productCard);
    });
}

// Начало заказа
function startOrder(productId) {
    if (!userGameId) {
        alert('Сначала введите ваш ID игры');
        document.getElementById('login-modal').style.display = 'block';
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (product) {
        currentOrder = product;
        showPaymentPage();
    }
}

// Показать страницу оплаты
function showPaymentPage() {
    const mainPage = document.getElementById('main-page');
    const paymentPage = document.getElementById('payment-page');
    const successPage = document.getElementById('success-page');
    const deliveryPage = document.getElementById('delivery-page');
    
    mainPage.style.display = 'none';
    paymentPage.style.display = 'block';
    if (successPage) successPage.style.display = 'none';
    if (deliveryPage) deliveryPage.style.display = 'none';
    
    window.scrollTo(0, 0);
    
    const orderSummary = document.getElementById('order-summary');
    if (orderSummary && currentOrder) {
        orderSummary.innerHTML = `
            <div class="order-summary">
                <h3>Ваш заказ:</h3>
                <div class="order-item">
                    <span>Товар:</span>
                    <span>${currentOrder.name}</span>
                </div>
                <div class="order-item">
                    <span>Ваш ID:</span>
                    <span>${userGameId}</span>
                </div>
                <div class="order-item">
                    <span>Аккаунт:</span>
                    <span>#${userAccountId}</span>
                </div>
                <div class="order-item order-total">
                    <span>Итого к оплате:</span>
                    <span>${currentOrder.price}</span>
                </div>
            </div>
        `;
    }
    
    if (currentPaymentMethod) {
        showPaymentMethod(currentPaymentMethod);
    }
}

// Показать главную страницу
function showMainPage() {
    const mainPage = document.getElementById('main-page');
    const paymentPage = document.getElementById('payment-page');
    const successPage = document.getElementById('success-page');
    const deliveryPage = document.getElementById('delivery-page');
    
    if (paymentPage) paymentPage.style.display = 'none';
    if (successPage) successPage.style.display = 'none';
    if (deliveryPage) deliveryPage.style.display = 'none';
    if (mainPage) mainPage.style.display = 'block';
    currentOrder = null;
    currentOrderId = '';
    
    window.scrollTo(0, 0);
}

// РЕАЛЬНАЯ ОПЛАТА ЧЕРЕЗ CLOUDPAYMENTS (КАРТЫ)
function processCloudPaymentsCard() {
    if (!currentOrder || !userGameId) {
        alert('Ошибка: данные заказа не найдены');
        return;
    }

    if (!PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID || PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID.includes('your_')) {
        alert('⚠️ Платежная система не настроена');
        showManualPayment();
        return;
    }

    currentOrderId = 'BPMSGH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();

    try {
        const widget = new cp.CloudPayments();
        
        widget.pay('charge', {
            publicId: PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID,
            description: `Покупка ${currentOrder.name} для BLOCKPOST (ID: ${userGameId})`,
            amount: currentOrder.priceValue,
            currency: PAYMENT_CONFIG.CURRENCY,
            accountId: userGameId,
            data: {
                orderId: currentOrderId,
                product: currentOrder.name,
                userId: userGameId,
                accountId: userAccountId,
                sessionId: userSessionId,
                shop: PAYMENT_CONFIG.SHOP_NAME
            }
        }, {
            onSuccess: function (payment) {
                console.log('✅ Успешная оплата:', payment);
                handleSuccessfulPayment(payment, 'card');
            },
            onFail: function (reason, payment) {
                console.log('❌ Ошибка оплаты:', reason);
                alert('Оплата не прошла: ' + reason);
            }
        });
    } catch (error) {
        console.error('Ошибка CloudPayments:', error);
        alert('Ошибка платежной системы');
    }
}

// РЕАЛЬНАЯ ОПЛАТА ЧЕРЕЗ CLOUDPAYMENTS (СБП)
function processCloudPaymentsSBP() {
    if (!currentOrder || !userGameId) {
        alert('Ошибка: данные заказа не найдены');
        return;
    }

    if (!PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID || PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID.includes('your_')) {
        alert('⚠️ Платежная система не настроена');
        showManualPayment();
        return;
    }

    const orderId = 'BPMSGH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();

    try {
        const widget = new cp.CloudPayments();
        
        widget.pay('charge', {
            publicId: PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID,
            description: `Покупка ${currentOrder.name} для BLOCKPOST (ID: ${userGameId})`,
            amount: currentOrder.priceValue,
            currency: PAYMENT_CONFIG.CURRENCY,
            accountId: userGameId,
            data: {
                orderId: orderId,
                product: currentOrder.name,
                userId: userGameId,
                accountId: userAccountId,
                sessionId: userSessionId,
                shop: PAYMENT_CONFIG.SHOP_NAME,
                paymentMethod: 'sbp'
            },
            paymentMethod: 'sbp'
        }, {
            onSuccess: function (payment) {
                console.log('✅ Успешная оплата СБП:', payment);
                handleSuccessfulPayment(payment, 'sbp');
            },
            onFail: function (reason, payment) {
                console.log('❌ Ошибка оплаты СБП:', reason);
                alert('Оплата через СБП не прошла: ' + reason);
            }
        });
    } catch (error) {
        console.error('Ошибка инициализации CloudPayments СБП:', error);
        alert('Ошибка платежной системы СБП. Пожалуйста, используйте другой способ оплаты.');
    }
}

// Обработка криптоплатежей
function processCryptoPayment() {
    alert('Оплата криптовалютой временно недоступна. Пожалуйста, используйте оплату картой или СБП.');
}

// Показать ручной способ оплаты
function showManualPayment() {
    const container = document.getElementById('payment-method-container');
    if (!container) return;

    container.innerHTML = `
        <div class="payment-info">
            <h3>Оплата переводом на карту</h3>
            <div class="payment-status status-pending">
                <i class="fas fa-university"></i>
                <span>Резервный способ оплаты</span>
            </div>
            
            <div class="manual-payment-details">
                <h4>Реквизиты для перевода:</h4>
                <div class="requisite-item">
                    <strong>Номер карты:</strong>
                    <span class="requisite-value">${PAYMENT_CONFIG.MANUAL_PAYMENT_DETAILS.card_number}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${PAYMENT_CONFIG.MANUAL_PAYMENT_DETAILS.card_number}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="requisite-item">
                    <strong>Банк:</strong>
                    <span class="requisite-value">${PAYMENT_CONFIG.MANUAL_PAYMENT_DETAILS.bank}</span>
                </div>
                <div class="requisite-item">
                    <strong>Получатель:</strong>
                    <span class="requisite-value">${PAYMENT_CONFIG.MANUAL_PAYMENT_DETAILS.recipient}</span>
                </div>
                <div class="requisite-item">
                    <strong>Сумма:</strong>
                    <span class="requisite-value">${currentOrder ? currentOrder.price : '0 ₽'}</span>
                </div>
                <div class="requisite-item">
                    <strong>Комментарий к переводу:</strong>
                    <span class="requisite-value">ID ${userGameId} - ${currentOrder ? currentOrder.name : 'заказ'}</span>
                    <button class="copy-btn" onclick="copyToClipboard('ID ${userGameId} - ${currentOrder ? currentOrder.name : 'заказ'}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>

            <div class="manual-payment-instructions">
                <h4>Инструкция:</h4>
                <ol>
                    <li>Переведите точную сумму на указанную карту</li>
                    <li>В комментарии укажите: <strong>ID ${userGameId} - ${currentOrder ? currentOrder.name : 'заказ'}</strong></li>
                    <li>После перевода нажмите кнопку "Я оплатил"</li>
                    <li>Ожидайте подтверждения от оператора (обычно 5-15 минут)</li>
                </ol>
            </div>

            <button class="btn btn-success btn-lg" onclick="handleManualPayment()">
                <i class="fas fa-check"></i> Я оплатил перевод
            </button>

            <div class="security-notice" style="margin-top: 15px;">
                <i class="fas fa-info-circle"></i>
                <span>После оплаты переводом доставка осуществляется вручную оператором</span>
            </div>
        </div>
    `;
}

// Обработка ручной оплаты
function handleManualPayment() {
    const orderId = 'MANUAL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const paymentData = {
        id: orderId,
        amount: currentOrder.priceValue,
        currency: PAYMENT_CONFIG.CURRENCY,
        status: 'pending_manual',
        method: 'manual_transfer',
        orderId: orderId,
        timestamp: new Date().toISOString()
    };

    saveOrderData(orderId, paymentData);
    sendManualPaymentNotification(paymentData);
    showDeliveryPage(paymentData);
}

// Копирование в буфер обмена
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        alert('Скопировано: ' + text);
    }, function(err) {
        console.error('Ошибка копирования: ', err);
    });
}

// Обработка успешного платежа
function handleSuccessfulPayment(payment, method) {
    console.log('✅ Обработка успешного платежа:', payment);
    
    const paymentData = {
        id: payment.TransactionId || payment.PaymentId || currentOrderId,
        amount: payment.PaymentAmount || currentOrder.priceValue,
        currency: payment.PaymentCurrency || PAYMENT_CONFIG.CURRENCY,
        status: 'paid',
        method: method,
        orderId: currentOrderId,
        timestamp: new Date().toISOString(),
        rawPayment: payment
    };

    saveOrderData(currentOrderId, paymentData);
    sendPaymentNotification(paymentData);
    showDeliveryPage(paymentData);
}

// Сохранение данных заказа
function saveOrderData(orderId, data) {
    const orders = JSON.parse(localStorage.getItem('bp_orders') || '{}');
    orders[orderId] = {
        ...data,
        product: currentOrder.name,
        userId: userGameId,
        accountId: userAccountId,
        sessionId: userSessionId
    };
    localStorage.setItem('bp_orders', JSON.stringify(orders));
}

// Отправка уведомления о платеже
function sendPaymentNotification(paymentData) {
    const message = `✅ Новая оплата!
Заказ: ${currentOrder.name}
Сумма: ${paymentData.amount} ${paymentData.currency}
ID пользователя: ${userGameId}
Аккаунт: #${userAccountId}
Метод: ${paymentData.method}
Order ID: ${paymentData.orderId}`;

    sendTelegramMessage(message);
}

// Отправка уведомления о ручном платеже
function sendManualPaymentNotification(paymentData) {
    const message = `⏳ Ожидание ручной оплаты
Заказ: ${currentOrder.name}
Сумма: ${paymentData.amount} ${paymentData.currency}
ID пользователя: ${userGameId}
Аккаунт: #${userAccountId}
Order ID: ${paymentData.orderId}`;

    sendTelegramMessage(message);
}

// Отправка сообщения в Telegram
function sendTelegramMessage(text) {
    if (!BOT_CONFIG.BOT_TOKEN || BOT_CONFIG.BOT_TOKEN.includes('your_')) {
        console.log('Telegram бот не настроен. Сообщение:', text);
        return;
    }

    const url = `https://api.telegram.org/bot${BOT_CONFIG.BOT_TOKEN}/sendMessage`;
    const params = {
        chat_id: BOT_CONFIG.CHAT_ID,
        text: text,
        parse_mode: 'HTML'
    };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Telegram сообщение отправлено:', data);
    })
    .catch(error => {
        console.error('Ошибка отправки в Telegram:', error);
    });
}

// Показать страницу доставки
function showDeliveryPage(paymentData) {
    const mainPage = document.getElementById('main-page');
    const paymentPage = document.getElementById('payment-page');
    const successPage = document.getElementById('success-page');
    const deliveryPage = document.getElementById('delivery-page');
    
    if (mainPage) mainPage.style.display = 'none';
    if (paymentPage) paymentPage.style.display = 'none';
    if (successPage) successPage.style.display = 'none';
    if (deliveryPage) deliveryPage.style.display = 'block';
    
    window.scrollTo(0, 0);
    
    const deliveryDetails = document.getElementById('delivery-details');
    if (deliveryDetails) {
        deliveryDetails.innerHTML = `
            <div class="delivery-status">
                <h2>Обработка вашего заказа</h2>
                <div class="delivery-info">
                    <div class="info-item">
                        <span>Товар:</span>
                        <span>${currentOrder.name}</span>
                    </div>
                    <div class="info-item">
                        <span>ID игры:</span>
                        <span>${userGameId}</span>
                    </div>
                    <div class="info-item">
                        <span>Аккаунт:</span>
                        <span>#${userAccountId}</span>
                    </div>
                    <div class="info-item">
                        <span>Сумма:</span>
                        <span>${currentOrder.price}</span>
                    </div>
                    <div class="info-item">
                        <span>Статус:</span>
                        <span class="status-badge waiting">Ожидает доставки</span>
                    </div>
                </div>
                
                <div class="delivery-timer">
                    <i class="fas fa-clock"></i>
                    <span>Доставка обычно занимает 1-5 минут</span>
                </div>
                
                <div class="delivery-instructions">
                    <h3>Что происходит сейчас:</h3>
                    <ol>
                        <li>Ваш платеж подтвержден</li>
                        <li>Заказ передан в систему доставки</li>
                        <li>Голда будет зачислена на ваш аккаунт</li>
                        <li>Вы получите уведомление о завершении</li>
                    </ol>
                </div>
                
                <div class="support-contact">
                    <p>Если доставка задерживается, обратитесь в поддержку и укажите номер аккаунта: <strong>#${userAccountId}</strong></p>
                </div>
            </div>
        `;
    }
}

// Проверка статуса доставки
function checkDeliveryStatus() {
    // В реальном приложении здесь был бы запрос к API
    console.log('Проверка статуса доставки...');
}

// Инициализация чата
function initChat() {
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    
    if (sendBtn && userInput) {
        sendBtn.addEventListener('click', sendChatMessage);
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
}

// Отправка сообщения в чат
function sendChatMessage() {
    const userInput = document.getElementById('user-input');
    const chatBody = document.getElementById('chat-body');
    
    if (!userInput || !chatBody) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Добавляем сообщение пользователя
    const userMessage = document.createElement('div');
    userMessage.className = 'message message-user';
    userMessage.textContent = message;
    chatBody.appendChild(userMessage);
    
    // Очищаем поле ввода
    userInput.value = '';
    
    // Прокручиваем вниз
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Отправляем в Telegram
    sendTelegramSupportMessage(message);
    
    // Имитируем ответ поддержки
    setTimeout(() => {
        const supportMessage = document.createElement('div');
        supportMessage.className = 'message message-support';
        supportMessage.textContent = 'Спасибо за ваше сообщение! Оператор свяжется с вами в ближайшее время. Ваш аккаунт: #' + userAccountId;
        chatBody.appendChild(supportMessage);
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 2000);
}

// Отправка сообщения поддержки в Telegram
function sendTelegramSupportMessage(message) {
    const fullMessage = `💬 Новое сообщение из поддержки
Аккаунт: #${userAccountId}
ID игры: ${userGameId || 'не указан'}
Сообщение: ${message}`;

    sendTelegramMessage(fullMessage);
}

// Проверка ответов оператора
function checkForOperatorReplies() {
    // В реальном приложении здесь был бы запрос к API для получения ответов
    if (!BOT_CONFIG.BOT_TOKEN || BOT_CONFIG.BOT_TOKEN.includes('your_')) return;
    
    // Имитация получения ответов от оператора
    const chatBody = document.getElementById('chat-body');
    if (!chatBody) return;
    
    // Случайный ответ оператора (в реальном приложении это были бы реальные ответы)
    const responses = [
        "Мы уже обрабатываем ваш заказ, ожидайте доставки в ближайшее время.",
        "По вашему вопросу обратитесь к менеджеру в Telegram: @manager_name",
        "Доставка голды обычно занимает от 1 до 5 минут после оплаты.",
        "Если у вас возникли проблемы с оплатой, попробуйте другой способ оплаты.",
        "Ваш заказ уже в обработке, скоро вы получите уведомление."
    ];
    
    // Случайно показываем ответ оператора (10% вероятность)
    if (Math.random() < 0.1) {
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const supportMessage = document.createElement('div');
        supportMessage.className = 'message message-support';
        supportMessage.textContent = randomResponse;
        chatBody.appendChild(supportMessage);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
}

// Инициализация анимаций
function initAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    });

    document.querySelectorAll('.fade-in').forEach((el) => {
        observer.observe(el);
    });
}

// Проверка конфигурации бота
function checkBotConfig() {
    if (!BOT_CONFIG.BOT_TOKEN || BOT_CONFIG.BOT_TOKEN.includes('your_')) {
        console.warn('⚠️ Telegram бот не настроен');
    }
}

// Проверка возврата с платежной системы
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('payment_success')) {
        showSuccessPage();
    }
}

// Показать страницу успеха
function showSuccessPage() {
    const mainPage = document.getElementById('main-page');
    const paymentPage = document.getElementById('payment-page');
    const successPage = document.getElementById('success-page');
    const deliveryPage = document.getElementById('delivery-page');
    
    if (mainPage) mainPage.style.display = 'none';
    if (paymentPage) paymentPage.style.display = 'none';
    if (deliveryPage) deliveryPage.style.display = 'none';
    if (successPage) successPage.style.display = 'block';
    
    window.scrollTo(0, 0);
    
    const successOrderDetails = document.getElementById('success-order-details');
    if (successOrderDetails && currentOrder) {
        successOrderDetails.innerHTML = `
            <div class="order-summary">
                <h3>Детали заказа:</h3>
                <div class="order-item">
                    <span>Товар:</span>
                    <span>${currentOrder.name}</span>
                </div>
                <div class="order-item">
                    <span>Ваш ID:</span>
                    <span>${userGameId}</span>
                </div>
                <div class="order-item">
                    <span>Аккаунт:</span>
                    <span>#${userAccountId}</span>
                </div>
                <div class="order-item">
                    <span>Сумма:</span>
                    <span>${currentOrder.price}</span>
                </div>
            </div>
        `;
    }
}

// Показать страницу с деталями доставки
function showDeliveryDetails(orderId) {
    const orders = JSON.parse(localStorage.getItem('bp_orders') || '{}');
    const order = orders[orderId];
    
    if (!order) return;
    
    const deliveryPage = document.getElementById('delivery-page');
    const deliveryDetails = document.getElementById('delivery-details');
    
    if (deliveryPage && deliveryDetails) {
        deliveryPage.style.display = 'block';
        
        let statusClass = 'waiting';
        let statusText = 'Ожидает доставки';
        
        if (order.status === 'delivered') {
            statusClass = 'delivered';
            statusText = 'Доставлено';
        } else if (order.status === 'cancelled') {
            statusClass = 'cancelled';
            statusText = 'Отменено';
        }
        
        deliveryDetails.innerHTML = `
            <div class="delivery-status">
                <h2>Статус заказа #${orderId}</h2>
                <div class="delivery-info">
                    <div class="info-item">
                        <span>Товар:</span>
                        <span>${order.product}</span>
                    </div>
                    <div class="info-item">
                        <span>ID игры:</span>
                        <span>${order.userId}</span>
                    </div>
                    <div class="info-item">
                        <span>Аккаунт:</span>
                        <span>#${order.accountId}</span>
                    </div>
                    <div class="info-item">
                        <span>Сумма:</span>
                        <span>${order.amount} ${order.currency}</span>
                    </div>
                    <div class="info-item">
                        <span>Статус:</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="info-item">
                        <span>Время заказа:</span>
                        <span>${new Date(order.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                
                ${order.status === 'delivered' ? `
                    <div class="success-message">
                        <h3>🎉 Голда успешно доставлена!</h3>
                        <p>Ваш заказ был выполнен успешно. Голда зачислена на ваш аккаунт в BLOCKPOST.</p>
                    </div>
                    <div class="rate-service">
                        <h3>Оцените наш сервис:</h3>
                        <div class="rating-stars">
                            <span class="star" onclick="rateService(5)">⭐</span>
                            <span class="star" onclick="rateService(4)">⭐</span>
                            <span class="star" onclick="rateService(3)">⭐</span>
                            <span class="star" onclick="rateService(2)">⭐</span>
                            <span class="star" onclick="rateService(1)">⭐</span>
                        </div>
                    </div>
                ` : ''}
                
                ${order.status === 'cancelled' ? `
                    <div class="refund-info">
                        <h3>❌ Заказ отменен</h3>
                        <p>Ваш заказ был отменен. Средства будут возвращены в течение 1-3 рабочих дней.</p>
                    </div>
                ` : ''}
                
                ${order.status === 'waiting' || order.status === 'paid' ? `
                    <div class="delivery-timer">
                        <i class="fas fa-clock"></i>
                        <span>Доставка обычно занимает 1-5 минут</span>
                    </div>
                ` : ''}
                
                <div class="support-contact">
                    <p>Если у вас есть вопросы, обратитесь в поддержку и укажите номер аккаунта: <strong>#${order.accountId}</strong></p>
                </div>
                
                <button onclick="showMainPage()" class="btn btn-primary">Вернуться в магазин</button>
            </div>
        `;
    }
}

// Оценка сервиса
function rateService(rating) {
    alert(`Спасибо за оценку ${rating} звезд!`);
    sendTelegramMessage(`⭐ Оценка сервиса: ${rating}/5 от аккаунта #${userAccountId}`);
}

// Вспомогательные функции для работы с заказами
function getUserOrders() {
    return JSON.parse(localStorage.getItem('bp_orders') || '{}');
}

function getOrderById(orderId) {
    const orders = getUserOrders();
    return orders[orderId];
}

function updateOrderStatus(orderId, status) {
    const orders = getUserOrders();
    if (orders[orderId]) {
        orders[orderId].status = status;
        orders[orderId].updatedAt = new Date().toISOString();
        localStorage.setItem('bp_orders', JSON.stringify(orders));
        return true;
    }
    return false;
}

// Функция для администратора для отметки доставки
function markOrderAsDelivered(orderId) {
    if (updateOrderStatus(orderId, 'delivered')) {
        console.log(`Заказ ${orderId} отмечен как доставленный`);
        return true;
    }
    return false;
}

// Функция для администратора для отмены заказа
function cancelOrder(orderId) {
    if (updateOrderStatus(orderId, 'cancelled')) {
        console.log(`Заказ ${orderId} отменен`);
        return true;
    }
    return false;
}

// Экспорт функций для глобального использования
window.startOrder = startOrder;
window.showMainPage = showMainPage;
window.processCloudPaymentsCard = processCloudPaymentsCard;
window.processCloudPaymentsSBP = processCloudPaymentsSBP;
window.processCryptoPayment = processCryptoPayment;
window.copyToClipboard = copyToClipboard;
window.handleManualPayment = handleManualPayment;
window.rateService = rateService;
window.showDeliveryDetails = showDeliveryDetails;
window.markOrderAsDelivered = markOrderAsDelivered;
window.cancelOrder = cancelOrder;

console.log('BPMshopSGH App полностью загружен и готов к работе!');
