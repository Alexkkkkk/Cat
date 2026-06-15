import "@stdlib/ownable";

// ============================================================================
// СООБЩЕНИЯ
// ============================================================================
message SetWhitelist { address: Address; active: Bool; }
message SetStatus { blocked: Bool; }
message TokenTransfer {
    query_id: Int as uint64; amount: Int as coins; destination: Address;
    response_destination: Address; custom_payload: Cell?;
    forward_ton_amount: Int as coins; forward_payload: Slice as remaining;
}
message TokenTransferInternal {
    query_id: Int as uint64; amount: Int as coins; from: Address;
    response_destination: Address; forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

// ============================================================================
// JETTON MASTER
// ============================================================================
contract JettonMaster with Ownable {
    total_supply: Int as coins = 0;
    owner: Address;
    jetton_content: Cell;
    transfers_blocked: Bool = true;
    total_ton_collected: Int as coins = 0;
    whitelist: map<Address, Bool>;

    init(owner: Address, jetton_content: Cell) {
        self.owner = owner;
        self.jetton_content = jetton_content;
    }

    receive(msg: SetWhitelist) {
        self.requireOwner();
        self.whitelist.set(msg.address, msg.active);
    }

    receive(msg: SetStatus) {
        self.requireOwner();
        self.transfers_blocked = msg.blocked;
    }

    receive() {
        let ctx: Context = context();
        require(ctx.value >= toNano("0.1"), "Minimum purchase 0.1 TON");

        if (self.transfers_blocked && self.total_ton_collected < toNano("10000")) {
            self.total_ton_collected += ctx.value;
            if (self.total_ton_collected >= toNano("10000")) { self.transfers_blocked = false; }
        }

        let rate: Int = max(500, 10000 - (self.total_supply / 1000000000000000 * 100));
        let tokens: Int = ctx.value * rate;
        self.total_supply += tokens;

        let winit: StateInit = self.getJettonWalletInit(ctx.sender);
        send(SendParameters{
            to: contractAddress(winit), value: toNano("0.03"), mode: 0,
            body: TokenTransferInternal{ query_id: 0, amount: tokens, from: myAddress(), 
                  response_destination: ctx.sender, forward_ton_amount: 0, forward_payload: emptySlice() }.toCell(),
            code: winit.code, data: winit.data
        });
    }

    get fun is_whitelisted(addr: Address): Bool { return self.whitelist.get(addr) == true; }
    fun getJettonWalletInit(address: Address): StateInit { return initOf JettonWallet(myAddress(), address); }
}

// ============================================================================
// JETTON WALLET
// ============================================================================
contract JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    master: Address;

    init(master: Address, owner: Address) { self.master = master; self.owner = owner; }

    receive(msg: TokenTransfer) {
        require(sender() == self.owner, "Access denied");
        
        // Логика комиссий
        let devCommission: Int = (msg.amount * 4) / 1000;
        let liqCommission: Int = (msg.amount * 2) / 1000;
        let amountToTransfer: Int = msg.amount - devCommission - liqCommission;
        
        self.balance -= msg.amount;
        
        // Пересылка токенов и комиссий (упрощенная логика send)
        send(SendParameters{
            to: contractAddress(initOf JettonWallet(self.master, msg.destination)),
            value: 0, mode: SendRemainingValue,
            body: TokenTransferInternal{ query_id: msg.query_id, amount: amountToTransfer, from: self.owner, 
                  response_destination: msg.response_destination, forward_ton_amount: msg.forward_ton_amount, 
                  forward_payload: msg.forward_payload }.toCell()
        });
    }

    receive(msg: TokenTransferInternal) { self.balance += msg.amount; }
}
