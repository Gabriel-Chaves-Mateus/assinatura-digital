import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Alert, Button, Paper, TextField, Typography, Box } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import ExpenseDetails from '../components/ExpenseDetails';
import KeyManager from '../components/KeyManager';
import { useAuth } from '../lib/auth';
import { api, fmtDate } from '../lib/api';
import { loadKeyPair, signPayload } from '../lib/crypto';

export default function SignExpense() {
  const router = useRouter();
  const { user } = useAuth();
  const id = router.query.id;
  const [expense, setExpense] = useState(null);
  const [keyStatus, setKeyStatus] = useState('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!router.isReady || !id) return;
    api.get(`/expenses/${encodeURIComponent(id)}`).then((d) => setExpense(d.expense)).catch((e) => setError(e.message));
  }, [router.isReady, id]);

  const sign = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const pair = await loadKeyPair(user.id);
      if (!pair) throw new Error('Chave de assinatura não encontrada neste navegador.');
      // 1) Reautenticação com senha (o signatário confirma que é ele)
      const { signToken } = await api.post('/auth/confirm', { password });
      // 2) Servidor devolve o documento canônico a assinar
      const { payload, documentHash } = await api.get(`/expenses/${id}/signing-payload`);
      // 3) Assinatura local com a chave privada (Web Crypto) — a chave nunca sai do navegador
      const signature = await signPayload(pair.privateKey, payload);
      // 4) Servidor confere payload + assinatura e registra com carimbo de tempo
      const r = await api.post(`/expenses/${id}/sign`, { payload, signature }, { headers: { 'X-Sign-Token': signToken } });
      setResult({ ...r, documentHash });
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canSign = expense?.status === 'approved' && keyStatus === 'ok';

  return (
    <Layout title="Assinar digitalmente" role="manager">
      <ErrorAlert error={error} />
      {expense && <ExpenseDetails expense={expense} />}

      {result ? (
        <Alert severity="success">
          <Typography variant="subtitle1">Documento assinado com sucesso em {fmtDate(result.signedAt)}.</Typography>
          <Typography variant="caption" component="div">Hash SHA-256: <span className="mono">{result.documentHash}</span></Typography>
          <Box className="mt-2 flex gap-2">
            <Button size="small" variant="contained" component={Link} href={`/verifySignature/?id=${result.signatureId}`}>Verificar assinatura</Button>
            <Button size="small" component={Link} href="/pendingExpenses/">Voltar</Button>
          </Box>
        </Alert>
      ) : expense && expense.status !== 'approved' ? (
        <Alert severity="info">Esta despesa está “{expense.status}”. Somente despesas aprovadas podem ser assinadas.</Alert>
      ) : (
        <>
          <KeyManager onStatus={setKeyStatus} compact />
          <Paper variant="outlined" className="p-4">
            <Typography variant="body2" className="mb-3">
              Ao assinar, você atesta que revisou o documento acima. A assinatura (ECDSA P-256 / SHA-256) cobre os dados, os hashes dos recibos, a validação e a sua identidade; qualquer alteração posterior será detectada.
            </Typography>
            <form onSubmit={sign} className="flex flex-col gap-3 max-w-sm">
              <TextField label="Confirme sua senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={!canSign} />
              <Button type="submit" variant="contained" disabled={!canSign || busy}>{busy ? 'Assinando…' : 'Assinar documento'}</Button>
            </form>
          </Paper>
        </>
      )}
    </Layout>
  );
}
