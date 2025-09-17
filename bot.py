import logging
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, ConversationHandler, filters
from flask import Flask
import threading
import os

# Настройка логирования
logging.basicConfig(level=logging.INFO)

# Токен бота
API_TOKEN = '8394353258:AAE32axrlAIZ3aIGIYE4K1S-6E8EGpZ4YhY'

# ID чата для подтверждения
ADMIN_CHAT_ID = -1003020118085

# Состояния
WAITING_FOR_SCREENSHOT, WAITING_FOR_ACCOUNT_ID, WAITING_FOR_REVIEW = range(3)

# Клавиатура с товарами
def get_products_keyboard():
    keyboard = [
        [InlineKeyboardButton("💰 50 г → 80₽", callback_data="product_50")],
        [InlineKeyboardButton("💰 165 г → 200₽", callback_data="product_165")],
        [InlineKeyboardButton("💰 625 г → 540₽", callback_data="product_625")],
        [InlineKeyboardButton("💰 1625 г → 1400₽", callback_data="product_1625")],
        [InlineKeyboardButton("💰 6750 г → 5250₽", callback_data="product_6750")]
    ]
    return InlineKeyboardMarkup(keyboard)

# Клавиатура для проверки статуса
def get_check_status_keyboard():
    keyboard = [[KeyboardButton("📋 Проверить статус покупки")]]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

