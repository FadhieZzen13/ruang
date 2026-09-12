// Load .env before anything reads process.env. Node's built-in loader (24+),
// no dotenv dependency. Imported first in index.ts.
try {
  process.loadEnvFile()
} catch {
  // no .env file — fall back to the real environment
}
