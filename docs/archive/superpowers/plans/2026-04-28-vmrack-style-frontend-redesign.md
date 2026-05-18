# VMRack-Style Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the public Excel community frontend into a VMRack-inspired full-site UI.

**Architecture:** Extract shell navigation metadata into a tested helper, replace the left workspace shell with a top announcement/header shell, and make shared page primitives carry the dark/light section system. Then update high-traffic public pages to use the new primitives while preserving API calls and route behavior.

**Tech Stack:** React 18, Vite, TypeScript/TSX, Tailwind CSS utilities, TanStack Query, React Router, Vitest.

---

### Task 1: Navigation Configuration

**Files:**
- Create: `reace_web/src/app/lib/site-navigation.ts`
- Create: `reace_web/src/app/lib/site-navigation.test.ts`
- Modify: `reace_web/src/app/components/Layout.tsx`

- [ ] **Step 1: Write failing tests**

Create `site-navigation.test.ts` with assertions that `/templates/records` resolves to 模板中心, `/mall/redemptions` resolves to 积分经验中心, and `/` resolves to 首页.

- [ ] **Step 2: Run test red**

Run: `cd reace_web; npx vitest run src/app/lib/site-navigation.test.ts`
Expected: fails because `site-navigation.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `site-navigation.ts` exporting `publicNavItems`, `mobilePrimaryNavItems`, and `resolveActiveNavItem(pathname)`.

- [ ] **Step 4: Run test green**

Run: `cd reace_web; npx vitest run src/app/lib/site-navigation.test.ts`
Expected: pass.

### Task 2: Public Shell

**Files:**
- Modify: `reace_web/src/app/components/Layout.tsx`
- Modify: `reace_web/src/styles/theme.css`

- [ ] **Step 1: Replace desktop left sidebar with top shell**

Use announcement strip, sticky horizontal header, VMRack-like logo treatment, nav links, language/login/register area, and mobile sheet nav. Preserve existing dialogs, notifications, feedback, sign-in state, and outlet behavior.

- [ ] **Step 2: Verify build**

Run: `cd reace_web; npm run build`
Expected: exit 0.

### Task 3: Shared Visual Primitives

**Files:**
- Modify: `reace_web/src/app/components/LiteSurface.tsx`
- Modify: `reace_web/src/styles/theme.css`

- [ ] **Step 1: Convert primitives**

Update `LitePageFrame`, `LiteHero`, `LiteSectionTitle`, and `LitePanel` to use dark hero backgrounds, blue accents, 1320-1480px rhythm, large rounded corners, and light-blue panels.

- [ ] **Step 2: Verify build**

Run: `cd reace_web; npm run build`
Expected: exit 0.

### Task 4: Home Page

**Files:**
- Modify: `reace_web/src/app/pages/Home.tsx`

- [ ] **Step 1: Recompose home**

Replace the current two-column tutorial workspace with a VMRack-like landing page: dark immersive hero, four feature cards, tutorial/product split section, and light support section. Keep tutorial data, search, active category/article selection, and practice navigation.

- [ ] **Step 2: Verify build**

Run: `cd reace_web; npm run build`
Expected: exit 0.

### Task 5: Public Page Refresh

**Files:**
- Modify the public pages under `reace_web/src/app/pages` that already use `LitePageFrame`/`LitePanel`
- Target high-traffic manual edits: `PracticeCampaignHub.tsx`, `TemplateCenter.tsx`, `Mall.tsx`, `Tools.tsx`

- [ ] **Step 1: Update hero and section styling**

Use the new primitives and page-level class updates to make practice, template, mall, and tools pages match the shell.

- [ ] **Step 2: Verify build**

Run: `cd reace_web; npm run build`
Expected: exit 0.

### Task 6: Screenshot QA

**Files:**
- Read screenshots from `tmp_browser_debug/`

- [ ] **Step 1: Start local static preview**

Run: `cd reace_web; npm run build; npx vite --host 127.0.0.1 --port 4173`

- [ ] **Step 2: Capture screenshots**

Use Selenium/ChromeDriver for `/`, `/practice`, `/templates`, `/mall`, `/tools`, and a mobile home viewport.

- [ ] **Step 3: Inspect screenshots**

Compare against VMRack reference traits: top shell, dark hero, next-section preview, rounded feature panels, blue accent, responsive no-overlap.
