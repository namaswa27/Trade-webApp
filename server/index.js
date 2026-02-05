// server/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

app.get("/", (req, res) => res.send("API running"));

// ---------- AUTH HELPERS ----------
function signAccess(user) {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone, name: user.name },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
}

function signRefresh(user) {
  return jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "14d" });
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "No user" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
}

// ---------- LOW STOCK HELPERS ----------
async function maybeCreateLowStockAlert(productId, currentStock) {
  // Get last restock baseline (stock AFTER restock)
  const { rows: restocks } = await pool.query(
    `SELECT baseline_stock
     FROM product_restock_events
     WHERE product_id=$1
     ORDER BY created_at DESC
     LIMIT 1`,
    [productId]
  );

  if (!restocks.length) return null;

  const baseline = Number(restocks[0].baseline_stock || 0);
  if (!Number.isFinite(baseline) || baseline <= 0) return null;

  const threshold = Math.max(0, Math.ceil(baseline * 0.3));

  // If not low, no alert
  if (Number(currentStock) > threshold) return null;

  // If an open alert already exists, return it (don’t duplicate)
  const { rows: openAlerts } = await pool.query(
    `SELECT id, product_id, threshold_qty, created_at, acknowledged_at
     FROM product_low_stock_alerts
     WHERE product_id=$1 AND acknowledged_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [productId]
  );

  if (openAlerts.length) {
    return { ...openAlerts[0], current_stock: currentStock };
  }

  // Create alert
  const { rows: created } = await pool.query(
    `INSERT INTO product_low_stock_alerts(product_id, threshold_qty)
     VALUES ($1,$2)
     RETURNING id, product_id, threshold_qty, created_at, acknowledged_at`,
    [productId, threshold]
  );

  return { ...created[0], current_stock: currentStock };
}

// ---------- AUTH ROUTES ----------
app.post("/api/auth/signup", async (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password) return res.status(400).json({ message: "Missing fields" });

  const { rows: existing } = await pool.query("SELECT id FROM users WHERE phone=$1", [phone]);
  if (existing.length) return res.status(409).json({ message: "Phone already registered" });

  const password_hash = await bcrypt.hash(password, 10);

  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS c FROM users");
  const role = countRows[0].c === 0 ? "admin" : "customer";

  const { rows } = await pool.query(
    "INSERT INTO users(name, phone, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, phone, role",
    [name, phone, password_hash, role]
  );

  const user = rows[0];
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE || "Lax",
    path: "/api/auth",
  });

  res.json({ user, accessToken });
});

app.post("/api/auth/login", async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ message: "Missing fields" });

  const { rows } = await pool.query("SELECT * FROM users WHERE phone=$1", [phone]);
  if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

  const u = rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const user = { id: u.id, name: u.name, phone: u.phone, role: u.role };

  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE || "Lax",
    path: "/api/auth",
  });

  res.json({ user, accessToken });
});

app.post("/api/auth/refresh", async (req, res) => {
  const token = req.cookies.refresh_token;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    const { rows } = await pool.query("SELECT id, name, phone, role FROM users WHERE id=$1", [
      payload.id,
    ]);
    if (!rows.length) return res.status(401).json({ message: "User not found" });

    const user = rows[0];
    const accessToken = signAccess(user);

    res.json({ user, accessToken });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("refresh_token", { path: "/api/auth" });
  res.json({ ok: true });
});

// ---------- PRODUCTS ----------
app.get("/api/products", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, price_int, description, image, stock, is_active
     FROM products
     WHERE is_active=true
     ORDER BY id DESC`
  );
  res.json({ products: rows });
});

