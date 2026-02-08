# Goal #15: Button Polish + Solar Flare Color Fix

## Overview
Unify button styling across the app using glass-morphism variants. Fix Solar Flare theme's `--info` color (yellow→cyan) so stop/restart/rebuild are visually distinct. Fix Midnight Blue theme ID bug.

## Phase 1: Foundation (index.css, theme.ts, button.tsx)
- [x] Fix Solar Flare `--info` color in index.css (45 95% 60% → 190 85% 55%)
- [x] Fix Solar Flare `--info` in theme.ts colors + preview
- [x] Fix Midnight Blue id from 'solar-flare' → 'midnight-blue'
- [x] Add glow-* utility classes to index.css
- [x] Add 6 glass-* button variants to button.tsx CVA

## Phase 2: High-Priority Button Migration
- [x] ServerList.tsx — Create Server buttons → glass-primary, Add Agent → glass-primary
- [x] AgentList.tsx — Add Agent → glass-primary
- [x] AgentDetail.tsx — Disconnect → glass-destructive
- [x] ServerForm.tsx — Create Server → glass-success, Cancel → glass-muted

## Phase 3: Medium-Priority Button Migration
- [x] ServerList.tsx — Restore → glass-success, Purge → glass-destructive
- [x] Dashboard.tsx — Create Server → glass-primary, Invite User → glass-primary
- [x] UserList.tsx — Invite/Cancel/Permissions/Delete → glass variants
- [x] RoleAssignmentsManager.tsx — Grant/Cancel/Revoke → glass variants
- [x] AgentDetail.tsx — Edit/Cancel/Save → glass variants
- [x] ConfigurationDisplay.tsx — Edit Configuration → glass-info

## Phase 4: Migrate Hardcoded RGBA Glows
- [x] ServerDetail.tsx — Replace hover:shadow-[inset_0_0_20px_rgba(...)] with glow utilities
- [x] ServerCard.tsx — Same migration
- [x] AgentServerList.tsx — Same migration

## Phase 5: Verification
- [x] npm run build succeeds
- [x] Push to dev, CI deploys
- [ ] Visual verification in browser

## NOT Changing
- Ghost icon buttons (dropdown triggers, chevrons)
- QuickActions grid tiles
- Sidebar/layout buttons, RCON terminal, Login/Register
- "View All →" navigation links
