/**
 * Cloud session sync for dsh-icloud-sync.
 *
 * DSH stores one append-only log per session under
 * `~/.dsh/sessions/<project-key>/session-<uuid>/session.v4.jsonl.zstd`.
 * This module mirrors those logs (and the content-addressed attachments) into
 * iCloud Drive so several Macs signed into the same Apple ID share them.
 *
 * Rules (manual relay, no background sync):
 *  - nothing is copied until a human presses upload/download;
 *  - a session that is open in this process is never overwritten (`live`);
 *  - upload overwrites the cloud copy; the previous copy moves to history/;
 *  - download overwrites the local copy; the previous copy moves to backups/;
 *  - download never writes inside the iCloud folder;
 *  - `session.lock` never leaves the machine and nothing is ever deleted.
 *
 * Everything is written atomically (temp file + rename) and 0600/0700.
 */
import { createHash } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, statSync, writeFileSync } from "node:fs";
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

function hashFile(path, size) {
  const limit = 128 * 1024 * 1024;
  if (size <= limit) return sha256(readFileSync(path));
  const fd = openSync(path, "r");
  try {
    const headBuffer = Buffer.alloc(4 * 1024 * 1024);
    const tailBuffer = Buffer.alloc(4 * 1024 * 1024);
    readSync(fd, headBuffer, 0, headBuffer.length, 0);
    readSync(fd, tailBuffer, 0, tailBuffer.length, Math.max(0, size - tailBuffer.length));
    return sha256(Buffer.concat([headBuffer, Buffer.from(":" + size + ":"), tailBuffer]));
  } finally {
    closeSync(fd);
  }
}

