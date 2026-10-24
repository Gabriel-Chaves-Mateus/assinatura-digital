const mongoose = require('mongoose');

/** Valida req[source] com um schema zod e substitui pelo valor já normalizado. */
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req[source] = result.data;
    next();
  };

/** Garante que o parâmetro é um ObjectId válido (evita injeção/erros de cast). */
const validId =
  (param = 'id') =>
  (req, res, next) =>
    mongoose.isValidObjectId(req.params[param]) ? next() : res.status(400).json({ error: 'ID inválido' });

module.exports = { validate, validId };
