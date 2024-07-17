require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
    throw error;
  }
}

async function executeMongoDBQuery(query, collectionName) {
  const database = client.db(process.env.MONGODB_DATABASE || 'test');
  const collection = database.collection(collectionName || process.env.MONGODB_COLLECTION || 'problems');
  
  try {
    // Note: This is a simplified example. In a real application, you'd need to parse the query
    // and use the appropriate MongoDB methods.
    const result = await collection.find(query).toArray();
    return result;
  } catch (error) {
    console.error("Error executing MongoDB query:", error);
    throw error;
  }
}

async function getAllCollectionSchemas() {
  const database = client.db(process.env.MONGODB_DATABASE || 'test');
  try {
    const collections = await database.listCollections().toArray();
    
    const schemas = await Promise.all(collections.map(async (collection) => {
      const sampleDoc = await database.collection(collection.name).findOne();
      const schema = sampleDoc ? inferSchema(sampleDoc) : 'No documents found in this collection';
      return `Collection: ${collection.name}\n${schema}\n`;
    }));

    return schemas.join('\n');
  } catch (error) {
    console.error("Error fetching collection schemas:", error);
    throw error;
  }
}

function inferSchema(document, prefix = '') {
  let schema = '';
  for (const [key, value] of Object.entries(document)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (key === '_id') {
      schema += `${fullKey} (ObjectId)\n`;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value instanceof Date) {
        schema += `${fullKey} (Date)\n`;
      } else {
        schema += `${fullKey} (Object)\n`;
        schema += inferSchema(value, fullKey);
      }
    } else {
      schema += `${fullKey} (${Array.isArray(value) ? 'Array' : typeof value})\n`;
    }
  }
  return schema;
}

function createMongoDBQueryPrompt(schema, question) {
  return `Based on the MongoDB collection schemas below, write a MongoDB query that would answer the user's question:
${schema}

Provide only the MongoDB query and if you can't answer say "NO".
The query should be in the format that goes inside the find() method.
Answer only in "{ condition }" format, including any necessary operators or complex conditions.

Here are some examples:

Question: Find all users named "John"
MongoDB Query: { "name": "John" }

Question: Find products with price greater than 100
MongoDB Query: { "price": { "$gt": 100 } }

Question: Find orders placed in the last 7 days
MongoDB Query: { "orderDate": { "$gte": { "$date": { "$subtract": [{ "$now": {} }, { "$numberLong": "604800000" }] } } } }

Question: Find users aged between 25 and 35
MongoDB Query: { "age": { "$gte": 25, "$lte": 35 } }

Question: Find documents where the 'status' field doesn't exist
MongoDB Query: { "status": { "$exists": false } }

DO NOT PROVIDE ANY EXPLANATION or ANY NOTES REGARDING THE QUERY!! I REPEAT DO NOT PROVIDE ANY EXPLANATION

Now, answer the following question:

Question: ${question}
MongoDB Query:`;
}

async function testFunctions() {
  try {
    await connectToMongoDB();

    console.log('Testing executeMongoDBQuery:');
    const result = await executeMongoDBQuery({}, 'problems');
    console.log('Query result:', result.slice(0, 2)); // Show first two documents

    console.log('\nTesting getAllCollectionSchemas:');
    const schemas = await getAllCollectionSchemas();
    console.log(schemas);

    console.log('\nTesting createMongoDBQueryPrompt:');
    const sampleQuestion = "What are the top 5 problems?";
    const prompt = createMongoDBQueryPrompt(schemas, sampleQuestion);
    console.log(prompt);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

module.exports = {
  executeMongoDBQuery,
  getAllCollectionSchemas,
  createMongoDBQueryPrompt
};

// Run the tests
// testFunctions();