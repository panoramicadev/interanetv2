-- Create task_groups table for user-specific task grouping per segment
CREATE TABLE IF NOT EXISTS task_groups (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segmento VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  color VARCHAR DEFAULT 'blue',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add group_id to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id VARCHAR;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_groups_user_segmento ON task_groups(user_id, segmento);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
