import { db } from "@config/db";

export const notify = async (event: string, id: string) => {
    try {
        // NOTIFY doesn't support parameterized queries, so we need to build the SQL string
        // We escape single quotes in the payload to prevent SQL injection
        const payload = JSON.stringify({ event: event, id: id });
        // Escape single quotes by doubling them (PostgreSQL standard)
        const escapedPayload = payload.replace(/'/g, "''");

        // Build the NOTIFY command with the escaped payload
        const notifyQuery = `NOTIFY documents, '${escapedPayload}'`;

        await db.query(notifyQuery);

        return {
            success: true,
            message: "Event notified successfully",
        };
    } catch (error) {
        console.error("notify error: ", error);
        return {
            success: false,
            message: "Error notifying event",
        };
    }
};
