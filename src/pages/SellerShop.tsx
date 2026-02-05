import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Link } from "react-router-dom";
import { listProducts, type Product } from "../api/products.ts";
import { createOrder } from "../api/order";

function formatKsh(amount: number) {
  return `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
}

const SELLER_WHATSAPP = "254700000000"; // replace with your seller number (no +)

export default function SellerShop() {
  const { user, isAdmin, logout } = useAuth();

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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ps = await listProducts();
        setProducts(ps);
      } catch (e: any) {
        showToast(e.message || "Failed to load products");
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
        (it) =>
          `- ${it.product.name} x${it.qty} = ${formatKsh(it.product.price_int * it.qty)}`
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
      setCart({});
      setNote("");
      // refresh products (stock changed)
      const ps = await listProducts();
      setProducts(ps);
    } catch (e: any) {
      showToast(e.message || "Order failed");
    }
  };

  const sendWhatsApp = async () => {
    if (cartItems.length === 0) return showToast("Cart is empty.");
    if (!deliveryLocation.trim()) return showToast("Enter delivery location.");

    // OPTIONAL: create a pending order record in DB
    try {
      await createOrder({
        channel: "whatsapp",
        delivery_location: deliveryLocation.trim(),
        note: note.trim(),
        items: cartItems.map((it) => ({ product_id: it.product.id, qty: it.qty })),
      });
    } catch {
      // Even if DB fails, still allow WhatsApp message
    }

    const msg = encodeURIComponent(buildWhatsAppMessage());
    const url = `https://wa.me/${SELLER_WHATSAPP}?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999]">
          <div className="px-4 py-3 rounded-xl shadow-lg text-white font-semibold bg-emerald-600">
            {toast}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-extrabold text-xl">Tabby Shop</div>
            <div className="text-xs text-slate-600">
              Logged in as <span className="font-bold">{user?.name}</span> ({user?.role})
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link className="px-3 py-2 rounded-xl bg-slate-900 text-white font-semibold" to="/admin">
                Admin Dashboard
              </Link>
            )}
            <button
              className="px-3 py-2 rounded-xl bg-rose-600 text-white font-semibold"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-6">
        {/* Products */}
        <section className="lg:col-span-2 bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5">
          <h2 className="text-2xl font-extrabold">Products</h2>
          <p className="text-sm text-slate-600 mt-1">
            Choose quantities and checkout. Out-of-stock items are disabled.
          </p>

          {loading ? (
            <div className="mt-6 text-slate-600">Loading...</div>
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
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                  >
                    <img
                      src={p.image}
                      className="h-40 w-full object-cover"
                      alt={p.name}
                      loading="lazy"
                    />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold">{p.name}</div>
                          <div className="text-sm text-slate-600 line-clamp-2">
                            {p.description}
                          </div>
                        </div>
                        <div className="font-extrabold text-blue-700">
                          {formatKsh(p.price_int)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-slate-600">
                          Stock:{" "}
                          <span className={`font-bold ${out ? "text-rose-600" : ""}`}>
                            {p.stock}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-2 rounded-xl bg-slate-100 font-bold disabled:opacity-50"
                            disabled={qty <= 0}
                            onClick={() => setQty(p.id, qty - 1)}
                          >
                            -
                          </button>

                          <input
                            className="w-14 text-center rounded-xl border border-slate-200 py-2"
                            type="number"
                            min={0}
                            max={p.stock}
                            value={qty}
                            onChange={(e) => setQty(p.id, Number(e.target.value))}
                            disabled={out}
                          />

                          <button
                            className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50"
                            disabled={out || qty >= p.stock}
                            onClick={() => setQty(p.id, qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        className="mt-3 w-full px-4 py-2.5 rounded-xl font-extrabold bg-blue-600 text-white disabled:opacity-50"
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
        <aside className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5 h-fit">
          <h2 className="text-xl font-extrabold">Checkout</h2>

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Delivery location (auto included in WhatsApp order)
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">Note (optional)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
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
              <div className="mt-2 space-y-2">
                {cartItems.map((it) => (
                  <div key={it.product.id} className="flex justify-between text-sm">
                    <div className="text-slate-700">
                      {it.product.name} x{it.qty}
                    </div>
                    <div className="font-bold">
                      {formatKsh(it.product.price_int * it.qty)}
                    </div>
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
              className="w-full px-4 py-2.5 rounded-xl font-extrabold bg-emerald-600 text-white disabled:opacity-50"
              disabled={cartItems.length === 0}
              onClick={confirmInApp}
            >
              Confirm in App
            </button>

            <button
              className="w-full px-4 py-2.5 rounded-xl font-extrabold bg-slate-900 text-white disabled:opacity-50"
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
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-slate-500">
        © 2026 Tabby
      </footer>
    </div>
  );
}
