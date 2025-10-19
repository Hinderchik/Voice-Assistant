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
let currentOrder = null;
let currentPaymentMethod = 'cloudpayments';
let currentOrderId = '';

// Данные продуктов
const products = [
    {
        id: 1, name: "50 GOLD", price: "70 ₽", priceValue: 70,
        features: ["50 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Поддержка 24/7"]
    },
    {
        id: 2, name: "165 GOLD", price: "166 ₽", priceValue: 166,
        features: ["165 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Поддержка 24/7"]
    },
    {
        id: 3, name: "625 GOLD", price: "550 ₽", priceValue: 550,
        features: ["625 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Поддержка 24/7"]
    },
    {
        id: 4, name: "1625 GOLD", price: "1340 ₽", priceValue: 1340,
        features: ["1625 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Приоритетная поддержка"]
    },
    {
        id: 5, name: "6750 GOLD", price: "5280 ₽", priceValue: 5280,
        features: ["6750 голды для BLOCKPOST", "Мгновенная доставка", "Официальный метод пополнения", "Приоритетная поддержка", "Бонус +5% голды"]
    }
];

// Генератор ID сессии
function generateSessionId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('BPMshopSGH App Initialized');
    initializeApp();
});

function initializeApp() {
    processedMessages.clear();
    userSessionId = generateSessionId();
    const savedSession = localStorage.getItem('bp_user_session');
    const savedGameId = localStorage.getItem('bp_user_game_id');
    
    if (savedSession) userSessionId = savedSession;
    if (savedGameId) userGameId = savedGameId;
    
    localStorage.setItem('bp_user_session', userSessionId);
    
    console.log('Session:', userSessionId, 'Game ID:', userGameId);
    
    loadProducts();
    initModal();
    initPaymentPage();
    initChat();
    initAnimations();
    checkBotConfig();
    
    setInterval(checkForOperatorReplies, 8000);
    setInterval(checkDeliveryStatus, 15000);
    
    checkPaymentReturn();
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
            <div class="product-header"><h3>${product.name}</h3></div>
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

// Страница ожидания доставки
function showDeliveryPage(paymentData) {
    const mainPage = document.getElementById('main-page');
    const paymentPage = document.getElementById('payment-page');
    const successPage = document.getElementById('success-page');
    const deliveryPage = document.getElementById('delivery-page');
    
    mainPage.style.display = 'none';
    paymentPage.style.display = 'none';
    successPage.style.display = 'none';
    deliveryPage.style.display = 'block';
    
    const deliveryDetails = document.getElementById('delivery-details');
    if (deliveryDetails && currentOrder) {
        deliveryDetails.innerHTML = `
            <div class="delivery-status">
                <div class="status-pending">
                    <i class="fas fa-truck-loading"></i>
                    <h3>Ожидайте доставку голды</h3>
                </div>
                
                <div class="delivery-info">
                    <div class="info-item">
                        <strong>Заказ:</strong>
                        <span>${currentOrder.name}</span>
                    </div>
                    <div class="info-item">
                        <strong>Ваш ID:</strong>
                        <span>${userGameId}</span>
                    </div>
                    <div class="info-item">
                        <strong>Номер заказа:</strong>
                        <span>${paymentData.orderId}</span>
                    </div>
                    <div class="info-item">
                        <strong>Статус:</strong>
                        <span class="status-badge waiting">Ожидает доставки</span>
                    </div>
                </div>

                <div class="delivery-instructions">
                    <h4>Что происходит сейчас:</h4>
                    <ol>
                        <li>✅ Оплата получена</li>
                        <li>🔄 Оператор получил уведомление</li>
                        <li>⏳ Ожидайте зачисления голды на ID: ${userGameId}</li>
                        <li>✅ Вы получите уведомление о доставке</li>
                    </ol>
                </div>

                <div class="delivery-timer">
                    <i class="fas fa-clock"></i>
                    <span>Обычное время доставки: <strong>1-5 минут</strong></span>
                </div>

                <div class="support-contact">
                    <p>Если прошло более 10 минут, свяжитесь с поддержкой:</p>
                    <button class="btn btn-outline" onclick="openSupportChat()">
                        <i class="fas fa-headset"></i> Написать в поддержку
                    </button>
                </div>
            </div>
        `;
    }
    
    startDeliveryStatusCheck();
}

// Открыть чат поддержки
function openSupportChat() {
    const chatInput = document.getElementById('user-input');
    if (chatInput) {
        chatInput.value = `Заказ ${currentOrderId} - проверьте доставку голды на ID: ${userGameId}`;
        document.getElementById('send-btn').click();
    }
}

// Отправка уведомления оператору о новом заказе
// Отправка уведомления оператору о новом заказе (УЛУЧШЕННАЯ)
// УПРОЩЕННОЕ уведомление о новом заказе
function sendPaymentNotification(paymentData) {
    if (!BOT_CONFIG.BOT_TOKEN) return;

    const message = `🛒 НОВЫЙ ЗАКАЗ
👤 ID: ${userGameId} 
🎮 ${currentOrder.name}
💰 ${currentOrder.price}
📋 ${paymentData.orderId}
🔗 ${userSessionId}

✅ Оплачено
⏰ ${new Date(paymentData.timestamp).toLocaleString()}

Команды:
/delivered ${paymentData.orderId}|${userSessionId}
/cancel ${paymentData.orderId}|${userSessionId}|причина
/ask ${userSessionId}|текст`;

    const url = 'https://api.telegram.org/bot' + BOT_CONFIG.BOT_TOKEN + '/sendMessage';
    const data = {
        chat_id: BOT_CONFIG.CHAT_ID,
        text: message,
        parse_mode: "HTML"
    };
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    }).catch(error => console.error('Error sending payment notification:', error));
}

