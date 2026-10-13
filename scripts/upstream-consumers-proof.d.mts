export type UpstreamManifest = {
  schema: 1;
  hosts: Array<{
    id: string;
    host: 'vega' | 'mermaid';
    commit: string;
    sha256: string;
    lines: { start: number; end: number };
  }>;
  licenses: Array<{ spdx: string }>;
};
export function verifyProvenance(directory: string): Promise<UpstreamManifest>;
export function assertObservations(observations: unknown[], manifest: unknown): void;
