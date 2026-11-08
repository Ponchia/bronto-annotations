import type { APIRequestContext } from 'playwright';
export function verifyDemoDestination(request: APIRequestContext, href: string, requirePlayground?: boolean): Promise<void>;
