// src/api/products.ts
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

export type LowStockAlert = {
  id: number;
  product_id: number;
  product_name?: string;
  current_stock?: number;
  threshold_qty: number;
  created_at: string;
  acknowledged_at: string | null;
};

export async function listProducts() {
  const d = await apiFetch("/api/products");
  return d.products as Product[];
}

export async function createProduct(payload: {
  name: string;
  price: number;
  description?: string;
  image?: string;
  stock?: number;
}) {
  const d = await apiFetch("/api/products", { method: "POST", body: payload });
  return d.product as Product;
}

export async function updateProduct(
  id: number,
  payload: Partial<{
    name: string;
    price: number;
    description: string;
    image: string;
    stock: number;
    is_active: boolean;
  }>
) {
  const d = await apiFetch(`/api/products/${id}`, { method: "PUT", body: payload });
  return d.product as Product;
}

export async function deleteProduct(id: number) {
  return apiFetch(`/api/products/${id}`, { method: "DELETE" });
}

export async function adjustStock(id: number, delta: number) {
  const d = await apiFetch(`/api/products/${id}/stock`, {
    method: "POST",
    body: { delta },
  });
  return d as { product: Product; lowStockAlert?: LowStockAlert | null };
}

export async function listLowStockAlerts() {
  const d = await apiFetch("/api/admin/low-stock-alerts");
  return d.alerts as LowStockAlert[];
}

export async function acknowledgeLowStockAlert(alertId: number) {
  const d = await apiFetch(`/api/admin/low-stock-alerts/${alertId}/ack`, {
    method: "POST",
  });
  return d as { ok: true };
}
