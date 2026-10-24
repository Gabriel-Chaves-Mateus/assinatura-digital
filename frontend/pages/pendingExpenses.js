import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Paper, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import { api, brl, fmtDate } from '../lib/api';

export default function PendingExpenses() {
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get(`/expenses?status=${tab}`).then((d) => setList(d.expenses)).catch((e) => setError(e.message));
  }, [tab]);

  return (
    <Layout title="Documentos pendentes" role="manager">
      <Tabs value={tab} onChange={(_, v) => setTab(v)} className="mb-3">
        <Tab value="pending" label="Aguardando validação" />
        <Tab value="approved" label="Validadas · aguardando assinatura" />
      </Tabs>
      <ErrorAlert error={error} />
      <Paper variant="outlined" className="overflow-x-auto">
        <Table size="small">
          <TableHead><TableRow><TableCell>Título</TableCell><TableCell>Funcionário</TableCell><TableCell>Enviada em</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Ação</TableCell></TableRow></TableHead>
          <TableBody>
            {list.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{e.title}</TableCell><TableCell>{e.employee?.name}</TableCell><TableCell>{fmtDate(e.createdAt)}</TableCell><TableCell align="right">{brl(e.total)}</TableCell>
                <TableCell align="right">
                  {tab === 'pending'
                    ? <Button size="small" component={Link} href={`/validateExpense/?id=${e.id}`}>Validar</Button>
                    : <Button size="small" variant="contained" component={Link} href={`/signExpense/?id=${e.id}`}>Assinar</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={5} align="center">Nada por aqui.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Layout>
  );
}
