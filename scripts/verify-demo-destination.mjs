import assert from 'node:assert/strict';

/** Verify read-only demo links without hiding HTTP or content failures. */
export async function verifyDemoDestination(request, href, requirePlayground = false) {
  // Playwright retries only ECONNRESET here, not HTTP responses or assertions.
  // One retry covers a stale loopback keep-alive socket without retrying a test.
  const response = await request.get(href, { maxRetries: 1, timeout: 10000 });
  try {
    assert.equal(response.status(), 200, href);
    const html = await response.text();
    assert.match(html, /<h1\b/);
    if (requirePlayground) assert.match(html, /id="playground"/);
  } finally {
    await response.dispose();
  }
}
