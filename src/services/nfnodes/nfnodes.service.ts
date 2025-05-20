import db from "@/config/db";

export const countNFNodesByWallet = async (userWallet: string): Promise<number> => {
    const result = await db.query('SELECT id from nfnodes where wallet = $1', [userWallet]);
    if (result.rows.length === 0) {
        return 0;
    }
    return result.rows.length;
}