function errorOf(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function compareMeta(a, b) {
  const left = Date.parse(a) || 0;
  const right = Date.parse(b) || 0;
  return left - right;
}

/**
 * Manual engine. A session only moves when a human presses a button:
 *  - `push(id)` copies the local log over the cloud copy (old copy -> history/);
 *  - `pull(id)` copies the cloud log over the local copy (old copy -> backups/);
 *  - nothing runs on a timer, and `pull` never writes inside the cloud folder.
 */
export function createCloudSessions(options) {
  const sessionsDir = options.sessionsDir;
  const cloudDir = options.cloudDir;
  const backupsDir = join(options.stateDir || join(sessionsDir, "..", ".icloud-sync"), "backups", "sessions");
  const machineName = options.machineName || "Mac";
  const machineId = options.machineId || "";
  const machineSlug = sanitizeSlug(machineName) + "-" + sanitizeSlug(machineId).slice(0, 8);
  const materialize = typeof options.materialize === "function" ? options.materialize : null;

  const cloudSessionsDir = join(cloudDir, "cloud", "sessions");
  const cloudHistoryDir = join(cloudDir, "history", "sessions");

  function readMeta(dirPath) {
    const meta = safeReadJson(join(dirPath, "meta.json"));
    if (meta === null || typeof meta.id !== "string" || meta.id === "") return null;
    return meta;
  }

  function localItems() {
    const items = new Map();
    for (const project of listDir(sessionsDir)) {
      if (!project.isDirectory() || isPlaceholder(project.name)) continue;
      const projectPath = join(sessionsDir, project.name);
      for (const entry of listDir(projectPath)) {
        if (!entry.isDirectory() || !SESSION_DIR_RE.test(entry.name) || isPlaceholder(entry.name)) continue;
        const dirPath = join(projectPath, entry.name);
        const primary = primaryOf(artifactsOf(dirPath));
        if (primary === null) continue;
        const stat = statOrNull(primary.path);
        if (stat === null) continue;
        const summary = readSessionSummary(primary.path) || {};
        const id = typeof summary.id === "string" && summary.id !== "" ? summary.id : sessionIdFromDirName(entry.name);
        items.set(id, {
          id,
          projectKey: project.name,
          dirName: entry.name,
          artifactName: primary.name,
          artifactPath: primary.path,
          dirPath,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          hash: hashFile(primary.path, stat.size),
          summary
        });
      }
    }
    return items;
  }

  function cloudItems() {
    const items = new Map();
    for (const project of listDir(cloudSessionsDir)) {
      if (!project.isDirectory() || isPlaceholder(project.name)) continue;
      const projectPath = join(cloudSessionsDir, project.name);
      for (const entry of listDir(projectPath)) {
        if (!entry.isDirectory() || isPlaceholder(entry.name)) continue;
        const dirPath = join(projectPath, entry.name);
        const meta = readMeta(dirPath);
        if (meta === null) continue;
        const artifactName = typeof meta.artifactName === "string" && ARTIFACT_RE.test(meta.artifactName) ? meta.artifactName : "session.v4.jsonl.zstd";
        const artifactPath = join(dirPath, artifactName);
        const stat = statOrNull(artifactPath);
        const notDownloaded = stat === null && existsSync(artifactPath + ".icloud");
        if (stat === null && !notDownloaded) continue;
        items.set(meta.id, {
          id: meta.id,
          projectKey: project.name,
          dirName: entry.name,
          artifactName,
          artifactPath,
          meta,
          size: stat === null ? Number(meta.size) || 0 : stat.size,
          pending: notDownloaded || (stat !== null && stat.size === 0)
        });
      }
    }
    return items;
  }

  function list(liveIds) {
    const live = liveIds instanceof Set ? liveIds : new Set(Array.isArray(liveIds) ? liveIds : []);
    const locals = localItems();
    const clouds = cloudItems();
    const ids = new Set([...locals.keys(), ...clouds.keys()]);
    const sessions = [];
    for (const id of ids) {
      const local = locals.get(id);
      const cloud = clouds.get(id);
      const meta = cloud === undefined ? null : cloud.meta;
      const title = (local && local.summary && local.summary.title) || (meta && typeof meta.title === "string" ? meta.title : "") || "未命名会话";
      const cwd = (local && local.summary && local.summary.cwd) || (meta && typeof meta.cwd === "string" ? meta.cwd : "") || null;
      const localAt = local === undefined ? 0 : local.mtimeMs;
      const cloudAt = meta === null ? 0 : Date.parse(meta.uploadedAt) || 0;
      const same = local !== undefined && meta !== null && local.hash !== "" && typeof meta.sha256 === "string" && local.hash === meta.sha256;
      let status;
      if (local === undefined) status = "cloud-only";
      else if (meta === null) status = "unuploaded";
      else if (same) status = "uploaded";
      else if (cloudAt > localAt) status = "cloud-newer";
      else status = "unuploaded";
      const isLive = live.has(id);
      sessions.push({
        id,
        projectKey: local === undefined ? cloud.projectKey : local.projectKey,
        dirName: local === undefined ? cloud.dirName : local.dirName,
        title,
        cwd,
        createdAt: (local && local.summary && local.summary.createdAt) || (meta && meta.createdAt) || null,
        updatedAt: new Date(Math.max(localAt, cloudAt) || Date.now()).toISOString(),
        size: local === undefined ? cloud.size : local.size,
        machine: meta === null ? null : typeof meta.machine === "string" ? meta.machine : meta.machine && meta.machine.name ? meta.machine.name : null,
        uploadedAt: meta === null ? null : meta.uploadedAt || null,
        live: isLive,
        status,
        hasLocal: local !== undefined,
        hasCloud: meta !== null,
        canUpload: local !== undefined && !isLive,
        canDownload: meta !== null && !isLive && !same && !cloud.pending
      });
    }
    sessions.sort(function (a, b) {
      if (a.projectKey !== b.projectKey) return a.projectKey < b.projectKey ? -1 : 1;
      return compareMeta(b.updatedAt, a.updatedAt);
    });
    const summary = { uploaded: 0, unuploaded: 0, "cloud-newer": 0, "cloud-only": 0, live: 0, local: locals.size, cloud: clouds.size };
    for (const item of sessions) {
      if (item.status === "uploaded") summary.uploaded += 1;
      else if (item.status === "unuploaded") summary.unuploaded += 1;
      else if (item.status === "cloud-newer") summary["cloud-newer"] += 1;
      else summary["cloud-only"] += 1;
      if (item.live) summary.live += 1;
    }
    return {
      sessions,
      summary,
      cloudDir: cloudSessionsDir,
      cloudExists: existsSync(cloudSessionsDir),
      sessionsDir
    };
  }

  function assertNotLive(id, liveIds) {
    const live = liveIds instanceof Set ? liveIds : new Set(Array.isArray(liveIds) ? liveIds : []);
    if (live.has(id)) throw errorOf("live", "会话仍在运行，先结束或关闭它再操作。");
  }

  function upload(id, liveIds) {
    assertNotLive(id, liveIds);
    const local = localItems().get(id);
    if (local === undefined) throw errorOf("missing-local", "本机没有这个会话。");
    const dirPath = join(cloudSessionsDir, local.projectKey, local.dirName);
    ensureDir(dirPath);
    const artifactPath = join(dirPath, local.artifactName);
    if (existsSync(artifactPath) && !existsSync(artifactPath + ".icloud")) {
      const archive = join(cloudHistoryDir, timestampTag() + "-" + machineSlug, local.projectKey, local.dirName);
      ensureDir(archive);
      copyFileSync(artifactPath, join(archive, local.artifactName));
    }
    const tmp = join(dirPath, ".tmp-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    copyFileSync(local.artifactPath, tmp);
    renameSync(tmp, artifactPath);
    const meta = {
      schema: 1,
      id: local.id,
      title: (local.summary && local.summary.title) || "未命名会话",
      cwd: (local.summary && local.summary.cwd) || null,
      createdAt: (local.summary && local.summary.createdAt) || null,
      updatedAt: (local.summary && local.summary.updatedAt) || null,
      artifactName: local.artifactName,
      size: local.size,
      sha256: local.hash,
      uploadedAt: new Date().toISOString(),
      machine: { name: machineName, slug: machineSlug, id: machineId },
      fromMtime: local.mtimeMs
    };
    writeFileAtomic(join(dirPath, "meta.json"), JSON.stringify(meta, null, 2) + "\n", 0o644);
    return { ok: true, action: "upload", sessionId: id, size: local.size, uploadedAt: meta.uploadedAt };
  }

  function download(id, liveIds) {
    assertNotLive(id, liveIds);
    const cloud = cloudItems().get(id);
    if (cloud === undefined) throw errorOf("missing-cloud", "云端没有这个会话。");
    if (cloud.pending) {
      if (materialize !== null) materialize(cloud.artifactPath);
      const stat = statOrNull(cloud.artifactPath);
      if (stat === null || stat.size === 0) throw errorOf("cloud-pending", "iCloud 还没把这个文件下载到本机，稍后再试。");
    }
    const local = localItems().get(id);
    const dirPath = join(sessionsDir, cloud.projectKey, cloud.dirName);
    ensureDir(dirPath);
    if (local !== undefined) {
      const archive = join(backupsDir, timestampTag(), cloud.projectKey, cloud.dirName);
      ensureDir(archive);
      copyFileSync(local.artifactPath, join(archive, local.artifactName));
    }
    const destination = join(dirPath, cloud.artifactName);
    const tmp = join(dirPath, ".tmp-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    copyFileSync(cloud.artifactPath, tmp);
    renameSync(tmp, destination);
    return { ok: true, action: "download", sessionId: id, size: cloud.size, backedUp: local !== undefined };
  }

  return { list, upload, download, machineName, machineId, machineSlug, cloudDir: cloudSessionsDir };
}
