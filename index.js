/**
 * Host half of dsh-icloud-sync.
 *
 * Serves the Settings -> Integrations panel and runs the `dsh-sync` CLI. The CLI
 * is bundled inside this package, so a fresh Mac only has to install the plugin:
 * no terminal step and no PATH setup. Environment and config can still point at
 * another copy of the script.
 */
import { execFile, execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createCloudSessions } from "./lib/cloud-sessions.js";
import { ensureCodexTabSupport } from "./lib/codex-sidebar-tab.js";

const execFileAsync = promisify(execFile);
const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const BUNDLED_SCRIPT = join(PACKAGE_DIR, "bin", "dsh-sync");
const LOCAL_SCRIPT = join(homedir(), ".local", "bin", "dsh-sync");
const DEFAULT_CLOUD = join(homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs", "DSH-Sync");
const CLOUD_SCRIPT = join(DEFAULT_CLOUD, "bin", "dsh-sync");
const STATE_FILE = join(homedir(), ".dsh", ".icloud-sync", "state.tsv");
const MAX_BUFFER = 4 * 1024 * 1024;
/** 只跑一次的 codex-ui 页签补丁结果，供 /cloud 与设置面板显示。 */
const codexTabPatch = { attempted: false, status: "pending" };
const HEADER = "x-dsh-icloud-sync";

/** DSH data root; DSH_SYNC_ROOT exists so tests can point at a scratch directory. */
const DSH_ROOT = (process.env.DSH_SYNC_ROOT || "").trim() !== "" ? process.env.DSH_SYNC_ROOT.trim() : join(homedir(), ".dsh");
const SESSIONS_DIR = join(DSH_ROOT, "sessions");
const SESSION_STATE_DIR = join(DSH_ROOT, ".icloud-sync");
const SESSION_CLOUD = (process.env.DSH_SYNC_CLOUD || "").trim() !== "" ? process.env.DSH_SYNC_CLOUD.trim() : DEFAULT_CLOUD;

const ACTIONS = new Map([
  ["sync", { args: ["sync"], timeout: 300000 }],
  ["push", { args: ["push"], timeout: 180000 }],
  ["pull", { args: ["pull"], timeout: 300000 }],
  ["init", { args: ["init"], timeout: 180000 }],
  ["doctor", { args: ["doctor"], timeout: 120000 }],
  ["open", { args: ["open"], timeout: 30000 }],
  ["install-cli", { args: [], timeout: 30000 }],
  ["agent-on", { args: ["agent", "on"], timeout: 60000 }],
  ["agent-off", { args: ["agent", "off"], timeout: 60000 }]
]);

/** Resolve the CLI to run: environment, config, package copy, ~/.local/bin, iCloud. */
function resolveScript(config) {
  const candidates = [];
  const fromEnv = process.env.DSH_ICLOUD_SYNC_BIN;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    candidates.push({ path: fromEnv.trim(), source: "env" });
  }
  const fromConfig = config === null || config === undefined ? undefined : config.syncBin;
  if (typeof fromConfig === "string" && fromConfig.trim() !== "") {
    candidates.push({ path: fromConfig.trim(), source: "config" });
  }
  candidates.push({ path: BUNDLED_SCRIPT, source: "bundled" });
  candidates.push({ path: LOCAL_SCRIPT, source: "local" });
  candidates.push({ path: CLOUD_SCRIPT, source: "cloud" });
  for (const candidate of candidates) {
    if (existsSync(candidate.path)) return candidate;
  }
  return { path: BUNDLED_SCRIPT, source: "bundled", missing: true };
}

function loopback(request) {
  const address = request.socket?.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function sendJson(response, status, payload) {
  if (response.writableEnded) return;
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

function readJson(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(new Error("请求体过大"));
        return;
      }
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (text === "") {
        resolve({});
        return;
      }
      try {
        const value = JSON.parse(text);
        resolve(value !== null && typeof value === "object" ? value : {});
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    request.on("error", reject);
  });
}

/** Run the CLI through bash so a stripped execute bit cannot break it. */
async function runSync(scriptPath, args, timeout) {
  if (!existsSync(scriptPath)) {
    return {
      code: 127,
      stdout: "",
      stderr: "找不到 dsh-sync：\n  " + scriptPath + "\n请重新安装插件，或设置 DSH_ICLOUD_SYNC_BIN。",
      timedOut: false
    };
  }
  try {
    const result = await execFileAsync("/bin/bash", [scriptPath, ...args], {
      cwd: homedir(),
      env: process.env,
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
      timeout
    });
    return {
      code: 0,
      stdout: String(result.stdout || ""),
      stderr: String(result.stderr || ""),
      timedOut: false
    };
  } catch (error) {
    const code = typeof error.code === "number" ? error.code : (error.killed ? 124 : 1);
    return {
      code,
      stdout: String(error.stdout || ""),
      stderr: String(error.stderr || error.message || String(error)),
      timedOut: Boolean(error.killed)
    };
  }
}

