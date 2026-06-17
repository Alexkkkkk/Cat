const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = "8988117619:AAEsJA7Ub7krmI-Sx4ofPVuOQARV_QzBGBU";
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

bot.launch().then(() => console.log("Telegram-бот запущен!"));

// --- ИНИЦИАЛИЗАЦИЯ EXPRESS (вместо FastAPI) ---
const app = express();
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web-сервер запущен на порту ${PORT}`);
});