// Обработка callback-запросов от кнопок
function checkCallbacks() {
    if (!BOT_CONFIG.BOT_TOKEN) return;
    
    const url = `https://api.telegram.org/bot${BOT_CONFIG.BOT_TOKEN}/getUpdates?offset=${getLastUpdateId() + 1}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok && data.result) {
                data.result.forEach(update => {
                    setLastUpdateId(update.update_id);
                    
                    // Обработка callback-запросов
                    if (update.callback_query) {
                        const callbackData = update.callback_query.data;
                        if (callbackData.startsWith('reply_')) {
                            const targetSessionId = callbackData.substring(6);
                            if (targetSessionId === userSessionId) {
                                addChatMessage('👨‍💼 Оператор хочет вам ответить. Напишите ваш вопрос.', false);
                            }
                        }
                    }
                });
            }
        })
        .catch(error => console.error('Error checking callbacks:', error));
}

// Добавьте этот вызов в initializeApp()
setInterval(checkCallbacks, 3000);

// Отправка уведомления о ручной оплате
function sendManualPaymentNotification(paymentData) {
    if (!BOT_CONFIG.BOT_TOKEN) return;

    const message = `⏳ ОЖИДАНИЕ РУЧНОЙ ОПЛАТЫ BPMshopSGH

👤 ID игрока: ${userGameId}
🎮 Продукт: ${currentOrder.name}
💰 Сумма: ${currentOrder.price}
📋 Номер заказа: ${paymentData.orderId}
💳 Метод оплаты: Перевод на карту

🔍 Статус: Ожидание подтверждения
⏰ Время: ${new Date(paymentData.timestamp).toLocaleString()}
💳 Реквизиты: ${PAYMENT_CONFIG.MANUAL_PAYMENT_DETAILS.card_number}

⚠️ ТРЕБУЕТСЯ ПОДТВЕРЖДЕНИЕ ОПЕРАТОРА`;

    sendTelegramMessage(message);
}

// Сохранение данных заказа
function saveOrderData(orderId, paymentData) {
    const orderData = {
        orderId: orderId,
        product: currentOrder,
        userGameId: userGameId,
        payment: paymentData,
        sessionId: userSessionId,
        status: 'paid',
        timestamp: new Date().toISOString(),
        deliveryStatus: 'waiting'
    };
    
    localStorage.setItem('current_order', JSON.stringify(orderData));
    localStorage.setItem('order_' + orderId, JSON.stringify(orderData));
    
    const orders = JSON.parse(localStorage.getItem('bp_orders') || '[]');
    orders.push(orderData);
    localStorage.setItem('bp_orders', JSON.stringify(orders));
}

// Проверка статуса доставки
function checkDeliveryStatus() {
    if (!currentOrderId) return;
    
    const savedOrder = localStorage.getItem('order_' + currentOrderId);
    if (!savedOrder) return;
    
    const orderData = JSON.parse(savedOrder);
    
    if (orderData.deliveryStatus === 'delivered') {
        showDeliverySuccessPage(orderData);
    } else if (orderData.deliveryStatus === 'cancelled') {
        showDeliveryCancelledPage(orderData);
    }
}

// Запуск проверки статуса доставки
function startDeliveryStatusCheck() {
    const checkInterval = setInterval(() => {
        if (!currentOrderId) {
            clearInterval(checkInterval);
            return;
        }
        
        const savedOrder = localStorage.getItem('order_' + currentOrderId);
        if (!savedOrder) {
            clearInterval(checkInterval);
            return;
        }
        
        const orderData = JSON.parse(savedOrder);
        
        if (orderData.deliveryStatus === 'delivered') {
            clearInterval(checkInterval);
            showDeliverySuccessPage(orderData);
        } else if (orderData.deliveryStatus === 'cancelled') {
            clearInterval(checkInterval);
            showDeliveryCancelledPage(orderData);
        }
        
        const orderTime = new Date(orderData.timestamp).getTime();
        const currentTime = new Date().getTime();
        if (currentTime - orderTime > 30 * 60 * 1000) {
            clearInterval(checkInterval);
        }
    }, 5000);
}

// Страница успешной доставки
function showDeliverySuccessPage(orderData) {
    const deliveryPage = document.getElementById('delivery-page');
    const successPage = document.getElementById('success-page');
    
    deliveryPage.style.display = 'none';
    successPage.style.display = 'block';
    
    const successDetails = document.getElementById('success-order-details');
    const receipt = document.getElementById('payment-receipt');
    
    if (successDetails && currentOrder) {
        successDetails.innerHTML = `
            <div class="delivery-success">
                <div class="status-success">
                    <i class="fas fa-gift"></i>
                    <h3>Голда доставлена!</h3>
                </div>
                
                <div class="success-info">
                    <div class="info-item">
                        <strong>Заказ:</strong>
                        <span>${currentOrder.name}</span>
                    </div>
                    <div class="info-item">
                        <strong>Получено на ID:</strong>
                        <span>${userGameId}</span>
                    </div>
                    <div class="info-item">
                        <strong>Номер заказа:</strong>
                        <span>${orderData.orderId}</span>
                    </div>
                    <div class="info-item">
                        <strong>Время доставки:</strong>
                        <span>${new Date().toLocaleString()}</span>
                    </div>
                </div>

                <div class="success-message">
                    <p>✅ <strong>Голда успешно зачислена на ваш аккаунт!</strong></p>
                    <p>Можете проверять баланс в игре. Приятной игры! 🎮</p>
                </div>

                <div class="rate-service">
                    <p>Оцените наш сервис:</p>
                    <div class="rating-stars">
                        <span class="star" onclick="rateService(5)">⭐</span>
                        <span class="star" onclick="rateService(4)">⭐</span>
                        <span class="star" onclick="rateService(3)">⭐</span>
                        <span class="star" onclick="rateService(2)">⭐</span>
                        <span class="star" onclick="rateService(1)">⭐</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (receipt) {
        receipt.innerHTML = `
            <div class="receipt-info">
                <h4>Чек об оплате и доставке</h4>
                <div class="receipt-details">
                    <p><strong>Магазин:</strong> ${PAYMENT_CONFIG.SHOP_NAME}</p>
                    <p><strong>Товар:</strong> ${currentOrder.name}</p>
                    <p><strong>Сумма:</strong> ${currentOrder.price}</p>
                    <p><strong>ID заказа:</strong> ${orderData.orderId}</p>
                    <p><strong>ID игрока:</strong> ${userGameId}</p>
                    <p><strong>Время оплаты:</strong> ${new Date(orderData.timestamp).toLocaleString()}</p>
                    <p><strong>Время доставки:</strong> ${new Date().toLocaleString()}</p>
                    <div class="status-success">
                        <i class="fas fa-check-circle"></i>
                        <span>Заказ выполнен успешно</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    sendDeliveryConfirmation(orderData);
}

// Страница отмены доставки
function showDeliveryCancelledPage(orderData) {
    const deliveryPage = document.getElementById('delivery-page');
    const successPage = document.getElementById('success-page');
    
    deliveryPage.style.display = 'none';
    successPage.style.display = 'block';
    
    const successDetails = document.getElementById('success-order-details');
    const receipt = document.getElementById('payment-receipt');
    
    if (successDetails) {
        successDetails.innerHTML = `
            <div class="delivery-cancelled">
                <div class="status-error">
                    <i class="fas fa-times-circle"></i>
                    <h3>Заказ отменен</h3>
                </div>
                
                <div class="cancelled-info">
                    <p>К сожалению, ваш заказ был отменен оператором.</p>
                    <p><strong>Причина:</strong> ${orderData.cancelReason || 'Не указана'}</p>
                    <p><strong>Номер заказа:</strong> ${orderData.orderId}</p>
                </div>

                <div class="refund-info">
                    <p>💰 <strong>Средства будут возвращены на ваш счет в течение 1-3 рабочих дней.</strong></p>
                    <p>Если возврат не поступил, свяжитесь с поддержкой.</p>
                </div>

                <div class="support-contact">
                    <button class="btn btn-outline" onclick="openSupportChat()">
                        <i class="fas fa-headset"></i> Связаться с поддержкой
                    </button>
                </div>
            </div>
        `;
    }
}

// Отправка подтверждения доставки
function sendDeliveryConfirmation(orderData) {
    if (!BOT_CONFIG.BOT_TOKEN) return;

    const message = `✅ ДОСТАВКА ПОДТВЕРЖДЕНА ПОЛЬЗОВАТЕЛЕМ

Заказ: ${orderData.orderId}
Игрок: ${userGameId}
Продукт: ${currentOrder.name}

Пользователь подтвердил получение голды!`;

    sendTelegramMessage(message);
}

// Оценка сервиса
function rateService(rating) {
    if (!BOT_CONFIG.BOT_TOKEN) return;

    const message = `⭐ ОЦЕНКА СЕРВИСА: ${rating}/5

Заказ: ${currentOrderId}
Игрок: ${userGameId}
Продукт: ${currentOrder.name}

Спасибо за оценку!`;

    sendTelegramMessage(message);
    
    alert(`Спасибо за оценку ${rating} ⭐!`);
}

// Глобальная переменная для хранения обработанных сообщений
let processedMessages = new Set();

// УМНАЯ проверка ответов от оператора - БЕЗ ДУБЛИРОВАНИЯ
function checkForOperatorReplies() {
    if (!BOT_CONFIG.BOT_TOKEN || !userSessionId) return;
    
    const url = `https://api.telegram.org/bot${BOT_CONFIG.BOT_TOKEN}/getUpdates?offset=${getLastUpdateId() + 1}&timeout=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok && data.result && data.result.length > 0) {
                data.result.forEach(update => {
                    const updateId = update.update_id;
                    setLastUpdateId(updateId);
                    
                    // Пропускаем если уже обрабатывали это сообщение
                    if (processedMessages.has(updateId)) {
                        return;
                    }
                    
                    if (update.message && update.message.text) {
                        const messageText = update.message.text;
                        const messageId = update.message.message_id;
                        
                        // БЫСТРАЯ ПРОВЕРКА: сообщение должно содержать нашу сессию
                        if (!messageText.includes(userSessionId)) {
                            return;
                        }
                        
                        console.log('New message for user:', messageText);
                        
                        // Помечаем сообщение как обработанное
                        processedMessages.add(updateId);
                        
                        // Ограничиваем размер Set чтобы не рос бесконечно
                        if (processedMessages.size > 100) {
                            const first = processedMessages.values().next().value;
                            processedMessages.delete(first);
                        }
                        
                        // Обработка команд
                        if (messageText.startsWith('/delivered ')) {
                            const parts = messageText.substring(11).split('|');
                            if (parts.length >= 2 && parts[1].trim() === userSessionId) {
                                if (!markOrderAsDelivered(parts[0].trim())) {
                                    addChatMessage('✅ Оператор подтвердил доставку голды! Проверяйте баланс в игре.', false);
                                }
                            }
                        }
                        else if (messageText.startsWith('/cancel ')) {
                            const parts = messageText.substring(8).split('|');
                            if (parts.length >= 3 && parts[1].trim() === userSessionId) {
                                if (!markOrderAsCancelled(parts[0].trim(), parts[2].trim())) {
                                    addChatMessage('❌ Оператор отменил заказ. Причина: ' + parts[2].trim(), false);
                                }
                            }
                        }
                        else if (messageText.startsWith('/ask ')) {
                            const parts = messageText.substring(5).split('|');
                            if (parts.length === 2 && parts[0].trim() === userSessionId) {
                                addChatMessage('👨‍💼 Оператор: ' + parts[1].trim(), false);
                            }
                        }
                    }
                });
            }
        })
        .catch(error => console.error('Error checking replies:', error));
}

