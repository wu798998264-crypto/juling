# 聚灵 Windows 覆盖安装与独立更新发布计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 备份并覆盖本地聚灵，向维护者自己的仓库发布可验证的 Windows 安装更新。

**Architecture:** 延用已经完成迁移的 Tauri/Rust/Go 代码和独立 GitHub 仓库。建立聚灵独有的 updater 签名信任，使用 NSIS 安装包而非便携 ZIP 作为更新资产。账号与 API 配置不迁移、不重写，原版安装与快捷方式完全隔离。

**Tech Stack:** Tauri 2、NSIS、Node.js、PowerShell、GitHub CLI。

---

在当前已有升级改动的工作目录执行，不创建会遗漏这些改动的新 worktree。用户已授权本轮覆盖安装、源码推送与发行发布；不进行真实账号授权或付费模型调用。

### Task 1: 独立信任与安装隔离

- 检查 `src-tauri/tauri.conf.json`、`src-tauri/windows/nsis/installer-hooks.nsh`、仓库权限与密钥存在性。
- 先添加 `scripts/release/juling_installer_isolation.test.cjs`，验证安装器不删除原版快捷方式。
- 私钥使用 Tauri CLI 工具生成，在非同步的用户私有目录加密存储；密码使用 Windows DPAPI 保护，私钥和密码只进入本仓库的 Actions secrets，绝不进源码或发行资产。
- 公钥写入 Tauri 配置后重新构建。旧程序不能自动跨越签名信任，此次覆盖承担首次迁移。

### Task 2: 正确的 Windows 资产

- 复用 `scripts/release/stage_release_assets.cjs` 与 `build_target_latest_json.cjs` 生成 NSIS 目标清单。
- 新增 `build_windows_latest_json.cjs` 和测试，生成仅包含已实际构建平台的 `latest.json` 与通用 Windows 别名；不得虚报 macOS/Linux 资产。
- 执行 `npm run test:release`、正式 NSIS 构建和 updater 密码签名，核对签名及完整辅助资源。
- 多平台自动发行暂为显式 opt-in，避免本机发行与上游继承的多平台流水线竞争同一个 Release。

### Task 3: 覆盖并验证

- 只读检查精确的本地程序路径和进程；将现有 `../聚灵-本地版` 完整复制到新的维护备份目录。
- 精确停止必要的聚灵进程，不操作原版。安装到原稳定目录并验证程序、sidecar、资源文件哈希。
- 不读写账号/API 配置内容，不启动正式账号链路。通过独立数据目录检查新版启动和更新源。

### Task 4: 源码和发行

- 审核待提交文件，排除密钥、账号、临时日志、旧截图及构建产物；不强制推送。
- 源码提交推送后创建 draft Release，上传 NSIS、签名、便携 ZIP、更新清单与校验和，再发布为 latest。
- 通过匿名 GET 验证更新清单和安装包可下载，下载件与本地 hash 一致，并验证签名；更新验收文档。
- 明示 Google 自有 OAuth 配置、真实账号验收和 Windows Authenticode 的已知限制。
