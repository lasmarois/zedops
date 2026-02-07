-- M12: Backup & Restore - Create backups table
CREATE TABLE backups (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'creating',  -- creating | complete | failed | deleting
    pre_save_success INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
CREATE INDEX idx_backups_server ON backups(server_id, created_at DESC);
