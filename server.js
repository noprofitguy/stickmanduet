import fs from 'node:fs/promises';
import express from 'express';
import { CACHE_FILE, captureGameUrl } from './capture.js';

const app = express();
const port = Number(process.env.PORT || 3000);
let cache = null;
let refreshPromise = null;

async function readCache() {
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
  } catch {
    cache = null;
  }
  return cache;
}

async function refreshCache() {
  if (!refreshPromise) {
    refreshPromise = captureGameUrl()
      .then((nextCache) => {
        cache = nextCache;
        return nextCache;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

app.use(express.static('public', { index: false }));

app.get('/api/status', async (_request, response) => {
  response.json({ ready: Boolean(cache?.gameUrl), cache });
});

app.post('/api/refresh', async (_request, response) => {
  try {
    response.json({ ready: true, cache: await refreshCache() });
  } catch (error) {
    response.status(502).json({ ready: false, error: error.message, cache });
  }
});

app.get('/{*splat}', async (_request, response) => {
  const currentCache = cache || await readCache();
  if (!currentCache?.gameUrl) {
    return response.status(503).sendFile('setup.html', { root: 'public' });
  }
  return response.sendFile('index.html', { root: 'public' });
});

await readCache();
app.listen(port, () => console.log(`Stickman Duel cache listening on port ${port}`));

if (!cache) {
  refreshCache().catch((error) => console.error(`Initial capture failed: ${error.message}`));
}