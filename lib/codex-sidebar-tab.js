"use strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PACKAGE = "@michengai/dsh-codex-ui";
const CLIENT = path.join("lib", "client.js");
const BACKUP = "client.js.before-dsh-cloud";
const MARK = "sidebar.cloudTab";
const MENU_MARK = "icloudUploadProject";

/** 页签内容用我们自己的组件渲染，码位留在这里方便核对插槽名。 */
const SLOT = "sidebar.cloud";

const CLOUD_ITEM = `\t\t\t\tif (showCloud) items.push({
\t\t\t\t\tvalue: "cloud",
\t\t\t\t\tid: "dcu-tab-cloud",
\t\t\t\t\tpanelId: "dcu-panel-cloud",
\t\t\t\t\tlabel: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
\t\t\t\t\t\tstyle: {
\t\t\t\t\t\t\tdisplay: "inline-flex",
\t\t\t\t\t\t\talignItems: "center",
\t\t\t\t\t\t\tjustifyContent: "center",
\t\t\t\t\t\t\tgap: 5,
\t\t\t\t\t\t\twhiteSpace: "nowrap"
\t\t\t\t\t\t},
\t\t\t\t\t\tchildren: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
\t\t\t\t\t\t\tviewBox: "0 0 16 16",
\t\t\t\t\t\t\twidth: 14,
\t\t\t\t\t\t\theight: 14,
\t\t\t\t\t\t\tfill: "none",
\t\t\t\t\t\t\t"aria-hidden": "true",
\t\t\t\t\t\t\tchildren: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
\t\t\t\t\t\t\t\tfill: "currentColor",
\t\t\t\t\t\t\t\td: "M11.9 12.6H4.6a2.6 2.6 0 0 1-.5-5.15 3.6 3.6 0 0 1 6.95-.75 2.9 2.9 0 0 1 .85 5.9Z"
\t\t\t\t\t\t\t})
\t\t\t\t\t\t}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("sidebar.cloudTab") })]
\t\t\t\t\t})
\t\t\t\t});
\t\t\t\treturn items;`;

const MENU_ITEM = `\t\t\t\t\t{
\t\t\t\t\t\tid: "icloudUploadProject",
\t\t\t\t\t\tlabel: "上传项目到 iCloud",
\t\t\t\t\t\ticon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
\t\t\t\t\t\t\tviewBox: "0 0 16 16",
\t\t\t\t\t\t\twidth: 16,
\t\t\t\t\t\t\theight: 16,
\t\t\t\t\t\t\tfill: "none",
\t\t\t\t\t\t\t"aria-hidden": "true",
\t\t\t\t\t\t\tchildren: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
\t\t\t\t\t\t\t\tfill: "currentColor",
\t\t\t\t\t\t\t\td: "M8 1.4a4.1 4.1 0 0 1 4 3.2 3.1 3.1 0 0 1-.6 6.1H4.6a3.1 3.1 0 0 1-.6-6.1 4.1 4.1 0 0 1 4-3.2Zm0 1.6a2.5 2.5 0 0 0-2.5 2.5v.6l-.6.1a1.5 1.5 0 0 0 .3 3h7a1.5 1.5 0 0 0 .3-3l-.6-.1v-.6A2.5 2.5 0 0 0 8 3Z"
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})
\t\t\t\t\t},`;

/** 项目右键菜单里的「上传项目到 iCloud」：菜单项 + 点击分支，单独分组以便增量打补丁。 */
function menuEdits() {
  return [
    {
      name: "project-menu-item",
      from: `\t\t\t\t\t{
\t\t\t\t\t\tid: "openPath",
\t\t\t\t\t\tlabel: t("workspace.openPath"),
\t\t\t\t\t\ticon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolderOpenOutlineMedium, { size: 16 })
\t\t\t\t\t},`,
      to: `\t\t\t\t\t{
\t\t\t\t\t\tid: "openPath",
\t\t\t\t\t\tlabel: t("workspace.openPath"),
\t\t\t\t\t\ticon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolderOpenOutlineMedium, { size: 16 })
\t\t\t\t\t},
${MENU_ITEM}`,
    },
    {
      name: "project-menu-action",
      from: `\t\t\tconst handleProjectMenuAction = (workspace, id) => {
\t\t\t\tif (busy !== void 0) return;`,
      to: `\t\t\tconst handleProjectMenuAction = (workspace, id) => {
\t\t\t\tif (busy !== void 0) return;
\t\t\t\tif (id === "icloudUploadProject") {
\t\t\t\t\tconst hub = typeof window === "undefined" ? void 0 : window.__dshIcloud;
\t\t\t\t\tif (hub !== void 0 && typeof hub.uploadProject === "function") hub.uploadProject(workspace.path, workspace.title);
\t\t\t\t\telse if (typeof window !== "undefined" && typeof window.alert === "function") window.alert("iCloud 同步插件没有加载，无法上传。");
\t\t\t\t\treturn;
\t\t\t\t}`,
    },
  ];
}

