# 发布指引 / Publishing dsh-icloud-sync

这个目录已经是一份可发布的 npm 包 + 可提交到插件市场的仓库。**只剩登录你自己的账号这一步**：本机的 npm 未登录、没有 `gh`、git 身份为空。

## 已经验证过的

- `npm pack` / `npm publish --dry-run` 均通过：10 个文件、26.5 kB（解包 92.5 kB）。
- npm 上 `dsh-icloud-sync` 当前未被占用（`npm view` 返回 404），无 scope 名字可用。
- `package.json` 声明了 `dsh.bundle`（市场收录的硬性要求）+ `dsh.client`（设置面板）。
- `cordis.patch.yml` 自带插入行，装完即挂载，不需要第二次手工配置。
- 在本机按「市场安装后的样子」挂载过：`/dsh-icloud-sync/status` 返回 200，`scriptSource: bundled`，`install-cli` 动作成功写入 `~/.local/bin/dsh-sync`。
- 包内 `bin/dsh-sync` 与 `index.js`、`client.js` 的语法检查通过。

## 1. 写仓库地址（一条命令，替换 `<你的GitHub用户名>`）

```bash
cd "$HOME/Documents/untitled folder/dsh-icloud-sync"
bash scripts/release.sh <你的GitHub用户名>
```

它会：把 `repository` / `homepage` / `bugs` 写进 `package.json`；生成提交给市场的 `submission/<owner>__dsh-icloud-sync.yml`；本地 `git init` 并提交一次。

如果它提示 git 身份为空，先在终端跑一次：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

## 2. 发到 npm

```bash
cd "$HOME/Documents/untitled folder/dsh-icloud-sync"
npm login            # 浏览器授权一次
npm publish --access public
```

发布后任何人都可以：`dsh plugin --profile desktop add dsh-icloud-sync`。

## 3. 建 GitHub 仓库并推送

浏览器打开 https://github.com/new ，仓库名 `dsh-icloud-sync`，**Public**，不要勾 README / .gitignore / license（本地都有了）。然后：

```bash
cd "$HOME/Documents/untitled folder/dsh-icloud-sync"
git remote add origin https://github.com/<你的GitHub用户名>/dsh-icloud-sync.git
git push -u origin main
```

推送完在仓库页面点 **⚙️ Topics**，加上 `dsh-plugin`。

## 4. 提交到插件市场（awesome-dsh-plugin）

市场索引由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 生成，dsh 用户添加索引源 `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` 后就能搜到。

规则里两条是自动校验的：

- 仓库要**建满 1 天**（刚建好的 PR 会被 CI 拒，隔天重新提即可，没有惩罚）。
- 仓库要有 `dsh-plugin` topic。

满足后 fork 上游仓库，把本地的 `submission/<owner>__dsh-icloud-sync.yml` 放到 `data/plugins/<owner>__dsh-icloud-sync.yml`（只需这一个文件，README 由脚本生成，不要手改），提 PR 即可。

## 你本机现在的状态

为了验证，这个包已经手工挂进 `~/.dsh/profiles/desktop/node_modules/dsh-icloud-sync/`，并且 `~/.dsh/cordis.patch.yml` 只 mount 了它（原文件备份在 `~/.dsh/cordis.patch.yml.bak`）。发布之后可以用正规命令覆盖同一位置：

```bash
dsh plugin --profile desktop add dsh-icloud-sync
```

## 已知限制（v1）

- 面板文案目前全中文（`locale/en.json` 只有元数据，`client.js` 里的字符串还没有接 i18n）。
- 只在 macOS 上声明可用（`os: ["darwin"]`），同步脚本依赖 iCloud 云盘路径。
- 浏览器端渲染没法在这台机器上截图验证：`dsh web` 的页面需要启动时打印的访问令牌，命令行拿不到。宿主侧路由与安装流程已经用 HTTP 实测过。