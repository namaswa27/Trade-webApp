import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 10, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(6px)" },
};

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen text-slate-900 relative overflow-hidden">
      {/* Animated background blobs */}
      <motion.div
        aria-hidden
        className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-300/30 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-indigo-300/30 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -20, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* App surface */}
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <h1 className="text-xl font-extrabold tracking-tight">Tabby</h1>
                <p className="text-sm text-slate-600">Shop & appointments</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="hidden sm:flex items-center gap-2 text-xs text-slate-600"
              >
                <span className="inline-flex items-center rounded-full px-2.5 py-1 ring-1 ring-slate-200 bg-white">
                  Smooth UI
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 ring-1 ring-slate-200 bg-white">
                  Fast checkout
                </span>
              </motion.div>
            </div>
          </div>
        </header>

        {/* Page content with transitions */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/70 bg-white/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-600">
            © {new Date().getFullYear()} Tabby
          </div>
        </footer>
      </div>
    </div>
  );
}
