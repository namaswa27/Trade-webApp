import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listProducts, type Product } from "../api/products";
import { createOrder } from "../api/order";
import AppShell from "../components/AppShell";
import { ui } from "../ui/ui";

function formatKsh(amount: number) {
  return `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
}

const SELLER_WHATSAPP = "254700000000"; // replace (no +)

export default function SellerShop() {
  const { user, isAdmin } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // cart: productId -> qty
  const [cart, setCart] = useState<Record<number, number>>({});
  const [deliveryLocation, setDeliveryLocation] = useState("Nairobi, Kenya");
  const [note, setNote] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 2500);
  };

  const refreshProducts = async () => {
    const ps = await listProducts();
    setProducts(ps);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refreshProducts();
      } catch (e: any) {
        showToast(e?.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([pid, qty]) => {
        const id = Number(pid);
        const p = products.find((x) => x.id === id);
        if (!p) return null;
        return { product: p, qty };
      })
      .filter(Boolean) as { product: Product; qty: number }[];
  }, [cart, products]);

  const totalInt = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + it.product.price_int * it.qty, 0);
  }, [cartItems]);

  const setQty = (productId: number, qty: number) => {
    const v = Math.max(0, Math.floor(qty));
    setCart((prev) => {
      const next = { ...prev };
      if (v <= 0) delete next[productId];
      else next[productId] = v;
      return next;
    });
  };

  const clearCart = () => {
    setCart({});
    setNote("");
  };

  const buildWhatsAppMessage = () => {
    const lines = [
      `Hello, I want to order from Tabby Shop.`,
      ``,
      `Customer: ${user?.name} (${user?.phone})`,
      `Delivery location: ${deliveryLocation}`,
      note ? `Note: ${note}` : "",
      ``,
      `Items:`,
      ...cartItems.map(
        (it) => `- ${it.product.name} x${it.qty} = ${formatKsh(it.product.price_int * it.qty)}`
      ),
      ``,
      `Total: ${formatKsh(totalInt)}`,
      ``,
      `Please confirm availability and delivery time. Thanks!`,
    ].filter(Boolean);

    return lines.join("\n");
  };

  const confirmInApp = async () => {
    if (cartItems.length === 0) return showToast("Cart is empty.");
    if (!deliveryLocation.trim()) return showToast("Enter delivery location.");

    try {
      const payload = {
        channel: "in_app" as const,
        delivery_location: deliveryLocation.trim(),
        note: note.trim(),
        items: cartItems.map((it) => ({ product_id: it.product.id, qty: it.qty })),
      };

      const d = await createOrder(payload);
      showToast(`Order placed! #${d.order.id} (${d.order.status})`);
      clearCart();
      await refreshProducts(); // stock changed
    } catch (e: any) {
      showToast(e?.message || "Order failed");
    }
  };

  const sendWhatsApp = async () => {
    if (cartItems.length === 0) return showToast("Cart is empty.");
    if (!deliveryLocation.trim()) return showToast("Enter delivery location.");

    // optional: create pending order record
    try {
      await createOrder({
        channel: "whatsapp",
        delivery_location: deliveryLocation.trim(),
        note: note.trim(),
        items: cartItems.map((it) => ({ product_id: it.product.id, qty: it.qty })),
      });
    } catch {
      // still allow WhatsApp even if DB fails
    }

    const msg = encodeURIComponent(buildWhatsAppMessage());
    const url = `https://wa.me/${SELLER_WHATSAPP}?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showToast("Opening WhatsApp…");
  };

  return (
    <AppShell
      title="Tabby Shop"
      subtitle={`Logged in as ${user?.name ?? "—"} (${user?.role ?? "—"})${isAdmin ? " • Admin access" : ""}`}
    >
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999]">
          <div className="px-4 py-3 rounded-xl shadow-lg text-white font-semibold bg-emerald-600">
            {toast}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Products */}
        <section className={`lg:col-span-2 ${ui.card} ${ui.cardPad}`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className={ui.h2}>Products</div>
              <div className={ui.sub}>Choose quantities and checkout. Out-of-stock items are disabled.</div>
            </div>
            <button
              className={`${ui.btn} ${ui.btnSoft} py-2`}
              onClick={async () => {
                try {
                  setLoading(true);
                  await refreshProducts();
                } catch (e: any) {
                  showToast(e?.message || "Refresh failed");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-600">Loading…</div>
          ) : products.length === 0 ? (
            <div className="mt-6 text-slate-600">No products yet.</div>
          ) : (
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {products.map((p) => {
                const qty = cart[p.id] || 0;
                const out = p.stock <= 0;

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-sm transition"
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        className="h-40 w-full object-cover bg-slate-100"
                        alt={p.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-40 w-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
                        No image
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-extrabold truncate">{p.name}</div>
                          <div className="text-sm text-slate-600 line-clamp-2">{p.description}</div>
                        </div>
                        <div className="font-extrabold text-blue-700 whitespace-nowrap">
                          {formatKsh(p.price_int)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-600">
                          Stock:{" "}
                          <span className={`font-bold ${out ? "text-rose-600" : ""}`}>{p.stock}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className={`${ui.btn} ${ui.btnSoft} px-3 py-2`}
                            disabled={qty <= 0}
                            onClick={() => setQty(p.id, qty - 1)}
                          >
                            -
                          </button>

                          <input
                            className="w-16 text-center rounded-xl border border-slate-200 py-2 outline-none focus:ring-4 focus:ring-slate-200"
                            type="number"
                            min={0}
                            max={p.stock}
                            value={qty}
                            onChange={(e) => setQty(p.id, Number(e.target.value))}
                            disabled={out}
                          />

                          <button
                            className={`${ui.btn} ${ui.btnPrimary} px-3 py-2`}
                            disabled={out || qty >= p.stock}
                            onClick={() => setQty(p.id, qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        className={`mt-3 w-full ${ui.btn} ${ui.btnPrimary}`}
                        disabled={out}
                        onClick={() => setQty(p.id, Math.max(1, qty || 0))}
                      >
                        {out ? "Out of stock" : qty > 0 ? "In cart ✓" : "Add to cart"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Checkout */}
        <aside className={`${ui.card} ${ui.cardPad} h-fit`}>
          <div className="flex items-center justify-between gap-3">
            <div className={ui.h2}>Checkout</div>
            <button
              className={`${ui.btn} ${ui.btnSoft} py-2`}
              onClick={clearCart}
              disabled={cartItems.length === 0 && !note}
              title="Clear cart"
            >
              Clear
            </button>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Delivery location (auto included in WhatsApp order)
            </label>
            <input
              className={`mt-1 ${ui.input}`}
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">Note (optional)</label>
            <textarea
              className={`mt-1 ${ui.textarea}`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
            <div className="font-extrabold">Cart</div>

            {cartItems.length === 0 ? (
              <div className="text-sm text-slate-600 mt-2">No items yet.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {cartItems.map((it) => (
                  <div key={it.product.id} className="flex justify-between text-sm">
                    <div className="text-slate-700">
                      {it.product.name}{" "}
                      <span className="text-slate-400">×</span>
                      <span className="font-bold ml-1">{it.qty}</span>
                    </div>
                    <div className="font-bold">{formatKsh(it.product.price_int * it.qty)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between">
              <div className="font-extrabold">Total</div>
              <div className="font-extrabold text-blue-700">{formatKsh(totalInt)}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <button
              className={`w-full ${ui.btn} ${ui.btnGood}`}
              disabled={cartItems.length === 0}
              onClick={confirmInApp}
            >
              Confirm in App
            </button>

            <button
              className={`w-full ${ui.btn} ${ui.btnPrimary}`}
              disabled={cartItems.length === 0}
              onClick={sendWhatsApp}
            >
              Send WhatsApp Order
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-600">
            Tip: “Confirm in App” deducts stock immediately. WhatsApp orders are confirmed by admin.
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
