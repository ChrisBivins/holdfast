import type { Territory } from "./types";

export const SEED_TERRITORIES: Omit<Territory, "id">[] = [
  { name: "Shrine Gate", owner: "Unclaimed", note: "", col: 0, row: 0 },
  { name: "Reliquary", owner: "Pale Seraphim", note: "Held since week one.", col: 1, row: 0 },
  { name: "Pilgrim Road", owner: "Unclaimed", note: "", col: 2, row: 0 },
  { name: "Outer Cloisters", owner: "Word Bearers", note: "", col: 3, row: 0 },
  { name: "Scriptorium", owner: "Pale Seraphim", note: "", col: 0, row: 1 },
  { name: "High Altar", owner: "Unclaimed", note: "Whoever takes this owns the world.", col: 1, row: 1 },
  { name: "Bell Tower", owner: "Unclaimed", note: "", col: 2, row: 1 },
  { name: "Ossuary", owner: "Word Bearers", note: "", col: 3, row: 1 },
  { name: "Supply Docks", owner: "Pale Seraphim", note: "", col: 0, row: 2 },
  { name: "Ash Wastes", owner: "Unclaimed", note: "", col: 1, row: 2 },
  { name: "River Ford", owner: "Unclaimed", note: "", col: 2, row: 2 },
  { name: "Broken Wall", owner: "Word Bearers", note: "", col: 3, row: 2 },
];
