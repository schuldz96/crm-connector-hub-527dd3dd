-- Enable Realtime for kanban boards
-- Required for live updates without page refresh
-- Uses DO blocks to avoid errors if table is already in publication

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE admin.backlog_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE admin.backlog_tasks REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm.negocios;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE crm.negocios REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm.tickets_crm;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE crm.tickets_crm REPLICA IDENTITY FULL;
