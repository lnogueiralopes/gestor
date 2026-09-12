import { supabase } from './lib/supabase';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const groups = [
  {label:'Produtos',items:[['/produtos','Cadastro de produtos'],['/kits','Cadastro de Kits']]},
  {label:'Canais de venda',items:[['/precificador','Precificador'],['/anuncios','Anúncios'],['/contas','Marketplace']]},
  {label:'Vendas',items:[['/pedidos','Pedidos']]},
  {label:'Estoque',items:[['/estoque/cadastro','Cadastro de estoque'],['/estoque/movimentacoes','Movimentações'],['/estoque/inventario','Inventário']]},
  {label:'Automação',items:[['/automacoes','Agendamentos']]},
  {label:'Sistema',items:[['/usuarios','Usuários'],['/configuracoes','Configurações']]},
];
export default function TopNavigation() {
  const [signingOut,setSigningOut]=useState(false);
  const [exitError,setExitError]=useState('');
  const [open,setOpen]=useState<string|null>(null);
  const root=useRef<HTMLElement>(null);
  const location=useLocation();
  useEffect(()=>setOpen(null),[location.pathname]);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(null);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  return <header className="topNavigation" ref={root} onKeyDown={e=>{if(e.key==='Escape'){setOpen(null); const group=(e.target as HTMLElement).closest('.navGroup');(group?.querySelector('button') as HTMLButtonElement)?.focus();}}}>

    <NavLink to="/dashboard" className="rocketWordmark" aria-label="Rocket — início"><span>ROCKET</span></NavLink>
    <nav aria-label="Navegação principal" className="topLinks">
      <NavLink to="/dashboard" className="overviewLink">DASHBOARD</NavLink>
      {groups.map((group,index)=>{const expanded=open===group.label;const active=group.items.some(([path])=>path===location.pathname);return <div key={group.label} className="navGroup" onMouseEnter={()=>setOpen(group.label)} onMouseLeave={()=>setOpen(null)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(null);}}>
        <button type="button" className={active?'groupActive':''} aria-expanded={expanded} aria-controls={`nav-group-${index}`} onClick={()=>setOpen(expanded?null:group.label)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(group.label);requestAnimationFrame(()=>document.getElementById(`nav-group-${index}`)?.querySelector('a')?.focus());}}}>
          {group.label}<span aria-hidden="true">⌄</span>
        </button><div className="navDropdown" id={`nav-group-${index}`} hidden={!expanded}>{group.items.map(([path,label])=><NavLink key={path} to={path} onClick={()=>setOpen(null)}>{label}{path.startsWith('/estoque/')&&<small>Em preparação</small>}</NavLink>)}</div>
      </div>;})}
    </nav>
    <NavLink to="/minha-conta" className="accountCircle" aria-label="Minha conta" title="Minha conta"><svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C5 2 2 5 3 10c.5 3 3 5 5 7l4 5 4-5c2-2 4.5-4 5-7 1-5-2-8-9-8Z"/><path fill="#b8ee20" d="M5.5 8.5c3-.5 5 1.5 5 4.5-3.5 0-5-1.5-5-4.5Zm13 0c0 3-1.5 4.5-5 4.5 0-3 2-5 5-4.5ZM10 17h4v1h-4Z"/></svg></NavLink>
    <button className="signOutIcon" type="button" title="Sair" aria-label="Sair da conta" disabled={signingOut} onClick={async()=>{setSigningOut(true);setExitError('');try{const result=await supabase!.auth.signOut();if(result.error)setExitError('Não foi possível sair. Tente novamente.');}catch{setExitError('Falha de conexão ao sair.');}finally{setSigningOut(false);}}}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 4H4v16h6M14 7l5 5-5 5M8 12h11"/></svg></button>{exitError&&<span className="exitError" role="alert">{exitError}</span>}
  </header>;
}
