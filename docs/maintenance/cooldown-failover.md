# 冷却安全接替：上游同步保留项

这是聚灵本地安全策略，不属于冻结的 `parity22` 历史协议一致性基线。同步上游时必须三方合并，并保留实现、行为测试及门禁；不得为了通过升级直接删除测试或放宽断言。

## 必须保持的行为

- 原账户冷却时，仅在完整、可验证的历史允许安全重建时接替；不得重放已经执行的工具副作用。
- 已完成的 Codex `custom_tool_call`（`name: exec`、`status: completed`）可能对应多条同一 `call_id` 的 `custom_tool_call_output`。必须保留全部结果，不能把后续结果当成孤立输出，也不能重新执行该工具。其它工具的重复结果、缺少调用/结果、类型不匹配、未完成 exec 的重复结果仍须拒绝。
- 历史不完整、工具证据不配对或不可安全跨账户重建时，保留原账户归属并报告恢复信息，不得强行换号。
- 重试使用更新后的请求时间预算，不能因复用已经耗尽的压缩/请求预算再次立即超时。

## 保留文件与检查

- Rust 实现：`src-tauri/src/modules/codex_native_api/identity_rebuild.rs` 的工具配对、`mapping.rs` 的冷却恢复提示、`retry.rs` 的重试压缩预算。
- Rust 回归：同目录 `server.rs`、`context_rebuild_cooling_tests.rs`、`context_rebuild_http_tests.rs` 中的测试注册，以及 `context_rebuild_codex_app_failover_tests.rs` 的共享测试宿主。
- 验证入口：`scripts/check_juling_cooldown.cjs`、`tests/julingCooldownPolicy.test.ts`、`package.json` 的 `test:juling-cooldown`。
- CI：`.github/workflows/build-matrix.yml` 的 Ubuntu 22.04 安全门禁、`release.yml` 的 Windows 构建前安全门禁。发布汇总依赖 Windows 成功；其它平台可能已构建并上传草稿，但门禁失败不得公开发布。
- Windows 测试启动：`src-tauri/build.rs` 为所有 MSVC 最终目标嵌入 Common Controls v6 依赖，同时关闭 Tauri 重复的 manifest（图标、版本等资源仍保留）。否则库单测可能在运行任何测试前以 `0xc0000139` 退出；不得将其视为测试通过。

在仓库根目录运行：

```powershell
npm.cmd test
npm.cmd run test:juling-cooldown
npm.cmd run test:codex-parity
```

`node scripts/check_juling_cooldown.cjs --check-only` 只核对源码中的必需测试，**不证明行为通过**。正式命令执行 `juling_cooldown_` Rust 测试，并核对清单中的每一项确实执行成功；零测试、遗漏、忽略或失败均不得算通过。测试重命名需同时审查清单，不得用无效占位测试替代行为覆盖。

冷却回归使用合成的本地 A/B 账户，不使用真实凭据或模型额度。覆盖完整/增量历史、普通 HTTP/SSE、图片输入、一个 exec 的四条结果、历史不足时拒绝换号，以及重试压缩使用新开启预算但不延长总预算。

## 同步边界

`scripts/maintenance/` 是已有、未跟踪的本地维护目录，不是发布保护的存放位置。旧 `sync-upstream.cjs` 固定 v1.3.73，曾对 `codex_*` 功能冲突直接选上游；不要为新版本重跑其 `--apply`，也不要盲目全量覆盖这些文件。先生成三方候选、逐项审查冲突，保存备份，再运行上述门禁。

这些检查不能阻止绕过 CI、删除门禁或直接运行旧覆盖脚本。分支保护需由仓库管理员配置；本变更不声称已启用 GitHub required checks，也不保证上游自动合并永远无冲突。

## 当前集成基线与发布

- 正式集成基线为聚灵 1.3.78：`376be0dde3d958bb8d18d502b9c85b84b0ad849f`，相比已安装发行源码 `daf91fd7aa64db1c4de3d9887b616a5b803c5df4` 仅含 README 更新。旧主目录的 1.3.76 补丁只能作为回迁参考，不能用旧版安装包覆盖 1.3.78。
- Windows 本地运行更广的协议回归时，可为测试进程设置 `$env:RUST_MIN_STACK='8388608'`；这不更改应用的时间预算或运行配置。
- 发布须保留原有 OAuth 构建配置和签名流程。缺少 `JULING_ANTIGRAVITY_GOOGLE_CLIENT_*` / `JULING_GEMINI_GOOGLE_CLIENT_*` 时，本地构建成功不代表与正式版功能等价；不要直接替换用户现有程序。
- 源码验证、构建成功和安装生效是三个不同阶段。部署前保留安装包回退路径，避免中断正在运行的聊天；本回归不使用真实账号额度。
