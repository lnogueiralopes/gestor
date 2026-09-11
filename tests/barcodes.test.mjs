import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

function validInternal(code) {
  assert.match(code, /^04[0-9]{11}$/);
  const sum = [...code].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0);
  assert.equal(sum % 10, 0);
}

test('internal barcodes: migration, shared uniqueness, check digit, preservation and kitmix sequence', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
    for (const file of ['001_initial_schema.sql','002_access_hardening.sql','003_ean_sku.sql']) {
      const sql = await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
      await db.exec(sql.replace('create extension if not exists "pgcrypto";', ''));
    }
    const seed = await readFile(new URL('../supabase/seed.sql',import.meta.url), 'utf8');
    await db.exec(seed);
    // Occupy the first candidate before migration: allocation must skip it.
    await db.exec("insert into public.products(sku,ean,name) values ('0400000000015','0400000000015','Imported internal'); insert into public.products(sku,name) values ('MISSING','No EAN');");
    await db.exec(await readFile(new URL('../supabase/migrations/004_internal_barcodes.sql',import.meta.url), 'utf8'));
    await db.exec(seed); await db.exec(seed);
    const originalKits = (await db.query('select * from public.kits order by name')).rows;
    assert.equal(originalKits.length, 3);
    assert.equal(originalKits.find(k => k.name === 'Trio Argentina').sku,'kitmix_00001');
    assert.equal(originalKits.find(k => k.name === 'Kit 2 Catena Malbec').sku,'7790000000011_x2');
    originalKits.forEach(k => {validInternal(k.ean); assert.equal(k.ean_is_internal,true);});
    assert.equal((await db.query("select ean from public.products where name='Imported internal'")).rows[0].ean,'0400000000015');
    const missing = (await db.query("select * from public.products where name='No EAN'")).rows[0];
    validInternal(missing.ean); assert.equal(missing.sku,missing.ean);
    const batch = (await db.query("insert into public.products(name) select 'Batch ' || n from generate_series(1,20) n returning ean,sku,ean_is_internal")).rows;
    batch.forEach(p => {validInternal(p.ean);assert.equal(p.sku,p.ean);assert.equal(p.ean_is_internal,true);});
    const all = (await db.query('select ean from public.products union all select ean from public.kits')).rows.map(x=>x.ean);
    assert.equal(new Set(all).size,all.length);
    await assert.rejects(db.query('insert into public.products(name,ean) values ($1,$2)', ['Collision',originalKits[0].ean]), /já reservado/);
    await assert.rejects(db.query("insert into public.kits(name,ean) values ('Collision','7790000000011')"), /já reservado/);
    await assert.rejects(db.query("insert into public.products(name,ean) values ('Bad','0400000000010')"), /verificador/);
    await db.query("update public.products set ean='',ean_is_internal=false where id=$1",[missing.id]);
    const preserved=(await db.query('select * from public.products where id=$1',[missing.id])).rows[0];
    assert.equal(preserved.ean,missing.ean);assert.equal(preserved.ean_is_internal,true);
    const kitId=originalKits.find(k=>k.name==='Kit 2 Catena Malbec').id;
    const originalBarcode=originalKits.find(k=>k.id===kitId).ean;
    await db.query('update public.kit_items set quantity=4 where kit_id=$1',[kitId]);
    const edited=(await db.query('select * from public.kits where id=$1',[kitId])).rows[0];
    assert.equal(edited.sku,'7790000000011_x4');assert.equal(edited.ean,originalBarcode);
    await db.exec('begin');
    const newKit=(await db.query("insert into public.kits(name) values ('New mixed') returning id,ean")).rows[0];
    await db.query('insert into public.kit_items select $1,id,1 from public.products where ean in ($2,$3)',[newKit.id,'7790000000011','7790000000028']);
    await db.exec('commit');
    assert.equal((await db.query('select sku from public.kits where id=$1',[newKit.id])).rows[0].sku,'kitmix_00002');
    await db.query('delete from public.kits where id=$1',[newKit.id]);
    await assert.rejects(db.query("insert into public.kits(name,ean) values ('Retired code',$1)",[newKit.ean]), /já reservado/);
    await db.exec('begin');
    const nextKit=(await db.query("insert into public.kits(name) values ('Next mixed') returning id")).rows[0];
    await db.query('insert into public.kit_items select $1,id,1 from public.products where ean in ($2,$3)',[nextKit.id,'7790000000011','7790000000028']);
    await db.exec('commit');
    assert.equal((await db.query('select sku from public.kits where id=$1',[nextKit.id])).rows[0].sku,'kitmix_00003');
    await db.exec("select setval('private.kitmix_sequence',99999); begin;");
    const largeKit=(await db.query("insert into public.kits(name) values ('Large sequence') returning id")).rows[0];
    await db.query('insert into public.kit_items select $1,id,1 from public.products where ean in ($2,$3)',[largeKit.id,'7790000000011','7790000000028']);
    await db.exec('commit');
    assert.equal((await db.query('select sku from public.kits where id=$1',[largeKit.id])).rows[0].sku,'kitmix_100000');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from private.barcode_registry'), /permission denied/);
    await assert.rejects(db.query("select private.reserve_barcode('product',gen_random_uuid(),null)"), /permission denied/);
  } finally {await db.close();}
});

test('fresh database applies all migrations before repeatable demo seed', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
    for (const file of ['001_initial_schema.sql','002_access_hardening.sql','003_ean_sku.sql','004_internal_barcodes.sql','005_kit_margin_bands.sql']) {
      const sql = await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
      await db.exec(sql.replace('create extension if not exists "pgcrypto";', ''));
    }
    const seed = await readFile(new URL('../supabase/seed.sql',import.meta.url), 'utf8');
    await db.exec(seed); await db.exec(seed);
    const bands=(await db.query('select min_units,max_units,reduction_pp from public.kit_margin_rules order by min_units')).rows;
    assert.deepEqual(bands.map(r=>[r.min_units,r.max_units,Number(r.reduction_pp)]),[[1,1,0],[2,2,1],[3,3,1],[4,4,2],[5,5,2],[6,6,3],[7,null,3]]);
    await db.exec('update public.kit_margin_rules set reduction_pp=1.25 where min_units=2');
    assert.equal(Number((await db.query('select reduction_pp from public.kit_margin_rules where min_units=3')).rows[0].reduction_pp),1);
    assert.equal((await db.query('select min_units from public.kit_margin_rules where min_units<=100 and (max_units is null or max_units>=100)')).rows[0].min_units,7);
    const kits=(await db.query('select sku,ean from public.kits order by ean')).rows;
    assert.deepEqual(kits,[
      {sku:'7790000000011_x2',ean:'0400000000015'},
      {sku:'7790000000011_x3',ean:'0400000000022'},
      {sku:'kitmix_00001',ean:'0400000000039'},
    ]);
  } finally {await db.close();}
});
