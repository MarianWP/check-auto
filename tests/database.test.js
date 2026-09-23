import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
let pg;
const alice = "00000000-0000-0000-0000-000000000001", bob = "00000000-0000-0000-0000-000000000002";
const sql = name => readFileSync(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    insert into auth.users values ('${alice}'), ('${bob}');
  `);
  const init = sql("20260922000000_init.sql");
  const start = init.indexOf("create table if not exists public.inspections (");
  await pg.exec(init.slice(start, init.indexOf("-- ----------", start)));
  await pg.exec(sql("20260923000000_assistant.sql"));
  await pg.exec(sql("20260924000000_custom_models.sql"));
  await pg.exec(sql("20260925000000_reliable_sync_and_usage.sql"));
  // Supabase grants table privileges by default; RLS must still constrain them.
  await pg.exec("grant select, insert, update, delete on all tables in schema public to authenticated;");
}, 20000);
beforeEach(async () => {
  await pg.exec("reset role; truncate public.inspections, public.ai_usage, public.assistant_messages;");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
});
afterAll(async () => { await pg?.close(); });
const record = (name = "test") => ({ model: "golf5", name, price: 100, cfg: { engine: "mpi14" }, answers: {}, stage: 0, done: false, created_at: new Date(1000).toISOString(), updated_at: new Date(2000).toISOString() });
async function sync(id, revision, data) {
  const res = await pg.query("select public.sync_inspection($1, $2, $3::jsonb) as result", [id, revision, data && JSON.stringify(data)]);
  return res.rows[0].result;
}
it("accepts only the expected revision and retains a tombstone", async () => {
  await pg.exec("set role authenticated");
  const first = await sync("test", 0, record()); expect(first.row.revision).toBe(1);
  const second = await sync("test", 1, record("new")); expect(second.row.revision).toBe(2);
  const conflict = await sync("test", 1, record("stale"));
  expect(conflict.conflict).toBe(true); expect(conflict.row.name).toBe("new");
  const deleted = await sync("test", 2, null); expect(deleted.row.deleted_at).toBeTruthy();
  expect((await sync("test", 3, record("resurrect"))).conflict).toBe(true);
});
it("rejects writes to another account and prevents bypassing the RPC", async () => {
  await sync("private", 0, record());
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [bob]);
  await pg.exec("set role authenticated");
  expect((await pg.query("select * from public.inspections")).rows).toHaveLength(0);
  await expect(sync("private", 0, record())).rejects.toThrow(/another account/);
  await expect(pg.query("insert into public.inspections(id,user_id,cfg) values('bypass',$1,'{}')", [bob])).rejects.toThrow(/row-level security/);
  const changed = await pg.query("delete from public.inspections where id='private'");
  expect(changed.affectedRows).toBe(0);
});
it("denies anonymous sync and client quota reservation", async () => {
  await pg.exec("set role anon");
  await expect(sync("x", 0, record())).rejects.toThrow(/permission denied/);
  await pg.exec("reset role; set role authenticated");
  await expect(pg.query("select public.reserve_ai_usage($1,'assistant',30)", [alice])).rejects.toThrow(/permission denied/);
});
it("does not restore quota when chat history is deleted", async () => {
  await pg.exec("set role service_role");
  const reserve = async () => (await pg.query("select public.reserve_ai_usage($1,'assistant',2) as result", [alice])).rows[0].result;
  expect((await reserve()).remaining).toBe(1);
  expect((await reserve()).remaining).toBe(0);
  await pg.exec("reset role; delete from public.assistant_messages; set role service_role");
  expect(await reserve()).toEqual({ allowed: false, remaining: 0 });
});
it("separates quotas by user and feature and expires the rolling window", async () => {
  await pg.query("select public.reserve_ai_usage($1,'assistant',1)", [alice]);
  const result = await pg.query("select public.reserve_ai_usage($1,'assistant',1) a, public.reserve_ai_usage($2,'generate',1) b", [bob, alice]);
  expect(result.rows[0].a.allowed).toBe(true); expect(result.rows[0].b.allowed).toBe(true);
  await pg.exec("update public.ai_usage set created_at = now() - interval '25 hours'");
  expect((await pg.query("select public.reserve_ai_usage($1,'assistant',1) as result", [alice])).rows[0].result.allowed).toBe(true);
});
