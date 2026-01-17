/**
 * ServerCardLayoutToggle - Toggle between expandable and compact server card layouts
 *
 * Allows users to choose their preferred layout. Preference is persisted in localStorage.
 */

import { useServerCardLayout } from '@/contexts/ServerCardLayoutContext';
import { Button } from '@/components/ui/button';
import { LayoutList, LayoutGrid } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ServerCardLayoutToggle() {
  const { layout, toggleLayout } = useServerCardLayout();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLayout}
            className="gap-2"
          >
            {layout === 'expandable' ? (
              <>
                <LayoutList className="h-4 w-4" />
                <span className="hidden sm:inline">Expandable</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Compact</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch to {layout === 'expandable' ? 'compact' : 'expandable'} layout</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
