import mysql from 'mysql2/promise.js';

class DatabaseConnection {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  async initialize() {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      const connection = await this.pool.getConnection();
      console.log(`✓ Connected to ${this.config.database} at ${this.config.host}`);
      connection.release();
      return true;
    } catch (error) {
      console.error(`✗ Database connection failed:`, error.message);
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      console.error('Query error:', error.message);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection closed');
    }
  }

  async getTables() {
    const query = `
      SELECT TABLE_NAME, TABLE_SCHEMA
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `;
    return this.query(query);
  }

  async getTableSchema(tableName) {
    const query = `
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `;
    return this.query(query, [tableName]);
  }

  async getTableData(tableName, limit = 10, offset = 0) {
    const query = `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`;
    return this.query(query, [limit, offset]);
  }
}

export default DatabaseConnection;
