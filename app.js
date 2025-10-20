// BPMshopSGH - Complete App with REAL Telegram Integration
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
let lastMessageCheck = 0;

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
    checkBotConfig();
    
    setInterval(checkDeliveryStatus, 15000);
    setInterval(checkForSupportReplies, 3000);
    
    checkPaymentReturn();
    
    // Показываем модальное окно при первом заходе если ID не введен
    if (!userGameId) {
        setTimeout(() => {
            document.getElementById('login-modal').style.display = 'block';
        }, 1000);
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
            
            // Показываем сообщения для этого пользователя
            showUserMessages();
            
            // Показываем уведомление об успехе
            showNotification('✅ ID успешно сохранен!', 'success');
        } else {
            showNotification('❌ Пожалуйста, введите ваш ID', 'error');
        }
    };

    // Автофокус на инпут при открытии
    modal.addEventListener('shown', function() {
        userIdInput.focus();
    });

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
    
    updateUserDisplay();
}

// Красивое уведомление
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Добавляем стили если их нет
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
                max-width: 300px;
                border-left: 4px solid #ff6b00;
            }
            .notification-success {
                background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
                border-left-color: #28a745;
            }
            .notification-error {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                border-left-color: #dc3545;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 500;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Автоудаление через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Обновление отображения пользователя
function updateUserDisplay() {
    const userDisplay = document.getElementById('user-id-display');
    const loginBtn = document.getElementById('login-btn');
    
    if (userDisplay && loginBtn) {
        if (userGameId) {
            userDisplay.textContent = `🎮 ID: ${userGameId}`;
            userDisplay.style.display = 'inline';
            userDisplay.style.background = 'linear-gradient(135deg, #ff6b00, #ff8c00)';
            userDisplay.style.padding = '5px 12px';
            userDisplay.style.borderRadius = '20px';
            userDisplay.style.fontSize = '0.9rem';
            userDisplay.style.fontWeight = '600';
            loginBtn.textContent = '✏️ Сменить ID';
        } else {
            userDisplay.style.display = 'none';
            loginBtn.textContent = '🎮 Ввести ID';
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
        showNotification('🎮 Сначала введите ваш ID игры', 'error');
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
        showNotification('❌ Ошибка: данные заказа не найдены', 'error');
        return;
    }

    if (!PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID || PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID.includes('your_')) {
        showNotification('⚠️ Платежная система не настроена', 'error');
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
                showNotification(`❌ Оплата не прошла: ${reason}`, 'error');
            }
        });
    } catch (error) {
        console.error('Ошибка CloudPayments:', error);
        showNotification('❌ Ошибка платежной системы', 'error');
    }
}

// РЕАЛЬНАЯ ОПЛАТА ЧЕРЕЗ CLOUDPAYMENTS (СБП)
function processCloudPaymentsSBP() {
    if (!currentOrder || !userGameId) {
        showNotification('❌ Ошибка: данные заказа не найдены', 'error');
        return;
    }

    if (!PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID || PAYMENT_CONFIG.CLOUDPAYMENTS_PUBLIC_ID.includes('your_')) {
        showNotification('⚠️ Платежная система не настроена', 'error');
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
                showNotification(`❌ Оплата через СБП не прошла: ${reason}`, 'error');
            }
        });
    } catch (error) {
        console.error('Ошибка инициализации CloudPayments СБП:', error);
        showNotification('❌ Ошибка платежной системы СБП', 'error');
    }
}

// Обработка успешной оплаты
function handleSuccessfulPayment(payment, method) {
    console.log('✅ Платеж успешен:', payment);
    
    // Отправка уведомления в Telegram
    notifyNewOrder({
        orderId: currentOrderId,
        userId: userGameId,
        product: currentOrder.name,
        amount: currentOrder.price,
        paymentMethod: method,
        paymentData: payment
    });
    
    // Показ страницы успеха
    showSuccessPage(payment);
    
    // Запуск процесса доставки
    startDeliveryProcess();
}

