export interface AssetsPriceDbInterface {
    sol: string;
    iotx: string;
    peaq: string;
    algo: string;
    usdc: string;
    price_for_mint: number;
    eth: string;
    bnb: string;
    wayru: string;
    last_request: "coinGecko" | "coinMarketCap";
}

type AssetNames =
    | "ALGO"
    | "USDC"
    | "WRU"
    | "USD"
    | "PEAQ"
    | "PEAQ_EVM"
    | "PEAQ_SUBSTRATE"
    | "IOTX"
    | "BASE"
    | "BNB"
    | "ETH"
    | "SOL"
    | "WAYRU";

export interface AssetsPriceInterface {
    SOL: string;
    IOTX: string;
    PEAQ: string;
    ALGO: string;
    USDC: string;
    PRICE_FOR_MINT: number;
    ETH: string;
    BNB: string;
    WAYRU: string;
}

interface Params {
    clawback: string;
    creator: string;
    decimals: number;
    "default-frozen": boolean;
    freeze: string;
    manager: string;
    name: string;
    "name-b64": string;
    reserve: string;
    total: number;
    "unit-name": string;
    "unit-name-b64": string;
    url: string;
    "url-b64": string;
}

export interface AssetInfoOutput {
    name: AssetNames;
    balance: string;
    value: number | string;
    assetId?: number | string;
    params?: Params;
    "opt-in": boolean;
}
