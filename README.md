# dsh-icloud-sync

Keep your DeepSeek Harness setup and conversation history in step across Macs through iCloud
Drive — profiles, plugin manifests, skills, and every session — with a **Settings → Integrations**
panel, a **云端** tab next to 任务 / 频道, and a CLI bundled inside the package. A fresh Mac needs
no terminal: install the plugin, open the panel, click **从云端接入**.

## What it syncs

Synced, from `~/.dsh/profiles/<profile>/` plus skills:

- `cordis.patch.yml`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dsh-market/state.json`
- `~/.agents/skills/**`
- `~/.dsh/sessions/**` — the full session history of every project
- `~/.dsh/attachments/**` — files pasted into those sessions

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

## Session sync（云端 tab）

The session rail now has three tabs: **任务**, **频道**, **云端**. The 云端 tab lists every session
on both sides with its state — 已同步 / 待上传 / 待下载 / 冲突 / 仅云端 — plus a one-click
**立即同步**.

- A session uploads after it has been quiet for 20 seconds; a background pass also runs every 60
  seconds while DSH is open.
- A session that exists only in iCloud is copied into `~/.dsh/sessions`, so it shows up under 任务
  automatically; **导入** opens it right away. Nothing on the local side is overwritten by an
  import.
- Both sides changed → the cloud file is kept as `session.v4@<machine>.jsonl.zstd` and the tab
  offers **保留本机** / **保留云端**. The losing copy goes to `~/.dsh/.icloud-sync/session-backups/`
  and `DSH-Sync/history/`, never to the bin.
- A session that is open in the current DSH process is never overwritten or auto-imported; the tab
  shows 待关闭会话 until you close it.
- Cloud layout: `DSH-Sync/cloud/sessions/<project-key>/session-<uuid>/` holding
  `session.v4.jsonl.zstd`, `session.v4@<machine>.jsonl.zstd` (conflicts only), `meta.json`, and
  `sync.json`.

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
background agent only uploads local changes; it never downloads while DSH is running. Session
history is handled by the plugin's own loop (the 云端 tab), not by the CLI.

## Requirements

macOS with iCloud Drive enabled, a DSH profile that has started at least once, and the same or a
nearby DSH version on each Mac. The CLI is bash 3.2-compatible and needs no runtime.

## Known limits

- The panel is Chinese-only for now; `locale/en.json` and `locale/zh.json` carry the plugin's market
  title and description.
- Downloading a profile while DSH runs cannot take effect until DSH restarts.
- Credentials stay local: `~/.dsh/.credentials` is never uploaded. Sessions sync only while DSH is
  running on at least one Mac.

## License

MIT.

---

# dsh-icloud-sync（中文）

通过 iCloud Drive 在多台 Mac 之间同步 DeepSeek Harness 的配置、插件清单、Skills 和全部会话
记录，并在 **设置 → 集成** 里提供面板、在侧栏「任务 / 频道」之后多一个「云端」页签。命令行
工具随包分发，新电脑装完插件即可在界面里一键接入，不需要先开终端。

## 同步范围

- `~/.dsh/profiles/desktop/` 下的 `cordis.patch.yml`、`package.json`、`pnpm-lock.yaml`、
  `pnpm-workspace.yaml`、`.dsh-market/state.json`
- `~/.agents/skills/**`
- `~/.dsh/sessions/**` —— 所有项目的完整会话记录
- `~/.dsh/attachments/**` —— 会话里粘贴的附件

不同步：`node_modules`、运行时、缓存、登录凭据、DSH 本体。插件在每台 Mac 上按
`package.json` + `pnpm-lock.yaml` 各自安装。

## 会话同步（云端页签）

侧栏现在是「任务 / 频道 / 云端」三个页签。「云端」列出两台 Mac 上全部会话及状态
（已同步 / 待上传 / 待下载 / 冲突 / 仅云端），并有一个「立即同步」按钮。

- 会话安静 20 秒后上传；DSH 开着时后台每 60 秒扫一次。
- 只在云端存在的会话会自动复制进 `~/.dsh/sessions`，因此任务列表里也能看到；点「导入」直接打开。
  导入不会覆盖本机已有会话。
- 两边都改过 → 云端文件保留为 `session.v4@<机器名>.jsonl.zstd`，页签里选「保留本机」或
  「保留云端」；落选的一份备份到 `~/.dsh/.icloud-sync/session-backups/` 和 `DSH-Sync/history/`，
  不会直接删掉。
- 当前 DSH 进程里开着的会话不会被覆盖或自动导入，页签显示「待关闭会话」，关掉后再同步。
- 云端布局：`DSH-Sync/cloud/sessions/<项目key>/session-<uuid>/`，内含
  `session.v4.jsonl.zstd`、`session.v4@<机器名>.jsonl.zstd`（仅冲突时）、`meta.json`、`sync.json`。

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
