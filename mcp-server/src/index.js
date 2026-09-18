import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import DatabaseConnection from './db.js';

dotenv.config();

class YesMadamMCPServer {
  constructor() {
    this.server = new Server({
      name: 'yesmadam-mysql-server',
      version: '1.0.0',
    });
    this.db = null;
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query_database',
          description: 'Execute a custom SQL query against YesMadam MySQL database',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SQL query to execute (SELECT, INSERT, UPDATE, DELETE)',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'list_tables',
          description: 'List all tables in the current database',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_table_schema',
          description: 'Get schema/columns for a specific table',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Name of the table',
              },
            },
            required: ['table_name'],
          },
        },
        {
          name: 'get_table_data',
          description: 'Get sample data from a table with pagination',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Name of the table',
              },
              limit: {
                type: 'number',
                description: 'Number of rows to return (default: 10)',
              },
              offset: {
                type: 'number',
                description: 'Offset for pagination (default: 0)',
              },
            },
            required: ['table_name'],
          },
        },
        {
          name: 'get_data_summary',
          description: 'Get row count and basic stats for a table',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Name of the table',
              },
            },
            required: ['table_name'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request;

        let result;
        switch (name) {
          case 'query_database':
            result = await this.db.query(args.sql);
            break;
          case 'list_tables':
            result = await this.db.getTables();
            break;
          case 'get_table_schema':
            result = await this.db.getTableSchema(args.table_name);
            break;
          case 'get_table_data':
            result = await this.db.getTableData(
              args.table_name,
              args.limit || 10,
              args.offset || 0
            );
            break;
          case 'get_data_summary':
            result = await this.db.query(
              `SELECT COUNT(*) as row_count FROM \`${args.table_name}\``
            );
            break;
          default:
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${name}`,
                },
              ],
              isError: true,
            };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async initialize() {
    const dbConfig = {
      host: process.env.TABLEAU_DB_HOST,
      port: parseInt(process.env.TABLEAU_DB_PORT || '3306'),
      user: process.env.TABLEAU_DB_USER,
      password: process.env.TABLEAU_DB_PASSWORD,
      database: process.env.TABLEAU_DB_NAME,
    };

    if (!dbConfig.host || !dbConfig.user || !dbConfig.password) {
      throw new Error('Missing database credentials in .env file');
    }

    this.db = new DatabaseConnection(dbConfig);
    await this.db.initialize();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('YesMadam MySQL MCP Server is running');
  }
}

async function main() {
  try {
    const server = new YesMadamMCPServer();
    await server.initialize();
    await server.run();
  } catch (error) {
    console.error('Server initialization failed:', error);
    process.exit(1);
  }
}

main();
