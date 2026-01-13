import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  variant: "success" | "warning" | "error" | "info" | "muted"
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-sm font-medium",
        {
          "text-success": variant === "success",
          "text-warning": variant === "warning",
          "text-error": variant === "error",
          "text-info": variant === "info",
          "text-muted-foreground": variant === "muted",
        },
        className
      )}
    >
      {children}
    </span>
  )
}

// Usage examples:
// <StatusBadge variant="success">🟢 Online</StatusBadge>
// <StatusBadge variant="error">🔴 Offline</StatusBadge>
// <StatusBadge variant="warning">🟡 Starting</StatusBadge>
// <StatusBadge variant="muted">⚪ Unknown</StatusBadge>
