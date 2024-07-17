require('dotenv').config();
const { ChatMistralAI } = require("@langchain/mistralai");

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "mistral-medium",
});

// db/mysql-connector.js
const mysql = require('mysql2/promise');

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function executeMySQLQuery(query, params = []) {
  const connection = await mysqlPool.getConnection();
  try {
    const [rows] = await connection.query(query, params);
    return rows;
  } finally {
    connection.release();
  }
}

async function getAllTableSchemas() {
  const tablesQuery = 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?';

  const schemaQuery = `
    SELECT 
      TABLE_NAME, 
      COLUMN_NAME, 
      DATA_TYPE, 
      IS_NULLABLE, 
      COLUMN_KEY
    FROM 
      INFORMATION_SCHEMA.COLUMNS 
    WHERE 
      TABLE_SCHEMA = ? 
    ORDER BY 
      TABLE_NAME, ORDINAL_POSITION
  `;

  try {
    const tables = await executeMySQLQuery(tablesQuery, [process.env.MYSQL_DATABASE]);
    
    if (tables.length === 0) {
      return "No tables found in the database.";
    }

    const allColumns = await executeMySQLQuery(schemaQuery, [process.env.MYSQL_DATABASE]);

    const schemas = tables.map(table => {
      const tableColumns = allColumns.filter(col => col.TABLE_NAME === table.TABLE_NAME);
      if (tableColumns.length === 0) {
        return `Table: ${table.TABLE_NAME}\nNo columns found for this table.\n`;
      }
      const columnInfo = tableColumns.map(col => 
        `${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not nullable'}${col.COLUMN_KEY === 'PRI' ? ', primary key' : ''})`
      ).join('\n');
      return `Table: ${table.TABLE_NAME}\n${columnInfo}\n`;
    });

    return schemas.join('\n');
  } catch (error) {
    console.error('Error fetching schemas:', error);
    throw error;
  }
}

function createSQLQueryPrompt(schema, question) {
  return `Based on the table schema below, write a SQL query that would answer the user's question:
${schema}

Question: ${question}
Provide only the SQL Query and if you can't answer say "NO"
SQL Query:`;
}

async function checkForTables() {
  const query = 'SHOW TABLES';
  try {
    const tables = await executeMySQLQuery(query);
    if (tables.length === 0) {
      console.log('No tables found in the database.');
    } else {
      console.log('Tables in the database:');
      tables.forEach(table => {
        const tableName = Object.values(table)[0];
        console.log(`- ${tableName}`);
      });
    }
  } catch (error) {
    console.error('Error checking for tables:', error);
  }
}

async function testFunctions() {
  try {
    console.log('Testing executeMySQLQuery:');
    let result = await executeMySQLQuery('SELECT 1 + 1 AS solution');
    console.log('The solution is:', result);

    console.log('\nChecking for tables:');
    await checkForTables();

    console.log('\nTesting getAllTableSchemas:');
    const schemas = await getAllTableSchemas();
    console.log(schemas);

    // Test createSQLQueryPrompt
    console.log('\nTesting createSQLQueryPrompt:');
    const sampleQuestion = "What is the highest salary?";
    const prompt = createSQLQueryPrompt(schemas, sampleQuestion);
    let res = await model.invoke(prompt)
    console.log(res.content);
    console.log('Testing executeMySQLQuery 2:');
    result = await executeMySQLQuery(res.content);
    // result = await executeMySQLQuery("SELECT * FROM employee");
    

    console.log('The solution is:', result);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Close the connection pool
    await mysqlPool.end();
  }
}

module.exports = { 
  executeMySQLQuery, 
  getAllTableSchemas, 
  createSQLQueryPrompt 
};

// Run the tests
// testFunctions();

// executeMySQLQuery('SELECT 1 + 1 AS solution').then((rows) => {
//     console.log('The solution is: ', rows[0].solution);
//     }
// );
