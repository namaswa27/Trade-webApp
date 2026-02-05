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
  return jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "14d" }
  );
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

app.get("/api/auth/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    res.json({ user: payload });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("refresh_token", { path: "/api/auth" });
  res.json({ ok: true });
});

// ---------- PRODUCTS (keep your existing ones) ----------
app.get("/api/products", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, price_int, description, image, stock, is_active FROM products WHERE is_active=true ORDER BY id DESC"
  );
  res.json({ products: rows });
});

// --------- ORDERS FEATURE (NEW) ---------

/**
 * Customer creates an order.
 * - channel: 'in_app' => deduct stock immediately
 * - channel: 'whatsapp' => do NOT deduct stock (admin will confirm later)
 */
app.post("/api/orders", requireAuth, async (req, res) => {
  const {
    channel = "in_app",
    delivery_location,
    note = "",
    items,
  } = req.body || {};

  if (!delivery_location || !String(delivery_location).trim()) {
    return res.status(400).json({ message: "Delivery location is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Order items are required" });
  }
  if (channel !== "in_app" && channel !== "whatsapp") {
    return res.status(400).json({ message: "Invalid channel" });
  }

  // normalize items
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

    // Lock product rows to prevent oversell (FOR UPDATE)
    const ids = normalized.map((x) => x.product_id);
    const { rows: products } = await client.query(
      `SELECT id, name, price_int, stock, is_active
       FROM products
       WHERE id = ANY($1::bigint[])
       FOR UPDATE`,
      [ids]
    );

    if (products.length !== ids.length) {
      throw new Error("One or more products not found");
    }

    const prodById = new Map(products.map((p) => [Number(p.id), p]));

    // Validate active + stock (only enforce stock for in_app)
    for (const it of normalized) {
      const p = prodById.get(it.product_id);
      if (!p || !p.is_active) throw new Error("A product is inactive/unavailable");

      if (channel === "in_app" && Number(p.stock) < it.qty) {
        throw new Error(`Not enough stock for: ${p.name}`);
      }
    }

    // Compute totals using DB price_int snapshots
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

    // Create order header
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

    // Insert order items
    for (const it of itemRows) {
      await client.query(
        `INSERT INTO order_items(order_id, product_id, name_snapshot, price_int_snapshot, qty, line_total_int)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, it.product_id, it.name_snapshot, it.price_int_snapshot, it.qty, it.line_total_int]
      );
    }

    // Deduct stock only for in_app orders
    if (channel === "in_app") {
      for (const it of normalized) {
        await client.query(
          `UPDATE products
           SET stock = stock - $1
           WHERE id=$2`,
          [it.qty, it.product_id]
        );
      }
    }

    await client.query("COMMIT");

    // Return order + items
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

/**
 * Customer: list own orders
 */
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

/**
 * Admin: list all orders
 */
app.get("/api/orders", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM orders
     ORDER BY created_at DESC
     LIMIT 200`
  );
  res.json({ orders: rows });
});

/**
 * Admin: view order items
 */
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

/**
 * Admin: confirm an order.
 * - If channel=whatsapp => deduct stock NOW
 * - If channel=in_app => stock already deducted; only status update
 */
app.post("/api/orders/:id/confirm", requireAuth, requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orders } = await client.query(
      `SELECT * FROM orders WHERE id=$1 FOR UPDATE`,
      [orderId]
    );
    if (!orders.length) throw new Error("Order not found");

    const order = orders[0];
    if (order.status === "cancelled") throw new Error("Order is cancelled");
    if (order.status === "delivered") throw new Error("Order already delivered");

    const { rows: items } = await client.query(
      `SELECT product_id, qty FROM order_items WHERE order_id=$1`,
      [orderId]
    );

    // If WhatsApp order, deduct stock at confirm time
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
        await client.query(
          `UPDATE products SET stock = stock - $1 WHERE id=$2`,
          [Number(it.qty), Number(it.product_id)]
        );
      }
    }

    const { rows: upd } = await client.query(
      `UPDATE orders
       SET status='confirmed'
       WHERE id=$1
       RETURNING *`,
      [orderId]
    );

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

  const { rows } = await pool.query(
    `UPDATE orders
     SET status='cancelled'
     WHERE id=$1
     RETURNING *`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ message: "Order not found" });
  res.json({ order: rows[0] });
});

app.post("/api/orders/:id/deliver", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const { rows } = await pool.query(
    `UPDATE orders
     SET status='delivered'
     WHERE id=$1
     RETURNING *`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ message: "Order not found" });
  res.json({ order: rows[0] });
});

// ---------- START SERVER ----------
const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
