import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=ts.transpileModule(await readFile(new URL('../src/lib/costImport.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {parseCostCsv,saveCostRow}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const header='EAN;SKU;Produto;Família;Custo atual;Margem atual (%);Novo custo;Nova margem (%)\r\n';
test('unchanged cost does not discard new margin from the uploaded format',()=>{
 const [row]=parseCostCsv(header+'7794450000149;7794450000149;Nicasia;Bebidas;39,17;35;39,17;40');
 assert.deepEqual(row.payload,{unit_cost:39.17,target_margin:40});assert.equal(row.error,'');
});
test('blank values stay untouched; sub-unit costs and decimal margins preserve precision',()=>{
 assert.deepEqual(parseCostCsv(header+'123;;Produto;Bebidas;10;30;;35,75')[0].payload,{target_margin:35.75});
 assert.deepEqual(parseCostCsv(header+'123;;Produto;Bebidas;10;30;0,50;0')[0].payload,{unit_cost:.5,target_margin:0});
 assert.deepEqual(parseCostCsv(header+'123;;Produto;Bebidas;10;30;;')[0].payload,{});
 assert.ok(parseCostCsv(header+'123;;Produto;Bebidas;10;30;;abc')[0].error);
});
test('quoted names with separators and Excel EAN wrappers retain column alignment',()=>{
 const [row]=parseCostCsv(header+'="123";123;"Nome; especial";Bebidas;10;30;10;40');
 assert.equal(row.ean,'123');assert.equal(row.payload.target_margin,40);
});
function client(result){let update;return {from(){return {select(){return this;},eq(){return this;},update(payload){update=payload;return this;},async single(){return update?result:{data:{id:'id',ean:'123',unit_cost:39.17,target_margin:35}};}};}};}
test('only confirmed returned values count as success; invisible or denied updates fail',async()=>{
 const payload={unit_cost:39.17,target_margin:40};
 assert.equal((await saveCostRow(client({data:{id:'id',unit_cost:39.17,target_margin:40}}),'123',payload)).after.target_margin,40);
 await assert.rejects(saveCostRow(client({data:null}),'123',payload),/confirmou/);
 await assert.rejects(saveCostRow(client({data:{unit_cost:39.17,target_margin:35}}),'123',payload),/diferem/);
});
