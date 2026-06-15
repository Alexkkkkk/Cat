import "@stdlib/ownable";
import "@stdlib/deploy";

// ============================================================================
// СООБЩЕНИЯ И СТРУКТУРЫ
// ============================================================================

message SetWhitelist { address: Address; active: Bool; }
message SetStatus { blocked: Bool; }

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

// ============================================================================
// MASTER CONTRACT
// ============================================================================

contract JettonMaster with Ownable, Deployable {
    total_supply: Int as coins = 0;
    owner: Address;
    jetton_content: Cell;
    transfers_blocked: Bool = true;
    total_ton_collected: Int as coins = 0;
    whitelist: map<Address, Bool>;

    // Адрес владельца жестко задан как ваш кошелек
    init(jetton_content: Cell) {
        self.owner = address("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM");
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
        require(ctx.value >= toNano("0.1"), "Minimum purchase is 0.1 TON");

        if (self.transfers_blocked && self.total_ton_collected < toNano("10000")) {
            self.total_ton_collected += ctx.value;
            if (self.total_ton_collected >= toNano("10000")) {
                self.transfers_blocked = false;
            }
        }

        let rate: Int = max(500, 10000 - (self.total_supply / 1000000000000000 * 100));
        let mint_amount: Int = ctx.value * rate;
        self.total_supply += mint_amount;

        let winit: StateInit = self.getJettonWalletInit(ctx.sender);
        send(SendParameters{
            to: contractAddress(winit),
            value: toNano("0.03"),
            mode: 0,
            body: TokenTransferInternal{
                query_id: 0,
                amount: mint_amount,
                from: myAddress(),
                response_destination: ctx.sender,
                forward_ton_amount: 0,
                forward_payload: emptySlice()
            }.toCell(),
            code: winit.code,
            data: winit.data
        });
    }

    get fun is_whitelisted(addr: Address): Bool {
        return self.whitelist.get(addr) == true;
    }

    fun getJettonWalletInit(address: Address): StateInit {
        return initOf JettonWallet(myAddress(), address);
    }
}

// ============================================================================
// WALLET CONTRACT
// ============================================================================

contract JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    master: Address;
    
    // Адрес для сбора комиссий — тот же ваш кошелек
    const DEV_ADDRESS: Address = address("UQDDgb2BTM-KCjntOoUg6uHllvnu3KGqEquKw6IySVP3hDgM");

    init(master: Address, owner: Address) {
        self.master = master;
        self.owner = owner;
    }

    receive(msg: TokenTransfer) {
        require(sender() == self.owner, "Access denied");
        require(self.balance >= msg.amount, "Insufficient balance");

        let devCommission: Int = (msg.amount * 4) / 1000;
        let liqCommission: Int = (msg.amount * 2) / 1000;
        let netAmount: Int = msg.amount - devCommission - liqCommission;

        self.balance -= msg.amount;

        if (devCommission > 0) {
            send(SendParameters{
                to: contractAddress(initOf JettonWallet(self.master, self.DEV_ADDRESS)),
                value: 0,
                mode: SendRemainingValue,
                body: TokenTransferInternal{
                    query_id: msg.query_id,
                    amount: devCommission,
                    from: self.owner,
                    response_destination: msg.response_destination,
                    forward_ton_amount: 0,
                    forward_payload: emptySlice()
                }.toCell()
            });
        }

        send(SendParameters{
            to: contractAddress(initOf JettonWallet(self.master, msg.destination)),
            value: 0,
            mode: SendRemainingValue,
            body: TokenTransferInternal{
                query_id: msg.query_id,
                amount: netAmount,
                from: self.owner,
                response_destination: msg.response_destination,
                forward_ton_amount: msg.forward_ton_amount,
                forward_payload: msg.forward_payload
            }.toCell()
        });
    }

    receive(msg: TokenTransferInternal) {
        self.balance += msg.amount;
    }
}