// Функции для работы с последним update_id
function getLastUpdateId() {
    return parseInt(localStorage.getItem('last_update_id') || '0');
}

function setLastUpdateId(updateId) {
    localStorage.setItem('last_update_id', updateId.toString());
}

// Пометить заказ как доставленный
// Пометить заказ как доставленный (с проверкой дублирования)
function markOrderAsDelivered(orderId) {
    const savedOrder = localStorage.getItem('order_' + orderId);
    if (savedOrder) {
        const orderData = JSON.parse(savedOrder);
        
        // Проверяем, не был ли уже доставлен заказ
        if (orderData.deliveryStatus === 'delivered') {
            return true; // Уже доставлен
        }
        
        orderData.deliveryStatus = 'delivered';
        orderData.deliveredAt = new Date().toISOString();
        orderData.status = 'delivered';
        
        localStorage.setItem('order_' + orderId, JSON.stringify(orderData));
        localStorage.setItem('current_order', JSON.stringify(orderData));
        
        console.log('Order marked as delivered:', orderId);
        
        if (currentOrderId === orderId) {
            showDeliverySuccessPage(orderData);
        }
        
        return false; // Не был доставлен
    }
    return true; // Заказ не найден
}

// Пометить заказ как отмененный (с проверкой дублирования)
function markOrderAsCancelled(orderId, reason) {
    const savedOrder = localStorage.getItem('order_' + orderId);
    if (savedOrder) {
        const orderData = JSON.parse(savedOrder);
        
        // Проверяем, не был ли уже отменен заказ
        if (orderData.deliveryStatus === 'cancelled') {
            return true; // Уже отменен
        }
        
        orderData.deliveryStatus = 'cancelled';
        orderData.status = 'cancelled';
        orderData.cancelReason = reason;
        orderData.cancelledAt = new Date().toISOString();
        
        localStorage.setItem('order_' + orderId, JSON.stringify(orderData));
        localStorage.setItem('current_order', JSON.stringify(orderData));
        
        console.log('Order marked as cancelled:', orderId);
        
        if (currentOrderId === orderId) {
            showDeliveryCancelledPage(orderData);
        }
        
        return false; // Не был отменен
    }
    return true; // Заказ не найден
}

