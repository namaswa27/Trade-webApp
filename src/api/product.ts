// src/api/product.ts
import { apiFetch } from "../auth/api";

export type Product = {
  id: number;
  name: string;
  price_int: number;
  description: string;
  image: string;
  stock: number;
  is_active: boolean;
};

// What AdminDashboard wants to display.
// Backend can optionally include product_name/current_stock in the response.
export type LowStockAlert = {
  id: number;
  product_id: number;
  restock_event_id: number | null;
  threshold_qty: number;
  created_at: string;
  acknowledged_at: string | null;

  // Optional extras (if your backend returns them via JOIN)
  product_name?: string;
  current_stock?: number;
};

export async function listProducts() {
  const d = await apiFetch("/api/product");
  return (d.products || []) as Product[];
}

export async function createProduct(payload: {
  name: string;
  price: number;
  description?: string;
  image?: string;
  stock?: number;
}) {
  const d = await apiFetch("/api/product", { method: "POST", body: payload });
  return d.product as Product;
}

export async function updateProduct(
  id: number,
  payload: Partial<{
    name: string;
    price: number; // backend expects "price" not "price_int"
    description: string;
    image: string;
    stock: number;
    is_active: boolean;
  }>
) {
  const d = await apiFetch(`/api/product/${id}`, { method: "PUT", body: payload });
  return d.product as Product;
}

/**
 * Adjust stock by delta
 * Expected backend response:
 * { product: Product, lowStockAlert?: LowStockAlert | null }
 */
export async function adjustStock(id: number, delta: number) {
  const d = await apiFetch(`/api/product/${id}/stock`, {
    method: "POST",
    body: { delta },
  });

  return d as { product: Product; lowStockAlert?: LowStockAlert | null };
}

export async function deleteProduct(id: number) {
  return apiFetch(`/api/product/${id}`, { method: "DELETE" });
}

/**
 * List open low-stock alerts (admin)
 * Backend should return: { alerts: LowStockAlert[] }
 */
export async function listLowStockAlerts() {
  const d = await apiFetch("/api/admin/low-stock-alerts");
  return (d.alerts || []) as LowStockAlert[];
}

/**
 * Acknowledge a low-stock alert (admin)
 * Backend should return: { ok: true }
 */
export async function acknowledgeLowStockAlert(alertId: number) {
  const d = await apiFetch(`/api/admin/low-stock-alerts/${alertId}/ack`, {
    method: "POST",
  });
  return d as { ok: true };
}
