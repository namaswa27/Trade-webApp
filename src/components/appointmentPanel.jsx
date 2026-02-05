import React from "react";
import { CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { cx } from "./ui";

export default function AppointmentsPanel({
  appointments,
  onUpdateStatus,
  onDelete,
}) {
  return (
    <section className={`${cx.card} ${cx.cardPad} mt-8`}>
      <div className="mb-4">
        <h2 className={cx.h2}>Appointments</h2>
        <p className={cx.muted}>Admin can confirm or cancel requests.</p>
      </div>

      {appointments.length === 0 ? (
        <div className="text-slate-600">No appointments yet.</div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="font-extrabold text-slate-900">
                  {a.name} — {a.phone}
                </div>
                <div className="text-sm text-slate-600">
                  {a.date} at {a.time}
                  {a.message ? ` • ${a.message}` : ""}
                </div>
                <div className="mt-2">{badge(a.status)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onUpdateStatus(a.id, "confirmed")}
                  className={`${cx.btn} ${cx.btnSuccess}`}
                >
                  <CheckCircle2 size={18} /> Confirm
                </button>
                <button
                  onClick={() => onUpdateStatus(a.id, "cancelled")}
                  className={`${cx.btn} ${cx.btnDanger}`}
                >
                  <XCircle size={18} /> Cancel
                </button>
                <button
                  onClick={() => onDelete(a.id)}
                  className={`${cx.btn} ${cx.btnGhost}`}
                  title="Delete"
                >
                  <Trash2 size={18} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function badge(status) {
  if (status === "confirmed")
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">
        <CheckCircle2 size={14} /> Confirmed
      </span>
    );
  if (status === "cancelled")
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-rose-50 text-rose-700 ring-rose-200">
        <XCircle size={14} /> Cancelled
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-amber-50 text-amber-700 ring-amber-200">
      <Clock size={14} /> Pending
    </span>
  );
}
