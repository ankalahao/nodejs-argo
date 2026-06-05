const axios = require('axios');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/json',
};

/**
 * POST JSON data to a URL with standard headers.
 * Consolidates repeated axios.post patterns across uploadNodes, deleteNodes, etc.
 */
async function httpPost(url, data, extraHeaders = {}) {
  const headers = { ...DEFAULT_HEADERS, ...extraHeaders };
  return axios.post(url, JSON.stringify(data), { headers });
}

/**
 * GET a URL with standard headers.
 * Consolidates repeated axios.get patterns.
 */
async function httpGet(url, extraHeaders = {}) {
  const headers = { ...DEFAULT_HEADERS, ...extraHeaders };
  return axios.get(url, { headers });
}

/**
 * POST to the UPLOAD_URL API with a specific endpoint path.
 * Consolidates the repeated pattern of UPLOAD_URL + '/api/...' calls.
 */
async function apiPost(uploadUrl, endpoint, data) {
  if (!uploadUrl) return null;
  const url = `${uploadUrl}${endpoint}`;
  return httpPost(url, data);
}

module.exports = { httpPost, httpGet, apiPost, axios };
