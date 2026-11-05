# 聚灵本地安全策略

同步、合并或升级上游前，先阅读 `docs/maintenance/cooldown-failover.md`。

- 保留冷却安全接替、完整历史校验、工具不重放和更新后的重试时间预算；冲突必须人工审查，不得直接用上游覆盖本地安全实现。
- 保留 `scripts/check_juling_cooldown.cjs`、`tests/julingCooldownPolicy.test.ts`、Rust `juling_cooldown_` 回归及两条 CI 调用。修改相关行为后运行 `npm test`、`npm run test:juling-cooldown` 和 `npm run test:codex-parity`；静态检查不能代替行为测试。
- 不改写已有未跟踪的 `scripts/maintenance/` 内容，也不把它作为持久保护入口。不要运行旧版全量覆盖脚本；绕过 CI 的操作不受门禁保护。