# Клавиатура для админов
def get_admin_keyboard(purchase_id):
    keyboard = [
        [
            InlineKeyboardButton("✅ Подтвердить перевод", callback_data=f"confirm_{purchase_id}"),
            InlineKeyboardButton("❌ Отклонить", callback_data=f"reject_{purchase_id}")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

# Клавиатура для отзыва
def get_review_keyboard():
    keyboard = [[KeyboardButton("⭐ Оставить отзыв")]]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

# Обработчик команды /start
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
4. Отправьте скриншот оплаты и ID аккаунт
    """
    await update.message.reply_text(welcome_text, reply_markup=get_products_keyboard(), parse_mode='Markdown')

# Обработчик выбора товара
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
🎯 *Вы выбрали: {product['gold']}*

💳 *Для оплаты переведите {product['price']} на карту:*
`2202 2063 6626 0763`

📋 *Инструкция по оплате:*
1. Откройте ваш банковский приложение
2. Переведите точную сумму {product['price']}
3. Обязательно сохраните скриншот оплаты!
4. После оплаты нажмите кнопку «📋 Проверить статус покупки»

⏱️ *Доставка:* В среднем 15 минут после подтверждения оплаты (ночью дольше)

❓ *Возникли проблемы?* Свяжитесь с поддержкой: @Skuuuchn
    """
    
    await query.message.reply_text(
        payment_text, 
        reply_markup=get_check_status_keyboard(),
        parse_mode='Markdown'
    )

# Обработчик кнопки "Проверить статус покупки"
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

# Обработчик скриншота
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

# Обработчик ID аккаунта
async def process_account_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account_id = update.message.text
    user_data = context.user_data
    
    # Сохраняем ID аккаунта
    context.user_data['account_id'] = account_id
    
    # Отправляем данные админам
    admin_message = f"""
🛒 *НОВАЯ ПОКУПКА!* 🛒

👤 *Покупатель:* @{update.message.from_user.username or 'без username'} ({update.message.from_user.id})
🎮 *ID аккаунта:* `{account_id}`
📝 *Комментарий:* {user_data['screenshot_text']}
💰 *Сумма:* {user_data.get('amount', 'не указана')}

⏰ *Время:* {update.message.date.strftime('%H:%M:%S')}
    """
    
    try:
        # Отправляем фото с текстом и кнопкой подтверждения
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
        logging.error(f"Error sending to admin: {e}")
    
    return ConversationHandler.END

# Обработчик подтверждения перевода админом
async def confirm_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    try:
        # Уведомляем покупателя
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
        
        # Обновляем сообщение у админа
        await query.message.edit_caption(
            caption=f"✅ *Перевод подтвержден* администратором @{query.from_user.username}\n"
                    f"👤 *Покупатель уведомлен*\n"
                    f"⏰ *Время:* {query.message.date.strftime('%H:%M:%S')}",
            parse_mode='Markdown'
        )
        
    except Exception as e:
        logging.error(f"Error confirming transfer: {e}")

# Обработчик кнопки "Оставить отзыв"
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

# Обработчик отзыва
async def process_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    username = update.message.from_user.username or 'нет username'
    
    if update.message.photo:
        # Если есть фото
        photo_id = update.message.photo[-1].file_id
        review_text = update.message.caption or "Без текстового отзыва"
        
        # Отправляем админам
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
            logging.error(f"Error sending review photo: {e}")
            
    else:
        # Если только текст
        review_text = update.message.text
        
        # Отправляем админам
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
            logging.error(f"Error sending review text: {e}")
    
    # Благодарим пользователя
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

# Обработчик отклонения перевода админом
async def reject_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    try:
        # Уведомляем покупателя
        reject_text = """
❌ *ОПЛАТА НЕ ПОДТВЕРЖДЕНА*

⚠️ *Возможные причины:*
• Неправильная сумма перевода
• Скриншот нечитаем
• Ошибка в ID аккаунта
• Подозрение на мошенничество

📞 *Для выяснения причин* свяжитесь с поддержкой: @Skuuuchn

💡 *Обычно мы отвечаем в течение 5 минут*
        """
        await context.bot.send_message(
            chat_id=user_id,
            text=reject_text,
            parse_mode='Markdown'
        )
        
        # Обновляем сообщение у админа
        await query.message.edit_caption(
            caption=f"❌ *Перевод отклонен* администратором @{query.from_user.username}\n"
                    f"⏰ *Время:* {query.message.date.strftime('%H:%M:%S')}\n"
                    f"📞 *Покупатель уведомлен*",
            parse_mode='Markdown'
        )
        
    except Exception as e:
        logging.error(f"Error rejecting transfer: {e}")

# Обработчик отмены
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

# Создаем Flask app для Render
app = Flask(__name__)

@app.route('/')
def home():
    return "🤖 Telegram Bot is running!"

@app.route('/health')
def health():
    return "✅ Bot is healthy!"

def run_bot():
    # Создаем приложение
    application = Application.builder().token(API_TOKEN).build()
    
    # Обработчик диалога для покупки
    conv_handler_purchase = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📋 Проверить статус покупки$"), check_purchase_status)],
        states={
            WAITING_FOR_SCREENSHOT: [
                MessageHandler(filters.PHOTO & filters.CAPTION, process_screenshot),
                MessageHandler(filters.PHOTO & ~filters.CAPTION, lambda u, c: u.message.reply_text("Пожалуйста, отправьте скриншот с текстом (описанием или комментарием к фото):"))
            ],
            WAITING_FOR_ACCOUNT_ID: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, process_account_id)
            ]
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        name="purchase_conversation"
    )
    
    # Обработчик диалога для отзывов
    conv_handler_review = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^⭐ Оставить отзыв$"), request_review)],
        states={
            WAITING_FOR_REVIEW: [
                MessageHandler(filters.TEXT | filters.PHOTO, process_review)
            ]
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        name="review_conversation"
    )
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CallbackQueryHandler(process_product_selection, pattern="^product_"))
    application.add_handler(CallbackQueryHandler(confirm_transfer, pattern="^confirm_"))
    application.add_handler(CallbackQueryHandler(reject_transfer, pattern="^reject_"))
    application.add_handler(conv_handler_purchase)
    application.add_handler(conv_handler_review)
    
    # Запускаем бота
    print("🤖 Бот запущен!")
    application.run_polling()

if __name__ == '__main__':
    # Запускаем бот в отдельном потоке
    bot_thread = threading.Thread(target=run_bot)
    bot_thread.daemon = True
    bot_thread.start()
    
    # Запускаем Flask для Render
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
