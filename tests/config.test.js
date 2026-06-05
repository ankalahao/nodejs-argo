'use strict';

const {
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
} = require('../src/config');

describe('config module', () => {
  describe('getConfig', () => {
    it('should return all defaults when env is empty', () => {
      const config = getConfig({});
      expect(config.uploadUrl).toBe('');
      expect(config.projectUrl).toBe(DEFAULT_PROJECT_URL);
      expect(config.autoAccess).toBe(false);
      expect(config.port).toBe(DEFAULT_PORT);
      expect(config.argoPort).toBe(DEFAULT_ARGO_PORT);
      expect(config.uuid).toBe(DEFAULT_UUID);
      expect(config.nezhaServer).toBe('');
      expect(config.nezhaPort).toBe('');
      expect(config.nezhaKey).toBe('');
      expect(config.argoDomain).toBe('');
      expect(config.argoAuth).toBe('');
      expect(config.cfip).toBe(DEFAULT_CFIP);
      expect(config.cfport).toBe(DEFAULT_CFPORT);
      expect(config.name).toBe(DEFAULT_NAME);
      expect(config.filePath).toBe(DEFAULT_FILE_PATH);
      expect(config.subPath).toBe(DEFAULT_SUB_PATH);
    });

    it('should parse PORT as integer', () => {
      const config = getConfig({ PORT: '8080' });
      expect(config.port).toBe(8080);
    });

    it('should parse ARGO_PORT as integer', () => {
      const config = getConfig({ ARGO_PORT: '9000' });
      expect(config.argoPort).toBe(9000);
    });

    it('should parse CFPORT as integer', () => {
      const config = getConfig({ CFPORT: '8443' });
      expect(config.cfport).toBe(8443);
    });

    it('should fall back to default PORT on invalid value', () => {
      const config = getConfig({ PORT: 'invalid' });
      expect(config.port).toBe(DEFAULT_PORT);
    });

    it('should fall back to default ARGO_PORT on invalid value', () => {
      const config = getConfig({ ARGO_PORT: 'abc' });
      expect(config.argoPort).toBe(DEFAULT_ARGO_PORT);
    });

    it('should parse AUTO_ACCESS as boolean', () => {
      expect(getConfig({ AUTO_ACCESS: 'true' }).autoAccess).toBe(true);
      expect(getConfig({ AUTO_ACCESS: 'false' }).autoAccess).toBe(false);
      expect(getConfig({ AUTO_ACCESS: '1' }).autoAccess).toBe(false);
      expect(getConfig({ AUTO_ACCESS: '' }).autoAccess).toBe(false);
    });

    it('should read custom UUID', () => {
      const config = getConfig({ UUID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' });
      expect(config.uuid).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    });

    it('should read Nezha config', () => {
      const config = getConfig({
        NEZHA_SERVER: 'nz.example.com',
        NEZHA_PORT: '443',
        NEZHA_KEY: 'secretkey123',
      });
      expect(config.nezhaServer).toBe('nz.example.com');
      expect(config.nezhaPort).toBe('443');
      expect(config.nezhaKey).toBe('secretkey123');
    });

    it('should read Argo config', () => {
      const config = getConfig({
        ARGO_DOMAIN: 'tunnel.example.com',
        ARGO_AUTH: 'eyJhIjoiYiJ9',
      });
      expect(config.argoDomain).toBe('tunnel.example.com');
      expect(config.argoAuth).toBe('eyJhIjoiYiJ9');
    });

    it('should read all custom values', () => {
      const config = getConfig({
        UPLOAD_URL: 'https://merge.example.com',
        PROJECT_URL: 'https://myproject.com',
        AUTO_ACCESS: 'true',
        PORT: '4000',
        ARGO_PORT: '9001',
        UUID: '12345678-abcd-4ef0-9012-123456789abc',
        NEZHA_SERVER: 'nz.test.com',
        NEZHA_PORT: '8443',
        NEZHA_KEY: 'key123',
        ARGO_DOMAIN: 'argo.test.com',
        ARGO_AUTH: 'tokenvalue',
        CFIP: '1.1.1.1',
        CFPORT: '2053',
        NAME: 'MyNode',
        FILE_PATH: '/data',
        SUB_PATH: 'mysub',
      });
      expect(config.uploadUrl).toBe('https://merge.example.com');
      expect(config.projectUrl).toBe('https://myproject.com');
      expect(config.autoAccess).toBe(true);
      expect(config.port).toBe(4000);
      expect(config.argoPort).toBe(9001);
      expect(config.uuid).toBe('12345678-abcd-4ef0-9012-123456789abc');
      expect(config.nezhaServer).toBe('nz.test.com');
      expect(config.nezhaPort).toBe('8443');
      expect(config.nezhaKey).toBe('key123');
      expect(config.argoDomain).toBe('argo.test.com');
      expect(config.argoAuth).toBe('tokenvalue');
      expect(config.cfip).toBe('1.1.1.1');
      expect(config.cfport).toBe(2053);
      expect(config.name).toBe('MyNode');
      expect(config.filePath).toBe('/data');
      expect(config.subPath).toBe('mysub');
    });

    it('should default to process.env when no arg is given', () => {
      const originalPort = process.env.PORT;
      process.env.PORT = '5555';
      const config = getConfig();
      expect(config.port).toBe(5555);
      if (originalPort === undefined) delete process.env.PORT;
      else process.env.PORT = originalPort;
    });
  });

  describe('isFixedTunnel', () => {
    it('should return true when both argoDomain and argoAuth are set', () => {
      expect(isFixedTunnel({ argoDomain: 'example.com', argoAuth: 'token' })).toBe(true);
    });

    it('should return false when argoDomain is empty', () => {
      expect(isFixedTunnel({ argoDomain: '', argoAuth: 'token' })).toBe(false);
    });

    it('should return false when argoAuth is empty', () => {
      expect(isFixedTunnel({ argoDomain: 'example.com', argoAuth: '' })).toBe(false);
    });

    it('should return false when both are empty', () => {
      expect(isFixedTunnel({ argoDomain: '', argoAuth: '' })).toBe(false);
    });
  });

  describe('isNezhaEnabled', () => {
    it('should return true when both server and key are set', () => {
      expect(isNezhaEnabled({ nezhaServer: 'nz.example.com', nezhaKey: 'key' })).toBe(true);
    });

    it('should return false when server is empty', () => {
      expect(isNezhaEnabled({ nezhaServer: '', nezhaKey: 'key' })).toBe(false);
    });

    it('should return false when key is empty', () => {
      expect(isNezhaEnabled({ nezhaServer: 'nz.example.com', nezhaKey: '' })).toBe(false);
    });
  });

  describe('isNezhaTls', () => {
    it('should return true for port 443', () => {
      expect(isNezhaTls({ nezhaPort: '443' })).toBe(true);
    });

    it('should return true for port 8443', () => {
      expect(isNezhaTls({ nezhaPort: '8443' })).toBe(true);
    });

    it('should return true for port 2096', () => {
      expect(isNezhaTls({ nezhaPort: '2096' })).toBe(true);
    });

    it('should return true for port 2087', () => {
      expect(isNezhaTls({ nezhaPort: '2087' })).toBe(true);
    });

    it('should return true for port 2083', () => {
      expect(isNezhaTls({ nezhaPort: '2083' })).toBe(true);
    });

    it('should return true for port 2053', () => {
      expect(isNezhaTls({ nezhaPort: '2053' })).toBe(true);
    });

    it('should return false for port 8080', () => {
      expect(isNezhaTls({ nezhaPort: '8080' })).toBe(false);
    });

    it('should return false for empty port', () => {
      expect(isNezhaTls({ nezhaPort: '' })).toBe(false);
    });

    it('should handle numeric port value', () => {
      expect(isNezhaTls({ nezhaPort: 443 })).toBe(true);
    });
  });
});
