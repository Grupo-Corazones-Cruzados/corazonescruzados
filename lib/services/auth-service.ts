import { query } from "@/lib/db";

export async function getDashboardStats(role: string) {
  const stats: Record<string, number> = {};

  if (role === "admin") {
    const [users, members, clients, tickets, projects, invoices] =
      await Promise.all([
        query("SELECT COUNT(*) FROM users"),
        query("SELECT COUNT(*) FROM members WHERE is_active = true"),
        query("SELECT COUNT(*) FROM clients"),
        query("SELECT COUNT(*) FROM tickets WHERE status NOT IN ('completed', 'cancelled')"),
        query("SELECT COUNT(*) FROM projects WHERE status NOT IN ('completed', 'cancelled', 'partially_completed', 'not_completed')"),
        query("SELECT COUNT(*) FROM invoices WHERE status = 'pending'"),
      ]);

    stats.users = parseInt(users.rows[0].count, 10);
    stats.active_members = parseInt(members.rows[0].count, 10);
    stats.clients = parseInt(clients.rows[0].count, 10);
    stats.open_tickets = parseInt(tickets.rows[0].count, 10);
    stats.active_projects = parseInt(projects.rows[0].count, 10);
    stats.pending_invoices = parseInt(invoices.rows[0].count, 10);
  } else if (role === "member") {
    const [tickets, projects] = await Promise.all([
      query(
        `SELECT COUNT(*) FROM tickets
         WHERE member_id = (SELECT member_id FROM users WHERE role = 'member' LIMIT 1)
         AND status NOT IN ('completed', 'cancelled')`
      ),
      query(
        `SELECT COUNT(*) FROM projects
         WHERE status NOT IN ('completed', 'cancelled', 'partially_completed', 'not_completed')`
      ),
    ]);

    stats.open_tickets = parseInt(tickets.rows[0].count, 10);
    stats.active_projects = parseInt(projects.rows[0].count, 10);
  } else {
    // client
    const [tickets, projects, invoices] = await Promise.all([
      query("SELECT COUNT(*) FROM tickets WHERE status NOT IN ('completed', 'cancelled')"),
      query("SELECT COUNT(*) FROM projects WHERE status NOT IN ('completed', 'cancelled', 'partially_completed', 'not_completed')"),
      query("SELECT COUNT(*) FROM invoices WHERE status = 'pending'"),
    ]);

    stats.open_tickets = parseInt(tickets.rows[0].count, 10);
    stats.active_projects = parseInt(projects.rows[0].count, 10);
    stats.pending_invoices = parseInt(invoices.rows[0].count, 10);
  }

  return stats;
}
