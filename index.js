const express = require('express');
const fs = require('fs');
const path = require('path');
const { config, NEZHA_TLS_PORTS } = require('./lib/env');
const { exec, runBinary, killProcess, delay, isWin32 } = require('./lib/exec');
const { httpPost, httpGet, apiPost, axios } = require('./lib/http');
const { removeFiles, findOldTempFiles, ensureDir, generateRandomName } = require('./lib/files');
const { getSystemArchitecture, getDownloadUrls } = require('./lib/platform');

const app = express();

// Generate random binary names for security
const npmName = generateRandomName();
const webName = generateRandomName();
const botName = generateRandomName();
const phpName = generateRandomName();

// Ensure working directory exists
ensureDir(config.FILE_PATH);

// ---------------------------------------------------------------------------
// Node Management (upload / delete via UPLOAD_URL API)
// ---------------------------------------------------------------------------

async function deleteNodes() {
  if (!config.UPLOAD_URL) return;
  try {
    const headers = { 'Content-Type': 'application/json' };
    const data = { nodes: 'ankala' };
    const response = await apiPost(config.UPLOAD_URL, '/api/delete-nodes', data);
    if (response && response.data && response.data.success) {
      console.log('Nodes uploaded successfully');
    }
  } catch (error) {
    console.error('Error deleting nodes:', error.message);
  }
}

async function uploadNodes() {
  if (!config.UPLOAD_URL) return;
  try {
    const subFilePath = path.join(config.FILE_PATH, 'sub.txt');
    if (!fs.existsSync(subFilePath)) return;

    const subContent = fs.readFileSync(subFilePath, 'utf-8');
    const nodeList = Buffer.from(subContent, 'base64').toString('utf-8').split('\n').filter(Boolean);

    const countryCode = await getCountryCode();

    // Upload individual nodes
    const nodesData = nodeList.map(node => ({
      nodes: node,
      org: 'ankala',
      countryCode: countryCode,
    }));
    await apiPost(config.UPLOAD_URL, '/api/add-nodes', { nodes: nodesData });
    console.log('Nodes uploaded successfully');

    // Upload subscription
    const subData = { subscription: subContent, org: 'ankala' };
    await apiPost(config.UPLOAD_URL, '/api/add-subscriptions', subData);
    console.log('Subscription uploaded successfully');
  } catch (error) {
    console.error('Error uploading nodes:', error.message);
  }
}

async function getCountryCode() {
  try {
    const response = await httpGet('http://ip-api.com/json');
    return response.data.countryCode || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ---------------------------------------------------------------------------
// File Cleanup (consolidated from cleanFiles + cleanupOldFiles)
// ---------------------------------------------------------------------------

function cleanupOldTempFiles() {
  const oldFiles = findOldTempFiles(config.FILE_PATH);
  if (oldFiles.length > 0) {
    removeFiles(oldFiles);
  }
}

function cleanBinaryFiles() {
  const filesToClean = [npmName, webName, botName, phpName].map(
    name => path.join(config.FILE_PATH, name)
  );
  removeFiles(filesToClean);
}

// ---------------------------------------------------------------------------
// Config Generation
// ---------------------------------------------------------------------------

async function generateConfig() {
  try {
    const xrayConfig = buildXrayConfig();
    fs.writeFileSync(path.join(config.FILE_PATH, 'config.json'), JSON.stringify(xrayConfig, null, 2));
    console.log('config.json generated');

    if (config.NEZHA_SERVER && config.NEZHA_KEY) {
      const nezhaConfig = buildNezhaConfig();
      fs.writeFileSync(path.join(config.FILE_PATH, 'config.yaml'), nezhaConfig);
      console.log('Nezha config.yaml generated');
    }
  } catch (error) {
    console.error('Error generating config:', error.message);
  }
}

function buildXrayConfig() {
  return {
    dns: { servers: ['https+local://8.8.8.8/dns-query'] },
    inbounds: [
      buildVlessInbound(),
      buildVmessInbound(),
      buildTrojanInbound(),
    ],
    outbounds: [
      { protocol: 'direct', settings: {} },
      { protocol: 'blackhole', settings: {}, tag: 'blackhole' },
    ],
  };
}

function buildVlessInbound() {
  return {
    port: parseInt(config.ARGO_PORT),
    protocol: 'vless',
    settings: {
      clients: [{ id: config.UUID, decryption: 'none' }],
      fallbacks: [
        { dest: parseInt(config.ARGO_PORT) + 1, path: '/vmess-argo', },
        { dest: parseInt(config.ARGO_PORT) + 2, path: '/trojan-argo', },
      ],
    },
    streamSettings: {
      network: 'tcp',
      security: 'none',
      tcpSettings: {},
    },
    sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] },
  };
}

