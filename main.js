import { Telegraf } from 'telegraf';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// КОНФИГУРАЦИЯ (Тестовый вариант)
const BOT_TOKEN = "8988117619:AAGE96lQVXwOlzS_A2HWYHAm6_gkv5oV-uI";
const WEB_APP_URL = "https://catplushie.bothost.tech";
const PORT = process.env.PORT || 3000;

// Чтение конфигурации контракта
let contractConfig = { masterAddress: 'none' };
if (fs.existsSync('contract_config.json')) {
    try { 
        contractConfig = JSON.parse(fs.readFileSync('contract_config.json', 'utf8')); 
    } catch (e) { 
        console.error("Ошибка чтения конфига:", e); 
    }
}

// Инициализация базы данных
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

// --- API ---
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

// --- ЗАПУСК ---
const startApp = async () => {
    try {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Web-сервер запущен на порту ${PORT}`);
        });

        // Запуск бота с очисткой ожидающих обновлений
        await bot.launch({ dropPendingUpdates: true });
        console.log("Бот запущен и готов к работе!");

        const stop = () => {
            bot.stop('SIGINT');
            server.close();
            db.close();
            process.exit(0);
        };
        
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
    } catch (err) {
        console.error("Ошибка запуска:", err);
        process.exit(1);
    }
};

startApp();
