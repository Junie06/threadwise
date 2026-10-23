import type { Garment, OllamaStatus, SuggestedLook } from "./types";

export async function getOllamaStatus(): Promise<OllamaStatus> {
  const response = await fetch("/api/health");
  const payload = await response.json();
  if (!response.ok && response.status !== 503) {
    throw new Error(payload.error ?? "Could not check Ollama.");
  }
  return payload as OllamaStatus;
}

export async function requestLooks(
  garments: Garment[],
  occasion: string,
): Promise<SuggestedLook[]> {
  const response = await fetch("/api/looks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      occasion,
      garments: garments.map(({ id, name, category, color, season }) => ({
        id,
        name,
        category,
        color,
        season,
      })),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Ollama could not create outfit ideas.");
  }
  return payload.looks as SuggestedLook[];
}
