import { useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export default function AccountSettings() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setMessage('As senhas precisam ser iguais.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) { setMessage('Não foi possível alterar a senha. Confira os requisitos ou entre novamente e tente outra vez.'); return; }
      setPassword(''); setConfirmation(''); setMessage('Senha alterada com sucesso. Use a nova senha no próximo acesso.');
    } catch { setMessage('Falha de conexão. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <><header className="pageHeader"><div><h1>Minha conta</h1><p>Gerencie a senha de acesso ao Rocket.</p></div></header>
    <form className="card productForm" onSubmit={save} style={{maxWidth:600}}>
      <h2>Alterar minha senha</h2><p>Use pelo menos 12 caracteres.</p>
      <label>Nova senha<input type="password" autoComplete="new-password" required minLength={12} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} /></label>
      <label>Confirmar nova senha<input type="password" autoComplete="new-password" required minLength={12} value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)} /></label>
      <div className="formActions"><button className="primary" disabled={busy}>{busy?'Salvando…':'Alterar senha'}</button></div>
      <p role="status">{message}</p>
    </form></>;
}
