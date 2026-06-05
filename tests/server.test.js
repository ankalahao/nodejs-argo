'use strict';

const request = require('supertest');
const { createApp } = require('../src/server');

describe('server module', () => {
  const testConfig = {
    uploadUrl: '',
    projectUrl: 'https://www.google.com',
    autoAccess: false,
    port: 3000,
    argoPort: 8001,
    uuid: '89c13786-25aa-4520-b2e7-12cd60fb5202',
    nezhaServer: '',
    nezhaPort: '',
    nezhaKey: '',
    argoDomain: 'tunnel.example.com',
    argoAuth: 'eytoken',
    cfip: 'www.visa.com.tw',
    cfport: 443,
    name: 'TestNode',
    filePath: './tmp',
    subPath: 'sub',
  };

  let app;

  beforeEach(() => {
    app = createApp({ config: testConfig, domain: 'tunnel.example.com' });
  });

  describe('GET /', () => {
    it('should respond with 200', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });

    it('should return HTML content', async () => {
      const res = await request(app).get('/');
      expect(res.headers['content-type']).toMatch(/html/);
    });
  });

  describe('GET /sub (subscription endpoint)', () => {
    it('should respond with 200', async () => {
      const res = await request(app).get('/sub');
      expect(res.status).toBe(200);
    });

    it('should return text/plain content type', async () => {
      const res = await request(app).get('/sub');
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });

    it('should return base64 encoded subscription content', async () => {
      const res = await request(app).get('/sub');
      const decoded = Buffer.from(res.text, 'base64').toString('utf-8');
      expect(decoded).toContain('vless://');
      expect(decoded).toContain('vmess://');
      expect(decoded).toContain('trojan://');
    });

    it('should contain the configured UUID in subscription', async () => {
      const res = await request(app).get('/sub');
      const decoded = Buffer.from(res.text, 'base64').toString('utf-8');
      expect(decoded).toContain(testConfig.uuid);
    });

    it('should contain the configured node name', async () => {
      const res = await request(app).get('/sub');
      const decoded = Buffer.from(res.text, 'base64').toString('utf-8');
      expect(decoded).toContain('TestNode');
    });

    it('should return message when no domain is configured', async () => {
      const appNoDomain = createApp({ config: { ...testConfig, argoDomain: '' }, domain: '' });
      const res = await request(appNoDomain).get('/sub');
      expect(res.text).toContain('No subscription available');
    });
  });

  describe('GET /sub with custom SUB_PATH', () => {
    it('should work with custom sub path', async () => {
      const customConfig = { ...testConfig, subPath: 'mysub' };
      const customApp = createApp({ config: customConfig, domain: 'tunnel.example.com' });
      const res = await request(customApp).get('/mysub');
      expect(res.status).toBe(200);
    });

    it('should return 404 for wrong path', async () => {
      const customConfig = { ...testConfig, subPath: 'mysub' };
      const customApp = createApp({ config: customConfig, domain: 'tunnel.example.com' });
      const res = await request(customApp).get('/sub');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /status', () => {
    it('should respond with 200 and JSON', async () => {
      const res = await request(app).get('/status');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('should include running status', async () => {
      const res = await request(app).get('/status');
      expect(res.body.running).toBe(true);
    });

    it('should include port information', async () => {
      const res = await request(app).get('/status');
      expect(res.body.port).toBe(3000);
      expect(res.body.argoPort).toBe(8001);
    });

    it('should report tunnel status correctly when configured', async () => {
      const res = await request(app).get('/status');
      expect(res.body.hasTunnel).toBe(true);
    });

    it('should report no tunnel when not configured', async () => {
      const appNoTunnel = createApp({
        config: { ...testConfig, argoDomain: '', argoAuth: '' },
      });
      const res = await request(appNoTunnel).get('/status');
      expect(res.body.hasTunnel).toBe(false);
    });

    it('should report Nezha status correctly', async () => {
      const res = await request(app).get('/status');
      expect(res.body.hasNezha).toBe(false);

      const appWithNezha = createApp({
        config: { ...testConfig, nezhaServer: 'nz.test.com', nezhaKey: 'key' },
      });
      const resNezha = await request(appWithNezha).get('/status');
      expect(resNezha.body.hasNezha).toBe(true);
    });

    it('should report autoAccess setting', async () => {
      const res = await request(app).get('/status');
      expect(res.body.autoAccess).toBe(false);

      const appAutoAccess = createApp({
        config: { ...testConfig, autoAccess: true },
      });
      const resAA = await request(appAutoAccess).get('/status');
      expect(resAA.body.autoAccess).toBe(true);
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for undefined routes', async () => {
      const res = await request(app).get('/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
