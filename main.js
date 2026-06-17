const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const BOT_TOKEN = "8988117619:AAEjj9gJvQ0hN5z4aZMqHpZWKc0rOIZFRiE";
const WEB_APP_URL = "https://catplushie.bothost.tech";
const PORT = process.env.PORT || 3000;

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const db = new sqlite3.Database('database.sqlite');
db.serialize(() => {
    // Добавили столбец referrer_id
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0, referrer_id INTEGER)");
});

// --- ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА ---
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    const userId = ctx.from.id;
    const startPayload = ctx.payload; // Получаем ID пригласившего (если есть)

    // Проверяем, есть ли такой пользователь
    db.get("SELECT id FROM users WHERE id = ?", [userId], (err, row) => {
        if (!row) {
            // Если новый пользователь и есть реферер — сохраняем его
            const referrer = (startPayload && startPayload !== String(userId)) ? startPayload : null;
            db.run("INSERT INTO users (id, referrer_id) VALUES (?, ?)", [userId, referrer]);
        }
    });
    
    console.log(`Пользователь ${userId} нажал /start. Реферер: ${startPayload}`);
    
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

// API для получения баланса
app.get('/api/balance/:id', (req, res) => {
    db.get("SELECT balance FROM users WHERE id = ?", [req.params.id], (err, row) => {
        res.json({ balance: row ? row.balance : 0 });
    });
});

// API для получения количества рефералов
app.get('/api/stats/:id', (req, res) => {
    db.get("SELECT count(*) as referrals FROM users WHERE referrer_id = ?", [req.params.id], (err, row) => {
        res.json({ referrals: row ? row.referrals : 0 });
    });
});

// Запуск веб-сервера
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web-сервер запущен на порту ${PORT}`);
});

// Запуск бота
bot.launch().then(() => console.log("Telegram-бот запущен!"));

// --- ПЛАВНОЕ ЗАВЕРШЕНИЕ (Graceful Shutdown) ---
const stopServices = async () => {
    console.log("Остановка сервисов...");
    try {
        await bot.stop('SIGTERM');
        server.close();
        db.close();
        console.log("Сервисы остановлены.");
        process.exit(0);
    } catch (err) {
        console.error("Ошибка при остановке:", err);
        process.exit(1);
    }
};

process.once('SIGINT', stopServices);
process.once('SIGTERM', stopServices);
