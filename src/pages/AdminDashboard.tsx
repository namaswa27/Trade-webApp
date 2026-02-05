// src/pages/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ui } from "../ui/ui";

import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  listLowStockAlerts,
  acknowledgeLowStockAlert,
  type Product,
  type LowStockAlert,
} from "../api/products";

import {
  listOrdersAdmin,
  getOrderAdmin,
  confirmOrderAdmin,
  cancelOrderAdmin,
  deliverOrderAdmin,
  type Order,
  type OrderItem,
} from "../api/order";

function formatKsh(amount: number) {
  return `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
}

function badge(status: string) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold";
  if (status === "confirmed") return `${base} bg-emerald-100 text-emerald-700`;
  if (status === "cancelled") return `${base} bg-rose-100 text-rose-700`;
  if (status === "delivered") return `${base} bg-blue-100 text-blue-700`;
  if (status === "pending_whatsapp") return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-slate-100 text-slate-700`;
}

export default function AdminDashboard() {
  const { user, isAdmin, logout } = useAuth();

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2500);
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(true);

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [stock, setStock] = useState<number>(0);

  const [editing, setEditing] = useState<Product | null>(null);

  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [openOrder, setOpenOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [orderModalLoading, setOrderModalLoading] = useState(false);

  const totalStock = useMemo(
    () => products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0),
    [products]
  );

  const refreshProducts = async () => {
    const ps = await listProducts();
    setProducts(ps);
  };

  const refreshAlerts = async () => {
    setAlertsLoading(true);
    try {
      const a = await listLowStockAlerts();
      setAlerts(a);
    } finally {
      setAlertsLoading(false);
    }
  };

  const refreshOrders = async () => {
    setOrdersLoading(true);
    try {
      const os = await listOrdersAdmin();
      setOrders(os);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setProdLoading(true);
        await Promise.all([refreshProducts(), refreshAlerts(), refreshOrders()]);
      } catch (e: any) {
        showToast(e?.message || "Failed to load admin data");
      } finally {
        setProdLoading(false);
      }
    })();
  }, []);

  const createNewProduct = async () => {
    try {
      if (!name.trim()) return showToast("Product name required");
      if (!Number.isFinite(price) || price <= 0) return showToast("Valid price required");

      await createProduct({
        name: name.trim(),
        price: Number(price),
        description,
        image,
        stock: Number(stock) || 0,
      });

      showToast("Product created");
      setName("");
      setPrice(0);
      setDescription("");
      setImage("");
      setStock(0);

      await Promise.all([refreshProducts(), refreshAlerts()]);
    } catch (e: any) {
      showToast(e?.message || "Create failed");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateProduct(editing.id, {
        name: editing.name,
        price: editing.price_int, // backend expects "price"
        description: editing.description,
        image: editing.image,
        stock: editing.stock,
        is_active: editing.is_active,
      });

      showToast("Product updated");
      setEditing(null);
      await Promise.all([refreshProducts(), refreshAlerts()]);
    } catch (e: any) {
      showToast(e?.message || "Update failed");
    }
  };

  const softDelete = async (id: number) => {
    try {
      await deleteProduct(id);
      showToast("Product disabled");
      await Promise.all([refreshProducts(), refreshAlerts()]);
    } catch (e: any) {
      showToast(e?.message || "Delete failed");
    }
  };

  const doAdjustStock = async (id: number, delta: number) => {
    try {
      const r = await adjustStock(id, delta);
      if (r?.lowStockAlert) {
        showToast(`Low stock alert created (threshold ${r.lowStockAlert.threshold_qty}).`);
      } else {
        showToast("Stock updated");
      }
      await Promise.all([refreshProducts(), refreshAlerts()]);
    } catch (e: any) {
      showToast(e?.message || "Stock update failed");
    }
  };

  const ackAlert = async (id: number) => {
    try {
      await acknowledgeLowStockAlert(id);
      showToast("Alert acknowledged");
      await refreshAlerts();
    } catch (e: any) {
      showToast(e?.message || "Acknowledge failed");
    }
  };

  const openOrderDetails = async (id: number) => {
    setOrderModalLoading(true);
    try {
      const d = await getOrderAdmin(id);
      setOpenOrder(d);
    } catch (e: any) {
      showToast(e?.message || "Failed to load order");
    } finally {
      setOrderModalLoading(false);
    }
  };

  const doConfirmOrder = async (id: number) => {
    try {
      await confirmOrderAdmin(id);
      showToast("Order confirmed");
      setOpenOrder(null);
      await Promise.all([refreshOrders(), refreshProducts(), refreshAlerts()]);
    } catch (e: any) {
      showToast(e?.message || "Confirm failed");
    }
  };

  const doCancelOrder = async (id: number) => {
    try {
      await cancelOrderAdmin(id);
      showToast("Order cancelled");
      setOpenOrder(null);
      await refreshOrders();
    } catch (e: any) {
      showToast(e?.message || "Cancel failed");
    }
  };

  const doDeliverOrder = async (id: number) => {
    try {
      await deliverOrderAdmin(id);
      showToast("Marked delivered");
      setOpenOrder(null);
      await refreshOrders();
    } catch (e: any) {
      showToast(e?.message || "Deliver failed");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">You don’t have admin access.</p>
        <div className="mt-4">
          <Link to="/shop" className="px-3 py-2 rounded-xl bg-slate-900 text-white font-semibold">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999]">
          <div className="px-4 py-3 rounded-xl shadow-lg text-white font-semibold bg-emerald-600">
            {toast}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-extrabold">Admin Dashboard</div>
            <div className="text-sm text-slate-600">
              Welcome, <span className="font-bold">{user?.name}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Total stock across products: <b>{totalStock}</b>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link className="px-3 py-2 rounded-xl bg-slate-900 text-white font-semibold" to="/shop">
              Back to Shop
            </Link>
            <button className="px-3 py-2 rounded-xl bg-rose-600 text-white font-semibold" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xl font-extrabold">Low Stock Alerts</div>
              <div className="text-sm text-slate-600">Alerts trigger when stock ≤ 30% of last restock baseline.</div>
            </div>
            <button className="px-3 py-2 rounded-xl bg-slate-100 font-bold" onClick={refreshAlerts} disabled={alertsLoading}>
              {alertsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="mt-4 text-slate-600">No open alerts.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="py-3 pr-3">Product</th>
                    <th className="py-3 pr-3">Current</th>
                    <th className="py-3 pr-3">Threshold</th>
                    <th className="py-3 pr-3">Created</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-semibold">{a.product_name || `#${a.product_id}`}</td>
                      <td className="py-3 pr-3">{a.current_stock ?? "-"}</td>
                      <td className="py-3 pr-3 font-bold text-amber-700">{a.threshold_qty}</td>
                      <td className="py-3 pr-3">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="py-3">
                        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold" onClick={() => ackAlert(a.id)}>
                          Acknowledge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Product */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5">
          <div className="text-xl font-extrabold">Create Product</div>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Price (KSh)" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Image URL" value={image} onChange={(e) => setImage(e.target.value)} />
            <input className="rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Initial stock" type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
            <textarea className="rounded-xl border border-slate-200 px-3 py-2.5 md:col-span-2" placeholder="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <button className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold" onClick={createNewProduct}>
            Create Product
          </button>
        </div>

        {/* Products */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xl font-extrabold">Products</div>
              <div className="text-sm text-slate-600">CRUD + stock controls.</div>
            </div>
            <button className="px-3 py-2 rounded-xl bg-slate-100 font-bold" onClick={refreshProducts} disabled={prodLoading}>
              {prodLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {prodLoading ? (
            <div className="mt-4 text-slate-600">Loading...</div>
          ) : products.length === 0 ? (
            <div className="mt-4 text-slate-600">No products yet.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="py-3 pr-3">Name</th>
                    <th className="py-3 pr-3">Price</th>
                    <th className="py-3 pr-3">Stock</th>
                    <th className="py-3 pr-3">Adjust</th>
                    <th className="py-3 pr-3">Edit</th>
                    <th className="py-3">Disable</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-semibold">{p.name}</td>
                      <td className="py-3 pr-3 font-bold">{formatKsh(p.price_int)}</td>
                      <td className="py-3 pr-3">{p.stock}</td>
                      <td className="py-3 pr-3">
                        <div className="flex gap-2">
                          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold" onClick={() => doAdjustStock(p.id, +1)}>
                            +1
                          </button>
                          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50" disabled={p.stock <= 0} onClick={() => doAdjustStock(p.id, -1)}>
                            -1
                          </button>
                          <button className="px-3 py-2 rounded-xl bg-slate-100 font-bold" onClick={() => doAdjustStock(p.id, +10)}>
                            +10
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <button className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                      </td>
                      <td className="py-3">
                        <button className="px-3 py-2 rounded-xl bg-rose-600 text-white font-bold" onClick={() => softDelete(p.id)}>
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-xs text-slate-500 mt-3">Tip: baseline updates when stock increases (+delta or edit stock higher).</div>
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xl font-extrabold">Orders</div>
              <div className="text-sm text-slate-600">View and manage customer orders.</div>
            </div>
            <button className="px-3 py-2 rounded-xl bg-slate-100 font-bold" onClick={refreshOrders} disabled={ordersLoading}>
              {ordersLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {ordersLoading ? (
            <div className="mt-4 text-slate-600">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="mt-4 text-slate-600">No orders yet.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="py-3 pr-3">ID</th>
                    <th className="py-3 pr-3">Status</th>
                    <th className="py-3 pr-3">Channel</th>
                    <th className="py-3 pr-3">Customer</th>
                    <th className="py-3 pr-3">Location</th>
                    <th className="py-3 pr-3">Total</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-bold">#{o.id}</td>
                      <td className="py-3 pr-3">
                        <span className={badge(o.status)}>{o.status}</span>
                      </td>
                      <td className="py-3 pr-3">{o.channel}</td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold">{o.customer_name}</div>
                        <div className="text-xs text-slate-500">{o.customer_phone}</div>
                      </td>
                      <td className="py-3 pr-3">{o.delivery_location}</td>
                      <td className="py-3 pr-3 font-bold">{formatKsh(o.total_int)}</td>
                      <td className="py-3">
                        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold" onClick={() => openOrderDetails(o.id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-xs text-slate-500 mt-3">Note: WhatsApp orders typically deduct stock on Confirm.</div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xl font-extrabold">Edit Product</div>
              <button className="px-3 py-2 rounded-xl bg-slate-100 font-bold" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>

            <div className="p-5 grid md:grid-cols-2 gap-3">
              <input className="rounded-xl border border-slate-200 px-3 py-2.5" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <input className="rounded-xl border border-slate-200 px-3 py-2.5" type="number" value={editing.price_int} onChange={(e) => setEditing({ ...editing, price_int: Number(e.target.value) })} />
              <input className="rounded-xl border border-slate-200 px-3 py-2.5 md:col-span-2" placeholder="Image URL" value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} />
              <textarea className="rounded-xl border border-slate-200 px-3 py-2.5 md:col-span-2" rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <input className="rounded-xl border border-slate-200 px-3 py-2.5" type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} />
              <select className="rounded-xl border border-slate-200 px-3 py-2.5" value={String(editing.is_active)} onChange={(e) => setEditing({ ...editing, is_active: e.target.value === "true" })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
              <button className="px-4 py-2.5 rounded-xl bg-slate-100 font-extrabold" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold" onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {openOrder && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xl font-extrabold">Order #{openOrder.order.id}</div>
                <div className="text-sm text-slate-600">
                  <span className={badge(openOrder.order.status)}>{openOrder.order.status}</span>{" "}
                  <span className="ml-2">({openOrder.order.channel})</span>
                </div>
              </div>
              <button className="px-3 py-2 rounded-xl bg-slate-100 font-bold" onClick={() => setOpenOrder(null)}>
                Close
              </button>
            </div>

            {orderModalLoading ? (
              <div className="p-5 text-slate-600">Loading order…</div>
            ) : (
              <div className="p-5 grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                  <div className="font-extrabold">Customer</div>
                  <div className="mt-2 text-sm">
                    <div><span className="text-slate-600">Name:</span> <b>{openOrder.order.customer_name}</b></div>
                    <div><span className="text-slate-600">Phone:</span> <b>{openOrder.order.customer_phone}</b></div>
                    <div><span className="text-slate-600">Location:</span> <b>{openOrder.order.delivery_location}</b></div>
                  </div>
                  {openOrder.order.note ? (
                    <div className="mt-3 text-sm">
                      <div className="font-bold">Note</div>
                      <div className="text-slate-700">{openOrder.order.note}</div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                  <div className="font-extrabold">Items</div>
                  <div className="mt-2 space-y-2 text-sm">
                    {openOrder.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <div>{it.name_snapshot} x{it.qty}</div>
                        <div className="font-bold">{formatKsh(it.line_total_int)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between">
                    <div className="font-extrabold">Total</div>
                    <div className="font-extrabold text-blue-700">{formatKsh(openOrder.order.total_int)}</div>
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                  <button className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold disabled:opacity-50" disabled={openOrder.order.status === "cancelled" || openOrder.order.status === "delivered"} onClick={() => doCancelOrder(openOrder.order.id)}>
                    Cancel
                  </button>

                  <button className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold disabled:opacity-50" disabled={openOrder.order.status === "cancelled" || openOrder.order.status === "delivered"} onClick={() => doConfirmOrder(openOrder.order.id)}>
                    Confirm
                  </button>

                  <button className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-extrabold disabled:opacity-50" disabled={openOrder.order.status !== "confirmed"} onClick={() => doDeliverOrder(openOrder.order.id)}>
                    Mark Delivered
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-slate-500">© 2026 Tabby</footer>
    </div>
  );
}
