import React from "react";
import { Phone, MapPin, Calendar, Clock } from "lucide-react";
import { cx } from "./ui";

export default function ShopInfoCard({ isAdmin, shopInfo, onChange, onBook }) {
  return (
    <section className={`${cx.card} ${cx.cardPad} mb-8`}>
      <div className="mb-5">
        <h2 className={cx.h2}>Contact & Visit</h2>
        <p className={cx.muted}>Reach us fast — or book a visit to the shop.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-4">
            {isAdmin ? (
              <>
                <Field label="Shop Name">
                  <input
                    className={`${cx.input} mt-1`}
                    value={shopInfo.name}
                    onChange={(e) => onChange("name", e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className={`${cx.input} mt-1`}
                    value={shopInfo.phone}
                    onChange={(e) => onChange("phone", e.target.value)}
                  />
                </Field>
                <Field label="Address" wide>
                  <input
                    className={`${cx.input} mt-1`}
                    value={shopInfo.address}
                    onChange={(e) => onChange("address", e.target.value)}
                  />
                </Field>
                <Field label="Business Hours" wide>
                  <input
                    className={`${cx.input} mt-1`}
                    value={shopInfo.hours}
                    onChange={(e) => onChange("hours", e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <>
                <InfoTile
                  icon={<Phone className="text-blue-600" size={22} />}
                  title="Call us"
                  value={
                    <a
                      href={`tel:${shopInfo.phone}`}
                      className="text-lg font-extrabold text-blue-600 hover:underline"
                    >
                      {shopInfo.phone}
                    </a>
                  }
                />
                <InfoTile
                  icon={<MapPin className="text-blue-600" size={22} />}
                  title="Location"
                  value={<p className="text-lg font-extrabold">{shopInfo.address}</p>}
                />
                <InfoTile
                  wide
                  icon={<Clock className="text-blue-600" size={22} />}
                  title="Business Hours"
                  value={<p className="text-lg font-extrabold">{shopInfo.hours}</p>}
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-6 shadow-md shop-float">
          <div className="flex items-start gap-3 mb-3">
            <Calendar className="mt-1" size={24} />
            <div>
              <h3 className="text-xl font-extrabold">Schedule a Visit</h3>
              <p className="text-white/85 text-sm mt-1">
                Book a slot and we’ll confirm by phone.
              </p>
            </div>
          </div>

          <button
            onClick={onBook}
            className={`${cx.btn} w-full bg-white text-slate-900 hover:bg-white/90 focus:ring-white/30`}
          >
            <Calendar size={18} />
            Book Appointment
          </button>

          <div className="mt-5 text-xs text-white/75">
            Tip: Choose a date & time during business hours.
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function InfoTile({ icon, title, value, wide }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm transition ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-blue-50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-600">{title}</p>
          {value}
        </div>
      </div>
    </div>
  );
}
