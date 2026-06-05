const env = process.env;

const config = {
  FILE_PATH: env.FILE_PATH || './tmp',
  SUB_PATH: env.SUB_PATH || 'sub',
  PORT: env.SERVER_PORT || env.PORT || 3000,
  UUID: env.UUID || '2a19f928-6411-4329-9f00-a368cf3894e6',
  NEZHA_SERVER: env.NEZHA_SERVER || '',
  NEZHA_PORT: env.NEZHA_PORT || '',
  NEZHA_KEY: env.NEZHA_KEY || '',
  ARGO_DOMAIN: env.ARGO_DOMAIN || '',
  ARGO_AUTH: env.ARGO_AUTH || '',
  ARGO_PORT: env.ARGO_PORT || 8001,
  CFIP: env.CFIP || 'saas.sin.fan',
  CFPORT: env.CFPORT || 443,
  NAME: env.NAME || '',
  UPLOAD_URL: env.UPLOAD_URL || '',
  PROJECT_URL: env.PROJECT_URL || '',
  AUTO_ACCESS: env.AUTO_ACCESS || false,
};

const NEZHA_TLS_PORTS = ['443', '8443', '2096', '2087', '2083', '2053'];

module.exports = { config, NEZHA_TLS_PORTS };
