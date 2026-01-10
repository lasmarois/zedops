// Server types for ZedOps server management

export interface Server {
  id: string;
  agent_id: string;
  name: string;
  container_id: string | null;
  config: string; // JSON string of ENV variables
  image_tag: string;
  game_port: number;
  udp_port: number;
  rcon_port: number;
  status: ServerStatus;
  data_exists: boolean; // Whether server data exists on host (bin/ or data/ directories)
  deleted_at: number | null; // Timestamp of soft delete (NULL = not deleted)
  created_at: number;
  updated_at: number;
}

export type ServerStatus = 'creating' | 'running' | 'stopped' | 'missing' | 'failed' | 'deleted' | 'deleting';

export interface ServerConfig {
  [key: string]: string; // ENV variables as key-value pairs
}

export interface CreateServerRequest {
  name: string;
  imageTag: string;
  config: ServerConfig;
  gamePort?: number; // Optional, will auto-suggest if not provided
  udpPort?: number;  // Optional, calculated as gamePort + 1
  rconPort?: number; // Optional, will auto-suggest if not provided
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
