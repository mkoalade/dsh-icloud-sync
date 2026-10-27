# dsh-icloud-sync

Keep your DeepSeek Harness setup in step across Macs through iCloud Drive — profiles, plugin
manifests, and skills — with a **Settings → Integrations** panel and a CLI bundled inside the
package. A fresh Mac needs no terminal: install the plugin, open the panel, click **从云端接入**.

## What it syncs

Synced, from `~/.dsh/profiles/<profile>/` plus skills:

- `cordis.patch.yml`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.dsh-market/state.json`
- `~/.agents/skills/**`

Never synced: `node_modules`, runtimes, caches, sessions, attachments, stored credentials, the DSH
app itself. Plugins reinstall from `package.json` + `pnpm-lock.yaml` on each Mac.

## How it stays safe

- The cloud holds one bundle: `DSH-Sync/current/` (files plus `manifest.tsv`).
- Every Mac keeps a `base` copy in `~/.dsh/.icloud-sync/base/`, the last state both sides agreed on.
- Each run compares local / cloud / base, so "only local changed", "only cloud changed", and "both
  changed" are distinguishable. When both changed the run refuses to overwrite; review with
  `dsh-sync diff` and then `push --force` or `pull --force`.
- `manifest.tsv` is written last, so half-downloaded iCloud files never look like deletions.
- Every push/pull backs up first: 20 local copies, 30 cloud copies.

## Install

```bash
dsh plugin --profile desktop add dsh-icloud-sync
```

Replace `desktop` with your profile name. Restart DSH if the panel does not appear; it lives at
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
3. Install this plugin and use the panel, or run the cloud copy directly:

```bash
bash "$HOME/Library/Mobile Documents/com~apple~CloudDocs/DSH-Sync/bin/dsh-sync" pull
```

The first `pull` backs up the local profile, writes the cloud files, then reinstalls plugins from
`package.json` / `pnpm-lock.yaml` (`--no-install` skips that step). Restart DSH afterwards.

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
background agent only uploads local changes; it never downloads while DSH is running.

## Requirements

macOS with iCloud Drive enabled, a DSH profile that has started at least once, and the same or a
nearby DSH version on each Mac. The CLI is bash 3.2-compatible and needs no runtime.

## Known limits

- The panel is Chinese-only for now; `locale/en.json` and `locale/zh.json` carry the plugin's market
  title and description.
- Downloading a profile while DSH runs cannot take effect until DSH restarts.
- Only the five profile files above and skills are synced by design; sessions and credentials stay
  local.

## License

MIT.

---

# dsh-icloud-sync（中文）

通过 iCloud Drive 在多台 Mac 之间同步 DeepSeek Harness 的配置、插件清单和 Skills，并在
**设置 → 集成** 里提供面板。命令行工具随包分发，新电脑装完插件即可在界面里一键接入，
不需要先开终端。

## 同步范围

- `~/.dsh/profiles/desktop/` 下的 `cordis.patch.yml`、`package.json`、`pnpm-lock.yaml`、
  `pnpm-workspace.yaml`、`.dsh-market/state.json`
- `~/.agents/skills/**`

不同步：`node_modules`、运行时、缓存、会话、附件、登录凭据、DSH 本体。插件在每台 Mac 上按
`package.json` + `pnpm-lock.yaml` 各自安装。

## 安装

```bash
dsh plugin --profile desktop add dsh-icloud-sync
```

装好后打开 **设置 → 集成 → iCloud 同步**。插件自带 `cordis.patch.yml`，装包时自动挂载，不需要
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
3. 装本插件，在面板里点「从云端接入」；或直接运行云端脚本：

```bash
bash "$HOME/Library/Mobile Documents/com~apple~CloudDocs/DSH-Sync/bin/dsh-sync" pull
```

首次 `pull` 会先备份本机配置，再写入云端内容，并按清单安装插件。完成后重启 DSH。若想全自动，
在插件配置里加 `autoPull: true`，启动时检测到「云端有包、本机未接入」就自动拉一次。

## 配置项

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `autoPull` | boolean | `false` | 启动时若云端已有同步包而本机未接入，自动 `pull` 一次。 |
| `syncBin` | string | `""` | 指定另一个 `dsh-sync` 脚本的绝对路径。 |

脚本查找顺序：`DSH_ICLOUD_SYNC_BIN` 环境变量 → `syncBin` → 包内 `bin/dsh-sync` →
`~/.local/bin/dsh-sync` → iCloud 里的 `DSH-Sync/bin/dsh-sync`。

## 常见问题

- 面板里「从云端下载」在 DSH 运行时不会即时生效，重启后才是新配置。
- 冲突时界面不会自动覆盖：先 `dsh-sync diff` 看清差异，再决定 `push --force` 还是 `pull --force`。
- `~/.local/bin/dsh-sync` 是可选的终端入口；在面板里点「安装到 ~/.local/bin」即可复制。

## 维护者：发布

```bash
bash scripts/release.sh <你的 GitHub 用户名>   # 写 repository 字段、生成市场提交文件、本地提交
npm publish --access public
```

之后按 [PUBLISH.zh.md](PUBLISH.zh.md) 建仓库、打 `dsh-plugin` topic，并把
`submission/<owner>__dsh-icloud-sync.yml` 作为 `data/plugins/<owner>__dsh-icloud-sync.yml`
提交到 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。

## 许可

MIT。
