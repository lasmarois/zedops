-- Server Metrics History Table
-- Stores 3-day rolling window of server metrics for sparkline display
-- Collected at 10-second intervals per server

CREATE TABLE IF NOT EXISTS server_metrics_history (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    cpu_percent REAL,
    memory_percent REAL,
    memory_used_mb INTEGER,
    memory_limit_mb INTEGER,
    player_count INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Index for efficient queries by server and time range
CREATE INDEX IF NOT EXISTS idx_metrics_server_timestamp
ON server_metrics_history(server_id, timestamp DESC);

-- Index for cleanup queries (delete old records)
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
ON server_metrics_history(timestamp);
