import { useCallback, useEffect, useState } from 'react';
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, Box,
} from '@mui/material';
import Layout, { ErrorAlert } from '../components/Layout';
import { api } from '../lib/api';

const empty = { name: '', email: '', role: 'employee', department: '', position: '', password: '' };

export default function Employees() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null); // null = fechado
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(() => api.get('/employees').then((d) => setList(d.employees)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const open = (emp) => {
    setFormError('');
    setEditId(emp ? emp.id : null);
    setForm(emp ? { ...emp, password: '' } : empty);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setFormError('');
    const body = { name: form.name, email: form.email, role: form.role, department: form.department, position: form.position };
    if (form.password) body.password = form.password;
    try {
      if (editId) await api.put(`/employees/${editId}`, { ...body, active: form.active });
      else await api.post('/employees', body);
      setForm(null);
      load();
    } catch (e) {
      setFormError(e.details ? e.details.map((d) => `${d.path}: ${d.message}`).join(' · ') : e.message);
    }
  };

  const toggle = async (emp) => {
    try {
      if (emp.active) { if (!confirm(`Desativar ${emp.name}? O histórico e as assinaturas são preservados.`)) return; await api.del(`/employees/${emp.id}`); }
      else await api.put(`/employees/${emp.id}`, { name: emp.name, email: emp.email, role: emp.role, department: emp.department, position: emp.position, active: true });
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <Layout title="Funcionários" role="manager">
      <Box className="flex justify-end mb-3"><Button variant="contained" onClick={() => open(null)}>Novo funcionário</Button></Box>
      <ErrorAlert error={error} />
      <Paper variant="outlined" className="overflow-x-auto">
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Nome</TableCell><TableCell>E-mail</TableCell><TableCell>Departamento</TableCell><TableCell>Cargo</TableCell><TableCell>Perfil</TableCell><TableCell>Situação</TableCell><TableCell align="right">Ações</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {list.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{e.name}</TableCell><TableCell>{e.email}</TableCell><TableCell>{e.department}</TableCell><TableCell>{e.position}</TableCell>
                <TableCell>{e.role === 'manager' ? 'Gerente' : 'Funcionário'}</TableCell>
                <TableCell><Chip size="small" label={e.active ? 'Ativo' : 'Inativo'} color={e.active ? 'success' : 'default'} /></TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => open(e)}>Editar</Button>
                  <Button size="small" color={e.active ? 'error' : 'primary'} onClick={() => toggle(e)}>{e.active ? 'Desativar' : 'Reativar'}</Button>
                </TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={7} align="center">Nenhum funcionário.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!form} onClose={() => setForm(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
        <DialogContent className="flex flex-col gap-4 pt-2" dividers>
          {form && (<>
            <TextField label="Nome" value={form.name} onChange={set('name')} required fullWidth margin="dense" />
            <TextField label="E-mail" type="email" value={form.email} onChange={set('email')} required fullWidth margin="dense" />
            <TextField label="Departamento" value={form.department} onChange={set('department')} fullWidth margin="dense" />
            <TextField label="Cargo" value={form.position} onChange={set('position')} fullWidth margin="dense" />
            <TextField select label="Perfil" value={form.role} onChange={set('role')} fullWidth margin="dense">
              <MenuItem value="employee">Funcionário</MenuItem><MenuItem value="manager">Gerente</MenuItem>
            </TextField>
            <TextField label={editId ? 'Nova senha (opcional)' : 'Senha inicial'} type="password" value={form.password} onChange={set('password')}
              required={!editId} fullWidth margin="dense" autoComplete="new-password" helperText="Mín. 10 caracteres, com maiúscula, minúscula e número." />
            <ErrorAlert error={formError} />
          </>)}
        </DialogContent>
        <DialogActions><Button onClick={() => setForm(null)}>Cancelar</Button><Button variant="contained" onClick={save}>Salvar</Button></DialogActions>
      </Dialog>
    </Layout>
  );
}
