-- AI Copilot OS - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to create all required tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable Realtime for all tables (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE workflows;

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own conversations"
  ON conversations FOR ALL USING (auth.uid() = user_id);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage messages in their conversations"
  ON messages FOR ALL USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  );

-- Workflows
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  triggers JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own workflows"
  ON workflows FOR ALL USING (auth.uid() = user_id);

-- Workflow Executions
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their workflow executions"
  ON workflow_executions FOR SELECT USING (
    EXISTS (SELECT 1 FROM workflows WHERE id = workflow_id AND user_id = auth.uid())
  );

-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  system_prompt TEXT,
  tools JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agents_user_id ON agents(user_id);
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own agents"
  ON agents FOR ALL USING (auth.uid() = user_id);

-- Memory
CREATE TABLE memory (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('short-term', 'long-term')),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_memory_user_id ON memory(user_id);
ALTER TABLE memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own memory"
  ON memory FOR ALL USING (auth.uid() = user_id);

-- Connectors
CREATE TABLE connectors (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_connectors_user_id ON connectors(user_id);
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own connectors"
  ON connectors FOR ALL USING (auth.uid() = user_id);

-- Plugins
CREATE TABLE plugins (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  author TEXT,
  verified BOOLEAN DEFAULT FALSE,
  config_schema JSONB DEFAULT '{}'
);
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plugins are readable by all authenticated users"
  ON plugins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Plugins are insertable by authenticated users"
  ON plugins FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Plugins are deletable by owners"
  ON plugins FOR DELETE USING (auth.role() = 'authenticated');

-- MCP Endpoints
CREATE TABLE mcp_endpoints (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'http',
  status TEXT NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mcp_endpoints_user_id ON mcp_endpoints(user_id);
ALTER TABLE mcp_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own MCP endpoints"
  ON mcp_endpoints FOR ALL USING (auth.uid() = user_id);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '["read"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own API keys"
  ON api_keys FOR ALL USING (auth.uid() = user_id);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT USING (auth.uid() = user_id);
