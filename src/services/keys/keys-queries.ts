import client from "@/config/db";
import { Key } from "@/interfaces/keys";

export const getKeyByName = async (name: string) => {
    try {
        const result = await client.query<Key[]>('SELECT * FROM keys WHERE name = $1', [name]);
        if (result.rows?.length === 0) {
            return null;
        }
        return result.rows[0] as unknown as Key;
    } catch (error) {
        console.error(`Error getting key by name: ${error}`);
        console.log('key:', name);
    }
}