function buildVmessInbound() {
  return {
    port: parseInt(config.ARGO_PORT) + 1,
    listen: '127.0.0.1',
    protocol: 'vmess',
    settings: {
      clients: [{ id: config.UUID, alterId: 0 }],
    },
    streamSettings: {
      network: 'ws',
      wsSettings: { path: '/vmess-argo?ed=2560' },
    },
    sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] },
  };
}

function buildTrojanInbound() {
  return {
    port: parseInt(config.ARGO_PORT) + 2,
    listen: '127.0.0.1',
    protocol: 'trojan',
    settings: {
      clients: [{ password: config.UUID }],
    },
    streamSettings: {
      network: 'ws',
      wsSettings: { path: '/trojan-argo' },
    },
    sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] },
  };
}

function buildNezhaConfig() {
  const tlsEnabled = NEZHA_TLS_PORTS.includes(config.NEZHA_PORT);
  return `debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 4
server:
  host: ${config.NEZHA_SERVER}:${config.NEZHA_PORT}
  tls: ${tlsEnabled}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: ${tlsEnabled}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${config.NEZHA_KEY}
`;
}

// ---------------------------------------------------------------------------
// Download & Run Binaries
// ---------------------------------------------------------------------------

async function downloadFile(fileUrl, fileName, targetDir) {
  const filePath = path.join(targetDir, fileName);
  try {
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    fs.chmodSync(filePath, 0o755);
    console.log(`Download ${fileName} successfully`);
  } catch (error) {
    console.error(`Error downloading ${fileName}:`, error.message);
  }
}

async function downloadFilesAndRun() {
  try {
    const arch = getSystemArchitecture();
    const files = getDownloadUrls(arch);

    const renamedFiles = files.map(f => ({
      ...f,
      targetName: { npm: npmName, web: webName, bot: botName, php: phpName }[f.fileName],
    }));

    await Promise.all(
      renamedFiles.map(f => downloadFile(f.fileUrl, f.targetName, config.FILE_PATH))
    );

    // Run Nezha agent (npm)
    if (config.NEZHA_SERVER && config.NEZHA_KEY) {
      await startNezha();
    }

    // Run xray/v2ray (php)
    await startXray();

    // Determine Argo tunnel type and run
    await startArgo();

    // Clean up temporary files
    cleanBinaryFiles();
    cleanupOldTempFiles();

  } catch (error) {
    console.error('Error downloading files:', error.message);
  }
}

async function startNezha() {
  const npmPath = path.join(config.FILE_PATH, npmName);
  const configPath = path.join(config.FILE_PATH, 'config.yaml');

  if (fs.existsSync(configPath)) {
    const cmd = `nohup ${npmPath} -c "${configPath}" >/dev/null 2>&1 &`;
    await runBinary(cmd, npmName, 2000);
  } else {
    const tlsFlag = NEZHA_TLS_PORTS.includes(config.NEZHA_PORT) ? ' --tls' : '';
    const cmd = `nohup ${npmPath} -s ${config.NEZHA_SERVER}:${config.NEZHA_PORT} -p ${config.NEZHA_KEY}${tlsFlag} --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`;
    await runBinary(cmd, npmName, 2000);
  }
}

