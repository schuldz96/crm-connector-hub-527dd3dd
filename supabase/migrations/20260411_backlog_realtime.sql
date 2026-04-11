-- Enable Realtime for kanban boards
-- Required for live updates without page refresh

-- Backlog Board (Super Admin)
ALTER PUBLICATION supabase_realtime ADD TABLE admin.backlog_tasks;
ALTER TABLE admin.backlog_tasks REPLICA IDENTITY FULL;

-- CRM Kanbans (Deals & Tickets)
ALTER PUBLICATION supabase_realtime ADD TABLE crm.negocios;
ALTER TABLE crm.negocios REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE crm.tickets_crm;
ALTER TABLE crm.tickets_crm REPLICA IDENTITY FULL;
