import { AssetsPriceDbInterface, AssetsPriceInterface } from "@interfaces/assets/assets.interface";
import db from "@/config/db";

export const getAssetsPrice = async (): Promise<AssetsPriceInterface | null> => {
  try {
    // select all assets documents
    const { rows } = await db.query<AssetsPriceDbInterface>("SELECT * FROM assets_prices");
    if (rows?.length === 0) {
      return null as unknown as AssetsPriceInterface;
    }
    const prices = rows[0];

    // Convert cryptocurrency symbols to uppercase with the format of AssetsPriceInterface
    const pricesWithUpperCase: AssetsPriceInterface = {
      SOL: prices.sol?.toUpperCase() || '0.001',
      IOTX: prices.iotx?.toUpperCase() || '0.001',
      PEAQ: prices.peaq?.toUpperCase() || '0.001',
      ALGO: prices.algo?.toUpperCase() || '0.001',
      USDC: prices.usdc?.toUpperCase() || '0.001',
      PRICE_FOR_MINT: prices.price_for_mint || 50,
      ETH: prices.eth?.toUpperCase() || '0.001',
      BNB: prices.bnb?.toUpperCase() || '0.001',
      WAYRU: prices.wayru?.toUpperCase() || '0.001'
    };

    return pricesWithUpperCase;
  } catch (error) {
    console.log("getAssetsPrice Error", error);
    return null as unknown as AssetsPriceInterface;
  }
};
