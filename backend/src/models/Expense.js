const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0.01 }, // em reais
    date: { type: String, required: true }, // YYYY-MM-DD
  },
  { _id: false }
);

const receiptSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true }, // hash hex do arquivo
    data: { type: Buffer, required: true, select: false },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true },
    receipts: { type: [receiptSchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'signed'],
      default: 'pending',
      index: true,
    },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    validatedAt: { type: Date },
    validationNote: { type: String, maxlength: 1000, default: '' },
    signature: { type: mongoose.Schema.Types.ObjectId, ref: 'Signature' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
