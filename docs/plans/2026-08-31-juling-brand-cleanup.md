# Juling Complete Rebrand Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace every current app-brand logo, visible legacy name, branded engineering directory, and build artifact with the Juling identity while preserving compatibility aliases required by existing data and integrations.

**Architecture:** A single transparent Juling Core master drives all platform icon generation. User-visible names and package identities move to Juling, while legacy protocol/schema/environment values remain read-only aliases where removing them would change behavior.

**Tech Stack:** React/TypeScript, Tauri 2, Rust/Cargo, Go sidecar, PowerShell asset generation, Tauri icon generator.

---

### Task 1: Establish the master brand assets

**Files:**
- Create: `src/assets/branding/juling-core-master.png`
- Create: `src-tauri/app-icon.png`
- Modify: `src-tauri/icons/**`
- Modify: `src/assets/tray-icons/**`

**Steps:**
1. Copy the approved transparent Juling Core imagegen master into the repository.
2. Generate an application tile and monochrome tray mark from the master.
3. Run `tauri icon` to regenerate every platform icon size.
4. Inspect 512px, 32px, ICO, and tray outputs for AGCT remnants and alpha correctness.

### Task 2: Replace in-app brand visuals and visible strings

**Files:**
- Modify: `src/components/layout/SideNav.tsx`
- Modify: `src/locales/*.json`
- Modify: visible strings under `src-tauri/src/**`, `src/**`, and project docs.

**Steps:**
1. Replace the sidebar rocket/legacy mark with the Juling Core asset without moving controls.
2. Replace current brand text with `聚灵` in Chinese and `Juling` in other locales.
3. Update tray tooltip, OAuth completion pages, generated reports, and fallback labels.
4. Run locale validation and TypeScript checks.

### Task 3: Rename branded engineering directories and outputs

**Files:**
- Move: `crates/cockpit-core` to `crates/juling-core`
- Move: `crates/cockpit-cli` to `crates/juling-cli`
- Move: `sidecars/cockpit-cliproxy` to `sidecars/juling-cliproxy`
- Modify: `Cargo.toml`, crate manifests, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, workflows and scripts.

**Steps:**
1. Resolve and verify every source and destination path inside the Juling workspace.
2. Move the three branded directories using PowerShell literal paths.
3. Rename crate/library/sidecar artifact identifiers and update all references.
4. Run Cargo metadata and Go module tests to catch stale paths.

### Task 4: Preserve legacy compatibility without presenting it as the brand

**Files:**
- Modify: deep-link, data-directory, export, WebDAV and environment compatibility modules as needed.

**Steps:**
1. Make `juling` the primary new protocol/directory/schema where safe.
2. Retain old protocol/schema/environment values only as import/read aliases.
3. Add or update tests proving old data still opens and new output uses Juling names.
4. Scan tracked first-party files and classify every remaining legacy token as compatibility-only, historical third-party code, or a defect.

### Task 5: Build and visually verify the Windows application

**Files:**
- Output: `target/release/juling.exe`
- Output: `聚灵-本地版/聚灵.exe`

**Steps:**
1. Run TypeScript, locale, Rust and Go checks.
2. Build the unsigned Windows executable with `tauri build --no-bundle --ci`.
3. Launch the real desktop executable.
4. Capture and inspect the main window, title/taskbar icon, sidebar brand, tray icon, no-ad header and update entry.
5. Copy the verified executable and required resources into the local release folder without modifying the original application.

