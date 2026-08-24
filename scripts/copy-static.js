const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(source)) return;
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  const files = fs.readdirSync(source);
  files.forEach((file) => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

const nextStaticDir = path.join(__dirname, '..', '.next', 'static');
const standaloneStaticDir = path.join(__dirname, '..', '.next', 'standalone', '.next', 'static');
const publicNextStaticDir = path.join(__dirname, '..', 'public', '_next', 'static');

console.log('> Copying .next/static to standalone and public dirs for Hostinger...');
copyFolderRecursiveSync(nextStaticDir, standaloneStaticDir);
copyFolderRecursiveSync(nextStaticDir, publicNextStaticDir);
console.log('> Static assets copied successfully!');
