import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { beginCell, toNano } from "@ton/core";
import "dotenv/config";

async function main() {
    try {
        // 1. Инициализация клиента (Mainnet)
        const client = new TonClient({
            endpoint: "https://toncenter.com/api/v2/jsonRPC",
        });

        // 2. Загрузка ключей владельца из .env
        const mnemonic = process.env.MNEMONIC;
        if (!mnemonic) throw new Error("MNEMONIC не найден в файле .env");
        
        const key = await mnemonicToPrivateKey(mnemonic.split(" "));
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
        const walletContract = client.open(wallet);
        
        // 3. Проверка баланса перед отправкой (Защита от ошибки нехватки TON)
        const balance = await walletContract.getBalance();
        if (balance < toNano("0.1")) {
            throw new Error(`Недостаточно средств на кошельке: ${Number(balance) / 1e9} TON`);
        }
        
        // Получаем текущий seqno кошелька
        const seqno = await walletContract.getSeqno();

        // 4. Формирование сообщения SetRateConfig
        const body = beginCell()
            .storeUint(0x73657452, 32)        // Op code для SetRateConfig
            .storeUint(12000, 64)            // Новый rate_multiplier
            .storeCoins(toNano("0.1"))       // min_purchase
            .storeCoins(toNano("1000"))      // max_purchase
            .endCell();

        console.log("Отправка транзакции обновления конфигурации...");

        // 5. Отправка транзакции
        await walletContract.sendTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [
                internal({
                    to: process.env.MASTER_ADDRESS,
                    value: toNano("0.05"), // Газ на выполнение
                    body: body,
                })
            ]
        });

        // 6. Ожидание подтверждения в блокчейне
        console.log("Транзакция отправлена. Ждем подтверждения...");
        let currentSeqno = seqno;
        for (let i = 0; i < 15; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 сек
            const nextSeqno = await walletContract.getSeqno();
            if (nextSeqno > currentSeqno) {
                console.log("✅ Успешно! Конфигурация обновлена в блокчейне.");
                return;
            }
        }
        console.warn("⚠️ Транзакция отправлена, но блокчейн еще не подтвердил обновление.");

    } catch (error) {
        console.error("❌ Ошибка при выполнении скрипта:", error.message);
    }
}

main();
