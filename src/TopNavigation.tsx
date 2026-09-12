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
    <NavLink to="/minha-conta" className="accountCircle" aria-label="Minha conta" title="Minha conta"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg></NavLink>
  </header>;
}

