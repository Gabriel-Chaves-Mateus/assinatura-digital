import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Alert, Button, TextField, Box } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import ExpenseDetails from '../components/ExpenseDetails';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export default function ValidateExpense() {
  const router = useRouter();
  const { user } = useAuth();
  const id = router.query.id;
  const [expense, setExpense] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!router.isReady || !id) return;
    api.get(`/expenses/${encodeURIComponent(id)}`).then((d) => setExpense(d.expense)).catch((e) => setError(e.message));
  }, [router.isReady, id]);

  const decide = async (decision) => {
    if (decision === 'rejected' && !note.trim()) return setError('Informe o motivo da rejeição.');
    setBusy(true); setError('');
    try {
      await api.patch(`/expenses/${id}/validate`, { decision, note });
      const d = await api.get(`/expenses/${id}`);
      setExpense(d.expense);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const own = expense && user && expense.employee?.id === user.id;

  return (
    <Layout title="Validar despesa" role="manager">
      <ErrorAlert error={error} />
      {expense && (<>
        <ExpenseDetails expense={expense} />
        {expense.status === 'pending' && (own
          ? <Alert severity="warning">Segregação de funções: outro gerente deve validar a sua despesa.</Alert>
          : (
            <Box className="flex flex-col gap-3">
              <TextField label="Observação (obrigatória ao rejeitar)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }} />
              <Box className="flex gap-2">
                <Button variant="contained" color="success" disabled={busy} onClick={() => decide('approved')}>Aprovar</Button>
                <Button variant="outlined" color="error" disabled={busy} onClick={() => decide('rejected')}>Rejeitar</Button>
              </Box>
            </Box>
          ))}
        {expense.status === 'approved' && <Button variant="contained" component={Link} href={`/signExpense/?id=${expense.id}`}>Prosseguir para a assinatura digital</Button>}
        {expense.status === 'signed' && <Alert severity="success">Documento já assinado digitalmente.</Alert>}
      </>)}
    </Layout>
  );
}
