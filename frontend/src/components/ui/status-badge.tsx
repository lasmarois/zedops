import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  variant: "success" | "warning" | "error" | "info" | "muted" | "starting" | "pending"
  children?: React.ReactNode
  className?: string
  size?: "sm" | "md" | "lg"
  icon?: "dot" | "pulse" | "loader" | "check" | "alert" | "cross" | "info"
  iconOnly?: boolean
}

// Status icons as SVG components
const StatusIcons = {
  dot: ({ className }: { className?: string }) => (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={className}>
      <circle cx="4" cy="4" r="3" />
    </svg>
  ),
  pulse: ({ className }: { className?: string }) => (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
    </span>
  ),
  loader: ({ className }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className={cn("animate-spin", className)}>
      <path d="M6 1V3M6 9V11M1 6H3M9 6H11M2.5 2.5L3.9 3.9M8.1 8.1L9.5 9.5M2.5 9.5L3.9 8.1M8.1 3.9L9.5 2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M6 1V3" strokeLinecap="round" />
    </svg>
  ),
  check: ({ className }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: ({ className }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 4V7M6 9V9.5" strokeLinecap="round" />
      <path d="M6 1L1 10H11L6 1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cross: ({ className }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 3L9 9M9 3L3 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: ({ className }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={className}>
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 5V9M6 3V3.5" strokeLinecap="round" strokeWidth="2" />
    </svg>
  ),
}

export function StatusBadge({
  variant,
  children,
  className,
  size = "md",
  icon = "dot",
  iconOnly = false
}: StatusBadgeProps) {
  const IconComponent = StatusIcons[icon]

  // Icon-only mode (just the dot/icon, no container)
  if (iconOnly) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <IconComponent
          className={cn({
            "text-success": variant === "success",
            "text-warning": variant === "warning",
            "text-error": variant === "error",
            "text-info": variant === "info",
            "text-muted-foreground": variant === "muted",
            "text-purple-400/70": variant === "starting",
            "text-amber-400/70": variant === "pending",
          })}
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        // Base styles - pill shape with subtle background
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        "ring-1 ring-inset",

        // Size variants
        {
          "px-2 py-0.5 text-xs": size === "sm",
          "px-2.5 py-1 text-sm": size === "md",
          "px-3 py-1.5 text-base": size === "lg",
        },

        // Color variants - subtle background + vibrant text + matching ring
        {
          "bg-success/10 text-success ring-success/20": variant === "success",
          "bg-warning/10 text-warning ring-warning/20": variant === "warning",
          "bg-error/10 text-error ring-error/20": variant === "error",
          "bg-info/10 text-info ring-info/20": variant === "info",
          "bg-muted/10 text-muted-foreground ring-muted/20": variant === "muted",
          "bg-purple-400/5 text-purple-400/70 ring-purple-400/10": variant === "starting",
          "bg-amber-400/5 text-amber-400/70 ring-amber-400/10": variant === "pending",
        },
        className
      )}
    >
      <IconComponent />
      {children}
    </span>
  )
}

// Usage examples:
// <StatusBadge variant="success" icon="pulse">Running</StatusBadge>
// <StatusBadge variant="error" icon="cross">Failed</StatusBadge>
// <StatusBadge variant="warning" icon="alert">Warning</StatusBadge>
// <StatusBadge variant="info" icon="info">Updating</StatusBadge>
// <StatusBadge variant="success" icon="check">Healthy</StatusBadge>
//
// Icon-only mode (for tables):
// <StatusBadge variant="success" icon="dot" iconOnly />
//
// Available icons: dot, pulse, check, alert, cross, info
// Available sizes: sm, md, lg
