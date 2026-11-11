export const ROLES = ["designer", "call_center", "manager", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "new",
  "measuring",
  "in_production",
  "installation",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof STATUSES)[number];

export const METHODS = ["cash", "card", "kaspi", "transfer", "other"] as const;
export type PaymentMethod = (typeof METHODS)[number];

export type Source = "designer" | "online";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role | null;
  active: boolean;
};

export type Order = {
  id: string;
  order_number: number;
  client_name: string;
  client_phone: string;
  client_address: string;
  order_date: string;
  product_details: string;
  notes: string;
  total_cost: number;
  amount_paid: number;
  remaining_balance: number;
  status: OrderStatus;
  source: Source;
  designer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  designer?: { full_name: string } | null;
};

export type Payment = {
  id: string;
  order_id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  note: string;
  recorded_by_name: string;
  created_at: string;
};

export type OrderChange = {
  id: number;
  order_id: string;
  changed_by_name: string;
  changed_at: string;
  action: "created" | "updated" | "taken" | "payment_added" | "payment_deleted";
  reason: string;
  changes: Record<string, unknown>;
};

/** Row from my_entered_orders(): what call-center staff can see. */
export type EnteredOrder = {
  id: string;
  order_number: number;
  order_date: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  product_details: string;
  notes: string;
  status: OrderStatus;
  designer_name: string | null;
  editable: boolean;
  created_at: string;
};

/** Row from open_online_orders(): unassigned online orders. */
export type OpenOrder = Omit<EnteredOrder, "status" | "designer_name" | "editable">;

export const isManager = (role: Role | null | undefined) =>
  role === "manager" || role === "owner";