// Отправка сообщения в Telegram
function sendTelegramMessage(message) {
    const url = 'https://api.telegram.org/bot' + BOT_CONFIG.BOT_TOKEN + '/sendMessage';
    const data = {
        chat_id: BOT_CONFIG.CHAT_ID,
        text: message,
        parse_mode: "HTML"
    };
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    }).catch(error => console.error('Error sending message:', error));
}

// Инициализация чата
function initChat() {
    const chatBody = document.getElementById('chat-body');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!chatBody || !userInput || !sendBtn) {
        console.log('Chat elements not found');
        return;
    }
    
    sendBtn.addEventListener('click', function() {
        const message = userInput.value.trim();
        if (message) {
            addChatMessage(message, true);
            sendToTelegram(message);
            userInput.value = '';
        }
    });
    
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendBtn.click();
        }
    });
    
    console.log('Chat initialized');
}

// Добавление сообщения в чат
function addChatMessage(text, isUser) {
    const chatBody = document.getElementById('chat-body');
    if (!chatBody) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isUser ? 'message-user' : 'message-support');
    messageDiv.textContent = text;
    
    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Отправка сообщения в Telegram (чат поддержки)
// Улучшенная функция отправки сообщений в Telegram
// УПРОЩЕННАЯ отправка сообщений в Telegram
function sendToTelegram(message) {
    if (!BOT_CONFIG.BOT_TOKEN) {
        addChatMessage('Сообщение сохранено. Настройте Telegram бота.', false);
        return;
    }
    
    const url = 'https://api.telegram.org/bot' + BOT_CONFIG.BOT_TOKEN + '/sendMessage';
    const data = {
        chat_id: BOT_CONFIG.CHAT_ID,
        text: `👤 [${userSessionId}] ID: ${userGameId || 'не указан'}\n💬 ${message}`,
        parse_mode: "HTML"
    };
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.ok) {
            console.log('Message sent to Telegram');
            addChatMessage('✅ Сообщение отправлено оператору', false);
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
    });
}

