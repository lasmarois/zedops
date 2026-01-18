import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Save, MessageSquare, Archive, Terminal, Loader2, Check, AlertCircle } from "lucide-react"
import { executeRconCommand } from "@/lib/api"

const MAX_BROADCAST_LENGTH = 200

interface QuickActionsProps {
  isRunning: boolean
  agentId: string
  serverId: string
  onNavigateToRcon: () => void
}

export function QuickActions({
  isRunning,
  agentId,
  serverId,
  onNavigateToRcon,
}: QuickActionsProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Broadcast message state
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [broadcastError, setBroadcastError] = useState<string | null>(null)

  const handleSaveWorld = async () => {
    console.log('[QuickActions] handleSaveWorld called', { isRunning, saveStatus, agentId, serverId })
    if (!isRunning || saveStatus === 'loading') {
      console.log('[QuickActions] Early return - not running or already loading')
      return
    }

    setSaveStatus('loading')
    setSaveError(null)

    try {
      console.log('[QuickActions] Calling executeRconCommand', { agentId, serverId, command: 'save' })
      const result = await executeRconCommand(agentId, serverId, 'save')
      console.log('[QuickActions] executeRconCommand result:', result)
      if (result.success) {
        setSaveStatus('success')
        // Reset to idle after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
        setSaveError(result.error || 'Save failed')
        setTimeout(() => setSaveStatus('idle'), 5000)
      }
    } catch (error) {
      console.error('[QuickActions] executeRconCommand error:', error)
      setSaveStatus('error')
      setSaveError(error instanceof Error ? error.message : 'Save failed')
      setTimeout(() => setSaveStatus('idle'), 5000)
    }
  }

  const getSaveButtonContent = () => {
    switch (saveStatus) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Saving...</span>
          </>
        )
      case 'success':
        return (
          <>
            <Check className="h-5 w-5 text-success" />
            <span className="text-xs text-success">Saved!</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-xs text-destructive">Failed</span>
          </>
        )
      default:
        return (
          <>
            <Save className="h-5 w-5" />
            <span className="text-xs">Save World</span>
          </>
        )
    }
  }

  const handleBroadcast = async () => {
    if (!isRunning || broadcastStatus === 'loading' || !broadcastMessage.trim()) return

    setBroadcastStatus('loading')
    setBroadcastError(null)

    try {
      // Project Zomboid RCON command: servermsg "message"
      const result = await executeRconCommand(agentId, serverId, `servermsg "${broadcastMessage.trim()}"`)
      if (result.success) {
        setBroadcastStatus('success')
        setTimeout(() => {
          setBroadcastStatus('idle')
          setBroadcastOpen(false)
          setBroadcastMessage('')
        }, 1500)
      } else {
        setBroadcastStatus('error')
        setBroadcastError(result.error || 'Broadcast failed')
      }
    } catch (error) {
      setBroadcastStatus('error')
      setBroadcastError(error instanceof Error ? error.message : 'Broadcast failed')
    }
  }

  const getBroadcastButtonContent = () => {
    switch (broadcastStatus) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">Sending...</span>
          </>
        )
      case 'success':
        return (
          <>
            <Check className="h-5 w-5 text-success" />
            <span className="text-xs text-success">Sent!</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-xs text-destructive">Failed</span>
          </>
        )
      default:
        return (
          <>
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">Broadcast</span>
          </>
        )
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {/* Save World - executes RCON save command directly */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning || saveStatus === 'loading'}
            onClick={handleSaveWorld}
            title={saveError || "Save the world now"}
          >
            {getSaveButtonContent()}
          </Button>

          {/* Broadcast Message - opens modal */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning || broadcastStatus === 'loading'}
            onClick={() => setBroadcastOpen(true)}
            title={broadcastError || "Send a message to all players"}
          >
            {getBroadcastButtonContent()}
          </Button>

          {/* Backup Now - placeholder */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1 opacity-50"
            disabled
            title="Coming soon"
          >
            <Archive className="h-5 w-5" />
            <span className="text-xs">Backup Now</span>
          </Button>

          {/* Open RCON Console */}
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            disabled={!isRunning}
            onClick={onNavigateToRcon}
          >
            <Terminal className="h-5 w-5" />
            <span className="text-xs">RCON Console</span>
          </Button>
        </div>

        {!isRunning && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Start the server to use quick actions
          </p>
        )}
      </CardContent>

      {/* Broadcast Message Modal */}
      <Dialog open={broadcastOpen} onOpenChange={(open) => {
        if (!open && broadcastStatus !== 'loading') {
          setBroadcastOpen(false)
          setBroadcastStatus('idle')
          setBroadcastError(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Broadcast Message
            </DialogTitle>
            <DialogDescription>
              Send a message to all players on the server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="broadcast-message">Message</Label>
              <Input
                id="broadcast-message"
                placeholder="Type your message..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value.slice(0, MAX_BROADCAST_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && broadcastMessage.trim()) {
                    handleBroadcast()
                  }
                }}
                disabled={broadcastStatus === 'loading'}
                autoFocus
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{broadcastMessage.length}/{MAX_BROADCAST_LENGTH}</span>
                {broadcastError && (
                  <span className="text-destructive">{broadcastError}</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBroadcastOpen(false)
                setBroadcastStatus('idle')
                setBroadcastError(null)
                setBroadcastMessage('')
              }}
              disabled={broadcastStatus === 'loading'}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBroadcast}
              disabled={!broadcastMessage.trim() || broadcastStatus === 'loading'}
            >
              {broadcastStatus === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : broadcastStatus === 'success' ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Sent!
                </>
              ) : (
                'Send'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
