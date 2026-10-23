import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const ollamaUrl = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL ?? "qwen3:4b";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/health", async (_request, response) => {
  try {
    const result = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!result.ok) {
      throw new Error(`Ollama returned HTTP ${result.status}`);
    }
    const payload = await result.json();
    const models = Array.isArray(payload.models)
      ? payload.models.map((model) => model.name).filter(Boolean)
      : [];

    response.json({
      ollama: true,
      model: ollamaModel,
      modelAvailable: models.some((name) => name === ollamaModel),
      models,
    });
  } catch (error) {
    response.status(503).json({
      ollama: false,
      model: ollamaModel,
      error: error instanceof Error ? error.message : "Could not reach Ollama",
    });
  }
});

app.post("/api/looks", async (request, response) => {
  const { garments, occasion } = request.body ?? {};
  if (
    !Array.isArray(garments) ||
    garments.length < 2 ||
    garments.length > 40 ||
    garments.some((item) => typeof item?.id !== "string" || typeof item?.name !== "string")
  ) {
    response.status(400).json({ error: "Add at least two wardrobe items to get outfit ideas." });
    return;
  }

  const allowedIds = new Set(garments.map((item) => item.id));
  const itemList = garments.map(({ id, name, category, color, season }) => ({
    id,
    name,
    category,
    color,
    season,
  }));

  try {
    const result = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        format: "json",
        think: false,
        options: { num_predict: 512 },
        messages: [
          {
            role: "system",
            content:
              "You are a thoughtful personal stylist. Make practical, wearable outfits using only the supplied wardrobe. Never invent item IDs. Return JSON only with this shape: {\"looks\":[{\"title\":\"short name\",\"occasion\":\"occasion\",\"itemIds\":[\"id\"],\"note\":\"one sentence styling reason\"}]}. Include 2 or 3 looks. Each look must have at least two real items and should combine compatible categories and colors.",
          },
          {
            role: "user",
            content: `Occasion: ${String(occasion ?? "everyday").slice(0, 80)}\nWardrobe: ${JSON.stringify(itemList)}`,
          },
        ],
      }),
    });

    if (!result.ok) {
      const body = await result.text();
      throw new Error(`Ollama returned HTTP ${result.status}: ${body.slice(0, 240)}`);
    }
    const payload = await result.json();
    const parsed = JSON.parse(payload.message?.content ?? "");
    const looks = Array.isArray(parsed.looks)
      ? parsed.looks
          .map((look) => ({
            title: typeof look.title === "string" ? look.title.slice(0, 80) : "A considered look",
            occasion: typeof look.occasion === "string" ? look.occasion.slice(0, 80) : String(occasion ?? ""),
            itemIds: Array.isArray(look.itemIds)
              ? [...new Set(look.itemIds.filter((id) => typeof id === "string" && allowedIds.has(id)))]
              : [],
            note: typeof look.note === "string" ? look.note.slice(0, 240) : "",
          }))
          .filter((look) => look.itemIds.length >= 2)
          .slice(0, 3)
      : [];

    if (looks.length === 0) {
      throw new Error("The model did not return usable outfits. Try again or build a look manually.");
    }
    response.json({ looks });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Could not generate outfit ideas",
    });
  }
});

app.use(express.static(path.join(__dirname, "..", "dist")));
app.get(/.*/, (_request, response, next) => {
  response.sendFile(path.join(__dirname, "..", "dist", "index.html"), (error) => {
    if (error) next();
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Threadwise is available on http://0.0.0.0:${port}`);
  console.log(`Ollama: ${ollamaUrl} (${ollamaModel})`);
});
