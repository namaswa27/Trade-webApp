import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ui } from "../ui/ui";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthed, isAdmin, logout } = useAuth();

  return (
    <div className={ui.page}>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/shop" className="font-extrabold text-lg tracking-tight">
            Tabby<span className="text-slate-400">.</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link className={`${ui.btn} ${ui.btnSoft} py-2`} to="/shop">
              Shop
            </Link>

            {isAdmin && (
              <Link className={`${ui.btn} ${ui.btnPrimary} py-2`} to="/admin">
                Admin
              </Link>
            )}

            {isAuthed ? (
              <>
                <div className="hidden sm:block text-sm text-slate-600 px-2">
                  {user?.name} • {user?.role}
                </div>
                <button className={`${ui.btn} ${ui.btnBad} py-2`} onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <Link className={`${ui.btn} ${ui.btnPrimary} py-2`} to="/login">
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className={ui.container}>{children}</main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-slate-500">
        © 2026 Tabby
      </footer>
    </div>
  );
}