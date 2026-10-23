# Threadwise

Threadwise is a mobile-friendly, local-first wardrobe app: photograph a garment, remove its background, organize your closet, build outfits, and make a trip packing list.

Threadwise uses an open-weight model through local Ollama inference; your photos stay in the browser.

## What works in this MVP

- Add clothing photos from a camera or photo library. Background removal runs in the browser, before the transparent image is saved to IndexedDB.
- Sort and filter a personal wardrobe by tops, trousers, skirts, dresses, outerwear, shoes, and accessories.
- Ask a locally running Ollama model for outfit ideas based on item names, colors, categories, and seasons.
- Build a look yourself, or create a trip packing list and mark pieces as packed.
- Use the app from a phone on the same Wi-Fi network as the computer running it.

## Run it locally

Requirements: Node.js 20.19 or newer. Ollama is optional; without it, photo capture, your wardrobe, manual outfit building, and packing lists still work.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The development command starts both the Vite app and its API server; keep that terminal open while testing.

### Enable local AI outfit suggestions (optional)

Install and open [Ollama](https://ollama.com/download), then download the default model in PowerShell:

```powershell
ollama pull qwen3:4b
```

Restart `npm run dev` if it was already running. The app uses `qwen3:4b` by default. Set `OLLAMA_MODEL` to use another model. The API defaults to port `3001`, and Ollama to `http://127.0.0.1:11434`; `PORT` and `OLLAMA_URL` can be set as environment variables.

### Quick test checklist

1. Add a garment photo, enter its name, and save it. The first background-removal run may take a little while to download and initialize the model.
2. Refresh the page and confirm the garment is still in your wardrobe.
3. Add at least two pieces, then select them under **Outfit ideas** to make a look manually.
4. Select pieces under **Packing list**, enter a destination, and mark one as packed.
5. If Ollama is running, try **Style with local AI**. Otherwise, the app should show AI as offline while the other features remain usable.

If `npm run dev` fails before opening the app, check `node --version` (it should be 20.19 or newer). If npm reports `EPERM` while changing files in `node_modules`, close VS Code and move or clone the project outside OneDrive (for example, `C:\dev\virtual_closet`), then run `npm install` there and retry. OneDrive sync and editor extensions can keep dependency files locked during installation.

### Open it on your phone

Keep the computer and phone on the same Wi-Fi network, then open `http://<computer-lan-ip>:5173` on the phone. The development server is bound to `0.0.0.0` to allow local-network access. Allow Node.js through the computer's private-network firewall if prompted. Ollama remains on the computer; the phone does not need to install it.

To check the production build on your computer:

```powershell
npm run build
npm start
```

Open `http://localhost:3001`. Keep Ollama running in the background if you want AI suggestions.

## Deploy to Render

This repository includes a Render Blueprint in `render.yaml`. Push the project to a GitHub repository, then in Render choose **New + → Blueprint**, connect that repository, and deploy the `threadwise-closet` web service. Render uses Node.js 20.20, runs `npm ci && npm run build`, starts the Express server with `npm start`, and checks `/health`.

The deployed app works without additional environment variables, but AI outfit suggestions will show as offline: a Render web service does not include the Ollama process running on your computer. The wardrobe and packing data are stored in IndexedDB in each visitor's own browser, not on Render, so they are local to that browser/device and are not shared or backed up by the deployment. Do not point a public deployment at an unauthenticated Ollama server.

After deployment, open the `onrender.com` URL, add a test garment, refresh to verify browser storage, and test manual outfit building and packing. On Render's free plan, the service may take a short time to wake after inactivity.

## Privacy and AI

Garment photos and wardrobe data stay in the browser's IndexedDB. The background-removal model runs client-side; its model assets are fetched by the browser when first needed. The outfit endpoint sends only garment metadata (not photos) to the Ollama service on the computer. Generated outfit ideas are not saved unless you explicitly create a look.

The default `qwen3:4b` model is a text model, so it styles pieces from the labels and attributes you enter rather than interpreting their photos. Outfit suggestions are optional; adding, categorizing, and manually combining garments do not depend on Ollama.
The app disables Qwen3's extended reasoning for outfit requests and caps the response length so suggestions can return within the API timeout.

## Stack

- React, TypeScript, and Vite for the responsive browser app
- IndexedDB for local wardrobe storage
- `@imgly/background-removal` for browser-side image cutouts
- Optional local Ollama and Qwen3 for text-based styling ideas
- Express for the small Ollama API bridge

The IMG.LY background-removal library is licensed under AGPL-3.0. This project is released under the same license; see [LICENSE](./LICENSE).
