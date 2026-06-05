const express = require("express");
const app = express();
const axios = require("axios");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

const UPLOAD_URL = process.env.UPLOAD_URL || "";
const PROJECT_URL = process.env.PROJECT_URL || "";
const AUTO_ACCESS = process.env.AUTO_ACCESS || false;
const FILE_PATH = process.env.FILE_PATH || ".tmp";
const SUB_PATH = process.env.SUB_PATH || "sub";
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const UUID =
  process.env.UUID || "89c13786-25aa-4520-b2e7-12cd60fb5202";
const NEZHA_SERVER = process.env.NEZHA_SERVER || "";
const NEZHA_PORT = process.env.NEZHA_PORT || "";
const NEZHA_KEY = process.env.NEZHA_KEY || "";
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || "";
const ARGO_AUTH = process.env.ARGO_AUTH || "";
const ARGO_PORT = process.env.ARGO_PORT || 8001;
const CFIP = process.env.CFIP || "www.visa.com.tw";
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || "Vls";

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH, { recursive: true });
  console.log(FILE_PATH + " is created");
} else {
  console.log(FILE_PATH + " already exists");
}

function generateRandomName() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let name = "";
  for (let i = 0; i < 6; i++) {
    name += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return name;
}

const npmName = generateRandomName();
const webName = generateRandomName();
const botName = generateRandomName();
const phpName = generateRandomName();
let npmPath = path.join(FILE_PATH, npmName);
let phpPath = path.join(FILE_PATH, phpName);
let webPath = path.join(FILE_PATH, webName);
let botPath = path.join(FILE_PATH, botName);
let subPath = path.join(FILE_PATH, "sub.txt");
let listPath = path.join(FILE_PATH, "list.txt");
let bootLogPath = path.join(FILE_PATH, "boot.log");
let configPath = path.join(FILE_PATH, "config.json");

function deleteNodes() {
  try {
    if (!UPLOAD_URL) {
      return;
    }
    if (!fs.existsSync(subPath)) {
      return;
    }
    let content;
    try {
      content = fs.readFileSync(subPath, "utf-8");
    } catch (err) {
      console.error("Failed to read sub.txt for node deletion:", err.message);
      return;
    }
    const decoded = Buffer.from(content, "base64").toString("utf-8");
    const nodes = decoded
      .split("\n")
      .filter((line) =>
        /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
      );
    if (nodes.length === 0) {
      return;
    }
    const payload = { nodes };
    axios
      .post(UPLOAD_URL + "/api/delete-nodes", JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      })
      .catch((err) => {
        console.error("Failed to delete nodes from remote:", err.message);
      });
  } catch (err) {
    console.error("Error in deleteNodes:", err.message);
  }
}

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(FILE_PATH);
    files.forEach((file) => {
      const filePath = path.join(FILE_PATH, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Failed to clean up file " + filePath + ":", err.message);
      }
    });
  } catch (err) {
    console.error("Failed to read directory for cleanup:", err.message);
  }
}

async function generateConfig() {
  const mainInbound = {
    port: ARGO_PORT,
    protocol: "vless",
    settings: {
      clients: [{ id: UUID, flow: "xtls-rprx-vision" }],
      decryption: "none",
      fallbacks: [
        { dest: 3001 },
        { path: "/vless-argo", dest: 3002 },
        { path: "/vmess-argo", dest: 3003 },
        { path: "/trojan-argo", dest: 3004 },
      ],
    },
    streamSettings: { network: "tcp" },
  };

  const vlessFallback = {
    port: 3001,
    listen: "127.0.0.1",
    protocol: "vless",
    settings: {
      clients: [{ id: UUID }],
      decryption: "none",
    },
    streamSettings: { network: "tcp", security: "none" },
  };

  const vlessWs = {
    port: 3002,
    listen: "127.0.0.1",
    protocol: "vless",
    settings: {
      clients: [{ id: UUID, level: 0 }],
      decryption: "none",
    },
    streamSettings: {
      network: "ws",
      security: "none",
      wsSettings: { path: "/vless-argo" },
    },
    sniffing: {
      enabled: true,
      destOverride: ["http", "tls", "quic"],
      metadataOnly: false,
    },
  };

  const vmessWs = {
    port: 3003,
    listen: "127.0.0.1",
    protocol: "vmess",
    settings: { clients: [{ id: UUID, alterId: 0 }] },
    streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } },
    sniffing: {
      enabled: true,
      destOverride: ["http", "tls", "quic"],
      metadataOnly: false,
    },
  };

  const trojanWs = {
    port: 3004,
    listen: "127.0.0.1",
    protocol: "trojan",
    settings: { clients: [{ password: UUID }] },
    streamSettings: {
      network: "ws",
      security: "none",
      wsSettings: { path: "/trojan-argo" },
    },
    sniffing: {
      enabled: true,
      destOverride: ["http", "tls", "quic"],
      metadataOnly: false,
    },
  };

  const config = {
    log: { access: "/dev/null", error: "/dev/null", loglevel: "none" },
    inbounds: [mainInbound, vlessFallback, vlessWs, vmessWs, trojanWs],
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [
      { protocol: "freedom", tag: "direct" },
      { protocol: "blackhole", tag: "block" },
    ],
  };

  fs.writeFileSync(
    path.join(FILE_PATH, "config.json"),
    JSON.stringify(config, null, 2)
  );
}

