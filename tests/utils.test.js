'use strict';

const {
  isValidUUID,
  generateUUID,
  toBase64,
  fromBase64,
  parseArgoAuth,
  buildVlessUri,
  buildVmessUri,
  buildTrojanUri,
  sanitizePath,
} = require('../src/utils');

describe('utils module', () => {
  describe('isValidUUID', () => {
    it('should accept a valid UUID v4', () => {
      expect(isValidUUID('89c13786-25aa-4520-b2e7-12cd60fb5202')).toBe(true);
    });

    it('should accept uppercase UUID v4', () => {
      expect(isValidUUID('89C13786-25AA-4520-B2E7-12CD60FB5202')).toBe(true);
    });

    it('should reject UUID with wrong version digit', () => {
      expect(isValidUUID('89c13786-25aa-3520-b2e7-12cd60fb5202')).toBe(false);
    });

    it('should reject UUID with wrong variant digit', () => {
      expect(isValidUUID('89c13786-25aa-4520-02e7-12cd60fb5202')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should reject random string', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should reject UUID without hyphens', () => {
      expect(isValidUUID('89c1378625aa4520b2e712cd60fb5202')).toBe(false);
    });

    it('should reject UUID with wrong length', () => {
      expect(isValidUUID('89c13786-25aa-4520-b2e7-12cd60fb520')).toBe(false);
    });
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID v4', () => {
      const uuid = generateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe('toBase64 / fromBase64', () => {
    it('should encode and decode simple strings', () => {
      const input = 'Hello, World!';
      const encoded = toBase64(input);
      expect(encoded).toBe('SGVsbG8sIFdvcmxkIQ==');
      expect(fromBase64(encoded)).toBe(input);
    });

    it('should handle empty string', () => {
      expect(toBase64('')).toBe('');
      expect(fromBase64('')).toBe('');
    });

    it('should handle unicode characters', () => {
      const input = '你好世界';
      const encoded = toBase64(input);
      expect(fromBase64(encoded)).toBe(input);
    });

    it('should handle URLs with special characters', () => {
      const input = 'vless://uuid@host:443?security=tls&type=ws#name';
      const encoded = toBase64(input);
      expect(fromBase64(encoded)).toBe(input);
    });
  });

  describe('parseArgoAuth', () => {
    it('should return temporary type for empty string', () => {
      const result = parseArgoAuth('');
      expect(result.type).toBe('temporary');
      expect(result.value).toBe('');
    });

    it('should return temporary type for null/undefined', () => {
      expect(parseArgoAuth(null).type).toBe('temporary');
      expect(parseArgoAuth(undefined).type).toBe('temporary');
    });

    it('should detect JSON tunnel credential', () => {
      const json = JSON.stringify({
        AccountTag: 'abc123',
        TunnelSecret: 'secret',
        TunnelID: 'tunnel-id',
      });
      const result = parseArgoAuth(json);
      expect(result.type).toBe('json');
      expect(result.value).toBe(json);
    });

    it('should detect token-based auth', () => {
      const token = 'eyJhIjoiYjEyMzQ1NiIsInQiOiJ0dW5uZWxJZCIsInMiOiJzZWNyZXQifQ==';
      const result = parseArgoAuth(token);
      expect(result.type).toBe('token');
      expect(result.value).toBe(token);
    });

    it('should return unknown for other strings', () => {
      const result = parseArgoAuth('some-random-string');
      expect(result.type).toBe('unknown');
      expect(result.value).toBe('some-random-string');
    });

    it('should return unknown for invalid JSON', () => {
      const result = parseArgoAuth('{invalid json}');
      expect(result.type).toBe('unknown');
    });

    it('should return unknown for JSON without required fields', () => {
      const result = parseArgoAuth(JSON.stringify({ foo: 'bar' }));
      expect(result.type).toBe('unknown');
    });
  });

  describe('buildVlessUri', () => {
    const params = {
      uuid: '89c13786-25aa-4520-b2e7-12cd60fb5202',
      host: 'www.visa.com.tw',
      port: 443,
      sni: 'tunnel.example.com',
      name: 'Test',
    };

    it('should build a valid VLESS URI', () => {
      const uri = buildVlessUri(params);
      expect(uri).toMatch(/^vless:\/\//);
      expect(uri).toContain(params.uuid);
      expect(uri).toContain(params.host);
      expect(uri).toContain(`:${params.port}`);
      expect(uri).toContain(`sni=${params.sni}`);
      expect(uri).toContain('security=tls');
      expect(uri).toContain('type=ws');
    });

    it('should use default path when none is provided', () => {
      const uri = buildVlessUri(params);
      expect(uri).toContain(encodeURIComponent(`/${params.uuid}-vless`));
    });

    it('should use custom path when provided', () => {
      const uri = buildVlessUri({ ...params, path: '/custom-path' });
      expect(uri).toContain(encodeURIComponent('/custom-path'));
    });

    it('should include remark with name and protocol', () => {
      const uri = buildVlessUri(params);
      expect(uri).toContain('#Test-vless');
    });
  });

  describe('buildVmessUri', () => {
    const params = {
      uuid: '89c13786-25aa-4520-b2e7-12cd60fb5202',
      host: 'www.visa.com.tw',
      port: 443,
      sni: 'tunnel.example.com',
      name: 'Test',
    };

    it('should build a valid VMess URI (base64 encoded)', () => {
      const uri = buildVmessUri(params);
      expect(uri).toMatch(/^vmess:\/\//);
    });

    it('should contain correct JSON config when decoded', () => {
      const uri = buildVmessUri(params);
      const b64 = uri.replace('vmess://', '');
      const config = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
      expect(config.v).toBe('2');
      expect(config.ps).toBe('Test-vmess');
      expect(config.add).toBe(params.host);
      expect(config.port).toBe(params.port);
      expect(config.id).toBe(params.uuid);
      expect(config.aid).toBe(0);
      expect(config.net).toBe('ws');
      expect(config.tls).toBe('tls');
      expect(config.sni).toBe(params.sni);
    });

    it('should use default path when none is provided', () => {
      const uri = buildVmessUri(params);
      const b64 = uri.replace('vmess://', '');
      const config = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
      expect(config.path).toBe(`/${params.uuid}-vmess`);
    });

    it('should use custom path when provided', () => {
      const uri = buildVmessUri({ ...params, path: '/my-path' });
      const b64 = uri.replace('vmess://', '');
      const config = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
      expect(config.path).toBe('/my-path');
    });
  });

  describe('buildTrojanUri', () => {
    const params = {
      uuid: '89c13786-25aa-4520-b2e7-12cd60fb5202',
      host: 'www.visa.com.tw',
      port: 443,
      sni: 'tunnel.example.com',
      name: 'Test',
    };

    it('should build a valid Trojan URI', () => {
      const uri = buildTrojanUri(params);
      expect(uri).toMatch(/^trojan:\/\//);
      expect(uri).toContain(params.uuid);
      expect(uri).toContain(params.host);
      expect(uri).toContain(`:${params.port}`);
      expect(uri).toContain(`sni=${params.sni}`);
      expect(uri).toContain('security=tls');
      expect(uri).toContain('type=ws');
    });

    it('should use default path when none is provided', () => {
      const uri = buildTrojanUri(params);
      expect(uri).toContain(encodeURIComponent(`/${params.uuid}-trojan`));
    });

    it('should use custom path when provided', () => {
      const uri = buildTrojanUri({ ...params, path: '/custom' });
      expect(uri).toContain(encodeURIComponent('/custom'));
    });

    it('should include remark', () => {
      const uri = buildTrojanUri(params);
      expect(uri).toContain('#Test-trojan');
    });
  });

  describe('sanitizePath', () => {
    it('should remove directory traversal patterns', () => {
      expect(sanitizePath('../etc/passwd')).toBe('etc/passwd');
    });

    it('should remove multiple traversal patterns', () => {
      expect(sanitizePath('../../etc/../passwd')).toBe('etc/passwd');
    });

    it('should remove double slashes', () => {
      expect(sanitizePath('/tmp//file')).toBe('/tmp/file');
    });

    it('should leave normal paths unchanged', () => {
      expect(sanitizePath('./tmp/data')).toBe('./tmp/data');
    });

    it('should handle empty string', () => {
      expect(sanitizePath('')).toBe('');
    });
  });
});
