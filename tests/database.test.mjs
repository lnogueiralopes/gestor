import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migrations, seed, account isolation and read-only browser roles', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    const initial = await readFile(new URL('../supabase/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
    // PGlite provides gen_random_uuid in core; production pgcrypto extension setup is Supabase-specific.
    await db.exec(initial.replace('create extension if not exists "pgcrypto";', ''));
    await db.exec(await readFile(new URL('../supabase/migrations/002_access_hardening.sql', import.meta.url), 'utf8'));
    const seed = await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
    await db.exec(seed); await db.exec(seed);
    // Simulate data created by the original V1 before applying the new SKU rule.
    await db.exec("update public.products set sku='LEGACY_' || ean; update public.kits set sku='OLD_' || sku where sku like '%_x%';");
    await db.exec(await readFile(new URL('../supabase/migrations/003_ean_sku.sql', import.meta.url), 'utf8'));
    await db.exec(seed);
    assert.equal((await db.query('select * from public.products where sku <> ean')).rows.length, 0);
    assert.deepEqual((await db.query('select sku from public.kits order by sku')).rows.map(r => r.sku), ['7790000000011_x2', '7790000000011_x3', 'KIT003']);
    assert.equal((await db.query('select * from public.products')).rows.length, 3);
    assert.deepEqual((await db.query('select available_quantity from public.kit_availability order by sku')).rows.map(r => r.available_quantity), [15, 10, 12]);
    const operator = '00000000-0000-0000-0000-000000000001';
    const admin = '00000000-0000-0000-0000-000000000002';
    const inactive = '00000000-0000-0000-0000-000000000003';
    await db.exec(`insert into auth.users values ('${operator}'), ('${admin}'), ('${inactive}');
      insert into public.profiles(id,is_admin,is_active) values
      ('${operator}', false, true), ('${admin}', true, true), ('${inactive}', true, false);
      insert into public.user_permissions select '${operator}', id from public.permissions where code = 'products.view';
      insert into public.user_marketplace_accounts select '${operator}', id from public.marketplace_accounts where channel='mercadolivre';
      insert into public.listings(entity_type,product_id,account_id)
        select 'product', p.id, a.id from public.products p cross join public.marketplace_accounts a where p.sku='7790000000011';`);
    assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public' and not rowsecurity")).rows[0].n, 0);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.products'), /permission denied/);
    await assert.rejects(db.query('select * from public.kit_availability'), /permission denied/);
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [operator]);
    assert.equal((await db.query('select * from public.products')).rows.length, 3);
    assert.equal((await db.query('select * from public.marketplace_accounts')).rows.length, 1);
    assert.equal((await db.query('select * from public.listings')).rows.length, 1);
    assert.equal((await db.query('select * from public.pricing_parameters')).rows.length, 0);
    for (const table of ['audit_logs','sync_jobs','inventory_movements']) {
      assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    }
    await assert.rejects(db.query('update public.profiles set is_admin=true'), /permission denied/);
    await assert.rejects(db.query("insert into public.products(sku,name) values ('X','X')"), /permission denied/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    assert.equal((await db.query('select * from public.marketplace_accounts')).rows.length, 3);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [inactive]);
    for (const table of ['products','marketplace_accounts','profiles','kit_availability']) {
      assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    }
    await db.exec('reset role');
    await assert.rejects(db.query(`insert into public.listings(entity_type,product_id,account_id)
      select entity_type,product_id,account_id from public.listings limit 1`), /duplicate key/);
    await db.exec("insert into public.products(sku,ean,name) values ('IGNORED','0012345678905','Teste EAN');");
    assert.equal((await db.query("select sku from public.products where name='Teste EAN'")).rows[0].sku, '0012345678905');
    await db.exec("insert into public.kits(sku,name) values ('TEMP','Kit teste'); insert into public.kit_items select k.id,p.id,2 from public.kits k,public.products p where k.name='Kit teste' and p.name='Teste EAN';");
    assert.equal((await db.query("select sku from public.kits where name='Kit teste'")).rows[0].sku, '0012345678905_x2');
    await db.exec("update public.kit_items set quantity=3 where kit_id=(select id from public.kits where name='Kit teste');");
    assert.equal((await db.query("select sku from public.kits where name='Kit teste'")).rows[0].sku, '0012345678905_x3');
    await db.exec("update public.products set ean='0012345678912' where name='Teste EAN'; update public.kits set sku='MANUAL' where name='Kit teste';");
    assert.equal((await db.query("select sku from public.kits where name='Kit teste'")).rows[0].sku, '0012345678912_x3');
    await db.exec("insert into public.kits(sku,name) values ('MIX001','Misto teste'); insert into public.kit_items select k.id,p.id,1 from public.kits k,public.products p where k.sku='MIX001' and p.ean in ('0012345678912','7790000000011');");
    assert.equal((await db.query("select sku from public.kits where name='Misto teste'")).rows[0].sku, 'MIX001');
    await assert.rejects(db.query("insert into public.products(sku,ean,name) values ('DUPLICATE','0012345678912','Duplicado')"), /duplicate key/);
    await db.exec("insert into public.kits(sku,name) values ('DUP-KIT','Duplicado');");
    await assert.rejects(db.query("insert into public.kit_items select k.id,p.id,3 from public.kits k,public.products p where k.sku='DUP-KIT' and p.ean='0012345678912'"), /duplicate key/);
  } finally { await db.close(); }
});
