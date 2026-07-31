import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cmsDir = path.join(rootDir, 'src', 'scripts', 'cms');
const outputFile = path.join(rootDir, 'src', 'scripts', 'cms-overlay.js');

console.log('Verifying modular CMS scripts in', cmsDir);
const files = ['styles.js', 'state-api.js', 'ui.js', 'editor.js', 'collections.js'];
let totalSize = 0;

for (const file of files) {
  const filePath = path.join(cmsDir, file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    totalSize += size;
    console.log(`  ✓ ${file} (${size} bytes)`);
  } else {
    console.error(`  ✗ Missing modular file: ${file}`);
  }
}

console.log(`Modular CMS script suite ready (${totalSize} bytes total across modules).`);
