'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('./config');
const { generateSubscription } = require('./subscription');

/**
 * Create an Express application with configured routes.
 * Separated from listen() for testability with supertest.
 * @param {object} [options]
 * @param {object} [options.config] - Override config (for testing)
 * @param {string} [options.domain] - Argo domain (may be discovered at runtime)
 * @returns {object} Express app instance
 */
function createApp(options = {}) {
  const config = options.config || getConfig();
  const app = express();

  // Health check / root route - serves the static HTML page
  app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(200).send('OK');
    }
  });

  // Subscription endpoint
  app.get(`/${config.subPath}`, (req, res) => {
    const domain = options.domain || config.argoDomain;
    const subContent = generateSubscription({
      uuid: config.uuid,
      host: config.cfip,
      port: config.cfport,
      domain: domain,
      name: config.name,
    });

    if (subContent) {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send(subContent);
    } else {
      res.status(200).send('No subscription available. Configure ARGO_DOMAIN to enable.');
    }
  });

  // Status endpoint
  app.get('/status', (req, res) => {
    res.json({
      running: true,
      port: config.port,
      argoPort: config.argoPort,
      hasTunnel: !!(config.argoDomain && config.argoAuth),
      hasNezha: !!(config.nezhaServer && config.nezhaKey),
      autoAccess: config.autoAccess,
    });
  });

  return app;
}

module.exports = { createApp };
