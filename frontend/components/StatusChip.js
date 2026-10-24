import { Chip } from '@mui/material';

const map = {
  pending: ['Pendente', 'warning'],
  approved: ['Aprovada', 'info'],
  rejected: ['Rejeitada', 'error'],
  signed: ['Assinada', 'success'],
};

export default function StatusChip({ status }) {
  const [label, color] = map[status] || [status, 'default'];
  return <Chip size="small" label={label} color={color} />;
}
