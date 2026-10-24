import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardActions, CardContent, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import KeyManager from '../components/KeyManager';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../lib/auth';
import { api, brl, fmtDate } from '../lib/api';

const Tile = ({ title, text, href, cta }) => (
  <Grid item xs={12} sm={6} md={4}>
    <Card variant="outlined" className="h-full flex flex-col">
      <CardContent className="flex-1"><Typography variant="h6">{title}</Typography><Typography variant="body2" color="text.secondary">{text}</Typography></CardContent>
      <CardActions><Button component={Link} href={href} size="small">{cta}</Button></CardActions>
    </Card>
  </Grid>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');
  const isManager = user?.role === 'manager';

  useEffect(() => {
    if (!user) return;
    api.get('/expenses?mine=true').then((d) => setMine(d.expenses)).catch((e) => setError(e.message));
  }, [user]);

  return (
    <Layout title="Painel">
      <Grid container spacing={2}>
        {isManager && <Tile title="Funcionários" text="Cadastrar, editar e desativar funcionários." href="/employees/" cta="Gerenciar" />}
        <Tile title="Nova despesa" text="Envie um relatório de despesas com recibos." href="/submitExpense/" cta="Cadastrar" />
        {isManager && <Tile title="Documentos pendentes" text="Valide e assine relatórios de despesas." href="/pendingExpenses/" cta="Abrir" />}
        {isManager && <Tile title="Documentos assinados" text="Consulte as assinaturas emitidas." href="/signedExpenses/" cta="Listar" />}
        {isManager && <Tile title="Verificar assinatura" text="Confira autenticidade e integridade." href="/verifySignature/" cta="Verificar" />}
      </Grid>

      {isManager && <KeyManager />}

      <Typography variant="h6" className="mt-6 mb-2">Minhas despesas</Typography>
      <ErrorAlert error={error} />
      <Table size="small" component="div" className="bg-white">
        <TableHead>
          <TableRow><TableCell>Título</TableCell><TableCell>Enviada em</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell></TableRow>
        </TableHead>
        <TableBody>
          {mine.map((e) => (
            <TableRow key={e.id}><TableCell>{e.title}</TableCell><TableCell>{fmtDate(e.createdAt)}</TableCell><TableCell align="right">{brl(e.total)}</TableCell><TableCell><StatusChip status={e.status} /></TableCell></TableRow>
          ))}
          {!mine.length && <TableRow><TableCell colSpan={4} align="center">Nenhuma despesa enviada.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Layout>
  );
}
