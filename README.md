# dsh-icloud-sync

Keep your DeepSeek Harness setup in step across Macs through iCloud Drive — profiles, plugin
manifests, skills — with a **Settings → Integrations** panel, a **云端** tab next to 任务 / 频道
that pushes and pulls single session snapshots on demand, and a CLI bundled inside the package. A
fresh Mac needs no terminal: install the plugin, open the panel, click **从云端接入**.

## What it syncs

Synced, from `~/.dsh/profiles/<profile>/` plus skills:

- `cordis.patch.yml`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dsh-market/state.json`
- `~/.agents/skills/**`

Session logs are **not** part of that bundle: upload them from the conversation's own action strip
(上传到 iCloud, next to 复制 / 好的回答 / 有问题的回答) and download or delete them from the 云端 tab
(see below).

Never synced: `node_modules`, runtimes, caches, stored credentials, the DSH app itself. Plugins
reinstall from `package.json` + `pnpm-lock.yaml` on each Mac.

## How it stays safe

- The cloud holds one bundle: `DSH-Sync/current/` (files plus `manifest.tsv`).
- Every Mac keeps a `base` copy in `~/.dsh/.icloud-sync/base/`, the last state both sides agreed on.
- Each run compares local / cloud / base, so "only local changed", "only cloud changed", and "both
  changed" are distinguishable. When both changed the run refuses to overwrite; review with
  `dsh-sync diff` and then `push --force` or `pull --force`.
- `manifest.tsv` is written last, so half-downloaded iCloud files never look like deletions.
- Every push/pull backs up first: 20 local copies, 30 cloud copies.

## Session sync（conversation strip + 云端 tab）

The session rail has four tabs: **任务**, **频道**, **云端**, **日程**. Syncing is manual and split in
two. **Uploading** starts inside the conversation itself: open a session, and the assistant action
strip (the row with 复制 / 好的回答 / 有问题的回答) carries an 上传到 iCloud button, available as soon
as the project is not running. The **云端** tab is the iCloud side: it lists only the sessions that
exist in iCloud and offers 下载 and 删除云端. Sessions that live only on this Mac never show up there.

- Every row shows title, project, last activity, size and one of four states: 已上传 / 未上传 /
  云端更新 / 仅云端.
- **上传到 iCloud** overwrites the cloud snapshot of that session; the previous snapshot moves to
  `DSH-Sync/history/sessions/<timestamp>-<machine>/` and is never deleted. Uploading a session that
  is still open snapshots only the messages already written to disk.
- **下载** overwrites the local copy; the local previous copy moves to
  `~/.dsh/.icloud-sync/backups/sessions/<timestamp>/`. After a refresh the session shows up under
  任务 again and continues from where it stopped. Download never writes inside the iCloud folder.
- **删除云端** removes only the iCloud copy, archiving it under
  `DSH-Sync/history/sessions/<timestamp>-<machine>/`; the local log and every other Mac stay intact.
- Download is disabled while the session is open (运行中) — close it first. Nothing is uploaded or
  downloaded automatically, on a timer or otherwise.
- There is no conflict state any more: overwrite is the contract and the losing copy is archived.
- Attachments are not transferred together with a session yet; pasted images can be missing on the
  other Mac.

Cloud layout: `DSH-Sync/cloud/sessions/<project-key>/session-<uuid>/` holding
`session.v4.jsonl.zstd` and `meta.json`; overwritten copies land in `DSH-Sync/history/sessions/`.

### The 云端 tab needs a tiny codex-ui patch

The sidebar is drawn by `@michengai/dsh-codex-ui`, which hardcodes its 任务 / 频道 / 日程 tabs, so a
third-party plugin cannot add a tab through the public slot API. On first start this plugin therefore
applies one small, reversible local patch to that package (`lib/codex-sidebar-tab.js`): it declares a
`sidebar.cloud` slot and renders its occupants as one more companion tab. Nothing else in codex-ui is
touched, the patched bundle is syntax-checked before it is written, and the untouched original stays
at `lib/client.js.before-dsh-cloud`.

- The patch is re-applied automatically after a codex-ui upgrade, and skipped (with a warning) if the
  anchors changed — a skipped patch only loses the tab, never the plugin.
- `dsh-sync codex-tab status` shows whether it is applied; `dsh-sync codex-tab revert` restores the
  original file. Both work without restarting DSH.
- To stop using the patch entirely, run the revert command or remove the call in `index.js`; the
  settings panel and CLI keep working either way.

## Install

```bash
dsh plugin --profile desktop add github:mkoalade/dsh-icloud-sync
```

The package ships straight from GitHub (`github:mkoalade/dsh-icloud-sync`), so the `github:` form
above is the canonical one — pnpm in the profile takes git specifiers as-is. Replace `desktop` with
your profile name. Restart DSH if the panel does not appear; it lives at
**Settings → Integrations → iCloud 同步**.

The package ships its own patch row, so installation mounts the plugin — there is no second step
and no `~/.local/bin` requirement, because the CLI is bundled as `bin/dsh-sync`.

## First Mac: publish your setup

Quit DSH completely first, then use the panel (**创建同步包** / **立即同步**) or the CLI:

```bash
dsh-sync init      # create DSH-Sync/current in iCloud from this Mac
dsh-sync status    # confirm the bundle exists
dsh-sync agent on  # optional: sync on login and every 15 minutes
```

`init` also copies the script to `DSH-Sync/bin/dsh-sync`, so another Mac can bootstrap from iCloud
without this package.

## Another Mac: join

1. Install DSH (same or nearby version), start it once so the profile directory exists, quit it.
2. Wait until iCloud has downloaded `DSH-Sync`.
3. Install this plugin (the `pull` step does not install it for you — it only writes profile files):

```bash
dsh plugin --profile desktop add github:mkoalade/dsh-icloud-sync
```

4. Run the cloud copy of the CLI, or press **Pull from cloud** in the panel:

```bash
bash "$HOME/Library/Mobile Documents/com~apple~CloudDocs/DSH-Sync/bin/dsh-sync" pull
```

The first `pull` backs up the local profile, writes the cloud files, then reinstalls plugins from
`package.json` / `pnpm-lock.yaml` (`--no-install` skips that step). Restart DSH afterwards — the
cloud tab and its codex-ui patch are applied on the plugin's next start.

To make joining automatic, set `autoPull: true` in the plugin row config: on boot, a Mac that is not
joined yet but sees an initialized cloud bundle runs one `pull` by itself.

```yaml
- insert:
    - id: dsh-icloud-sync
      name: 'dsh-icloud-sync'
      config:
        autoPull: true
```

## Configuration

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `autoPull` | boolean | `false` | On boot, run one `pull` when the cloud bundle exists and this Mac has not joined yet. |
| `syncBin` | string | `""` | Absolute path to a different `dsh-sync` script, overriding the bundled copy. |

`DSH_ICLOUD_SYNC_BIN` wins over both. Resolution order: environment, `syncBin`, bundled
`bin/dsh-sync`, `~/.local/bin/dsh-sync`, `DSH-Sync/bin/dsh-sync` in iCloud.

## CLI

```
dsh-sync status              compare local, cloud, and base
dsh-sync push [--force]      upload local changes
dsh-sync pull [--force]      download cloud changes
dsh-sync sync                push, then pull
dsh-sync init                create the cloud bundle from this Mac
dsh-sync diff <path>         show the textual diff for one file
dsh-sync doctor              check iCloud, bundle integrity, and state
dsh-sync open                reveal DSH-Sync in Finder
dsh-sync agent on|off|status login and 15-minute background sync
```

`--dry-run` previews, `--quiet` trims output, `--no-install` skips plugin installation. The
background agent only uploads local changes; it never downloads while DSH is running. Session logs
are not handled by the CLI at all — upload them from the conversation's action strip, download or
delete them in the 云端 tab.

## Requirements

macOS with iCloud Drive enabled, a DSH profile that has started at least once, and the same or a
nearby DSH version on each Mac. The CLI is bash 3.2-compatible and needs no runtime.

## Known limits

- The panel is Chinese-only for now; `locale/en.json` and `locale/zh.json` carry the plugin's market
  title and description.
- Downloading a profile while DSH runs cannot take effect until DSH restarts.
- Credentials stay local: `~/.dsh/.credentials` is never uploaded.
- Sessions transfer without their attachments. Uploading a session that is still open captures only
  the messages already flushed to disk.

## License

MIT.

---

# dsh-icloud-sync（中文）

通过 iCloud Drive 在多台 Mac 之间同步 DeepSeek Harness 的配置、插件清单和 Skills，并在
**设置 → 集成** 里提供面板、在侧栏「任务 / 频道」之后多一个「云端」页签，按需手动上传/下载
单个会话快照。命令行工具随包分发，新电脑装完插件即可在界面里一键接入，不需要先开终端。

## 同步范围

- `~/.dsh/profiles/desktop/` 下的 `cordis.patch.yml`、`package.json`、`pnpm-lock.yaml`、
  `pnpm-workspace.yaml`、`.dsh-market/state.json`
- `~/.agents/skills/**`

会话记录**不在**这个同步包里：它们只在「云端」页签里点「上传 / 下载」时才移动（见下文）。

不同步：`node_modules`、运行时、缓存、登录凭据、DSH 本体。插件在每台 Mac 上按
`package.json` + `pnpm-lock.yaml` 各自安装。

## 会话同步（会话操作条 + 云端页签）

侧栏现在是「任务 / 频道 / 云端 / 日程」四个页签。同步完全手动，分为两半：**上传**在对话里发起——
打开会话后，助手消息操作条（也就是「复制 / 好的回答 / 有问题的回答」那一行）最右边有「上传到
iCloud」按钮，项目没在运行时就能点；**云端**页签是 iCloud 侧，只列出 iCloud 里真实存在的会话，
负责「下载」和「删除云端」。只在本机、还没上传过的会话不会出现在这里。

- 每行显示标题、项目、最后活动时间、大小，以及四种状态之一：已上传 / 未上传 / 云端更新 / 仅云端。
- **上传到 iCloud**（在会话操作条里）：用本机版本覆盖这个会话的云端快照；上一版移入
  `DSH-Sync/history/sessions/<时间>-<机器>/`，不会删。会话还开着时上传，只包含已经落盘的消息。
- **下载**（云端页签）：用云端版本覆盖本机会话；本机上一版移入
  `~/.dsh/.icloud-sync/backups/sessions/<时间>/`。刷新后任务列表里能看到它，接着上次的对话继续。
  下载不会写云端任何文件。
- **删除云端**：只移除 iCloud 里的这份副本，并归档到
  `DSH-Sync/history/sessions/<时间>-<机器>/`；本机和其它 Mac 不受影响。
- 会话在运行中（「运行中」）时不能下载——先结束/关闭它。没有任何定时上传、自动导入或后台扫描。
- 不再有冲突概念：覆盖就是约定，落选的那份一定备份。
- 附件暂时不随会话传输；另一台机器上，会话里粘贴过的图片可能缺失。

云端布局：`DSH-Sync/cloud/sessions/<项目key>/session-<uuid>/`，内含 `session.v4.jsonl.zstd` 和
`meta.json`；被覆盖的旧版落在 `DSH-Sync/history/sessions/`。

### 「云端」页签需要对 codex-ui 打一个小补丁

侧栏是 `@michengai/dsh-codex-ui` 画的，它把「任务 / 频道 / 日程」三个页签写死了，第三方插件无法通过
公开插槽自己加页签。因此插件首次启动时会给这个包打一处小而可还原的本地补丁
（`lib/codex-sidebar-tab.js`）：声明一个 `sidebar.cloud` 插槽，并把插槽里的组件渲染成第四个伙伴页签。
codex-ui 的其它代码一行没动；补丁写盘前会做语法检查，原始文件保留在
`lib/client.js.before-dsh-cloud`。

- codex-ui 升级后补丁会自动重打；如果锚点变了就跳过并打警告——跳过只会少一个页签，不会弄坏插件。
- `dsh-sync codex-tab status` 查看补丁状态，`dsh-sync codex-tab revert` 还原原文件，都不用重启 DSH。
- 想彻底不用补丁：执行 revert，或删掉 `index.js` 里的调用；设置面板和 CLI 照常工作。

## 安装

```bash
dsh plugin --profile desktop add github:mkoalade/dsh-icloud-sync
```

包直接从 GitHub 安装（没有发布到 npm），所以用上面的 `github:` 形式。装好后打开 **设置 → 集成 → iCloud 同步**。插件自带 `cordis.patch.yml`，装包时自动挂载，不需要
再跑 `install.sh`，也不要求 `~/.local/bin` 里有脚本——CLI 就在包内的 `bin/dsh-sync`。

## 第一台 Mac：发布

先完全退出 DSH，然后在面板里点「创建同步包」，或：

```bash
dsh-sync init
dsh-sync agent on   # 可选：登录时 + 每 15 分钟自动同步
```

## 新电脑：接入

1. 装好 DSH 并启动一次，让 profile 目录生成，然后完全退出 DSH。
2. 等 iCloud 下载完 `DSH-Sync`。
3. 先装本插件（`pull` 只写 profile 文件，不会替你装它）：

```bash
dsh plugin --profile desktop add github:mkoalade/dsh-icloud-sync
```

4. 在面板里点「从云端接入」，或直接运行云端脚本：

```bash
bash "$HOME/Library/Mobile Documents/com~apple~CloudDocs/DSH-Sync/bin/dsh-sync" pull
```

首次 `pull` 会先备份本机配置，再写入云端内容，并按清单安装插件（含 codex-ui）。完成后完全重启
DSH——云端页签和 codex-ui 补丁在插件下一次启动时才生效。若想全自动，
在插件配置里加 `autoPull: true`，启动时检测到「云端有包、本机未接入」就自动拉一次。

## 配置项

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `autoPull` | boolean | `false` | 启动时若云端已有同步包而本机未接入，自动 `pull` 一次。 |
| `syncBin` | string | `""` | 指定另一个 `dsh-sync` 脚本的绝对路径。 |

脚本查找顺序：`DSH_ICLOUD_SYNC_BIN` 环境变量 → `syncBin` → 包内 `bin/dsh-sync` →
`~/.local/bin/dsh-sync` → iCloud 里的 `DSH-Sync/bin/dsh-sync`。

会话记录由插件自己的后台循环同步（即「云端」页签），不走 `dsh-sync` 脚本。

## 常见问题

- 面板里「从云端下载」在 DSH 运行时不会即时生效，重启后才是新配置。
- 冲突时界面不会自动覆盖：先 `dsh-sync diff` 看清差异，再决定 `push --force` 还是 `pull --force`。
- `~/.local/bin/dsh-sync` 是可选的终端入口；在面板里点「安装到 ~/.local/bin」即可复制。

## 许可

MIT。
