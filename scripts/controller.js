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
        
        // Получаем текущий seqno кошелька для подписи транзакции
        const seqno = await walletContract.getSeqno();

        // 3. Формирование сообщения SetRateConfig
        // ID операции (op code) должен совпадать с тем, что сгенерирует Tact
        const body = beginCell()
            .storeUint(0x73657452, 32)        // Op code для SetRateConfig
            .storeUint(12000, 64)            // Новый rate_multiplier
            .storeCoins(toNano("0.1"))       // min_purchase (0.1 TON)
            .storeCoins(toNano("1000"))      // max_purchase (1000 TON)
            .endCell();

        console.log("Отправка транзакции обновления конфигурации...");

        // 4. Отправка транзакции
        await walletContract.sendTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [
                internal({
                    to: process.env.MASTER_ADDRESS, // Адрес вашего контракта
                    value: toNano("0.05"),          // Газ на выполнение
                    body: body,
                })
            ]
        });

        console.log("Конфигурация успешно обновлена в сети!");
    } catch (error) {
        console.error("Ошибка при выполнении скрипта:", error);
    }
}

main();