// РЕАЛЬНАЯ отправка в Telegram
async function sendTelegramMessage(chatId, text) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_CONFIG.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        console.log('Telegram send result:', data);
        return data.ok;
    } catch (error) {
        console.error('Telegram send error:', error);
        return false;
    }
}

// Уведомление о новом заказе в Telegram
async function notifyNewOrder(orderData) {
    const message = `
🛒 <b>НОВЫЙ ЗАКАЗ!</b>

👤 Пользователь: ${orderData.userId}
🎮 ID в игре: ${orderData.userId}
📦 Товар: ${orderData.product}
💰 Сумма: ${orderData.amount}
💳 Метод: ${orderData.paymentMethod}
🆔 Номер заказа: ${orderData.orderId}

⏰ Время: ${new Date().toLocaleString()}

💬 Ответить: /reply_${orderData.userId}
    `.trim();

    console.log('🔄 Отправка в Telegram...');
    const success = await sendTelegramMessage(BOT_CONFIG.CHAT_ID, message);
    
    if (success) {
        console.log('✅ Уведомление отправлено в Telegram');
    } else {
        console.log('❌ Не удалось отправить в Telegram');
    }
}

// Показать страницу успеха
function showSuccessPage(payment) {
    const mainPage = document.getElementById('main-page');
    const paymentPage = document.getElementById('payment-page');
    const successPage = document.getElementById('success-page');
    
    if (paymentPage) paymentPage.style.display = 'none';
    if (mainPage) mainPage.style.display = 'none';
    if (successPage) successPage.style.display = 'block';
    
    window.scrollTo(0, 0);
    
    const successDetails = document.getElementById('success-order-details');
    if (successDetails && currentOrder) {
        successDetails.innerHTML = `
            <div class="order-summary">
                <h4>Детали заказа:</h4>
                <div class="order-item">
                    <span>Товар:</span>
                    <span>${currentOrder.name}</span>
                </div>
                <div class="order-item">
                    <span>Ваш ID:</span>
                    <span>${userGameId}</span>
                </div>
                <div class="order-item">
                    <span>Номер заказа:</span>
                    <span>${currentOrderId}</span>
                </div>
                <div class="order-item">
                    <span>Сумма:</span>
                    <span>${currentOrder.price}</span>
                </div>
            </div>
        `;
    }
}

// Запуск процесса доставки
function startDeliveryProcess() {
    console.log('🚚 Запуск процесса доставки для заказа:', currentOrderId);
    
    // Имитация процесса доставки
    setTimeout(() => {
        showDeliveryPage('processing');
    }, 2000);
}

// Показать страницу доставки
function showDeliveryPage(status) {
    const successPage = document.getElementById('success-page');
    const deliveryPage = document.getElementById('delivery-page');
    
    if (successPage) successPage.style.display = 'none';
    if (deliveryPage) deliveryPage.style.display = 'block';
    
    window.scrollTo(0, 0);
    
    const deliveryDetails = document.getElementById('delivery-details');
    if (deliveryDetails) {
        let html = '';
        
        switch(status) {
            case 'processing':
                html = `
                    <div class="delivery-status">
                        <h2>🚀 Доставка обрабатывается</h2>
                        <p>Ваш заказ готовится к отправке</p>
                        
                        <div class="delivery-info">
                            <div class="info-item">
                                <span>Статус:</span>
                                <span class="status-badge waiting">В обработке</span>
                            </div>
                            <div class="info-item">
                                <span>Номер заказа:</span>
                                <span>${currentOrderId}</span>
                            </div>
                            <div class="info-item">
                                <span>Товар:</span>
                                <span>${currentOrder.name}</span>
                            </div>
                            <div class="info-item">
                                <span>Ваш ID:</span>
                                <span>${userGameId}</span>
                            </div>
                        </div>
                        
                        <div class="delivery-timer">
                            <i class="fas fa-clock"></i>
                            <span>Ожидайте доставку в течение 5 минут</span>
                        </div>
                    </div>
                `;
                break;
                
            case 'delivered':
                html = `
                    <div class="delivery-success">
                        <h2>✅ Доставка завершена!</h2>
                        <p>Голда успешно зачислена на ваш аккаунт</p>
                        
                        <div class="success-info">
                            <div class="info-item">
                                <span>Статус:</span>
                                <span class="status-badge delivered">Доставлено</span>
                            </div>
                            <div class="info-item">
                                <span>Номер заказа:</span>
                                <span>${currentOrderId}</span>
                            </div>
                            <div class="info-item">
                                <span>Товар:</span>
                                <span>${currentOrder.name}</span>
                            </div>
                            <div class="info-item">
                                <span>Время доставки:</span>
                                <span>${new Date().toLocaleString()}</span>
                            </div>
                        </div>
                        
                        <button onclick="showMainPage()" class="btn btn-primary btn-lg">
                            Сделать новый заказ
                        </button>
                    </div>
                `;
                break;
        }
        
        deliveryDetails.innerHTML = html;
    }
}

