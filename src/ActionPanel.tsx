import { useEffect, useRef, useState } from 'react';
export default function ActionPanel({onAdd,addLabel='Adicionar',search,onSearch}:{onAdd?:()=>void;addLabel?:string;search?:string;onSearch?:(value:string)=>void}) {
  const [searchOpen,setSearchOpen]=useState(Boolean(search));
  const input=useRef<HTMLInputElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node))setSearchOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  useEffect(()=>{if(searchOpen)input.current?.focus();},[searchOpen]);
  return <div ref={panel} className="actionPanel" role="group" aria-label="Ações da página" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setSearchOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){setSearchOpen(false);trigger.current?.focus();}}}>
    {onSearch&&searchOpen&&<div className="searchPopup" role="search" aria-label="Busca no catálogo"><input ref={input} className="actionSearch" aria-label="Buscar produtos" placeholder="Digite para buscar…" value={search??''} onChange={e=>onSearch(e.target.value)}/><button type="button" title="Limpar busca" aria-label="Limpar busca" onClick={()=>{onSearch('');input.current?.focus();}}>×</button></div>}
    {onSearch&&<button ref={trigger} type="button" className="roundAction" title={searchOpen?'Fechar busca':search?'Buscar — filtro ativo':'Buscar'} aria-label={searchOpen?'Fechar busca':'Buscar'} aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>{search&&<span className="searchActive" aria-label="Filtro ativo"/>}</button>}
    {onAdd&&<button type="button" className="roundAction addAction" title={addLabel} aria-label={addLabel} onClick={onAdd}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>}
  </div>;
}
