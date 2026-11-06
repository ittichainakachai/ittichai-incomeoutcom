import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CurrencyCode, formatCurrency, formatMonthLabel } from '../types/finance';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (limitAmount: number) => Promise<void>;
  monthKey: string;
  currentLimit?: number;
  currency: CurrencyCode;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  monthKey,
  currentLimit,
  currency,
}) => {
  const [limit, setLimit] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLimit(currentLimit !== undefined && currentLimit > 0 ? String(currentLimit) : '');
    setError(null);
  }, [isOpen, currentLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = Number(limit);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError('กรุณาระบุวงเงินงบประมาณที่ถูกต้อง');
      return;
    }
    setSubmitting(true);
    try {
      await onSave(parsed);
      onClose();
    } catch {
      setError('ไม่สามารถบันทึกงบประมาณได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="budget-modal-title" className="text-base font-bold text-slate-900">
            ตั้งงบประมาณรายจ่าย · {formatMonthLabel(monthKey)}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="budget-limit" className="block text-xs font-medium text-slate-700 mb-1.5">
              วงเงินรายจ่ายสูงสุดประจำเดือน
            </label>
            <input
              id="budget-limit"
              type="number"
              step="100"
              min="0"
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="เช่น 15000"
              className="w-full px-3.5 py-2.5 text-lg font-mono font-semibold tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {[10000, 15000, 25000, 40000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLimit(String(preset))}
                  className="px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  {formatCurrency(preset, currency)}
                </button>
              ))}
            </div>
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
              {submitting ? 'กำลังบันทึก...' : 'บันทึกงบประมาณ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