// Проверка конфигурации бота
function checkBotConfig() {
    const chatBody = document.getElementById('chat-body');
    if (!chatBody) return;
    
    if (!BOT_CONFIG.BOT_TOKEN) {
        addChatMessage('💬 Чат поддержки работает в демо-режиме.', false);
        return false;
    }
    
    addChatMessage('🤖 Telegram бот BPMshopSGH подключен. Вы можете задать вопрос оператору!', false);
    return true;
}

// Анимации
function initAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');
    if (fadeElements.length === 0) return;
    
    const fadeInObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    
    fadeElements.forEach(function(el) {
        el.style.opacity = 0;
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        fadeInObserver.observe(el);
    });
}

// Проверка возврата с оплаты
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('order');
    
    if (paymentStatus === 'success' && orderId) {
        const savedOrder = localStorage.getItem('order_' + orderId);
        if (savedOrder) {
            const orderData = JSON.parse(savedOrder);
            currentOrder = orderData.product;
            userGameId = orderData.userGameId;
            currentOrderId = orderId;
            
            showDeliveryPage(orderData.payment);
        }
        
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Глобальные функции
window.startOrder = startOrder;
window.showManualPayment = showManualPayment;
window.copyToClipboard = copyToClipboard;
window.openSupportChat = openSupportChat;
window.rateService = rateService;