function cleanOutput(result) {
  return [result.stdout, result.stderr]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match === null ? null : match[1].trim();
}

function parseFiles(text) {
  const files = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (line === "") continue;
    if (/^文件\s/.test(line) || /^-{3,}/.test(line)) continue;
    const match = line.match(/^(.+?)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(.+)$/);
    if (match === null) continue;
    const path = match[1].trim();
    if (!/^(profile|skills)\//.test(path)) continue;
    files.push({
      path,
      local: match[2].trim(),
      remote: match[3].trim(),
      state: match[4].trim()
    });
  }
  return files;
}

function parseNumber(text, pattern) {
  const value = firstMatch(text, pattern);
  if (value === null) return 0;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
}

/** Read the CLI's own version line, so the panel can tell a stale copy from the bundled one. */
function readVersion(path) {
  try {
    const match = readFileSync(path, "utf8").match(/^VERSION="([^"]+)"/m);
    return match === null ? null : match[1];
  } catch {
    return null;
  }
}

async function collectStatus(script, config, autoPull) {
  const [statusResult, agentResult] = await Promise.all([
    runSync(script.path, ["status"], 60000),
    runSync(script.path, ["agent", "status"], 20000)
  ]);
  const raw = statusResult.stdout;
  const agentRaw = [agentResult.stdout, agentResult.stderr].filter(Boolean).join("\n").trim();
  const generation = firstMatch(raw, /云端版本:\s*第\s*(\d+)\s*代/);
  const remoteLine = raw.match(/云端版本:\s*第\s*\d+\s*代，(.*?)\s*于\s*(.*?)\s*发布（DSH\s*([^）]+)）/);
  const lastSyncMatch = raw.match(/上次同步:\s*第\s*(\d+)\s*代（([^）]+)）/);
  const cloud = firstMatch(raw, /云目录:\s*(.+)/) || DEFAULT_CLOUD;
  const machine = firstMatch(raw, /本机:\s*(.+)/);
  const initialized = generation !== null || existsSync(join(cloud, "current", "manifest.tsv"));
  const lastSync = lastSyncMatch === null ? null : lastSyncMatch[2].trim();
  const joined = lastSyncMatch !== null || existsSync(STATE_FILE);
  const conflicts = parseNumber(raw, /冲突\s*(\d+)\s*个/);
  const localChanges = parseNumber(raw, /本地改动\s*(\d+)\s*个/);
  const remoteChanges = parseNumber(raw, /云端改动\s*(\d+)\s*个/);
  const synced = /已同步。/.test(raw);
  const files = parseFiles(raw);
  return {
    ok: true,
    scriptPath: script.path,
    scriptSource: script.source,
    machine,
    cloud,
    cloudExists: existsSync(cloud),
    initialized,
    joined,
    generation: generation === null ? null : Number.parseInt(generation, 10),
    remoteMachine: remoteLine === null ? null : remoteLine[1].trim(),
    updatedAt: remoteLine === null ? null : remoteLine[2].trim(),
    dshVersion: remoteLine === null ? null : remoteLine[3].trim(),
    lastSync,
    lastSyncGeneration: lastSyncMatch === null ? null : Number.parseInt(lastSyncMatch[1], 10),
    conflicts,
    localChanges,
    remoteChanges,
    synced,
    totalFiles: files.length,
    files,
    statusCode: statusResult.code,
    statusRaw: raw.trim(),
    statusError: statusResult.code === 0 || statusResult.code === 2 ? null : cleanOutput(statusResult),
    cli: {
      path: script.path,
      source: script.source,
      bundled: BUNDLED_SCRIPT,
      bundledVersion: readVersion(BUNDLED_SCRIPT),
      installed: existsSync(LOCAL_SCRIPT),
      installedPath: LOCAL_SCRIPT,
      installedVersion: readVersion(LOCAL_SCRIPT)
    },
    autoPull: {
      enabled: config !== null && config !== undefined && config.autoPull === true,
      lastAttempt: autoPull.lastAttempt,
      lastExitCode: autoPull.lastExitCode
    },
    agent: {
      enabled: /后台同步：已开启/.test(agentRaw),
      raw: agentRaw,
      plist: join(homedir(), "Library", "LaunchAgents", "com.dsh.icloud-sync.plist")
    },
    readAt: new Date().toISOString()
  };
}

