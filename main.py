import asyncio
import uvicorn
from fastapi import FastAPI, StaticFiles
from fastapi.responses import FileResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from threading import Thread

# --- НАСТРОЙКИ ---
BOT_TOKEN = "ВАШ_ТОКЕН_ОТ_BOTFATHER"
WEB_APP_URL = "https://catplushie.bothost.tech"

# --- FASTAPI ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

def run_fastapi():
    uvicorn.run(app, host="0.0.0.0", port=3000)

# --- TELEGRAM BOT ---
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    # Кнопка для открытия вашего WebApp
    kb = types.InlineKeyboardMarkup(inline_keyboard=[
        [types.InlineKeyboardButton(
            text="Открыть Plushie Cat", 
            web_app=types.WebAppInfo(url=WEB_APP_URL)
        )]
    ])
    await message.answer("Добро пожаловать! Нажмите кнопку ниже, чтобы запустить приложение:", reply_markup=kb)

async def run_bot():
    await dp.start_polling(bot)

# --- ЗАПУСК ---
if __name__ == "__main__":
    # Запускаем FastAPI в отдельном потоке
    Thread(target=run_fastapi, daemon=True).start()
    # Запускаем бота в основном потоке
    asyncio.run(run_bot())
