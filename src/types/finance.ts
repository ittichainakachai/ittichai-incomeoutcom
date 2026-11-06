export type TransactionType = 'income' | 'expense';

export type CurrencyCode = 'THB' | 'USD' | 'EUR' | 'JPY';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  currency: CurrencyCode;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  title: string;
  note?: string;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  paymentMethod: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MonthlyBudget {
  id: string;
  userId: string;
  monthKey: string; // YYYY-MM
  limitAmount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const INCOME_CATEGORIES = [
  'เงินเดือน',
  'โบนัส',
  'ฟรีแลนซ์',
  'ธุรกิจส่วนตัว',
  'เงินปันผล / ลงทุน',
  'รายรับอื่นๆ',
] as const;

export const EXPENSE_CATEGORIES = [
  'อาหารและเครื่องดื่ม',
  'เดินทางและคมนาคม',
  'ที่อยู่อาศัยและค่าเช่า',
  'ค่าน้ำ ค่าไฟ อินเทอร์เน็ต',
  'ช้อปปิ้งและของใช้',
  'สุขภาพและการแพทย์',
  'บันเทิงและท่องเที่ยว',
  'การศึกษา',
  'ออมเงินและลงทุน',
  'รายจ่ายอื่นๆ',
] as const;

export const PAYMENT_METHODS = [
  'โอนเงิน / พร้อมเพย์',
  'เงินสด',
  'บัตรเครดิต',
  'บัตรเดบิต',
  'บัญชีธนาคาร',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'อาหารและเครื่องดื่ม': '#0F766E',
  'เดินทางและคมนาคม': '#0369A1',
  'ที่อยู่อาศัยและค่าเช่า': '#4338CA',
  'ค่าน้ำ ค่าไฟ อินเทอร์เน็ต': '#D97706',
  'ช้อปปิ้งและของใช้': '#BE185D',
  'สุขภาพและการแพทย์': '#DC2626',
  'บันเทิงและท่องเที่ยว': '#7C3AED',
  'การศึกษา': '#0284C7',
  'ออมเงินและลงทุน': '#16A34A',
  'รายจ่ายอื่นๆ': '#64748B',
  'เงินเดือน': '#16A34A',
  'โบนัส': '#0D9488',
  'ฟรีแลนซ์': '#2563EB',
  'ธุรกิจส่วนตัว': '#4F46E5',
  'เงินปันผล / ลงทุน': '#059669',
  'รายรับอื่นๆ': '#64748B',
};

export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

export function formatCurrency(amount: number, currency: CurrencyCode = 'THB'): string {
  const localeMap: Record<CurrencyCode, string> = {
    THB: 'th-TH',
    USD: 'en-US',
    EUR: 'de-DE',
    JPY: 'ja-JP',
  };
  return new Intl.NumberFormat(localeMap[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount);
}

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return monthKey;
  }
  return `${THAI_MONTHS[monthIdx]} ${year + 543}`;
}
