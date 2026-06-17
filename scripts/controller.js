import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { beginCell } from "@ton/core";

async function main() {
    // 1. Инициализация клиента (Mainnet или Testnet)
    const client = new TonClient({
        endpoint: "https://toncenter.com/api/v2/jsonRPC", // или testnet
    });

    // 2. Ваш ключ владельца
    const mnemonic = "ваша секретная фраза из 24 слов..."; 
    const key = await mnemonicToPrivateKey(mnemonic.split(" "));
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const walletContract = client.open(wallet);

    // 3. Формирование сообщения SetRateConfig (согласно вашему Tact коду)
    // ID операции нужно взять из сгенерированного ABI
    const body = beginCell()
        .storeUint(0x73657452, 32) // Примерный ID метода (замените на реальный из .abi.json)
        .storeUint(12000, 64)      // rate_multiplier
        .storeCoins(100000000)     // min_purchase (0.1 TON)
        .storeCoins(1000000000000) // max_purchase
        .endCell();

    // 4. Отправка транзакции
    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
        seqno,
        secretKey: key.secretKey,
        messages: [
            internal({
                to: "АДРЕС_ВАШЕГО_КОНТРАКТА",
                value: "0.05", // Газ
                body: body,
            })
        ]
    });

    console.log("Конфигурация успешно обновлена!");
}

main();
