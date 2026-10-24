import { Button, Divider, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography, Box } from '@mui/material';
import StatusChip from './StatusChip';
import { api, brl, fmtDate } from '../lib/api';

/** Exibe uma despesa (dados, itens e recibos). Todo texto é renderizado pelo React (escapado => sem XSS). */
export default function ExpenseDetails({ expense: e }) {
  return (
    <Paper variant="outlined" className="p-4 my-3">
      <Box className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <Typography variant="h6">{e.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {e.employee?.name} · {e.employee?.department || 'sem departamento'} · enviada em {fmtDate(e.createdAt)}
          </Typography>
        </div>
        <StatusChip status={e.status} />
      </Box>
      {e.description && <Typography className="mt-3" style={{ whiteSpace: 'pre-wrap' }}>{e.description}</Typography>}
      <Table size="small" className="mt-3">
        <TableHead>
          <TableRow><TableCell>Descrição</TableCell><TableCell>Data</TableCell><TableCell align="right">Valor</TableCell></TableRow>
        </TableHead>
        <TableBody>
          {e.items.map((i, k) => (
            <TableRow key={k}><TableCell>{i.description}</TableCell><TableCell>{i.date}</TableCell><TableCell align="right">{brl(i.amount)}</TableCell></TableRow>
          ))}
          <TableRow><TableCell colSpan={2}><b>Total</b></TableCell><TableCell align="right"><b>{brl(e.total)}</b></TableCell></TableRow>
        </TableBody>
      </Table>
      <Divider className="my-3" />
      <Typography variant="subtitle2">Recibos anexados</Typography>
      <Box className="flex flex-wrap gap-2 mt-1">
        {e.receipts.map((r) => (
          <Button key={r.index} size="small" variant="outlined" onClick={() => api.openReceipt(e.id, r.index)}>
            {r.filename} ({Math.ceil(r.size / 1024)} KB)
          </Button>
        ))}
      </Box>
      {e.receipts.map((r) => (
        <Typography key={r.index} variant="caption" component="div">{r.filename} · SHA-256: <span className="mono">{r.sha256}</span></Typography>
      ))}
      {e.validatedBy && (
        <Typography variant="body2" className="mt-3">
          Validada por {e.validatedBy.name} em {fmtDate(e.validatedAt)}{e.validationNote ? ` — “${e.validationNote}”` : ''}
        </Typography>
      )}
    </Paper>
  );
}
