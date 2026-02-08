import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-background hover:bg-primary/90 shadow-sm hover:shadow-md hover:shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md hover:shadow-destructive/20",
        success:
          "bg-success text-background hover:bg-success/90 shadow-sm hover:shadow-md hover:shadow-success/20",
        warning:
          "bg-warning text-background hover:bg-warning/90 shadow-sm hover:shadow-md hover:shadow-warning/20",
        info:
          "bg-info text-background hover:bg-info/90 shadow-sm hover:shadow-md hover:shadow-info/20",
        outline:
          "border-2 border-primary bg-background text-primary hover:bg-primary/10 hover:border-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        ghost: "hover:bg-accent/50 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        "glass-primary":
          "bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-primary hover:bg-primary/20 glow-primary hover:glow-inset",
        "glass-success":
          "bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-success hover:bg-success/20 glow-success hover:glow-inset",
        "glass-warning":
          "bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-warning hover:bg-warning/20 glow-warning hover:glow-inset",
        "glass-info":
          "bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-info hover:bg-info/20 glow-info hover:glow-inset",
        "glass-destructive":
          "bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-destructive hover:bg-destructive/20 glow-destructive hover:glow-inset",
        "glass-muted":
          "bg-white/5 border border-white/10 backdrop-blur-md shadow-sm text-muted-foreground hover:bg-accent/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
