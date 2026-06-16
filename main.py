import asyncio
import uvicorn
import logging
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from threading import Thread

# --- НАСТРОЙКИ ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- НАСТРОЙКИ ---
BOT_TOKEN = "8988117619:AAEsJA7Ub7krmI-Sx4ofPVuOQARV_QzBGBU"
WEB_APP_URL = "https://catplushie.bothost.tech"

# --- ИНИЦИАЛИЗАЦИЯ FASTAPI ---
app = FastAPI()
# Убедитесь, что папка static существует в корне проекта
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    logger.info("Пользователь открыл главную страницу")
    return FileResponse('static/index.html')

def run_fastapi():
    # Получаем порт из переменной окружения PORT, предоставляемой Bothost
    # Если переменная не задана, используем 3000 по умолчанию
    port = int(os.getenv("PORT", 3000))
    logger.info(f"Запуск FastAPI сервера на порту {port}...")
    
    # host="0.0.0.0" критически важен для работы Reverse Proxy
    uvicorn.run(app, host="0.0.0.0", port=port)

# --- ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА ---
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    logger.info(f"Пользователь {message.from_user.id} нажал /start")
    kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [types.InlineKeyboardButton(
            text="Открыть Plushie Cat", 
            web_app=types.WebAppInfo(url=WEB_APP_URL)
        )]
    ])
    await message.answer("Добро пожаловать в Plushie Cat! Нажмите кнопку:", reply_markup=kb)

async def run_bot():
    logger.info("Запуск Telegram-бота...")
    await dp.start_polling(bot)

# --- ОСНОВНОЙ ЗАПУСК ---
if __name__ == "__main__":
    logger.info("Инициализация системы...")
    
    # Запуск FastAPI в отдельном потоке
    server_thread = Thread(target=run_fastapi, daemon=True)
    server_thread.start()
    
    # Запуск бота в основном потоке
    try:
        asyncio.run(run_bot())
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
