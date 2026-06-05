'use strict';

const {
  generateSubscription,
  parseSubscription,
  countProtocols,
} = require('../src/subscription');

describe('subscription module', () => {
  const defaultParams = {
    uuid: '89c13786-25aa-4520-b2e7-12cd60fb5202',
    host: 'www.visa.com.tw',
    port: 443,
    domain: 'tunnel.example.com',
    name: 'TestNode',
  };

  describe('generateSubscription', () => {
    it('should return base64-encoded content with all three protocols', () => {
      const result = generateSubscription(defaultParams);
      expect(result).toBeTruthy();
      // Should be valid base64
      expect(() => Buffer.from(result, 'base64')).not.toThrow();
    });

    it('should return empty string when domain is empty', () => {
      const result = generateSubscription({ ...defaultParams, domain: '' });
      expect(result).toBe('');
    });

    it('should return empty string when domain is undefined', () => {
      const result = generateSubscription({ ...defaultParams, domain: undefined });
      expect(result).toBe('');
    });

    it('should contain VLESS, VMess, and Trojan links when decoded', () => {
      const result = generateSubscription(defaultParams);
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      const lines = decoded.split('\n');
      expect(lines.length).toBe(3);
      expect(lines[0]).toMatch(/^vless:\/\//);
      expect(lines[1]).toMatch(/^vmess:\/\//);
      expect(lines[2]).toMatch(/^trojan:\/\//);
    });

    it('should use the provided UUID in all links', () => {
      const result = generateSubscription(defaultParams);
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      expect(decoded).toContain(defaultParams.uuid);
    });

    it('should use the provided name in remarks', () => {
      const result = generateSubscription(defaultParams);
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      expect(decoded).toContain('TestNode-vless');
      expect(decoded).toContain('TestNode-trojan');
    });

    it('should use the provided host', () => {
      const result = generateSubscription(defaultParams);
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      expect(decoded).toContain(defaultParams.host);
    });

    it('should use the provided domain as SNI', () => {
      const result = generateSubscription(defaultParams);
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      expect(decoded).toContain(`sni=${defaultParams.domain}`);
    });

    it('should work with custom port', () => {
      const result = generateSubscription({ ...defaultParams, port: 8443 });
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      expect(decoded).toContain(':8443');
    });

    it('should work with IP address as host', () => {
      const result = generateSubscription({ ...defaultParams, host: '1.2.3.4' });
      const decoded = Buffer.from(result, 'base64').toString('utf-8');
      expect(decoded).toContain('1.2.3.4');
    });
  });

  describe('parseSubscription', () => {
    it('should parse base64 subscription content into links', () => {
      const sub = generateSubscription(defaultParams);
      const links = parseSubscription(sub);
      expect(links.length).toBe(3);
    });

    it('should return empty array for empty input', () => {
      expect(parseSubscription('')).toEqual([]);
    });

    it('should return empty array for null input', () => {
      expect(parseSubscription(null)).toEqual([]);
    });

    it('should filter out empty lines', () => {
      const content = Buffer.from('vless://test\n\nvmess://test\n').toString('base64');
      const links = parseSubscription(content);
      expect(links.length).toBe(2);
    });
  });

  describe('countProtocols', () => {
    it('should count protocols correctly', () => {
      const links = [
        'vless://uuid@host:443?params',
        'vmess://base64content',
        'trojan://uuid@host:443?params',
      ];
      const counts = countProtocols(links);
      expect(counts.vless).toBe(1);
      expect(counts.vmess).toBe(1);
      expect(counts.trojan).toBe(1);
    });

    it('should handle empty array', () => {
      const counts = countProtocols([]);
      expect(counts.vless).toBe(0);
      expect(counts.vmess).toBe(0);
      expect(counts.trojan).toBe(0);
    });

    it('should handle multiple links of same protocol', () => {
      const links = [
        'vless://a@host:443',
        'vless://b@host:443',
        'vmess://content',
      ];
      const counts = countProtocols(links);
      expect(counts.vless).toBe(2);
      expect(counts.vmess).toBe(1);
      expect(counts.trojan).toBe(0);
    });

    it('should ignore unrecognized protocols', () => {
      const links = ['ss://base64', 'ssr://base64'];
      const counts = countProtocols(links);
      expect(counts.vless).toBe(0);
      expect(counts.vmess).toBe(0);
      expect(counts.trojan).toBe(0);
    });
  });
});
