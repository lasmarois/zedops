/**
 * M16: Inline compliance indicator for individual fields.
 *
 * Shows a small colored dot with tooltip when a compliance report exists.
 * Renders nothing if no report or no mapping for this field.
 */

import type { ComplianceReport } from '../lib/api';
import { useFieldCompliance } from '../hooks/useFieldCompliance';

interface FieldComplianceIndicatorProps {
  fieldId: string;
  compliance: ComplianceReport | null | undefined;
}

const dotColor = (status: string) => {
  switch (status) {
    case 'pass': return 'bg-green-500';
    case 'warn': return 'bg-yellow-500';
    case 'fail': return 'bg-red-500';
    case 'unknown': return 'bg-muted-foreground';
    default: return '';
  }
};

export function FieldComplianceIndicator({ fieldId, compliance }: FieldComplianceIndicatorProps) {
  const { status, tooltip } = useFieldCompliance(fieldId, compliance);

  if (!status) return null;

  return (
    <span title={tooltip || undefined} className="inline-flex items-center">
      <span className={`h-2 w-2 rounded-full ${dotColor(status)}`} />
    </span>
  );
}
