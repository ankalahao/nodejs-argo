'use strict';

const { toBase64, buildVlessUri, buildVmessUri, buildTrojanUri } = require('./utils');

/**
 * Generate subscription content (base64-encoded list of proxy links).
 * @param {object} params
 * @param {string} params.uuid - User UUID
 * @param {string} params.host - Connection host (CFIP or domain)
 * @param {number} params.port - Connection port (CFPORT)
 * @param {string} params.domain - Argo domain (SNI)
 * @param {string} params.name - Node name prefix
 * @returns {string} Base64-encoded subscription content
 */
function generateSubscription({ uuid, host, port, domain, name }) {
  if (!domain) {
    return '';
  }

  const links = [];
  const baseParams = { uuid, host, port, sni: domain, name };

  links.push(buildVlessUri(baseParams));
  links.push(buildVmessUri(baseParams));
  links.push(buildTrojanUri(baseParams));

  return toBase64(links.join('\n'));
}

/**
 * Parse subscription content from base64.
 * @param {string} base64Content
 * @returns {string[]} Array of proxy URIs
 */
function parseSubscription(base64Content) {
  if (!base64Content) return [];
  const decoded = Buffer.from(base64Content, 'base64').toString('utf-8');
  return decoded.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Validate that subscription content contains expected protocols.
 * @param {string[]} links - Array of decoded links
 * @returns {{vless: number, vmess: number, trojan: number}}
 */
function countProtocols(links) {
  return {
    vless: links.filter(l => l.startsWith('vless://')).length,
    vmess: links.filter(l => l.startsWith('vmess://')).length,
    trojan: links.filter(l => l.startsWith('trojan://')).length,
  };
}

module.exports = {
  generateSubscription,
  parseSubscription,
  countProtocols,
};
