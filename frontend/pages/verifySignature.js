import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, MenuItem, Paper, TextField, Typography, Box, List, ListItem, ListItemText } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import { api, fmtDate } from '../lib/api';
import { sha256Hex, verifyPayload } from '../lib/crypto';

const LABELS = {
  signatureValid: ['Autenticidade', 'A assinatura confere com a chave pública do signatário (servidor).'],
  hashMatches: ['Hash do documento', 'O SHA-256 do payload coincide com o hash registrado.'],
  documentUnchanged: ['Integridade dos dados', 'Valores, itens e validação são idênticos aos do momento da assinatura.'],
  receiptsUnchanged: ['Integridade dos recibos', 'Os arquivos armazenados continuam com o mesmo hash.'],
  keyFingerprintMatches: ['Vínculo da chave', 'O fingerprint da chave pública corresponde ao registrado (não repúdio).'],
};

export default function VerifySignature() {
  const router = useRouter();
  const [sigs, setSigs] = useState([]);
  const [selected, setSelected] = useState('');
  const [res, setRes] = useState(null);
  const [clientOk, setClientOk] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/signatures').then((d) => setSigs(d.signatures)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (router.isReady && router.query.id) setSelected(String(router.query.id)); }, [router.isReady, router.query.id]);

  const verify = async (id) => {
    if (!id) return;
    setBusy(true); setError(''); setRes(null); setClientOk(null);
    try {
      const r = await api.get(`/signatures/${encodeURIComponent(id)}/verify`);
      setRes(r);
      // Segunda verificação, independente do servidor: Web Crypto no navegador
      const s = r.signature;
      const ok = (await verifyPayload(s.publicKeyJwk, s.payload, s.signature)) && (await sha256Hex(s.payload)) === s.documentHash;
      setClientOk(ok);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  useEffect(() => { if (selected) verify(selected); /* eslint-disable-next-line */ }, [selected]);

  return (
    <Layout title="Verificar assinatura digital" role="manager">
      <Paper variant="outlined" className="p-4 mb-4 flex gap-3 items-center flex-wrap">
        <TextField select label="Documento assinado" value={selected} onChange={(e) => setSelected(e.target.value)} className="min-w-[280px] flex-1" size="small">
          {sigs.map((s) => <MenuItem key={s.id} value={s.id}>{s.title} — {s.employee} ({fmtDate(s.signedAt)})</MenuItem>)}
        </TextField>
        <Button variant="contained" disabled={!selected || busy} onClick={() => verify(selected)}>{busy ? 'Verificando…' : 'Verificar novamente'}</Button>
      </Paper>
      <ErrorAlert error={error} />

      {res && (<>
        <Alert severity={res.valid && clientOk ? 'success' : 'error'} className="mb-3">
          {res.valid && clientOk
            ? 'Assinatura VÁLIDA: o documento é autêntico e não foi alterado desde a assinatura.'
            : 'Assinatura INVÁLIDA ou documento alterado. Não confie neste documento.'}
        </Alert>

        <Paper variant="outlined" className="p-4 mb-3">
          <Typography variant="subtitle1" className="font-semibold">Resultado das verificações</Typography>
          <List dense>
            {Object.entries(res.checks).map(([k, ok]) => (
              <ListItem key={k}>
                <ListItemText primary={`${ok ? '✅' : '❌'} ${LABELS[k][0]}`} secondary={LABELS[k][1]} />
              </ListItem>
            ))}
            {clientOk !== null && (
              <ListItem><ListItemText primary={`${clientOk ? '✅' : '❌'} Verificação no navegador (Web Crypto API)`} secondary="Conferência independente da assinatura, feita localmente com a chave pública." /></ListItem>
            )}
          </List>
        </Paper>

        <Paper variant="outlined" className="p-4">
          <Typography variant="subtitle1" className="font-semibold mb-2">Dados da assinatura</Typography>
          <Box className="grid gap-1">
            <Typography variant="body2"><b>Signatário:</b> {res.signature.signer?.name} ({res.signature.signer?.email})</Typography>
            <Typography variant="body2"><b>Data/hora (servidor):</b> {fmtDate(res.signature.signedAt)}</Typography>
            <Typography variant="body2"><b>IP:</b> {res.signature.ip}</Typography>
            <Typography variant="body2"><b>Algoritmo:</b> {res.signature.algorithm}</Typography>
            <Typography variant="body2" component="div"><b>Hash do documento (SHA-256):</b> <span className="mono">{res.signature.documentHash}</span></Typography>
            <Typography variant="body2" component="div"><b>Fingerprint da chave pública:</b> <span className="mono">{res.signature.publicKeyFingerprint}</span></Typography>
            <Typography variant="body2" component="div"><b>Assinatura (base64):</b> <span className="mono">{res.signature.signature}</span></Typography>
          </Box>
          <details className="mt-3">
            <summary className="cursor-pointer">Documento assinado (JSON canônico)</summary>
            <pre className="mono text-xs whitespace-pre-wrap bg-gray-50 p-2 mt-2 rounded">{res.signature.payload}</pre>
          </details>
        </Paper>
      </>)}
    </Layout>
  );
}
