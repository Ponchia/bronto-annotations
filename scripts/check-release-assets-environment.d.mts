/** @internal Fails closed unless an existing reviewed main-only environment matches. */
export function assertReleaseAssetsEnvironment(environment: unknown, branches: unknown): {
  environment: string; id: number; branch: 'main'; requiredReviewer: 'Ponchia'; verified: true;
};
