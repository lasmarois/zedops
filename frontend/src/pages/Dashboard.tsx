import { Breadcrumb } from "@/components/layout/Breadcrumb"

export function Dashboard() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <Breadcrumb items={[{ label: "Dashboard" }]} />
        <h1 className="text-3xl font-bold mt-4">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Infrastructure overview and quick actions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Placeholder stats cards */}
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="text-sm text-muted-foreground">Agents</div>
          <div className="text-2xl font-bold mt-2">0</div>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="text-sm text-muted-foreground">Servers</div>
          <div className="text-2xl font-bold mt-2">0</div>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="text-sm text-muted-foreground">Users</div>
          <div className="text-2xl font-bold mt-2">0</div>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="text-sm text-muted-foreground">Players</div>
          <div className="text-2xl font-bold mt-2">0</div>
        </div>
      </div>

      <div className="text-muted-foreground text-sm">
        Phase 3: Full dashboard implementation coming soon...
      </div>
    </div>
  )
}
