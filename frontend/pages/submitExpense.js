import { useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, IconButton, Paper, TextField, Typography, Box } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import { api, brl } from '../lib/api';

const MAX_MB = 2;
const newItem = () => ({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });

export default function SubmitExpense() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([newItem()]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const setItem = (idx, k, v) => setItems(items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  const onFiles = (e) => {
    const picked = [...e.target.files];
    if (picked.length > 5) return setError('Máximo de 5 recibos.');
    const bad = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (bad) return setError(`"${bad.name}" excede ${MAX_MB} MB.`);
    setError(''); setFiles(picked);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!files.length) return setError('Anexe ao menos um recibo (PDF, PNG ou JPEG).');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        title, description,
        items: items.map((i) => ({ description: i.description, amount: Number(i.amount), date: i.date })),
      }));
      files.forEach((f) => fd.append('receipts', f));
      await api.post('/expenses', fd);
      setDone(true);
      setTimeout(() => router.push('/dashboard/'), 1500);
    } catch (err) {
      setError(err.details ? err.details.map((d) => `${(d.path || []).join?.('.') ?? d.path}: ${d.message}`).join(' · ') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Nova despesa">
      <Paper variant="outlined" className="p-4">
        {done && <Alert severity="success" className="mb-3">Despesa enviada! Os gerentes foram notificados por e-mail.</Alert>}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required inputProps={{ maxLength: 140 }} />
          <TextField label="Descrição / justificativa" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} />

          <Typography variant="subtitle1">Itens</Typography>
          {items.map((it, idx) => (
            <Box key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <TextField className="md:col-span-5" label="Descrição" value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} required size="small" />
              <TextField className="md:col-span-3" label="Data" type="date" value={it.date} onChange={(e) => setItem(idx, 'date', e.target.value)} required size="small" InputLabelProps={{ shrink: true }} />
              <TextField className="md:col-span-3" label="Valor (R$)" type="number" value={it.amount} onChange={(e) => setItem(idx, 'amount', e.target.value)} required size="small" inputProps={{ min: 0.01, step: 0.01 }} />
              <IconButton className="md:col-span-1" aria-label="Remover item" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</IconButton>
            </Box>
          ))}
          <Box className="flex justify-between items-center">
            <Button onClick={() => setItems([...items, newItem()])} disabled={items.length >= 50}>+ Adicionar item</Button>
            <Typography variant="h6">Total: {brl(total)}</Typography>
          </Box>

          <div>
            <Typography variant="subtitle1">Recibos (PDF, PNG ou JPEG · até {MAX_MB} MB cada · máx. 5)</Typography>
            <input type="file" accept="application/pdf,image/png,image/jpeg" multiple onChange={onFiles} className="mt-2" aria-label="Recibos" />
            {files.map((f) => <Typography key={f.name} variant="caption" component="div">{f.name} ({Math.ceil(f.size / 1024)} KB)</Typography>)}
          </div>

          <ErrorAlert error={error} />
          <Button type="submit" variant="contained" size="large" disabled={busy || done}>{busy ? 'Enviando…' : 'Enviar despesa'}</Button>
        </form>
      </Paper>
    </Layout>
  );
}
