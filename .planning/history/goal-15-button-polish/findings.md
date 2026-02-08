# Goal #15: Findings

## Solar Flare Theme Issue
- `--info: 45 95% 60%` and `--warning: 48 95% 55%` are only 3° hue apart (both yellow-gold)
- This makes restart (info) and stop (warning) buttons visually indistinguishable
- Fix: Change `--info` to cyan `190 85% 55%` — distinct from warning/primary

## Midnight Blue Theme ID Bug
- `theme.ts` line 27: Midnight Blue has `id: 'solar-flare'` instead of `id: 'midnight-blue'`
- This was caused by a replace-all bug during theme implementation
- Both Midnight Blue and Solar Flare compete for the same ID, causing theme switching issues

## File Locations
- Button component: `frontend/src/components/ui/button.tsx`
- Pages with buttons: `frontend/src/pages/` (ServerList, Dashboard, etc.)
- Components with buttons: `frontend/src/components/` (AgentList, ServerForm, etc.)
- Server action buttons (glass already): `ServerDetail.tsx` lines 318-378

## Glass Button Design Pattern (from ServerDetail.tsx)
```
bg-white/5 border border-white/10 backdrop-blur-md
text-{color}
hover:bg-{color}/20
hover:shadow-[inset_0_0_20px_rgba(...)]  ← hardcoded, needs migration
```
