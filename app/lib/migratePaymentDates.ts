import { collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * One-time migration: for each customer, find their payments and set each
 * payment's date to the customer's startDate (fixing records saved with today's date).
 *
 * Call this once from any page or the browser console via:
 *   import { migratePaymentDates } from "@/app/lib/migratePaymentDates";
 *   migratePaymentDates();
 */
export async function migratePaymentDates() {
  const customersSnap = await getDocs(collection(db, "customers"));
  let fixed = 0;

  for (const customerDoc of customersSnap.docs) {
    const customer = customerDoc.data();
    const paymentsSnap = await getDocs(
      query(collection(db, "payments"), where("customerId", "==", customerDoc.id))
    );

    for (const paymentDoc of paymentsSnap.docs) {
      const payment = paymentDoc.data();
      console.log(
        `Customer: ${customer.name} | startDate: ${customer.startDate} | payment.date: ${payment.date}`
      );
      if (payment.date !== customer.startDate) {
        await updateDoc(paymentDoc.ref, { date: customer.startDate });
        console.log(`  ✅ Fixed: ${payment.date} → ${customer.startDate}`);
        fixed++;
      } else {
        console.log(`  ✓ Already correct`);
      }
    }
  }

  console.log(`Migration complete. Fixed ${fixed} payment(s).`);
}
