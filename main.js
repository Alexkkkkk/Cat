import { Telegraf } from 'telegraf';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import cors from 'cors';
import { toNano } from '@ton/core'; 
import { updateMarketConfig, changeWalletStatus } from './scripts/controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// КОНФИГУРАЦИЯ
const ADMIN_ID = 476014374; 
const BOT_TOKEN = process.env.BOT_TOKEN || "8988117619:AAF00L85tPpQOlLbM-SAmbwi-w7EDGOtzlM";
const WEB_APP_URL = "https://catplushie.bothost.tech";
const PORT = process.env.PORT || 3000;

let contractConfig = { masterAddress: 'none' };
if (fs.existsSync('contract_config.json')) {
    try { contractConfig = JSON.parse(fs.readFileSync('contract_config.json', 'utf8')); } 
    catch (e) { console.error("Ошибка чтения конфига:", e); }
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

// АДМИН-КОМАНДА: Установка курса и лимитов
bot.command('setrate', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔️ Доступ запрещен.");
    try {
        const parts = ctx.message.text.split(' ');
        if (parts.length < 4) return ctx.reply("Использование: /setrate <rate> <minTON> <maxTON>");
        await ctx.reply("⏳ Отправляю транзакцию...");
        await updateMarketConfig(parseInt(parts[1]), toNano(parts[2]), toNano(parts[3]));
        ctx.reply('✅ Успешно обновлено!');
    } catch (e) {
        ctx.reply('❌ Ошибка: ' + e.message);
    }
});

// АДМИН-КОМАНДА: Блокировка/Разблокировка
bot.command('lock', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔️ Доступ запрещен.");
    try {
        const parts = ctx.message.text.split(' ');
        if (parts.length < 3) return ctx.reply("Использование: /lock <address> <true/false>");
        await changeWalletStatus(parts[1], parts[2] === 'true');
        ctx.reply(`🔒 Статус изменен на: ${parts[2]}`);
    } catch (e) {
        ctx.reply('❌ Ошибка: ' + e.message);
    }
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

// --- БЕЗОПАСНЫЙ ЗАПУСК ---
const startApp = async () => {
    try {
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Web-сервер запущен на порту ${PORT}`);
        });

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
