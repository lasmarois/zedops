import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Globe, Copy, Check, ExternalLink } from "lucide-react"

interface ConnectionCardProps {
  serverIp?: string | null
  gamePort: number
  udpPort: number
}

export function ConnectionCard({
  serverIp,
  gamePort,
  udpPort,
}: ConnectionCardProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const ip = serverIp || "your-server-ip"
  const connectionString = `${ip}:${gamePort}`
  const steamConnectUrl = `steam://connect/${ip}:${gamePort}`

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
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md">
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

        {/* Direct Connect Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(steamConnectUrl, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Direct Connect (Steam)
        </Button>

        {!serverIp && (
          <p className="text-xs text-muted-foreground text-center">
            Replace "your-server-ip" with your actual server IP
          </p>
        )}
      </CardContent>
    </Card>
  )
}
