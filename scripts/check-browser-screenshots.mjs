import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const root = resolve(new URL('..', import.meta.url).pathname);
const screenshotsDir = join(root, '.tmp/screenshots');
const packedScreenshotsDir = join(root, '.tmp-packed-screenshots');
const viewports = [
  { name: 'desktop', width: 1200, height: 800, suffix: '' },
  { name: 'mobile', width: 390, height: 844, suffix: '-mobile' }
];
const examples = [
  'index',
  'svg-basic',
  'react-basic',
  'bronto-report',
  'dom-basic',
  'vega-basic',
  'mermaid-basic',
  'd2-basic',
  'react-flow-basic',
  'style-gallery'
];
const packedScreenshots = [
  { name: 'packed-browser', file: join(packedScreenshotsDir, 'packed-browser.png'), width: 640, height: 420 },
  { name: 'packed-adapters', file: join(packedScreenshotsDir, 'packed-adapters.png'), width: 920, height: 760 }
];

const failures = [];
let verified = 0;

for (const example of examples) {
  for (const viewport of viewports) {
    const file = join(screenshotsDir, `${example}${viewport.suffix}.png`);

    try {
      const png = await readPng(file);
      const decoded = decodePng(png);

      assertScreenshotEvidence(file, png, decoded, {
        label: `${example} ${viewport.name}`,
        width: viewport.width,
        height: viewport.height
      });
      verified += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

for (const screenshot of packedScreenshots) {
  try {
    const png = await readPng(screenshot.file);
    const decoded = decodePng(png);

    assertScreenshotEvidence(screenshot.file, png, decoded, screenshot);
    verified += 1;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  throw new Error(`Browser screenshot evidence failed:\n${failures.join('\n')}`);
}

console.log(`Browser screenshot evidence verified: ${verified} PNGs across ${examples.length} examples, ${viewports.length} viewports, and ${packedScreenshots.length} packed consumers.`);

function assertScreenshotEvidence(file, png, decoded, expected) {
  assert.equal(decoded.width, expected.width, `${file} width should match ${expected.label ?? expected.name}`);
  assert.ok(decoded.height >= expected.height, `${file} height should be at least ${expected.label ?? expected.name} viewport height`);
  assert.ok(png.length > 8_000, `${file} should not be a tiny placeholder PNG`);
  assert.ok(decoded.distinctColors >= 16, `${file} should contain visible varied content`);
  assert.ok(decoded.nonBackgroundSamples >= 400, `${file} should contain enough non-background rendered content`);
  assert.ok(decoded.nonBackgroundRatio >= 0.02, `${file} should not be mostly blank background`);
  assert.ok(decoded.luminanceRange >= 80, `${file} should contain visible foreground/background contrast`);
}

async function readPng(file) {
  const buffer = await readFile(file);
  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.equal(signature.compare(expected), 0, `${file} is not a PNG`);

  return buffer;
}

function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  assert.ok(width > 0 && height > 0, 'PNG missing valid IHDR dimensions');
  assert.equal(bitDepth, 8, 'PNG screenshot checker supports 8-bit screenshots');
  assert.equal(interlace, 0, 'PNG screenshot checker supports non-interlaced screenshots');

  const channels = channelsForColorType(colorType);
  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const expectedLength = height * (stride + 1);

  assert.ok(inflated.length >= expectedLength, 'PNG IDAT data is shorter than expected');

  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  const colors = new Set();
  const sampleEvery = Math.max(1, Math.floor((width * height) / 20_000));
  let backgroundColor;
  let nonBackgroundSamples = 0;
  let sampleCount = 0;
  let minLuminance = Number.POSITIVE_INFINITY;
  let maxLuminance = Number.NEGATIVE_INFINITY;
  let source = 0;
  let pixelIndex = 0;

  for (let row = 0; row < height; row += 1) {
    const filter = inflated[source];
    source += 1;

    for (let i = 0; i < stride; i += 1) {
      const raw = inflated[source + i];
      const left = i >= channels ? current[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      current[i] = unfilter(filter, raw, left, up, upLeft);
    }

    for (let x = 0; x < width; x += 1) {
      if (pixelIndex % sampleEvery === 0) {
        const start = x * channels;
        const rgba = sampledRgba(current, start, channels);
        const color = rgba.join(',');
        const luminance = relativeLuminance(rgba);

        backgroundColor ??= rgba;

        if (colorDistance(rgba, backgroundColor) > 18) {
          nonBackgroundSamples += 1;
        }

        minLuminance = Math.min(minLuminance, luminance);
        maxLuminance = Math.max(maxLuminance, luminance);
        colors.add(color);
        sampleCount += 1;
      }

      pixelIndex += 1;
    }

    current.copy(previous);
    source += stride;
  }

  return {
    width,
    height,
    distinctColors: colors.size,
    luminanceRange: sampleCount > 0 ? maxLuminance - minLuminance : 0,
    nonBackgroundRatio: sampleCount > 0 ? nonBackgroundSamples / sampleCount : 0,
    nonBackgroundSamples
  };
}

function sampledRgba(row, start, channels) {
  if (channels === 4) {
    return [row[start], row[start + 1], row[start + 2], row[start + 3]];
  }

  if (channels === 3) {
    return [row[start], row[start + 1], row[start + 2], 255];
  }

  if (channels === 2) {
    return [row[start], row[start], row[start], row[start + 1]];
  }

  return [row[start], row[start], row[start], 255];
}

function relativeLuminance([red, green, blue]) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function colorDistance(first, second) {
  return Math.sqrt(
    (first[0] - second[0]) ** 2
    + (first[1] - second[1]) ** 2
    + (first[2] - second[2]) ** 2
    + (first[3] - second[3]) ** 2
  );
}

function channelsForColorType(colorType) {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`PNG screenshot checker does not support color type ${colorType}`);
  }
}

function unfilter(filter, raw, left, up, upLeft) {
  switch (filter) {
    case 0:
      return raw;
    case 1:
      return (raw + left) & 0xff;
    case 2:
      return (raw + up) & 0xff;
    case 3:
      return (raw + Math.floor((left + up) / 2)) & 0xff;
    case 4:
      return (raw + paeth(left, up, upLeft)) & 0xff;
    default:
      throw new Error(`PNG screenshot checker does not support filter ${filter}`);
  }
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);

  if (pa <= pb && pa <= pc) {
    return left;
  }

  return pb <= pc ? up : upLeft;
}
