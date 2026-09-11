import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('catalog IDs and authenticated writes enforce permissions', async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>/^00[1-9]_/.test(f)).sort()) await db.exec((await readFile(new URL(file,dir),'utf8')).replace('create extension if not exists "pgcrypto";',''));
 const admin='00000000-0000-0000-0000-000000000001';
 await db.exec(`insert into auth.users values ('${admin}'); insert into public.profiles(id,is_admin) values ('${admin}',true);`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 await db.exec('set role authenticated');
 const p=(await db.query("insert into public.products(name) values ('Teste') returning id,id_produto,ean,sku")).rows[0];
 assert.equal(p.id_produto,1); assert.equal(p.ean,p.sku);
 await db.query('update public.products set name=$1 where id=$2',['Editado',p.id]);
 await assert.rejects(db.query('update public.products set id_produto=99'),/permission denied/);
 await db.exec('reset role');
 await db.exec(`update public.profiles set is_admin=false where id='${admin}'`);
 await db.exec('set role authenticated');
 await assert.rejects(db.query("insert into public.products(name) values ('Bloqueado')"),/row-level security/);
 await db.exec('reset role');
 const k=(await db.query("insert into public.kits(name) values ('Kit') returning id_kit")).rows[0];
 assert.equal(k.id_kit,1);
 }finally{await db.close();}
});

