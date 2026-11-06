import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CurrencyCode,
  MonthlyBudget,
  Transaction,
  TransactionType,
  UserProfile,
} from '../types/finance';

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const displayName = (user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน').slice(0, 100);
    const email = (user.email || '').slice(0, 150);
    const profilePayload: Record<string, unknown> = {
      uid: user.uid,
      displayName,
      email,
      currency: 'THB',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      profilePayload.photoURL = user.photoURL.slice(0, 500);
    }
    await setDoc(userRef, profilePayload);
    return {
      uid: user.uid,
      displayName,
      email,
      photoURL: user.photoURL || undefined,
      currency: 'THB',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserCurrency(uid: string, currency: CurrencyCode): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      currency,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeToTransactions(
  uid: string,
  onData: (transactions: Transaction[]) => void,
  onError: (error: Error) => void
): () => void {
  const q = query(collection(db, 'transactions'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Transaction[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Transaction, 'id'>),
      }));
      items.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.id.localeCompare(a.id);
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  category: string;
  title: string;
  note?: string;
  date: string;
  paymentMethod: string;
}

export async function createTransaction(uid: string, input: TransactionInput): Promise<string> {
  const cleanTitle = input.title.trim().slice(0, 120);
  const cleanCategory = input.category.trim().slice(0, 50);
  const cleanPayment = input.paymentMethod.trim().slice(0, 40);
  const cleanDate = input.date.trim().slice(0, 10);
  const monthKey = cleanDate.slice(0, 7);
  const cleanAmount = Math.min(Math.max(Number(input.amount), 0.01), 1000000000);
  const cleanNote = input.note?.trim().slice(0, 300);

  const payload: Record<string, unknown> = {
    userId: uid,
    type: input.type,
    amount: cleanAmount,
    category: cleanCategory,
    title: cleanTitle,
    date: cleanDate,
    monthKey,
    paymentMethod: cleanPayment,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanNote && cleanNote.length > 0) {
    payload.note = cleanNote;
  }

  try {
    const docRef = await addDoc(collection(db, 'transactions'), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
  }
}

export async function updateTransaction(
  transactionId: string,
  input: TransactionInput
): Promise<void> {
  const path = `transactions/${transactionId}`;
  const cleanTitle = input.title.trim().slice(0, 120);
  const cleanCategory = input.category.trim().slice(0, 50);
  const cleanPayment = input.paymentMethod.trim().slice(0, 40);
  const cleanDate = input.date.trim().slice(0, 10);
  const monthKey = cleanDate.slice(0, 7);
  const cleanAmount = Math.min(Math.max(Number(input.amount), 0.01), 1000000000);
  const cleanNote = input.note?.trim().slice(0, 300) ?? '';

  const payload: Record<string, unknown> = {
    type: input.type,
    amount: cleanAmount,
    category: cleanCategory,
    title: cleanTitle,
    note: cleanNote,
    date: cleanDate,
    monthKey,
    paymentMethod: cleanPayment,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'transactions', transactionId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const path = `transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToBudgets(
  uid: string,
  onData: (budgets: Record<string, MonthlyBudget>) => void,
  onError: (error: Error) => void
): () => void {
  const q = query(collection(db, 'budgets'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, MonthlyBudget> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as Omit<MonthlyBudget, 'id'>;
        map[data.monthKey] = {
          id: d.id,
          ...data,
        };
      });
      onData(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'budgets');
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export async function setMonthlyBudget(
  uid: string,
  monthKey: string,
  limitAmount: number
): Promise<void> {
  const budgetId = `${uid}_${monthKey}`;
  const path = `budgets/${budgetId}`;
  const budgetRef = doc(db, 'budgets', budgetId);
  const cleanLimit = Math.min(Math.max(Number(limitAmount), 0), 1000000000);

  try {
    const existingSnap = await getDoc(budgetRef);
    if (existingSnap.exists()) {
      await updateDoc(budgetRef, {
        limitAmount: cleanLimit,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(budgetRef, {
        userId: uid,
        monthKey,
        limitAmount: cleanLimit,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
