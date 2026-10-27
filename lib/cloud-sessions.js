/**
 * Cloud session sync for dsh-icloud-sync.
 *
 * DSH stores one append-only log per session under
 * `~/.dsh/sessions/<project-key>/session-<uuid>/session.v4.jsonl.zstd`.
 * This module mirrors those logs (and the content-addressed attachments) into
 * iCloud Drive so several Macs signed into the same Apple ID share them.
 *
 * Safety rules, deliberately conservative:
 *  - a log is only uploaded once it has been quiet for `quietMs`, so a copy is
 *    never taken in the middle of an active write;
 *  - a session that is open in this process is never overwritten (reported as
 *    `live` and left alone until it is closed);
 *  - both sides changed since the last sync -> keep both, record a conflict,
 *    and wait for a human choice; nothing is discarded;
 *  - every overwrite is preceded by a copy into a history folder;
 *  - `session.lock` never leaves the machine and nothing is ever deleted.
 *
 * Everything is written atomically (temp file + rename) and 0600/0700.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { zstdDecompressSync } from "node:zlib";

const SESSION_DIR_RE = /^session-[A-Za-z0-9._-]+$/;
const ARTIFACT_RE = /^session\..*\.jsonl(?:\.zstd)?$/;
const VERSIONED_RE = /^session\.(\d+)\.jsonl(?:\.zstd)?$/;
const ICLOUD_PLACEHOLDER_RE = /\.icloud$/;
const MAX_META_BYTES = 64 * 1024 * 1024;
const MAX_META_SCAN_BYTES = 48 * 1024 * 1024;

/** Encode an absolute path the way the DSH session store names project folders. */
export function encodeProjectKey(cwd) {
  const text = String(cwd || "");
  const body = text.startsWith("/") ? text.slice(1) : text;
  const encoded = body
    .split("/")
    .filter((part) => part !== "")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, (char) => "~" + char.codePointAt(0).toString(16).padStart(4, "0")))
    .join("-");
  return "--" + encoded + "--";
}

export function sessionIdFromDirName(name) {
  return name.startsWith("session-") ? name : "session-" + name;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeReadJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value !== null && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/** Write `data` to `path` through a sibling temp file so readers never see a half file. */
export function writeFileAtomic(path, data, mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = join(dirname(path), ".tmp-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2));
  writeFileSync(tmp, data, { mode });
  renameSync(tmp, path);
}

function ensureDir(path, mode = 0o700) {
  mkdirSync(path, { recursive: true, mode });
  return path;
}

/**
 * Split a buffer of concatenated zstd frames into frame ranges.
 * `node:zlib` decodes only the first frame, while DSH appends one frame per
 * event, so the frame boundaries have to be walked by hand.
 */
export function zstdFrameRanges(buffer) {
  const ranges = [];
  let pos = 0;
  while (pos + 4 <= buffer.length) {
    const magic = buffer.readUInt32LE(pos);
    if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) {
      if (pos + 8 > buffer.length) break;
      pos += 8 + buffer.readUInt32LE(pos + 4);
      continue;
    }
    if (magic !== 0xfd2fb528) break;
    let cursor = pos + 4;
    if (cursor >= buffer.length) break;
    const descriptor = buffer[cursor];
    cursor += 1;
    const contentSizeFlag = descriptor >> 6;
    const singleSegment = (descriptor >> 5) & 1;
    const checksumFlag = (descriptor >> 2) & 1;
    const dictIdFlag = descriptor & 3;
    if (!singleSegment) cursor += 1;
    if (dictIdFlag === 1) cursor += 1;
    else if (dictIdFlag === 2) cursor += 2;
    else if (dictIdFlag === 3) cursor += 4;
    if (contentSizeFlag === 0) {
      if (singleSegment) cursor += 1;
    } else if (contentSizeFlag === 1) cursor += 2;
    else if (contentSizeFlag === 2) cursor += 4;
    else cursor += 8;
    let ok = true;
    while (cursor + 3 <= buffer.length) {
      const header = buffer[cursor] | (buffer[cursor + 1] << 8) | (buffer[cursor + 2] << 16);
      cursor += 3;
      const last = header & 1;
      const type = (header >> 1) & 3;
      const size = header >>> 3;
      if (type === 3) {
        ok = false;
        break;
      }
      cursor += type === 1 ? 1 : size;
      if (last) break;
    }
    if (!ok || cursor > buffer.length) break;
    if (checksumFlag) cursor += 4;
    if (cursor > buffer.length) break;
    ranges.push({ start: pos, end: cursor });
    pos = cursor;
  }
  return ranges;
}

function textOfFrame(buffer, range) {
  try {
    return zstdDecompressSync(buffer.subarray(range.start, range.end)).toString("utf8");
  } catch {
    return "";
  }
}

function clip(text, max) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + "…";
}

