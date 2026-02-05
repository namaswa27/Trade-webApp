import React from "react";
import { Shield, Store, Sparkles } from "lucide-react";
import { cx } from "./ui";

export default function HeaderBar({ shopName, isAdmin, onToggleAdmin }) {
  return (
    <header className="shop-header">
      <div className="shop-container-inner">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Store size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {shopName}
              </h1>
              <p className="text-sm text-slate-600 flex items-center gap-1">
                <Sparkles size={14} className="text-blue-600" />
                Shop & appointments in one place
              </p>
            </div>
          </div>

          <button
            onClick={onToggleAdmin}
            className={`${cx.btn} ${isAdmin ? cx.btnGhost : cx.btnPrimary}`}
            title="Toggle admin mode"
          >
            <Shield size={18} />
            {isAdmin ? "Customer View" : "Admin Mode"}
          </button>
        </div>
      </div>
    </header>
  );
}