app.post("/api/products", requireAuth, requireAdmin, async (req, res) => {
  const { name, price, description = "", image = "", stock = 0 } = req.body || {};
  if (!name || price == null) return res.status(400).json({ message: "Missing name/price" });

  const priceInt = Math.round(Number(price));
  const stockInt = Math.max(0, Math.floor(Number(stock || 0)));

  if (!Number.isFinite(priceInt) || priceInt <= 0) {
    return res.status(400).json({ message: "Invalid price" });
  }

  const { rows } = await pool.query(
    `INSERT INTO products(name, price_int, description, image, stock, is_active)
     VALUES ($1,$2,$3,$4,$5,true)
     RETURNING id, name, price_int, description, image, stock, is_active`,
    [String(name).trim(), priceInt, String(description), String(image), stockInt]
  );

  const product = rows[0];

  // create baseline restock event if initial stock > 0
  if (product.stock > 0) {
    await pool.query(
      `INSERT INTO product_restock_events(product_id, baseline_stock) VALUES ($1,$2)`,
      [product.id, product.stock]
    );
  }

  res.json({ product });
});

app.put("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, description, image, stock, is_active } = req.body || {};

  // if stock is set directly, get prev stock for restock baseline logic
  let prevStock = null;
  let newStock = null;

  if (stock != null) {
    const prev = await pool.query("SELECT stock FROM products WHERE id=$1", [id]);
    if (!prev.rows.length) return res.status(404).json({ message: "Product not found" });
    prevStock = Number(prev.rows[0].stock || 0);

    const s = Math.max(0, Math.floor(Number(stock)));
    if (!Number.isFinite(s)) return res.status(400).json({ message: "Invalid stock" });
    newStock = s;
  }

  const fields = [];
  const values = [];
  let i = 1;

  if (name != null) {
    fields.push(`name=$${i++}`);
    values.push(String(name).trim());
  }

  if (price != null) {
    const p = Math.round(Number(price));
    if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ message: "Invalid price" });
    fields.push(`price_int=$${i++}`);
    values.push(p);
  }

  if (description != null) {
    fields.push(`description=$${i++}`);
    values.push(String(description));
  }

  if (image != null) {
    fields.push(`image=$${i++}`);
    values.push(String(image));
  }

  if (stock != null) {
    fields.push(`stock=$${i++}`);
    values.push(newStock);
  }

  if (is_active != null) {
    fields.push(`is_active=$${i++}`);
    values.push(!!is_active);
  }

  if (!fields.length) return res.status(400).json({ message: "No fields to update" });

  values.push(id);

  const { rows } = await pool.query(
    `UPDATE products
     SET ${fields.join(", ")}
     WHERE id=$${i}
     RETURNING id, name, price_int, description, image, stock, is_active`,
    values
  );

  if (!rows.length) return res.status(404).json({ message: "Product not found" });

  const updated = rows[0];

  // If stock increased via PUT => treat as restock baseline
  if (prevStock != null && newStock != null && newStock > prevStock) {
    await pool.query(
      `INSERT INTO product_restock_events(product_id, baseline_stock) VALUES ($1,$2)`,
      [id, newStock]
    );

    // optional: auto-ack any open alert after restock
    await pool.query(
      `UPDATE product_low_stock_alerts
       SET acknowledged_at=NOW()
       WHERE product_id=$1 AND acknowledged_at IS NULL`,
      [id]
    );
  }

  res.json({ product: updated });
});

app.post("/api/products/:id/stock", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { delta } = req.body || {};
  const d = Math.trunc(Number(delta));

  if (!Number.isFinite(d) || d === 0) return res.status(400).json({ message: "Invalid delta" });

  const { rows } = await pool.query(
    `UPDATE products
     SET stock = GREATEST(0, stock + $1)
     WHERE id=$2
     RETURNING id, name, price_int, description, image, stock, is_active`,
    [d, id]
  );

  if (!rows.length) return res.status(404).json({ message: "Product not found" });

  const product = rows[0];

  // RESTOCK: baseline after restock
  if (d > 0) {
    await pool.query(
      `INSERT INTO product_restock_events(product_id, baseline_stock) VALUES ($1,$2)`,
      [id, product.stock]
    );

    await pool.query(
      `UPDATE product_low_stock_alerts
       SET acknowledged_at=NOW()
       WHERE product_id=$1 AND acknowledged_at IS NULL`,
      [id]
    );

    return res.json({ product, lowStockAlert: null });
  }

  // DEDUCT: check for low stock alert
  const lowStockAlert = await maybeCreateLowStockAlert(id, product.stock);
  return res.json({ product, lowStockAlert: lowStockAlert || null });
});

