import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Paper, Typography, Box } from '@mui/material';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { exportPublicJwk, fingerprintOf, generateKeyPair, loadKeyPair, saveKeyPair } from '../lib/crypto';

/**
 * Gerencia o par de chaves de assinatura do usuário neste navegador.
 * onStatus('ok' | 'none' | 'mismatch') informa o componente pai se já pode assinar.
 */
export default function KeyManager({ onStatus, compact }) {
  const { user, refresh } = useAuth();
  const [local, setLocal] = useState(undefined); // undefined = carregando
  const [localFp, setLocalFp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    try {
      const pair = await loadKeyPair(user.id);
      setLocal(pair || null);
      setLocalFp(pair ? await fingerprintOf(await exportPublicJwk(pair.publicKey)) : null);
    } catch {
      setLocal(null);
      setError('Seu navegador não permite armazenar chaves (IndexedDB indisponível).');
    }
  }, [user.id]);
  useEffect(() => { check(); }, [check]);

  const status = local === undefined ? 'loading' : !local ? 'none' : localFp === user.publicKeyFingerprint ? 'ok' : 'mismatch';
  useEffect(() => { if (status !== 'loading') onStatus?.(status); }, [status, onStatus]);

  const generate = async () => {
    if (status !== 'none' && !confirm('Gerar uma nova chave substitui a atual para novas assinaturas. Assinaturas já feitas continuam válidas. Continuar?')) return;
    setBusy(true); setError('');
    try {
      const pair = await generateKeyPair();
      await saveKeyPair(user.id, pair);
      await api.put('/auth/public-key', { jwk: await exportPublicJwk(pair.publicKey) });
      await refresh();
      await check();
    } catch (e) {
      setError(e.message || 'Falha ao gerar a chave');
    } finally {
      setBusy(false);
    }
  };

  const msg = {
    ok: ['success', 'Chave de assinatura ativa neste navegador.'],
    none: ['warning', 'Você ainda não possui chave de assinatura neste navegador.'],
    mismatch: ['warning', 'A chave deste navegador não corresponde à chave registrada no servidor (ex.: gerada em outro dispositivo).'],
    loading: ['info', 'Verificando chave…'],
  }[status];

  return (
    <Paper variant="outlined" className="p-4 my-3">
      {!compact && <Typography variant="subtitle1" className="font-semibold">Chave de assinatura digital</Typography>}
      <Alert severity={msg[0]} className="my-2">{msg[1]}</Alert>
      {user.publicKeyFingerprint && (
        <Typography variant="caption" component="div">Fingerprint registrado (SHA-256): <span className="mono">{user.publicKeyFingerprint}</span></Typography>
      )}
      {error && <Alert severity="error" className="my-2">{error}</Alert>}
      <Box className="mt-2">
        <Button variant={status === 'ok' ? 'outlined' : 'contained'} size="small" onClick={generate} disabled={busy || status === 'loading'}>
          {status === 'ok' ? 'Gerar nova chave' : 'Gerar chave de assinatura'}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" className="mt-2">
        A chave privada é criada e fica somente neste navegador (não extraível); apenas a chave pública é enviada ao servidor.
      </Typography>
    </Paper>
  );
}
