import type { Database } from "../../shared/database.js";

type StatusCount = { status: string; count: number };

function countMap(rows: StatusCount[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Number(((part / total) * 100).toFixed(1));
}

export class VerticalOneReportService {
  constructor(private readonly database: Database) {}

  summary(now = new Date()) {
    const leads = countMap(this.database.prepare("SELECT status, COUNT(*) AS count FROM leads GROUP BY status").all() as unknown as StatusCount[]);
    const offers = countMap(this.database.prepare("SELECT status, COUNT(*) AS count FROM commercial_offers GROUP BY status").all() as unknown as StatusCount[]);
    const tasks = countMap(this.database.prepare("SELECT status, COUNT(*) AS count FROM tasks GROUP BY status").all() as unknown as StatusCount[]);
    const approvals = countMap(this.database.prepare("SELECT status, COUNT(*) AS count FROM offer_approvals GROUP BY status").all() as unknown as StatusCount[]);
    const overdueTasks = this.database.prepare("SELECT COUNT(*) AS count FROM tasks WHERE status = 'OPEN' AND due_at < ?")
      .get(now.toISOString()) as { count: number };
    const leadTotal = (leads.NEW ?? 0) + (leads.QUALIFIED ?? 0) + (leads.CONVERTED ?? 0);
    const taskTotal = (tasks.OPEN ?? 0) + (tasks.COMPLETED ?? 0);
    const pendingApprovals = approvals.PENDING ?? 0;

    return {
      generatedAt: now.toISOString(),
      leads: {
        total: leadTotal,
        new: leads.NEW ?? 0,
        qualified: leads.QUALIFIED ?? 0,
        converted: leads.CONVERTED ?? 0,
        conversionRatePercent: percentage(leads.CONVERTED ?? 0, leadTotal),
      },
      offers: {
        total: (offers.DRAFT ?? 0) + (offers.PENDING_APPROVAL ?? 0) + (offers.APPROVED ?? 0) + (offers.REJECTED ?? 0),
        draft: offers.DRAFT ?? 0,
        pendingApproval: offers.PENDING_APPROVAL ?? 0,
        approved: offers.APPROVED ?? 0,
        rejected: offers.REJECTED ?? 0,
      },
      approvals: {
        pending: pendingApprovals,
        approved: approvals.APPROVED ?? 0,
        rejected: approvals.REJECTED ?? 0,
      },
      tasks: {
        total: taskTotal,
        open: tasks.OPEN ?? 0,
        completed: tasks.COMPLETED ?? 0,
        overdue: overdueTasks.count,
        completionRatePercent: percentage(tasks.COMPLETED ?? 0, taskTotal),
      },
      attention: {
        total: overdueTasks.count + pendingApprovals,
        overdueTasks: overdueTasks.count,
        pendingApprovals,
      },
    };
  }
}