app.delete("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(
    "UPDATE products SET is_active=false WHERE id=$1 RETURNING id",
    [id]
  );
  if (!rows.length) return res.status(404).json({ message: "Product not found" });
  res.json({ ok: true });
});

// ---------- LOW STOCK ALERTS (ADMIN) ----------
app.get("/api/admin/low-stock-alerts", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id,
            a.product_id,
            p.name AS product_name,
            p.stock AS current_stock,
            a.threshold_qty,
            a.created_at,
            a.acknowledged_at
     FROM product_low_stock_alerts a
     JOIN products p ON p.id = a.product_id
     WHERE a.acknowledged_at IS NULL
     ORDER BY a.created_at DESC
     LIMIT 200`
  );

  res.json({ alerts: rows });
});

app.post("/api/admin/low-stock-alerts/:id/ack", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(
    `UPDATE product_low_stock_alerts
     SET acknowledged_at = NOW()
     WHERE id=$1 AND acknowledged_at IS NULL
     RETURNING id`,
    [id]
  );

  if (!rows.length) return res.status(404).json({ message: "Alert not found" });
  res.json({ ok: true });
});

// ---------- ORDERS FEATURE ----------
app.post("/api/orders", requireAuth, async (req, res) => {
  const { channel = "in_app", delivery_location, note = "", items } = req.body || {};

  if (!delivery_location || !String(delivery_location).trim()) {
    return res.status(400).json({ message: "Delivery location is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Order items are required" });
  }
  if (channel !== "in_app" && channel !== "whatsapp") {
    return res.status(400).json({ message: "Invalid channel" });
  }

  const normalized = items.map((it) => ({
    product_id: Number(it.product_id),
    qty: Math.max(1, Math.floor(Number(it.qty))),
  }));

  if (normalized.some((x) => !Number.isFinite(x.product_id) || x.product_id <= 0)) {
    return res.status(400).json({ message: "Invalid product ids" });
  }
  if (normalized.some((x) => !Number.isFinite(x.qty) || x.qty <= 0)) {
    return res.status(400).json({ message: "Invalid quantities" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ids = normalized.map((x) => x.product_id);
    const { rows: products } = await client.query(
      `SELECT id, name, price_int, stock, is_active
       FROM products
       WHERE id = ANY($1::bigint[])
       FOR UPDATE`,
      [ids]
    );

    if (products.length !== ids.length) throw new Error("One or more products not found");

    const prodById = new Map(products.map((p) => [Number(p.id), p]));

    for (const it of normalized) {
      const p = prodById.get(it.product_id);
      if (!p || !p.is_active) throw new Error("A product is inactive/unavailable");
      if (channel === "in_app" && Number(p.stock) < it.qty) throw new Error(`Not enough stock for: ${p.name}`);
    }

    let total = 0;
    const itemRows = normalized.map((it) => {
      const p = prodById.get(it.product_id);
      const line = Number(p.price_int) * it.qty;
      total += line;
      return {
        product_id: it.product_id,
        name_snapshot: p.name,
        price_int_snapshot: Number(p.price_int),
        qty: it.qty,
        line_total_int: line,
      };
    });

    const status = channel === "whatsapp" ? "pending_whatsapp" : "pending";

    const { rows: orderIns } = await client.query(
      `INSERT INTO orders(channel, status, customer_name, customer_phone, delivery_location, note, total_int, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        channel,
        status,
        req.user.name || "Customer",
        req.user.phone || "",
        String(delivery_location).trim(),
        String(note || ""),
        total,
        req.user.id,
      ]
    );

    const order = orderIns[0];

    for (const it of itemRows) {
      await client.query(
        `INSERT INTO order_items(order_id, product_id, name_snapshot, price_int_snapshot, qty, line_total_int)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, it.product_id, it.name_snapshot, it.price_int_snapshot, it.qty, it.line_total_int]
      );
    }

    if (channel === "in_app") {
      for (const it of normalized) {
        await client.query(`UPDATE products SET stock = stock - $1 WHERE id=$2`, [it.qty, it.product_id]);
      }
    }

    await client.query("COMMIT");

    const { rows: itemsOut } = await pool.query(
      `SELECT product_id, name_snapshot, price_int_snapshot, qty, line_total_int
       FROM order_items
       WHERE order_id=$1
       ORDER BY id ASC`,
      [order.id]
    );

    res.json({ order, items: itemsOut });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: e?.message || "Order failed" });
  } finally {
    client.release();
  }
});

app.get("/api/orders/my", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM orders
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.id]
  );
  res.json({ orders: rows });
});

app.get("/api/orders", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM orders
     ORDER BY created_at DESC
     LIMIT 200`
  );
  res.json({ orders: rows });
});