/**
 * Read header/title/cwd out of one session artifact without loading it through
 * the DSH runtime. Falls back to the first user message when no title event
 * exists yet.
 */
export function readSessionSummary(filePath) {
  let buffer;
  try {
    const stat = statSync(filePath);
    if (stat.size === 0) return null;
    buffer = stat.size > MAX_META_BYTES ? readFileSync(filePath).subarray(0, MAX_META_BYTES) : readFileSync(filePath);
  } catch {
    return null;
  }
  const ranges = zstdFrameRanges(buffer);
  const summary = { id: null, cwd: null, createdAt: null, title: null, titleSource: null, fallbackTitle: null, updatedAt: null };
  let scanned = 0;
  for (const range of ranges) {
    const text = textOfFrame(buffer, range);
    if (text === "") continue;
    scanned += text.length;
    if (scanned > MAX_META_SCAN_BYTES) break;
    if (!text.includes('"type":"session"') && !text.includes('/title"') && !text.includes('"role":"user"')) continue;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed[0] !== "{") continue;
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (event === null || typeof event !== "object") continue;
      if (typeof event.time === "number") summary.updatedAt = event.time;
      if (event.type === "session") {
        summary.id = typeof event.id === "string" ? event.id : summary.id;
        summary.cwd = typeof event.cwd === "string" ? event.cwd : summary.cwd;
        summary.createdAt = typeof event.createdAt === "number" ? event.createdAt : summary.createdAt;
        continue;
      }
      if (event.type === "session/title" && event.data && typeof event.data.title === "string") {
        const source = event.data.source && event.data.source.kind;
        if (source === "provider" || summary.titleSource !== "provider") {
          summary.title = event.data.title;
          summary.titleSource = source || "unknown";
        }
        continue;
      }
      if (summary.fallbackTitle === null && event.data && Array.isArray(event.data.inserted)) {
        for (const message of event.data.inserted) {
          if (!message || message.role !== "user" || !Array.isArray(message.content)) continue;
          const textPart = message.content.find((part) => part && part.type === "text" && typeof part.text === "string");
          if (textPart === undefined) continue;
          const clipped = clip(textPart.text, 80);
          if (clipped !== "") summary.fallbackTitle = clipped;
        }
      }
    }
  }
  if (summary.id === null) {
    const base = filePath.split("/");
    const dirName = base[base.length - 2] || "";
    summary.id = sessionIdFromDirName(dirName);
  }
  if (summary.title === null) summary.title = summary.fallbackTitle || "未命名会话";
  return summary;
}

