import { toNano, Address } from '@ton/core';
import { JettonMaster } from '../wrappers/JettonMaster'; 
import { NetworkProvider } from '@ton/blueprint';
import * as fs from 'fs';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const sender = provider.sender();

    // 1. Конфигурация для MAINNET
    const logoUrl = "https://raw.githubusercontent.com/Alexkkkkk/Cat/main/Image/logo.png";
    const deployValue = toNano('0.5'); // Безопасный запас для Mainnet

    ui.write(`🌍 AI-Агент: Начинаю аудит для MAINNET...`);
    const balance = await provider.api().getBalance(sender.address!);
    ui.write(`💰 Текущий баланс: ${Number(balance)/1e9} TON`);
    
    if (balance < deployValue) {
        throw new Error(`🛑 Недостаточно средств в Mainnet! Нужно минимум 0.5 TON.`);
    }

    // 2. Инициализация
    const jettonMaster = provider.open(JettonMaster.fromInit(logoUrl));

    // 3. Деплой
    try {
        ui.write(`🚀 ОТПРАВКА В MAINNET: ${jettonMaster.address.toString()}`);
        
        await jettonMaster.send(
            sender,
            { value: deployValue },
            {
                $$type: 'Deploy',
                queryId: BigInt(Date.now()), // Используем текущий timestamp для уникальности
            }
        );

        ui.write('⏳ Ожидание подтверждения в основной сети (Mainnet)...');
        await provider.waitForDeploy(jettonMaster.address);
    } catch (e) {
        ui.write(`❌ Ошибка в Mainnet: ${e}`);
        return;
    }
    
    // 4. Генерация манифеста
    const configData = {
        masterAddress: jettonMaster.address.toString(),
        logo: logoUrl,
        owner: sender.address?.toString(),
        network: "mainnet", // Указано mainnet
        version: "2.0.0",
        last_updated: new Date().toISOString()
    };

    fs.writeFileSync('contract_config.json', JSON.stringify(configData, null, 4));

    // 5. Финальный отчет
    ui.clearActionPrompt();
    ui.write(`
✅ ДЕПЛОЙ В MAINNET УСПЕШЕН
--------------------------------------------------
💎 MASTER ADDRESS : ${jettonMaster.address.toString()}
⚙️ NETWORK        : MAINNET
🔗 TONSCAN        : https://tonscan.org/address/${jettonMaster.address.toString()}
--------------------------------------------------
💡 Конфигурация обновлена для Mainnet.
    `);
}