function installCli() {
  try {
    mkdirSync(dirname(LOCAL_SCRIPT), { recursive: true });
    copyFileSync(BUNDLED_SCRIPT, LOCAL_SCRIPT);
    chmodSync(LOCAL_SCRIPT, 0o755);
    return {
      code: 0,
      stdout: "已安装命令行工具：\n  " + LOCAL_SCRIPT + "\n\n现在可以在终端直接运行 dsh-sync。",
      stderr: "",
      timedOut: false
    };
  } catch (error) {
    return {
      code: 1,
      stdout: "",
      stderr: "安装失败：" + (error instanceof Error ? error.message : String(error)),
      timedOut: false
    };
  }
}

let machineInfo = null;

/** Stable per-Mac identity for conflict copies and "which Mac wrote this" labels. */
function machineIdentity() {
  if (machineInfo !== null) return machineInfo;
  let id = "";
  try {
    const out = execFileSync("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 4000,
      maxBuffer: 1024 * 1024
    });
    const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    if (match !== null) id = match[1];
  } catch {
    id = "";
  }
  machineInfo = { name: hostname(), id };
  return machineInfo;
}

/** Ask iCloud to fetch a not-yet-materialised file. Best effort: retried next pass. */
function materializeIcloudFile(path) {
  try {
    execFileSync("/usr/bin/brctl", ["download", path], { encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024 });
  } catch {
    // Offline, or brctl unavailable: the panel keeps showing "等待 iCloud 下载".
  }
}

function createSessionEngine() {
  const machine = machineIdentity();
  return createCloudSessions({
    sessionsDir: SESSIONS_DIR,
    cloudDir: SESSION_CLOUD,
    stateDir: SESSION_STATE_DIR,
    machineName: machine.name,
    machineId: machine.id,
    materialize: materializeIcloudFile
  });
}

/** Session ids that are open in this host process; those are never overwritten. */
function liveSessionIds(hostCtx) {
  const ids = new Set();
  const stores = [];
  try {
    if (hostCtx.sessions !== undefined && hostCtx.sessions !== null) stores.push(hostCtx.sessions);
  } catch {
    // service not mounted
  }
  try {
    const viaGet = typeof hostCtx.get === "function" ? hostCtx.get("sessions") : undefined;
    if (viaGet !== undefined && viaGet !== null) stores.push(viaGet);
  } catch {
    // service not mounted
  }
  for (const store of stores) {
    try {
      const list = typeof store.list === "function" ? store.list() : [];
      for (const item of list || []) {
        if (item !== null && item !== undefined && typeof item.id === "string") ids.add(item.id);
      }
    } catch {
      // ignore
    }
  }
  return ids;
}

function sessionSnapshot(hostCtx, engine) {
  const state = engine.list(liveSessionIds(hostCtx));
  return {
    ok: true,
    at: new Date().toISOString(),
    machine: { name: engine.machineName, id: engine.machineId, slug: engine.machineSlug },
    cloudDir: SESSION_CLOUD,
    cloudExists: state.cloudExists,
    sessionsDir: SESSIONS_DIR,
    summary: state.summary,
    sessions: state.sessions
  };
}