/** 每条都是 (唯一锚点 -> 替换文本)，全部命中才落盘，避免半截补丁。 */
function edits() {
  return [
    {
      name: "declare-slot",
      from: `\t\t\t\t"sidebar.schedule": {
\t\t\t\t\tkind: "single",
\t\t\t\t\tscope: "root"
\t\t\t\t}
\t\t\t};
\t\t\tconst sharedSidebarChildren = {`,
      to: `\t\t\t\t"sidebar.schedule": {
\t\t\t\t\tkind: "single",
\t\t\t\t\tscope: "root"
\t\t\t\t},
\t\t\t\t"${SLOT}": {
\t\t\t\t\tkind: "single",
\t\t\t\t\tscope: "root"
\t\t\t\t}
\t\t\t};
\t\t\tconst sharedSidebarChildren = {`,
    },
    {
      name: "empty-tabs",
      from: `\t\tconst EMPTY_COMPANION_TABS = {
\t\t\tchannels: false,
\t\t\tschedule: false
\t\t};`,
      to: `\t\tconst EMPTY_COMPANION_TABS = {
\t\t\tchannels: false,
\t\t\tschedule: false,
\t\t\tcloud: false
\t\t};`,
    },
    {
      name: "availability",
      from: `\t\t\treturn {
\t\t\t\tchannels: slotHasEntries(slots, "sidebar.channels"),
\t\t\t\tschedule: slotHasEntries(slots, "sidebar.schedule")
\t\t\t};`,
      to: `\t\t\treturn {
\t\t\t\tchannels: slotHasEntries(slots, "sidebar.channels"),
\t\t\t\tschedule: slotHasEntries(slots, "sidebar.schedule"),
\t\t\t\tcloud: slotHasEntries(slots, "${SLOT}")
\t\t\t};`,
    },
    {
      name: "same-tabs",
      from: `\t\t\treturn left.channels === right.channels && left.schedule === right.schedule;`,
      to: `\t\t\treturn left.channels === right.channels && left.schedule === right.schedule && left.cloud === right.cloud;`,
    },
    {
      name: "subscribe",
      from: `\t\t\t\t\tconst offSchedule = slots.subscribe("sidebar.schedule", onStoreChange);
\t\t\t\t\treturn () => {
\t\t\t\t\t\toffChannels?.();
\t\t\t\t\t\toffSchedule?.();
\t\t\t\t\t};`,
      to: `\t\t\t\t\tconst offSchedule = slots.subscribe("sidebar.schedule", onStoreChange);
\t\t\t\t\tconst offCloud = slots.subscribe("${SLOT}", onStoreChange);
\t\t\t\t\treturn () => {
\t\t\t\t\t\toffChannels?.();
\t\t\t\t\t\toffSchedule?.();
\t\t\t\t\t\toffCloud?.();
\t\t\t\t\t};`,
    },
    {
      name: "show-flags",
      from: `\t\t\tconst showChannels = companionTabs.channels;
\t\t\tconst showSchedule = companionTabs.schedule;
\t\t\tconst showCompanionTabs = showChannels || showSchedule;`,
      to: `\t\t\tconst showChannels = companionTabs.channels;
\t\t\tconst showSchedule = companionTabs.schedule;
\t\t\tconst showCloud = companionTabs.cloud;
\t\t\tconst showCompanionTabs = showChannels || showSchedule || showCloud;`,
    },
    {
      name: "tab-items",
      from: `\t\t\t\treturn items;
\t\t\t}, [
\t\t\t\tshowChannels,
\t\t\t\tshowSchedule,
\t\t\t\tt
\t\t\t]);`,
      to: `${CLOUD_ITEM}
\t\t\t}, [
\t\t\t\tshowChannels,
\t\t\t\tshowSchedule,
\t\t\t\tshowCloud,
\t\t\t\tt
\t\t\t]);`,
    },
    {
      name: "reset-tab",
      from: `\t\t\t\tif (imTab === "schedule" && !showSchedule) setImTab("tasks");
\t\t\t}, [
\t\t\t\timTab,
\t\t\t\tshowChannels,
\t\t\t\tshowSchedule
\t\t\t]);`,
      to: `\t\t\t\tif (imTab === "schedule" && !showSchedule) setImTab("tasks");
\t\t\t\tif (imTab === "cloud" && !showCloud) setImTab("tasks");
\t\t\t}, [
\t\t\t\timTab,
\t\t\t\tshowChannels,
\t\t\t\tshowSchedule,
\t\t\t\tshowCloud
\t\t\t]);`,
    },
    {
      name: "render-branch",
      from: `\t\t\t\t\t\t\t\t}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\t\t\t\tclassName: "dcu-native-workspaces",
\t\t\t\t\t\t\t\t\tchildren: workspaceSlot
\t\t\t\t\t\t\t\t})]`,
      to: `\t\t\t\t\t\t\t\t}) : imTab === "cloud" && showCloud ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\t\t\t\tclassName: "dcu-native-workspaces",
\t\t\t\t\t\t\t\t\tchildren: renderSlot("${SLOT}", {
\t\t\t\t\t\t\t\t\t\topenSession,
\t\t\t\t\t\t\t\t\t\tt
\t\t\t\t\t\t\t\t\t})
\t\t\t\t\t\t\t\t}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\t\t\t\tclassName: "dcu-native-workspaces",
\t\t\t\t\t\t\t\t\tchildren: workspaceSlot
\t\t\t\t\t\t\t\t})]`,
    },
    {
      name: "locale-zh",
      from: `\t\t\t"sidebar.channelsTab": "频道",`,
      to: `\t\t\t"sidebar.channelsTab": "频道",
\t\t\t"sidebar.cloudTab": "云端",`,
    },
    {
      name: "locale-en",
      from: `\t\t\t"sidebar.channelsTab": "Channels",`,
      to: `\t\t\t"sidebar.channelsTab": "Channels",
\t\t\t"sidebar.cloudTab": "Cloud",`,
    },
  ];
}

