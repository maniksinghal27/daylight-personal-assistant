CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX workspaces_owner ON workspaces(owner);
CREATE TABLE credentials (owner TEXT PRIMARY KEY, encrypted TEXT NOT NULL);
CREATE TABLE oauth_states (id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE service_state (id TEXT PRIMARY KEY, value TEXT NOT NULL);
