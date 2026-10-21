/**
 * M16: Compliance Check Modal
 *
 * Shows image/container compliance results before server creation.
 * Groups capabilities by category with status icons.
 */

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import type { ComplianceReport, CapabilityCheckResult, CheckDetail } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ComplianceCheckModalProps {
  report: ComplianceReport | null;
  isLoading: boolean;
  error: string | null;
  open: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

const statusIcon = (status: string, size = 'h-4 w-4') => {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className={`${size} text-green-500`} />;
    case 'warn':
      return <AlertTriangle className={`${size} text-yellow-500`} />;
    case 'fail':
      return <XCircle className={`${size} text-red-500`} />;
    case 'unknown':
      return <HelpCircle className={`${size} text-muted-foreground`} />;
    default:
      return null;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'pass': return 'Supported';
    case 'warn': return 'Partial';
    case 'fail': return 'Unsupported';
    case 'unknown': return 'Unknown';
    default: return status;
  }
};

const categoryLabel = (category: string) => {
  switch (category) {
    case 'storage': return 'Storage';
    case 'config': return 'Configuration';
    case 'backup': return 'Backup';
    case 'rcon': return 'RCON';
    case 'health': return 'Health';
    default: return category;
  }
};

const categoryOrder = ['storage', 'config', 'backup', 'rcon', 'health'];

function CheckDetailRow({ check }: { check: CheckDetail }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground pl-6">
      <span className="mt-0.5">{check.pass ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}</span>
      <span>
        <span className="font-mono">{check.key}</span>
        {check.found !== null && <span className="ml-1">= {check.found}</span>}
        {check.detail && <span className="ml-1 italic">— {check.detail}</span>}
      </span>
    </div>
  );
}

function CapabilityRow({ capability }: { capability: CapabilityCheckResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasChecks = capability.checks.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChecks && setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-muted/50 transition-colors ${hasChecks ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {statusIcon(capability.status)}
        <span className="text-sm flex-1">{capability.name}</span>
        <Badge
          variant="outline"
          className={`text-xs ${
            capability.status === 'pass' ? 'border-green-500/30 text-green-600 dark:text-green-400' :
            capability.status === 'warn' ? 'border-yellow-500/30 text-yellow-600 dark:text-yellow-400' :
            capability.status === 'fail' ? 'border-red-500/30 text-red-600 dark:text-red-400' :
            'border-muted-foreground/30 text-muted-foreground'
          }`}
        >
          {statusLabel(capability.status)}
        </Badge>
        {hasChecks && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
      {expanded && hasChecks && (
        <div className="space-y-1 pb-1">
          {capability.checks.map((check, i) => (
            <CheckDetailRow key={i} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ComplianceCheckModal({
  report,
  isLoading,
  error,
  open,
  onProceed,
  onCancel,
}: ComplianceCheckModalProps) {
  // Group capabilities by category
  const grouped = report?.capabilities.reduce((acc, cap) => {
    const cat = cap.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cap);
    return acc;
  }, {} as Record<string, CapabilityCheckResult[]>);

  const hasFailures = report && report.summary.fail > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Image Compatibility Check
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? 'Checking image compatibility with ZedOps features...'
              : error
                ? 'Compatibility check encountered an error'
                : 'Review which ZedOps features this image supports'}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Pulling and inspecting image...
            </p>
            <p className="text-xs text-muted-foreground">
              This may take up to 60 seconds on first pull
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Check failed</span>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              You can still proceed — the server will be created without a compatibility report.
            </p>
          </div>
        )}

        {/* Report */}
        {report && !isLoading && (
          <div className="space-y-4">
            {/* Image info */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded truncate max-w-[250px]">
                {report.imageRef}
              </span>
              <span className="text-xs text-muted-foreground">
                {report.mode} check
              </span>
            </div>

            {/* Summary badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {report.summary.pass > 0 && (
                <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {report.summary.pass} pass
                </Badge>
              )}
              {report.summary.warn > 0 && (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {report.summary.warn} warn
                </Badge>
              )}
              {report.summary.fail > 0 && (
                <Badge variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400">
                  <XCircle className="h-3 w-3 mr-1" />
                  {report.summary.fail} fail
                </Badge>
              )}
              {report.summary.unknown > 0 && (
                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  {report.summary.unknown} unknown
                </Badge>
              )}
            </div>

            {/* Grouped capabilities */}
            <div className="space-y-3">
              {categoryOrder
                .filter(cat => grouped && grouped[cat])
                .map(cat => (
                  <div key={cat}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {categoryLabel(cat)}
                    </h4>
                    <div className="border rounded-md divide-y">
                      {grouped![cat].map(cap => (
                        <CapabilityRow key={cap.id} capability={cap} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Warning if failures */}
            {hasFailures && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Some features may not work with this image. You can still create the server.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onProceed}
            disabled={isLoading}
            variant={hasFailures ? 'destructive' : 'default'}
          >
            {isLoading ? 'Checking...' : error ? 'Proceed Without Check' : hasFailures ? 'Proceed Anyway' : 'Create Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
