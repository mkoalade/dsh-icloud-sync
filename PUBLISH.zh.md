# 发布与分发 / Publishing dsh-icloud-sync

当前分发方式：**只走 GitHub**（用户明确选择「只发布到 GitHub」，不发布 npm 包）。

- 仓库：<https://github.com/mkoalade/dsh-icloud-sync>（public，已打 `dsh-plugin` topic）
- 安装：`dsh plugin --profile desktop add github:mkoalade/dsh-icloud-sync`
- 已实测：`npm pack github:mkoalade/dsh-icloud-sync` 生成与本地 `npm pack` 完全一致的 10 文件包
  （26.8 kB），说明 git 安装路径可用。

## 已完成的发布步骤

1. `bash scripts/release.sh mkoalade`：把 `repository` / `homepage` / `bugs` 写进 `package.json`，
   生成 `submission/mkoalade__dsh-icloud-sync.yml`，本地提交。
2. 建仓库、推送 `main`（commit `ff74b9c dsh-icloud-sync 1.0.0`；1.1.0 增加自动会话同步，1.2.0 改为手动中转，1.3.0 把会话上传挪进对话操作条、云端页签只管下载/删除，1.4.0 项目整体上传/下载，1.5.0 项目右键菜单，1.6.0 项目文件随会话一起同步，1.6.1 修右键菜单点完不收）。
3. 给仓库加 topics：`dsh-plugin`、`deepseek-harness`、`dsh`、`icloud`、`macos`、`sync`。

## 发新版本

```bash
cd "$HOME/Documents/untitled folder/dsh-icloud-sync"
# 改代码后先把 package.json 的 version 提一位（例如 1.0.1）
git add -A
git commit -m "dsh-icloud-sync 1.0.1"
git tag v1.0.1
git push origin main --tags
```

`dsh plugin add github:...` 默认跟随默认分支的最新提交，所以推送后用户重装即拿到新版；
想锁定版本可以写成 `github:mkoalade/dsh-icloud-sync#v1.0.1`。

## 可选：以后想发布到 npm

```bash
npm login            # 浏览器授权一次
npm publish --access public
```

发布后用户就能用包名安装：`dsh plugin --profile desktop add dsh-icloud-sync`。

## 可选：提交到插件市场（awesome-dsh-plugin）

市场索引由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 生成，
用户添加索引源 `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` 后可见。规则里两条是
CI 自动校验的：

- 仓库要**建满 1 天**（刚建好的 PR 会被拒，隔天重提即可，没有惩罚）。
- 仓库要有 `dsh-plugin` topic。

投稿只改一个文件：把 `submission/mkoalade__dsh-icloud-sync.yml` 放到上游
`data/plugins/mkoalade__dsh-icloud-sync.yml`，README 由脚本生成，不要手改。
注意索引条目一般按 npm 包名安装；若要进索引，大概率需要先发布 npm 包（未验证）。

## 你本机现在的状态

为了验证，这个包已经手工挂进 `~/.dsh/profiles/desktop/node_modules/dsh-icloud-sync/`，
`~/.dsh/cordis.patch.yml` 只 mount 了它（原文件备份在 `~/.dsh/cordis.patch.yml.bak`）。
想换成正规安装：

```bash
dsh plugin --profile desktop add github:mkoalade/dsh-icloud-sync
```

## 已知限制（v1）

- 面板文案目前全中文（`locale/en.json` 只有元数据，`client.js` 里的字符串还没接 i18n）。
- 只在 macOS 上声明可用（`os: ["darwin"]`），同步脚本依赖 iCloud 云盘路径。
- 浏览器端渲染没法在这台机器上截图验证（`dsh web` 页面需要启动时打印的访问令牌）；宿主侧路由
  与客户端 bundle 已用 HTTP 实测：`/dsh-icloud-sync/status` 200，
  `plugins/??dsh-icloud-sync/client.js&rev=...` 200 / 29978 字节。
