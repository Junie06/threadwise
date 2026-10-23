export const categories = [
  "Tops",
  "Trousers",
  "Skirts",
  "Dresses",
  "Outerwear",
  "Shoes",
  "Accessories",
] as const;

export type Category = (typeof categories)[number];
export type Page = "wardrobe" | "outfits" | "packing";

export interface Garment {
  id: string;
  name: string;
  category: Category;
  color: string;
  season: string;
  image: Blob;
  createdAt: number;
}

export interface SuggestedLook {
  title: string;
  occasion: string;
  itemIds: string[];
  note: string;
}

export interface OllamaStatus {
  ollama: boolean;
  model: string;
  modelAvailable?: boolean;
  models?: string[];
  error?: string;
}