function getSystemArchitecture() {
  const arch = os.arch();
  if (arch === "arm" || arch === "arm64" || arch === "aarch64") {
    return "arm";
  }
  return "amd";
}

function downloadFile(filePath, fileUrl, callback) {
  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(FILE_PATH, { recursive: true });
  }
  const writer = fs.createWriteStream(filePath);
  axios({ method: "get", url: fileUrl, responseType: "stream" })
    .then((response) => {
      response.data.pipe(writer);
      writer.on("finish", () => {
        writer.close();
        console.log("Download " + path.basename(filePath) + " successfully");
        callback(null, filePath);
      });
      writer.on("error", (err) => {
        fs.unlink(filePath, () => {});
        const msg =
          "Download " +
          path.basename(filePath) +
          " failed (write error): " +
          err.message;
        console.error(msg);
        callback(new Error(msg));
      });
    })
    .catch((err) => {
      const msg =
        "Download " +
        path.basename(filePath) +
        " failed (network error): " +
        err.message;
      console.error(msg);
      callback(new Error(msg));
    });
}

async function downloadFilesAndRun() {
  const architecture = getSystemArchitecture();
  const files = getFilesForArchitecture(architecture);
  if (files.length === 0) {
    console.log("Can't find a file for the current architecture");
    return;
  }

  const downloads = files.map((file) => {
    return new Promise((resolve, reject) => {
      downloadFile(file.fileName, file.fileUrl, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  });

  try {
    await Promise.all(downloads);
  } catch (err) {
    console.error("Error downloading files:", err.message);
    return;
  }

  function setPermissions(filePaths) {
    filePaths.forEach((fp) => {
      if (fs.existsSync(fp)) {
        fs.chmod(fp, 0o775, (err) => {
          if (err) {
            console.error("Empowerment failed for " + fp + ": " + err.message);
          } else {
            console.log("Empowerment success for " + fp + ": 775");
          }
        });
      }
    });
  }

  const binaries = NEZHA_PORT
    ? [npmPath, webPath, botPath]
    : [phpPath, webPath, botPath];
  setPermissions(binaries);

  if (NEZHA_SERVER && NEZHA_KEY) {
    if (!NEZHA_PORT) {
      const port = NEZHA_SERVER.includes(":")
        ? NEZHA_SERVER.split(":").pop()
        : "";
      const tlsPorts = new Set(["443", "8443", "2096", "2087", "2083", "2053"]);
      const useTls = tlsPorts.has(port) ? "true" : "false";
      const yamlConfig =
        "\nclient_secret: " +
        NEZHA_KEY +
        "\ndebug: false\ndisable_auto_update: true\ndisable_command_execute: false\ndisable_force_update: true\ndisable_nat: false\ndisable_send_query: false\ngpu: false\ninsecure_tls: true\nip_report_period: 1800\nreport_delay: 4\nserver: " +
        NEZHA_SERVER +
        "\nskip_connection_count: true\nskip_procs_count: true\ntemperature: false\ntls: " +
        useTls +
        "\nuse_gitee_to_upgrade: false\nuse_ipv6_country_code: false\nuuid: " +
        UUID;
      fs.writeFileSync(path.join(FILE_PATH, "config.yaml"), yamlConfig);
      const cmd =
        "nohup " +
        phpPath +
        ' -c "' +
        FILE_PATH +
        '/config.yaml" >/dev/null 2>&1 &';
      try {
        await exec(cmd);
        console.log(phpName + " is running");
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error("php running error:", err.message);
      }
    } else {
      let tlsFlag = "";
      const tlsPorts = ["443", "8443", "2096", "2087", "2083", "2053"];
      if (tlsPorts.includes(NEZHA_PORT)) {
        tlsFlag = "--tls";
      }
      const cmd =
        "nohup " +
        npmPath +
        " -s " +
        NEZHA_SERVER +
        ":" +
        NEZHA_PORT +
        " -p " +
        NEZHA_KEY +
        " " +
        tlsFlag +
        " --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &";
      try {
        await exec(cmd);
        console.log(npmName + " is running");
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error("npm running error:", err.message);
      }
    }
  } else {
    console.log("NEZHA variable is empty, skip running");
  }

  const webCmd =
    "nohup " + webPath + " -c " + FILE_PATH + "/config.json >/dev/null 2>&1 &";
  try {
    await exec(webCmd);
    console.log(webName + " is running");
    await new Promise((r) => setTimeout(r, 1000));
  } catch (err) {
    console.error("web running error:", err.message);
  }

  if (fs.existsSync(botPath)) {
    let argoArgs;
    if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
      argoArgs =
        "tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token " +
        ARGO_AUTH;
    } else if (ARGO_AUTH.match(/TunnelSecret/)) {
      argoArgs =
        "tunnel --edge-ip-version auto --config " +
        FILE_PATH +
        "/tunnel.yml run";
    } else {
      argoArgs =
        "tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile " +
        FILE_PATH +
        "/boot.log --loglevel info --url http://localhost:" +
        ARGO_PORT;
    }
    try {
      await exec("nohup " + botPath + " " + argoArgs + " >/dev/null 2>&1 &");
      console.log(botName + " is running");
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error("Error starting argo tunnel:", err.message);
    }
  }

  await new Promise((r) => setTimeout(r, 5000));
}

function getFilesForArchitecture(arch) {
  let files;
  if (arch === "arm") {
    files = [
      { fileName: webPath, fileUrl: "https://arm64.ssss.nyc.mn/web" },
      { fileName: botPath, fileUrl: "https://arm64.ssss.nyc.mn/bot" },
    ];
  } else {
    files = [
      { fileName: webPath, fileUrl: "https://amd64.ssss.nyc.mn/web" },
      { fileName: botPath, fileUrl: "https://amd64.ssss.nyc.mn/bot" },
    ];
  }

  if (NEZHA_SERVER && NEZHA_KEY) {
    if (NEZHA_PORT) {
      const url =
        arch === "arm"
          ? "https://arm64.ssss.nyc.mn/agent"
          : "https://amd64.ssss.nyc.mn/agent";
      files.unshift({ fileName: npmPath, fileUrl: url });
    } else {
      const url =
        arch === "arm"
          ? "https://arm64.ssss.nyc.mn/v1"
          : "https://amd64.ssss.nyc.mn/v1";
      files.unshift({ fileName: phpPath, fileUrl: url });
    }
  }

  return files;
}

function argoType() {
  if (!ARGO_AUTH || !ARGO_DOMAIN) {
    console.log("ARGO_DOMAIN or ARGO_AUTH variable is empty, use quick tunnels");
    return;
  }
  if (ARGO_AUTH.includes("TunnelSecret")) {
    fs.writeFileSync(path.join(FILE_PATH, "tunnel.json"), ARGO_AUTH);
    const tunnelId = ARGO_AUTH.split('"')[11];
    const yml =
      "\n  tunnel: " +
      tunnelId +
      "\n  credentials-file: " +
      path.join(FILE_PATH, "tunnel.json") +
      "\n  protocol: http2\n  \n  ingress:\n    - hostname: " +
      ARGO_DOMAIN +
      "\n      service: http://localhost:" +
      ARGO_PORT +
      "\n      originRequest:\n        noTLSVerify: true\n    - service: http_status:404\n  ";
    fs.writeFileSync(path.join(FILE_PATH, "tunnel.yml"), yml);
  } else {
    console.log("ARGO_AUTH mismatch TunnelSecret, use token connect to tunnel");
  }
}

async function extractDomains() {
  let argoDomain;
  if (ARGO_AUTH && ARGO_DOMAIN) {
    argoDomain = ARGO_DOMAIN;
    console.log("ARGO_DOMAIN:", argoDomain);
    await generateSubscription(argoDomain);
  } else {
    try {
      const logContent = fs.readFileSync(
        path.join(FILE_PATH, "boot.log"),
        "utf-8"
      );
      const lines = logContent.split("\n");
      const domains = [];
      lines.forEach((line) => {
        const match = line.match(
          /https?:\/\/([^ ]*trycloudflare\.com)\/?/
        );
        if (match) {
          domains.push(match[1]);
        }
      });
      if (domains.length > 0) {
        argoDomain = domains[0];
        console.log("ArgoDomain:", argoDomain);
        await generateSubscription(argoDomain);
      } else {
        console.log(
          "ArgoDomain not found, re-running bot to obtain ArgoDomain"
        );
        try {
          fs.unlinkSync(path.join(FILE_PATH, "boot.log"));
        } catch (err) {
          console.error("Failed to remove boot.log:", err.message);
        }

        await killBot();
        await new Promise((r) => setTimeout(r, 3000));

        const tunnelCmd =
          "tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile " +
          FILE_PATH +
          "/boot.log --loglevel info --url http://localhost:" +
          ARGO_PORT;
        try {
          await exec(
            "nohup " + botPath + " " + tunnelCmd + " >/dev/null 2>&1 &"
          );
          console.log(botName + " is running");
          await new Promise((r) => setTimeout(r, 3000));
          await extractDomains();
        } catch (err) {
          console.error("Error restarting argo tunnel:", err.message);
        }
      }
    } catch (err) {
      console.error("Error reading boot.log:", err.message);
    }
  }
}

async function killBot() {
  try {
    if (process.platform === "win32") {
      await exec("taskkill /f /im " + botName + ".exe > nul 2>&1");
    } else {
      await exec(
        'pkill -f "[' +
          botName.charAt(0) +
          "]" +
          botName.substring(1) +
          '" > /dev/null 2>&1'
      );
    }
  } catch (err) {
    // pkill returns non-zero when no matching process is found; this is expected
    if (err.code !== 1) {
      console.error("Failed to kill bot process:", err.message);
    }
  }
}

async function getIspInfo() {
  try {
    const response = await axios.get("https://api.ip.sb/geoip", {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 3000,
    });
    if (
      response.data &&
      response.data.country_code &&
      response.data.isp
    ) {
      return (response.data.country_code + "-" + response.data.isp).replace(
        /\s+/g,
        "_"
      );
    }
  } catch (primaryErr) {
    console.error(
      "Primary ISP API failed, trying fallback:",
      primaryErr.message
    );
    try {
      const fallback = await axios.get("http://ip-api.com/json", {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 3000,
      });
      if (
        fallback.data &&
        fallback.data.status === "success" &&
        fallback.data.countryCode &&
        fallback.data.org
      ) {
        return (
          fallback.data.countryCode +
          "-" +
          fallback.data.org
        ).replace(/\s+/g, "_");
      }
    } catch (fallbackErr) {
      console.error("Fallback ISP API also failed:", fallbackErr.message);
    }
  }
  return "Unknown";
}

async function generateSubscription(domain) {
  const ispInfo = await getIspInfo();
  const nodeName = NAME ? NAME + "-" + ispInfo : ispInfo;

  return new Promise((resolve) => {
    setTimeout(() => {
      const vmessConfig = {
        v: "2",
        ps: "" + nodeName,
        add: CFIP,
        port: CFPORT,
        id: UUID,
        aid: "0",
        scy: "auto",
        net: "ws",
        type: "none",
        host: domain,
        path: "/vmess-argo?ed=2560",
        tls: "tls",
        sni: domain,
        alpn: "",
        fp: "firefox",
      };

      const subContent =
        "\nvless://" +
        UUID +
        "@" +
        CFIP +
        ":" +
        CFPORT +
        "?encryption=none&security=tls&sni=" +
        domain +
        "&fp=firefox&type=ws&host=" +
        domain +
        "&path=%2Fvless-argo%3Fed%3D2560#" +
        nodeName +
        "\n\nvmess://" +
        Buffer.from(JSON.stringify(vmessConfig)).toString("base64") +
        "\n\ntrojan://" +
        UUID +
        "@" +
        CFIP +
        ":" +
        CFPORT +
        "?security=tls&sni=" +
        domain +
        "&fp=firefox&type=ws&host=" +
        domain +
        "&path=%2Ftrojan-argo%3Fed%3D2560#" +
        nodeName +
        "\n    ";

      console.log(Buffer.from(subContent).toString("base64"));
      fs.writeFileSync(subPath, Buffer.from(subContent).toString("base64"));
      console.log(FILE_PATH + "/sub.txt saved successfully");

      uploadNodes();

      app.get("/" + SUB_PATH, (_req, res) => {
        const encoded = Buffer.from(subContent).toString("base64");
        res.set("Content-Type", "text/plain; charset=utf-8");
        res.send(encoded);
      });

      resolve(subContent);
    }, 2000);
  });
}

async function uploadNodes() {
  if (UPLOAD_URL && PROJECT_URL) {
    const subUrl = PROJECT_URL + "/" + SUB_PATH;
    const payload = { subscription: [subUrl] };
    try {
      const response = await axios.post(
        UPLOAD_URL + "/api/add-subscriptions",
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (response && response.status === 200) {
        console.log("Subscription uploaded successfully");
        return response;
      } else {
        console.error(
          "Subscription upload returned unexpected status:",
          response ? response.status : "no response"
        );
        return null;
      }
    } catch (err) {
      if (err.response) {
        console.error(
          "Subscription upload failed with status " +
            err.response.status +
            ":",
          err.response.data || err.message
        );
      } else {
        console.error("Subscription upload failed:", err.message);
      }
    }
  } else if (UPLOAD_URL) {
    if (!fs.existsSync(listPath)) {
      return;
    }
    const content = fs.readFileSync(listPath, "utf-8");
    const nodes = content
      .split("\n")
      .filter((line) =>
        /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
      );
    if (nodes.length === 0) {
      return;
    }
    const payload = JSON.stringify({ nodes });
    try {
      const response = await axios.post(
        UPLOAD_URL + "/api/add-nodes",
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      if (response && response.status === 200) {
        console.log("Nodes uploaded successfully");
        return response;
      } else {
        console.error(
          "Node upload returned unexpected status:",
          response ? response.status : "no response"
        );
        return null;
      }
    } catch (err) {
      console.error("Node upload failed:", err.message);
      return null;
    }
  }
}

function cleanFiles() {
  setTimeout(() => {
    const filesToClean = [bootLogPath, configPath, webPath, botPath];
    if (NEZHA_PORT) {
      filesToClean.push(npmPath);
    } else if (NEZHA_SERVER && NEZHA_KEY) {
      filesToClean.push(phpPath);
    }
    if (process.platform === "win32") {
      exec("del /f /q " + filesToClean.join(" ") + " > nul 2>&1")
        .then(() => {
          console.clear();
          console.log("App is running");
          console.log("Thank you for using this script, enjoy!");
        })
        .catch((err) => {
          console.error("Failed to clean files (win32):", err.message);
        });
    } else {
      exec("rm -rf " + filesToClean.join(" ") + " >/dev/null 2>&1")
        .then(() => {
          console.clear();
          console.log("App is running");
          console.log("Thank you for using this script, enjoy!");
        })
        .catch((err) => {
          console.error("Failed to clean files:", err.message);
        });
    }
  }, 90000);
}

cleanFiles();

async function addVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) {
    console.log("Skipping adding automatic access task");
    return;
  }
  try {
    const response = await axios.post(
      "https://oooo.serv00.net/add-url",
      { url: PROJECT_URL },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Automatic access task added successfully");
    return response;
  } catch (err) {
    console.error("Add automatic access task failed:", err.message);
    return null;
  }
}

async function startserver() {
  try {
    argoType();
    deleteNodes();
    cleanupOldFiles();
    await generateConfig();
    await downloadFilesAndRun();
    await extractDomains();
    await addVisitTask();
  } catch (err) {
    console.error("Error in startserver:", err.message, err.stack);
  }
}

startserver().catch((err) => {
  console.error("Unhandled error in startserver:", err.message, err.stack);
});

app.get("/", async (_req, res) => {
  try {
    const htmlPath = path.join(__dirname, "index.html");
    const content = await fs.promises.readFile(htmlPath, "utf8");
    res.send(content);
  } catch (err) {
    console.error("Error serving index.html:", err.message);
    res.send(
      "Hello world!<br><br>You can access /" +
        SUB_PATH +
        " to get your nodes!"
    );
  }
});

const server = app.listen(PORT, () => {
  console.log("http server is running on port:" + PORT + "!");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("Port " + PORT + " is already in use. Cannot start server.");
  } else {
    console.error("Server error:", err.message);
  }
  process.exit(1);
});
