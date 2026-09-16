export function parseCostCsv(text:string){
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===';'||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==';'){if(row.some(v=>v.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}
    else cell+=c;
  }
  if(quoted)throw new Error('Aspas não fechadas no CSV.');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  const headers=rows.shift()?.map(v=>v.trim().toLowerCase())||[];
  const columns=['ean','novo custo','nova margem (%)'].map(h=>headers.indexOf(h));
  if(columns.some(i=>i<0))throw new Error('O CSV deve conter EAN, Novo custo e Nova margem (%).');
  const number=(raw:string)=>{let s=raw.trim().replace(/R\$|%|\s/g,'');if(!s)return undefined;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');if(!/^\d+(\.\d+)?$/.test(s))throw new Error('Valor numérico inválido: '+raw);return Number(s);};
  return rows.map((cells,index)=>{
    const ean=(cells[columns[0]]||'').trim().replace(/^=/,'');
    const payload:Record<string,number>={};let error='';
    try{if(!/^\d+$/.test(ean))throw new Error('EAN inválido');for(const [key,col] of [['unit_cost',columns[1]],['target_margin',columns[2]]] as const){const value=number(cells[col]||'');if(value!==undefined)payload[key]=value;}}
    catch(e){error=e instanceof Error?e.message:'Linha inválida';}
    return {line:index+2,ean,payload,error};
  });
}

export async function saveCostRow(client:any,ean:string,payload:Record<string,number>){
  const {data:before,error:readError}=await client.from('products').select('id,ean,unit_cost,target_margin').eq('ean',ean).single();
  if(readError||!before)throw new Error(readError?.message||'Produto não encontrado.');
  const {data:after,error}=await client.from('products').update(payload).eq('id',before.id).select('id,ean,unit_cost,target_margin').single();
  if(error||!after)throw new Error(error?.message||'O banco não confirmou a atualização. Verifique a permissão de edição.');
  if(Object.entries(payload).some(([key,value])=>Number(after[key])!==value))throw new Error('Os valores retornados pelo banco diferem dos enviados.');
  return {before,after};
}
