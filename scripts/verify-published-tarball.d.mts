/** @internal An offline SHA-512 check for a downloaded public npm tarball. */
export function verifyPublishedTarballFile(
  metadata: {
    name: string;
    version: string;
    integrity: string;
    tarball: string;
    distTag?: string;
  },
  archiveFile: string
): Promise<{
  name: string;
  version: string;
  bytes: number;
  integrity: string;
  tarball: string;
  archiveVerified: true;
}>;
