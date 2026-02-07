/**
 * M12: Backup & Restore tab for server detail page
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup } from "@/hooks/useBackups"
import { useBackupProgress } from "@/hooks/useBackupProgress"
import type { Backup } from "@/lib/api"
import { Download, Trash2, RotateCcw, Plus, Archive, Loader2, CheckCircle2, XCircle } from "lucide-react"

interface BackupsTabProps {
  serverId: string
  agentId: string
  serverName: string
  serverStatus: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(timestamp: number): string {
  // D1 stores as milliseconds
  const date = new Date(timestamp)
  return date.toLocaleString()
}

function getPhaseLabel(phase: string): string {
  switch (phase) {
    case 'calculating': return 'Calculating size...'
    case 'saving': return 'Saving game state (RCON)...'
    case 'compressing': return 'Compressing data...'
    case 'stopping': return 'Stopping server...'
    case 'extracting': return 'Extracting backup...'
    case 'starting': return 'Starting server...'
    case 'complete': return 'Complete'
    case 'error': return 'Error'
    default: return phase
  }
}

export function BackupsTab({ serverId, agentId, serverName, serverStatus }: BackupsTabProps) {
  const [notes, setNotes] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [progressEnabled, setProgressEnabled] = useState(false)

  const { data: backups, isLoading, error: fetchError } = useBackups(agentId, serverId)
  const createBackupMutation = useCreateBackup()
  const deleteBackupMutation = useDeleteBackup()
  const restoreBackupMutation = useRestoreBackup()

  // Connect to WebSocket for progress updates during operations
  const { progress, reset: resetProgress } = useBackupProgress({
    agentId,
    serverName,
    enabled: progressEnabled,
  })

  // Determine if there's an active operation (from progress stream)
  const isActiveOperation = progress !== null && progress.phase !== 'complete' && progress.phase !== 'error'

  const handleCreateBackup = async () => {
    setOperationError(null)
    resetProgress()
    setProgressEnabled(true)
    try {
      await createBackupMutation.mutateAsync({ agentId, serverId, notes: notes || undefined })
      setNotes("")
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to create backup')
    }
  }

  const handleDelete = (backupId: string) => {
    setPendingDeleteId(backupId)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setOperationError(null)
    try {
      await deleteBackupMutation.mutateAsync({ agentId, serverId, backupId: pendingDeleteId })
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to delete backup')
    }
    setPendingDeleteId(null)
  }

  const handleRestore = (backupId: string) => {
    setPendingRestoreId(backupId)
    setShowRestoreConfirm(true)
  }

  const confirmRestore = async () => {
    if (!pendingRestoreId) return
    setOperationError(null)
    resetProgress()
    setProgressEnabled(true)
    try {
      await restoreBackupMutation.mutateAsync({ agentId, serverId, backupId: pendingRestoreId })
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Failed to restore backup')
    }
    setPendingRestoreId(null)
  }

  // Find the backup being restored (for dialog description)
  const pendingRestoreBackup = backups?.find((b: Backup) => b.id === pendingRestoreId)

  return (
    <div className="space-y-6">
      {/* Progress Banner */}
      {progress && progress.phase !== 'complete' && (
        <Alert>
          <AlertDescription>
            <div className="flex items-center gap-3">
              {progress.phase === 'error' ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <div className="flex-1">
                <div className="font-medium">{getPhaseLabel(progress.phase)}</div>
                {progress.error && (
                  <div className="text-sm text-destructive mt-1">{progress.error}</div>
                )}
                {progress.phase !== 'error' && (
                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{progress.percent}%</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Completed Banner */}
      {progress && progress.phase === 'complete' && (
        <Alert>
          <AlertDescription>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">Operation completed successfully</span>
              <Button variant="ghost" size="sm" onClick={() => { resetProgress(); setProgressEnabled(false); }}>Dismiss</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Banner */}
      {operationError && !progress && (
        <Alert variant="destructive">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      {/* Create Backup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Backup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input
                placeholder="e.g., Before mod update"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isActiveOperation || createBackupMutation.isPending}
              />
            </div>
            <Button
              onClick={handleCreateBackup}
              disabled={isActiveOperation || createBackupMutation.isPending}
            >
              {createBackupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Backup Now
            </Button>
          </div>
          {serverStatus === 'running' && (
            <p className="text-xs text-muted-foreground mt-2">
              The server will be saved via RCON before backup (best-effort).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Backups
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : fetchError ? (
            <p className="text-destructive">Failed to load backups: {fetchError.message}</p>
          ) : !backups || backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No backups yet</p>
              <p className="text-sm mt-1">Create your first backup to protect your server data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium">Size</th>
                    <th className="pb-2 font-medium">Notes</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup: Backup) => (
                    <tr key={backup.id} className="border-b last:border-0">
                      <td className="py-3 text-sm">{formatDate(backup.created_at)}</td>
                      <td className="py-3 text-sm">{formatBytes(backup.size_bytes)}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {backup.notes || '-'}
                      </td>
                      <td className="py-3 text-sm">
                        {backup.status === 'complete' && (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </span>
                        )}
                        {backup.status === 'creating' && (
                          <span className="inline-flex items-center gap-1 text-yellow-600">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Creating
                          </span>
                        )}
                        {backup.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {backup.status === 'complete' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestore(backup.id)}
                                disabled={isActiveOperation || restoreBackupMutation.isPending}
                                title="Restore from this backup"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(backup.id)}
                                disabled={isActiveOperation || deleteBackupMutation.isPending}
                                title="Delete this backup"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Backup"
        description="Are you sure you want to permanently delete this backup? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Restore Confirmation */}
      <ConfirmDialog
        open={showRestoreConfirm}
        onOpenChange={setShowRestoreConfirm}
        title="Restore from Backup"
        description={`This will stop the server, replace the current data with the backup${pendingRestoreBackup?.notes ? ` (${pendingRestoreBackup.notes})` : ''}, and restart the server. The current data will be preserved in a backup directory. Continue?`}
        confirmText="Restore"
        variant="destructive"
        onConfirm={confirmRestore}
      />
    </div>
  )
}
