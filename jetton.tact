import "@stdlib/ownable";

// ============================================================================
// СООБЩЕНИЯ
// ============================================================================
message SetStatus { blocked: Bool; }
message ChangeStatus { blocked: Bool; } // Для передачи статуса кошелькам
message SetRateConfig { rate_multiplier: Int as uint64; min_purchase: Int as coins; max_purchase: Int as coins; }
message Mint { amount: Int; receiver: Address; }
message WithdrawTON { amount: Int as coins; }
message ThresholdReached { total_collected: Int as coins; }

// ============================================================================
// JETTON MASTER
// ============================================================================
contract JettonMaster with Ownable {
    total_supply: Int as coins;
    owner: Address;
    jetton_content: Cell;
    transfers_blocked: Bool = true;
    total_ton_collected: Int as coins = 0;
    
    rate_multiplier: Int as uint64 = 10000;
    min_purchase: Int as coins = toNano("0.1");
    max_purchase: Int as coins = toNano("1000");

    init(owner: Address, jetton_content: Cell) {
        self.owner = owner;
        self.jetton_content = jetton_content;
        self.total_supply = 0;
    }

    receive() {
        let ctx = context();
        require(ctx.value >= self.min_purchase, "Min purchase 0.1 TON");
        require(ctx.value <= self.max_purchase, "Max purchase exceeded");

        if (self.transfers_blocked) {
            let previous_total = self.total_ton_collected;
            self.total_ton_collected += ctx.value;
            if (previous_total / toNano("1000") < self.total_ton_collected / toNano("1000")) {
                self.notify_ai(self.total_ton_collected);
            }
            if (self.total_ton_collected >= toNano("10000")) { self.transfers_blocked = false; }
        }

        let supply_factor = self.total_supply / 1000000000000000;
        let current_rate = max(self.rate_multiplier - (supply_factor * 200), 100);

        let mint_amount = ctx.value * current_rate;
        self.total_supply += mint_amount;
        
        self.mint(sender(), mint_amount);
    }

    fun mint(to: Address, amount: Int) {
        let winit = initOf JettonWallet(myAddress(), to, self.transfers_blocked);
        send(SendParameters{
            to: contractAddress(winit), value: toNano("0.05"), mode: 0,
            body: TokenTransferInternal{ query_id: 0, amount: amount, from: myAddress(), response_destination: to, forward_ton_amount: 0, forward_payload: emptySlice() }.toCell(),
            code: winit.code, data: winit.data
        });
    }

    fun notify_ai(amount: Int) {
        send(SendParameters{ to: self.owner, value: toNano("0.01"), mode: 0, body: ThresholdReached{ total_collected: amount }.toCell() });
    }

    // Управление глобальным статусом
    receive(msg: SetStatus) { 
        self.requireOwner(); 
        self.transfers_blocked = msg.blocked; 
    }

    receive(msg: SetRateConfig) { self.requireOwner(); self.rate_multiplier = msg.rate_multiplier; self.min_purchase = msg.min_purchase; self.max_purchase = msg.max_purchase; }
    receive(msg: WithdrawTON) { self.requireOwner(); send(SendParameters{ to: self.owner, value: msg.amount, mode: SendRemainingValue }); }

    get fun get_jetton_data(): JettonData { return JettonData{ total_supply: self.total_supply, mintable: true, admin_address: self.owner, jetton_content: self.jetton_content, jetton_wallet_code: (initOf JettonWallet(myAddress(), myAddress(), false)).code }; }
}

// ============================================================================
// JETTON WALLET
// ============================================================================
contract JettonWallet {
    balance: Int as coins;
    owner: Address;
    master: Address;
    transfers_blocked: Bool;

    init(master: Address, owner: Address, blocked: Bool) {
        self.balance = 0; self.master = master; self.owner = owner; self.transfers_blocked = blocked;
    }

    // Динамическое обновление блокировки
    receive(msg: ChangeStatus) {
        require(sender() == self.master, "Only master can change status");
        self.transfers_blocked = msg.blocked;
    }

    receive(msg: TokenTransferInternal) {
        if (sender() != self.master) {
            let expected = contractAddress(initOf JettonWallet(self.master, msg.from, self.transfers_blocked));
            require(sender() == expected, "Unauthorized");
        }
        self.balance += msg.amount;
    }

    receive(msg: TokenTransfer) {
        require(sender() == self.owner, "Access denied");
        require(!self.transfers_blocked, "Market locked");
        require(self.balance >= msg.amount, "Low balance");

        self.balance -= msg.amount;
        
        let dev = (msg.amount * 4) / 1000;
        let liq = (msg.amount * 2) / 1000;
        
        self.send_tokens(msg.destination, msg.amount - dev - liq, msg.query_id);
    }

    fun send_tokens(to: Address, amount: Int, qid: Int) {
        let winit = initOf JettonWallet(self.master, to, self.transfers_blocked);
        send(SendParameters{
            to: contractAddress(winit), value: 0, mode: SendRemainingValue,
            body: TokenTransferInternal{ query_id: qid, amount: amount, from: self.owner, response_destination: self.owner, forward_ton_amount: 0, forward_payload: emptySlice() }.toCell(),
            code: winit.code, data: winit.data
        });
    }

    get fun get_wallet_data(): WalletData { return WalletData{ balance: self.balance, owner: self.owner, jetton_master: self.master, jetton_wallet_code: (initOf JettonWallet(self.master, self.owner, self.transfers_blocked)).code }; }
}

struct JettonData { total_supply: Int; mintable: Bool; admin_address: Address; jetton_content: Cell; jetton_wallet_code: Cell; }
struct WalletData { balance: Int; owner: Address; jetton_master: Address; jetton_wallet_code: Cell; }