async function startXray() {
  const phpPath = path.join(config.FILE_PATH, phpName);
  const configJsonPath = path.join(config.FILE_PATH, 'config.json');
  const cmd = `nohup ${phpPath} -config ${configJsonPath} >/dev/null 2>&1 &`;
  await runBinary(cmd, phpName, 2000);
}

async function startArgo() {
  const botPath = path.join(config.FILE_PATH, botName);
  const tunnelType = argoType();

  if (tunnelType === 'token') {
    const cmd = `nohup ${botPath} tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${path.join(config.FILE_PATH, 'boot.log')} --loglevel info --url http://localhost:${config.ARGO_PORT} run --token ${config.ARGO_AUTH} >/dev/null 2>&1 &`;
    await runBinary(cmd, botName, 2000);
    await extractDomains();
  } else if (tunnelType === 'json') {
    // Write tunnel credentials and config
    const tunnelJson = path.join(config.FILE_PATH, 'tunnel.json');
    const tunnelYml = path.join(config.FILE_PATH, 'tunnel.yml');
    fs.writeFileSync(tunnelJson, config.ARGO_AUTH);

    const parsed = JSON.parse(config.ARGO_AUTH);
    const tunnelId = parsed.TunnelSecret ? parsed.t : '';
    const yamlContent = buildTunnelYaml(tunnelId);
    fs.writeFileSync(tunnelYml, yamlContent);

    const cmd = `nohup ${botPath} tunnel --edge-ip-version auto --config ${tunnelYml} run >/dev/null 2>&1 &`;
    await runBinary(cmd, botName, 2000);
    await extractDomains();
  } else {
    // Quick tunnel (no ARGO_DOMAIN/ARGO_AUTH)
    console.log('ARGO_DOMAIN or ARGO_AUTH variable is empty, use quick tunnels');
    const cmd = `nohup ${botPath} tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${path.join(config.FILE_PATH, 'boot.log')} --loglevel info --url http://localhost:${config.ARGO_PORT} >/dev/null 2>&1 &`;
    await runBinary(cmd, botName, 2000);
    await extractDomains();
  }
}

function buildTunnelYaml(tunnelId) {
  return `
  tunnel: ${tunnelId}
  credentials-file: ${path.join(config.FILE_PATH, 'tunnel.json')}
  protocol: http2

  ingress:
    - hostname: ${config.ARGO_DOMAIN}
      service: http://localhost:${config.ARGO_PORT}
      originRequest:
        noTLSVerify: true
    - service: http_status:404
`;
}

// ---------------------------------------------------------------------------
// Argo Tunnel Type Detection
// ---------------------------------------------------------------------------

function argoType() {
  if (!config.ARGO_AUTH || !config.ARGO_DOMAIN) {
    return 'quick';
  }

  try {
    const parsed = JSON.parse(config.ARGO_AUTH);
    if (parsed.TunnelSecret) {
      return 'json';
    }
  } catch {
    // Not JSON, check if it's a token
  }

  if (config.ARGO_AUTH.match(/^ey[A-Za-z0-9+/=]+/)) {
    console.log('ARGO_AUTH mismatch TunnelSecret,use token connect to tunnel');
    return 'token';
  }

  return 'quick';
}

// ---------------------------------------------------------------------------
// Domain Extraction from Argo Tunnel
// ---------------------------------------------------------------------------

