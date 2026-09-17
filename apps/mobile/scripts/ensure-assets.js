// postinstall: if the PNG icon set is missing (e.g. the repo was synced through
// a text-only path), regenerate the placeholders so `expo start` / EAS work.
const { existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const icon = path.join(__dirname, '..', 'assets', 'images', 'icon.png');
if (existsSync(icon)) process.exit(0);

for (const py of ['python3', 'python']) {
  try {
    execFileSync(py, [path.join(__dirname, 'make-placeholder-icons.py')], { stdio: 'inherit' });
    process.exit(0);
  } catch {
    // try the next interpreter
  }
}
console.warn('[dram] assets/images/*.png missing and python not found — run scripts/make-placeholder-icons.py manually.');
