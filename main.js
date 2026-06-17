const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const BOT_TOKEN = "8988117619:AAEjj9gJvQ0hN5z4aZMqHpZWKc0rOIZFRiE";
const WEB_APP_URL = "https://catplushie.bothost.tech";
const PORT = process.env.PORT || 3000;

// --- ЗАГРУЗКА КОНФИГА КОНТРАКТА ---
let contractConfig = {};
try {
    if (fs.existsSync('contract_config.json')) {
        contractConfig = JSON.parse(fs.readFileSync('contract_config.json', 'utf8'));
        console.log(`✅ Контракт подключен: ${contractConfig.masterAddress}`);
    } else {
        console.warn("⚠️ contract_config.json не найден. Выполните деплой!");
    }
} catch (e) {
    console.error("Ошибка чтения конфига:", e);
}

// --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ---
const db = new sqlite3.Database('database.sqlite');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0, referrer_id INTEGER)");
});

// --- ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА ---
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    const userId = ctx.from.id;
    const startPayload = ctx.payload;

    db.get("SELECT id FROM users WHERE id = ?", [userId], (err, row) => {
        if (!row) {
            const referrer = (startPayload && startPayload !== String(userId)) ? startPayload : null;
            db.run("INSERT INTO users (id, referrer_id) VALUES (?, ?)", [userId, referrer]);
        }
    });
    
    // Передаем адрес контракта в WebApp (через URL параметры)
    const webAppUrlWithParams = `${WEB_APP_URL}?masterAddress=${contractConfig.masterAddress || 'none'}`;
    
    ctx.reply('Добро пожаловать в Plushie Cat! Нажмите кнопку:', {
        reply_markup: {
            inline_keyboard: [[
                { text: "Открыть Plushie Cat", web_app: { url: webAppUrlWithParams } }
            ]]
        }
    });
});

// --- ИНИЦИАЛИЗАЦИЯ EXPRESS ---
const app = express();
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// Эндпоинт для фронтенда, чтобы узнать адрес контракта
app.get('/api/config', (req, res) => {
    res.json(contractConfig);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/api/balance/:id', (req, res) => {
    db.get("SELECT balance FROM users WHERE id = ?", [req.params.id], (err, row) => {
        res.json({ balance: row ? row.balance : 0 });
    });
});

app.post('/api/buy/:id', (req, res) => {
    db.run("UPDATE users SET balance = balance + 100 WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/stats/:id', (req, res) => {
    db.get("SELECT count(*) as referrals FROM users WHERE referrer_id = ?", [req.params.id], (err, row) => {
        res.json({ referrals: row ? row.referrals : 0 });
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web-сервер запущен на порту ${PORT}`);
});

bot.launch().then(() => console.log("Telegram-бот запущен!"));

const stopServices = async () => {
    console.log("Остановка сервисов...");
    try {
        await bot.stop('SIGTERM');
        server.close();
        db.close();
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
};

process.once('SIGINT', stopServices);
process.once('SIGTERM', stopServices);
