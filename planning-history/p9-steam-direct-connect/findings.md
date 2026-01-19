# Findings: P9 - Steam Direct Connect Fix

## Steam Protocol Research

### steam://connect/ Format
- **Syntax:** `steam://connect/{address}:{port}` or `steam://connect/{address}:{port}/{password}`
- **Works with:** IP addresses only
- **Does NOT work with:** Hostnames (just opens Steam, no connection dialog)
- **Password:** Appended after port with `/` separator

### steam://rungameid/ Format
- **Syntax:** `steam://rungameid/{APPID}//+connect%20{address}:{port}/`
- **Theory:** Uses game's command-line arguments, should support hostnames
- **Reality:** Project Zomboid (108600) doesn't properly parse hostnames via this method
- **Not recommended** for PZ servers

### Window Methods
- `window.open(url, "_blank")` - Doesn't work well with protocol URLs
- `window.location.href = url` - Works correctly for `steam://` protocol

## Browser DNS Limitations

### The Problem
Users with custom DNS (Pi-hole, router settings, /etc/hosts) want their browser to resolve hostnames using their local DNS settings. LAN users might have `myserver.local` resolving to `192.168.x.x`.

### Why It Doesn't Work
- Browsers intentionally block JavaScript from accessing system DNS
- No `dns.resolve()` or similar API exists in browsers
- This is a security/privacy feature, not a bug
- `fetch()` uses DNS internally but doesn't expose resolution results

### Workaround: DNS-over-HTTPS
```typescript
const response = await fetch(
  `https://cloudflare-dns.com/dns-query?name=${host}&type=A`,
  { headers: { Accept: "application/dns-json" } }
)
```
- Uses Cloudflare's public DNS (1.1.1.1)
- Only resolves **public** DNS records (DuckDNS, etc.)
- Does NOT use local network DNS settings
- Suitable for users with DDNS pointing to public IP

### LAN User Solution
For users on the same network as the server:
- Configure agent hostname in ZedOps (for display/copying)
- Use the displayed IP directly for Steam connect
- Or manually enter local IP in Steam's direct connect dialog

## UI/UX Decisions

### Password Display
- Hidden by default (`••••••••`)
- Eye icon toggles visibility
- Separate copy button
- Only shown when SERVER_PASSWORD is set in config

### LAN User Note
Added contextual note when hostname is set:
> "LAN users: Direct Connect resolves the hostname via public DNS. If you're on the same network, use your local IP instead."

### Loading State
- Spinner shown while resolving hostname
- Button disabled during resolution
- Prevents double-clicks and confusion

## Key Sources
- Steam Community: https://steamcommunity.com/sharedfiles/filedetails/?id=2408784973
- WinterNode Guide: https://winternode.com/help/general-utilities/steam/connecting-to-steam-servers/
- Cloudflare DNS-over-HTTPS: https://developers.cloudflare.com/1.1.1.1/dns-over-https/
