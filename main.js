import { Telegraf } from 'telegraf';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import cors from 'cors';
import { updateMarketConfig } from './scripts/controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Рекомендуется использовать переменные окружения для токена
const BOT_TOKEN = process.env.BOT_TOKEN || "8988117619:AAEjj9gJvQ0hN5z4aZMqHpZWKc0rOIZFRiE";
const WEB_APP_URL = "https://catplushie.bothost.tech";
const PORT = process.env.PORT || 3000;

// --- ИНИЦИАЛИЗАЦИЯ ---
let contractConfig = { masterAddress: 'none' };
if (fs.existsSync('contract_config.json')) {
    try {
        contractConfig = JSON.parse(fs.readFileSync('contract_config.json', 'utf8'));
    } catch (e) {
        console.error("Ошибка при чтении конфига контракта:", e);
    }
}

const db = new sqlite3.Database('database.sqlite');
db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0, referrer_id INTEGER)");

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// --- TELEGRAM БОТ ---
bot.start((ctx) => {
    const userId = ctx.from.id;
    const startPayload = ctx.payload;

    db.get("SELECT id FROM users WHERE id = ?", [userId], (err, row) => {
        if (!row) {
            const referrer = (startPayload && startPayload !== String(userId)) ? startPayload : null;
            db.run("INSERT INTO users (id, referrer_id) VALUES (?, ?)", [userId, referrer]);
        }
    });
    
    const webAppUrlWithParams = `${WEB_APP_URL}?masterAddress=${contractConfig.masterAddress}`;
    ctx.reply('Добро пожаловать в Plushie Cat!', {
        reply_markup: {
            inline_keyboard: [[{ text: "Открыть Plushie Cat", web_app: { url: webAppUrlWithParams } }]]
        }
    });
});

bot.command('setrate', async (ctx) => {
    // ВАЖНО: Добавьте проверку ID админа, чтобы управлять курсом могли только вы!
    try {
        await updateMarketConfig(12000, 100000000, 1000000000000);
        ctx.reply('Курс на блокчейне успешно обновлен!');
    } catch (e) {
        console.error(e);
        ctx.reply('Ошибка управления контрактом.');
    }
});

// --- API ЭНДПОИНТЫ ---
app.get('/api/config', (req, res) => res.json(contractConfig));

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

// --- ЗАПУСК СЕРВИСОВ ---
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Web-сервер запущен на порту ${PORT}`));

// Ключевое изменение: dropPendingUpdates: true исправляет ошибку 409
bot.launch({
    dropPendingUpdates: true 
}).then(() => console.log("Бот запущен и очистил старые очереди!"));

// Корректное завершение работы
const stop = () => {
    bot.stop();
    server.close();
    db.close();
    process.exit(0);
};

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
