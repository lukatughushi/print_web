// Throwaway MongoDB for local development without Atlas. Data is lost when it stops.
// Usage: npm run db:memory  (then MONGODB_URI=mongodb://127.0.0.1:27999/printweb)
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.MEMORY_DB_PORT ?? 27999);

(async () => {
  const server = await MongoMemoryServer.create({ instance: { port: PORT } });
  console.log(`In-memory MongoDB ready at ${server.getUri()}printweb`);

  const stop = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
