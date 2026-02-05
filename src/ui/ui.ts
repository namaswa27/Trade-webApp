// src/ui/ui.ts
export const ui = {
  page: "min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900",
  container: "max-w-6xl mx-auto px-4 py-6 space-y-6",

  card: "bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm",
  cardPad: "p-5",

  h1: "text-2xl font-extrabold tracking-tight",
  h2: "text-xl font-extrabold tracking-tight",
  sub: "text-sm text-slate-600",

  btn: "inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-bold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
  btnPrimary: "bg-slate-900 text-white hover:bg-slate-800",
  btnGood: "bg-emerald-600 text-white hover:bg-emerald-500",
  btnWarn: "bg-amber-600 text-white hover:bg-amber-500",
  btnBad: "bg-rose-600 text-white hover:bg-rose-500",
  btnSoft: "bg-slate-100 text-slate-900 hover:bg-slate-200",

  input:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300",
  textarea:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300",
  select:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300",

  tableWrap: "mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-200",
  table: "w-full text-sm bg-white",
  th: "text-left text-slate-600 font-bold px-4 py-3 border-b border-slate-200",
  td: "px-4 py-3 border-b border-slate-100",
};
