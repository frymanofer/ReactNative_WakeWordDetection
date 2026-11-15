/**
 * Interface-only stub for a possible future opt-in encrypted backup/export of
 * long-term memory, for device-to-device continuity. Tier (b) in the
 * scaffolding plan's three-way storage split ("per-user, downloaded/synced,
 * still just data") — concluded not needed yet; this interface exists so the
 * seam is there if it ever is. Zero real implementations.
 */
export interface MemorySyncProvider {
  isEnabled(): boolean;
  push(speakerId: string, payload: unknown): Promise<void>;
  pull(speakerId: string): Promise<unknown | null>;
}

export const NoopMemorySyncProvider: MemorySyncProvider = {
  isEnabled: () => false,
  push: async () => {},
  pull: async () => null,
};
