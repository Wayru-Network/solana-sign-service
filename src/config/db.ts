import { Pool } from 'pg';
import { ENV } from '@/config/env/env';

class DatabasePool {
  private static instance: Pool | null = null;
  private static retryCount = 0;
  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_INTERVAL = 5000; // 5 seconds

  public static getInstance(): Pool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new Pool({
        host: ENV.DATABASE_HOST,
        port: parseInt(ENV.DATABASE_PORT || '5432'),
        database: ENV.DATABASE_NAME,
        user: ENV.DATABASE_USERNAME,
        password: ENV.DATABASE_PASSWORD,
        ssl: ENV.DATABASE_SSL == true,
        // Add connection pool settings
        max: 20, // maximum number of clients
        idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
        connectionTimeoutMillis: 2000, // how long to wait before timing out when connecting a new client
      });

      // Handle pool errors
      DatabasePool.instance.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        DatabasePool.handleError(err);
      });
    }
    return DatabasePool.instance;
  }

  private static async handleError(error: Error): Promise<void> {
    console.error('Database connection error:', error);
    
    if (DatabasePool.retryCount < DatabasePool.MAX_RETRIES) {
      DatabasePool.retryCount++;
      console.log(`Retrying connection... Attempt ${DatabasePool.retryCount} of ${DatabasePool.MAX_RETRIES}`);
      
      // Close the current pool
      if (DatabasePool.instance) {
        await DatabasePool.instance.end();
        DatabasePool.instance = null;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, DatabasePool.RETRY_INTERVAL));
      
      // Try to get a new instance
      DatabasePool.getInstance();
    } else {
      console.error('Max retry attempts reached. Please check database configuration and connectivity.');
      process.exit(1); // Exit the process if we can't establish a connection after max retries
    }
  }

  public static async end(): Promise<void> {
    if (DatabasePool.instance) {
      await DatabasePool.instance.end();
      DatabasePool.instance = null;
    }
  }
}

const pool = DatabasePool.getInstance();
export default pool;