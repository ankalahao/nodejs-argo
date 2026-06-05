/**
 * Security-hardened entry point.
 *
 * Wraps the original index.js with:
 *  - helmet (security headers)
 *  - express-rate-limit (brute-force / DoS protection)
 *
 * Usage:
 *   node server.js          (hardened — recommended)
 *   node index.js            (original, no hardening)
 */

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Patch express *before* index.js loads it.
// index.js calls express() internally, so we monkey-patch the module cache
// to inject middleware into whatever app instance it creates.

const originalExpress = express;
const patchedExpress = function patchedExpressFactory() {
  const app = originalExpress();

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // the static HTML loads external CDN assets
  }));

  // Rate limiting — 100 requests per minute per IP
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.',
  }));

  return app;
};

// Copy static properties from original express
Object.assign(patchedExpress, originalExpress);

// Replace express in the module cache so index.js picks up the patched version
require.cache[require.resolve('express')] = {
  id: require.resolve('express'),
  filename: require.resolve('express'),
  loaded: true,
  exports: patchedExpress,
};

// Now load the original application
require('./index');
