/**
 * Image service port — team shield pipeline (design D1/D5/D6).
 *
 * Implementations share one validated write path: magic-byte sniff
 * (PNG/JPEG/WebP) + 1 MiB cap, then store through the active backend. The
 * port contract: NEVER throws — every failure is caught, logged and reported
 * as `null` so team creation/seeding is never blocked by a bad image
 * (spec team-image-hosting).
 */
export interface ImageService {
  /**
   * Download the remote shield, validate it through the shared write path
   * and store it.
   *
   * @param sourceUrl remote shield URL
   * @param teamId    owning team id — filename is `logos/{teamId}.{ext}`,
   *                  permanently unique (serial ids are never reused)
   * @returns the resolved logo value (full public URL or relative
   *          `logos/{teamId}.{ext}` path) or null on any failure (unreachable,
   *          invalid MIME, oversized, write error)
   */
  downloadAndStore(sourceUrl: string, teamId: number): Promise<string | null>;

  /**
   * Store an already-fetched shield buffer through the same validated write
   * path used by `downloadAndStore` (magic-byte sniff + 1 MiB cap).
   *
   * @param bytes  raw image payload
   * @param teamId owning team id — stored as `logos/{teamId}.{ext}`
   * @returns the resolved logo value (full public URL or relative
   *          `logos/{teamId}.{ext}` path) or null on any failure (invalid
   *          MIME, oversized, write error) — never throws
   */
  storeFromBuffer(bytes: Uint8Array, teamId: number): Promise<string | null>;
}
