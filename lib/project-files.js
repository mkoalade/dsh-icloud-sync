// Project workspace files: uploaded next to the session logs so another Mac can
// restore the exact directory tree (paths, modes, symlinks) and keep working.
//
// Cloud layout:
//   <cloud>/cloud/projects/<projectKey>/manifest.json
//   <cloud>/cloud/projects/<projectKey>/files/<rel path>
//   <cloud>/history/projects/<stamp>-<machine>/<projectKey>/<rel path>   (overwritten copies)
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
const SKIP_NAMES = new Set([".DS_Store"]);

function ensureDir(path, mode = 0o755) {
  mkdirSync(path, { recursive: true });
  try {
    chmodSync(path, mode);
  } catch {
    // best effort
  }
}

function writeAtomic(path, data) {
  const tmp = path + ".tmp-" + process.pid + "-" + Math.random().toString(36).slice(2);
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

function copyAtomic(source, target, mode) {
  const tmp = target + ".tmp-" + process.pid + "-" + Math.random().toString(36).slice(2);
  copyFileSync(source, tmp);
  if (typeof mode === "number") {
    try {
      chmodSync(tmp, mode);
    } catch {
      // best effort
    }
  }
  renameSync(tmp, target);
}

function sha256File(path, size) {
  const hash = createHash("sha256");
  const fd = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let left = size;
  try {
    while (left > 0) {
      const read = readSync(fd, buffer, 0, Math.min(buffer.length, left), null);
      if (read <= 0) break;
      hash.update(buffer.subarray(0, read));
      left -= read;
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

export function sha256OfFile(path) {
  const stat = statSync(path);
  return sha256File(path, stat.size);
}

function walk(root, rel, out) {
  const absolute = rel === "" ? root : join(root, rel);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch (error) {
    out.failed.push({ rel: rel === "" ? "." : rel, error: error.message });
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const childRel = rel === "" ? entry.name : rel + "/" + entry.name;
    const childAbsolute = join(root, childRel);
    if (entry.isDirectory()) {
      walk(root, childRel, out);
      continue;
    }
    if (entry.isSymbolicLink()) {
      try {
        out.files.push({ rel: childRel, kind: "symlink", target: readlinkSync(childAbsolute) });
      } catch (error) {
        out.failed.push({ rel: childRel, error: error.message });
      }
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      const stat = statSync(childAbsolute);
      if (stat.size > MAX_FILE_BYTES) {
        out.failed.push({ rel: childRel, error: "文件超过 4GB，未上传" });
        continue;
      }
      out.files.push({
        rel: childRel,
        kind: "file",
        size: stat.size,
        mode: stat.mode & 0o777,
        mtimeMs: Math.round(stat.mtimeMs),
        sha256: sha256File(childAbsolute, stat.size)
      });
    } catch (error) {
      out.failed.push({ rel: childRel, error: error.message });
    }
  }
}

/** Walk a project directory and return { files, failed } without touching the cloud. */
export function scanProjectFileTree(root) {
  const out = { files: [], failed: [] };
  if (typeof root !== "string" || root === "" || !existsSync(root)) return out;
  walk(root, "", out);
  return out;
}

function readManifest(path) {
  try {
    const text = readFileSync(path, "utf8");
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function timestampTag(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

/**
 * Keep the layout, swap the home directory when the other Mac uses a different user
 * name (/Users/alice/work -> /Users/bob/work). Anything else stays absolute.
 */
export function remapProjectPath(absolutePath) {
  const home = homedir();
  if (absolutePath === home || absolutePath.startsWith(home + "/")) return { path: absolutePath, remapped: false };
  const match = String(absolutePath).match(/^\/Users\/[^/]+(\/.*)?$/);
  if (match === null) return { path: absolutePath, remapped: false };
  return { path: home + (match[1] === undefined ? "" : match[1]), remapped: true };
}

export function readProjectManifest(cloudProjectsDir, projectKey) {
  const manifest = readManifest(join(cloudProjectsDir, projectKey, "manifest.json"));
  if (manifest === null) return null;
  let bytes = 0;
  let files = 0;
  for (const item of manifest.files) {
    if (item === null || typeof item !== "object") continue;
    if (typeof item.rel !== "string" || item.rel === "") continue;
    files += 1;
    if (typeof item.size === "number") bytes += item.size;
  }
  return {
    path: typeof manifest.path === "string" ? manifest.path : null,
    files,
    bytes,
    uploadedAt: typeof manifest.uploadedAt === "string" ? manifest.uploadedAt : null,
    machine: manifest.machine && typeof manifest.machine.name === "string" ? manifest.machine.name : null
  };
}

/** Copy every changed file of `root` into the cloud project folder and refresh the manifest. */
export function uploadProjectFiles(options) {
  const root = options.root;
  const projectDir = join(options.cloudProjectsDir, options.projectKey);
  const filesDir = join(projectDir, "files");
  const scan = scanProjectFileTree(root);
  if (scan.files.length === 0 && scan.failed.length > 0) {
    const error = new Error("项目目录读不到： " + (scan.failed[0] && scan.failed[0].error ? scan.failed[0].error : "unknown"));
    error.code = "missing-local";
    throw error;
  }
  const previous = readManifest(join(projectDir, "manifest.json"));
  const previousByRel = new Map();
  if (previous !== null) {
    for (const item of previous.files) {
      if (item !== null && typeof item === "object" && typeof item.rel === "string") previousByRel.set(item.rel, item);
    }
  }
  ensureDir(filesDir);
  let uploaded = 0;
  let unchanged = 0;
  let bytes = 0;
  const failed = scan.failed.slice();
  for (const item of scan.files) {
    const target = join(filesDir, item.rel);
    const before = previousByRel.get(item.rel);
    try {
      if (item.kind === "symlink") {
        const linkPath = target + ".dsh-link";
        if (before !== undefined && before.kind === "symlink" && before.target === item.target && existsSync(linkPath)) {
          unchanged += 1;
          continue;
        }
        ensureDir(dirname(linkPath));
        writeAtomic(linkPath, item.target + "\n");
        if (existsSync(target)) rmSync(target, { force: true });
        uploaded += 1;
        continue;
      }
      if (before !== undefined && before.kind === "file" && before.sha256 === item.sha256 && existsSync(target)) {
        unchanged += 1;
        continue;
      }
      ensureDir(dirname(target));
      copyAtomic(join(root, item.rel), target, item.mode);
      uploaded += 1;
      bytes += item.size;
    } catch (error) {
      failed.push({ rel: item.rel, error: error.message });
    }
  }
  const manifest = {
    schema: 1,
    projectKey: options.projectKey,
    path: root,
    uploadedAt: new Date().toISOString(),
    machine: { name: options.machineName || "Mac", slug: options.machineSlug || "" },
    totalBytes: scan.files.reduce((sum, item) => sum + (typeof item.size === "number" ? item.size : 0), 0),
    files: scan.files
  };
  writeAtomic(join(projectDir, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  return {
    ok: true,
    action: "upload-files",
    path: root,
    total: scan.files.length,
    uploaded,
    unchanged,
    bytes,
    failed
  };
}

function backupExisting(source, historyDir, rel, stat) {
  const target = join(historyDir, rel);
  ensureDir(dirname(target));
  if (stat.isSymbolicLink()) {
    writeAtomic(target + ".dsh-link", readlinkSync(source) + "\n");
    return;
  }
  copyFileSync(source, target);
}

/** Restore the cloud tree at its original absolute path, backing up anything it replaces. */
export function downloadProjectFiles(options) {
  const projectDir = join(options.cloudProjectsDir, options.projectKey);
  const manifest = readManifest(join(projectDir, "manifest.json"));
  if (manifest === null) {
    const error = new Error("云端没有这个项目的文件清单，先在项目所在的那台 Mac 上上传一次。");
    error.code = "missing-cloud";
    throw error;
  }
  if (typeof manifest.path !== "string" || !isAbsolute(manifest.path)) {
    const error = new Error("文件清单里的项目路径不可用。");
    error.code = "missing-cloud";
    throw error;
  }
  const mapped = remapProjectPath(manifest.path);
  const target = mapped.path;
  const historyDir = join(options.cloudProjectHistoryDir, timestampTag() + "-" + (options.machineSlug || "mac"), options.projectKey);
  let downloaded = 0;
  let unchanged = 0;
  let backedUp = 0;
  const failed = [];
  for (const item of manifest.files) {
    if (item === null || typeof item !== "object" || typeof item.rel !== "string" || item.rel === "") continue;
    const destination = join(target, item.rel);
    try {
      const existing = lstatOrNull(destination);
      if (item.kind === "symlink") {
        if (existing !== null && existing.isSymbolicLink() && readlinkSync(destination) === item.target) {
          unchanged += 1;
          continue;
        }
        if (existing !== null) {
          backupExisting(destination, historyDir, item.rel, existing);
          backedUp += 1;
          rmSync(destination, { force: true, recursive: true });
        }
        ensureDir(dirname(destination));
        symlinkSync(item.target, destination);
        downloaded += 1;
        continue;
      }
      if (existing !== null && existing.isFile() && existing.size === item.size && sha256File(destination, item.size) === item.sha256) {
        unchanged += 1;
        continue;
      }
      if (existing !== null) {
        backupExisting(destination, historyDir, item.rel, existing);
        backedUp += 1;
        rmSync(destination, { force: true, recursive: true });
      }
      ensureDir(dirname(destination));
      copyAtomic(join(projectDir, "files", item.rel), destination, item.mode);
      downloaded += 1;
    } catch (error) {
      failed.push({ rel: item.rel, error: error.message });
    }
  }
  return {
    ok: true,
    action: "download-files",
    path: target,
    originalPath: manifest.path,
    remapped: mapped.remapped,
    total: manifest.files.length,
    downloaded,
    unchanged,
    backedUp,
    historyDir: backedUp > 0 ? historyDir : null,
    failed
  };
}