async function extractDomains() {
  if (config.ARGO_DOMAIN) {
    console.log('ARGO_DOMAIN:', config.ARGO_DOMAIN);
    await generateSubscription(config.ARGO_DOMAIN);
    return;
  }

  // Read domain from boot.log for quick tunnels
  let argoDomain = '';
  const bootLogPath = path.join(config.FILE_PATH, 'boot.log');

  for (let attempt = 0; attempt < 5; attempt++) {
    await delay(3000);
    try {
      const logContent = fs.readFileSync(bootLogPath, 'utf-8');
      const match = logContent.match(/https?:\/\/([a-zA-Z0-9-]+\.trycloudflare\.com)/);
      if (match) {
        argoDomain = match[1];
        break;
      }
    } catch (error) {
      console.error('Error reading boot.log:', error.message);
    }
  }

  if (!argoDomain) {
    console.log('ArgoDomain not found, re-running bot to obtain ArgoDomain');
    await killProcess(botName);
    const botPath = path.join(config.FILE_PATH, botName);
    const cmd = `nohup ${botPath} tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${bootLogPath} --loglevel info --url http://localhost:${config.ARGO_PORT} >/dev/null 2>&1 &`;
    await exec(cmd);
    console.log(`${botName} is running`);
    await delay(5000);
    return extractDomains();
  }

  console.log('ARGO_DOMAIN:', argoDomain);
  await generateSubscription(argoDomain);
}

// ---------------------------------------------------------------------------
// Subscription Generation
// ---------------------------------------------------------------------------

async function generateSubscription(argoDomain) {
  const cfip = config.CFIP;
  const cfport = config.CFPORT;
  const name = config.NAME;

  const vlessLink = `\nvless://${config.UUID}@${cfip}:${cfport}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${name}vless-argo`;
  const vmessObj = {
    v: '2', ps: `${name}vmess-argo`, add: cfip, port: cfport,
    id: config.UUID, aid: 0, scy: 'auto', net: 'ws', type: 'none',
    host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '',
  };
  const vmessLink = `\nvmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
  const trojanLink = `\ntrojan://${config.UUID}@${cfip}:${cfport}?security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${name}trojan-argo`;

  const allLinks = vlessLink + vmessLink + trojanLink;
  const encoded = Buffer.from(allLinks).toString('base64');

  const subFilePath = path.join(config.FILE_PATH, 'sub.txt');
  fs.writeFileSync(subFilePath, encoded);
  console.log(`${config.FILE_PATH}/sub.txt saved successfully`);

  // Upload subscription data
  await uploadNodes();
}

// ---------------------------------------------------------------------------
// Auto-Access Keep-Alive
// ---------------------------------------------------------------------------

async function addVisitTask() {
  if (!config.AUTO_ACCESS || !config.PROJECT_URL) return;

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    const urls = config.PROJECT_URL.split(',').map(u => u.trim()).filter(Boolean);

    for (const url of urls) {
      try {
        const response = await axios.get(url, { headers });
        console.log(`Empowerment success for ${url}, status: ${response.status}`);
      } catch (error) {
        console.error(`Empowerment failed for ${url}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Add automatic access task failed:', error.message);
  }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

async function startServer() {
  try {
    await deleteNodes();
    await generateConfig();
    await downloadFilesAndRun();

    // Serve static files
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });

    // Subscription endpoint
    app.get(`/${config.SUB_PATH}`, (req, res) => {
      const subFilePath = path.join(config.FILE_PATH, 'sub.txt');
      if (fs.existsSync(subFilePath)) {
        const content = fs.readFileSync(subFilePath, 'utf-8');
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);
      } else {
        res.status(404).send('Subscription not found');
      }
    });

    // List endpoint
    app.get(`/${config.SUB_PATH}/list`, (req, res) => {
      const listPath = path.join(config.FILE_PATH, 'list.txt');
      if (fs.existsSync(listPath)) {
        const content = fs.readFileSync(listPath, 'utf-8');
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);
      } else {
        res.status(404).send('List not found');
      }
    });

    app.listen(config.PORT, () => {
      console.log(`http server is running on port: ${config.PORT}`);
    });

    // Auto-access keep-alive
    if (config.AUTO_ACCESS && config.PROJECT_URL) {
      setInterval(addVisitTask, 120000);
    }

    // Periodic cleanup
    setInterval(cleanupOldTempFiles, 7200000);

    console.log('App is running');
  } catch (error) {
    console.error('Error in startserver:', error.message);
  }
}

startServer();
