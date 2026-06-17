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
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0)");
});

// --- ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА ---
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    const userId = ctx.from.id;
    // Добавляем пользователя в БД, если его еще нет
    db.run("INSERT OR IGNORE INTO users (id) VALUES (?)", [userId]);
    
    console.log(`Пользователь ${userId} нажал /start`);
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

// API для получения баланса через WebApp
app.get('/api/balance/:id', (req, res) => {
    db.get("SELECT balance FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ balance: row ? row.balance : 0 });
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
        db.close(); // Закрываем БД корректно
        console.log("Сервисы остановлены.");
        process.exit(0);
    } catch (err) {
        console.error("Ошибка при остановке:", err);
        process.exit(1);
    }
};

process.once('SIGINT', stopServices);
process.once('SIGTERM', stopServices);
