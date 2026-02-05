import React from "react";

export default function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] shop-fade-in">
      <div
        className={`px-4 py-3 rounded-xl shadow-lg text-white font-semibold ${
          toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
