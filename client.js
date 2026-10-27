window.__ModuleLoader__.load({
  id: "dsh-icloud-sync",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const API = "/dsh-icloud-sync";
    const STYLE_ID = "dsh-icloud-sync-style";

    const S = {
      page: {
        maxWidth: 900,
        margin: "0 auto",
        padding: "4px 2px 36px",
        color: "var(--dsw-alias-label-primary)",
        fontSize: 13,
        lineHeight: 1.55
      },
      header: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 16
      },
      iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "1px solid var(--dsw-alias-border-l2)",
        color: "var(--dsw-alias-label-secondary)"
      },
      title: {
        margin: 0,
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: 0
      },
      subtitle: {
        margin: "4px 0 0",
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 12.5
      },
      badge: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 11.5,
        fontWeight: 500,
        lineHeight: 1.7,
        border: "1px solid transparent",
        whiteSpace: "nowrap"
      },
      card: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 12,
        marginBottom: 12,
        overflow: "hidden"
      },
      cardHead: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "13px 16px 0"
      },
      cardTitle: {
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.5
      },
      cardDesc: {
        marginTop: 2,
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 12,
        lineHeight: 1.5
      },
      cardBody: {
        padding: "12px 16px 15px"
      },
      stats: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
        marginBottom: 12
      },
      stat: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 10,
        padding: "11px 13px",
        minWidth: 0
      },
      statLabel: {
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 11.5,
        marginBottom: 3
      },
      statValue: {
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.35,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums"
      },
      statHint: {
        marginTop: 2,
        color: "var(--dsw-alias-label-caption)",
        fontSize: 11,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      },
      row: {
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        padding: "5px 0",
        minWidth: 0
      },
      rowKey: {
        flex: "none",
        width: 74,
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 12
      },
      rowValue: {
        minWidth: 0,
        flex: "1 1 auto",
        overflowWrap: "anywhere"
      },
      path: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11.5,
        color: "var(--dsw-alias-label-secondary)"
      },
      actions: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      },
      btn: {
        appearance: "none",
        border: "1px solid var(--dsw-alias-border-l1)",
        background: "transparent",
        color: "var(--dsw-alias-label-primary)",
        borderRadius: 8,
        padding: "6px 12px",
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: 500,
        lineHeight: "18px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap",
        transition: "background .12s ease, opacity .12s ease"
      },
      btnPrimary: {
        background: "var(--dsw-alias-button-primary-fill)",
        borderColor: "transparent",
        color: "var(--dsw-alias-label-primary-foreground)"
      },
      spin: {
        width: 11,
        height: 11,
        borderRadius: "50%",
        border: "1.5px solid currentColor",
        borderTopColor: "transparent",
        display: "inline-block"
      },
      hint: {
        marginTop: 9,
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 11.5,
        lineHeight: 1.6
      },
      note: {
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-secondary)",
        fontSize: 11.5,
        lineHeight: 1.6
      },
      banner: {
        borderRadius: 10,
        border: "1px solid rgba(239, 68, 68, .35)",
        background: "rgba(239, 68, 68, .08)",
        color: "var(--dsw-alias-label-primary)",
        padding: "10px 12px",
        marginBottom: 12,
        fontSize: 12.5,
        overflowWrap: "anywhere"
      },
      empty: {
        padding: "18px 0",
        textAlign: "center",
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 12
      },
      count: {
        color: "var(--dsw-alias-label-tertiary)",
        fontSize: 11.5,
        whiteSpace: "nowrap",
        paddingTop: 2
      },
      fileGrid: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 62px 62px 120px",
        gap: 8,
        alignItems: "center",
        padding: "6px 6px",
        borderRadius: 6,
        borderBottom: "1px solid var(--dsw-alias-border-l2)",
        minWidth: 0
      },
      fileHead: {
        color: "var(--dsw-alias-label-caption)",
        fontSize: 11,
        paddingTop: 0,
        paddingBottom: 6
      },
      filePath: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11.5,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 0
      },
      hash: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        color: "var(--dsw-alias-label-tertiary)",
        fontVariantNumeric: "tabular-nums"
      },
      pre: {
        margin: 0,
        padding: 10,
        borderRadius: 8,
        background: "var(--dsw-alias-bg-layer-2)",
        border: "1px solid var(--dsw-alias-border-l2)",
        color: "var(--dsw-alias-label-secondary)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11.5,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        maxHeight: 220,
        overflow: "auto"
      },
      footer: {
        margin: "14px 2px 0",
        color: "var(--dsw-alias-label-caption)",
        fontSize: 11,
        lineHeight: 1.65
      }
    };

    const TONES = {
      success: {
        background: "rgba(34, 197, 94, .12)",
        borderColor: "rgba(34, 197, 94, .28)",
        color: "var(--dsw-alias-state-success-primary)"
      },
      warn: {
        background: "rgba(245, 158, 11, .13)",
        borderColor: "rgba(245, 158, 11, .30)",
        color: "var(--dsw-alias-state-warn-label)"
      },
      info: {
        background: "rgba(59, 130, 246, .10)",
        borderColor: "rgba(59, 130, 246, .24)",
        color: "var(--dsw-alias-label-secondary)"
      },
      neutral: {
        background: "var(--dsw-alias-bg-layer-2)",
        borderColor: "var(--dsw-alias-border-l2)",
        color: "var(--dsw-alias-label-tertiary)"
      }
    };

    function ensureStyles() {
      if (document.getElementById(STYLE_ID) !== null) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        ".dsh-icloud-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}",
        ".dsh-icloud-btn.dsh-icloud-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-fill);filter:brightness(1.06);}",
        ".dsh-icloud-btn:focus-visible,.dsh-icloud-switch:focus-visible{outline:2px solid var(--dsw-alias-border-l1);outline-offset:2px;}",
        ".dsh-icloud-row:hover{background:var(--dsw-alias-interactive-bg-hover);}",
        "@keyframes dsh-icloud-spin{to{transform:rotate(360deg);}}",
        ".dsh-icloud-spin{animation:dsh-icloud-spin .8s linear infinite;}",
        "@media (max-width:680px){.dsh-icloud-stats{grid-template-columns:1fr !important;}.dsh-icloud-file-grid{grid-template-columns:minmax(0,1fr) 52px 52px 96px !important;}}"
      ].join("\n");
      document.head.appendChild(style);
    }

    function CloudIcon() {
      return h("svg", {
        viewBox: "0 0 24 24",
        width: 22,
        height: 22,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true"
      }, h("path", { d: "M7.2 18.2a4.2 4.2 0 0 1-.5-8.37A6.1 6.1 0 0 1 18.2 10a3.9 3.9 0 0 1-.5 8.2H7.2Z" }));
    }

    function Badge(props) {
      const tone = TONES[props.tone] || TONES.neutral;
      return h("span", { style: Object.assign({}, S.badge, tone) }, props.children);
    }

    function Button(props) {
      const style = Object.assign({}, S.btn, props.variant === "primary" ? S.btnPrimary : null, props.style || null);
      const className = "dsh-icloud-btn" + (props.variant === "primary" ? " dsh-icloud-primary" : "");
      return h("button", {
        type: "button",
        className,
        style,
        disabled: props.disabled === true || props.busy === true,
        onClick: props.onClick,
        title: props.title
      }, props.busy === true ? h("span", { className: "dsh-icloud-spin", style: S.spin }) : null, props.children);
    }

    function Card(props) {
      const head = props.title !== undefined || props.right !== undefined
        ? h("div", { style: S.cardHead },
            h("div", { style: { minWidth: 0 } },
              props.title !== undefined ? h("div", { style: S.cardTitle }, props.title) : null,
              props.desc !== undefined ? h("div", { style: S.cardDesc }, props.desc) : null),
            props.right !== undefined ? h("div", { style: { flex: "none" } }, props.right) : null)
        : null;
      return h("section", { style: S.card }, head, h("div", { style: S.cardBody }, props.children));
    }

    function Stat(props) {
      return h("div", { style: S.stat },
        h("div", { style: S.statLabel }, props.label),
        h("div", { style: S.statValue, title: props.title || props.value }, props.value),
        props.hint ? h("div", { style: S.statHint, title: props.hint }, props.hint) : null);
    }

    function InfoRow(props) {
      return h("div", { style: S.row },
        h("span", { style: S.rowKey }, props.label),
        h("span", { style: Object.assign({}, S.rowValue, props.mono ? S.path : null) }, props.children));
    }

    function formatTime(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }

    function fileTone(state) {
      if (state.indexOf("冲突") >= 0) return "warn";
      if (state.indexOf("已同步") >= 0) return "success";
      return "info";
    }

    async function getStatus() {
      const response = await fetch(API + "/status", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" }
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok || data === null || data.ok === false) {
        throw new Error(data && data.error ? data.error : "无法读取同步状态（HTTP " + response.status + "）");
      }
      return data;
    }

    async function postAction(action) {
      const response = await fetch(API + "/action", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-dsh-icloud-sync": "1"
        },
        body: JSON.stringify({ action })
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok || data === null || data.ok === false) {
        const error = new Error(data && data.error ? data.error : "操作请求失败（HTTP " + response.status + "）");
        if (data) {
          error.output = data.output;
          error.status = data.status;
        }
        throw error;
      }
      return data;
    }

    function statusBadge(data) {
      if (data === null) return { tone: "neutral", text: "读取中" };
      if (data.joined && !data.initialized) return { tone: "warn", text: "云端同步包缺失" };
      if (!data.initialized) return { tone: "neutral", text: "未创建同步包" };
      if (data.conflicts > 0) return { tone: "warn", text: data.conflicts + " 个冲突" };
      if (data.localChanges > 0 || data.remoteChanges > 0) return { tone: "info", text: "有待同步改动" };
      if (!data.joined) return { tone: "info", text: "可接入" };
      return { tone: "success", text: "已同步" };
    }

    function pendingParts(data) {
      const parts = [];
      if (data.conflicts > 0) parts.push("冲突 " + data.conflicts);
      if (data.localChanges > 0) parts.push("本地 " + data.localChanges);
      if (data.remoteChanges > 0) parts.push("云端 " + data.remoteChanges);
      return parts;
    }

    function ICloudSyncSection() {
      const [data, setData] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [busy, setBusy] = React.useState("");
      const [error, setError] = React.useState("");
      const [output, setOutput] = React.useState("");
      const [showAll, setShowAll] = React.useState(false);
      const aliveRef = React.useRef(true);
      const busyRef = React.useRef(false);

      React.useEffect(function () {
        busyRef.current = busy !== "";
      }, [busy]);

      const load = React.useCallback(async function (silent) {
        if (!silent) setLoading(true);
        try {
          const next = await getStatus();
          if (!aliveRef.current) return;
          setData(next);
          setError("");
        } catch (reason) {
          if (!aliveRef.current) return;
          if (!silent) setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          if (aliveRef.current && !silent) setLoading(false);
        }
      }, []);

      React.useEffect(function () {
        ensureStyles();
        aliveRef.current = true;
        load(false);
        const timer = window.setInterval(function () {
          if (!busyRef.current) load(true);
        }, 30000);
        return function () {
          aliveRef.current = false;
          window.clearInterval(timer);
        };
      }, [load]);

      async function runAction(action, successMessage) {
        if (busy !== "") return;
        setBusy(action);
        setError("");
        setOutput("");
        try {
          const result = await postAction(action);
          if (result.status) setData(result.status);
          setOutput(result.output || successMessage || "操作完成。");
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          if (reason && reason.output) setOutput(reason.output);
          if (reason && reason.status) setData(reason.status);
        } finally {
          setBusy("");
          load(true);
        }
      }

      const badge = statusBadge(data);
      const isLoading = loading && data === null;
      const pending = data === null ? [] : pendingParts(data);
      const normalReady = data !== null && data.initialized && data.joined;
      const primary = data === null
        ? { action: "sync", label: "立即同步" }
        : !data.initialized
          ? (data.joined
              ? { action: "doctor", label: "检查同步状态" }
              : { action: "init", label: "创建同步包" })
          : !data.joined
            ? { action: "pull", label: "从云端接入" }
            : { action: "sync", label: "立即同步" };

      const actionHint = data === null
        ? ""
        : !data.initialized
          ? (data.joined
              ? "本机记录显示已接入，但 iCloud 里没有找到同步包。先运行诊断确认云目录和 iCloud 状态。"
              : "会以本机当前配置创建第 1 代同步包并写入 iCloud；之后在另一台 Mac 上执行「从云端接入」。")
          : !data.joined
            ? "首次接入会先备份本机设置，再用云端版本覆盖。建议先退出 DSH，接入完成后再启动。"
            : "「立即同步」会先上传本地改动；DSH 正在运行时不会下载云端改动。下载到插件或配置后需要重启 DSH 生效。";

      const visibleFiles = data === null
        ? []
        : (showAll ? data.files : data.files.slice(0, 8));

      return h("div", { style: S.page },
        h("div", { style: S.header },
          h("div", { style: S.iconBox }, h(CloudIcon)),
          h("div", { style: { flex: "1 1 auto", minWidth: 0 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
              h("h2", { style: S.title }, "iCloud 同步"),
              h(Badge, { tone: badge.tone }, badge.text)),
            h("p", { style: S.subtitle }, "把 DSH 的 profile、插件清单和 Skills 通过 iCloud Drive 同步到你的 Mac。")),
          h(Button, {
            onClick: function () { load(false); },
            disabled: loading || busy !== "",
            style: { flex: "none" }
          }, "刷新状态")),

        error !== "" ? h("div", { style: S.banner, role: "alert" }, error) : null,

        isLoading
          ? h(Card, null, h("div", { style: S.empty }, "正在读取同步状态…"))
          : null,

        data !== null
          ? h("div", null,
              h("div", { className: "dsh-icloud-stats", style: S.stats },
                h(Stat, {
                  label: "云端版本",
                  value: data.initialized ? "第 " + data.generation + " 代" : "—",
                  hint: data.initialized ? "由 " + (data.remoteMachine || "未知设备") + " 发布" : "尚未创建"
                }),
                h(Stat, {
                  label: "上次同步",
                  value: data.lastSync ? formatTime(data.lastSync) : "尚未接入",
                  hint: data.lastSync ? "本机记录的第 " + (data.lastSyncGeneration || "") + " 代" : "运行「从云端接入」"
                }),
                h(Stat, {
                  label: "待处理",
                  value: pending.length === 0 ? (data.initialized && data.joined ? "无" : "—") : pending.length + " 项",
                  hint: pending.length === 0 ? "没有待处理的改动" : pending.join(" · ")
                })),

              h(Card, {
                title: "同步包",
                desc: "iCloud Drive 中的 DSH-Sync 文件夹",
                right: data.cloudExists
                  ? h(Button, {
                      onClick: function () { runAction("open", "已打开 iCloud 文件夹。"); },
                      busy: busy === "open",
                      disabled: busy !== "" && busy !== "open"
                    }, "打开文件夹")
                  : null
              },
                h(InfoRow, { label: "云目录", mono: true }, data.cloud || "—"),
                h(InfoRow, { label: "本机" }, data.machine || "—"),
                h(InfoRow, { label: "云端发布" },
                  data.initialized
                    ? (data.remoteMachine || "未知设备") + " · " + formatTime(data.updatedAt)
                    : "尚未发布"),
                h(InfoRow, { label: "DSH 版本" }, data.dshVersion || "—"),
                data.initialized && !data.joined
                  ? h("div", { style: S.note }, "云端已有同步包，但本机尚未接入。点击「从云端接入」开始。")
                  : null,
                !data.initialized && data.joined
                  ? h("div", { style: Object.assign({}, S.note, { color: "var(--dsw-alias-state-warn-label)" }) }, "本机曾接入同步，但 iCloud 中找不到同步包。可能是云目录被移动、iCloud 尚未下载，或另一台 Mac 重建了同步包。")
                  : null),

              h(Card, {
                title: "命令行工具",
                desc: "插件自带 dsh-sync，新电脑不需要终端",
                right: data.cli.installed
                  ? h(Badge, { tone: "success" }, "已安装")
                  : h(Button, {
                      onClick: function () { runAction("install-cli", "已安装命令行工具。"); },
                      busy: busy === "install-cli",
                      disabled: busy !== ""
                    }, "安装到 ~/.local/bin")
              },
                h(InfoRow, { label: "当前使用", mono: true }, data.cli.path || "—"),
                h(InfoRow, { label: "版本" },
                  "插件内置 " + (data.cli.bundledVersion || "—") +
                  (data.cli.installed ? " · 本机 " + (data.cli.installedVersion || "—") : " · 本机未安装")),
                h("div", { style: S.note },
                  data.cli.source === "bundled"
                    ? "当前运行的是插件内置副本；把它装到 ~/.local/bin 后，终端里的 dsh-sync 也能用。"
                    : "当前运行的是本机已有的 dsh-sync（" + (data.cli.source === "env" ? "环境变量" : data.cli.source === "config" ? "配置项 syncBin" : data.cli.source === "cloud" ? "iCloud 副本" : "~/.local/bin") + "）。")),

              h(Card, {
                title: "操作",
                desc: data.initialized ? "手动同步当前这台 Mac" : "初始化或接入同步"
              },
                h("div", { style: S.actions },
                  h(Button, {
                    variant: "primary",
                    onClick: function () { runAction(primary.action, "操作完成。"); },
                    busy: busy === primary.action,
                    disabled: busy !== ""
                  }, primary.label),
                  h(Button, {
                    onClick: function () { runAction("push", "已上传本地改动。"); },
                    busy: busy === "push",
                    disabled: busy !== "" || !normalReady
                  }, "上传本地改动"),
                  h(Button, {
                    onClick: function () { runAction("pull", "已从云端更新。"); },
                    busy: busy === "pull",
                    disabled: busy !== "" || !data.initialized
                  }, "从云端下载"),
                  h(Button, {
                    onClick: function () { runAction("doctor", "诊断完成。"); },
                    busy: busy === "doctor",
                    disabled: busy !== ""
                  }, "诊断"),
                  h(Button, {
                    onClick: function () { runAction("open", "已打开 iCloud 文件夹。"); },
                    busy: busy === "open",
                    disabled: busy !== "" || !data.cloudExists
                  }, "打开文件夹")),
                h("div", { style: S.hint }, actionHint)),

              output !== ""
                ? h(Card, {
                    title: "操作输出",
                    right: h(Button, { onClick: function () { setOutput(""); }, disabled: busy !== "" }, "清除")
                  }, h("pre", { style: S.pre }, output))
                : null,

              h(Card, {
                title: "自动同步",
                desc: "登录时启动，之后每 15 分钟运行一次",
                right: h("button", {
                  type: "button",
                  role: "switch",
                  "aria-checked": data.agent.enabled,
                  "aria-label": "自动同步",
                  className: "dsh-icloud-switch",
                  disabled: busy !== "",
                  onClick: function () {
                    runAction(data.agent.enabled ? "agent-off" : "agent-on", data.agent.enabled ? "已关闭后台同步。" : "已开启后台同步。");
                  },
                  style: {
                    appearance: "none",
                    border: "1px solid " + (data.agent.enabled ? "transparent" : "var(--dsw-alias-border-l1)"),
                    background: data.agent.enabled ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-bg-layer-3)",
                    width: 42,
                    height: 24,
                    borderRadius: 999,
                    padding: 2,
                    cursor: busy !== "" ? "default" : "pointer",
                    opacity: busy !== "" ? .55 : 1,
                    display: "flex",
                    alignItems: "center",
                    transition: "background .15s ease"
                  }
                }, h("span", {
                  style: {
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: data.agent.enabled ? "#fff" : "var(--dsw-alias-label-tertiary)",
                    transform: data.agent.enabled ? "translateX(18px)" : "translateX(0)",
                    transition: "transform .15s ease",
                    display: "block",
                    boxShadow: "0 1px 2px rgba(0,0,0,.25)"
                  }
                }))
              },
                h("div", { style: { fontSize: 12.5 } },
                  data.agent.enabled ? "已开启" : "未开启",
                  h("span", { style: { color: "var(--dsw-alias-label-tertiary)" } },
                    data.agent.enabled ? " · 每 15 分钟在后台同步" : " · 手动同步不受影响")),
                h("div", { style: S.note },
                  "DSH 运行时后台任务只上传本地改动，不下载云端改动。日志位于 ~/Library/Logs/dsh-sync.log。"),
                h("div", { style: S.note },
                  data.autoPull.enabled
                    ? "已开启「新机自动接入」：DSH 启动时若云端已有同步包而本机未接入，会自动拉取一次，重启后生效。"
                    : "未开启「新机自动接入」。在插件 config 里写 autoPull: true 可让新电脑启动时自动接入。")),

              h(Card, {
                title: "同步的文件",
                desc: "配置、插件清单、Skills 与全部会话",
                right: h("span", { style: S.count }, data.files.length + " 个")
              },
                data.files.length === 0
                  ? h("div", { style: S.empty }, "还没有可显示的文件。")
                  : h("div", null,
                      h("div", { className: "dsh-icloud-file-grid", style: Object.assign({}, S.fileGrid, S.fileHead) },
                        h("span", null, "文件"),
                        h("span", null, "本地"),
                        h("span", null, "云端"),
                        h("span", null, "状态")),
                      visibleFiles.map(function (file) {
                        return h("div", {
                          key: file.path,
                          className: "dsh-icloud-file-grid dsh-icloud-row",
                          style: S.fileGrid
                        },
                          h("span", { style: S.filePath, title: file.path }, file.path),
                          h("span", { style: S.hash }, file.local === "-" ? "—" : file.local),
                          h("span", { style: S.hash }, file.remote === "-" ? "—" : file.remote),
                          h("span", null, h(Badge, { tone: fileTone(file.state) }, file.state)));
                      }),
                      data.files.length > 8
                        ? h("div", { style: { marginTop: 10 } },
                            h(Button, { onClick: function () { setShowAll(!showAll); } },
                              showAll ? "收起" : "显示全部 " + data.files.length + " 个文件"))
                        : null)),

              h("p", { style: S.footer },
                "同步范围：profile 配置、插件清单、Skills 与全部会话（含附件）；不包含 node_modules 与密钥。",
                h("br"),
                "遇到冲突时界面不会强行覆盖；请在终端运行 dsh-sync diff，再决定 push 或 pull 的方向。"))
          : null);
    }


    const CS = {
      panel: {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        padding: "10px 12px 16px",
        color: "var(--dsw-alias-label-primary)",
        fontSize: 12.5,
        lineHeight: 1.5
      },
      head: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flex: "none" },
      headTitle: { fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      chips: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8, flex: "none" },
      list: { display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 0, flex: "1 1 auto", paddingRight: 2 },
      row: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        gap: 8,
        alignItems: "flex-start"
      },
      rowMain: { minWidth: 0, flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 2 },
      rowTitle: { fontSize: 12.5, fontWeight: 550, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      rowMeta: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      rowOps: { display: "flex", gap: 4, alignItems: "center", flex: "none", flexWrap: "wrap", justifyContent: "flex-end" },
      mini: {
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid var(--dsw-alias-border-l1)",
        background: "transparent",
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        fontFamily: "inherit"
      },
      note: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11.5, marginTop: 6, flex: "none" },
      empty: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, padding: "28px 8px", textAlign: "center" },
      footer: { color: "var(--dsw-alias-label-caption)", fontSize: 10.5, marginTop: 8, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    };

    const SESSION_STATUS = {
      synced: { label: "已同步", tone: "success" },
      "local-only": { label: "待上传", tone: "info" },
      "local-newer": { label: "待上传", tone: "info" },
      "cloud-newer": { label: "待下载", tone: "warn" },
      "pending-close": { label: "待关闭会话", tone: "warn" },
      "cloud-only": { label: "仅云端", tone: "info" },
      "cloud-offline": { label: "iCloud 下载中", tone: "neutral" },
      conflict: { label: "冲突", tone: "warn" }
    };

    function formatBytes(size) {
      const value = Number(size) || 0;
      if (value < 1024) return value + " B";
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
      return (value / (1024 * 1024)).toFixed(1) + " MB";
    }

    function shortPath(cwd) {
      if (typeof cwd !== "string" || cwd === "") return "路径未知";
      return cwd.replace(/^\/Users\/[^/]+/, "~");
    }

    function syncNote(actions) {
      const counts = {};
      for (const item of actions || []) {
        if (item === null || item === undefined) continue;
        const key = item.action;
        counts[key] = (counts[key] || 0) + 1;
      }
      const labels = { upload: "上传", import: "导入", download: "下载", conflict: "冲突", defer: "暂缓", error: "出错", "upload-attachment": "附件上传", "download-attachment": "附件下载" };
      const parts = [];
      for (const key of Object.keys(counts)) {
        const label = labels[key] || key;
        parts.push(label + " " + counts[key]);
      }
      return parts.length === 0 ? "本轮没有需要同步的改动。" : parts.join(" · ");
    }

    function CloudSessionsPanel(props) {
      const [state, setState] = React.useState({ loading: true, error: null, data: null });
      const [busy, setBusy] = React.useState("");
      const [note, setNote] = React.useState("");

      const load = React.useCallback(function () {
        return fetch(API + "/cloud", { cache: "no-store", credentials: "same-origin", headers: { accept: "application/json" } })
          .then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok || data === null || data.ok === false) {
                throw new Error(data && data.error ? data.error : "HTTP " + response.status);
              }
              setState({ loading: false, error: null, data: data });
            });
          })
          .catch(function (error) {
            setState({ loading: false, error: error instanceof Error ? error.message : String(error), data: null });
          });
      }, []);

      React.useEffect(function () {
        ensureStyles();
        void load();
        const timer = setInterval(function () {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
          void load();
        }, 15000);
        return function () { clearInterval(timer); };
      }, [load]);

      const act = React.useCallback(function (action, payload, done) {
        const tag = action + (payload && payload.sessionId ? ":" + payload.sessionId : "");
        setBusy(tag);
        setNote("");
        fetch(API + "/cloud/action", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-dsh-icloud-sync": "1" },
          body: JSON.stringify(Object.assign({ action: action }, payload || {}))
        })
          .then(function (response) {
            return response.json().then(function (data) {
              if (!response.ok || data === null || data.ok === false) {
                throw new Error(data && data.error ? data.error : "HTTP " + response.status);
              }
              if (data.snapshot) {
                setState({ loading: false, error: null, data: data.snapshot });
              }
              if (action === "sync" && data.report) setNote(syncNote(data.report.actions));
              if (action === "import" && data.skipped) setNote("本机已有这个会话。");
              if (typeof done === "function") done(data);
            });
          })
          .catch(function (error) {
            setNote(error instanceof Error ? error.message : String(error));
          })
          .finally(function () { setBusy(""); });
      }, []);

      const openSession = React.useCallback(function (sessionId) {
        if (typeof props.openSession === "function") {
          try { props.openSession(sessionId); return; } catch { /* fall through */ }
        }
        setNote("当前页面无法切换会话，请在任务列表里打开。");
      }, [props.openSession]);

      const data = state.data;
      const sessions = data !== null && Array.isArray(data.sessions) ? data.sessions : [];
      const summary = data !== null && data.summary ? data.summary : null;

      function row(session) {
        const status = SESSION_STATUS[session.status] || { label: String(session.status), tone: "neutral" };
        const meta = [shortPath(session.cwd)];
        if (session.updatedAt) meta.push(formatTime(session.updatedAt));
        if (session.size) meta.push(formatBytes(session.size));
        if (session.machine) meta.push(session.machine);
        const ops = [];
        if (session.status === "cloud-only") {
          ops.push(h("button", {
            type: "button",
            style: CS.mini,
            disabled: busy !== "",
            onClick: function () {
              act("import", { sessionId: session.id }, function () {
                if (typeof props.refreshSessions === "function") props.refreshSessions();
                setTimeout(function () { openSession(session.id); }, 350);
              });
            }
          }, "导入"));
        }
        if (session.status === "conflict") {
          ops.push(h("button", {
            type: "button",
            style: CS.mini,
            disabled: busy !== "",
            title: "保留本机版本，覆盖云端",
            onClick: function () { act("resolve", { sessionId: session.id, keep: "local" }, function () { void load(); }); }
          }, "保留本机"));
          ops.push(h("button", {
            type: "button",
            style: CS.mini,
            disabled: busy !== "",
            title: "用云端版本覆盖本机（本机旧版会备份）",
            onClick: function () { act("resolve", { sessionId: session.id, keep: "cloud" }, function () { void load(); }); }
          }, "保留云端"));
        }
        if (session.localPath && session.status !== "cloud-only" && session.status !== "cloud-offline") {
          ops.push(h("button", {
            type: "button",
            style: CS.mini,
            disabled: busy !== "",
            onClick: function () { openSession(session.id); }
          }, "打开"));
        }
        return h("div", { key: session.id, style: CS.row },
          h("div", { style: CS.rowMain },
            h("div", { style: CS.rowTitle, title: session.title }, session.title),
            h("div", { style: CS.rowMeta, title: (session.cwd || "") + (session.machine ? " · " + session.machine : "") }, meta.join(" · "))),
          h("div", { style: CS.rowOps },
            h(Badge, { tone: status.tone }, status.label),
            ops.length > 0 ? h("span", { style: { display: "inline-flex", gap: 4 } }, ops) : null));
      }

      const cloudMissing = data !== null && data.cloudExists === false;
      let body;
      if (state.loading && data === null) {
        body = h("div", { style: CS.empty }, "正在读取云端会话…");
      } else if (state.error !== null) {
        body = h("div", { style: Object.assign({}, CS.empty, { color: "var(--dsw-alias-state-warn-label)" }) }, state.error);
      } else if (sessions.length === 0) {
        body = h("div", { style: CS.empty },
          cloudMissing
            ? "iCloud Drive 里还没有 DSH-Sync 目录。点「立即同步」创建。"
            : "还没有会话。首次同步会把本机会话上传到云端。");
      } else {
        body = h("div", { style: CS.list }, sessions.map(row));
      }

      const machine = data !== null && data.machine ? data.machine.name : null;
      return h("div", { style: CS.panel },
        h("div", { style: CS.head },
          h("div", { style: CS.headTitle, title: machine ? "本机：" + machine : null }, "云端"),
          h("div", { style: { flex: "1 1 auto" } }),
          h(Button, { onClick: function () { void load(); }, disabled: busy !== "", title: "刷新列表" }, "刷新"),
          h(Button, {
            variant: "primary",
            onClick: function () { act("sync"); },
            busy: busy === "sync",
            disabled: busy !== "" || cloudMissing
          }, "立即同步")),
        summary !== null
          ? h("div", { style: CS.chips },
              h(Badge, { tone: "success" }, "已同步 " + summary.synced),
              h(Badge, { tone: "info" }, "待上传 " + summary.pendingUpload),
              h(Badge, { tone: summary.pendingDownload > 0 ? "warn" : "neutral" }, "待下载 " + summary.pendingDownload),
              h(Badge, { tone: summary.conflicts > 0 ? "warn" : "neutral" }, "冲突 " + summary.conflicts),
              h(Badge, { tone: "neutral" }, "本机 " + summary.local + " · 云端 " + summary.cloud))
          : null,
        note !== "" ? h("div", { style: Object.assign({}, CS.note, { color: "var(--dsw-alias-label-secondary)" }) }, note) : null,
        body,
        data !== null
          ? h("div", { style: CS.footer, title: data.cloudDir },
              (machine ? machine + " · " : "") + (data.cloudDir || "").replace(/^\/Users\/[^/]+/, "~") +
              (data.at ? " · " + formatTime(data.at) : ""))
          : null);
    }

    /**
     * 云端页签内容。codex-ui 打过 sidebar.cloud 补丁后，会把这里注册的组件当成
     * 第四个伙伴页签渲染，props 带 openSession / t。
     */
    function makeCloudTab(bridge) {
      return function CloudTab(props) {
        const open = (props && (props.openSession || props.open)) || bridge.open;
        return h(CloudSessionsPanel, {
          openSession: open,
          refreshSessions: bridge.refresh
        });
      };
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "icloud-sync",
          order: 25,
          label: function () { return "iCloud 同步"; },
          icon: "cloud"
        }, ICloudSyncSection);
      });

      const bridge = {
        open: function (sessionId) {
          try {
            if (ctx.uiWorkspace && typeof ctx.uiWorkspace.openSession === "function") {
              ctx.uiWorkspace.openSession(sessionId);
              return true;
            }
          } catch (error) {
            // host without a workspace opener
          }
          return false;
        },
        refresh: function () {
          try {
            if (ctx.sessions && typeof ctx.sessions.refresh === "function") ctx.sessions.refresh();
          } catch (error) {
            // older sessions service
          }
        }
      };
      try {
        ctx.slots.inject("sidebar.cloud", function () {
          return ctx.slots.register({
            name: "sidebar.cloud",
            id: "icloud-sync-cloud",
            order: 30,
            label: function () { return "云端"; }
          }, makeCloudTab(bridge));
        });
      } catch (error) {
        console.warn("[dsh-icloud-sync] 云端页签挂载失败", error);
      }
    }

    const module = { exports: {} };
    module.exports.apply = apply;
    module.exports.inject = ["slots", "sessions"];
    return module.exports;
  }
});
