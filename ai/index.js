require('dotenv').config();
const { ChatMistralAI } = require("@langchain/mistralai");
const { executeMySQLQuery, getAllTableSchemas, createSQLQueryPrompt } = require('../db-conn/mysql');
const { executeMongoDBQuery, getAllCollectionSchemas, createMongoDBQueryPrompt } = require('../db-conn/mongo');

// Initialize Mistral AI model
const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "codestral-latest",
});

async function generateAndExecuteQuery(dbType, schema, question) {
  console.log(`Generating ${dbType} query for question: "${question}"`);

  let prompt;
  if (dbType === 'SQL') {
    prompt = createSQLQueryPrompt(schema, question)
  } else if (dbType === 'MongoDB') {
    prompt = createMongoDBQueryPrompt(schema, question)
  } else {
    throw new Error(`Unsupported database type: ${dbType}`);
  }

  try {
    const response = await model.invoke(prompt);
    console.log(`Generated ${dbType} Query:`, response.content);

    let result;
    if (dbType === 'SQL') {
      result = await executeMySQLQuery(response.content);
    } else if (dbType === 'MongoDB') {
      // Note: This assumes the query is in a format that can be parsed to a MongoDB query object
      const queryObject = JSON.parse(response.content);
      result = await executeMongoDBQuery(queryObject);
    }

    console.log(`${dbType} Query Result:`, result);
    return result;
  } catch (error) {
    console.error(`Error generating or executing ${dbType} query:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log("Fetching MySQL schemas...");
    const sqlSchemas = await getAllTableSchemas();
    console.log("MySQL Schemas:", sqlSchemas);

    console.log("\nFetching MongoDB schemas...");
    const mongoSchemas = await getAllCollectionSchemas();
    console.log("MongoDB Schemas:", mongoSchemas);

    const sqlQuestion = "What is the highest salary?";
    console.log("\nProcessing SQL question:", sqlQuestion);
    await generateAndExecuteQuery('SQL', sqlSchemas, sqlQuestion);

    const mongoQuestion = "give me the `two sum` problem";
    console.log("\nProcessing MongoDB question:", mongoQuestion);
    await generateAndExecuteQuery('MongoDB', mongoSchemas, mongoQuestion);

  } catch (error) {
    console.error("An error occurred in the main process:", error);
  } finally {
    // Close database connections if necessary
    // This depends on how your connector modules are set up
    console.log("\nClosing database connections...");
    // Assuming you have functions to close connections in your connector modules
    // await closeMySQLConnection();
    // await closeMongoDBConnection();
  }
}

main().then(() => console.log("Process completed."));