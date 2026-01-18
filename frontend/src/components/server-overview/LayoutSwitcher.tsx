import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LayoutGrid, Rows3, LayoutDashboard, PanelLeft } from "lucide-react"

export type OverviewLayout = 'grid' | 'stacked' | 'masonry' | 'sidebar'

interface LayoutSwitcherProps {
  value: OverviewLayout
  onChange: (layout: OverviewLayout) => void
}

const layoutOptions: { value: OverviewLayout; label: string; icon: React.ReactNode }[] = [
  { value: 'grid', label: 'Grid', icon: <LayoutGrid className="h-4 w-4" /> },
  { value: 'stacked', label: 'Stacked', icon: <Rows3 className="h-4 w-4" /> },
  { value: 'masonry', label: 'Masonry', icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: 'sidebar', label: 'Sidebar', icon: <PanelLeft className="h-4 w-4" /> },
]

export function LayoutSwitcher({ value, onChange }: LayoutSwitcherProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as OverviewLayout)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Layout" />
      </SelectTrigger>
      <SelectContent>
        {layoutOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
