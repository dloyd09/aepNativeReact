const fs = require('fs');
const path = require('path');

if (process.platform !== 'win32') {
  process.exit(0);
}

const repoRoot = path.resolve(__dirname, '..');
const shortcutPath = path.join(repoRoot, '.rnr');
const targetPath = path.join(repoRoot, 'node_modules', 'react-native-reanimated');

if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

try {
  const stat = fs.lstatSync(shortcutPath);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    const resolved = fs.realpathSync(shortcutPath);
    if (resolved.toLowerCase() === targetPath.toLowerCase()) {
      process.exit(0);
    }
  }
  fs.rmSync(shortcutPath, { recursive: true, force: true });
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

fs.symlinkSync(targetPath, shortcutPath, 'junction');
