import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { beginCell, toNano } from "@ton/core";
import "dotenv/config";

/**
 * Функция для обновления конфигурации (курс, лимиты)
 */
export async function updateMarketConfig(rateMultiplier, minPurchase, maxPurchase) {
    try {
        const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });
        const mnemonic = process.env.MNEMONIC;
        if (!mnemonic) throw new Error("MNEMONIC не найден");
        
        const key = await mnemonicToPrivateKey(mnemonic.split(" "));
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
        const walletContract = client.open(wallet);
        
        const balance = await walletContract.getBalance();
        if (balance < toNano("0.1")) throw new Error("Недостаточно TON на кошельке");
        
        const seqno = await walletContract.getSeqno();

        const body = beginCell()
            .storeUint(0x73657452, 32)        // Op code: SetRateConfig
            .storeUint(rateMultiplier, 64)
            .storeCoins(minPurchase)
            .storeCoins(maxPurchase)
            .endCell();

        await walletContract.sendTransfer({
            seqno, secretKey: key.secretKey,
            messages: [internal({ to: process.env.MASTER_ADDRESS, value: toNano("0.05"), body })]
        });

        return await waitForConfirmation(walletContract, seqno);
    } catch (error) {
        console.error("❌ Ошибка:", error.message);
        throw error;
    }
}

/**
 * Функция для смены статуса (блокировки) конкретного кошелька
 */
export async function changeWalletStatus(walletAddress, blocked) {
    try {
        const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });
        const mnemonic = process.env.MNEMONIC;
        const key = await mnemonicToPrivateKey(mnemonic.split(" "));
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
        const walletContract = client.open(wallet);
        const seqno = await walletContract.getSeqno();

        // OpCode для ChangeStatus (убедитесь, что он совпадает с вашим контрактом)
        const body = beginCell()
            .storeUint(0x27242135, 32) 
            .storeBit(blocked)
            .endCell();

        await walletContract.sendTransfer({
            seqno, secretKey: key.secretKey,
            messages: [internal({ to: walletAddress, value: toNano("0.02"), body })]
        });

        return await waitForConfirmation(walletContract, seqno);
    } catch (error) {
        console.error("❌ Ошибка смены статуса:", error.message);
        throw error;
    }
}

// Вспомогательная функция ожидания
async function waitForConfirmation(walletContract, startSeqno) {
    for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const nextSeqno = await walletContract.getSeqno();
        if (nextSeqno > startSeqno) return true;
    }
    throw new Error("Транзакция отправлена, но не подтверждена блокчейном.");
}

// АВТО-ЗАПУСК для тестов
if (process.argv[1].endsWith('controller.js')) {
    console.log("Тестовый запуск...");
    updateMarketConfig(12000, toNano("0.1"), toNano("1000")).catch(console.error);
}
