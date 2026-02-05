import { apiFetch } from "../auth/api";

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "delivered" | "pending_whatsapp";
export type OrderChannel = "in_app" | "whatsapp";

export type Order = {
  id: number;
  channel: OrderChannel;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  delivery_location: string;
  note: string;
  total_int: number;
  user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  product_id: number;
  name_snapshot: string;
  price_int_snapshot: number;
  qty: number;
  line_total_int: number;
};

export async function createOrder(payload: {
  channel: OrderChannel;
  delivery_location: string;
  note?: string;
  items: { product_id: number; qty: number }[];
}) {
  const d = await apiFetch("/api/orders", { method: "POST", body: payload });
  return d as { order: Order; items: OrderItem[] };
}

export async function listMyOrders() {
  const d = await apiFetch("/api/orders/my");
  return d.orders as Order[];
}

export async function listOrdersAdmin() {
  const d = await apiFetch("/api/orders");
  return d.orders as Order[];
}

export async function getOrderAdmin(id: number) {
  const d = await apiFetch(`/api/orders/${id}`);
  return d as { order: Order; items: OrderItem[] };
}

export async function confirmOrderAdmin(id: number) {
  const d = await apiFetch(`/api/orders/${id}/confirm`, { method: "POST" });
  return d.order as Order;
}

export async function cancelOrderAdmin(id: number) {
  const d = await apiFetch(`/api/orders/${id}/cancel`, { method: "POST" });
  return d.order as Order;
}

export async function deliverOrderAdmin(id: number) {
  const d = await apiFetch(`/api/orders/${id}/deliver`, { method: "POST" });
  return d.order as Order;
}
