import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1

        return (
          <div key={i} className="flex items-center gap-2">
            {item.href ? (
              <Link
                to={item.href}
                className={cn(
                  "transition-colors duration-200",
                  "text-muted-foreground hover:text-foreground hover:underline"
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-semibold">{item.label}</span>
            )}
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// Usage:
// <Breadcrumb items={[
//   { label: "Dashboard", href: "/dashboard" },
//   { label: "Agents", href: "/agents" },
//   { label: "maestroserver" }
// ]} />
