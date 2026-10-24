import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useAuth } from '../lib/auth';
import { ErrorAlert } from '../components/Layout';

export default function Login() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) router.replace('/dashboard/'); }, [loading, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(email, password);
      router.replace('/dashboard/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="min-h-screen flex items-center justify-center p-4">
      <Paper elevation={3} className="p-8 w-full max-w-md">
        <Typography variant="h5" component="h1" className="mb-1">Despesas · Assinatura Digital</Typography>
        <Typography variant="body2" color="text.secondary" className="mb-4">Entre com seu e-mail corporativo.</Typography>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" autoFocus />
          <TextField label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <ErrorAlert error={error} />
          <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        </form>
      </Paper>
    </Box>
  );
}
