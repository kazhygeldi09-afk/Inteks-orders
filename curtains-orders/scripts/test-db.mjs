// Tests the database migration and its access rules on an in-memory Postgres
// (PGlite), with a small stand-in for Supabase's `auth` schema.
// Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migration = readFileSync(
  new URL("../supabase/migrations/0001_init.sql", import.meta.url),
  "utf8",
);

const db = new PGlite();

// --- Supabase stand-in -------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb default '{}',
    raw_user_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);

await db.exec(migration);

// --- Users ---------------------------------------------------------------
async function addUser(email, role, name) {
  const meta = role ? { role, full_name: name } : {};
  const r = await db.query(
    "insert into auth.users (email, raw_app_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return r.rows[0].id;
}
const owner = await addUser("owner@x.kz", "owner", "Owner");
const manager = await addUser("manager@x.kz", "manager", "Manager");
const designerA = await addUser("a@x.kz", "designer", "Aigerim");
const designerB = await addUser("b@x.kz", "designer", "Bauyrzhan");
const callA = await addUser("call@x.kz", "call_center", "Call A");
const callB = await addUser("call2@x.kz", "call_center", "Call B");
const stranger = await addUser("stranger@x.kz", null, null);
const bogus = await addUser("bogus@x.kz", "superadmin", "Bogus");

// Run SQL as a signed-in user, inside a transaction that is rolled back
// unless `keep` is true.
async function as(uid, sql, params = [], keep = true) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const r = await tx.query(sql, params);
    if (!keep) await tx.rollback();
    return r.rows;
  });
}
async function fails(uid, sql, params, code) {
  try {
    await as(uid, sql, params);
  } catch (e) {
    if (code) assert.match(e.message, new RegExp(code), `expected ${code}, got: ${e.message}`);
    return;
  }
  assert.fail(`expected failure ${code ?? ""} for: ${sql}`);
}
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("  ✓", name);
}
const one = async (uid, sql, params) => (await as(uid, sql, params))[0];

console.log("Database tests");

await test("profiles get roles only from app_metadata", async () => {
  const rows = (await db.query("select email, role from public.profiles order by email")).rows;
  const byEmail = Object.fromEntries(rows.map((r) => [r.email, r.role]));
  assert.equal(byEmail["a@x.kz"], "designer");
  assert.equal(byEmail["stranger@x.kz"], null);
  assert.equal(byEmail["bogus@x.kz"], null);
});

let orderA; // designer A's own order
await test("designer creates an order with a deposit", async () => {
  orderA = (
    await one(designerA, "select public.create_order($1) as id", [
      { client_name: " Dana ", client_phone: "+7 701 000 0000", total_cost: "500000", deposit: "150000", deposit_method: "kaspi", status: "measuring" },
    ])
  ).id;
  const o = await one(designerA, "select * from public.orders where id = $1", [orderA]);
  assert.equal(o.client_name, "Dana");
  assert.equal(o.source, "designer");
  assert.equal(o.designer_id, designerA);
  assert.equal(Number(o.amount_paid), 150000);
  assert.equal(Number(o.remaining_balance), 350000);
});

await test("designer cannot create an order for another designer", async () => {
  const id = (await one(designerA, "select public.create_order($1) as id", [
    { client_name: "X", designer_id: designerB, source: "online" },
  ])).id;
  const o = (await db.query("select designer_id, source from public.orders where id = $1", [id])).rows[0];
  assert.equal(o.designer_id, designerA);
  assert.equal(o.source, "designer");
  await db.query("delete from public.orders where id = $1", [id]);
});

await test("deposit above total is refused", () =>
  fails(designerA, "select public.create_order($1)", [{ client_name: "X", total_cost: "100", deposit: "200" }], "OVERPAID"));

await test("users without a role can do nothing", async () => {
  await fails(stranger, "select public.create_order($1)", [{ client_name: "X" }], "NOT_ALLOWED");
  await fails(bogus, "select public.create_order($1)", [{ client_name: "X" }], "NOT_ALLOWED");
  assert.equal((await as(stranger, "select * from public.orders")).length, 0);
});

await test("nobody can write tables directly", async () => {
  await fails(designerA, "insert into public.orders (client_name, source, created_by) values ('x','designer',$1)", [designerA], "permission denied");
  await fails(manager, "update public.orders set total_cost = 1", [], "permission denied");
  await fails(designerA, "update public.profiles set role = 'owner'", [], "permission denied");
  await fails(manager, "delete from public.payments", [], "permission denied");
});

