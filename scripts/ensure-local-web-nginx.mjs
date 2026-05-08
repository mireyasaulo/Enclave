import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const runtimeDir = path.join(rootDir, "runtime-data", "app-web-nginx");
const confDir = path.join(runtimeDir, "conf");
const logsDir = path.join(runtimeDir, "logs");
const bodyDir = path.join(runtimeDir, "body");
const configPath = path.join(confDir, "nginx.conf");
const pidPath = path.join(runtimeDir, "nginx.pid");
const bootstrapErrorLogPath = path.join(logsDir, "bootstrap-error.log");
const appDistDir = path.join(rootDir, "apps", "app", "dist");
const apiUpstream = "http://127.0.0.1:3000";
const cloudUpstream = "http://127.0.0.1:3001";
const siteUpstream = "http://127.0.0.1:5185";
// vicp.fun HTTPS 隧道实际落到本机 5180（而非控制台显示的 5185）。两条隧道
// 共用 5180 时只能靠 Host 头区分：HTTPS 隧道 Host=vicp.fun（无端口），HTTP
// 隧道 Host=vicp.fun:29490。这里用 $http_host 精确匹配做分流。
const siteHostExact = "1gw06751dd053.vicp.fun";
const listenAddress = "127.0.0.1:5180";

ensureDir(runtimeDir);
ensureDir(confDir);
ensureDir(logsDir);
ensureDir(bodyDir);

if (!existsSync(appDistDir)) {
  console.error(`[web-nginx] missing app dist: ${appDistDir}`);
  process.exit(1);
}

const nextConfig = buildConfig();
const previousConfig = existsSync(configPath)
  ? readFileSync(configPath, "utf8")
  : null;

if (previousConfig !== nextConfig) {
  writeFileSync(configPath, nextConfig, "utf8");
}

restartNginx();

console.log(`[web-nginx] ready at http://${listenAddress}/`);

function ensureDir(target) {
  mkdirSync(target, { recursive: true });
}

function buildConfig() {
  return `error_log ${path.join(logsDir, "error.log")};
worker_processes 1;
pid ${pidPath};

events {
  worker_connections 1024;
}

http {
  client_max_body_size 32m;
  client_body_temp_path ${bodyDir} 1 2;

  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_timeout 65s;

  # 公网隧道带宽受限，所有可压缩文本类资源都走 gzip。
  # vite 构建时由 vite-plugin-compression 生成 *.gz / *.br 同名兄弟文件，
  # gzip_static on 让 nginx 直接吐预压缩文件，不再现压。
  gzip on;
  gzip_static on;
  gzip_vary on;
  gzip_proxied any;
  gzip_min_length 1024;
  gzip_comp_level 5;
  gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/manifest+json
    application/wasm
    image/svg+xml
    font/woff2;

  access_log ${path.join(logsDir, "access.log")};
  error_log ${path.join(logsDir, "error.log")};

  map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
  }

  server {
    listen ${listenAddress} default_server;
    server_name _;

    root ${appDistDir};
    index index.html;

    # location / 内 if 块通过 proxy_pass 反代到 5185 时不会继承 location 级
    # 的 proxy_set_header，这里在 server 级提供默认值。其他显式声明 header
    # 的 location 会按 nginx 全有或全无规则覆盖整组，不受影响。
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;

    location = /healthz {
      access_log off;
      add_header Content-Type text/plain;
      return 200 "ok\\n";
    }

    location /api/ {
      proxy_pass ${apiUpstream};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
      proxy_pass ${apiUpstream};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
      proxy_pass ${apiUpstream};
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 600s;
      proxy_send_timeout 600s;
    }

    location /cloud/ {
      proxy_pass ${cloudUpstream};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/cloud/ {
      proxy_pass ${cloudUpstream};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 客户端埋点 SDK 上报到 cloud-api 的 telemetry 入口。app/site/wiki 三端
    # 都会从浏览器同源 POST /telemetry/events/batch；如果这里没接，事件全部
    # 落到 SPA fallback 上变成 405/200 HTML，cloud-console 看到的就是空数据。
    location /telemetry/ {
      proxy_pass ${cloudUpstream};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /runtime-config.json {
      add_header Cache-Control "no-store";
      try_files $uri =404;
    }

    location /assets/ {
      add_header Cache-Control "public, max-age=31536000, immutable";
      try_files $uri =404;
    }

    # 公网 HTTPS 隧道 (Host 严格等于 ${siteHostExact}) -> 反代到官网
    # Next.js (5185)；其他 Host（HTTP 隧道带端口、本地直连）走 app dist。
    location / {
      if ($http_host = "${siteHostExact}") {
        proxy_pass ${siteUpstream};
      }
      add_header Cache-Control "no-store";
      try_files $uri $uri/ /index.html;
    }
  }
}
`;
}

function runNginx(args) {
  const result = spawnSync(
    "nginx",
    ["-g", `error_log ${bootstrapErrorLogPath};`, ...args],
    {
      cwd: rootDir,
      env: process.env,
      encoding: "utf8",
      shell: false,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  const filteredStderr = filterBenignNginxWarnings(result.stderr ?? "");
  if (filteredStderr) {
    process.stderr.write(filteredStderr);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function restartNginx() {
  if (!existsSync(pidPath)) {
    runNginx(["-p", runtimeDir, "-c", configPath]);
    return;
  }

  const pid = Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10);
  if (Number.isFinite(pid)) {
    try {
      process.kill(pid, "SIGTERM");
      waitForProcessExit(pid, 5_000);
    } catch (error) {
      if (!isMissingProcessError(error)) {
        throw error;
      }
    }
  }

  rmSync(pidPath, { force: true });
  runNginx(["-p", runtimeDir, "-c", configPath]);
}

function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (isMissingProcessError(error)) {
        return;
      }

      throw error;
    }

    spawnSync("sleep", ["0.05"], {
      cwd: rootDir,
      env: process.env,
      stdio: "ignore",
      shell: false,
    });
  }
}

function isMissingProcessError(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ESRCH"
  );
}

function filterBenignNginxWarnings(stderrText) {
  return stderrText
    .split("\n")
    .filter(
      (line) =>
        !line.includes(
          'could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)',
        ),
    )
    .join("\n")
    .trim();
}