function candidateClients(profileDir) {
  const roots = [];
  if (profileDir) roots.push(profileDir);
  if (process.env.DSH_HOME) roots.push(path.join(process.env.DSH_HOME, "profiles", "desktop"));
  roots.push(path.join(os.homedir(), ".dsh", "profiles", "desktop"));
  const files = [];
  for (const root of roots) {
    const direct = path.join(root, "node_modules", PACKAGE, CLIENT);
    files.push(direct);
    const scoped = path.join(root, "node_modules", PACKAGE, "package.json");
    if (fs.existsSync(scoped)) files.push(path.join(path.dirname(scoped), CLIENT));
  }
  return files;
}

function locate(profileDir) {
  for (const file of candidateClients(profileDir)) {
    if (fs.existsSync(file)) {
      let version;
      try {
        version = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(file)), "package.json"), "utf8")).version;
      } catch (error) {
        version = undefined;
      }
      return { file, version };
    }
  }
  return null;
}

/** 只改内存副本；任何一条锚点缺失就整体放弃，绝不写半截补丁。 */
function patchSource(source, list) {
  let next = source;
  const missing = [];
  for (const edit of list === undefined ? edits() : list) {
    if (!next.includes(edit.from)) {
      missing.push(edit.name);
      continue;
    }
    next = next.replace(edit.from, () => edit.to);
  }
  return { ok: missing.length === 0, missing, next };
}

function syntaxCheck(source) {
  const tmp = path.join(os.tmpdir(), "dsh-cloud-codex-check-" + process.pid + ".mjs");
  fs.writeFileSync(tmp, source);
  try {
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String((error && error.stderr) || (error && error.message) || error).split("\n").slice(0, 3).join(" | ") };
  } finally {
    try { fs.unlinkSync(tmp); } catch (error) { /* ignore */ }
  }
}

/**
 * 给 codex-ui 打一处可恢复的本地补丁：让它多出一个由 "sidebar.cloud" 插槽驱动的伙伴页签。
 * 返回 {status, ...}，status ∈ patched | already | skipped | reverted | missing。
 */
function ensureCodexTabSupport(options) {
  const opts = options || {};
  const found = locate(opts.profileDir);
  if (found === null) return { status: "missing", reason: "没有找到 " + PACKAGE };
  const backupPath = path.join(path.dirname(found.file), BACKUP);

  if (opts.revert) {
    if (!fs.existsSync(backupPath)) return { status: "skipped", reason: "没有备份可还原", path: found.file };
    fs.copyFileSync(backupPath, found.file);
    return { status: "reverted", path: found.file, version: found.version };
  }

  const source = fs.readFileSync(found.file, "utf8");
  const needTabs = !source.includes(MARK);
  const needMenu = !source.includes(MENU_MARK);
  if (!needTabs && !needMenu) return { status: "already", path: found.file, version: found.version };

  let next = source;
  const missing = [];
  const groups = [];
  if (needTabs) groups.push({ name: "tab", list: edits() });
  if (needMenu) groups.push({ name: "menu", list: menuEdits() });
  for (const group of groups) {
    const result = patchSource(next, group.list);
    if (!result.ok) missing.push(...result.missing);
    next = result.next;
  }
  if (missing.length > 0) return { status: "skipped", reason: "版本不匹配，缺少锚点：" + missing.join(","), path: found.file, version: found.version };
  const result = { ok: true, next };

  const check = syntaxCheck(result.next);
  if (!check.ok) return { status: "skipped", reason: "补丁后语法检查失败：" + check.reason, path: found.file, version: found.version };

  if (!fs.existsSync(backupPath)) fs.copyFileSync(found.file, backupPath);
  const tmpPath = found.file + ".dsh-cloud-tmp";
  fs.writeFileSync(tmpPath, result.next);
  fs.renameSync(tmpPath, found.file);
  return { status: "patched", path: found.file, backup: backupPath, version: found.version };
}

export { ensureCodexTabSupport, locate, patchSource, edits, menuEdits, SLOT, PACKAGE };
