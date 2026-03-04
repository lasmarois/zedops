// Server types for ZedOps server management

export interface Server {
  id: string;
  agent_id: string;
  name: string;
  container_id: string | null;
  config: string; // JSON string of ENV variables
  image: string | null; // M9.8.32: Per-server image override (NULL = use agent's steam_zomboid_registry)
  image_tag: string;
  game_port: number;
  udp_port: number;
  rcon_port: number;
  status: ServerStatus;
  data_exists: boolean; // Whether server data exists on host (bin/ or data/ directories)
  deleted_at: number | null; // Timestamp of soft delete (NULL = not deleted)
  created_at: number;
  updated_at: number;
  image_compliance: string | null; // M16: JSON blob of ComplianceReport (NULL = legacy, no check done)
}

// ─── Compliance Types (M16) ──────────────────────────────────────────

export interface ComplianceReport {
  success: boolean;
  imageRef: string;
  checkedAt: string; // ISO 8601
  mode: 'image' | 'container';
  discovered: DiscoveredProperties;
  capabilities: CapabilityCheckResult[];
  summary: ComplianceSummary;
  error?: string;
}

export interface DiscoveredProperties {
  volumes?: string[];
  mounts?: MountInfo[];
  envVars: Record<string, string>;
  networks?: string[];
  healthcheck: boolean;
  exposedPorts?: string[];
  health?: string;
}

export interface MountInfo {
  source: string;
  destination: string;
  type: string;
}

export interface CapabilityCheckResult {
  id: string;
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  category: 'config' | 'backup' | 'rcon' | 'storage' | 'health';
  checks: CheckDetail[];
}

export interface CheckDetail {
  type: 'mount' | 'env' | 'network';
  key: string;
  pass: boolean;
  found: string | null;
  detail?: string;
}

export interface ComplianceSummary {
  pass: number;
  warn: number;
  fail: number;
  unknown: number;
}

export type ServerStatus = 'creating' | 'running' | 'stopped' | 'missing' | 'failed' | 'deleted' | 'deleting';

export interface ServerConfig {
  [key: string]: string; // ENV variables as key-value pairs
}

export interface CreateServerRequest {
  name: string;
  image?: string; // M9.8.32: Custom image path (optional, NULL = use agent's steam_zomboid_registry)
  imageTag: string;
  config: ServerConfig;
  gamePort?: number; // Optional, will auto-suggest if not provided
  udpPort?: number;  // Optional, calculated as gamePort + 1
  rconPort?: number; // Optional, will auto-suggest if not provided
  server_data_path?: string; // Optional, M9.8.23: Per-server path override (NULL = inherit from agent)
  imageCompliance?: ComplianceReport; // M16: Pre-checked compliance report to store
}

export interface CreateServerResponse {
  success: boolean;
  server?: Server;
  error?: string;
}

export interface DeleteServerRequest {
  removeVolumes?: boolean; // Default: false (preserve volumes)
}

export interface DeleteServerResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ServerListResponse {
  success: boolean;
  servers?: Server[];
  error?: string;
}