let online1, online2;
await test("call center creates online orders without money", async () => {
  online1 = (await one(callA, "select public.create_order($1) as id", [
    { client_name: "Online One", client_phone: "+7 777", client_address: "Almaty", total_cost: "999", deposit: "10" },
  ])).id;
  online2 = (await one(callB, "select public.create_order($1) as id", [{ client_name: "Online Two" }])).id;
  const o = (await db.query("select * from public.orders where id = $1", [online1])).rows[0];
  assert.equal(o.source, "online");
  assert.equal(o.designer_id, null);
  assert.equal(Number(o.total_cost), 0);
  assert.equal(Number(o.amount_paid), 0);
});

await test("call center sees only the orders they entered, via function", async () => {
  assert.equal((await as(callA, "select * from public.orders")).length, 0);
  const mine = await as(callA, "select * from public.my_entered_orders()");
  assert.deepEqual(mine.map((r) => r.id), [online1]);
  assert.equal(mine[0].editable, true);
  assert.equal("total_cost" in mine[0], false);
  await fails(designerA, "select * from public.my_entered_orders()", [], "NOT_ALLOWED");
});

await test("designers see only their own orders", async () => {
  const a = await as(designerA, "select id from public.orders");
  assert.deepEqual(a.map((r) => r.id), [orderA]);
  assert.equal((await as(designerB, "select id from public.orders")).length, 0);
  assert.equal((await as(designerB, "select * from public.payments")).length, 0);
  assert.equal((await as(designerB, "select * from public.order_changes")).length, 0);
});

await test("designers see unassigned online orders; call center does not", async () => {
  const open = await as(designerB, "select * from public.open_online_orders()");
  assert.deepEqual(open.map((r) => r.id).sort(), [online1, online2].sort());
  await fails(callA, "select * from public.open_online_orders()", [], "NOT_ALLOWED");
});

await test("call center can fix their own order until it is taken", async () => {
  await fails(callA, "select public.update_order($1, $2, '')", [online1, { client_phone: "+7 700" }], "REASON_REQUIRED");
  await as(callA, "select public.update_order($1, $2, 'typo in phone')", [online1, { client_phone: "+7 700" }]);
  await fails(callA, "select public.update_order($1, $2, 'reason')", [online1, { total_cost: "5" }], "NOT_ALLOWED");
  await fails(callB, "select public.update_order($1, $2, 'reason')", [online1, { notes: "x" }], "NOT_ALLOWED");
});

await test("designer takes an online order; a second take fails", async () => {
  await as(designerB, "select public.take_order($1)", [online1]);
  await fails(designerA, "select public.take_order($1)", [online1], "ALREADY_TAKEN");
  await fails(manager, "select public.take_order($1)", [online2], "NOT_ALLOWED");
  const b = await as(designerB, "select id from public.orders");
  assert.deepEqual(b.map((r) => r.id), [online1]);
  const mine = await as(callA, "select * from public.my_entered_orders()");
  assert.equal(mine[0].designer_name, "Bauyrzhan");
  assert.equal(mine[0].editable, false);
});

await test("call center cannot change an order after a designer took it", () =>
  fails(callA, "select public.update_order($1, $2, 'reason')", [online1, { notes: "x" }], "NOT_ALLOWED"));

await test("designer edits need a reason and are logged", async () => {
  await fails(designerB, "select public.update_order($1, $2, '')", [online1, { total_cost: "300000" }], "REASON_REQUIRED");
  await as(designerB, "select public.update_order($1, $2, 'measured the windows')", [
    online1, { total_cost: "300000", status: "measuring" },
  ]);
  const log = await as(designerB, "select * from public.order_changes where order_id = $1 and action = 'updated' order by id", [online1]);
  const last = log.at(-1);
  assert.equal(last.reason, "measured the windows");
  assert.equal(last.changed_by_name, "Bauyrzhan");
  assert.equal(Number(last.changes.total_cost.new), 300000);
  assert.equal(last.changes.status.new, "measuring");
});

await test("designer cannot reassign or touch others' orders", async () => {
  await fails(designerB, "select public.update_order($1, $2, 'reason')", [online1, { designer_id: designerA }], "NOT_ALLOWED");
  await fails(designerB, "select public.update_order($1, $2, 'reason')", [orderA, { notes: "x" }], "NOT_ALLOWED");
  await fails(designerB, "select public.add_payment($1, 100)", [orderA], "NOT_ALLOWED");
  await fails(designerB, "select public.delete_order($1)", [online1], "NOT_ALLOWED");
});

