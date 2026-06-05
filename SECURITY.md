# Security Policy

## Known Issues

### Hardcoded Secrets in Obfuscated Code

`index.js` is distributed as an obfuscated bundle. It contains hardcoded UUIDs, tokens, and domain names that act as fallback values. **You must override these** by setting the `UUID`, `ARGO_AUTH`, and `ARGO_DOMAIN` environment variables for every deployment. See `.env.example` for the full list.

### Unauthenticated Endpoints

The subscription endpoint (`/<SUB_PATH>`) and internal API routes (`/api/*`) have no authentication. Do not expose the server to the public internet without placing it behind a reverse proxy that enforces access control.

### Remote Binary Downloads

At startup the application downloads platform-specific binaries from third-party hosts and executes them. There is no checksum or signature verification. Run the application only in isolated, sandboxed, or containerised environments (e.g., Docker).

### TLS Verification Disabled

Tunnel ingress is configured with `noTLSVerify: true` and the Nezha agent uses `insecure_tls: true`. This disables certificate validation and makes connections vulnerable to man-in-the-middle attacks.

## Recommendations

1. **Always set your own `UUID`** — never use the default.
2. **Never expose the HTTP port directly** — use a reverse proxy with authentication.
3. **Run in a container** to limit blast radius from downloaded binaries.
4. **Pin dependencies** — `package.json` now pins `axios` to `^1.17.0` instead of `latest`.
5. **Review the obfuscated code** if you plan to use this in production. Consider requesting or building an unobfuscated version.

## Reporting Vulnerabilities

If you discover a security vulnerability, please open a private issue or contact the maintainer directly rather than filing a public issue.
