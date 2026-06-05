'use strict';

const crypto = require('crypto');

/**
 * Validate a UUID v4 string.
 * @param {string} uuid
 * @returns {boolean}
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate a random UUID v4.
 * @returns {string}
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Encode a string to base64.
 * @param {string} str
 * @returns {string}
 */
function toBase64(str) {
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Decode a base64 string.
 * @param {string} b64
 * @returns {string}
 */
function fromBase64(b64) {
  return Buffer.from(b64, 'base64').toString('utf-8');
}

/**
 * Parse ARGO_AUTH to determine the tunnel type.
 * - JSON object with TunnelSecret → token-based tunnel
 * - String starting with "ey" → cloudflared token
 * - Otherwise → unknown/empty
 * @param {string} argoAuth
 * @returns {{type: string, value: string}}
 */
function parseArgoAuth(argoAuth) {
  if (!argoAuth) {
    return { type: 'temporary', value: '' };
  }

  try {
    const parsed = JSON.parse(argoAuth);
    if (parsed.TunnelSecret && parsed.AccountTag && parsed.TunnelID) {
      return { type: 'json', value: argoAuth };
    }
  } catch (e) {
    // Not JSON
  }

  if (argoAuth.startsWith('ey')) {
    return { type: 'token', value: argoAuth };
  }

  return { type: 'unknown', value: argoAuth };
}

/**
 * Build a VLESS URI from configuration parameters.
 * @param {object} params
 * @param {string} params.uuid - User UUID
 * @param {string} params.host - Connection host (CFIP or domain)
 * @param {number} params.port - Connection port
 * @param {string} params.sni - Server Name Indication (domain)
 * @param {string} params.name - Node name prefix
 * @param {string} [params.path] - WebSocket path
 * @returns {string}
 */
function buildVlessUri({ uuid, host, port, sni, name, path }) {
  const wsPath = path || `/${uuid}-vless`;
  const encodedPath = encodeURIComponent(wsPath);
  const remark = encodeURIComponent(`${name}-vless`);
  return `vless://${uuid}@${host}:${port}?encryption=none&security=tls&sni=${sni}&type=ws&host=${sni}&path=${encodedPath}#${remark}`;
}

/**
 * Build a VMess link from configuration parameters.
 * @param {object} params
 * @param {string} params.uuid - User UUID
 * @param {string} params.host - Connection host
 * @param {number} params.port - Connection port
 * @param {string} params.sni - Server Name Indication
 * @param {string} params.name - Node name prefix
 * @param {string} [params.path] - WebSocket path
 * @returns {string}
 */
function buildVmessUri({ uuid, host, port, sni, name, path }) {
  const wsPath = path || `/${uuid}-vmess`;
  const vmessConfig = {
    v: '2',
    ps: `${name}-vmess`,
    add: host,
    port: port,
    id: uuid,
    aid: 0,
    scy: 'none',
    net: 'ws',
    type: 'none',
    host: sni,
    path: wsPath,
    tls: 'tls',
    sni: sni,
  };
  return `vmess://${toBase64(JSON.stringify(vmessConfig))}`;
}

/**
 * Build a Trojan URI from configuration parameters.
 * @param {object} params
 * @param {string} params.uuid - User UUID (used as password)
 * @param {string} params.host - Connection host
 * @param {number} params.port - Connection port
 * @param {string} params.sni - Server Name Indication
 * @param {string} params.name - Node name prefix
 * @param {string} [params.path] - WebSocket path
 * @returns {string}
 */
function buildTrojanUri({ uuid, host, port, sni, name, path }) {
  const wsPath = path || `/${uuid}-trojan`;
  const encodedPath = encodeURIComponent(wsPath);
  const remark = encodeURIComponent(`${name}-trojan`);
  return `trojan://${uuid}@${host}:${port}?security=tls&sni=${sni}&type=ws&host=${sni}&path=${encodedPath}#${remark}`;
}

/**
 * Sanitize a file path to prevent directory traversal.
 * @param {string} filePath
 * @returns {string}
 */
function sanitizePath(filePath) {
  return filePath.replace(/\.\.\//g, '').replace(/\/\//g, '/');
}

module.exports = {
  isValidUUID,
  generateUUID,
  toBase64,
  fromBase64,
  parseArgoAuth,
  buildVlessUri,
  buildVmessUri,
  buildTrojanUri,
  sanitizePath,
};
