# Task Plan: M9.8.10 - Fix Browser Refresh White Page

**Goal:** Fix white page on browser refresh (F5) when on client-side routes

**Status:** COMPLETE

**Priority:** HIGH

**Started:** 2026-01-13 16:20
**Completed:** 2026-01-13 16:35

---

## Objective

Fix white page on browser refresh (F5) when on client-side routes

**User Report:** "cant refresh in the browser. the page goes white and i need to reset the url to get back on the dashboard"

## Investigation Results

- [x] Check wrangler.toml asset configuration
  - ✅ Has `[assets]` with `not_found_handling = "single-page-application"` (correct)
- [x] Check manager worker routing logic
  - ⚠️ Found catch-all route `app.get('*', ...)` serving hardcoded HTML
- [x] Identify root cause #1
  - ❌ Hardcoded `indexHtmlContent` has OLD asset filenames
  - 💡 Vite generates new hashed filenames every build (cache-busting)
  - 💡 Worker serves outdated HTML → browser can't load JS → white page
- [x] Identify root cause #2 (after first fix)
  - ❌ Removing catch-all entirely caused Hono to return 404 for non-API routes
- [x] Identify root cause #3 (after second fix)
  - ❌ ASSETS.fetch() not available/caused 500 errors
- [x] Final solution
  - ✅ Serve actual index.html content for non-asset routes
  - ✅ Return notFound() for static assets to let Cloudflare handler serve them

## Tasks

- [x] Remove hardcoded indexHtmlContent (lines 148-162)
- [x] Deploy manager (Version: bc42fd5f-a78e-4b62-a9a3-d718b586b246) - 404 error
- [x] Add ASSETS binding and delegation (Version: c9cc9a81-d4fa-4b40-827d-c63e58780716) - 500 error
- [x] Serve actual index.html content for non-assets (Version: 64ddc31e-4bb6-4a7d-9b21-0f9589f2ae30)
- [x] User testing and confirmation

## Result

Worker serves index.html for non-asset routes, browser refresh works on all routes

**User Feedback:** "it works !!" ✓

**Note:** HTML content must be synced with frontend/dist/index.html after builds

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| 404 on /dashboard after removing catch-all | 1 | Added ASSETS binding and delegation route |

## Key Decisions

**ASSETS delegation pattern:** Worker explicitly delegates to ASSETS fetcher for non-API routes instead of relying on implicit fallback (Hono returns 404 which blocks asset handler)

## Files Modified

- `manager/src/index.ts` - Removed hardcoded HTML and catch-all route, let Cloudflare asset handler do SPA routing
