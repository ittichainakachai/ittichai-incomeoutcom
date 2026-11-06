import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { BarChart3, Lock, PieChart, Wallet } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

export const LoginScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('auth/popup-closed-by-user')) {
        setError('ยกเลิกการเข้าสู่ระบบ กรุณากดปุ่มอีกครั้งเพื่อเข้าสู่ระบบด้วย Gmail');
      } else if (message.includes('auth/unauthorized-domain')) {
        setError('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication กรุณาตรวจสอบการตั้งค่า Authorized domains');
      } else {
        setError('ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            คลังบัญชี
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            ระบบจัดการรายรับ-รายจ่ายส่วนบุคคล
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700 mb-2">
                สมุดบัญชีดิจิทัล · เชื่อมต่อ Firebase Cloud
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-snug">
                วางแผนการเงินรายเดือนอย่างเป็นระบบ เห็นภาพรวมรายรับ-รายจ่ายชัดเจน
              </h1>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                บันทึกรายการรับ-จ่ายประจำวัน สรุปยอดคงเหลือรายเดือนอัตโนมัติ พร้อมกราฟวิเคราะห์แนวโน้มและสัดส่วนค่าใช้จ่ายตามหมวดหมู่ ข้อมูลทุกอย่างถูกจัดเก็บอย่างปลอดภัยในบัญชี Gmail ของคุณ
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>สรุปยอดรายเดือน</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  คำนวณรายรับ รายจ่าย ยอดสุทธิ และอัตราการออมเทียบกับเดือนก่อนหน้า
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>กราฟวิเคราะห์ข้อมูล</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  กราฟแท่งเปรียบเทียบ 12 เดือน และกราฟวงกลมแยกสัดส่วนตามหมวดหมู่
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <PieChart className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>ควบคุมงบประมาณ</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  ตั้งเป้าหมายงบรายจ่ายต่อเดือน พร้อมแถบแจ้งเตือนเมื่อใช้จ่ายใกล้เต็มวงเงิน
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center">
            <div>
              <h2 className="text-xl font-bold text-slate-900">เข้าสู่ระบบเพื่อเริ่มต้น</h2>
              <p className="mt-1.5 text-sm text-slate-600">
                ลงชื่อเข้าใช้ด้วยบัญชี Google (Gmail) เพื่อซิงค์ข้อมูลรายรับ-รายจ่ายของคุณ
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.31 0 3.25 2.69 1.28 6.6l3.66 2.84C5.8 6.86 8.65 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.52-1.14 2.82-2.4 3.68l3.88 3.01c2.27-2.09 3.54-5.17 3.54-8.93z"
                />
                <path
                  fill="#FBBC05"
                  d="M4.94 14.56A7.18 7.18 0 0 1 4.56 12c0-.89.15-1.75.38-2.56L1.28 6.6A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.66-2.84z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.05 1.16-3.35 0-6.2-1.86-7.06-4.68l-3.66 2.84C3.25 21.31 7.31 24 12 24z"
                />
              </svg>
              <span>{loading ? 'กำลังเชื่อมต่อบัญชี Gmail...' : 'เข้าสู่ระบบด้วย Gmail'}</span>
            </button>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                ข้อมูลของคุณถูกแยกเก็บเป็นส่วนตัวตามสิทธิ์บัญชีผู้ใช้ (Firebase Security Rules) ไม่มีผู้อื่นสามารถเข้าถึงได้
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>คลังบัญชี · Personal Finance Ledger</span>
          <span>ขับเคลื่อนด้วย Firebase Auth & Cloud Firestore</span>
        </div>
      </footer>
    </div>
  );
};
