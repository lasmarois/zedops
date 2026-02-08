import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, Terminal, Loader2 } from "lucide-react"
import { generateEphemeralToken } from "@/lib/api"

interface InstallAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallAgentDialog({ open, onOpenChange }: InstallAgentDialogProps) {
  const [agentName, setAgentName] = useState("")
  const [token, setToken] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws"
  const managerUrl = `${wsProtocol}://${window.location.host}/ws`

  const handleGenerateToken = async () => {
    if (!agentName.trim()) {
      setError("Please enter an agent name")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const result = await generateEphemeralToken(agentName.trim())
      setToken(result.token)
    } catch (err) {
      setError("Failed to generate token. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const installCommand = token
    ? `curl -sSL https://raw.githubusercontent.com/lasmarois/zedops/main/agent/scripts/install.sh | sudo bash -s -- --manager-url "${managerUrl}" --name "${agentName}" --token "${token}"`
    : ""

  const handleCopy = async () => {
    if (!installCommand) return

    try {
      await navigator.clipboard.writeText(installCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = installCommand
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    // Reset state when closing
    setAgentName("")
    setToken(null)
    setError(null)
    setCopied(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Install ZedOps Agent
          </DialogTitle>
          <DialogDescription>
            Install the agent on your server to manage game servers remotely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!token ? (
            // Step 1: Enter agent name and generate token
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agentName">Agent Name</Label>
                <Input
                  id="agentName"
                  placeholder="e.g., my-game-server"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateToken()}
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this agent in the dashboard.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerateToken}
                disabled={isGenerating || !agentName.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Installation Command"
                )}
              </Button>
            </div>
          ) : (
            // Step 2: Show installation command
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Token generated!</strong> This token expires in 1 hour.
                  Run the command below on your server.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Installation Command</Label>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                    {installCommand}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Requirements:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Linux server with root/sudo access</li>
                  <li>Docker installed and running</li>
                  <li>Outbound internet access (HTTPS)</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setToken(null)} className="flex-1">
                  Generate New Token
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
