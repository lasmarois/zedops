import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Globe, Copy, Check, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react"

interface ConnectionCardProps {
  serverIp?: string | null
  hostname?: string | null // P8: Agent's custom hostname
  gamePort: number
  udpPort: number
  serverPassword?: string | null // Server password for connection
}

export function ConnectionCard({
  serverIp,
  hostname,
  gamePort,
  udpPort,
  serverPassword,
}: ConnectionCardProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isResolving, setIsResolving] = useState(false)

  // Use hostname for display if set, otherwise fall back to IP
  const displayAddress = hostname || serverIp || "your-server-ip"
  const connectionString = `${displayAddress}:${gamePort}`

  // Resolve hostname via Cloudflare DNS-over-HTTPS
  const resolveHostname = async (host: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
        { headers: { Accept: "application/dns-json" } }
      )
      const data = await response.json()
      if (data.Answer && data.Answer.length > 0) {
        // Return first A record
        const aRecord = data.Answer.find((r: { type: number }) => r.type === 1)
        return aRecord?.data || null
      }
      return null
    } catch {
      return null
    }
  }

  const handleSteamConnect = async () => {
    // steam://connect/ format only works with IPs, not hostnames
    // If hostname is set, resolve it via DNS-over-HTTPS
    let ip = serverIp

    if (hostname) {
      setIsResolving(true)
      const resolvedIp = await resolveHostname(hostname)
      setIsResolving(false)
      if (resolvedIp) {
        ip = resolvedIp
      }
    }

    if (ip) {
      // Format: steam://connect/ip:port or steam://connect/ip:port/password
      const url = serverPassword
        ? `steam://connect/${ip}:${gamePort}/${serverPassword}`
        : `steam://connect/${ip}:${gamePort}`
      window.location.href = url
    }
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Address */}
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Server Address</div>
          <div className="flex items-center gap-2 min-w-0">
            <code
              className="flex-1 min-w-0 text-sm font-mono bg-muted px-3 py-2 rounded-md truncate"
              title={connectionString}
            >
              {connectionString}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => handleCopy(connectionString, "address")}
            >
              {copied === "address" ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Ports */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Game Port</div>
            <div className="text-sm font-mono font-medium">{gamePort}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">UDP Port</div>
            <div className="text-sm font-mono font-medium">{udpPort}</div>
          </div>
        </div>

        {/* Server Password */}
        {serverPassword && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Server Password</div>
            <div className="flex items-center gap-2 min-w-0">
              <code className="flex-1 min-w-0 text-sm font-mono bg-muted px-3 py-2 rounded-md truncate">
                {showPassword ? serverPassword : "••••••••"}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => handleCopy(serverPassword, "password")}
              >
                {copied === "password" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Direct Connect Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSteamConnect}
          disabled={(!serverIp && !hostname) || isResolving}
        >
          {isResolving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Resolving...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Direct Connect (Steam)
            </>
          )}
        </Button>

        {/* LAN user note */}
        {hostname && (
          <p className="text-xs text-muted-foreground">
            <strong>LAN users:</strong> Direct Connect resolves the hostname via public DNS.
            If you're on the same network, use your local IP instead.
          </p>
        )}

        {!serverIp && !hostname && (
          <p className="text-xs text-muted-foreground text-center">
            Replace "your-server-ip" with your actual server IP
          </p>
        )}
      </CardContent>
    </Card>
  )
}
