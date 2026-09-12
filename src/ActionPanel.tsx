import { useEffect, useRef, useState } from 'react';
export default function ActionPanel({onAdd,addLabel='Adicionar',search,onSearch}:{onAdd?:()=>void;addLabel?:string;search?:string;onSearch?:(value:string)=>void}) {
  const [searchOpen,setSearchOpen]=useState(Boolean(search));
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(searchOpen)input.current?.focus();},[searchOpen]);
  return <div className="actionPanel" role="group" aria-label="Ações da página">
    {onSearch&&searchOpen&&<input ref={input} className="actionSearch" aria-label="Buscar produtos" placeholder="Digite para buscar…" value={search??''} onChange={e=>onSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){onSearch('');setSearchOpen(false);}}}/>}
    {onSearch&&<button type="button" className="roundAction" title={searchOpen?'Fechar busca':'Buscar'} aria-label={searchOpen?'Fechar busca':'Buscar'} aria-expanded={searchOpen} onClick={()=>{if(searchOpen)onSearch('');setSearchOpen(!searchOpen);}}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>}
    {onAdd&&<button type="button" className="roundAction addAction" title={addLabel} aria-label={addLabel} onClick={onAdd}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>}
  </div>;
}
