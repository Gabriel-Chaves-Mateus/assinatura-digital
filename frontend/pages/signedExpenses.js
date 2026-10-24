import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import { api, brl, fmtDate } from '../lib/api';

export default function SignedExpenses() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/signatures').then((d) => setList(d.signatures)).catch((e) => setError(e.message)); }, []);

  return (
    <Layout title="Documentos assinados" role="manager">
      <ErrorAlert error={error} />
      <Paper variant="outlined" className="overflow-x-auto">
        <Table size="small">
          <TableHead><TableRow><TableCell>Documento</TableCell><TableCell>Funcionário</TableCell><TableCell align="right">Total</TableCell><TableCell>Assinado por</TableCell><TableCell>Data</TableCell><TableCell>Hash (SHA-256)</TableCell><TableCell align="right">Ação</TableCell></TableRow></TableHead>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.title}</TableCell><TableCell>{s.employee}</TableCell><TableCell align="right">{s.total != null && brl(s.total)}</TableCell>
                <TableCell>{s.signer}</TableCell><TableCell>{fmtDate(s.signedAt)}</TableCell>
                <TableCell><Typography variant="caption" className="mono">{s.documentHash.slice(0, 16)}…</Typography></TableCell>
                <TableCell align="right"><Button size="small" component={Link} href={`/verifySignature/?id=${s.id}`}>Verificar</Button></TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={7} align="center">Nenhum documento assinado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Layout>
  );
}
