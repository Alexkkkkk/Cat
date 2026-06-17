import { toNano, beginCell, Address } from '@ton/core';
import { JettonMaster } from '../wrappers/JettonMaster'; 
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    // 1. Ваш адрес владельца (администратора контракта)
    // Убедитесь, что здесь указан ваш реальный адрес
    const ownerAddress = Address.parse("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM");

    // 2. Подготовка контента (согласно вашему контракту)
    // Мы используем формат TEP-64, как в вашем коде Tact
    let content = beginCell().storeUint(0, 8).endCell();
    
    // 3. Инициализация контракта
    // Передаем ownerAddress и content, так как они объявлены в init() контракта
    const jettonMaster = provider.open(
        JettonMaster.fromInit(ownerAddress, content)
    );

    console.log('Начинаю деплой контракта Plushie Cat...');

    // 4. Деплой
    // Используем 0.2 TON, чтобы гарантированно хватило на деплой и газ
    await jettonMaster.send(
        provider.sender(),
        {
            value: toNano('0.2'), 
        },
        null // В Tact при использовании initOf конструктор вызывается через null
    );

    // 5. Ожидание
    await provider.waitForDeploy(jettonMaster.address);
    
    console.log('--------------------------------------------------');
    console.log('Контракт успешно развернут!');
    console.log('Адрес контракта (Master):', jettonMaster.address.toString());
    console.log('--------------------------------------------------');
}
