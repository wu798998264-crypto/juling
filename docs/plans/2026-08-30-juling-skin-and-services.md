# 聚灵皮肤与服务入口 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在独立副本中将应用品牌更新为“聚灵”，采用已确认的核星雾蓝视觉皮肤，移除顶部广告与公告后端，保留检查更新按钮并接入新的聚灵仓库，同时将作者、反馈和赞助入口切换为本地/新品牌内容。

**Architecture:** 保持现有 Tauri + React 页面、状态管理和按钮布局不变，只在展示层与远程入口层做最小改动。广告和公告状态使用本地空状态并不触发 Tauri 远程命令；更新仍通过现有 Tauri updater/plugin 链路执行，endpoint 改为聚灵仓库；赞助二维码作为前端静态资源打包并由设置页弹窗展示。

**Tech Stack:** Tauri 2, React 19, TypeScript, Zustand, Vite, Rust updater module, GitHub Releases.

---

### Task 1: Add local brand asset and update application identity

**Files:**
- Create: `src/assets/branding/juling-sponsor-qrcode.png`
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml` or generated identifiers only if required by build validation

**Steps:**
1. Copy the sponsor QR image from the XuanNian source into the independent copy.
2. Change visible product name, window titles, package name, and Tauri identifier to the Juling identity while leaving feature code untouched.
3. Run the type/build metadata synchronization command and inspect the diff.

### Task 2: Remove advertisement and announcement backends

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/stores/useTopRightAdStore.ts`
- Modify: `src/stores/useAnnouncementStore.ts`
- Modify: `src/components/AnnouncementCenter.tsx` only when needed to keep the existing layout stable

**Steps:**
1. Replace ad store fetches with empty local state and remove ad rendering/effects from the app shell.
2. Replace announcement store initialization with an empty local state and make read actions no-op/local-safe.
3. Keep the existing announcement host/button surface structurally present where the original layout expects it, but show no remote data and no remote requests.

### Task 3: Rewire About actions and sponsor modal

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPageView.tsx`
- Modify: `src/pages/settings/Settings.css`

**Steps:**
1. Preserve the existing “检查更新” button and update status handling.
2. Change author to `@虾仁灭口` and the Douyin URL.
3. Change repository and release links to the new Juling repository; change feedback to a local disconnected-state message without opening a URL.
4. Add a local sponsor modal displaying the copied QR image and a concise sponsor introduction.
5. Verify escape/backdrop close behavior and keep the original About card order/layout.

### Task 4: Point update architecture at the new repository

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/utils/updaterReleaseNotes.ts`
- Modify: any source/config/script files containing the old repository URL

**Steps:**
1. Replace old update endpoint and fallback release URL with the new Juling repository.
2. Preserve updater signing configuration as a placeholder until a new release signing key is generated; document that release artifacts must be signed with the matching key.
3. Replace user-facing old repository links in project metadata/docs where appropriate while preserving upstream license/attribution requirements.

### Task 5: Verify and publish the independent repository

**Steps:**
1. Run `npm install`, `npm run typecheck`, and `npm run build` in the independent copy.
2. Search for remaining old repository/update/feedback URLs and confirm no source-level connection remains.
3. Confirm `E:\Cockpit Tools\cockpit-tools.exe` timestamp/hash is unchanged.
4. Initialize the first commit in the independent repository.
5. Confirm `wu798998264-crypto/juling` does not already exist, create it with GitHub CLI, add only the new remote, and push the independent copy.

