import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  Transaction,
  TransactionType,
} from '../types/finance';
import { TransactionInput } from '../services/financeService';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
  initialData?: Transaction | null;
  defaultMonthKey: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  defaultMonthKey,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setType(initialData.type);
      setAmount(String(initialData.amount));
      setTitle(initialData.title);
      setCategory(initialData.category);
      setDate(initialData.date);
      setPaymentMethod(initialData.paymentMethod);
      setNote(initialData.note || '');
    } else {
      const today = new Date();
      const todayMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const defaultDate =
        defaultMonthKey === todayMonthKey
          ? `${todayMonthKey}-${String(today.getDate()).padStart(2, '0')}`
          : `${defaultMonthKey}-01`;
      setType('expense');
      setAmount('');
      setTitle('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDate(defaultDate);
      setPaymentMethod(PAYMENT_METHODS[0]);
      setNote('');
    }
    setError(null);
  }, [isOpen, initialData, defaultMonthKey]);

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const list = nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!list.includes(category as never)) {
      setCategory(list[0]);
    }
  };

  const handleQuickAmount = (delta: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + delta));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('กรุณาระบุจำนวนเงินที่มากกว่า 0');
      return;
    }
    if (parsedAmount > 1000000000) {
      setError('จำนวนเงินต้องไม่เกิน 1,000,000,000');
      return;
    }
    if (!title.trim()) {
      setError('กรุณาระบุชื่อรายการ');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('กรุณาระบุวันที่ให้ถูกต้อง');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        amount: parsedAmount,
        category,
        title: title.trim(),
        note: note.trim(),
        date,
        paymentMethod,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      setError(msg.includes('Missing or insufficient permissions')
        ? 'ไม่มีสิทธิ์บันทึกข้อมูล กรุณาตรวจสอบการเข้าสู่ระบบ'
        : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="transaction-modal-title" className="text-base font-bold text-slate-900">
            {initialData ? 'แก้ไขรายการ' : 'บันทึกรายการใหม่'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
          {/* Segmented Type Selector */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                type === 'expense'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายจ่าย (Expense)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                type === 'income'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายรับ (Income)
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Amount */}
          <div>
            <label htmlFor="tx-amount" className="block text-xs font-medium text-slate-700 mb-1.5">
              จำนวนเงิน
            </label>
            <div className="relative">
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 text-lg font-mono font-semibold tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              {[100, 500, 1000, 5000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  +{val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="tx-title" className="block text-xs font-medium text-slate-700 mb-1.5">
              ชื่อรายการ
            </label>
            <input
              id="tx-title"
              type="text"
              maxLength={120}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'income' ? 'เช่น เงินเดือน, ค่าออกแบบเว็บไซต์' : 'เช่น ค่าอาหารกลางวัน, ค่าเดินทาง'
              }
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tx-category"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                หมวดหมู่
              </label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                วันที่ทำรายการ
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label htmlFor="tx-payment" className="block text-xs font-medium text-slate-700 mb-1.5">
              ช่องทางการชำระเงิน / บัญชี
            </label>
            <select
              id="tx-payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label htmlFor="tx-note" className="block text-xs font-medium text-slate-700 mb-1.5">
              บันทึกเพิ่มเติม (ไม่บังคับ)
            </label>
            <input
              id="tx-note"
              type="text"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม..."
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'กำลังบันทึก...' : initialData ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
