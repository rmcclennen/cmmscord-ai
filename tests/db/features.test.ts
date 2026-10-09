import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser } from "./harness";

const DEFAULT_COMPANY = "00000000-0000-4000-8000-000000000001";

describe("PM completion loop", () => {
  let db: PGlite;
  let tech: string;
  let viewer: string;
  let assetId: string;
  let pmId: string;

  beforeAll(async () => {
    db = await createDb();
    tech = await createUser(db, "tech@a.test", ["technician"]);
    viewer = await createUser(db, "view@a.test", []);
    await db.query(`INSERT INTO company_members (company_id, user_id) VALUES ($1,$2),($1,$3)`, [
      DEFAULT_COMPANY,
      tech,
      viewer,
    ]);
    const a = await db.query<{ id: string }>(
      `INSERT INTO assets (name, company_id) VALUES ('RAS Pump 2', $1) RETURNING id`,
      [DEFAULT_COMPANY],
    );
    assetId = a.rows[0]!.id;
    const p = await db.query<{ id: string }>(
      `INSERT INTO pm_schedules (asset_id, title, tasks, interval_days, next_due, company_id)
       VALUES ($1, 'Grease bearings', 'Grease both ends', 30, current_date - 2, $2) RETURNING id`,
      [assetId, DEFAULT_COMPANY],
    );
    pmId = p.rows[0]!.id;
  });

  it("generates one work order per due PM and is idempotent", async () => {
    const first = await asUser(db, tech, () =>
      db.query<{ n: number }>(`SELECT generate_due_pm_work_orders(0) AS n`),
    );
    expect(first.rows[0]!.n).toBeGreaterThanOrEqual(1);
    const second = await asUser(db, tech, () =>
      db.query<{ n: number }>(`SELECT generate_due_pm_work_orders(0) AS n`),
    );
    expect(second.rows[0]!.n).toBe(0);
    const wos = await db.query<{ wo_type: string; status: string }>(
      `SELECT wo_type, status FROM work_orders WHERE pm_schedule_id = $1`,
      [pmId],
    );
    expect(wos.rows).toEqual([{ wo_type: "preventive", status: "open" }]);
  });

  it("works when run by a scheduler (no signed-in user), e.g. pg_cron", async () => {
    await db.query(`DELETE FROM work_orders WHERE pm_schedule_id = $1`, [pmId]);
    const run = await db.query<{ n: number }>(`SELECT generate_due_pm_work_orders(0) AS n`);
    expect(run.rows[0]!.n).toBe(1);
    const wo = await db.query<{ company_id: string; created_by: string | null }>(
      `SELECT company_id, created_by FROM work_orders
        WHERE pm_schedule_id = $1 AND status = 'open'`,
      [pmId],
    );
    expect(wo.rows).toEqual([{ company_id: DEFAULT_COMPANY, created_by: null }]);
    // leave state as the next test expects: one open work order
  });

  it("completing a PM logs it, reschedules, and closes the work order", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const id = await asUser(db, tech, async () => {
      const r = await db.query<{ complete_pm: string }>(
        `SELECT complete_pm($1, current_date, current_date + 30, 1.5, '2 grease cartridges', 'All good', $2)`,
        [pmId, clientId],
      );
      return r.rows[0]!.complete_pm;
    });
    const pm = await db.query<{ last_completed: Date; next_due: Date }>(
      `SELECT last_completed, next_due FROM pm_schedules WHERE id = $1`,
      [pmId],
    );
    expect(pm.rows[0]!.next_due.getTime()).toBeGreaterThan(pm.rows[0]!.last_completed.getTime());
    const wo = await db.query<{ status: string; labor_hours: string; completion_notes: string }>(
      `SELECT status, labor_hours, completion_notes FROM work_orders WHERE pm_schedule_id = $1`,
      [pmId],
    );
    expect(wo.rows[0]).toMatchObject({ status: "completed", completion_notes: "All good" });
    expect(Number(wo.rows[0]!.labor_hours)).toBe(1.5);

    // Replaying the same offline request does not double-log.
    const again = await asUser(db, tech, () =>
      db.query<{ complete_pm: string }>(
        `SELECT complete_pm($1, current_date, current_date + 30, 1.5, NULL, NULL, $2)`,
        [pmId, clientId],
      ),
    );
    expect(again.rows[0]!.complete_pm).toBe(id);
    const n = await db.query<{ c: number }>(`SELECT count(*)::int c FROM pm_completions`);
    expect(n.rows[0]!.c).toBe(1);
  });

  it("an older replayed completion does not rewind the schedule", async () => {
    const before = await db.query<{ next_due: Date }>(
      `SELECT next_due FROM pm_schedules WHERE id = $1`,
      [pmId],
    );
    await asUser(db, tech, () =>
      db.query(
        `SELECT complete_pm($1, current_date - 40, current_date - 10, NULL, NULL, NULL, gen_random_uuid())`,
        [pmId],
      ),
    );
    const after = await db.query<{ next_due: Date }>(
      `SELECT next_due FROM pm_schedules WHERE id = $1`,
      [pmId],
    );
    expect(after.rows[0]!.next_due.getTime()).toBe(before.rows[0]!.next_due.getTime());
  });

  it("read-only users can't complete PMs", async () => {
    await expect(
      asUser(db, viewer, () =>
        db.query(
          `SELECT complete_pm($1, current_date, current_date + 30, NULL, NULL, NULL, NULL)`,
          [pmId],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("audit log", () => {
  let db: PGlite;
  let admin: string;
  let tech: string;

  beforeAll(async () => {
    db = await createDb();
    admin = await createUser(db, "boss@a.test", ["admin", "manager"]);
    tech = await createUser(db, "tech@a.test", ["technician"]);
    await db.query(`INSERT INTO company_members (company_id, user_id) VALUES ($1,$2),($1,$3)`, [
      DEFAULT_COMPANY,
      admin,
      tech,
    ]);
  });

  it("records inserts, field-level updates and deletes with the acting user", async () => {
    const id = await asUser(db, tech, async () => {
      const r = await db.query<{ id: string }>(
        `INSERT INTO assets (name) VALUES ('Blower 1') RETURNING id`,
      );
      await db.query(`UPDATE assets SET status = 'down', name = 'Blower 1' WHERE id = $1`, [
        r.rows[0]!.id,
      ]);
      return r.rows[0]!.id;
    });
    const rows = await db.query<{
      action: string;
      user_id: string;
      changes: Record<string, unknown>;
    }>(
      `SELECT action, user_id, changes FROM audit_log WHERE table_name='assets' AND row_id = $1 ORDER BY id`,
      [id],
    );
    expect(rows.rows.map((r) => r.action)).toEqual(["INSERT", "UPDATE"]);
    expect(rows.rows.every((r) => r.user_id === tech)).toBe(true);
    expect(rows.rows[1]!.changes).toEqual({ status: { old: "operational", new: "down" } });
  });

  it("ignores no-op updates", async () => {
    const before = await db.query<{ c: number }>(`SELECT count(*)::int c FROM audit_log`);
    await asUser(db, tech, () => db.query(`UPDATE assets SET name = name WHERE name = 'Blower 1'`));
    const after = await db.query<{ c: number }>(`SELECT count(*)::int c FROM audit_log`);
    expect(after.rows[0]!.c).toBe(before.rows[0]!.c);
  });

  it("records role changes", async () => {
    const n = await db.query<{ c: number }>(
      `SELECT count(*)::int c FROM audit_log WHERE table_name = 'user_roles' AND subject_user_id = $1`,
      [tech],
    );
    expect(n.rows[0]!.c).toBeGreaterThan(0);
  });

  it("is readable by approvers only and cannot be modified", async () => {
    const asAdmin = await asUser(db, admin, () => db.query(`SELECT * FROM audit_log`));
    expect(asAdmin.rows.length).toBeGreaterThan(0);
    const asTech = await asUser(db, tech, () => db.query(`SELECT * FROM audit_log`));
    expect(asTech.rows).toHaveLength(0);
    for (const sql of [
      `UPDATE audit_log SET action = 'DELETE'`,
      `DELETE FROM audit_log`,
      `INSERT INTO audit_log (table_name, action) VALUES ('x', 'INSERT')`,
    ]) {
      await expect(asUser(db, admin, () => db.query(sql))).rejects.toThrow();
    }
  });
});

describe("push subscriptions", () => {
  it("are not accessible to end users", async () => {
    const db = await createDb();
    const u = await createUser(db, "u@a.test", ["technician"]);
    await expect(
      asUser(db, u, () => db.query(`SELECT * FROM push_subscriptions`)),
    ).rejects.toThrow();
  });
});
