/**
 * M16: Per-field compliance hook
 *
 * Maps UI field IDs to capability IDs, resolves status from a compliance report.
 */

import { useMemo } from 'react';
import type { ComplianceReport, CapabilityCheckResult } from '../lib/api';

// Maps field IDs to the capability IDs they depend on.
// Field ID format: "{tab}.{section}.{field}" or "{tab}.{action}"
export const fieldCapabilityMap: Record<string, string[]> = {
  // Overview tab
  'overview.disk.bin':          ['disk-bin'],
  'overview.disk.data':         ['disk-data'],
  'overview.disk.total':        ['disk-bin', 'disk-data'],
  'overview.disk.mount':        ['disk-bin'],
  'overview.disk.capacity':     ['disk-bin'],
  'overview.info.dataPath':     ['data-path'],
  'overview.health':            ['healthcheck'],
  'overview.rconConnected':     ['rcon'],
  'overview.players':           ['player-stats'],
  'overview.action.saveWorld':  ['graceful-save'],
  'overview.action.broadcast':  ['rcon'],

  // Config tab — mods
  'config.mods.installed':        ['mod-display'],
  'config.mods.workshopInstalled': ['mod-display'],

  // Config tab — per ENV var
  'config.field.ADMIN_PASSWORD':         ['env-config'],
  'config.field.SERVER_PASSWORD':        ['env-config'],
  'config.field.MAX_PLAYERS':            ['env-config'],
  'config.field.SERVER_MAP':             ['env-config'],
  'config.field.SERVER_PUBLIC':          ['env-config'],
  'config.field.SERVER_OPEN':            ['env-config'],
  'config.field.SERVER_PVP':             ['env-config'],
  'config.field.SERVER_PAUSE_EMPTY':     ['env-config'],
  'config.field.SERVER_GLOBAL_CHAT':     ['env-config'],
  'config.field.SERVER_WELCOME_MESSAGE': ['env-config'],
  'config.field.SERVER_PUBLIC_DESCRIPTION': ['env-config'],
  'config.field.SERVER_MODS':            ['env-config'],
  'config.field.SERVER_WORKSHOP_ITEMS':  ['env-config'],
  'config.field.BETABRANCH':             ['env-config'],
  'config.field.TZ':                     ['env-config'],
  'config.field.PUID':                   ['env-config'],
  'config.field.SERVER_PUBLIC_NAME':     ['env-config'],

  // Backup tab
  'backup.create':  ['backup'],
  'backup.restore': ['backup'],

  // RCON tab
  'rcon.terminal': ['rcon'],

  // Performance tab
  'performance.players': ['player-stats'],
};

export interface FieldComplianceResult {
  /** null = no compliance report (legacy server, assumed compatible) */
  status: 'pass' | 'warn' | 'fail' | 'unknown' | null;
  /** Human-readable explanation for tooltip */
  tooltip: string | null;
  /** Whether the field should be non-interactive */
  disabled: boolean;
  /** Detailed check results for the relevant capabilities */
  details: CapabilityCheckResult[];
}

/**
 * Resolve compliance status for a specific UI field.
 */
export function useFieldCompliance(
  fieldId: string,
  compliance: ComplianceReport | null | undefined
): FieldComplianceResult {
  return useMemo(() => {
    // No report = legacy server, assume everything works
    if (!compliance) {
      return { status: null, tooltip: null, disabled: false, details: [] };
    }

    // Not in map = no compliance dependency
    const capIds = fieldCapabilityMap[fieldId];
    if (!capIds) {
      return { status: null, tooltip: null, disabled: false, details: [] };
    }

    // Find matching capabilities in the report
    const matchedCaps = capIds
      .map(id => compliance.capabilities.find(c => c.id === id))
      .filter((c): c is CapabilityCheckResult => c !== undefined);

    if (matchedCaps.length === 0) {
      return { status: 'unknown', tooltip: 'Capability not checked', disabled: false, details: [] };
    }

    // Special case for config.field.* — also check specific ENV var
    if (fieldId.startsWith('config.field.')) {
      const envVar = fieldId.replace('config.field.', '');
      const envVars = compliance.discovered.envVars || {};
      const envConfigCap = matchedCaps.find(c => c.id === 'env-config');

      if (envConfigCap) {
        // If env-config capability passes but this specific var is missing
        if (!(envVar in envVars)) {
          return {
            status: 'warn',
            tooltip: `This image may not support the ${envVar} setting`,
            disabled: false,
            details: matchedCaps,
          };
        }
      }
    }

    // Aggregate: worst status wins
    const statuses = matchedCaps.map(c => c.status);
    let worstStatus: 'pass' | 'warn' | 'fail' | 'unknown' = 'pass';
    if (statuses.includes('fail')) worstStatus = 'fail';
    else if (statuses.includes('warn')) worstStatus = 'warn';
    else if (statuses.includes('unknown')) worstStatus = 'unknown';

    // Build tooltip
    const tooltipParts = matchedCaps.map(c => `${c.name}: ${c.status}`);
    const tooltip = tooltipParts.join(', ');

    return {
      status: worstStatus,
      tooltip,
      disabled: worstStatus === 'fail',
      details: matchedCaps,
    };
  }, [fieldId, compliance]);
}
