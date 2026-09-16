import {useEffect,useState} from 'react';
import {listingCall} from './Listings';
export default function AccountPriceTables(){
 const [data,setData]=useState<any>({accounts:[],tables:[],settings:[]}),[error,setError]=useState(''),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{listingCall('account-tables').then(setData).catch(e=>setError(e.message));},[]);
 const save=async(account_id:string,pricing_table_id:string)=>{setBusy(account_id);setError('');setMessage('');try{await listingCall('assign-table',{account_id,pricing_table_id});setData((old:any)=>({...old,settings:[...old.settings.filter((s:any)=>s.account_id!==account_id),{account_id,pricing_table_id}]}));setMessage('Tabela da conta salva.');}catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy('');}};
 return <div className="card"><h3>Tabelas por conta Mercado Livre</h3>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{data.accounts.map((a:any)=><label key={a.id}>{a.name} · {a.external_account_id}<select aria-label={'Tabela da conta '+a.name} disabled={busy===a.id} value={data.settings.find((s:any)=>s.account_id===a.id)?.pricing_table_id||''} onChange={e=>void save(a.id,e.target.value)}><option value="" disabled>Selecione uma tabela</option>{data.tables.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>)}{!data.accounts.length&&<p>Nenhuma conta Mercado Livre conectada.</p>}</div>;
}