app.get("/api/orders/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows: orders } = await pool.query("SELECT * FROM orders WHERE id=$1", [id]);
  if (!orders.length) return res.status(404).json({ message: "Order not found" });

  const { rows: items } = await pool.query(
    `SELECT product_id, name_snapshot, price_int_snapshot, qty, line_total_int
     FROM order_items
     WHERE order_id=$1
     ORDER BY id ASC`,
    [id]
  );

  res.json({ order: orders[0], items });
});

app.post("/api/orders/:id/confirm", requireAuth, requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orders } = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if (!orders.length) throw new Error("Order not found");

    const order = orders[0];
    if (order.status === "cancelled") throw new Error("Order is cancelled");
    if (order.status === "delivered") throw new Error("Order already delivered");

    const { rows: items } = await client.query(`SELECT product_id, qty FROM order_items WHERE order_id=$1`, [orderId]);

    if (order.channel === "whatsapp") {
      const ids = items.map((x) => Number(x.product_id));
      const { rows: products } = await client.query(
        `SELECT id, stock, is_active, name
         FROM products
         WHERE id = ANY($1::bigint[])
         FOR UPDATE`,
        [ids]
      );

      const byId = new Map(products.map((p) => [Number(p.id), p]));
      for (const it of items) {
        const p = byId.get(Number(it.product_id));
        if (!p || !p.is_active) throw new Error("Product inactive/unavailable");
        if (Number(p.stock) < Number(it.qty)) throw new Error(`Not enough stock for: ${p.name}`);
      }

      for (const it of items) {
        await client.query(`UPDATE products SET stock = stock - $1 WHERE id=$2`, [Number(it.qty), Number(it.product_id)]);
      }
    }

    const { rows: upd } = await client.query(`UPDATE orders SET status='confirmed' WHERE id=$1 RETURNING *`, [orderId]);

    await client.query("COMMIT");
    res.json({ order: upd[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: e?.message || "Confirm failed" });
  } finally {
    client.release();
  }
});

app.post("/api/orders/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(`UPDATE orders SET status='cancelled' WHERE id=$1 RETURNING *`, [id]);
  if (!rows.length) return res.status(404).json({ message: "Order not found" });
  res.json({ order: rows[0] });
});

app.post("/api/orders/:id/deliver", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query(`UPDATE orders SET status='delivered' WHERE id=$1 RETURNING *`, [id]);
  if (!rows.length) return res.status(404).json({ message: "Order not found" });
  res.json({ order: rows[0] });
});

// ---------- START SERVER ----------
const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
