const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

/** بيحوّل الأرقام العربية (٠١٢) والفارسية لأرقام إنجليزية (012). */
export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO));
  });
}

/**
 * بيوحّد النص للبحث: "أحمد" = "احمد"، "فاطمة" = "فاطمه"، "مصطفى" = "مصطفي"،
 * وبيشيل التشكيل والمسافات الزيادة.
 */
export function normalizeForSearch(value: string): string {
  return normalizeDigits(value ?? "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** بينضّف رقم الموبايل قبل الحفظ: أرقام إنجليزية ومن غير مسافات أو شرط. */
export function cleanPhone(value: string): string {
  const digits = normalizeDigits(value ?? "").trim();
  const plus = digits.startsWith("+") ? "+" : "";
  return plus + digits.replace(/\D/g, "");
}

/** بيحوّل الرقم للصيغة الدولية اللي واتساب بيقبلها (2010xxxxxxxx). */
export function whatsappNumber(phone: string): string {
  let digits = normalizeDigits(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length >= 12) return digits;
  if (digits.startsWith("0")) return `2${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `20${digits}`;
  return digits;
}

export function whatsappLink(phone: string, message?: string): string {
  const base = `https://wa.me/${whatsappNumber(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function formatMoney(value: number): string {
  return (Number(value) || 0).toLocaleString();
}
