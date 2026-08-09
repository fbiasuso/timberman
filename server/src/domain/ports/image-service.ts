/**
 * Image service port — self-hosted team shield pipeline (design D5/D6).
 *
 * Implementations download once, validate (MIME via magic bytes, size cap)
 * and store under public/logos/. The port contract: NEVER throws — every
 * failure is caught, logged and reported as `null` so team creation/seeding
 * is never blocked by a bad image (spec team-image-hosting).
 */
export interface ImageService {
  /**
   * Download the remote shield, validate and store it.
   *
   * @param sourceUrl remote shield URL
   * @param teamId    owning team id — filename is `logos/{teamId}.{ext}`,
   *                  permanently unique (serial ids are never reused)
   * @returns relative stored path (`logos/{teamId}.{ext}`) or null on any
   *          failure (unreachable, invalid MIME, oversized, write error)
   */
  downloadAndStore(sourceUrl: string, teamId: number): Promise<string | null>;
}