/** Settings -> Integrations section: status plus a fixed allowlist of dsh-sync actions. */
export function apply(ctx, config) {
  const autoPull = { lastAttempt: null, lastExitCode: null };

  ctx.inject(["webServer"], (hostCtx) => {
    const disposers = [];
    const sessionEngine = createSessionEngine();

    if (!codexTabPatch.attempted) {
      codexTabPatch.attempted = true;
      try {
        Object.assign(codexTabPatch, ensureCodexTabSupport({}));
      } catch (error) {
        codexTabPatch.status = "error";
        codexTabPatch.reason = error instanceof Error ? error.message : String(error);
      }
      if (codexTabPatch.status === "skipped") {
        console.warn("[dsh-icloud-sync] codex-ui 页签补丁未应用：" + codexTabPatch.reason);
      }
    }

    disposers.push(hostCtx.webServer.register({
      kind: "exact",
      path: "/dsh-icloud-sync/status",
      handler: async (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { ok: false, error: "只支持 GET" });
          return;
        }
        if (!loopback(request) || !sameOrigin(request)) {
          sendJson(response, 403, { ok: false, error: "只允许本机同源访问" });
          return;
        }
        try {
          sendJson(response, 200, await collectStatus(resolveScript(config), config, autoPull));
        } catch (error) {
          sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }));

    disposers.push(hostCtx.webServer.register({
      kind: "exact",
      path: "/dsh-icloud-sync/action",
      handler: async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { ok: false, error: "只支持 POST" });
          return;
        }
        if (!loopback(request) || !sameOrigin(request)) {
          sendJson(response, 403, { ok: false, error: "只允许本机同源访问" });
          return;
        }
        if (request.headers[HEADER] !== "1") {
          sendJson(response, 403, { ok: false, error: "缺少请求标记" });
          return;
        }
        try {
          const body = await readJson(request);
          const action = typeof body.action === "string" ? body.action : "";
          const chosen = ACTIONS.get(action);
          if (chosen === undefined) {
            sendJson(response, 400, { ok: false, error: "未知操作" });
            return;
          }
          const active = resolveScript(config);
          const result = action === "install-cli"
            ? installCli()
            : await runSync(active.path, chosen.args, chosen.timeout);
          const output = cleanOutput(result);
          let snapshot = null;
          try {
            snapshot = await collectStatus(resolveScript(config), config, autoPull);
          } catch {
            snapshot = null;
          }
          sendJson(response, 200, {
            ok: true,
            action,
            success: result.code === 0,
            exitCode: result.code,
            timedOut: result.timedOut,
            output: output === "" ? (result.code === 0 ? "操作完成。" : "操作未完成。") : output,
            status: snapshot
          });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }));

    disposers.push(hostCtx.webServer.register({
      kind: "exact",
      path: "/dsh-icloud-sync/cloud",
      handler: (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { ok: false, error: "只支持 GET" });
          return;
        }
        if (!loopback(request) || !sameOrigin(request)) {
          sendJson(response, 403, { ok: false, error: "只允许本机同源访问" });
          return;
        }
        try {
          sendJson(response, 200, Object.assign(sessionSnapshot(hostCtx, sessionEngine), { codexTab: codexTabPatch }));
        } catch (error) {
          sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }));

    disposers.push(hostCtx.webServer.register({
      kind: "exact",
      path: "/dsh-icloud-sync/cloud/action",
      handler: async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { ok: false, error: "只支持 POST" });
          return;
        }
        if (!loopback(request) || !sameOrigin(request)) {
          sendJson(response, 403, { ok: false, error: "只允许本机同源访问" });
          return;
        }
        if (request.headers[HEADER] !== "1") {
          sendJson(response, 403, { ok: false, error: "缺少请求标记" });
          return;
        }
        try {
          const body = await readJson(request);
          const action = typeof body.action === "string" ? body.action : "";
          if (action !== "upload" && action !== "download" && action !== "remove") {
            sendJson(response, 400, { ok: false, error: "未知操作" });
            return;
          }
          const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
          if (!/^session-[A-Za-z0-9._-]+$/.test(sessionId)) {
            sendJson(response, 400, { ok: false, error: "会话 id 不合法" });
            return;
          }
          try {
            const live = liveSessionIds(hostCtx);
            const result = action === "upload"
              ? sessionEngine.upload(sessionId, live)
              : action === "download"
                ? sessionEngine.download(sessionId, live)
                : sessionEngine.remove(sessionId);
            sendJson(response, 200, Object.assign({ action }, result, { snapshot: sessionSnapshot(hostCtx, sessionEngine) }));
          } catch (error) {
            const code = error !== null && typeof error === "object" && typeof error.code === "string" ? error.code : "";
            const status = code === "live" || code === "cloud-pending" || code === "live-empty" ? 409 : code === "missing-local" || code === "missing-cloud" ? 404 : 400;
            sendJson(response, status, { ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        } catch (error) {
          sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }));

    // Optional one-shot bootstrap: a new Mac with an initialized cloud bundle joins
    // automatically instead of waiting for a click. Off unless configured.
    if (config !== null && config !== undefined && config.autoPull === true) {
      const timer = setTimeout(() => {
        void (async () => {
          try {
            const script = resolveScript(config);
            const snapshot = await collectStatus(script, config, autoPull);
            if (snapshot.initialized && !snapshot.joined) {
              autoPull.lastAttempt = new Date().toISOString();
              const result = await runSync(script.path, ["pull"], 300000);
              autoPull.lastExitCode = result.code;
            }
          } catch {
            autoPull.lastExitCode = -1;
          }
        })();
      }, 1500);
      if (typeof timer.unref === "function") timer.unref();
      disposers.push(() => clearTimeout(timer));
    }

    return () => {
      for (const dispose of disposers.reverse()) {
        try {
          dispose();
        } catch {
          // The route table may already be unwinding.
        }
      }
    };
  });
}
