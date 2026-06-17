import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { beginCell, toNano } from "@ton/core";
import "dotenv/config";

/**
 * Функция для обновления конфигурации контракта
 * @param {number} rateMultiplier - Новый множитель курса
 * @param {bigint} minPurchase - Минимальная покупка (в NanoTON)
 * @param {bigint} maxPurchase - Максимальная покупка (в NanoTON)
 */
export async function updateMarketConfig(rateMultiplier, minPurchase, maxPurchase) {
    try {
        // 1. Инициализация клиента
        const client = new TonClient({
            endpoint: "https://toncenter.com/api/v2/jsonRPC",
        });

        // 2. Загрузка ключей
        const mnemonic = process.env.MNEMONIC;
        if (!mnemonic) throw new Error("MNEMONIC не найден в файле .env");
        
        const key = await mnemonicToPrivateKey(mnemonic.split(" "));
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
        const walletContract = client.open(wallet);
        
        // 3. Проверка баланса
        const balance = await walletContract.getBalance();
        if (balance < toNano("0.1")) {
            throw new Error(`Недостаточно средств: ${Number(balance) / 1e9} TON`);
        }
        
        const seqno = await walletContract.getSeqno();

        // 4. Формирование сообщения с динамическими данными
        const body = beginCell()
            .storeUint(0x73657452, 32)        // Op code
            .storeUint(rateMultiplier, 64)   // Динамический rate
            .storeCoins(minPurchase)         // Динамический min
            .storeCoins(maxPurchase)         // Динамический max
            .endCell();

        console.log("Отправка транзакции обновления...");

        await walletContract.sendTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [
                internal({
                    to: process.env.MASTER_ADDRESS,
                    value: toNano("0.05"),
                    body: body,
                })
            ]
        });

        // 5. Ожидание подтверждения
        console.log("Транзакция отправлена. Ожидание...");
        let currentSeqno = seqno;
        for (let i = 0; i < 15; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const nextSeqno = await walletContract.getSeqno();
            if (nextSeqno > currentSeqno) {
                console.log("✅ Успешно! Конфигурация обновлена.");
                return true;
            }
        }
        throw new Error("Транзакция отправлена, но блокчейн не подтвердил обновление вовремя.");

    } catch (error) {
        console.error("❌ Ошибка:", error.message);
        throw error;
    }
}

// АВТО-ЗАПУСК: Если этот файл запущен как скрипт (node scripts/controller.js)
if (process.argv[1].endsWith('controller.js')) {
    console.log("Запуск теста обновления...");
    updateMarketConfig(12000, toNano("0.1"), toNano("1000"))
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
