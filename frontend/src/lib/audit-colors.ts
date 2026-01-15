/**
 * Audit Action Color Utility
 *
 * Maps audit action types to semantic colors for consistent UI representation.
 * Used by Dashboard Recent Activity widget and Audit Log page.
 */

export type AuditActionColor = "success" | "warning" | "error" | "info" | "muted"

/**
 * Get semantic color variant for an audit action
 *
 * Uses keyword-based matching for flexibility with action names.
 *
 * @param action - Action string from audit log (e.g., "server.created", "user.deleted")
 * @returns Color variant for UI components
 *
 * @example
 * getAuditActionColor("server.created") // "success"
 * getAuditActionColor("server.deleted") // "error"
 * getAuditActionColor("server.stopped") // "warning"
 * getAuditActionColor("user.login") // "info"
 */
export function getAuditActionColor(action: string): AuditActionColor {
  const lowerAction = action.toLowerCase()

  // Success/Create/Start actions (GREEN)
  // Includes: server.created, server.started, user.created, permission.granted,
  // invitation.accepted, agent.registered, server.restored, role_assignment.granted
  if (
    lowerAction.includes('created') ||
    lowerAction.includes('started') ||
    lowerAction.includes('granted') ||
    lowerAction.includes('accepted') ||
    lowerAction.includes('registered') ||
    lowerAction.includes('restored')
  ) {
    return 'success'
  }

  // Delete/Destructive actions (RED)
  // Includes: server.deleted, server.purged, user.deleted, permission.revoked,
  // agent.deleted, role_assignment.revoked
  if (
    lowerAction.includes('deleted') ||
    lowerAction.includes('purged') ||
    lowerAction.includes('revoked')
  ) {
    return 'error'
  }

  // Warning/Change/Stop actions (ORANGE)
  // Includes: server.stopped, server.restarted, server.rebuilt, user.role_changed,
  // user.password_changed, invitation.cancelled
  if (
    lowerAction.includes('stopped') ||
    lowerAction.includes('restarted') ||
    lowerAction.includes('rebuilt') ||
    lowerAction.includes('changed') ||
    lowerAction.includes('modified') ||
    lowerAction.includes('updated') ||
    lowerAction.includes('cancelled')
  ) {
    return 'warning'
  }

  // Info/Read actions (CYAN) - default fallback
  // Includes: user.login, user.logout, rcon.command, and any unmapped actions
  return 'info'
}

/**
 * Get badge variant for Shadcn Badge component from audit action
 *
 * Maps audit action colors to Badge component variants.
 * Note: Badge uses "destructive" instead of "error"
 */
export function getAuditActionBadgeVariant(
  action: string
): "success" | "warning" | "destructive" | "default" {
  const color = getAuditActionColor(action)

  switch (color) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'destructive'
    case 'info':
    case 'muted':
    default:
      return 'default'
  }
}

/**
 * Get enhanced badge styling for better contrast
 *
 * Provides custom CSS classes for colored badges with better visibility.
 * Used when default Shadcn badge colors are too subtle.
 */
export function getAuditActionBadgeStyle(action: string): string {
  const variant = getAuditActionBadgeVariant(action)

  switch (variant) {
    case 'success':
      return 'bg-green-600 text-white border-green-700'
    case 'warning':
      return 'bg-orange-600 text-white border-orange-700'
    case 'destructive':
      return 'bg-red-700 text-white border-red-800'
    default:
      return '' // Use default styling
  }
}
