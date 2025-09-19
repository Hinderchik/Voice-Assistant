import logging
import os
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, ConversationHandler, filters
from flask import Flask, request
import asyncio

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация
API_TOKEN = os.environ.get('TELEGRAM_TOKEN', '8394353258:AAE32axrlAIZ3aIGIYE4K1S-6E8EGpZ4YhY')
ADMIN_CHAT_ID = -1003020118085
RENDER_URL = os.environ.get('RENDER_EXTERNAL_URL', '')
WEBHOOK_URL = f'{RENDER_URL}/webhook' if RENDER_URL else ''
PORT = int(os.environ.get('PORT', 10000))

# Состояния
WAITING_FOR_SCREENSHOT, WAITING_FOR_ACCOUNT_ID, WAITING_FOR_REVIEW, WAITING_FOR_REJECT_REASON = range(4)

# Инициализация приложений
application = Application.builder().token(API_TOKEN).build()
app = Flask(__name__)

# Клавиатуры
def get_products_keyboard():
    keyboard = [
        [InlineKeyboardButton("💰 50 г → 80₽", callback_data="product_50")],
        [InlineKeyboardButton("💰 165 г → 200₽", callback_data="product_165")],
        [InlineKeyboardButton("💰 625 г → 540₽", callback_data="product_625")],
        [InlineKeyboardButton("💰 1625 г → 1400₽", callback_data="product_1625")],
        [InlineKeyboardButton("💰 6750 г → 5250₽", callback_data="product_6750")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_check_status_keyboard():
    keyboard = [[KeyboardButton("📋 Проверить статус покупки")]]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def get_admin_keyboard(purchase_id):
    keyboard = [
        [
            InlineKeyboardButton("✅ Подтвердить перевод", callback_data=f"confirm_{purchase_id}"),
            InlineKeyboardButton("❌ Отклонить с комментарием", callback_data=f"reject_{purchase_id}")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_review_keyboard():
    keyboard = [[KeyboardButton("⭐ Оставить отзыв")]]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

# Обработчики команд (остаются без изменений)
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = """
🎮 *Добро пожаловать в официальный магазин доната для BLOCKPOST mobile!* 🎮

✨ *Преимущества нашего магазина:*
• ⚡ Мгновенная доставка голды
• 🔐 Безопасные платежи
• 👨‍💼 Круглосуточная поддержка
• 💎 Лучшие цены на рынке

🏆 *Выберите нужный пакет голды:*
┌──────────────────┐
│💰 50 г      →    80₽   │
├──────────────────┤
│💰 165 г    →   200₽   │
├──────────────────┤
│💰 625 г    →   540₽   │
├──────────────────┤
│💰 1625 г  →  1400₽   │
├──────────────────┤
│💰 6750 г  →  5250₽   │
└──────────────────┘

💡 *Как купить:*
1. Выберите пакет голды
2. Оплатите на карту
3. Нажмите "📋 Проверить статус покупки"
4. Отправьте скриншот оплаты и ID аккаунта

🛡️ *Гарантия качества!* Если голда не придет в течение 15 минут - вернем деньги!
    """
    await update.message.reply_text(welcome_text, reply_markup=get_products_keyboard(), parse_mode='Markdown')

async def process_product_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    product_data = {
        'product_50': {'gold': '50 г', 'price': '80₽'},
        'product_165': {'gold': '165 г', 'price': '200₽'},
        'product_625': {'gold': '625 г', 'price': '540₽'},
        'product_1625': {'gold': '1625 г', 'price': '1400₽'},
        'product_6750': {'gold': '6750 г', 'price': '5250₽'}
    }
    
    product = product_data[query.data]
    
    payment_text = f"""
🎯 *Вы выбрали: {product['gold']} за {product['price']}*

💳 *Для оплаты переведите {product['price']} на карту:*
`2202 2063 6626 0763`

📋 *Инструкция по оплате:*
1. Откройте ваш банковский приложение
2. Переведите точную сумму {product['price']}
3. Обязательно сохраните скриншот оплаты!
4. После оплаты нажмите кнопку «📋 Проверить статус покупки»

⏱️ *Доставка:* В течение 15 минут после подтверждения оплаты

❓ *Возникли проблемы?* Свяжитесь с поддержкой: @Skuuuchn
    """
    
    await query.edit_message_text(payment_text, reply_markup=get_check_status_keyboard(), parse_mode='Markdown')

async def check_purchase_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    instruction_text = """
📸 *ШАГ 1 из 2: Отправьте скриншот оплаты*

📋 *Что должно быть на скриншоте:*
• ✅ Сумма перевода
• ✅ Номер карты получателя
• ✅ Дата и время операции
• ✅ Статус "Успешно"

💡 *Совет:* Добавьте текст к фото (например, "Оплата голды") чтобы мы быстрее обработали заявку

📝 *Пример:* "Перевод 200₽ на карту 2202****0763"
    """
    await update.message.reply_text(instruction_text, parse_mode='Markdown')
    return WAITING_FOR_SCREENSHOT

async def process_screenshot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.caption:
        error_text = """
❌ *Скриншот без описания*

📝 Пожалуйста, отправьте скриншот с текстовым описанием, например:
• "Оплата за 165 г"
• "Перевод 200₽"
• "Заказ голды"

Это ускорит обработку вашего заказа! ⚡
        """
        await update.message.reply_text(error_text, parse_mode='Markdown')
        return WAITING_FOR_SCREENSHOT
    
    context.user_data['screenshot'] = update.message.photo[-1].file_id
    context.user_data['screenshot_text'] = update.message.caption
    
    account_text = """
🎮 *ШАГ 2 из 2: Укажите ваш ID в игре*

📋 *Как найти ID аккаунта:*
1. Откройте BLOCKPOST mobile
2. Зайдите в профиль (иконка человека)
3. Скопируйте цифровой ID из профиля
4. Отправьте его мне

🔢 *ID выглядит так:* 1234567890

⚠️ *Внимание:* Убедитесь, что ID правильный! Голда будет зачислена на этот аккаунт.
    """
    await update.message.reply_text(account_text, parse_mode='Markdown')
    return WAITING_FOR_ACCOUNT_ID

async def process_account_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account_id = update.message.text
    user_data = context.user_data
    
    context.user_data['account_id'] = account_id
    
    admin_message = f"""
🛒 *НОВАЯ ПОКУПКА!* 🛒

👤 *Покупатель:* @{update.message.from_user.username or 'без username'} ({update.message.from_user.id})
🎮 *ID аккаунта:* `{account_id}`
📝 *Комментарий:* {user_data['screenshot_text']}

⏰ *Время:* {update.message.date.strftime('%H:%M:%S')}
    """
    
    try:
        await context.bot.send_photo(
            chat_id=ADMIN_CHAT_ID,
            photo=user_data['screenshot'],
            caption=admin_message,
            reply_markup=get_admin_keyboard(update.message.from_user.id),
            parse_mode='Markdown'
        )
        
        success_text = """
✅ *Заявка принята!*

📋 *Статус:* Ожидает подтверждения администратором

⏱️ *Обычно это занимает:* 2-5 минут
📞 *Поддержка:* @Skuuuchn

💎 Как только оплата будет подтверждена, голда автоматически появится на вашем аккаунте!

🔄 *Статус можно проверить:* Напишите любое сообщение боту
        """
        await update.message.reply_text(success_text, parse_mode='Markdown')
        
    except Exception as e:
        error_text = """
❌ *Ошибка при обработке заявки*

⚠️ Пожалуйста, попробуйте еще раз через 2-3 минуты
📞 Если ошибка повторяется - свяжитесь с поддержкой: @Skuuuchn
        """
        await update.message.reply_text(error_text, parse_mode='Markdown')
        logger.error(f"Error sending to admin: {e}")
    
    return ConversationHandler.END

async def confirm_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    try:
        success_text = """
🎉 *ОПЛАТА ПОДТВЕРЖДЕНА!* 🎉

✅ *Голда успешно зачислена на ваш аккаунт!*

💎 *Что делать дальше:*
1. Проверьте баланс в игре
2. Наслаждайтесь покупками!
3. Оставьте отзыв о нашей работе

⭐ *Хотите помочь другим игрокам?* Оставьте отзыв о нашем сервисе!
        """
        await context.bot.send_message(
            chat_id=user_id,
            text=success_text,
            reply_markup=get_review_keyboard(),
            parse_mode='Markdown'
        )
        
        await query.edit_message_caption(
            caption=f"✅ *Перевод подтвержден* администратором @{query.from_user.username}\n"
                    f"👤 *Покупатель уведомлен*\n"
                    f"⏰ *Время:* {query.message.date.strftime('%H:%M:%S')}",
            parse_mode='Markdown',
            reply_markup=None
        )
        
    except Exception as e:
        logger.error(f"Error confirming transfer: {e}")

async def reject_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    context.user_data['reject_user_id'] = user_id
    
    # Сохраняем message_id для последующего редактирования
    context.user_data['reject_message_id'] = query.message.message_id
    
    reject_text = """
❌ *ОТКЛОНЕНИЕ ПЕРЕВОДА*

📝 Пожалуйста, укажите причину отклонения для покупателя:

💡 *Примеры причин:*
• Неправильная сумма перевода
• Нечитаемый скриншот
• Ошибка в ID аккаунта
• Подозрение на мошенничество
• Другая причина

📞 *Примечание:* Покупатель увидит этот комментарий
    """
    
    await query.message.reply_text(reject_text, parse_mode='Markdown')
    return WAITING_FOR_REJECT_REASON

async def process_reject_reason(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reject_reason = update.message.text
    user_id = context.user_data['reject_user_id']
    message_id = context.user_data['reject_message_id']
    
    try:
        # Уведомляем покупателя с комментарием
        reject_text = f"""
❌ *ОПЛАТА НЕ ПОДТВЕРЖДЕНА*

📋 *Причина:* {reject_reason}

⚠️ *Что делать:*
• Проверьте правильность данных
• Убедитесь в читаемости скриншота
• Свяжитесь с поддержкой для уточнения

📞 *Поддержка:* @Skuuuchn

💡 *Обычно мы отвечаем в течение 5 минут*
        """
        
        await context.bot.send_message(
            chat_id=user_id,
            text=reject_text,
            parse_mode='Markdown'
        )
        
        # Обновляем сообщение у админа
        await context.bot.edit_message_caption(
            chat_id=ADMIN_CHAT_ID,
            message_id=message_id,
            caption=f"❌ *Перевод отклонен* администратором @{update.message.from_user.username}\n"
                    f"📝 *Причина:* {reject_reason}\n"
                    f"⏰ *Время:* {update.message.date.strftime('%H:%M:%S')}\n"
                    f"👤 *Покупатель уведомлен*",
            parse_mode='Markdown',
            reply_markup=None
        )
        
        await update.message.reply_text("✅ Покупатель уведомлен о причине отклонения!", parse_mode='Markdown')
        
    except Exception as e:
        logger.error(f"Error rejecting transfer: {e}")
        await update.message.reply_text("❌ Ошибка при отправке уведомления покупателю", parse_mode='Markdown')
    
    return ConversationHandler.END

async def request_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    review_text = """
⭐ *ПОДЕЛИТЕСЬ ВПЕЧАТЛЕНИЕМ!* ⭐

📝 *Нам важно ваше мнение!* Оставьте отзыв о нашей работе:

💬 *Что можно написать:*
• Насколько быстро пришла голда
• Качество обслуживания
• Предложения по улучшению
• Рекомендации другим игрокам

📸 *Можно прикрепить скриншот* с голдой на аккаунте (не обязательно)

🙏 *Спасибо за ваше время!* Это поможет нам стать лучше!
    """
    await update.message.reply_text(review_text, parse_mode='Markdown')
    return WAITING_FOR_REVIEW

async def process_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    username = update.message.from_user.username or 'нет username'
    
    if update.message.photo:
        photo_id = update.message.photo[-1].file_id
        review_text = update.message.caption or "Без текстового отзыва"
        
        review_message = f"""
⭐ *НОВЫЙ ОТЗЫВ С ФОТО!* ⭐

👤 *От:* @{username} ({user_id})
📝 *Текст:* {review_text}
🎮 *ID аккаунта:* {context.user_data.get('account_id', 'не указан')}

🌟 *Оценка:* ⭐⭐⭐⭐⭐ (с фото)
        """
        
        try:
            await context.bot.send_photo(
                chat_id=ADMIN_CHAT_ID,
                photo=photo_id,
                caption=review_message,
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Error sending review photo: {e}")
            
    else:
        review_text = update.message.text
        
        review_message = f"""
⭐ *НОВЫЙ ОТЗЫВ!* ⭐

👤 *От:* @{username} ({user_id})
📝 *Текст:* {review_text}
🎮 *ID аккаунта:* {context.user_data.get('account_id', 'не указан')}

🌟 *Оценка:* ⭐⭐⭐⭐⭐
        """
        
        try:
            await context.bot.send_message(
                chat_id=ADMIN_CHAT_ID,
                text=review_message,
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Error sending review text: {e}")
    
    thank_you_text = """
🙏 *СПАСИБО БОЛЬШОЕ ЗА ОТЗЫВ!* 🙏

💎 Ваше мнение очень важно для нас!
⭐ Благодаря таким отзывам мы становимся лучше

🔄 *Хотите купить еще голды?* Просто напишите /start

📞 *Всегда рады помочь:* @Skuuuchn

🎮 *Приятной игры!* 🎮
    """
    await update.message.reply_text(thank_you_text, parse_mode='Markdown')
    
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    cancel_text = """
🛑 *ОПЕРАЦИЯ ОТМЕНЕНА*

💡 Если у вас возникли проблемы с оплатой:
📞 Свяжитесь с поддержкой: @Skuuuchn

🔄 Чтобы начать заново, напишите /start
    """
    await update.message.reply_text(cancel_text, parse_mode='Markdown')
    context.user_data.clear()
    return ConversationHandler.END

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = """
🤖 *Бот магазина BLOCKPOST mobile*

💎 Для покупки голды используйте команду /start
📞 Поддержка: @Skuuuchn

🔄 Если у вас есть незавершенный заказ, продолжайте общение с ботом
    """
    await update.message.reply_text(help_text, parse_mode='Markdown')

# Flask endpoints
@app.route('/')
def home():
    return "🤖 Бот активен! Используйте Telegram для общения."

@app.route('/webhook', methods=['POST'])
def webhook():
    """Endpoint для обработки вебхуков от Telegram"""
    try:
        json_data = request.get_json()
        update = Update.de_json(json_data, application.bot)
        
        # Создаем новое событие цикла для асинхронной обработки
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(application.process_update(update))
        loop.close()
        
        return 'ok'
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return 'error', 500

@app.route('/health')
def health():
    """Эндпоинт для проверки здоровья приложения"""
    return "✅ Бот работает нормально", 200

@app.route('/set_webhook')
def set_webhook_manual():
    """Ручная установка вебхука для debugging"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Удаляем старый вебхук
        loop.run_until_complete(application.bot.delete_webhook())
        
        # Устанавливаем новый вебхук
        result = loop.run_until_complete(application.bot.set_webhook(WEBHOOK_URL))
        
        loop.close()
        return f"✅ Webhook установлен: {result}", 200
        
    except Exception as e:
        return f"❌ Ошибка: {e}", 500

# Регистрация обработчиков
def register_handlers():
    conv_handler_purchase = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📋 Проверить статус покупки$"), check_purchase_status)],
        states={
            WAITING_FOR_SCREENSHOT: [
                MessageHandler(filters.PHOTO & filters.CAPTION, process_screenshot),
                MessageHandler(filters.PHOTO & ~filters.CAPTION, lambda u, c: u.message.reply_text("❌ Пожалуйста, отправьте скриншот с текстом (например, 'Оплата 200₽')", parse_mode='Markdown'))
            ],
            WAITING_FOR_ACCOUNT_ID: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_account_id)
            ]
        },
        fallbacks=[CommandHandler("cancel", cancel)]
    )
    
    conv_handler_review = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^⭐ Оставить отзыв$"), request_review)],
        states={
            WAITING_FOR_REVIEW: [
                MessageHandler(filters.TEXT | filters.PHOTO, process_review)
            ]
        },
        fallbacks=[CommandHandler("cancel", cancel)]
    )
    
    conv_handler_reject = ConversationHandler(
        entry_points=[CallbackQueryHandler(reject_transfer, pattern="^reject_")],
        states={
            WAITING_FOR_REJECT_REASON: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_reject_reason)
            ]
        },
        fallbacks=[CommandHandler("cancel", cancel)]
    )
    
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CallbackQueryHandler(process_product_selection, pattern="^product_"))
    application.add_handler(CallbackQueryHandler(confirm_transfer, pattern="^confirm_"))
    application.add_handler(conv_handler_reject)
    application.add_handler(conv_handler_purchase)
    application.add_handler(conv_handler_review)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

# Основная функция
def main():
    """Запуск приложения"""
    print("🤖 Запуск Telegram бота на Render.com...")
    print(f"🌐 Webhook URL: {WEBHOOK_URL}")
    print(f"🔧 Port: {PORT}")
    
    # Регистрируем обработчики
    register_handlers()
    
    # Запускаем Flask
    app.run(host='0.0.0.0', port=PORT, debug=False)

if __name__ == '__main__':
    main()
