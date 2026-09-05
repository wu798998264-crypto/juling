# 聚灵指挥台布局 UI 设计

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变账号、平台、更新、日志和 Tauri 命令链路的前提下，将聚灵从原版的左侧文字导航与卡片堆叠改造成指挥台式桌面工作区。

**Architecture:** 保留 `App.tsx` 当前的 `Page` 路由、keep-alive 页面挂载、Zustand stores 和所有平台页面；新增的界面只负责展示层级和 CSS 外壳。窄侧栏提供一级模块入口，顶部上下文条显示当前工作区，Dashboard 负责总览与活跃工作区的重新编排；已有页面内容继续在同一主容器中渲染。

**Tech Stack:** React 19, TypeScript, Tauri 2, Zustand, CSS, lucide-react。

---

### Task 1: Replace the application shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/SideNav.tsx`
- Modify: `src/styles/layout.css`
- Modify: `src/App.css`

**Steps:**
1. Keep `SideNav` callbacks and page setters intact, but render the existing navigation entries as a narrow icon rail with accessible labels and tooltips.
2. Add a shell-level context strip that derives its label from the active `Page`, without adding a second navigation state.
3. Move update/log affordances into the shell context area while retaining their existing handlers.
4. Keep `main-wrapper`, `VisibleBootPage`, modal mounts and keep-alive behavior intact.

### Task 2: Recompose the dashboard

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.css`

**Steps:**
1. Preserve all existing selectors, store reads, account presentation builders and action handlers.
2. Replace the top card grid presentation with a compact command summary row and a two-column active workspace layout.
3. Keep platform stats clickable and keep each platform card's refresh, hide, collapse and view-all actions unchanged.
4. Add responsive stacking for narrow desktop windows and preserve keyboard focus visibility.

### Task 3: Adapt existing pages to the workspace frame

**Files:**
- Modify: `src/styles/layout.css`
- Modify: `src/styles/pages.css`
- Modify: page-specific CSS only when a page overflows the new shell.

**Steps:**
1. Apply the new content inset and context strip spacing to existing platform, settings, manual, 2FA and log views.
2. Do not move or rename existing controls inside those pages.
3. Verify long settings and account lists still scroll within the main workspace.

### Task 4: Verify behavior and visual output

**Steps:**
1. Run `npm run typecheck` and `npm run build`.
2. Launch the built Windows executable from the independent workspace.
3. Capture Dashboard, one platform account page, Settings and About views.
4. Confirm the window opens without a blank screen, all original page routes remain reachable, and the new shell is visibly distinct from the legacy layout.

