import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, createUser } from "./harness";

const DEFAULT_COMPANY = "00000000-0000-4000-8000-000000000001";

describe("company isolation", () => {
  let db: PGlite;
  let alice: string; // technician, default company
  let bob: string; // technician, second company
  let carol: string; // admin, default company
  let bobCompany: string;
  let aliceAsset: string;
  let bobAsset: string;

  beforeAll(async () => {
    db = await createDb();
    alice = await createUser(db, "alice@a.test", ["technician"]);
    bob = await createUser(db, "bob@b.test", ["technician"]);
    carol = await createUser(db, "carol@a.test", ["admin", "manager"]);
    await db.query(`INSERT INTO company_members (company_id, user_id) VALUES ($1, $2), ($1, $3)`, [
      DEFAULT_COMPANY,
      alice,
      carol,
    ]);
    const c = await db.query<{ id: string }>(
      `INSERT INTO companies (name) VALUES ('Beta Water District') RETURNING id`,
    );
    bobCompany = c.rows[0]!.id;
    await db.query(`INSERT INTO company_members (company_id, user_id) VALUES ($1, $2)`, [
      bobCompany,
      bob,
    ]);

    aliceAsset = await asUser(db, alice, async () => {
      const r = await db.query<{ id: string }>(
        `INSERT INTO assets (name) VALUES ('Alice pump') RETURNING id`,
      );
      return r.rows[0]!.id;
    });
    bobAsset = await asUser(db, bob, async () => {
      const r = await db.query<{ id: string }>(
        `INSERT INTO assets (name) VALUES ('Bob blower') RETURNING id`,
      );
      return r.rows[0]!.id;
    });
  });

  it("fills company_id from the caller's company", async () => {
    const { rows } = await db.query<{ id: string; company_id: string }>(
      `SELECT id, company_id FROM assets WHERE id IN ($1, $2)`,
      [aliceAsset, bobAsset],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.company_id]));
    expect(byId[aliceAsset]).toBe(DEFAULT_COMPANY);
    expect(byId[bobAsset]).toBe(bobCompany);
  });

  it("each user sees only their own company's assets", async () => {
    const a = await asUser(db, alice, () => db.query<{ name: string }>(`SELECT name FROM assets`));
    const b = await asUser(db, bob, () => db.query<{ name: string }>(`SELECT name FROM assets`));
    const aNames = a.rows.map((r) => r.name);
    expect(aNames).toContain("Alice pump"); // plus the seeded plant assets
    expect(aNames).not.toContain("Bob blower");
    expect(b.rows.map((r) => r.name)).toEqual(["Bob blower"]);
  });

  it("blocks writing into another company's data", async () => {
    await expect(
      asUser(db, bob, () =>
        db.query(`UPDATE assets SET name = 'hacked' WHERE id = $1`, [aliceAsset]),
      ),
    ).resolves.toMatchObject({ affectedRows: 0 });
    await expect(
      asUser(db, bob, () =>
        db.query(`INSERT INTO assets (name, company_id) VALUES ('x', $1)`, [DEFAULT_COMPANY]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("child rows inherit the parent asset's company and can't cross over", async () => {
    await asUser(db, alice, () =>
      db.query(`INSERT INTO work_orders (title, asset_id) VALUES ('Fix pump', $1)`, [aliceAsset]),
    );
    const wo = await db.query<{ company_id: string }>(
      `SELECT company_id FROM work_orders WHERE title = 'Fix pump'`,
    );
    expect(wo.rows[0]!.company_id).toBe(DEFAULT_COMPANY);
    // Bob targeting Alice's asset resolves to Alice's company -> rejected.
    await expect(
      asUser(db, bob, () =>
        db.query(`INSERT INTO work_orders (title, asset_id) VALUES ('Sabotage', $1)`, [aliceAsset]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("company_id cannot be changed by users", async () => {
    await expect(
      asUser(db, alice, () =>
        db.query(`UPDATE assets SET company_id = $1 WHERE id = $2`, [bobCompany, aliceAsset]),
      ),
    ).rejects.toThrow();
  });

  it("hides people from other companies", async () => {
    const seenByBob = await asUser(db, bob, () =>
      db.query<{ user_id: string }>(`SELECT user_id FROM user_roles`),
    );
    expect(seenByBob.rows.length).toBeGreaterThan(0);
    expect(seenByBob.rows.every((r) => r.user_id === bob)).toBe(true); // only his own roles
    const dir = await asUser(db, alice, () =>
      db.query<{ id: string }>(`SELECT id FROM team_directory`),
    );
    expect(dir.rows.some((r) => r.id === bob)).toBe(false);
  });

  it("people tables are readable by teammates without policy recursion", async () => {
    const dir = await asUser(db, alice, () =>
      db.query<{ id: string }>(`SELECT id FROM team_directory`),
    );
    const ids = dir.rows.map((r) => r.id);
    expect(ids).toContain(alice);
    expect(ids).toContain(carol);
    const prof = await asUser(db, alice, () => db.query<{ id: string }>(`SELECT id FROM profiles`));
    expect(prof.rows.map((r) => r.id)).not.toContain(bob);
  });

  it("an admin of company A cannot grant roles to company B users", async () => {
    await expect(
      asUser(db, carol, () =>
        db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`, [bob]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("notifications can't be sent across companies", async () => {
    await expect(
      asUser(db, alice, () =>
        db.query(`INSERT INTO notifications (user_id, title) VALUES ($1, 'phish')`, [bob]),
      ),
    ).rejects.toThrow(/row-level security/i);
    await asUser(db, alice, () =>
      db.query(`INSERT INTO notifications (user_id, title) VALUES ($1, 'hello')`, [carol]),
    );
  });

  it("users with no company see nothing and cannot write", async () => {
    const dave = await createUser(db, "dave@x.test", ["technician"]);
    const r = await asUser(db, dave, () => db.query(`SELECT * FROM assets`));
    expect(r.rows).toHaveLength(0);
    await expect(
      asUser(db, dave, () => db.query(`INSERT INTO assets (name) VALUES ('nope')`)),
    ).rejects.toThrow(/not a member|row-level security/i);
  });

  it("create_company is limited to admins/managers and adds the creator", async () => {
    await expect(
      asUser(db, alice, () => db.query(`SELECT create_company('Sneaky Co')`)),
    ).rejects.toThrow(/Only admins or managers/);
    const r = await asUser(db, carol, () =>
      db.query<{ create_company: string }>(`SELECT create_company('Gamma Utilities')`),
    );
    const id = r.rows[0]!.create_company;
    const m = await db.query(
      `SELECT 1 FROM company_members WHERE company_id = $1 AND user_id = $2`,
      [id, carol],
    );
    expect(m.rows).toHaveLength(1);
  });

  it("anonymous users get nothing", async () => {
    const r = await asUser(db, null, () => db.query(`SELECT * FROM assets`));
    expect(r.rows).toHaveLength(0);
    await expect(
      asUser(db, null, () => db.query(`INSERT INTO assets (name) VALUES ('anon')`)),
    ).rejects.toThrow();
  });
});
