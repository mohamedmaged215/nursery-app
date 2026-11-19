export type StudentType = "street" | "bus";
export type StudentStatus = "active" | "inactive";

export interface Student {
  id: string;
  name: string;
  phone: string;
  type: StudentType;
  area: string;
  subscriptionAmount: number;
  /** مديونية مرحّلة من اشتراكات سابقة — جزء من totalAmount */
  previousDebt: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: StudentStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName?: string;
  amount: number;
  date: string;
}

export type ExpenseType = "supplies" | "rent";

export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string;
  /** "supplies" | "rent" — مصاريف قديمة ممكن يكون ليها نوع تاني وبتتعرض "أخرى" */
  type: string;
  month: number; // 0-indexed
  year: number;
  createdAt: string;
}

export type EmployeeRole = "teacher" | "driver" | "other";

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  monthlySalary: number;
  createdAt: string;
  /** موظف اتحذف من القائمة لكن مرتباته القديمة لسه محسوبة في التقارير */
  deleted?: boolean;
}

export interface Salary {
  id: string;
  employeeId: string;
  amount: number;
  month: number; // 0-indexed
  year: number;
  date: string;
}

export interface MonthRef {
  month: number; // 0-indexed
  year: number;
}
