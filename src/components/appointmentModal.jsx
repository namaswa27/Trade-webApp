import React, { useEffect, useState } from "react";
import { Calendar, X } from "lucide-react";
import { cx } from "./ui";

export default function AppointmentModal({ open, onClose, onSubmit, minDate }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    message: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({ name: "", phone: "", date: "", time: "", message: "" });
  }, [open]);

  if (!open) return null;

  return (
    <div className={`${cx.modalOverlay} shop-fade-in`} onMouseDown={onClose}>
      <div
        className={`${cx.modal} shop-pop-in`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <h3 className="text-lg font-extrabold">Book Appointment</h3>
          </div>
          <button onClick={onClose} className={`${cx.iconBtn}`} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <input
            className={cx.input}
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className={cx.input}
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className={cx.input}
              type="date"
              min={minDate}
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
            <input
              className={cx.input}
              type="time"
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
            />
          </div>
          <textarea
            className={cx.textarea}
            rows={3}
            placeholder="Message (optional)"
            value={form.message}
            onChange={(e) =>
              setForm((p) => ({ ...p, message: e.target.value }))
            }
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onSubmit(form)}
              className={`${cx.btn} ${cx.btnPrimary} w-full`}
            >
              Submit
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
