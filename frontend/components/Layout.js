import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppBar, Toolbar, Typography, Button, Container, Box, CircularProgress, Alert } from '@mui/material';
import { useRequireAuth } from '../lib/auth';

const links = [
  { href: '/dashboard/', label: 'Início' },
  { href: '/submitExpense/', label: 'Nova despesa' },
  { href: '/employees/', label: 'Funcionários', manager: true },
  { href: '/pendingExpenses/', label: 'Pendentes', manager: true },
  { href: '/signedExpenses/', label: 'Assinadas', manager: true },
  { href: '/verifySignature/', label: 'Verificar', manager: true },
];

export default function Layout({ title, role, children }) {
  const { user, ready, logout } = useRequireAuth(role);
  const { pathname } = useRouter();

  if (!ready) {
    return (
      <Box className="flex justify-center mt-24"><CircularProgress aria-label="Carregando" /></Box>
    );
  }
  return (
    <>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar className="flex-wrap gap-1">
          <Typography variant="h6" className="mr-4">Despesas · Assinatura Digital</Typography>
          <Box className="flex flex-wrap gap-1 flex-1">
            {links.filter((l) => !l.manager || user.role === 'manager').map((l) => (
              <Button key={l.href} component={Link} href={l.href} color="inherit"
                sx={{ borderBottom: pathname.startsWith(l.href.replace(/\/$/, '')) ? '2px solid #fff' : '2px solid transparent', borderRadius: 0 }}>
                {l.label}
              </Button>
            ))}
          </Box>
          <Typography variant="body2" className="mr-2">{user.name} ({user.role === 'manager' ? 'Gerente' : 'Funcionário'})</Typography>
          <Button color="inherit" variant="outlined" size="small" onClick={logout}>Sair</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" className="py-6">
        {title && <Typography variant="h4" component="h1" className="mb-4">{title}</Typography>}
        {children}
      </Container>
    </>
  );
}

export const ErrorAlert = ({ error }) =>
  error ? <Alert severity="error" className="my-3">{error}</Alert> : null;
