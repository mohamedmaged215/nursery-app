import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Customer, Payment, Sale, Expense, InventoryItem, InventoryPurchase } from "./types";

export async function addCustomer(customer: Omit<Customer, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "customers"), customer);
  return ref.id;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  await updateDoc(doc(db, "customers", id), data);
  if (data.price !== undefined) {
    const snapshot = await getDocs(query(collection(db, "payments"), where("customerId", "==", id)));
    await Promise.all(snapshot.docs.map((d) => updateDoc(d.ref, { amount: data.price })));
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, "customers", id));
  const snapshot = await getDocs(query(collection(db, "payments"), where("customerId", "==", id)));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

export async function getCustomers(): Promise<Customer[]> {
  const snapshot = await getDocs(collection(db, "customers"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
}

export async function addPayment(payment: Omit<Payment, "id">): Promise<void> {
  await addDoc(collection(db, "payments"), payment);
}

export async function renewCustomer(
  id: string,
  data: Pick<Customer, "startDate" | "endDate" | "durationDays" | "price" | "status">,
  payment: Omit<Payment, "id">
): Promise<void> {
  await updateDoc(doc(db, "customers", id), data);
  await addDoc(collection(db, "payments"), payment);
}

export async function getPayments(): Promise<Payment[]> {
  const snapshot = await getDocs(collection(db, "payments"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
}

export async function addSale(sale: Omit<Sale, "id">): Promise<void> {
  await addDoc(collection(db, "sales"), sale);
}

export async function getSales(): Promise<Sale[]> {
  const snapshot = await getDocs(collection(db, "sales"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

export async function deleteSale(id: string): Promise<void> {
  await deleteDoc(doc(db, "sales", id));
}

export async function addExpense(expense: Omit<Expense, "id">): Promise<void> {
  await addDoc(collection(db, "expenses"), expense);
}

export async function getExpenses(): Promise<Expense[]> {
  const snapshot = await getDocs(collection(db, "expenses"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}

export async function addInventoryItem(item: Omit<InventoryItem, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "inventory"), item);
  return ref.id;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const snapshot = await getDocs(collection(db, "inventory"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem));
}

export async function updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<void> {
  await updateDoc(doc(db, "inventory", id), data);
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "inventory", id));
}

export async function addInventoryPurchase(purchase: Omit<InventoryPurchase, "id">): Promise<void> {
  await addDoc(collection(db, "inventoryPurchases"), purchase);
}

export async function getInventoryPurchases(): Promise<InventoryPurchase[]> {
  const snapshot = await getDocs(collection(db, "inventoryPurchases"));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryPurchase));
}
