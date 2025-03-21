import pool from "@/config/db";

export const getUserById = async (id: number) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM up_users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        return result.rows[0];
    } catch (error) {
        throw new Error('Error getting user by id');
    }
}