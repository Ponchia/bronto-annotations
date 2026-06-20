export function writeLine(value = '') {
  process.stdout.write(`${String(value)}\n`);
}