function statOrNull(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isPlaceholder(name) {
  return ICLOUD_PLACEHOLDER_RE.test(name);
}

/** Session log files inside one session folder, minus the local lock file. */
function artifactsOf(dir) {
  return listDir(dir)
    .filter((entry) => entry.isFile() && !isPlaceholder(entry.name) && ARTIFACT_RE.test(entry.name))
    .map((entry) => join(dir, entry.name));
}

function primaryOf(paths) {
  let best = null;
  for (const path of paths) {
    const name = path.split("/").pop();
    const match = name.match(VERSIONED_RE);
    const version = match === null ? -1 : Number.parseInt(match[1], 10);
    const stat = statOrNull(path);
    const size = stat === null ? 0 : stat.size;
    if (best === null || version > best.version || (version === best.version && size > best.size)) {
      best = { path, name, version, size };
    }
  }
  return best;
}

function timestampTag(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "-" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

export function sanitizeSlug(text) {
  const slug = String(text || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug === "" ? "mac" : slug;
}

/**
 * The engine. Construct once per host process; `run()` is serialised by the
 * caller and always safe to call again (idempotent per session).
 */
export function createCloudSessions(options) {
  const sessionsDir = options.sessionsDir;
  const attachmentsDir = options.attachmentsDir;
  const cloudDir = options.cloudDir;
  const machineName = options.machineName || "Mac";
  const machineId = options.machineId || "";
  const machineSlug = sanitizeSlug(machineName) + "-" + sanitizeSlug(machineId).slice(0, 8);
  const quietMs = Number.isFinite(options.quietMs) ? options.quietMs : 20000;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const materialize = typeof options.materialize === "function" ? options.materialize : null;

  const cloudSessionsDir = join(cloudDir, "cloud", "sessions");
  const cloudAttachmentsDir = join(cloudDir, "cloud", "attachments");
  const cloudHistoryDir = join(cloudDir, "history", "sessions");
  const localBackupsDir = join(options.stateDir || join(sessionsDir, "..", ".icloud-sync"), "session-backups");

  const hashCache = new Map();

  function fileInfo(path) {
    const stat = statOrNull(path);
    if (stat === null) return null;
    const key = path + "|" + stat.size + "|" + stat.mtimeMs;
    const cached = hashCache.get(key);
    if (cached !== undefined) return { path, name: path.split("/").pop(), size: stat.size, mtimeMs: stat.mtimeMs, hash: cached };
    let hash;
    try {
      hash = sha256(readFileSync(path));
    } catch {
      return null;
    }
    hashCache.set(key, hash);
    if (hashCache.size > 512) hashCache.clear();
    return { path, name: path.split("/").pop(), size: stat.size, mtimeMs: stat.mtimeMs, hash };
  }

  function scanLocal() {
    const local = new Map();
    for (const projectEntry of listDir(sessionsDir)) {
      if (!projectEntry.isDirectory()) continue;
      const projectKey = projectEntry.name;
      const projectDir = join(sessionsDir, projectKey);
      for (const sessionEntry of listDir(projectDir)) {
        if (!sessionEntry.isDirectory() || !SESSION_DIR_RE.test(sessionEntry.name)) continue;
        const dir = join(projectDir, sessionEntry.name);
        const paths = artifactsOf(dir);
        if (paths.length === 0) continue;
        const primary = primaryOf(paths);
        const info = fileInfo(primary.path);
        if (info === null) continue;
        primary.hash = info.hash;
        const id = sessionIdFromDirName(sessionEntry.name);
        const metaCacheKey = info.path + "|" + info.size + "|" + info.mtimeMs;
        let summary = hashCache.get("meta:" + metaCacheKey);
        if (summary === undefined) {
          summary = readSessionSummary(info.path);
          hashCache.set("meta:" + metaCacheKey, summary);
        }
        local.set(id, {
          id,
          dirName: sessionEntry.name,
          projectKey,
          dir,
          primary,
          files: paths.map((path) => fileInfo(path)).filter(Boolean),
          title: summary === null ? id : summary.title,
          cwd: summary === null ? null : summary.cwd,
          createdAt: summary === null ? null : summary.createdAt,
          updatedAt: info.mtimeMs,
          size: info.size
        });
      }
    }
    return local;
  }

  function cloudSessionDir(projectKey, dirName) {
    return join(cloudSessionsDir, projectKey, dirName);
  }

  function scanCloud() {
    const cloud = new Map();
    for (const projectEntry of listDir(cloudSessionsDir)) {
      if (!projectEntry.isDirectory()) continue;
      const projectKey = projectEntry.name;
      const projectDir = join(cloudSessionsDir, projectKey);
      for (const sessionEntry of listDir(projectDir)) {
        if (!sessionEntry.isDirectory() || !SESSION_DIR_RE.test(sessionEntry.name)) continue;
        const dir = join(projectDir, sessionEntry.name);
        const paths = artifactsOf(dir);
        const placeholders = listDir(dir)
          .filter((entry) => entry.isFile() && isPlaceholder(entry.name) && ARTIFACT_RE.test(entry.name.replace(/\.icloud$/, "")))
          .map((entry) => join(dir, entry.name));
        const meta = safeReadJson(join(dir, "meta.json"));
        const sync = safeReadJson(join(dir, "sync.json"));
        if (paths.length === 0 && placeholders.length === 0 && meta === null) continue;
        const primary = primaryOf(paths);
        const info = primary === null ? null : fileInfo(primary.path);
        if (primary !== null && info !== null) primary.hash = info.hash;
        const id = sessionIdFromDirName(sessionEntry.name);
        cloud.set(id, {
          id,
          dirName: sessionEntry.name,
          projectKey,
          dir,
          primary,
          placeholders,
          files: paths.map((path) => fileInfo(path)).filter(Boolean),
          meta: meta || {},
          sync: sync || {},
          title: meta && typeof meta.title === "string" ? meta.title : id,
          cwd: meta && typeof meta.cwd === "string" ? meta.cwd : null,
          size: info === null ? Number(meta && meta.size) || 0 : info.size,
          updatedAt: info === null ? 0 : info.mtimeMs,
          hash: info === null ? null : info.hash
        });
      }
    }
    return cloud;
  }

  /** Hash this machine last agreed on, recorded per machine in sync.json. */
  function syncedHash(cloudEntry) {
    const sync = cloudEntry && cloudEntry.sync;
    if (sync && sync.machines && typeof sync.machines[machineSlug] === "string") return sync.machines[machineSlug];
    return null;
  }

  function evaluate(id, local, cloud, liveIds) {
    const localPrimaryHash = local && local.primary ? local.primary.path && fileInfo(local.primary.path) : null;
    const localHash = localPrimaryHash === null ? null : localPrimaryHash.hash;
    const cloudEntry = cloud || null;
    const cloudHash = cloudEntry === null ? null : cloudEntry.hash;
    const agreed = cloudEntry === null ? null : syncedHash(cloudEntry);
    let status;
    if (local && cloudEntry === null) status = "local-only";
    else if (!local && cloudEntry !== null) status = "cloud-only";
    else if (localHash !== null && localHash === cloudHash) status = "synced";
    else if (agreed === null) status = "conflict";
    else if (localHash === agreed) status = "cloud-newer";
    else if (cloudHash === agreed) status = "local-newer";
    else status = "conflict";
    if (cloudEntry !== null && cloudEntry.primary === null && Array.isArray(cloudEntry.placeholders) && cloudEntry.placeholders.length > 0) {
      status = "cloud-offline";
    }
    const live = liveIds !== undefined && liveIds.has(id);
    if (live && status === "cloud-newer") status = "pending-close";
    if (live && status === "conflict") status = "conflict";
    return {
      id,
      title: (local && local.title) || (cloudEntry && cloudEntry.title) || id,
      projectKey: (local && local.projectKey) || (cloudEntry && cloudEntry.projectKey) || null,
      cwd: (local && local.cwd) || (cloudEntry && cloudEntry.cwd) || null,
      createdAt: local && local.createdAt ? local.createdAt : (cloudEntry && cloudEntry.meta && cloudEntry.meta.createdAt) || null,
      updatedAt: Math.max(local ? local.updatedAt : 0, cloudEntry ? cloudEntry.updatedAt : 0) || null,
      size: (local && local.size) || (cloudEntry && cloudEntry.size) || 0,
      machine: cloudEntry && cloudEntry.meta && typeof cloudEntry.meta.machine === "string" ? cloudEntry.meta.machine : null,
      localHash,
      cloudHash,
      agreedHash: agreed,
      status,
      live: Boolean(live),
      localPath: local ? local.primary.path : null,
      cloudPath: cloudEntry && cloudEntry.primary ? cloudEntry.primary.path : null,
      conflict: cloudEntry && cloudEntry.meta && Array.isArray(cloudEntry.meta.conflicts) && cloudEntry.meta.conflicts.length > 0
        ? cloudEntry.meta.conflicts
        : null
    };
  }

  function writeCloudMeta(cloudEntry, patch) {
    const meta = Object.assign(
      {
        sessionId: cloudEntry.id,
        projectKey: cloudEntry.projectKey,
        dirName: cloudEntry.dirName
      },
      cloudEntry.meta || {},
      patch
    );
    meta.updatedAt = new Date().toISOString();
    writeFileAtomic(join(cloudEntry.dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
    cloudEntry.meta = meta;
  }

  function writeCloudSync(cloudEntry, machines, machine) {
    const sync = {
      machines,
      machine: machine || machineName,
      machineId,
      at: new Date().toISOString()
    };
    writeFileAtomic(join(cloudEntry.dir, "sync.json"), JSON.stringify(sync, null, 2) + "\n");
    cloudEntry.sync = sync;
  }

  /** Remember that this machine has this hash on disk (after upload, import or download). */
  function recordSynced(cloudEntry, hash) {
    const machines = Object.assign({}, (cloudEntry.sync && cloudEntry.sync.machines) || {});
    if (typeof hash === "string") machines[machineSlug] = hash;
    writeCloudSync(cloudEntry, machines);
  }

  function backupLocal(local) {
    const target = join(localBackupsDir, timestampTag() + "-" + machineSlug, local.id);
    ensureDir(target);
    for (const file of local.files) {
      const stat = statOrNull(file.path);
      if (stat === null) continue;
      copyFileSync(file.path, join(target, file.name));
    }
    return target;
  }

  function historyCloud(cloudEntry) {
    const target = join(cloudHistoryDir, timestampTag() + "-" + machineSlug, cloudEntry.id);
    ensureDir(target);
    for (const file of cloudEntry.files) {
      copyFileSync(file.path, join(target, file.name));
    }
    return target;
  }

  function copyIntoPlace(sourcePath, targetPath) {
    const buffer = readFileSync(sourcePath);
    writeFileAtomic(targetPath, buffer);
  }

  function upload(local, cloudEntry, actions) {
    const dir = cloudSessionDir(local.projectKey, local.dirName);
    ensureDir(dir);
    const primaryName = local.primary.name;
    const cloudPrimary = cloudEntry === null ? null : cloudEntry.primary;
    if (cloudPrimary !== null && cloudPrimary.path !== null && existsSync(cloudPrimary.path)) {
      const cloudInfo = fileInfo(cloudPrimary.path);
      if (cloudInfo !== null && cloudInfo.hash !== local.primary.hash && cloudInfo.name === primaryName) {
        cloudEntry = cloudEntry || { id: local.id, dirName: local.dirName, projectKey: local.projectKey, dir: dir, files: [] };
        historyCloud(cloudEntry);
      }
    }
    for (const file of local.files) {
      const target = join(dir, file.name);
      const existing = statOrNull(target);
      if (existing !== null) {
        const existingInfo = fileInfo(target);
        if (existingInfo !== null && existingInfo.hash === file.hash) continue;
      }
      copyIntoPlace(file.path, target);
    }
    const entry = {
      id: local.id,
      dirName: local.dirName,
      projectKey: local.projectKey,
      dir,
      files: artifactsOf(dir).map((path) => fileInfo(path)).filter(Boolean),
      primary: null,
      meta: safeReadJson(join(dir, "meta.json")) || {},
      sync: safeReadJson(join(dir, "sync.json")) || {},
      title: local.title,
      cwd: local.cwd,
      size: local.size,
      hash: local.primary.hash
    };
    entry.primary = primaryOf(artifactsOf(dir));
    writeCloudMeta(entry, {
      sessionId: local.id,
      title: local.title,
      cwd: local.cwd,
      createdAt: local.createdAt,
      size: local.size,
      hash: local.primary.hash,
      machine: machineName,
      machineId,
      conflicts: []
    });
    recordSynced(entry, local.primary.hash);
    actions.push({ id: local.id, action: "upload", note: local.title });
    return entry;
  }

  function importSession(cloudEntry, actions) {
    const localProjectKey = (cloudEntry.cwd ? encodeProjectKey(cloudEntry.cwd) : null) || cloudEntry.projectKey;
    const localDir = join(sessionsDir, localProjectKey, cloudEntry.dirName);
    ensureDir(localDir);
    for (const file of cloudEntry.files) {
      const target = join(localDir, file.name);
      if (existsSync(target)) continue;
      copyIntoPlace(file.path, target);
      try {
        const stat = statOrNull(target);
        if (stat !== null) void stat;
      } catch {
        // best effort
      }
    }
    const entry = {
      id: cloudEntry.id,
      dirName: cloudEntry.dirName,
      projectKey: localProjectKey,
      dir: localDir,
      primary: null,
      files: artifactsOf(localDir).map((path) => fileInfo(path)).filter(Boolean),
      title: cloudEntry.title,
      cwd: cloudEntry.cwd,
      size: cloudEntry.size,
      updatedAt: now()
    };
    entry.primary = primaryOf(artifactsOf(localDir));
    const importedInfo = entry.primary === null ? null : fileInfo(entry.primary.path);
    recordSynced(cloudEntry, importedInfo === null ? null : importedInfo.hash);
    actions.push({ id: cloudEntry.id, action: "import", note: cloudEntry.title });
    return entry;
  }

  function download(local, cloudEntry, actions) {
    backupLocal(local);
    for (const file of cloudEntry.files) {
      const target = join(local.dir, file.name);
      const existing = statOrNull(target);
      if (existing !== null) {
        const existingInfo = fileInfo(target);
        if (existingInfo !== null && existingInfo.hash === file.hash) continue;
      }
      copyIntoPlace(file.path, target);
    }
    recordSynced(cloudEntry, cloudEntry.hash);
    actions.push({ id: local.id, action: "download", note: cloudEntry.title });
    return local;
  }

  function recordConflict(local, cloudEntry, actions) {
    const primary = local.primary;
    const conflictName = primary.name.replace(/\.jsonl(?:\.zstd)?$/, (suffix) => "@" + machineSlug + suffix);
    const target = join(cloudEntry.dir, conflictName);
    const existing = statOrNull(target);
    const existingInfo = existing === null ? null : fileInfo(target);
    if (existingInfo === null || existingInfo.hash !== primary.hash) {
      copyIntoPlace(primary.path, target);
    }
    const conflicts = Array.isArray(cloudEntry.meta.conflicts) ? cloudEntry.meta.conflicts.slice() : [];
    const next = {
      machine: machineName,
      machineId,
      at: new Date().toISOString(),
      file: conflictName,
      hash: primary.hash
    };
    const without = conflicts.filter((item) => item && item.machine !== machineName);
    without.push(next);
    writeCloudMeta(cloudEntry, { conflicts: without });
    actions.push({ id: local.id, action: "conflict", note: local.title });
  }

  function collect(liveIds) {
    const local = scanLocal();
    const cloud = scanCloud();
    const ids = new Set([...local.keys(), ...cloud.keys()]);
    const sessions = [];
    for (const id of ids) {
      sessions.push(evaluate(id, local.get(id), cloud.get(id), liveIds));
    }
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return { local, cloud, sessions };
  }

  function summaryOf(sessions) {
    const summary = {
      local: 0,
      cloud: 0,
      synced: 0,
      pendingUpload: 0,
      pendingDownload: 0,
      cloudOnly: 0,
      localOnly: 0,
      conflicts: 0,
      live: 0,
      cloudOffline: 0
    };
    for (const session of sessions) {
      if (session.localPath !== null) summary.local += 1;
      if (session.cloudPath !== null) summary.cloud += 1;
      if (session.live) summary.live += 1;
      switch (session.status) {
        case "synced":
          summary.synced += 1;
          break;
        case "local-newer":
        case "local-only":
          summary.pendingUpload += 1;
          break;
        case "cloud-newer":
          summary.pendingDownload += 1;
          break;
        case "cloud-only":
          summary.cloudOnly += 1;
          break;
        case "conflict":
          summary.conflicts += 1;
          break;
        case "pending-close":
          summary.pendingDownload += 1;
          break;
        case "cloud-offline":
          summary.cloudOffline += 1;
          break;
        default:
          break;
      }
    }
    return summary;
  }

  function syncAttachments(actions) {
    if (attachmentsDir === null || attachmentsDir === undefined) return;
    const localObjects = join(attachmentsDir, "v1", "objects");
    if (!existsSync(localObjects)) return;
    const cloudObjects = join(cloudAttachmentsDir, "v1", "objects");
    ensureDir(cloudObjects);
    for (const shard of listDir(localObjects)) {
      if (!shard.isDirectory()) continue;
      for (const object of listDir(join(localObjects, shard.name))) {
        if (!object.isFile() || isPlaceholder(object.name)) continue;
        const target = join(cloudObjects, shard.name, object.name);
        if (existsSync(target)) continue;
        const stat = statOrNull(join(localObjects, shard.name, object.name));
        if (stat === null || stat.size > 64 * 1024 * 1024) continue;
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        copyIntoPlace(join(localObjects, shard.name, object.name), target);
        actions.push({ id: "attachment:" + object.name, action: "upload-attachment", note: shard.name });
      }
    }
    for (const shard of listDir(cloudObjects)) {
      if (!shard.isDirectory()) continue;
      for (const object of listDir(join(cloudObjects, shard.name))) {
        if (!object.isFile() || isPlaceholder(object.name)) continue;
        const target = join(localObjects, shard.name, object.name);
        if (existsSync(target)) continue;
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        try {
          copyIntoPlace(join(cloudObjects, shard.name, object.name), target);
          actions.push({ id: "attachment:" + object.name, action: "download-attachment", note: shard.name });
        } catch {
          // iCloud may not have materialised the object yet.
        }
      }
    }
  }

  /** One pass: upload quiet local changes, import cloud-only sessions, record conflicts. */
  function run(liveIds) {
    const actions = [];
    const local = scanLocal();
    let cloud = scanCloud();
    if (materialize !== null) {
      let changed = false;
      for (const entry of cloud.values()) {
        if (entry.primary !== null) continue;
        for (const placeholder of entry.placeholders || []) {
          try {
            materialize(placeholder);
            changed = true;
          } catch {
            // iCloud is unreachable right now; try again on the next pass.
          }
        }
      }
      if (changed) cloud = scanCloud();
    }
    const ids = new Set([...local.keys(), ...cloud.keys()]);
    for (const id of ids) {
      const localEntry = local.get(id) || null;
      const cloudEntry = cloud.get(id) || null;
      const state = evaluate(id, localEntry, cloudEntry, liveIds);
      try {
        if (state.status === "local-only" || state.status === "local-newer") {
          const quiet = now() - localEntry.updatedAt >= quietMs;
          if (!quiet) {
            actions.push({ id, action: "defer", note: "写入中" });
            continue;
          }
          upload(localEntry, cloudEntry, actions);
        } else if (state.status === "cloud-only") {
          importSession(cloudEntry, actions);
        } else if (state.status === "cloud-newer") {
          if (state.live) {
            actions.push({ id, action: "defer", note: "会话打开中" });
            continue;
          }
          download(localEntry, cloudEntry, actions);
        } else if (state.status === "cloud-offline") {
          actions.push({ id, action: "defer", note: "等待 iCloud 下载" });
        } else if (state.status === "conflict" && !state.live) {
          recordConflict(localEntry, cloudEntry, actions);
        }
      } catch (error) {
        actions.push({ id, action: "error", note: error instanceof Error ? error.message : String(error) });
      }
    }
    try {
      syncAttachments(actions);
    } catch (error) {
      actions.push({ id: "attachments", action: "error", note: error instanceof Error ? error.message : String(error) });
    }
    const after = collect(liveIds);
    writeIndex(after.sessions);
    return {
      ok: true,
      at: new Date().toISOString(),
      actions,
      summary: summaryOf(after.sessions),
      sessions: after.sessions
    };
  }

  /** Aggregate cloud index, purely derived; safe to delete. */
  function writeIndex(sessions) {
    if (!existsSync(cloudDir)) return;
    try {
      const index = {
        version: 1,
        machine: machineName,
        machineId,
        updatedAt: new Date().toISOString(),
        sessions: sessions
          .filter((session) => session.cloudPath !== null)
          .map((session) => ({
            sessionId: session.id,
            title: session.title,
            projectKey: session.projectKey,
            cwd: session.cwd,
            machine: session.machine,
            size: session.size,
            hash: session.cloudHash,
            updatedAt: session.updatedAt
          }))
      };
      writeFileAtomic(join(cloudDir, "cloud", "index.json"), JSON.stringify(index, null, 2) + "\n");
    } catch {
      // index.json is a convenience file only.
    }
  }

  /** Import one cloud-only session on demand (used by the panel's "导入" button). */
  function importById(id) {
    const local = scanLocal().get(id);
    if (local !== undefined) {
      const after = collect();
      return { ok: true, skipped: true, actions: [], summary: summaryOf(after.sessions), sessions: after.sessions };
    }
    const entry = scanCloud().get(id);
    if (entry === undefined) return { ok: false, error: "云端没有这个会话" };
    if (entry.primary === null) {
      for (const placeholder of entry.placeholders || []) {
        try {
          if (materialize !== null) materialize(placeholder);
        } catch {
          // reported below
        }
      }
      return { ok: false, error: "iCloud 文件尚未下载到本机，请稍后再试" };
    }
    const actions = [];
    importSession(entry, actions);
    const after = collect();
    writeIndex(after.sessions);
    return { ok: true, actions, summary: summaryOf(after.sessions), sessions: after.sessions };
  }

  function resolve(id, keep) {
    const local = scanLocal().get(id) || null;
    const cloud = scanCloud().get(id) || null;
    if (cloud === null) return { ok: false, error: "云端没有这个会话" };
    if (cloud.primary === null) {
      for (const placeholder of cloud.placeholders || []) {
        try {
          if (materialize !== null) materialize(placeholder);
        } catch {
          // ignore, reported below
        }
      }
      return { ok: false, error: "iCloud 文件尚未下载到本机，请稍后再试" };
    }
    const actions = [];
    if (keep === "local") {
      if (local === null) return { ok: false, error: "本机没有这个会话" };
      upload(local, cloud, actions);
      const entry = Object.assign({}, cloud, {
        files: artifactsOf(cloud.dir).map((path) => fileInfo(path)).filter(Boolean),
        meta: safeReadJson(join(cloud.dir, "meta.json")) || {},
        sync: safeReadJson(join(cloud.dir, "sync.json")) || {}
      });
      writeCloudMeta(entry, { conflicts: [] });
      return { ok: true, actions, summary: summaryOf(collect(undefined).sessions), sessions: collect(undefined).sessions };
    }
    if (keep === "cloud") {
      if (local === null) {
        importSession(cloud, actions);
      } else {
        download(local, cloud, actions);
      }
      const entry = Object.assign({}, cloud, {
        meta: safeReadJson(join(cloud.dir, "meta.json")) || {},
        sync: safeReadJson(join(cloud.dir, "sync.json")) || {}
      });
      writeCloudMeta(entry, { conflicts: [] });
      return { ok: true, actions, summary: summaryOf(collect(undefined).sessions), sessions: collect(undefined).sessions };
    }
    return { ok: false, error: "未知的处理方式" };
  }

  return {
    cloudDir,
    cloudSessionsDir,
    machineName,
    machineId,
    machineSlug,
    collect,
    run,
    resolve,
    importById,
    importSession,
    summaryOf
  };
}
