'use strict';

/**
 * Configuration module - parses environment variables with defaults.
 * Extracted from index.js for testability.
 */

const DEFAULT_UUID = '89c13786-25aa-4520-b2e7-12cd60fb5202';
const DEFAULT_PORT = 3000;
const DEFAULT_ARGO_PORT = 8001;
const DEFAULT_CFIP = 'www.visa.com.tw';
const DEFAULT_CFPORT = 443;
const DEFAULT_NAME = 'Vls';
const DEFAULT_FILE_PATH = './tmp';
const DEFAULT_SUB_PATH = 'sub';
const DEFAULT_PROJECT_URL = 'https://www.google.com';

/**
 * Parse and validate configuration from environment variables.
 * @param {object} [env] - Environment object (defaults to process.env)
 * @returns {object} Parsed configuration
 */
function getConfig(env) {
  const e = env || process.env;

  return {
    uploadUrl: e.UPLOAD_URL || '',
    projectUrl: e.PROJECT_URL || DEFAULT_PROJECT_URL,
    autoAccess: e.AUTO_ACCESS === 'true',
    port: parseInt(e.PORT, 10) || DEFAULT_PORT,
    argoPort: parseInt(e.ARGO_PORT, 10) || DEFAULT_ARGO_PORT,
    uuid: e.UUID || DEFAULT_UUID,
    nezhaServer: e.NEZHA_SERVER || '',
    nezhaPort: e.NEZHA_PORT || '',
    nezhaKey: e.NEZHA_KEY || '',
    argoDomain: e.ARGO_DOMAIN || '',
    argoAuth: e.ARGO_AUTH || '',
    cfip: e.CFIP || DEFAULT_CFIP,
    cfport: parseInt(e.CFPORT, 10) || DEFAULT_CFPORT,
    name: e.NAME || DEFAULT_NAME,
    filePath: e.FILE_PATH || DEFAULT_FILE_PATH,
    subPath: e.SUB_PATH || DEFAULT_SUB_PATH,
  };
}

/**
 * Check if the Argo tunnel is configured as fixed (both domain and auth set).
 * @param {object} config
 * @returns {boolean}
 */
function isFixedTunnel(config) {
  return !!(config.argoDomain && config.argoAuth);
}

/**
 * Check if Nezha probe is enabled (server and key are set).
 * @param {object} config
 * @returns {boolean}
 */
function isNezhaEnabled(config) {
  return !!(config.nezhaServer && config.nezhaKey);
}

/**
 * Determine if Nezha TLS should be enabled based on the port.
 * TLS ports: 443, 8443, 2096, 2087, 2083, 2053
 * @param {object} config
 * @returns {boolean}
 */
function isNezhaTls(config) {
  const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
  return tlsPorts.includes(String(config.nezhaPort));
}

module.exports = {
  getConfig,
  isFixedTunnel,
  isNezhaEnabled,
  isNezhaTls,
  DEFAULT_UUID,
  DEFAULT_PORT,
  DEFAULT_ARGO_PORT,
  DEFAULT_CFIP,
  DEFAULT_CFPORT,
  DEFAULT_NAME,
  DEFAULT_FILE_PATH,
  DEFAULT_SUB_PATH,
  DEFAULT_PROJECT_URL,
};
