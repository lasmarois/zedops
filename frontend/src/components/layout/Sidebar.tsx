import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Server,
  Laptop,
  Users,
  FileText,
  LayoutDashboard,
  Settings,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/contexts/UserContext"
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const infrastructureItems: NavItem[] = [
  { label: "Agents", href: "/agents", icon: Laptop },
  { label: "Servers", href: "/servers", icon: Server },
]

const managementItems: NavItem[] = [
  { label: "Users", href: "/users", icon: Users },
  { label: "Audit Logs", href: "/audit-logs", icon: FileText },
]

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const { user, logout } = useUser()
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)

  const handleNavClick = () => {
    // Close mobile menu when navigating
    if (onMobileClose) {
      onMobileClose()
    }
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return "U"
    const emailParts = user.email.split("@")[0]
    return emailParts.charAt(0).toUpperCase()
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full w-60 bg-card border-r border-border",
        // Mobile: fixed position, slide in from left
        "md:relative fixed inset-y-0 left-0 z-50",
        "transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="p-6">
        <Link to="/dashboard" className="group">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-info bg-clip-text text-transparent group-hover:from-info group-hover:to-primary transition-all duration-300">
            ZedOps
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Infrastructure Manager</p>
        </Link>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Dashboard */}
        <div>
          <NavLink
            href="/dashboard"
            icon={LayoutDashboard}
            label="Dashboard"
            active={location.pathname === "/dashboard" || location.pathname === "/"}
            onClick={handleNavClick}
          />
        </div>

        {/* Infrastructure */}
        <div>
          <SectionHeader>Infrastructure</SectionHeader>
          <div className="space-y-1">
            {infrastructureItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                count={item.count}
                active={location.pathname.startsWith(item.href)}
                onClick={handleNavClick}
              />
            ))}
          </div>
        </div>

        {/* Management (admin only) */}
        {user?.role === 'admin' && (
          <div>
            <SectionHeader>Management</SectionHeader>
            <div className="space-y-1">
              {managementItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  count={item.count}
                  active={location.pathname.startsWith(item.href)}
                  onClick={handleNavClick}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <Separator />

      {/* User Menu */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 ring-2 ring-primary/20">
            <span className="text-sm font-semibold text-primary">{getUserInitials()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{user?.role || 'User'}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email || 'No email'}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="flex-1" title="Change Password" onClick={() => setShowPasswordDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" title="Logout" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
      />
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  )
}

interface NavLinkProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  active?: boolean
  onClick?: () => void
}

function NavLink({ href, icon: Icon, label, count, active, onClick }: NavLinkProps) {
  return (
    <Link
      to={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <Icon className={cn(
        "h-5 w-5 transition-colors",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )} />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          active
            ? "bg-primary/20 text-primary font-semibold"
            : "text-muted-foreground group-hover:text-foreground"
        )}>
          {count}
        </span>
      )}
    </Link>
  )
}
