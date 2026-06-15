import "@stdlib/ownable";

// ============================================================================
// СООБЩЕНИЯ (ИНТЕРФЕЙСЫ ВЗАИМОДЕЙСТВИЯ)
// ============================================================================

message SetStatus {
    blocked: Bool; 
}

message SyncStatus {
    blocked: Bool;
}

message Mint {
    amount: Int;
    receiver: Address;
}

message WithdrawTON {
    amount: Int as coins;
}

message TokenTransfer {
    query_id: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message TokenTransferInternal {
    query_id: Int as uint64;
    amount: Int as coins;
    from: Address;
    response_destination: Address;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message TokenBurn {
    query_id: Int as uint64;
    amount: Int as coins;
    response_destination: Address;
    custom_payload: Cell?;
}

message TokenBurnNotification {
    query_id: Int as uint64;
    amount: Int as coins;
    sender: Address;
    response_destination: Address;
}

// ============================================================================
// ГЛАВНЫЙ КОНТРАКТ МОНЕТЫ (Jetton Master)
// ============================================================================
contract JettonMaster with Ownable {
    total_supply: Int as coins;
    owner: Address;
    jetton_content: Cell;
    mintable: Bool;
    transfers_blocked: Bool;
    total_ton_collected: Int as coins; // Счетчик собранных TON

    init(owner: Address, jetton_content: Cell) {
        self.total_supply = 0;
        self.owner = owner;
        
        // Резервное поле контента
        self.jetton_content = jetton_content; 
        self.mintable = true;
        self.transfers_blocked = true; // На старте торги ЗАКРЫТЫ
        self.total_ton_collected = 0;
    }

    // --- ПУБЛИЧНЫЙ ПРЕСЕЙЛ С АВТО-УДОРОЖАНИЕМ МОНЕТЫ ---
    receive() {
        let incoming_amount: Int = context().value;
        
        // Защита от спама микро-платежами
        require(incoming_amount >= toNano("0.1"), "Minimum purchase is 0.1 TON");

        if (self.transfers_blocked) {
            self.total_ton_collected = self.total_ton_collected + incoming_amount;

            // КЛЮЧЕВОЕ УСЛОВИЕ: Сбор 10 000 TON автоматически открывает торги
            if (self.total_ton_collected >= toNano("10000")) {
                self.transfers_blocked = false; 
            }
        }

        // --- АЛГОРИТМ РОСТА ЦЕНЫ (Bonding Curve) ---
        // Начальный курс: за 1 TON даем 10 000 монет.
        let current_rate: Int = 10000;
        
        // Считаем, сколько миллионов монет уже выпущено.
        // 1 000 000 джеттонов с 9 знаками после запятой — это 10^15 неделимых единиц.
        let millions_minted: Int = self.total_supply / 1000000000000000;
        
        // Каждый миллион выпущенных токенов снижает коэффициент выдачи на 100
        current_rate = current_rate - (millions_minted * 100);
        
        // Защита, чтобы цена не росла до бесконечности и курс не стал нулевым
        if (current_rate < 500) { 
            current_rate = 500; // Минимальный курс: за 1 TON даем 500 монет
        }

        // Вычисляем итоговое количество токеков для отправки пользователю
        let tokens_to_mint: Int = incoming_amount * current_rate; 
        
        self.total_supply = self.total_supply + tokens_to_mint;
        let winit: StateInit = self.getJettonWalletInit(sender());
        
        send(SendParameters{
            to: contractAddress(winit),
            value: toNano("0.03"), // TON на деплой личного кошелька и газ
            bounce: false,
            mode: 0,
            body: TokenTransferInternal{
                query_id: 0,
                amount: tokens_to_mint,
                from: myAddress(),
                response_destination: sender(),
                forward_ton_amount: 0,
                forward_payload: emptySlice()
            }.toCell(),
            code: winit.code,
            data: winit.data
        });
    }

    // Вывод накопленных TON создателем проекта
    receive(msg: WithdrawTON) {
        self.requireOwner();
        require(myBalance() >= msg.amount, "Not enough balance on contract");
        
        send(SendParameters{
            to: self.owner,
            value: msg.amount,
            bounce: false,
            mode: SendRemainingValue
        });
    }

    // Изменение статуса торгов вручную (если нужно открыть/закрыть до лимита)
    receive(msg: SetStatus) {
        self.requireOwner();
        self.transfers_blocked = msg.blocked;
    }

    // Ручной выпуск монет админом
    receive(msg: Mint) {
        self.requireOwner();
        require(self.mintable, "Minting is permanently stopped");
        self.total_supply = self.total_supply + msg.amount;
        
        let winit: StateInit = self.getJettonWalletInit(msg.receiver);
        send(SendParameters{
            to: contractAddress(winit),
            value: 0,
            bounce: false,
            mode: SendRemainingValue,
            body: TokenTransferInternal{
                query_id: 0,
                amount: msg.amount,
                from: self.owner,
                response_destination: self.owner,
                forward_ton_amount: 0,
                forward_payload: emptySlice()
            }.toCell(),
            code: winit.code,
            data: winit.data
        });
    }

    receive(msg: TokenBurnNotification) {
        let wallet_init: StateInit = self.getJettonWalletInit(msg.sender);
        require(sender() == contractAddress(wallet_init), "Unauthorized burn source");
        self.total_supply = self.total_supply - msg.amount;
        
        if (msg.response_destination != myAddress()) {
            send(SendParameters{
                to: msg.response_destination,
                value: 0,
                bounce: false,
                mode: SendRemainingValue,
                body: "Burn confirmed".asComment()
            });
        }
    }

    // Вспомогательная функция сборки On-chain метаданных джеттона (TEP-64 Полный on-chain словарь)
    fun getDynamicContent(): Cell {
        let content: map<Int, Cell> = emptyMap();
        
        // Хеши ключей по стандарту TEP-64 (sha256 от названий полей):
        // name: 0x82a3537b240c77af210d15b13a1e21e1498263cf2b6045610ec1f251e60f730a
        // symbol: 0x3b5f92fd9d18fa5be51797825b4be019777f9fc674066042db69931338df3734
        // image: 0x61015700f13da32115f212f01fd8cbe98c36395b283d6a455a73e5cf61fa4d7e
        // description: 0xda60c5db6f3ff8059df3876e5d8b72e0d37e50085d3989c4501a3c7c251d1f73
        
        // Префикс 0x00 в начале значения ячейки означает, что данные записаны в виде обычной строки (On-chain)
        
        // 1. Имя токена: Plushie Cat
        let nameBuilder: StringBuilder = beginComment();
        nameBuilder.append("Plushie Cat");
        content.set(0x82a3537b240c77af210d15b13a1e21e1498263cf2b6045610ec1f251e60f730a, nameBuilder.toCell());
        
        // 2. Тикер (Символ): PLSH
        let symbolBuilder: StringBuilder = beginComment();
        symbolBuilder.append("PLSH");
        content.set(0x3b5f92fd9d18fa5be51797825b4be019777f9fc674066042db69931338df3734, symbolBuilder.toCell());
        
        // 3. Изображение: Прямая ссылка на ваш GitHub
        let imageBuilder: StringBuilder = beginComment();
        imageBuilder.append("https://raw.githubusercontent.com/Alexkkkkk/Cat/main/Image/Cat.jpg");
        content.set(0x61015700f13da32115f212f01fd8cbe98c36395b283d6a455a73e5cf61fa4d7e, imageBuilder.toCell());

        // 4. Описание (Description)
        let descBuilder: StringBuilder = beginComment();
        descBuilder.append("The official token of Plushie Cat project.");
        content.set(0xda60c5db6f3ff8059df3876e5d8b72e0d37e50085d3989c4501a3c7c251d1f73, descBuilder.toCell());
        
        // Сборка финальной структуры. Префикс 0x00 сообщает, что метаданные хранятся непосредственно в словаре (On-Chain)
        return beginCell().storeUint(0, 8).storeDict(content).toCell();
    }

    // --- ГЕТТЕРЫ ---
    get fun get_jetton_data(): JettonData {
        return JettonData{
            total_supply: self.total_supply,
            mintable: self.mintable,
            admin_address: self.owner,
            // Возвращаем полностью заполненный On-Chain словарь (Имя, символ, картинка)
            jetton_content: self.getDynamicContent(), 
            jetton_wallet_code: self.getJettonWalletInit(myAddress()).code
        };
    }

    get fun get_wallet_address(owner_address: Address): Address {
        return contractAddress(self.getJettonWalletInit(owner_address));
    }

    get fun collected_ton(): Int {
        return self.total_ton_collected;
    }

    get fun is_blocked(): Bool {
        return self.transfers_blocked;
    }

    fun getJettonWalletInit(address: Address): StateInit {
        return initOf JettonWallet(myAddress(), address, self.transfers_blocked);
    }
}

struct JettonData {
    total_supply: Int;
    mintable: Bool;
    admin_address: Address;
    jetton_content: Cell;
    jetton_wallet_code: Cell;
}

// ============================================================================
// КОНТРАКТ КОШЕЛЬКА ПОЛЬЗОВАТЕЛЯ (Jetton Wallet)
// ============================================================================
contract JettonWallet {
    balance: Int as coins;
    owner: Address;
    master: Address;
    transfers_blocked: Bool;

    init(master: Address, owner: Address, blocked: Bool) {
        self.balance = 0;
        self.master = master;
        self.owner = owner;
        self.transfers_blocked = blocked;
    }

    receive(msg: SyncStatus) {
        require(sender() == self.master, "Only master can sync status");
        self.transfers_blocked = msg.blocked;
    }

    // ИСХОДЯЩИЙ ПЕРЕВОД (Продажа на DEX или перевод)
    receive(msg: TokenTransfer) {
        require(sender() == self.owner, "Access denied: not your wallet");
        require(self.balance >= msg.amount, "Insufficient jetton balance");
        
        // Защита Buy-Only (Пока лимит пресейла не собран — переводы закрыты)
        require(!self.transfers_blocked, "Transfers are blocked until 10k TON milestone is reached.");
        
        // --- ВАШ АДРЕС ДЛЯ НАЛОГОВ И РАСПРЕДЕЛЕНИЯ ---
        let devAddress: Address = Address.parse("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM"); // 0.4% разработчику
        let liqAddress: Address = Address.parse("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM"); // 0.2% в ликвидность
        
        // Расчет комиссий
        let devCommission: Int = (msg.amount * 4) / 1000;  // 0.4%
        let liqCommission: Int = (msg.amount * 2) / 1000;  // 0.2%
        let amountAfterCommission: Int = msg.amount - devCommission - liqCommission;
        
        // Списываем полную сумму токенов с баланса пользователя
        self.balance = self.balance - msg.amount;
        
        // 1. Отправка 0.4% на ваш кошелек
        if (devCommission > 0) {
            let devWalletInit: StateInit = initOf JettonWallet(self.master, devAddress, self.transfers_blocked);
            send(SendParameters{
                to: contractAddress(devWalletInit),
                value: toNano("0.02"), // Газ на проведение транзакции
                bounce: true,
                mode: 0,
                body: TokenTransferInternal{
                    query_id: msg.query_id,
                    amount: devCommission,
                    from: self.owner,
                    response_destination: msg.response_destination,
                    forward_ton_amount: 0,
                    forward_payload: emptySlice()
                }.toCell(),
                code: devWalletInit.code,
                data: devWalletInit.data
            });
        }
        
        // 2. Отправка 0.2% на ваш кошелек
        if (liqCommission > 0) {
            let liqWalletInit: StateInit = initOf JettonWallet(self.master, liqAddress, self.transfers_blocked);
            send(SendParameters{
                to: contractAddress(liqWalletInit),
                value: toNano("0.02"), // Газ на проведение транзакции
                bounce: true,
                mode: 0,
                body: TokenTransferInternal{
                    query_id: msg.query_id,
                    amount: liqCommission,
                    from: self.owner,
                    response_destination: msg.response_destination,
                    forward_ton_amount: 0,
                    forward_payload: emptySlice()
                }.toCell(),
                code: liqWalletInit.code,
                data: liqWalletInit.data
            });
        }
        
        // 3. Отправка основной суммы получателю
        let walletInit: StateInit = initOf JettonWallet(self.master, msg.destination, self.transfers_blocked);
        send(SendParameters{
            to: contractAddress(walletInit),
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            body: TokenTransferInternal{
                query_id: msg.query_id,
                amount: amountAfterCommission,
                from: self.owner,
                response_destination: msg.response_destination,
                forward_ton_amount: msg.forward_ton_amount,
                forward_payload: msg.forward_payload
            }.toCell(),
            code: walletInit.code,
            data: walletInit.data
        });
    }

    // ВХОДЯЩИЙ ПЕРЕВОД (Зачисление при покупке или получении налога)
    receive(msg: TokenTransferInternal) {
        let expected_sender: Address = contractAddress(initOf JettonWallet(self.master, msg.from, self.transfers_blocked));
        if (sender() != self.master) {
            require(sender() == expected_sender, "Unauthorized internal transfer");
        }
        
        self.balance = self.balance + msg.amount;
        
        if (msg.forward_ton_amount > 0) {
            send(SendParameters{
                to: self.owner,
                value: msg.forward_ton_amount,
                bounce: false,
                body: msg.forward_payload
            });
        }
        
        let remaining: Int = myBalance() - context().value;
        if (remaining > 0) {
            send(SendParameters{
                to: msg.response_destination,
                value: 0,
                bounce: false,
                mode: SendRemainingValue
            });
        }
    }

    receive(msg: TokenBurn) {
        require(sender() == self.owner, "Unauthorized");
        require(self.balance >= msg.amount, "Insufficient balance");
        
        self.balance = self.balance - msg.amount;
        
        send(SendParameters{
            to: self.master,
            value: 0,
            bounce: false,
            mode: SendRemainingValue,
            body: TokenBurnNotification{
                query_id: msg.query_id,
                amount: msg.amount,
                sender: self.owner,
                response_destination: msg.response_destination
            }.toCell()
        });
    }

    bounced(msg: Slice) {
        msg.skipBits(32); 
        let amount: Int = msg.loadCoins();
        self.balance = self.balance + amount;
    }

    get fun get_wallet_data(): WalletData {
        return WalletData{
            balance: self.balance,
            owner: self.owner,
            jetton_master: self.master,
            jetton_wallet_code: (initOf JettonWallet(self.master, self.owner, self.transfers_blocked)).code
        };
    }
}

struct WalletData {
    balance: Int;
    owner: Address;
    jetton_master: Address;
    jetton_wallet_code: Cell;
}
