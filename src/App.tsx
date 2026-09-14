import TopNavigation from './TopNavigation';
import { useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { accounts, kits, kitMatrix, kitRules, pricingParameters, products, productMatrix, priceTables, type ChannelCell } from "./demo";

type MatrixProps = {
  kind: "products" | "kits";
};

function StatusBadge({ cell }: { cell: ChannelCell }) {
  const labels = {
    active: "Ativo",
    paused: "Pausado",
    draft: "Rascunho",
    error: "Erro",
    none: "Não publicado",
  };
  return (
    <div className={`status status-${cell.status}`}>
      <strong>{labels[cell.status]}</strong>
      {cell.price ? <span>R$ {cell.price.toFixed(2).replace(".", ",")}</span> : null}
    </div>
  );
}

function Sidebar() { return <TopNavigation />; }

function NavIcon({ path }: { path: string }) {
  const paths: Record<string, string> = {
    "/": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    "/produtos": "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z M3 7.5l9 4.5 9-4.5 M12 12v9 M7.5 5.25l9 4.5",
    "/kits": "M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H8a3 3 0 1 1 3-3l1 3z M12 8h4a3 3 0 1 0-3-3l-1 3z",
    "/precificador": "M5 2h14v20H5z M8 6h8 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M8 19h1 M15 19h1",
    "/anuncios": "M3 10h5l12-5v14L8 14H3z M8 14l2 7H6l-2-7",
    "/pedidos": "M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 7h6 M9 11h6 M9 15h3",
    "/contas": "M3 21h18 M4 9h16L12 3 4 9z M6 12v6 M12 12v6 M18 12v6",
    "/usuarios": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M18 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87",
    "/configuracoes": "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  };
  return <svg className="navIcon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[path]} /></svg>;
}

function PageHeader({ action }: { title: string; subtitle: string; action?: string }) {
  return (
    <div className="pageHeader" hidden={!action}>

      {action && <div className="actionPanel"><button className="roundAction addAction" disabled title={`${action} — em preparação`} aria-label={action}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>}
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão central da operação da Ruta Directa." />
      <div className="cards">
        <div className="card metric"><span>Produtos reais</span><strong>3</strong><small>Base central</small></div>
        <div className="card metric"><span>Kits</span><strong>3</strong><small>Composição virtual</small></div>
        <div className="card metric"><span>Canais</span><strong>3</strong><small>ML, Shopee e Shop</small></div>
        <div className="card metric"><span>Anúncios ativos</span><strong>9</strong><small>Demo</small></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Arquitetura central</h3>
          <div className="flow">
            <div>Produtos reais</div><span>→</span><div>Kits</div><span>→</span><div>Precificador</div><span>→</span><div>Canais</div>
          </div>
        </div>
        <div className="card">
          <h3>Próximas integrações</h3>
          <p className="muted">As operações reais serão implementadas na próxima etapa.</p>
          <div className="chips"><span>Mercado Livre</span><span>Shopee</span><span>Mercado Pago</span></div>
        </div>
      </div>
    </>
  );
}

function Matrix({ kind }: MatrixProps) {
  const rows = kind === "products" ? products : kits;
  const matrix = kind === "products" ? productMatrix : kitMatrix;
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const visibleRows = rows.filter(row => `${row.sku} ${row.ean} ${row.name}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  const allChecked = visibleRows.length > 0 && visibleRows.every(row => selected.includes(row.id));
  const toggleAll = () => setSelected(current => allChecked ? current.filter(id => !visibleRows.some(row => row.id === id)) : [...new Set([...current, ...visibleRows.map(row => row.id)])]);
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <>
      <PageHeader
        title={kind === "products" ? "Produtos" : "Kits"}
        subtitle={kind === "products" ? "Produtos físicos reais e cobertura por canal." : "Kits virtuais e cobertura por canal."}
        action={kind === "products" ? "Importar produtos" : "Criar kit"}
      />
      <div className="toolbar">
        <button disabled>Preparar publicação ({selected.length})</button>
        <button disabled>Atualizar preços</button>
        <button disabled>Sincronizar estoque</button>
        <span className="spacer" />
        <input aria-label="Buscar SKU, EAN ou produto" placeholder="Buscar SKU, EAN ou produto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="tableWrap card">
        <table>
          <thead>
            <tr>
              <th><input aria-label="Selecionar todos os resultados" type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th>SKU</th>
              <th>EAN / código interno</th>
              <th>{kind === "products" ? "Produto" : "Kit"}</th>
              {kind === "products" ? <><th>Estoque</th><th>Margem</th></> : <><th>Composição</th><th>Disponível</th></>}
              {accounts.map(a => <th key={a.id}>{a.name}<small>{a.channel}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row: any) => (
              <tr key={row.id}>
                <td><input aria-label={`Selecionar ${row.sku}`} type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td>
                <td><strong>{row.sku}</strong></td>
                <td><span className="barcodeNumber">{row.ean}</span>{row.eanIsInternal && <small className="internalCode" title="Código de uso interno; não é GTIN oficial para marketplaces">Uso interno</small>}</td>
                <td>{row.name}</td>
                {kind === "products" ? <><td>{row.stock}</td><td>{row.margin}%</td></> : <><td>{row.components}</td><td>{row.available}</td></>}
                {accounts.map(a => <td key={a.id}><StatusBadge cell={(matrix as any)[row.id][a.id]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Pricing() {
  const [params, setParams] = useState(pricingParameters);
  const [rules, setRules] = useState(kitRules);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showKitRules, setShowKitRules] = useState(false);
  const [costFile, setCostFile] = useState('');
  const [costFamily, setCostFamily] = useState('Todas');
  const [accountTables, setAccountTables] = useState(() => Object.fromEntries(accounts.map(account => [account.id, account.priceTable])));
  const tableFor = (account: typeof accounts[number]) => priceTables.filter(table => table.channel === account.channel);

  const updateParam = (i: number, value: string) =>
    setParams(p => p.map((x, idx) => idx === i ? { ...x, value } : x));

  const updateRule = (i: number, value: string) => {
    if (/^\d{0,6}([,.]\d{0,2})?$/.test(value))
      setRules(r => r.map((x, idx) => idx === i ? { ...x, reduction: value } : x));
  };
  const formatRule = (i: number) => setRules(r => r.map((x, idx) => {
    if (idx !== i) return x;
    const value = Number(x.reduction.replace(",", "."));
    return { ...x, reduction: (Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",") };
  }));

  return (
    <>
      <PageHeader title="Precificador" subtitle="Margens por produto, premissas e regras editáveis para kits." action="Recalcular preços" />
      <div className="card spreadsheetActions">
        <div><h3>Atualizar custos por planilha</h3><p className="muted">Baixe o modelo, edite apenas o novo custo usando o EAN como chave e selecione o arquivo para validação.</p></div>
        <div className="spreadsheetButtons"><label className="familySelect">Família<select value={costFamily} onChange={e=>setCostFamily(e.target.value)}><option>Todas</option><option>Bebidas</option><option>Suplementos</option><option>Fertilizantes</option></select></label><a className="primary" href={`/modelo-atualizacao-custos.xlsx?family=${encodeURIComponent(costFamily)}`} download>Baixar modelo Excel</a><label className="fileButton"><span>Selecionar planilha</span><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setCostFile(e.target.files?.[0]?.name||'')} /></label></div>
        {costFile&&<p className="fileSelected" role="status">Arquivo selecionado: {costFile}. O processamento será feito após a validação por EAN.</p>}
      </div>
      <div className="pricingEditorButtons"><button type="button" className="secondary" onClick={() => setShowAssumptions(value => !value)}>{showAssumptions ? 'Ocultar premissas' : 'Editar premissas'}</button><button type="button" className="secondary" onClick={() => setShowKitRules(value => !value)}>{showKitRules ? 'Ocultar regras de kits' : 'Editar regras de kits'}</button></div>
      {(showAssumptions || showKitRules) && <div className="grid2">
        {showAssumptions && <div className="card">
          <h3>Premissas</h3>
          <div className="formRows">
            {params.map((p, i) => (
              <label key={p.key}><span>{p.label}</span><div><input value={p.value} onChange={e => updateParam(i, e.target.value)} /><b>{p.suffix}</b></div></label>
            ))}
          </div>
          <button className="primary" disabled>Salvar premissas</button>
        </div>}
        {showKitRules && <div className="card">
          <h3>Redução de margem por kit</h3>
          <table className="compact">
            <thead><tr><th>Quantidade</th><th>Redução (p.p.)</th></tr></thead>
            <tbody>
              {rules.map((r, i) => <tr key={r.qty}><td>{r.qty}</td><td><input aria-label={`Redução para ${r.qty} unidades`} inputMode="decimal" value={r.reduction} onChange={e => updateRule(i, e.target.value)} onBlur={() => formatRule(i)} /></td></tr>)}
            </tbody>
          </table>
          <button className="primary" disabled>Salvar regras</button>
        </div>}
      </div>}
      <div className="card priceTableConfig">
        <h3>Tabela de preço por conta</h3>
        <p className="muted">Escolha qual tabela será usada para calcular e publicar os preços de cada canal.</p>
        <div className="formRows">
          {accounts.map(account => <label key={account.id}><span><strong>{account.name}</strong><small>{account.channel}</small></span><select value={accountTables[account.id]} onChange={e => setAccountTables(current => ({...current,[account.id]:e.target.value}))}>{tableFor(account).map(table => <option key={table.id} value={table.id}>{table.name}</option>)}</select></label>)}
        </div>
        <button className="primary" disabled>Salvar tabelas por conta</button>
      </div>
      <div className="card">
        <h3>Margem por produto</h3>
        <p className="muted">A tabela selecionada por conta será aplicada ao cálculo e à publicação dos anúncios.</p>
        <table>
          <thead><tr><th>SKU</th><th>Produto</th><th>Custo</th><th>Margem base</th><th>ML</th><th>Shopee</th><th>Ruta Direct Shop</th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>{p.sku}</td><td>{p.name}</td><td>R$ {p.cost.toFixed(2).replace(".", ",")}</td>
                <td><input className="short" defaultValue={p.margin} /> %</td>
                <td>R$ 134,90</td><td>R$ 129,90</td><td>R$ 119,90</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Accounts() {
  return (
    <>
      <PageHeader title="Contas" subtitle="Contas conectadas e canais de venda." action="Adicionar conta" />
      <div className="cards">
        {accounts.map(a => (
          <div className="card account" key={a.id}>
            <span className="channel">{a.channel}</span>
            <h3>{a.name}</h3>
            <p><span className="dot" /> Conta de demonstração</p>
            <button disabled>Configurar</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Users() {
  return (
    <>
      <PageHeader title="Usuários" subtitle="Permissões funcionais e acesso por conta." action="Criar usuário" />
      <div className="card tableWrap">
        <table>
          <thead><tr><th>Usuário</th><th>Perfil</th><th>Contas</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td>Administrador</td><td>Admin</td><td>Todas</td><td><span className="pill green">Ativo</span></td><td><button disabled>Editar</button></td></tr>
            <tr><td>Operador Demo</td><td>Operacional</td><td>ML Principal, Shopee Principal</td><td><span className="pill green">Ativo</span></td><td><button disabled>Editar</button></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return <><PageHeader title={title} subtitle={description} /><div className="card empty">Módulo preparado para a próxima etapa da V1.</div></>;
}

function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <p className="demoNotice" role="status">Demonstração — dados fictícios. Alterações não são salvas e nenhuma ação é enviada aos canais.</p>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/produtos" element={<Matrix key="products" kind="products" />} />
          <Route path="/kits" element={<Matrix key="kits" kind="kits" />} />
          <Route path="/precificador" element={<Pricing />} />
          <Route path="/anuncios" element={<Placeholder title="Anúncios" description="Fila de preparação, validação, publicação e sincronização." />} />
          <Route path="/pedidos" element={<Placeholder title="Pedidos" description="Pedidos centralizados por canal e impacto no estoque físico." />} />
          <Route path="/contas" element={<Accounts />} />
          <Route path="/usuarios" element={<Users />} />
          <Route path="/configuracoes" element={<Placeholder title="Configurações" description="Premissas gerais, canais, integrações e auditoria." />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
export { Sidebar, Dashboard, Matrix, Pricing, Accounts, Users, Placeholder };


