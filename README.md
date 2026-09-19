# Stickman Duel cache

This service uses a headless Chromium session to open the Google Sites page, find the `FULLSCREEN (Alt)` button inside its embedded frame, click it, and save the resulting game iframe URL. The local site then serves that cached URL in a full-screen iframe.

## Run locally

```sh
npm install
npx playwright install chromium
npm start
```

Open `http://localhost:3000`. The first startup capture can take a little while. A fresh capture can be requested with:

```sh
curl -X POST http://localhost:3000/api/refresh
```

## Deploy to Render

Create a Web Service from this repository. `render.yaml` supplies the build and start commands. The service needs outbound access to Google Sites and the embedded game host. The cache is regenerated when the service starts and is stored on the instance filesystem, so it will be refreshed after a deploy or restart.

The original Google Site and game content remain third-party resources; this app caches the discovered playable URL rather than republishing their assets.