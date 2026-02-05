import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cx } from "./ui";

export default function ProductModal({ open, onClose, onSave, initialValue }) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    image: "",
  });

  useEffect(() => {
    if (initialValue) {
      setForm({
        name: initialValue.name || "",
        price: String(initialValue.price ?? ""),
        description: initialValue.description || "",
        image: initialValue.image || "",
      });
    } else {
      setForm({ name: "", price: "", description: "", image: "" });
    }
  }, [initialValue, open]);

  if (!open) return null;

  return (
    <div className={`${cx.modalOverlay} shop-fade-in`} onMouseDown={onClose}>
      <div
        className={`${cx.modal} shop-pop-in`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">
            {initialValue ? "Edit Product" : "Add Product"}
          </h3>
          <button onClick={onClose} className={`${cx.iconBtn}`} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <input
            className={cx.input}
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className={cx.input}
            placeholder="Price (KSh)"
            inputMode="numeric"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
          />
          <textarea
            className={cx.textarea}
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
          />
          <input
            className={cx.input}
            placeholder="Image URL (optional)"
            value={form.image}
            onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onSave(form)}
              className={`${cx.btn} ${cx.btnPrimary} w-full`}
            >
              Save
            </button>
            <button
              onClick={onClose}
              className={`${cx.btn} ${cx.btnGhost} w-full`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
