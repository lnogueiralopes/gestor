export const families=[{id:1,name:'Bebidas'},{id:2,name:'Suplementos'},{id:3,name:'Fertilizantes'}];
export function FamilyIcon({id}:{id:number}){
 const name=families.find(f=>f.id===id)?.name||'Família desconhecida';
 return <span title={name} role="img" aria-label={name}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{id===1?<><path d="M10 3h4v5l3 4v8H7v-8l3-4Z"/><path d="M7 14h10M10 5h4"/></>:id===2?<><path d="m8 4-4 4a5 5 0 0 0 7 7l5-5a5 5 0 0 0-7-7Z" transform="translate(2 2)"/><path d="m8 8 8 8"/></>:<><path d="M12 21V10M12 14C4 15 3 7 3 7s8-1 9 7ZM12 10C12 3 21 3 21 3s0 8-9 7Z"/></>}</svg></span>;
}
