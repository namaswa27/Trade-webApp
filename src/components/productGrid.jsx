import React from "react";
import { Plus } from "lucide-react";
import ProductCard from "./ProductCard";
import { cx } from "./ui";

export default function ProductGrid({
  isAdmin,
  products,
  formatKsh,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <section className={`${cx.card} ${cx.cardPad}`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2 className={cx.h2}>Products</h2>
          <p className={cx.muted}>
            Browse items — admin can add, edit, and remove products.
          </p>
        </div>

        {isAdmin && (
          <button onClick={onAdd} className={`${cx.btn} ${cx.btnSuccess}`}>
            <Plus size={18} />
            Add Product
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            isAdmin={isAdmin}
            priceLabel={formatKsh(p.price)}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
          />
        ))}
      </div>
    </section>
  );
}
