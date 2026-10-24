const nodemailer = require('nodemailer');
const config = require('../config');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  } else {
    // Sem SMTP configurado: apenas registra o e-mail no log (desenvolvimento)
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Nunca derruba a requisição se o e-mail falhar. */
async function sendMail({ to, subject, text, html }) {
  try {
    const info = await getTransporter().sendMail({ from: config.smtp.from, to, subject, text, html });
    if (!config.smtp.host) console.log('[mail:dev]', subject, '->', to);
    return info;
  } catch (err) {
    console.error('Falha ao enviar e-mail:', err.message);
    return null;
  }
}

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function notifyNewExpense(managers, expense, employee) {
  const link = `${config.appUrl}/validateExpense/?id=${expense._id}`;
  return Promise.all(
    managers.map((m) =>
      sendMail({
        to: m.email,
        subject: `Nova despesa pendente: ${expense.title}`,
        text: `${employee.name} enviou "${expense.title}" (${brl(expense.total)}).\nValidar: ${link}`,
        html: `<p><b>${esc(employee.name)}</b> enviou o relatório <b>${esc(expense.title)}</b> (${brl(
          expense.total
        )}).</p><p><a href="${link}">Abrir para validação</a></p>`,
      })
    )
  );
}

function notifyDecision(employee, expense, decision, note) {
  const ok = decision === 'approved';
  return sendMail({
    to: employee.email,
    subject: `Despesa ${ok ? 'aprovada' : 'rejeitada'}: ${expense.title}`,
    text: `Sua despesa "${expense.title}" foi ${ok ? 'aprovada' : 'rejeitada'}.${note ? '\nObservação: ' + note : ''}`,
    html: `<p>Sua despesa <b>${esc(expense.title)}</b> foi <b>${ok ? 'aprovada' : 'rejeitada'}</b>.</p>${
      note ? `<p>Observação: ${esc(note)}</p>` : ''
    }`,
  });
}

function notifySigned(employee, expense, signature) {
  return sendMail({
    to: employee.email,
    subject: `Despesa assinada digitalmente: ${expense.title}`,
    text: `Sua despesa "${expense.title}" foi assinada digitalmente.\nHash (SHA-256): ${signature.documentHash}\nData: ${signature.signedAt.toISOString()}`,
    html: `<p>Sua despesa <b>${esc(expense.title)}</b> foi assinada digitalmente.</p><p>Hash SHA-256: <code>${signature.documentHash}</code></p>`,
  });
}

module.exports = { sendMail, notifyNewExpense, notifyDecision, notifySigned };
