import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from threading import Thread

# --- НАСТРОЙКИ ---
BOT_TOKEN = "8988117619:AAEsJA7Ub7krmI-Sx4ofPVuOQARV_QzBGBU"
WEB_APP_URL = "https://catplushie.bothost.tech"

# --- ИНИЦИАЛИЗАЦИЯ FASTAPI ---
app = FastAPI()

# Раздача статики (папка static, как вы просили)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

# Функция для запуска сервера Uvicorn
def run_fastapi():
    uvicorn.run(app, host="0.0.0.0", port=3000)

# --- ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА ---
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    # Кнопка для запуска вашего WebApp
    kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [types.InlineKeyboardButton(
            text="Открыть Plushie Cat", 
            web_app=types.WebAppInfo(url=WEB_APP_URL)
        )]
    ])
    await message.answer("Добро пожаловать в Plushie Cat! Нажмите кнопку, чтобы запустить приложение:", reply_markup=kb)

async def run_bot():
    await dp.start_polling(bot)

# --- ОСНОВНОЙ ЗАПУСК ---
if __name__ == "__main__":
    # Запуск FastAPI в отдельном потоке
    server_thread = Thread(target=run_fastapi, daemon=True)
    server_thread.start()
    
    # Запуск бота в основном потоке
    try:
        asyncio.run(run_bot())
    except KeyboardInterrupt:
        print("Бот остановлен")