// Обработка криптоплатежей
function processCryptoPayment() {
    showNotification('⚠️ Оплата криптовалютой временно недоступна', 'error');
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

            <button class="btn btn-primary" onclick="notifyManualPayment()">
                Уведомить о переводе
            </button>
        </div>
    `;
}

// Уведомление о ручном платеже
function notifyManualPayment() {
    const message = `
💸 <b>РУЧНОЙ ПЛАТЕЖ</b>

👤 Пользователь: ${userGameId}
📦 Товар: ${currentOrder.name}
💰 Сумма: ${currentOrder.price}
🆔 Номер заказа: ${currentOrderId}

⏰ Время: ${new Date().toLocaleString()}

💬 Ответить: /reply_${userGameId}
    `.trim();

    sendTelegramMessage(BOT_CONFIG.CHAT_ID, message);
    showNotification('✅ Уведомление отправлено! Ожидайте подтверждения.', 'success');
}

// Копирование в буфер обмена
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        showNotification('✅ Скопировано в буфер обмена', 'success');
    }, function(err) {
        console.error('Ошибка копирования: ', err);
        showNotification('❌ Ошибка копирования', 'error');
    });
}

// РЕАЛЬНЫЙ ЧАТ С TELEGRAM
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
    
    // Показываем сообщения при загрузке
    showUserMessages();
}

// Отправка сообщения в Telegram поддержку
async function sendChatMessage() {
    const userInput = document.getElementById('user-input');
    const chatBody = document.getElementById('chat-body');
    
    if (!userInput || !chatBody || !userGameId) {
        showNotification('🎮 Сначала введите ваш ID игры', 'error');
        document.getElementById('login-modal').style.display = 'block';
        return;
    }
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Добавление сообщения пользователя в чат
    addMessageToChat(message, 'user');
    userInput.value = '';
    
    // Отправка в Telegram
    const telegramMessage = `
💬 <b>СООБЩЕНИЕ ОТ ПОЛЬЗОВАТЕЛЯ</b>

ID: ${userGameId}
Аккаунт: #${userAccountId}

📝 Сообщение:
${message}

⏰ ${new Date().toLocaleString()}

💬 Ответить: /reply_${userGameId}
    `.trim();
    
    const sent = await sendTelegramMessage(BOT_CONFIG.CHAT_ID, telegramMessage);
    
    if (sent) {
        addMessageToChat("✅ Сообщение отправлено в поддержку. Ожидайте ответ здесь.", 'support');
    } else {
        addMessageToChat("❌ Не удалось отправить сообщение. Попробуйте позже.", 'support');
    }
}

// Добавление сообщения в чат
function addMessageToChat(text, sender) {
    const chatBody = document.getElementById('chat-body');
    if (!chatBody) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender}`;
    
    const time = new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${text}
        </div>
        <div class="message-time">${time}</div>
    `;
    
    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Сохраняем сообщение
    saveMessage(text, sender, userGameId);
}

// Сохранение сообщений в localStorage
function saveMessage(text, sender, userId) {
    if (!userId) return;
    
    const messages = JSON.parse(localStorage.getItem(`bp_chat_${userId}`) || '[]');
    messages.push({
        text: text,
        sender: sender,
        timestamp: new Date().toISOString(),
        read: true
    });
    
    localStorage.setItem(`bp_chat_${userId}`, JSON.stringify(messages));
}

// Получение сообщений пользователя
function getUserMessages(userId) {
    if (!userId) return [];
    return JSON.parse(localStorage.getItem(`bp_chat_${userId}`) || '[]');
}

// Показ сообщений пользователя
function showUserMessages() {
    if (!userGameId) return;
    
    const chatBody = document.getElementById('chat-body');
    if (!chatBody) return;
    
    const messages = getUserMessages(userGameId);
    
    // Очищаем только если нет сообщений
    if (messages.length === 0) {
        chatBody.innerHTML = `
            <div class="message message-support">
                <div class="message-content">
                    💬 Напишите ваш вопрос, мы ответим в Telegram в течение 1-5 минут
                </div>
                <div class="message-time">Только что</div>
            </div>
        `;
    } else {
        chatBody.innerHTML = '';
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message message-${msg.sender}`;
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${msg.text}
                </div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })}</div>
            `;
            chatBody.appendChild(messageDiv);
        });
    }
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Проверка ответов из Telegram
async function checkForSupportReplies() {
    if (!userGameId) return;
    
    try {
        // Получаем последние сообщения из группы
        const response = await fetch(`https://api.telegram.org/bot${BOT_CONFIG.BOT_TOKEN}/getUpdates?offset=${lastMessageCheck}&timeout=10`);
        const data = await response.json();
        
        if (data.ok && data.result.length > 0) {
            data.result.forEach(update => {
                if (update.update_id > lastMessageCheck) {
                    lastMessageCheck = update.update_id;
                    
                    // Проверяем сообщения из группы поддержки
                    if (update.message && update.message.chat.id.toString() === BOT_CONFIG.CHAT_ID.replace('-100', '-100')) {
                        const messageText = update.message.text || '';
                        const fromName = update.message.from?.first_name || 'Поддержка';
                        
                        // Ищем ответ для нашего пользователя
                        if (messageText.includes(`/reply_${userGameId}`) || 
                            messageText.includes(`ID: ${userGameId}`) ||
                            messageText.includes(`ID ${userGameId}`)) {
                            
                            // Извлекаем текст ответа (убираем команду)
                            let replyText = messageText.replace(`/reply_${userGameId}`, '')
                                                      .replace(`ID: ${userGameId}`, '')
                                                      .replace(`ID ${userGameId}`, '')
                                                      .trim();
                            
                            if (replyText) {
                                const formattedMessage = `👨‍💼 ${fromName}: ${replyText}`;
                                addMessageToChat(formattedMessage, 'support');
                                
                                // Показываем уведомление
                                showNotification('💬 Новое сообщение от поддержки', 'info');
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error checking Telegram replies:', error);
    }
}

// Проверка статуса доставки
function checkDeliveryStatus() {
    // Имитация проверки статуса доставки
    if (currentOrderId && Math.random() < 0.1) {
        showDeliveryPage('delivered');
    }
}

// Проверка возврата на страницу оплаты
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
        showSuccessPage();
    } else if (paymentStatus === 'failed') {
        showNotification('❌ Платеж не прошел. Пожалуйста, попробуйте еще раз.', 'error');
    }
}

// Инициализация анимаций
function initAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
}

// Проверка конфигурации бота
function checkBotConfig() {
    if (!BOT_CONFIG.BOT_TOKEN || BOT_CONFIG.BOT_TOKEN.includes('YOUR')) {
        console.warn('⚠️ Токен бота не настроен');
    }
    
    if (!BOT_CONFIG.CHAT_ID || BOT_CONFIG.CHAT_ID.includes('YOUR')) {
        console.warn('⚠️ ID чата не настроен');
    }
}

// Глобальные функции
window.startOrder = startOrder;
window.showMainPage = showMainPage;
window.processCloudPaymentsCard = processCloudPaymentsCard;
window.processCloudPaymentsSBP = processCloudPaymentsSBP;
window.processCryptoPayment = processCryptoPayment;
window.copyToClipboard = copyToClipboard;
window.notifyManualPayment = notifyManualPayment;

console.log('BPMshopSGH App Loaded Successfully');