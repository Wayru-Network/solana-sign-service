import pool from "@/config/db";
import { Key } from "@/interfaces/keys";

export const getKeyByName = async (name: string) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM keys WHERE name = $1', [name]);
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0] as Key;
    } catch (error) {
        throw new Error('Error getting key by name');
    }
}