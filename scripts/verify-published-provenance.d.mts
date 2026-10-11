/** @internal Binds verified npm attestations to an exact GitHub release. */
export function verifyPublishedProvenance(
  audit: unknown,
  metadata: { name: string; version: string; integrity: string; tarball?: string },
  tag: string,
  commit: string
): {
  name: string;
  version: string;
  tag: string;
  commit: string;
  repository: string;
  workflow: string;
  integrity: string;
  signedProvenanceVerified: true;
  npmPublishAttestationVerified: true;
};
