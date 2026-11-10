/**
 * Data-access contract.
 *
 * The UI currently reads/writes through React state seeded from `src/data/mock`.
 * When a MongoDB-backed API is added later, implement this interface with `fetch`
 * calls and swap it in inside `hooks/useAppData.tsx`. No persistence happens today —
 * every action in the demo is a local, in-memory mock operation.
 */
export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(input: Omit<T, "id">): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}
