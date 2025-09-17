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
        [InlineKeyboardButton("50 г → 80₽", callback_data="product_50")],
        [InlineKeyboardButton("165 г → 200₽", callback_data="product_165")],
        [InlineKeyboardButton("625 г → 540₽", callback_data="product_625")],
        [InlineKeyboardButton("1625 г → 1400₽", callback_data="product_1625")],
        [InlineKeyboardButton("6750 г → 5250₽", callback_data="product_6750")]
    ]
    return InlineKeyboardMarkup(keyboard)

# Клавиатура для проверки статуса
def get_check_status_keyboard():
    keyboard = [[KeyboardButton("Проверить статус покупки")]]
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
    keyboard = [[KeyboardButton("Оставить отзыв")]]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

# Обработчик команды /start
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = """
🎮 Добро пожаловать в магазин доната для BLOCKPOST mobile!

Выберите нужное количество золота:
┌──────────────────┐
│50 г      →    80₽   │
├──────────────────┤
│165 г    →   200₽   │
├──────────────────┤
│625 г    →   540₽   │
├──────────────────┤
│1625 г  →  1400₽   │
├──────────────────┤
│6750 г  →  5250₽   │
└──────────────────┘

После покупки нажмите «Проверить статус покупки» для подтверждения.
    """
    await update.message.reply_text(welcome_text, reply_markup=get_products_keyboard())

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
    await query.message.reply_text(
        f"Вы выбрали: {product['gold']} за {product['price']}\n\n"
        f"переведите {product['price']} на карту 2202206366260763\n\n"
        f"После оплаты нажмите «Проверить статус покупки» для подтверждения покупки.",
        reply_markup=get_check_status_keyboard()
    )

# Обработчик кнопки "Проверить статус покупки"
async def check_purchase_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Пожалуйста, отправьте скриншот чека об оплате:")
    return WAITING_FOR_SCREENSHOT

# Обработчик скриншота
async def process_screenshot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.caption:
        await update.message.reply_text("Пожалуйста, отправьте скриншот с текстом (описанием или комментарием к фото):")
        return WAITING_FOR_SCREENSHOT
    
    context.user_data['screenshot'] = update.message.photo[-1].file_id
    context.user_data['screenshot_text'] = update.message.caption
    
    await update.message.reply_text("Теперь отправьте ваш ID аккаунта в BLOCKPOST mobile:")
    return WAITING_FOR_ACCOUNT_ID

# Обработчик ID аккаунта
async def process_account_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    account_id = update.message.text
    user_data = context.user_data
    
    # Сохраняем ID аккаунта для отзыва
    context.user_data['account_id'] = account_id
    
    # Отправляем данные админам
    admin_message = f"""
🛒 Новая покупка!

👤 Покупатель: @{update.message.from_user.username or 'нет username'} ({update.message.from_user.id})
🎮 ID аккаунта: {account_id}
📝 Комментарий к чеку: {user_data['screenshot_text']}

Для подтверждения перевода нажмите кнопку ниже.
    """
    
    try:
        # Отправляем фото с текстом и кнопкой подтверждения
        await context.bot.send_photo(
            chat_id=ADMIN_CHAT_ID,
            photo=user_data['screenshot'],
            caption=admin_message,
            reply_markup=get_admin_keyboard(update.message.from_user.id)
        )
        
        await update.message.reply_text(
            "✅ Ваши данные получены! Ожидайте подтверждения перевода и отправки голды вам на аккаунт администратором. "
            "Как только перевод будет подтвержден, вы получите уведомление.",
            reply_markup=None
        )
        
    except Exception as e:
        await update.message.reply_text("❌ Произошла ошибка при обработке вашего запроса. Попробуйте позже.")
        logging.error(f"Error sending to admin: {e}")
    
    return ConversationHandler.END

# Обработчик подтверждения перевода админом
async def confirm_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    try:
        # Уведомляем покупателя
        await context.bot.send_message(
            chat_id=user_id,
            text="✅ Голда отправлена! Не пришло? свяжитесь с поддержкой: @Skuuuchn\n\n"
                 "Пожалуйста, оставьте отзыв! 📝\n"
                 "Можно отправить скриншот аккаунта где видно голду и сам отзыв (можно и без фото!)",
            reply_markup=get_review_keyboard()
        )
        
        # Сохраняем user_id для отзыва
        context.bot_data[user_id] = {'waiting_review': True}
        
        # Обновляем сообщение у админа
        await query.message.edit_caption(
            caption=f"✅ Перевод подтвержден администратором @{query.from_user.username}\n"
                    f"👤 Покупатель уведомлен и может оставить отзыв",
            reply_markup=None
        )
        
    except Exception as e:
        logging.error(f"Error confirming transfer: {e}")

# Обработчик кнопки "Оставить отзыв"
async def request_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📝 Пожалуйста, напишите ваш отзыв!\n"
        "Можно прикрепить скриншот аккаунта с голдой (но это не обязательно).\n"
        "Просто напишите текст отзыва и отправьте."
    )
    return WAITING_FOR_REVIEW

# Обработчик отзыва
async def process_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    username = update.message.from_user.username or 'нет username'
    
    if update.message.photo:
        # Если есть фото
        photo_id = update.message.photo[-1].file_id
        review_text = update.message.caption or "Без текста"
        
        # Отправляем админам
        review_message = f"""
⭐ Новый отзыв!

👤 От: @{username} ({user_id})
📝 Текст: {review_text}
        """
        
        try:
            await context.bot.send_photo(
                chat_id=ADMIN_CHAT_ID,
                photo=photo_id,
                caption=review_message
            )
        except Exception as e:
            logging.error(f"Error sending review photo: {e}")
            
    else:
        # Если только текст
        review_text = update.message.text
        
        # Отправляем админам
        review_message = f"""
⭐ Новый отзыв!

👤 От: @{username} ({user_id})
📝 Текст: {review_text}
        """
        
        try:
            await context.bot.send_message(
                chat_id=ADMIN_CHAT_ID,
                text=review_message
            )
        except Exception as e:
            logging.error(f"Error sending review text: {e}")
    
    # Благодарим пользователя
    await update.message.reply_text(
        "🙏 Спасибо за ваш отзыв! Это очень важно для нас!\n"
        "Если у вас будут еще вопросы - обращайтесь!",
        reply_markup=None
    )
    
    # Убираем флаг ожидания отзыва
    if user_id in context.bot_data:
        context.bot_data[user_id]['waiting_review'] = False
    
    return ConversationHandler.END

# Обработчик отклонения перевода админом
async def reject_transfer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    try:
        # Уведомляем покупателя
        await context.bot.send_message(
            chat_id=user_id,
            text="❌ Ваш перевод отклонен администратором. Свяжитесь с поддержкой для выяснения причин."
        )
        
        # Обновляем сообщение у админа
        await query.message.edit_caption(
            caption=f"❌ Перевод отклонен администратором @{query.from_user.username}",
            reply_markup=None
        )
        
    except Exception as e:
        logging.error(f"Error rejecting transfer: {e}")

# Обработчик отмены
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Операция отменена.")
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
        entry_points=[MessageHandler(filters.Regex("^Проверить статус покупки$"), check_purchase_status)],
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
        entry_points=[MessageHandler(filters.Regex("^Оставить отзыв$"), request_review)],
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
    app.run(host='0.0.0.0', port=port)eading.Thread(target=run_bot)
    bot_thread.daemon = True
    bot_thread.start()
    
    # Запускаем Flask
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
