// components.jsx — shared UI building blocks
// Loaded after React + Babel + utils.js

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ----- Icons (inline svg) -----
function Icon({ name, size = 20 }) {
  const paths = {
    chevron: <path d="M6 9l6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M18 6L6 18M6 6l12 12" />,
    trash: <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />,
    download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
    mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></>),
    print: <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    check: <path d="M20 6L9 17l-5-5" />,
    arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
    clock: (<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
    calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
    info: (<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>),
    user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
    sparkle: <path d="M12 2l2.4 6.4L21 11l-6.6 2.6L12 20l-2.4-6.4L3 11l6.6-2.6L12 2z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

// ----- Header -----
function AppHeader({ name, role, fortnightEnd }) {
  return (
    <header className="app-header">
      <img className="app-header__logo" src="assets/logo.jpg" alt="Coal River Coaches" />
      <div>
        <p className="app-header__title">Coal River Coaches</p>
        <p className="app-header__subtitle">Timesheet</p>
      </div>
      {name ? (
        <div className="app-header__user">
          {name}
          <small>{role}{fortnightEnd ? ` · FN ${tsUtils.fmtShortDate(fortnightEnd)}` : ""}</small>
        </div>
      ) : null}
    </header>
  );
}

// ----- Stepper -----
function Stepper({ step, total }) {
  return (
    <div className="stepper" role="progressbar" aria-valuenow={step} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`stepper__dot ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}
        />
      ))}
    </div>
  );
}

// ----- Time input with smart parsing -----
function TimeInput({ value, onChange, placeholder, label }) {
  const [local, setLocal] = useState(value || "");
  useEffect(() => { setLocal(value || ""); }, [value]);

  function commit(v) {
    const trimmed = v.trim();
    if (!trimmed) { onChange(""); setLocal(""); return; }
    const mins = tsUtils.parseTime(trimmed);
    if (mins != null) {
      const formatted = tsUtils.formatTimeMil(mins);
      onChange(formatted);
      setLocal(formatted);
    } else {
      onChange(trimmed);
      setLocal(trimmed);
    }
  }

  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <input
        type="text"
        className="input input--mono"
        value={local}
        placeholder={placeholder || "—"}
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  );
}

// ----- Shift editor -----
function ShiftEditor({ shift, onChange, onRemove, index, canRemove }) {
  const set = (k, v) => onChange({ ...shift, [k]: v });
  const hours = tsUtils.calcShiftHours(shift);
  return (
    <div className="shift">
      <div className="shift__head">
        <span className="shift__title">Shift {index + 1}</span>
        {hours > 0 ? (
          <span className="badge badge--blue" style={{ marginLeft: 8 }}>
            {hours.toFixed(2).replace(/\.?0+$/, "")} h
          </span>
        ) : null}
        {canRemove ? (
          <button className="shift__remove" onClick={onRemove} aria-label="Remove shift">Remove</button>
        ) : null}
      </div>
      <div className="time-grid">
        <TimeInput label="AM Start" value={shift.amStart} placeholder="0600" onChange={(v) => set("amStart", v)} />
        <TimeInput label="AM Finish" value={shift.amFinish} placeholder="—" onChange={(v) => set("amFinish", v)} />
        <TimeInput label="PM Start" value={shift.pmStart} placeholder="—" onChange={(v) => set("pmStart", v)} />
        <TimeInput label="PM Finish" value={shift.pmFinish} placeholder="1730" onChange={(v) => set("pmFinish", v)} />
      </div>
      <div className="time-grid">
        <div className="field">
          <label className="field__label">Break</label>
          <input
            type="text"
            className="input"
            value={shift.breakTime || ""}
            placeholder="1hr"
            onChange={(e) => set("breakTime", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label">Description</label>
          <input
            type="text"
            className="input"
            value={shift.description || ""}
            placeholder="e.g. School Run"
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ----- Day card -----
function DayCard({ day, dayName, onChange, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const hours = tsUtils.calcWorkedHours(day);
  const dayHours = tsUtils.calcDayHours(day);
  const phName = tsUtils.publicHolidayName(day.date);
  const isPH = tsUtils.isPublicHoliday(day);

  function updateShift(i, newShift) {
    const shifts = day.shifts.map((s, j) => (j === i ? newShift : s));
    onChange({ ...day, shifts });
  }

  function addShift() {
    if (day.shifts.length >= 3) return;
    onChange({ ...day, shifts: [...day.shifts, tsUtils.newShift()] });
  }
  function removeShift(i) {
    const shifts = day.shifts.filter((_, j) => j !== i);
    onChange({ ...day, shifts: shifts.length ? shifts : [tsUtils.newShift()] });
  }

  const setLeave = (k, v) => onChange({ ...day, [k]: parseFloat(v) || 0 });
  const togglePH = () => onChange({ ...day, publicHoliday: !day.publicHoliday });

  return (
    <div className={`day-card ${open ? "open" : ""} ${isPH ? "day-card--ph" : ""}`}>
      <div className="day-card__header" onClick={() => setOpen(!open)}>
        <div>
          <div className="day-card__day-name">{dayName}</div>
          <div className="day-card__date">{tsUtils.fmtShortDate(day.date)}</div>
          <div className="day-badges">
            {isPH && <span className="badge badge--purple" title={phName || "Public Holiday"}>★ Public Holiday{phName ? ` · ${phName}` : ""}</span>}
            {day.sickLeave > 0 && <span className="badge badge--amber">Sick {day.sickLeave}h</span>}
            {day.annualLeave > 0 && <span className="badge badge--green">Annual {day.annualLeave}h</span>}
            {day.shifts.length > 1 && <span className="badge">{day.shifts.length} shifts</span>}
          </div>
        </div>
        <div className="day-card__hours">
          <div className={`day-card__hours-num ${dayHours === 0 ? "day-card__hours-num--zero" : ""}`}>
            {dayHours > 0 ? dayHours.toFixed(2).replace(/\.?0+$/, "") : "0"}
          </div>
          <div className="day-card__hours-label">hrs</div>
        </div>
        <div className="day-card__chevron"><Icon name="chevron" size={18} /></div>
      </div>
      {open ? (
        <div className="day-card__body">
          {day.shifts.map((sh, i) => (
            <ShiftEditor
              key={i}
              index={i}
              shift={sh}
              canRemove={day.shifts.length > 1}
              onChange={(v) => updateShift(i, v)}
              onRemove={() => removeShift(i)}
            />
          ))}
          {day.shifts.length < 3 ? (
            <button className="add-shift" onClick={addShift}>
              + Add another shift
            </button>
          ) : null}

          <div className="time-grid" style={{ marginTop: 14 }}>
            <div className="field">
              <label className="field__label">Sick Leave (hrs)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="input input--mono"
                value={day.sickLeave || ""}
                placeholder="0"
                onChange={(e) => setLeave("sickLeave", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">Annual Leave (hrs)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="input input--mono"
                value={day.annualLeave || ""}
                placeholder="0"
                onChange={(e) => setLeave("annualLeave", e.target.value)}
              />
            </div>
          </div>

          <label className="ph-toggle" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={!!day.publicHoliday || !!phName}
              disabled={!!phName}
              onChange={togglePH}
            />
            <span>
              <strong>Public holiday</strong>
              {phName ? (
                <small style={{ display: "block", color: "var(--ink-3)" }}>
                  Auto-detected: {phName}
                </small>
              ) : (
                <small style={{ display: "block", color: "var(--ink-4)" }}>
                  Tick if this day was a public holiday
                </small>
              )}
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

// ----- Summary card -----
function SummaryCard({ ts }) {
  const total = tsUtils.totalHours(ts);
  const worked = tsUtils.workedHours(ts);
  const leave = tsUtils.leaveHours(ts);
  const phCount = [...ts.week1, ...ts.week2].filter((d) => tsUtils.isPublicHoliday(d)).length;
  return (
    <div className="summary">
      <div className="summary__label">Fortnight total</div>
      <div className="summary__total">
        {total.toFixed(2).replace(/\.?0+$/, "") || "0"}
        <small>hrs</small>
      </div>
      <div className="summary__breakdown">
        <div className="summary__breakdown-item">
          <div className="summary__breakdown-num">{worked.toFixed(2).replace(/\.?0+$/, "") || "0"}</div>
          <div className="summary__breakdown-label">Worked</div>
        </div>
        <div className="summary__breakdown-item">
          <div className="summary__breakdown-num">{leave.toFixed(2).replace(/\.?0+$/, "") || "0"}</div>
          <div className="summary__breakdown-label">Leave</div>
        </div>
        {phCount > 0 ? (
          <div className="summary__breakdown-item">
            <div className="summary__breakdown-num">{phCount}</div>
            <div className="summary__breakdown-label">Pub. Hol.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, {
  Icon, AppHeader, Stepper, TimeInput, ShiftEditor, DayCard, SummaryCard,
});