let pay2;
await test("payments update amount paid and balance", async () => {
  await as(designerB, "select public.add_payment($1, 100000, '2026-11-01', 'cash', 'deposit')", [online1]);
  pay2 = (await one(designerB, "select public.add_payment($1, 50000, '2026-11-05', 'card', '') as id", [online1])).id;
  const p = await one(designerB, "select recorded_by_name from public.payments where id = $1", [pay2]);
  assert.equal(p.recorded_by_name, "Bauyrzhan");
  let o = await one(designerB, "select amount_paid, remaining_balance from public.orders where id = $1", [online1]);
  assert.equal(Number(o.amount_paid), 150000);
  assert.equal(Number(o.remaining_balance), 150000);
  await fails(designerB, "select public.add_payment($1, 150001)", [online1], "OVERPAID");
  await fails(designerB, "select public.add_payment($1, 0)", [online1], "INVALID_AMOUNT");
  await fails(designerB, "select public.update_order($1, $2, 'cheaper')", [online1, { total_cost: "100000" }], "TOTAL_BELOW_PAID");
  await fails(designerB, "select public.delete_payment($1, '')", [pay2], "REASON_REQUIRED");
  await as(designerB, "select public.delete_payment($1, 'entered twice')", [pay2]);
  o = await one(designerB, "select amount_paid from public.orders where id = $1", [online1]);
  assert.equal(Number(o.amount_paid), 100000);
  await fails(callA, "select public.add_payment($1, 100)", [online1], "NOT_ALLOWED");
});

await test("unpaid totals: designer gets own, manager gets all or one designer", async () => {
  const a = await one(designerA, "select * from public.unpaid_summary()");
  assert.equal(Number(a.total_unpaid), 350000);
  const m = await one(manager, "select * from public.unpaid_summary()");
  assert.equal(Number(m.total_unpaid), 350000 + 200000);
  assert.equal(Number(m.orders_with_balance), 2);
  const mb = await one(manager, "select * from public.unpaid_summary($1)", [designerB]);
  assert.equal(Number(mb.total_unpaid), 200000);
  const c = await one(callA, "select * from public.unpaid_summary()");
  assert.equal(Number(c.total_unpaid), 0);
});

await test("managers see everything and can reassign, edit and delete", async () => {
  assert.equal((await as(manager, "select id from public.orders")).length, 3);
  assert.equal((await as(owner, "select id from public.profiles")).length, 8);
  assert.equal((await as(designerA, "select id from public.profiles")).length, 1);
  await as(manager, "select public.update_order($1, $2, '')", [online2, { designer_id: designerA }]);
  assert.equal((await as(designerA, "select id from public.orders")).length, 2);
  await fails(manager, "select public.update_order($1, $2, '')", [online2, { designer_id: callA }], "INVALID_DESIGNER");
  const tmp = (await one(manager, "select public.create_order($1) as id", [{ client_name: "Temp", total_cost: "10" }])).id;
  await as(manager, "select public.delete_order($1)", [tmp]);
  assert.equal((await db.query("select 1 from public.orders where id = $1", [tmp])).rows.length, 0);
});

await test("reports are for managers only and add up", async () => {
  await fails(designerA, "select * from public.monthly_report(2026)", [], "NOT_ALLOWED");
  await fails(callA, "select * from public.yearly_report()", [], "NOT_ALLOWED");
  const months = await as(manager, "select * from public.monthly_report(2026)");
  assert.equal(months.length, 12);
  const sum = (k) => months.reduce((s, r) => s + Number(r[k]), 0);
  assert.equal(sum("orders_count"), 3);
  assert.equal(sum("sales"), 800000);
  assert.equal(sum("collected"), 250000);
  assert.equal(sum("outstanding"), 550000);
  const years = await as(owner, "select * from public.yearly_report()");
  assert.equal(years.length, 1);
  assert.equal(Number(years[0].sales), 800000);
  const forB = await as(manager, "select * from public.yearly_report($1)", [designerB]);
  assert.equal(Number(forB[0].collected), 100000);
});

await test("deactivated staff lose access immediately", async () => {
  await db.query("update public.profiles set active = false where id = $1", [designerA]);
  assert.equal((await as(designerA, "select id from public.orders")).length, 0);
  await fails(designerA, "select public.create_order($1)", [{ client_name: "X" }], "NOT_ALLOWED");
  await db.query("update public.profiles set active = true where id = $1", [designerA]);
});

await test("anonymous visitors can't call functions or read tables", async () => {
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("select public.create_order('{}')");
    }),
    /permission denied/,
  );
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("select * from public.orders");
    }),
    /permission denied/,
  );
});

console.log(`\n${passed} passed`);
