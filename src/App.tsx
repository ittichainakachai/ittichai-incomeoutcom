import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BudgetModal } from './components/BudgetModal';
import { LoginScreen } from './components/LoginScreen';
import { MonthlyCharts } from './components/MonthlyCharts';
import { TransactionModal } from './components/TransactionModal';
import { auth } from './lib/firebase';
import {
  createTransaction,
  deleteTransaction,
  ensureUserProfile,
  setMonthlyBudget,
  subscribeToBudgets,
  subscribeToTransactions,
  TransactionInput,
  updateTransaction,
  updateUserCurrency,
} from './services/financeService';
import {
  CurrencyCode,
  EXPENSE_CATEGORIES,
  formatCurrency,
  formatMonthLabel,
  INCOME_CATEGORIES,
  MonthlyBudget,
  THAI_MONTHS_SHORT,
  Transaction,
  UserProfile,
} from './types/finance';

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const date = new Date(Number(yStr), Number(mStr) - 1 + deltaMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatThaiDate(dateStr: string): string {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const day = Number(dStr);
  if (Number.isNaN(year) || Number.isNaN(monthIdx) || Number.isNaN(day)) return dateStr;
  return `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${year + 543}`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, MonthlyBudget>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getCurrentMonthKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userProf = await ensureUserProfile(firebaseUser);
          setProfile(userProf);
        } catch (err) {
          console.error(err);
        }
      } else {
        setProfile(null);
        setTransactions([]);
        setBudgets({});
        setDataLoading(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    setDataError(null);

    const unsubTx = subscribeToTransactions(
      user.uid,
      (items) => {
        setTransactions(items);
        setDataLoading(false);
      },
      (err) => {
        setDataError(err.message);
        setDataLoading(false);
      }
    );

    const unsubBudgets = subscribeToBudgets(
      user.uid,
      (budgetMap) => {
        setBudgets(budgetMap);
      },
      (err) => {
        console.error(err);
      }
    );

    return () => {
      unsubTx();
      unsubBudgets();
    };
  }, [user]);

  const currency: CurrencyCode = profile?.currency || 'THB';

  // Monthly Summary Calculations
  const monthlyStats = useMemo(() => {
    const prevMonthKey = shiftMonthKey(selectedMonthKey, -1);

    let income = 0;
    let expense = 0;
    let prevIncome = 0;
    let prevExpense = 0;

    transactions.forEach((tx) => {
      if (tx.monthKey === selectedMonthKey) {
        if (tx.type === 'income') income += tx.amount;
        else expense += tx.amount;
      } else if (tx.monthKey === prevMonthKey) {
        if (tx.type === 'income') prevIncome += tx.amount;
        else prevExpense += tx.amount;
      }
    });

    const net = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
    const incomeDeltaPct =
      prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : null;
    const expenseDeltaPct =
      prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;

    return {
      income,
      expense,
      net,
      savingsRate,
      incomeDeltaPct,
      expenseDeltaPct,
    };
  }, [transactions, selectedMonthKey]);

  const currentBudgetLimit = budgets[selectedMonthKey]?.limitAmount ?? 0;
  const budgetUsagePct =
    currentBudgetLimit > 0 ? (monthlyStats.expense / currentBudgetLimit) * 100 : 0;

  // Filtered Transactions for Selected Month
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (tx.monthKey !== selectedMonthKey) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
      if (q) {
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchNote = (tx.note || '').toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        if (!matchTitle && !matchNote && !matchCat) return false;
      }
      return true;
    });
  }, [transactions, selectedMonthKey, typeFilter, categoryFilter, searchQuery]);

  const handleSaveTransaction = async (input: TransactionInput) => {
    if (!user) return;
    if (editingTx) {
      await updateTransaction(editingTx.id, input);
    } else {
      await createTransaction(user.uid, input);
    }
    const newMonthKey = input.date.slice(0, 7);
    if (newMonthKey !== selectedMonthKey) {
      setSelectedMonthKey(newMonthKey);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBudget = async (limitAmount: number) => {
    if (!user) return;
    await setMonthlyBudget(user.uid, selectedMonthKey, limitAmount);
  };

  const handleCurrencyChange = async (nextCurrency: CurrencyCode) => {
    if (!user) return;
    setProfile((prev) => (prev ? { ...prev, currency: nextCurrency } : prev));
    try {
      await updateUserCurrency(user.uid, nextCurrency);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCsv = () => {
    const headers = ['วันที่', 'ประเภท', 'ชื่อรายการ', 'หมวดหมู่', 'ช่องทางชำระเงิน', 'จำนวนเงิน', 'หมายเหตุ'];
    const rows = filteredTransactions.map((tx) => [
      tx.date,
      tx.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${tx.category.replace(/"/g, '""')}"`,
      `"${tx.paymentMethod.replace(/"/g, '""')}"`,
      tx.amount.toFixed(2),
      `"${(tx.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions-${selectedMonthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSeedSampleData = async () => {
    if (!user || seedingDemo) return;
    setSeedingDemo(true);
    try {
      const m = selectedMonthKey;
      const prevM = shiftMonthKey(selectedMonthKey, -1);
      const samples: TransactionInput[] = [
        {
          type: 'income',
          amount: 45000,
          category: 'เงินเดือน',
          title: 'เงินเดือนประจำเดือน',
          date: `${m}-01`,
          paymentMethod: 'บัญชีธนาคาร',
        },
        {
          type: 'income',
          amount: 8500,
          category: 'ฟรีแลนซ์',
          title: 'ค่าออกแบบระบบเว็บไซต์',
          date: `${m}-10`,
          paymentMethod: 'โอนเงิน / พร้อมเพย์',
        },
        {
          type: 'expense',
          amount: 9500,
          category: 'ที่อยู่อาศัยและค่าเช่า',
          title: 'ค่าเช่าคอนโดมิเนียม',
          date: `${m}-02`,
          paymentMethod: 'โอนเงิน / พร้อมเพย์',
        },
        {
          type: 'expense',
          amount: 2450,
          category: 'ค่าน้ำ ค่าไฟ อินเทอร์เน็ต',
          title: 'ค่าไฟฟ้าและอินเทอร์เน็ตบ้าน',
          date: `${m}-05`,
          paymentMethod: 'โอนเงิน / พร้อมเพย์',
        },
        {
          type: 'expense',
          amount: 4200,
          category: 'อาหารและเครื่องดื่ม',
          title: 'ค่าอาหารและซูเปอร์มาร์เก็ต',
          date: `${m}-08`,
          paymentMethod: 'บัตรเครดิต',
        },
        {
          type: 'expense',
          amount: 1850,
          category: 'เดินทางและคมนาคม',
          title: 'ค่าทางด่วนและเติมน้ำมัน',
          date: `${m}-12`,
          paymentMethod: 'บัตรเครดิต',
        },
        {
          type: 'expense',
          amount: 5000,
          category: 'ออมเงินและลงทุน',
          title: 'ออมกองทุนรวมดัชนี',
          date: `${m}-15`,
          paymentMethod: 'บัญชีธนาคาร',
        },
        {
          type: 'income',
          amount: 45000,
          category: 'เงินเดือน',
          title: 'เงินเดือนประจำเดือน',
          date: `${prevM}-01`,
          paymentMethod: 'บัญชีธนาคาร',
        },
        {
          type: 'expense',
          amount: 9500,
          category: 'ที่อยู่อาศัยและค่าเช่า',
          title: 'ค่าเช่าคอนโดมิเนียม',
          date: `${prevM}-02`,
          paymentMethod: 'โอนเงิน / พร้อมเพย์',
        },
        {
          type: 'expense',
          amount: 6100,
          category: 'อาหารและเครื่องดื่ม',
          title: 'ค่าอาหารตลอดเดือน',
          date: `${prevM}-14`,
          paymentMethod: 'โอนเงิน / พร้อมเพย์',
        },
      ];
      await Promise.all(samples.map((s) => createTransaction(user.uid, s)));
      await setMonthlyBudget(user.uid, m, 25000);
    } catch (err) {
      console.error(err);
    } finally {
      setSeedingDemo(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            className="text-[21px] font-bold italic tracking-tight text-[#1c8218] whitespace-nowrap shrink-0"
          >
            คลังบัญชีครอบครัว
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#summary-section"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              สรุปรายเดือน
            </a>
            <a
              href="#analytics-section"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              กราฟวิเคราะห์
            </a>
            <a
              href="#ledger-section"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              รายการรับ-จ่าย
            </a>
          </nav>

          {/* Zone 3: Primary CTA + User Account */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>บันทึกรายการ</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'โปรไฟล์ผู้ใช้'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden lg:block text-left max-w-[140px]">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user.displayName || 'ผู้ใช้งาน'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                title="ออกจากระบบ"
                aria-label="ออกจากระบบ"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Workspace Toolbar: Month Navigation & Controls */}
        <section
          id="summary-section"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              สรุปรายรับ-รายจ่ายประจำเดือน
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              บัญชี: {user.email} · เชื่อมต่อฐานข้อมูล Firebase Cloud Firestore
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Switcher */}
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSelectedMonthKey((prev) => shiftMonthKey(prev, -1))}
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-900 min-w-[124px] text-center whitespace-nowrap">
                {formatMonthLabel(selectedMonthKey)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonthKey((prev) => shiftMonthKey(prev, 1))}
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedMonthKey !== getCurrentMonthKey() && (
              <button
                type="button"
                onClick={() => setSelectedMonthKey(getCurrentMonthKey())}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                เดือนปัจจุบัน
              </button>
            )}

            {/* Currency Selector */}
            <select
              aria-label="สกุลเงิน"
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="THB">THB (฿)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="JPY">JPY (¥)</option>
            </select>

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        </section>

        {dataError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            เกิดข้อผิดพลาดในการโหลดข้อมูล: {dataError}
          </div>
        )}

        {/* 4-Column Monthly Summary KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Card 1: Total Income */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">รายรับรวมเดือนนี้</span>
              <span className="text-[11px] font-medium text-emerald-700">รายรับ</span>
            </div>
            <p className="mt-3 text-2xl font-mono font-bold tabular-nums text-emerald-700">
              +{formatCurrency(monthlyStats.income, currency)}
            </p>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              {monthlyStats.incomeDeltaPct !== null ? (
                <>
                  {monthlyStats.incomeDeltaPct >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'}{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {Math.abs(monthlyStats.incomeDeltaPct).toFixed(1)}%
                  </span>{' '}
                  เทียบเดือนก่อน
                </>
              ) : (
                'ยังไม่มีข้อมูลเปรียบเทียบเดือนก่อน'
              )}
            </p>
          </div>

          {/* Card 2: Total Expense */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">รายจ่ายรวมเดือนนี้</span>
              <span className="text-[11px] font-medium text-rose-700">รายจ่าย</span>
            </div>
            <p className="mt-3 text-2xl font-mono font-bold tabular-nums text-rose-700">
              -{formatCurrency(monthlyStats.expense, currency)}
            </p>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              {monthlyStats.expenseDeltaPct !== null ? (
                <>
                  {monthlyStats.expenseDeltaPct >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'}{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {Math.abs(monthlyStats.expenseDeltaPct).toFixed(1)}%
                  </span>{' '}
                  เทียบเดือนก่อน
                </>
              ) : (
                'ยังไม่มีข้อมูลเปรียบเทียบเดือนก่อน'
              )}
            </p>
          </div>

          {/* Card 3: Net Balance */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">ยอดคงเหลือสุทธิ</span>
              <span
                className={`text-[11px] font-medium ${
                  monthlyStats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {monthlyStats.net >= 0 ? 'เกินดุล' : 'ขาดดุล'}
              </span>
            </div>
            <p
              className={`mt-3 text-2xl font-mono font-bold tabular-nums ${
                monthlyStats.net >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {monthlyStats.net > 0 ? '+' : ''}
              {formatCurrency(monthlyStats.net, currency)}
            </p>
            <p className="mt-2 text-xs text-slate-500 tabular-nums">
              {monthlyStats.income > 0 ? (
                <>
                  อัตราการออมสุทธิ{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {monthlyStats.savingsRate.toFixed(1)}%
                  </span>
                </>
              ) : (
                'บันทึกรายรับเพื่อคำนวณอัตราการออม'
              )}
            </p>
          </div>

          {/* Card 4: Monthly Budget */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">งบประมาณรายจ่าย</span>
              <button
                type="button"
                onClick={() => setIsBudgetModalOpen(true)}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
              >
                {currentBudgetLimit > 0 ? 'แก้ไขงบ' : 'ตั้งงบประมาณ'}
              </button>
            </div>

            {currentBudgetLimit > 0 ? (
              <>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="text-lg font-mono font-bold tabular-nums text-slate-900">
                    {formatCurrency(currentBudgetLimit, currency)}
                  </p>
                  <span
                    className={`text-xs font-mono font-semibold tabular-nums ${
                      budgetUsagePct >= 100
                        ? 'text-rose-700'
                        : budgetUsagePct >= 80
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    ใช้ไป {budgetUsagePct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        budgetUsagePct >= 100
                          ? 'bg-rose-600'
                          : budgetUsagePct >= 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(budgetUsagePct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                    {currentBudgetLimit - monthlyStats.expense >= 0
                      ? `คงเหลือ ${formatCurrency(currentBudgetLimit - monthlyStats.expense, currency)}`
                      : `เกินงบ ${formatCurrency(monthlyStats.expense - currentBudgetLimit, currency)}`}
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700">ยังไม่ได้กำหนดงบเดือนนี้</p>
                <p className="mt-1 text-xs text-slate-500">
                  ตั้งเป้าหมายรายจ่ายเพื่อติดตามการใช้เงินแบบเรียลไทม์
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Analytical Charts Section */}
        <section id="analytics-section">
          <MonthlyCharts
            transactions={transactions}
            selectedMonthKey={selectedMonthKey}
            onSelectMonthKey={setSelectedMonthKey}
            currency={currency}
          />
        </section>

        {/* Transaction Ledger Section */}
        <section
          id="ledger-section"
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                รายการรายรับ-รายจ่าย · {formatMonthLabel(selectedMonthKey)}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                แสดง {filteredTransactions.length} รายการ
              </p>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารายการ..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Type Segmented Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'income', label: 'รายรับ' },
                    { id: 'expense', label: 'รายจ่าย' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      typeFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Category Filter */}
              <div className="relative flex items-center">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <select
                  aria-label="กรองตามหมวดหมู่"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="all">ทุกหมวดหมู่</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {dataLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-slate-900">
                ไม่พบรายการรายรับ-รายจ่ายในเดือน {formatMonthLabel(selectedMonthKey)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                เริ่มต้นบันทึกรายการใหม่ของคุณ หรือเพิ่มชุดข้อมูลตัวอย่างเพื่อทดลองดูกราฟวิเคราะห์
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTx(null);
                    setIsTxModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>บันทึกรายการแรก</span>
                </button>
                {transactions.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedSampleData}
                    disabled={seedingDemo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{seedingDemo ? 'กำลังสร้างข้อมูลตัวอย่าง...' : 'เพิ่มข้อมูลตัวอย่าง'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-6">วันที่</th>
                    <th className="py-3 px-4">รายการ</th>
                    <th className="py-3 px-4">หมวดหมู่ · ช่องทาง</th>
                    <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                    <th className="py-3 px-6 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const isConfirmingDelete = confirmDeleteId === tx.id;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6 text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatThaiDate(tx.date)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{tx.title}</div>
                          {tx.note && (
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {tx.note}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <span>{tx.category}</span>
                          <span className="mx-1.5 text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500">{tx.paymentMethod}</span>
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                            isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount, currency)}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap">
                          {isConfirmingDelete ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer"
                              >
                                ยืนยันลบ
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTx(tx);
                                  setIsTxModalOpen(true);
                                }}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="แก้ไขรายการ"
                                aria-label={`แก้ไข ${tx.title}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ลบรายการ"
                                aria-label={`ลบ ${tx.title}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>คลังบัญชี · ระบบจัดการรายรับ-รายจ่ายส่วนบุคคล</span>
          <span>เชื่อมต่อ Firebase Project: red-welder-474822-e0</span>
        </div>
      </footer>

      {/* Modals */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        onSubmit={handleSaveTransaction}
        initialData={editingTx}
        defaultMonthKey={selectedMonthKey}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        onSave={handleSaveBudget}
        monthKey={selectedMonthKey}
        currentLimit={currentBudgetLimit}
        currency={currency}
      />
    </div>
  );
}
