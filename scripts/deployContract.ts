import { toNano, beginCell } from '@ton/core';
import { JettonMaster } from '../wrappers/JettonMaster'; // Убедитесь, что путь к вашей обертке верный
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    // Подготовка контента (вставьте сюда ваши данные)
    let content = beginCell().storeUint(0, 8).storeStringTail("https://raw.githubusercontent.com/Alexkkkkk/Cat/main/Image/Cat.jpg").endCell();
    
    // Деплой контракта
    const jettonMaster = provider.open(
        JettonMaster.fromInit(content)
    );

    await jettonMaster.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(jettonMaster.address);
    console.log('Contract deployed at:', jettonMaster.address);
}
