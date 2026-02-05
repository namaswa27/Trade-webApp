import React from "react";
import { Edit2, Trash2 } from "lucide-react";
import { cx } from "./ui";

export default function ProductCard({
  product,
  isAdmin,
  priceLabel,
  onEdit,
  onDelete,
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition shop-card-hover">
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 to-transparent opacity-0 group-hover:opacity-100 transition" />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">{product.name}</h3>
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
              {product.description || "—"}
            </p>
            <p className="mt-3 text-base font-extrabold text-slate-900">
              {priceLabel}
            </p>
          </div>

          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onEdit}
                className={`${cx.iconBtn} text-blue-600 hover:bg-blue-50 focus:ring-blue-100`}
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={onDelete}
                className={`${cx.iconBtn} text-rose-600 hover:bg-rose-50 focus:ring-rose-100`}
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
