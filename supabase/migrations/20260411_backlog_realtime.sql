-- Enable Realtime for backlog_tasks
-- Required for live kanban updates
ALTER PUBLICATION supabase_realtime ADD TABLE admin.backlog_tasks;

-- Ensure full row data is sent on updates (needed for realtime payload)
ALTER TABLE admin.backlog_tasks REPLICA IDENTITY FULL;
