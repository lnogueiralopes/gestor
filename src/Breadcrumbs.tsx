import { Link, useLocation } from 'react-router-dom';
const paths:Record<string,[string,string,string]>={
 '/':['Produtos','Cadastro de produtos','/produtos'],
 '/produtos':['Produtos','Cadastro de produtos','/produtos'],
 '/kits':['Produtos','Cadastro de Kits','/produtos'],
 '/precificador':['Produtos','Precificador','/produtos'],
 '/precificador/tabelas-conta':['Produtos','Precificador','/produtos'],
 '/precificador/tabelas-preco':['Produtos','Precificador','/produtos'],
 '/precificador/parametros':['Produtos','Precificador','/produtos'],
 '/precificador/custos':['Produtos','Precificador','/produtos'],
 '/anuncios':['Canais de venda','Anúncios','/contas'],
 '/contas':['Canais de venda','Marketplace','/contas'],
 '/pedidos':['Vendas','Pedidos','/pedidos'],
 '/estoque/cadastro':['Estoque','Cadastro de estoque','/estoque/cadastro'],
 '/estoque/movimentacoes':['Estoque','Movimentações','/estoque/cadastro'],
 '/estoque/inventario':['Estoque','Inventário','/estoque/cadastro'],
 '/automacoes':['Automação','Agendamentos','/automacoes'],
 '/usuarios':['Sistema','Usuários','/configuracoes'],
 '/configuracoes':['Sistema','Configurações','/configuracoes'],
};
export default function Breadcrumbs({action,onBack}:{action?:string;onBack?:()=>void}) {
 const {pathname}=useLocation();const entry=paths[pathname];
 const pricingModules:Record<string,string>={'/precificador':'Log','/precificador/tabelas-conta':'Tabelas por conta','/precificador/tabelas-preco':'Tabelas de preços','/precificador/parametros':'Parâmetros','/precificador/custos':'Custos de produtos'};
 const moduleLabel=pricingModules[pathname];
 if(moduleLabel)return <nav className="breadcrumbs" aria-label="Caminho de navegação"><Link to="/dashboard" onClick={onBack}>Menu</Link><span aria-hidden="true">/</span><Link to="/produtos" onClick={onBack}>Produtos</Link><span aria-hidden="true">/</span><Link to="/precificador" onClick={onBack}>Precificador</Link><span aria-hidden="true">/</span><strong aria-current="page">{moduleLabel}</strong></nav>;
 return <nav className="breadcrumbs" aria-label="Caminho de navegação"><Link to="/dashboard" onClick={onBack}>Menu</Link><span aria-hidden="true">/</span>
 {entry?<><Link to={entry[2]} onClick={onBack}>{entry[0]}</Link><span aria-hidden="true">/</span>{action?<><button type="button" onClick={onBack}>{entry[1]}</button><span aria-hidden="true">/</span><span aria-current="page">{action}</span></>:<span aria-current="page">{entry[1]}</span>}</>:<span aria-current="page">{pathname==='/minha-conta'?'Minha conta':'Dashboard'}</span>}
 </nav>;
}
