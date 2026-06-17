const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = "8988117619:AAEjj9gJvQ0hN5z4aZMqHpZWKc0rOIZFRiE";
const WEB_APP_URL = "https://catplushie.bothost.tech";
const PORT = process.env.PORT || 3000;

// --- ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА ---
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    console.log(`Пользователь ${ctx.from.id} нажал /start`);
    ctx.reply('Добро пожаловать в Plushie Cat! Нажмите кнопку:', {
        reply_markup: {
            inline_keyboard: [[
                { text: "Открыть Plushie Cat", web_app: { url: WEB_APP_URL } }
            ]]
        }
    });
});

// --- ИНИЦИАЛИЗАЦИЯ EXPRESS ---
const app = express();
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Запуск веб-сервера
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web-сервер запущен на порту ${PORT}`);
});

// Запуск бота
bot.launch().then(() => console.log("Telegram-бот запущен!"));

// --- ПЛАВНОЕ ЗАВЕРШЕНИЕ (Graceful Shutdown) ---
// Это предотвращает ошибку 409 Conflict и зависание портов
const stopServices = async () => {
    console.log("Остановка сервисов...");
    try {
        await bot.stop('SIGTERM');
        server.close();
        console.log("Сервисы остановлены.");
        process.exit(0);
    } catch (err) {
        console.error("Ошибка при остановке:", err);
        process.exit(1);
    }
};

process.once('SIGINT', stopServices);
process.once('SIGTERM', stopServices);
