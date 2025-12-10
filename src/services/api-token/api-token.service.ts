import crypto from 'crypto';
import db from '@/config/db';
import { ENV } from '@/config/env/env';

export interface ApiToken {
    id: number;
    name: string;
    description?: string;
    acces_key: string; // hashed (note: column name is acces_key in DB, without 's')
    last_used_at?: Date;
    expires_at?: Date;
    type: 'read-only' | 'full-access' | 'custom';
}

/**
 * Return a secure sha512 hash of an accessKey
 * @param {string} accessKey
 * @returns {string}
 */
export const hashAccessKey = (accessKey: string): string => {
    const salt = ENV.API_TOKEN_SALT || '';
    if (!salt) {
        throw new Error('API_TOKEN_SALT is not defined in environment variables');
    }
    return crypto
        .createHmac('sha512', salt)
        .update(accessKey)
        .digest('hex');
};

/**
 * Get a token by access key hash
 * @param {string} hashedAccessKey - The hashed access key
 * @returns {Promise<ApiToken | null>}
 */
export const getTokenByAccessKey = async (hashedAccessKey: string): Promise<ApiToken | null> => {
    try {
        const result = await db.query(
            `SELECT * FROM strapi_api_tokens 
       WHERE access_key = $1 
       AND (expires_at IS NULL OR expires_at > NOW())`,
            [hashedAccessKey]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0] as ApiToken;
    } catch (error) {
        console.error('Error getting token by access key:', error);
        return null;
    }
};

/**
 * Verify if a token is valid
 * @param {string} accessKey - The plain access key
 * @returns {Promise<ApiToken | null>}
 */
export const verifyToken = async (accessKey: string): Promise<ApiToken | null> => {
    try {
        const hashedAccessKey = hashAccessKey(accessKey);
        const token = await getTokenByAccessKey(hashedAccessKey);

        if (!token) {
            return null;
        }

        // Update last_used_at
        await db.query(
            `UPDATE strapi_api_tokens 
       SET last_used_at = NOW() 
       WHERE id = $1`,
            [token.id]
        );

        return token;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
};

/**
 * Check if token exists
 * @param {Object} whereParams
 * @returns {Promise<boolean>}
 */
export const tokenExists = async (whereParams: { id?: number; name?: string }): Promise<boolean> => {
    try {
        if (Object.keys(whereParams).length === 0) {
            return false;
        }

        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (whereParams.id) {
            conditions.push(`id = $${paramIndex}`);
            values.push(whereParams.id);
            paramIndex++;
        }

        if (whereParams.name) {
            conditions.push(`name = $${paramIndex}`);
            values.push(whereParams.name);
            paramIndex++;
        }

        const query = `SELECT id FROM strapi_api_tokens WHERE ${conditions.join(' AND ')}`;
        const result = await db.query(query, values);

        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking if token exists:', error);
        return false;
    }
};

/**
 * Create a new API token
 * @param {Object} attributes
 * @param {string} attributes.name - Token name
 * @param {string} attributes.description - Token description (optional)
 * @param {'read-only' | 'full-access' | 'custom'} attributes.type - Token type
 * @param {number} attributes.lifespan - Token lifespan in days (optional)
 * @returns {Promise<{ token: ApiToken, accessKey: string }>} - Returns the token and the plain access key (only shown once)
 */
export const createToken = async (attributes: {
    name: string;
    description?: string;
    type: 'read-only' | 'full-access' | 'custom';
    lifespan?: number;
}): Promise<{ token: ApiToken; accessKey: string }> => {
    try {
        // Check if token name already exists
        const exists = await tokenExists({ name: attributes.name });
        if (exists) {
            throw new Error(`Token with name "${attributes.name}" already exists`);
        }

        // Generate a random access key
        const accessKey = crypto.randomBytes(128).toString('hex');
        const hashedAccessKey = hashAccessKey(accessKey);

        // Calculate expiration date if lifespan is provided
        let expiresAt: Date | null = null;
        if (attributes.lifespan && attributes.lifespan > 0) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + attributes.lifespan);
        }

        // Insert token into database
        // Note: column name is acces_key (without 's') in the database
        const result = await db.query(
            `INSERT INTO strapi_api_tokens (name, description, acces_key, type, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [
                attributes.name,
                attributes.description || null,
                hashedAccessKey,
                attributes.type,
                expiresAt
            ]
        );

        const token = result.rows[0] as ApiToken;

        // Return token with plain access key (only shown once)
        return {
            token,
            accessKey // This is the plain access key that should be saved by the user
        };
    } catch (error) {
        console.error('Error creating token:', error);
        throw error;
    }
};

