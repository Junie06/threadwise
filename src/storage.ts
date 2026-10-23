import { openDB } from "idb";
import type { Garment } from "./types";

const database = openDB("threadwise-closet", 1, {
  upgrade(db) {
    db.createObjectStore("garments", { keyPath: "id" });
  },
});

export async function getGarments(): Promise<Garment[]> {
  const db = await database;
  return (await db.getAll("garments")).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveGarment(garment: Garment): Promise<void> {
  const db = await database;
  await db.put("garments", garment);
}

export async function deleteGarment(id: string): Promise<void> {
  const db = await database;
  await db.delete("garments", id);
}
