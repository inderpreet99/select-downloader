const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'select-downloader.zip');

if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Created ${path.basename(outputPath)} (${archive.pointer()} bytes)`);
});

archive.on('warning', err => {
  if (err.code === 'ENOENT') {
    console.warn(err.message);
  } else {
    throw err;
  }
});

archive.on('error', err => {
  throw err;
});

archive.pipe(output);

const excluded = new Set([
  'node_modules',
  'scripts',
  'package.json',
  'package-lock.json',
  '.git',
  '.gitignore',
  'todo.md',
  'readme.md',
  'select-downloader.zip'
]);

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  const fullPath = path.join(root, entry.name);
  if (entry.isDirectory()) {
    archive.directory(fullPath, entry.name);
  } else if (entry.isFile()) {
    archive.file(fullPath, { name: entry.name });
  }
}

archive.finalize();
