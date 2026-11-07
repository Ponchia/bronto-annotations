/** @internal Inputs must come from a successful cryptographic npm signature audit. */
export interface ReleaseAsset { name: string; bytes: Buffer; }
export interface PreparedReleaseAssets { tag: string; commit: string; assets: ReleaseAsset[]; }
export interface ListedReleaseAsset { id: number; name: string; size: number; state: string; }
export interface ReleaseAssetApi {
  release(tag: string): Promise<{ id: number; tag_name: string; draft: boolean }>;
  tagCommit(tag: string): Promise<string>;
  list(releaseId: number): Promise<ListedReleaseAsset[]>;
  download(assetId: number): Promise<Buffer>;
  upload(tag: string, asset: ReleaseAsset): Promise<void>;
}
export function prepareReleaseAssets(input: {
  metadata: { name: string; version: string; integrity: string; tarball: string };
  audit: unknown; archiveFile: string; tag: string; commit: string;
}): Promise<PreparedReleaseAssets>;
export function mirrorReleaseAssets(
  prepared: PreparedReleaseAssets, api: ReleaseAssetApi, options?: { dryRun?: boolean }
): Promise<{ tag: string; commit: string; dryRun: boolean; planned: string[]; uploaded: string[]; retained: string[];
  assets?: Array<{ name: string; bytes: number; sha256: string }> }>;
