import React, { useMemo, useState } from 'react';
import {
  CATEGORY_COLORS,
  CurrencyCode,
  formatCurrency,
  formatMonthLabel,
  THAI_MONTHS_SHORT,
  Transaction,
  TransactionType,
} from '../types/finance';

interface MonthlyChartsProps {
  transactions: Transaction[];
  selectedMonthKey: string;
  onSelectMonthKey: (monthKey: string) => void;
  currency: CurrencyCode;
}

export const MonthlyCharts: React.FC<MonthlyChartsProps> = ({
  transactions,
  selectedMonthKey,
  onSelectMonthKey,
  currency,
}) => {
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [breakdownType, setBreakdownType] = useState<TransactionType>('expense');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const selectedYear = selectedMonthKey.split('-')[0];
  const buddhistYear = Number(selectedYear) + 543;

  // 12-month aggregation for the selected year
  const yearlySeries = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');
      const key = `${selectedYear}-${mStr}`;
      return {
        monthKey: key,
        label: THAI_MONTHS_SHORT[idx],
        income: 0,
        expense: 0,
      };
    });

    transactions.forEach((tx) => {
      if (tx.monthKey.startsWith(`${selectedYear}-`)) {
        const mIdx = Number(tx.monthKey.split('-')[1]) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          if (tx.type === 'income') {
            months[mIdx].income += tx.amount;
          } else {
            months[mIdx].expense += tx.amount;
          }
        }
      }
    });

    return months;
  }, [transactions, selectedYear]);

  const maxYearlyValue = useMemo(() => {
    let maxVal = 0;
    yearlySeries.forEach((m) => {
      if (m.income > maxVal) maxVal = m.income;
      if (m.expense > maxVal) maxVal = m.expense;
    });
    return maxVal > 0 ? maxVal * 1.15 : 10000;
  }, [yearlySeries]);

  // Category breakdown for selected month
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    transactions.forEach((tx) => {
      if (tx.monthKey === selectedMonthKey && tx.type === breakdownType) {
        totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
        grandTotal += tx.amount;
      }
    });

    const items = Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
        color: CATEGORY_COLORS[category] || '#64748B',
      }))
      .sort((a, b) => b.amount - a.amount);

    return { items, grandTotal };
  }, [transactions, selectedMonthKey, breakdownType]);

  // SVG Donut geometry
  const donutSegments = useMemo(() => {
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercent = 0;

    return categoryBreakdown.items.map((item) => {
      const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((cumulativePercent / 100) * circumference);
      cumulativePercent += item.percentage;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryBreakdown.items]);

  const activeHoverMonth = hoveredMonthIdx !== null ? yearlySeries[hoveredMonthIdx] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 cols: 12-Month Cashflow Bar Chart */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              แนวโน้มรายรับ-รายจ่ายรายเดือน ปี {buddhistYear}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              คลิกที่แท่งกราฟของแต่ละเดือนเพื่อดูสรุปและรายการของเดือนนั้น
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
              รายรับ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
              รายจ่าย
            </span>
          </div>
        </div>

        {/* Interactive Tooltip Bar */}
        <div className="mt-4 min-h-9 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          {activeHoverMonth ? (
            <>
              <span className="font-semibold text-slate-900">
                {formatMonthLabel(activeHoverMonth.monthKey)}
              </span>
              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-700">
                  รายรับ: +{formatCurrency(activeHoverMonth.income, currency)}
                </span>
                <span className="text-rose-700">
                  รายจ่าย: -{formatCurrency(activeHoverMonth.expense, currency)}
                </span>
                <span
                  className={
                    activeHoverMonth.income - activeHoverMonth.expense >= 0
                      ? 'text-slate-900 font-semibold'
                      : 'text-rose-700 font-semibold'
                  }
                >
                  สุทธิ:{' '}
                  {formatCurrency(activeHoverMonth.income - activeHoverMonth.expense, currency)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-500">
              เลื่อนเมาส์เหนือแท่งกราฟเพื่อดูตัวเลขเปรียบเทียบรายเดือน
            </span>
          )}
        </div>

        {/* SVG Bar Chart */}
        <div className="mt-4 w-full overflow-x-auto">
          <svg
            viewBox="0 0 640 230"
            className="w-full h-56 min-w-[480px] select-none"
            role="img"
            aria-label="กราฟแท่งเปรียบเทียบรายรับและรายจ่ายรายเดือน"
          >
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = 190 - ratio * 160;
              const val = Math.round(maxYearlyValue * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1="48"
                    y1={y}
                    x2="628"
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    strokeWidth="1"
                  />
                  <text
                    x="42"
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-mono tabular-nums"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  </text>
                </g>
              );
            })}

            {/* 12 Month Columns */}
            {yearlySeries.map((m, idx) => {
              const colWidth = 48;
              const xStart = 52 + idx * colWidth;
              const isSelected = m.monthKey === selectedMonthKey;
              const isHovered = hoveredMonthIdx === idx;

              const incomeHeight = Math.max((m.income / maxYearlyValue) * 160, m.income > 0 ? 3 : 0);
              const expenseHeight = Math.max(
                (m.expense / maxYearlyValue) * 160,
                m.expense > 0 ? 3 : 0
              );

              return (
                <g
                  key={m.monthKey}
                  onMouseEnter={() => setHoveredMonthIdx(idx)}
                  onMouseLeave={() => setHoveredMonthIdx(null)}
                  onClick={() => onSelectMonthKey(m.monthKey)}
                  className="cursor-pointer"
                >
                  {/* Column background highlight */}
                  <rect
                    x={xStart + 2}
                    y={20}
                    width={colWidth - 4}
                    height={172}
                    rx="6"
                    fill={isSelected ? '#F1F5F9' : isHovered ? '#F8FAFC' : 'transparent'}
                  />

                  {/* Income bar */}
                  <rect
                    x={xStart + 9}
                    y={190 - incomeHeight}
                    width="13"
                    height={incomeHeight}
                    rx="2"
                    fill={isSelected || isHovered ? '#16A34A' : '#22C55E'}
                  />

                  {/* Expense bar */}
                  <rect
                    x={xStart + 25}
                    y={190 - expenseHeight}
                    width="13"
                    height={expenseHeight}
                    rx="2"
                    fill={isSelected || isHovered ? '#DC2626' : '#F43F5E'}
                  />

                  {/* Month label */}
                  <text
                    x={xStart + colWidth / 2}
                    y={210}
                    textAnchor="middle"
                    className={`text-[11px] ${
                      isSelected ? 'fill-slate-900 font-bold' : 'fill-slate-500 font-medium'
                    }`}
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Right 5 cols: Category Donut Breakdown */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">สัดส่วนตามหมวดหมู่</h3>
            <p className="text-xs text-slate-500 mt-0.5">{formatMonthLabel(selectedMonthKey)}</p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setBreakdownType('expense')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                breakdownType === 'expense'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายจ่าย
            </button>
            <button
              type="button"
              onClick={() => setBreakdownType('income')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                breakdownType === 'income'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายรับ
            </button>
          </div>
        </div>

        {categoryBreakdown.items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              ยังไม่มีข้อมูล{breakdownType === 'expense' ? 'รายจ่าย' : 'รายรับ'}ในเดือนนี้
            </p>
            <p className="text-xs text-slate-500 mt-1">
              บันทึกรายการใหม่เพื่อดูกราฟวิเคราะห์สัดส่วนตามหมวดหมู่
            </p>
          </div>
        ) : (
          <div className="mt-5 flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6">
            {/* Donut SVG */}
            <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 160 160" className="w-40 h-40 -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="20"
                />
                {donutSegments.map((seg) => {
                  const isHovered = hoveredCategory === seg.category;
                  return (
                    <circle
                      key={seg.category}
                      cx="80"
                      cy="80"
                      r="64"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isHovered ? '24' : '20'}
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      onMouseEnter={() => setHoveredCategory(seg.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="transition-all duration-150 cursor-pointer"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                <span className="text-[11px] text-slate-500">
                  {breakdownType === 'expense' ? 'จ่ายรวม' : 'รับรวม'}
                </span>
                <span className="text-xs font-mono font-bold tabular-nums text-slate-900 mt-0.5 truncate max-w-[104px]">
                  {formatCurrency(categoryBreakdown.grandTotal, currency)}
                </span>
              </div>
            </div>

            {/* Ranked Category List */}
            <div className="w-full flex-1 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {categoryBreakdown.items.map((item) => {
                const isHovered = hoveredCategory === item.category;
                return (
                  <div
                    key={item.category}
                    onMouseEnter={() => setHoveredCategory(item.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`p-2 rounded-lg transition-colors cursor-default ${
                      isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-800 truncate">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                        <span className="text-slate-900 font-semibold">
                          {formatCurrency(item.amount, currency)}
                        </span>
                        <span className="text-slate-400 w-11 text-right">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.min(item.percentage, 100)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
