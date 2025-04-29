import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { ENV } from '@/config/env/env';

class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private pool: Pool;
  private client: PoolClient | null = null;
  private connecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.pool = new Pool({
      host: ENV.DATABASE_HOST,
      port: parseInt(ENV.DATABASE_PORT || '5432'),
      database: ENV.DATABASE_NAME,
      user: ENV.DATABASE_USERNAME,
      password: ENV.DATABASE_PASSWORD,
      ssl: ENV.DATABASE_SSL == true,
      // Connection settings
      connectionTimeoutMillis: 10000, // 10 seconds
      max: 20,
      idleTimeoutMillis: 30000
    });

    this.setupPoolErrorHandler();
    this.connect().catch(console.error);
  }

  private setupPoolErrorHandler() {
    this.pool.on('error', (err) => {
      console.error('Unexpected pool error', err);
      this.scheduleReconnect();
    });
  }

  private async connect() {
    if (this.connecting) return;
    
    try {
      this.connecting = true;
      
      // Close existing client if any
      if (this.client) {
        try {
          await this.client.release();
        } catch (e) {
          console.error('Error releasing client:', e);
        }
        this.client = null;
      }

      // Get new client
      this.client = await this.pool.connect();
      
      this.client.on('error', (err) => {
        console.error('Client error:', err);
        this.scheduleReconnect();
      });

      console.log('Successfully connected to database');
      
    } catch (error) {
      console.error('Failed to connect to database:', error);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect to database...');
      this.connect().catch(console.error);
    }, 5000); // Wait 5 seconds before reconnecting
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async query<T extends QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const result = await this.client!.query(text, params);
      return result;
    } catch (error) {
      if (this.isConnectionError(error)) {
        console.error('Connection error during query, attempting to reconnect:', error);
        await this.connect();
        // Retry query once after reconnecting
        const result = await this.client!.query(text, params);
        return result;
      }
      throw error;
    }
  }

  private isConnectionError(error: any): boolean {
    return error.message.includes('Connection terminated') ||
           error.message.includes('timeout exceeded') ||
           error.message.includes('Connection refused');
  }

  public async end() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.client) {
      await this.client.release();
    }
    await this.pool.end();
  }
}

// Export a singleton instance
export const db = DatabaseConnection.getInstance();
export default db;