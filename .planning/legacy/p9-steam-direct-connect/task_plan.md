# Task: P9 - Steam Direct Connect Fix

## Goal
Fix the Steam Direct Connect button in the Connection Card to properly launch Project Zomboid and connect to the server, including support for server passwords and hostname resolution.

## Problem Statement
- The original `steam://connect/` URL only works with IP addresses, not hostnames
- Initial attempt used `steam://rungameid/108600//+connect%20hostname:port/` format, but hostnames didn't work
- Browsers cannot perform local DNS resolution (security restriction)
- LAN users need their local DNS to resolve hostnames differently than public DNS

## Solution
1. Use `steam://connect/ip:port/password` format (confirmed working)
2. When hostname is set, resolve via Cloudflare DNS-over-HTTPS to get public IP
3. Add note for LAN users about the DNS limitation
4. Display server password with show/hide toggle

## Phases

### Phase 1: Research Steam Protocol
**Status:** `complete`
- [x] Investigated `steam://connect/` - only works with IPs
- [x] Investigated `steam://rungameid/` - hostnames don't work for PZ
- [x] Confirmed `steam://connect/ip:port/password` format works
- [x] Discovered browser DNS limitation (no local DNS API)

### Phase 2: Update ConnectionCard - Steam Connect
**Status:** `complete`
- [x] Change from `steam://rungameid/` to `steam://connect/` format
- [x] Add DNS-over-HTTPS resolution via Cloudflare (1.1.1.1)
- [x] Include server password in URL when set
- [x] Add loading spinner while resolving hostname

### Phase 3: Add Password Display
**Status:** `complete`
- [x] Add serverPassword prop to ConnectionCard
- [x] Display password field with show/hide toggle (Eye/EyeOff icons)
- [x] Add copy button for password
- [x] Pass serverPassword from ServerOverview (parsed from config.SERVER_PASSWORD)

### Phase 4: Add LAN User Note
**Status:** `complete`
- [x] Add informational note when hostname is set
- [x] Explain DNS-over-HTTPS limitation for LAN users
- [x] Suggest using local IP for same-network connections

### Phase 5: Build & Deploy
**Status:** `complete`
- [x] Build frontend
- [x] Update asset hash in index.ts
- [x] Deploy to Cloudflare
- [x] User confirmed working

## Files Modified
- `frontend/src/components/server-overview/ConnectionCard.tsx` - Main implementation
- `frontend/src/components/server-overview/ServerOverview.tsx` - Pass serverPassword prop
- `manager/src/index.ts` - Updated asset hash

## Technical Notes

### Steam URL Format
```
steam://connect/{ip}:{port}/{password}
```
- IP must be numeric (hostnames don't work)
- Password is optional (omit trailing slash if no password)

### DNS-over-HTTPS Resolution
```typescript
const response = await fetch(
  `https://cloudflare-dns.com/dns-query?name=${host}&type=A`,
  { headers: { Accept: "application/dns-json" } }
)
```
- Uses Cloudflare's public DNS (1.1.1.1)
- Returns public DNS resolution (not local network resolution)
- LAN users must use local IP directly

### Browser DNS Limitation
Browsers intentionally don't expose system DNS resolution to JavaScript for security/privacy reasons. There is no `dns.resolve()` API in browsers.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Hostname in steam://connect/ opens Steam but nothing happens | 1 | Switched to DNS-over-HTTPS to resolve hostname to IP |
| steam://rungameid/ format didn't connect to server | 2 | Reverted to steam://connect/ with resolved IP |
