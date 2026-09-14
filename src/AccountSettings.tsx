import { useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export default function AccountSettings() {
  const [section,setSection]=useState<'data'|'password'>('data');
  const [email,setEmail]=useState('');
  useState(()=>{supabase?.auth.getUser().then(({data})=>setEmail(data.user?.email||''));});
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (password.length < 12) { setMessage('A senha deve ter pelo menos 12 caracteres.'); return; }
    if (password !== confirmation) { setMessage('As senhas precisam ser iguais.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) { setMessage('Não foi possível alterar a senha. Confira os requisitos ou entre novamente e tente outra vez.'); return; }
      setPassword(''); setConfirmation(''); setMessage('Senha alterada com sucesso. Use a nova senha no próximo acesso.');
    } catch { setMessage('Falha de conexão. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="internalMenu"><button className={`roundAction ${section==='data'?'addAction':''}`} type="button" title="Dados da conta" aria-label="Dados da conta" onClick={()=>setSection('data')}>◎</button><button className={`roundAction ${section==='password'?'addAction':''}`} type="button" title="Redefinir senha" aria-label="Redefinir senha" onClick={()=>setSection('password')}>⚿</button></div>
    {section==='data'&&<div className="card accountData"><div><strong>Dados da conta</strong><span className="muted">E-mail de acesso</span><span>{email||'Carregando…'}</span></div></div>}
    {section==='password'&&<form className="card productForm passwordForm" aria-label="Alterar minha senha" onSubmit={save} style={{maxWidth:420}}>
      <label>Nova senha<input type="password" autoComplete="new-password" required value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} /></label>
      <label>Confirmar nova senha<input type="password" autoComplete="new-password" required value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)} /></label>
      <div className="formActions"><button className="primary" disabled={busy}>{busy?'Salvando…':'Alterar senha'}</button></div>
      <p role="status">{message}</p>
    </form>}
  </>;
}
