const fs = require('fs');
const path = require('path');
const { exec, isWin32 } = require('./exec');

/**
 * Remove a list of files, cross-platform.
 * Consolidates cleanFiles() and cleanupOldFiles() which both:
 *   1. Build a file list
 *   2. Branch on win32 vs unix
 *   3. Run del/rm command
 */
async function removeFiles(filePaths) {
  if (!filePaths || filePaths.length === 0) return;

  const fileList = filePaths.join(' ');
  if (isWin32) {
    exec(`del /f /q ${fileList} > nul 2>&1`, (err) => {
      if (err) console.error('Error cleaning files:', err);
    });
  } else {
    exec(`rm -rf ${fileList} > /dev/null 2>&1`, (err) => {
      if (err) console.error('Error cleaning files:', err);
    });
  }
}

/**
 * Recursively find .tmp files older than maxAgeMs in a directory.
 * Consolidates the file scanning logic from cleanupOldFiles.
 */
function findOldTempFiles(dirPath, maxAgeMs = 7200000) {
  const oldFiles = [];
  if (!fs.existsSync(dirPath)) return oldFiles;

  const now = Date.now();
  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && entry.endsWith('.tmp') && (now - stat.mtime.getTime()) > maxAgeMs) {
        oldFiles.push(fullPath);
      }
    } catch (e) {
      // Skip inaccessible files
    }
  }

  return oldFiles;
}

/**
 * Ensure a directory exists, creating it if needed.
 * Consolidates the repeated existsSync + mkdirSync pattern.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`${dirPath} is created`);
  } else {
    console.log(`${dirPath} already exists`);
  }
}

/**
 * Generate a random alphanumeric string of given length.
 * Used for generating random binary names.
 */
function generateRandomName(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = { removeFiles, findOldTempFiles, ensureDir, generateRandomName };
