// app.jsx — main app + screens

const STORAGE_KEY = "crc_timesheet_state_v1";
const PROFILE_KEY = "crc_timesheet_profile_v1";
const ACCOUNTS_EMAIL = "accounts@coalrivercoaches.com.au";
const ROLES = ["Driver", "Office", "Mechanic", "Operations", "Cleaner", "Other"];

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ts = JSON.parse(raw);
    // rehydrate dates
    if (ts.fortnight?.endDate) ts.fortnight.endDate = new Date(ts.fortnight.endDate);
    for (const d of [...(ts.week1 || []), ...(ts.week2 || [])]) {
      if (d.date) d.date = new Date(d.date);
    }
    if (ts.signature?.date) ts.signature.date = new Date(ts.signature.date);
    return ts;
  } catch (e) { return null; }
}
function saveState(ts) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ts)); } catch (e) {}
}

// ===== Setup Screen =====
function SetupScreen({ ts, setTs, onNext }) {
  const profile = loadProfile() || {};
  const now = new Date();

  const fortnightOptions = useMemo(() => {
    const current = tsUtils.currentFortnightEnd(now);
    return [
      { label: "Previous fortnight", end: tsUtils.addDays(current, -14) },
      { label: "Current fortnight", end: current, badge: "now" },
      { label: "Next fortnight", end: tsUtils.addDays(current, 14) },
    ];
  }, []);

  function updateUser(k, v) {
    setTs((prev) => ({ ...prev, user: { ...prev.user, [k]: v } }));
  }

  function setEndDate(d) {
    setTs((prev) => {
      const days = tsUtils.fortnightDays(d);
      // preserve existing entries by index if user just shifted date
      const oldDays = [...(prev.week1 || []), ...(prev.week2 || [])];
      const newDays = days.map((date, i) => ({
        ...(oldDays[i] || tsUtils.newDay(date)),
        date,
      }));
      return {
        ...prev,
        fortnight: { endDate: d },
        week1: newDays.slice(0, 7),
        week2: newDays.slice(7, 14),
      };
    });
  }

  const valid = ts.user.name?.trim() && ts.user.role && ts.fortnight.endDate;
  const w1Start = ts.fortnight.endDate ? tsUtils.addDays(ts.fortnight.endDate, -13) : null;

  return (
    <>
      <div className="app-main">
        <h1 className="page-title">Your details</h1>
        <p className="page-sub">Enter your name and pay period. We'll save this on your phone so you don't have to do it again.</p>

        <div className="field">
          <label className="field__label">Full name</label>
          <input
            type="text"
            className="input"
            value={ts.user.name || ""}
            placeholder="e.g. Guy Roberts"
            autoCapitalize="words"
            onChange={(e) => updateUser("name", e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label">Role</label>
          <div className="role-grid">
            {ROLES.map((r) => (
              <div
                key={r}
                className={`role-pick ${ts.user.role === r ? "selected" : ""}`}
                onClick={() => updateUser("role", r)}
              >
                {r}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">Accountant's first name</label>
          <input
            type="text"
            className="input"
            value={ts.user.accountantName || ""}
            placeholder="Kim"
            autoCapitalize="words"
            onChange={(e) => updateUser("accountantName", e.target.value)}
          />
          <div className="field__hint">Used to personalise the email greeting.</div>
        </div>

        <div className="field" style={{ marginTop: 24 }}>
          <label className="field__label">Fortnight ending (Sunday)</label>
          <div className="fortnight-options">
            {fortnightOptions.map((opt) => {
              const sel =
                ts.fortnight.endDate &&
                tsUtils.startOfDay(ts.fortnight.endDate).getTime() === tsUtils.startOfDay(opt.end).getTime();
              const start = tsUtils.addDays(opt.end, -13);
              return (
                <button
                  key={opt.label}
                  className={`fortnight-options__btn ${sel ? "selected" : ""}`}
                  onClick={() => setEndDate(opt.end)}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <small>{tsUtils.fmtRangeShort(start, opt.end)}</small>
                  </div>
                  {sel ? <Icon name="check" size={18} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label className="field__label">Or pick a custom end date</label>
          <input
            type="date"
            className="input"
            value={ts.fortnight.endDate ? tsUtils.fmtIsoDate(ts.fortnight.endDate) : ""}
            onChange={(e) => {
              const d = tsUtils.parseIsoDate(e.target.value);
              if (d) setEndDate(d);
            }}
          />
          {w1Start && (
            <div className="field__hint">
              Fortnight: {tsUtils.fmtRangeShort(w1Start, ts.fortnight.endDate)}
            </div>
          )}
        </div>
      </div>

      <div className="app-actions">
        <button className="btn btn--primary btn--block" disabled={!valid} onClick={onNext}>
          Continue <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );
}

// ===== Hours Screen (now includes reimbursements at the bottom) =====
function HoursScreen({ ts, setTs, onNext, onBack }) {
  const updateDay = (weekKey, i, newDay) => {
    setTs((prev) => ({
      ...prev,
      [weekKey]: prev[weekKey].map((d, j) => (j === i ? newDay : d)),
    }));
  };
  const [activeWeek, setActiveWeek] = useState(1);
  const week = activeWeek === 1 ? ts.week1 : ts.week2;
  const weekKey = activeWeek === 1 ? "week1" : "week2";

  const weekHours = week.reduce((acc, d) => acc + tsUtils.calcDayHours(d), 0);
  const firstEmptyIdx = week.findIndex((d) => tsUtils.calcDayHours(d) === 0);

  // Reimbursement handlers
  function updateReimb(i, key, value) {
    setTs((prev) => {
      const arr = [...(prev.reimbursements || [])];
      arr[i] = { ...(arr[i] || {}), [key]: value };
      return { ...prev, reimbursements: arr };
    });
  }
  function addReimb() {
    setTs((prev) => ({
      ...prev,
      reimbursements: [...(prev.reimbursements || []), { amount: "", description: "" }],
    }));
  }
  function removeReimb(i) {
    setTs((prev) => ({
      ...prev,
      reimbursements: (prev.reimbursements || []).filter((_, j) => j !== i),
    }));
  }

  return (
    <>
      <div className="app-main">
        <SummaryCard ts={ts} />

        <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "var(--surface-2)", padding: 4, borderRadius: 8 }}>
          <button
            onClick={() => setActiveWeek(1)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 6, border: "none",
              background: activeWeek === 1 ? "var(--surface)" : "transparent",
              boxShadow: activeWeek === 1 ? "var(--shadow-sm)" : "none",
              fontWeight: 600, fontSize: 13, color: "var(--ink)", cursor: "pointer",
            }}
          >
            Week 1 · {ts.week1.reduce((a, d) => a + tsUtils.calcDayHours(d), 0).toFixed(2).replace(/\.?0+$/, "") || "0"}h
          </button>
          <button
            onClick={() => setActiveWeek(2)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 6, border: "none",
              background: activeWeek === 2 ? "var(--surface)" : "transparent",
              boxShadow: activeWeek === 2 ? "var(--shadow-sm)" : "none",
              fontWeight: 600, fontSize: 13, color: "var(--ink)", cursor: "pointer",
            }}
          >
            Week 2 · {ts.week2.reduce((a, d) => a + tsUtils.calcDayHours(d), 0).toFixed(2).replace(/\.?0+$/, "") || "0"}h
          </button>
        </div>

        {week.map((day, i) => (
          <DayCard
            key={`${weekKey}-${i}`}
            day={day}
            dayName={tsUtils.DAY_NAMES[i]}
            onChange={(newDay) => updateDay(weekKey, i, newDay)}
            defaultOpen={i === firstEmptyIdx && weekHours === 0}
          />
        ))}

        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "28px 0 8px" }}>Reimbursements</h2>
        <div className="banner">
          <Icon name="info" size={16} />
          <span>Optional. Attach a tax invoice when you send your timesheet for any reimbursement claim.</span>
        </div>

        {(ts.reimbursements || []).map((r, i) => (
          <div key={i} className="reimb-row">
            <input
              type="text"
              className="input input--mono"
              placeholder="$0.00"
              value={r.amount || ""}
              onChange={(e) => updateReimb(i, "amount", e.target.value)}
            />
            <input
              type="text"
              className="input"
              placeholder="Description"
              value={r.description || ""}
              onChange={(e) => updateReimb(i, "description", e.target.value)}
            />
            <button className="icon-btn" onClick={() => removeReimb(i)} aria-label="Remove">
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}

        {(ts.reimbursements || []).length < 3 ? (
          <button className="add-shift" onClick={addReimb}>+ Add reimbursement</button>
        ) : (
          <div className="field__hint">Maximum 3 reimbursements per fortnight.</div>
        )}
      </div>

      <div className="app-actions">
        <button className="btn btn--secondary" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back
        </button>
        <button className="btn btn--primary" onClick={onNext}>
          Preview <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );
}

// (OfficeScreen removed — overtime/PH/TOIL are calculated by accounts.)

// ===== Preview Screen =====
function PreviewScreen({ ts, setTs, onNext, onBack }) {
  const toggleSig = (v) => setTs((prev) => ({
    ...prev,
    signature: { signed: v, date: v ? new Date() : null },
  }));

  return (
    <>
      <div className="app-main">
        <h1 className="page-title">Preview</h1>
        <p className="page-sub">This is what will be sent to accounts. Pinch or scroll to inspect.</p>

        <div className="preview-wrap">
          <div className="preview-zoom-hint">Scroll horizontally to see the full sheet</div>
          <PreviewSheet ts={ts} />
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--crc-blue)" }}
              checked={!!ts.signature?.signed}
              onChange={(e) => toggleSig(e.target.checked)}
            />
            <span>
              <strong style={{ display: "block", marginBottom: 2 }}>I confirm these hours are accurate.</strong>
              <small style={{ color: "var(--ink-3)" }}>
                Signing as {ts.user.name || "—"} on {tsUtils.fmtLongDate(new Date())}
              </small>
            </span>
          </label>
        </div>
      </div>

      <div className="app-actions">
        <button className="btn btn--secondary" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back
        </button>
        <button className="btn btn--primary" onClick={onNext} disabled={!ts.signature?.signed}>
          Send <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );
}

// ===== Send Screen =====
function SendScreen({ ts, onBack, onReset }) {
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [filename, setFilename] = useState("");
  const [sharedOk, setSharedOk] = useState(false);

  function buildFilename() {
    const end = ts.fortnight.endDate;
    const start = tsUtils.addDays(end, -13);
    const f = (d) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    const name = (ts.user.name || "Timesheet").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    return `${name}_${f(start)}_to_${f(end)}.xlsx`;
  }

  function fmtDateAU(d) {
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function emailSubject() {
    return `Latest timesheet f/n ending ${fmtDateAU(ts.fortnight.endDate)}`;
  }

  function emailBody() {
    const accountant = (ts.user.accountantName || "Kim").trim();
    const firstName = (ts.user.name || "").trim().split(/\s+/)[0] || ts.user.name || "";
    return (
      `Hi ${accountant},\n\n` +
      `I hope you are well!\n\n` +
      `Please find my latest timesheet attached.\n\n` +
      `Thank you for your help.\n\n` +
      `Warm regards,\n\n` +
      `${firstName}`
    );
  }

  // Detect Web Share API with file support
  const canShareFiles = (() => {
    try {
      if (!navigator.canShare) return false;
      // probe with a fake file
      const probe = new File([new Blob(["x"])], "probe.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      return navigator.canShare({ files: [probe] });
    } catch (e) { return false; }
  })();

  async function generateBlob() {
    return await window.exportTimesheet(ts);
  }

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await generateBlob();
      const fn = buildFilename();
      setFilename(fn);
      const file = new File([blob], fn, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      await navigator.share({
        files: [file],
        title: emailSubject(),
        text: emailBody(),
      });
      setSharedOk(true);
    } catch (e) {
      // User cancellation is fine; only show real errors.
      if (e && e.name !== "AbortError") {
        console.error(e);
        alert("Couldn't open the share menu: " + e.message);
      }
    }
    setBusy(false);
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await generateBlob();
      const fn = buildFilename();
      setFilename(fn);
      window.downloadBlob(blob, fn);
      setDownloaded(true);
    } catch (e) {
      console.error(e);
      alert("Failed to generate spreadsheet: " + e.message);
    }
    setBusy(false);
  }

  function handleEmailMailto() {
    const subject = encodeURIComponent(emailSubject());
    const body = encodeURIComponent(emailBody() + (filename ? `\n\n(Attach: ${filename})` : ""));
    window.location.href = `mailto:${ACCOUNTS_EMAIL}?subject=${subject}&body=${body}`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <div className="app-main">
        <h1 className="page-title">Send your timesheet</h1>

        {canShareFiles ? (
          <>
            <p className="page-sub">
              Tap below to send via your email app — your timesheet will be attached automatically.
            </p>

            <button
              className="btn btn--primary btn--block"
              style={{ padding: "18px 18px", fontSize: 16 }}
              onClick={handleShare}
              disabled={busy}
            >
              <Icon name="mail" size={20} />
              {busy ? "Preparing…" : sharedOk ? "Send again" : `Email to ${ACCOUNTS_EMAIL.split("@")[0]}@…`}
            </button>

            {sharedOk && (
              <div className="banner" style={{ marginTop: 12 }}>
                <Icon name="check" size={16} />
                <span>Sent to your share menu. Pick your email app, check the message, and hit send.</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 14px", color: "var(--ink-4)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }}></div>
              <span>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }}></div>
            </div>
          </>
        ) : (
          <p className="page-sub">
            Download the file first, then open your email app and attach it before sending.
          </p>
        )}

        <div className="send-action" onClick={handleDownload} style={{ opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
          <div className="send-action__icon"><Icon name="download" size={22} /></div>
          <div style={{ flex: 1 }}>
            <div className="send-action__title">{downloaded ? "Download again" : "Download the .xlsx"}</div>
            <div className="send-action__sub">{downloaded ? filename : "Save the file to your device"}</div>
          </div>
          <Icon name="arrowRight" size={18} />
        </div>

        {!canShareFiles && (
          <div onClick={handleEmailMailto} className="send-action">
            <div className="send-action__icon"><Icon name="mail" size={22} /></div>
            <div style={{ flex: 1 }}>
              <div className="send-action__title">Open email to accounts</div>
              <div className="send-action__sub">{ACCOUNTS_EMAIL} · subject & message pre-filled</div>
            </div>
            <Icon name="arrowRight" size={18} />
          </div>
        )}

        <div onClick={handlePrint} className="send-action">
          <div className="send-action__icon"><Icon name="print" size={22} /></div>
          <div style={{ flex: 1 }}>
            <div className="send-action__title">Print or save as PDF</div>
            <div className="send-action__sub">Use your device's print menu</div>
          </div>
          <Icon name="arrowRight" size={18} />
        </div>

        <div className="card" style={{ marginTop: 22, background: "var(--surface-2)" }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Preview of email</div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 6 }}><strong>To:</strong> {ACCOUNTS_EMAIL}</div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 10 }}><strong>Subject:</strong> {emailSubject()}</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", lineHeight: 1.55 }}>
            {emailBody()}
          </div>
        </div>

        <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
          <button className="btn btn--ghost btn--block" onClick={onReset}>
            Start a new timesheet
          </button>
        </div>
      </div>

      <div className="app-actions">
        <button className="btn btn--secondary btn--block" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back to preview
        </button>
      </div>
    </>
  );
}

// ===== Splash for brand-new users =====
function Splash({ onStart }) {
  return (
    <div className="splash">
      <img src="assets/logo.jpg" alt="Coal River Coaches" />
      <h1>Timesheets</h1>
      <p>Fill in your fortnight, preview the sheet, and send it to accounts — straight from your phone.</p>
      <button className="btn btn--primary" onClick={onStart}>
        Get started <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}

// ===== Main App =====
function App() {
  const [step, setStep] = useState(0); // 0 = splash, 1-5 = screens
  const [ts, setTs] = useState(() => {
    const saved = loadState();
    if (saved) return saved;
    return tsUtils.newTimesheet(tsUtils.currentFortnightEnd());
  });

  // Preload profile name once
  useEffect(() => {
    const profile = loadProfile();
    if (profile && (!ts.user.name || !ts.user.role)) {
      setTs((prev) => ({
        ...prev,
        user: {
          name: prev.user.name || profile.name || "",
          role: prev.user.role || profile.role || "Driver",
          accountantName: prev.user.accountantName || profile.accountantName || "Kim",
        },
      }));
    }
  }, []);

  // Persist state
  useEffect(() => {
    saveState(ts);
    if (ts.user.name) {
      saveProfile({ name: ts.user.name, role: ts.user.role, accountantName: ts.user.accountantName });
    }
  }, [ts]);

  // Decide whether to show splash on first load
  useEffect(() => {
    if (step !== 0) return;
    const profile = loadProfile();
    if (profile && profile.name) {
      setStep(1);
    }
  }, []);

  function resetAll() {
    if (!confirm("Start a new timesheet? Your current entries will be cleared (but your name will be remembered).")) return;
    const profile = loadProfile() || {};
    const fresh = tsUtils.newTimesheet(tsUtils.currentFortnightEnd());
    fresh.user.name = profile.name || "";
    fresh.user.role = profile.role || "Driver";
    fresh.user.accountantName = profile.accountantName || "Kim";
    setTs(fresh);
    setStep(1);
  }

  if (step === 0) {
    return <Splash onStart={() => setStep(1)} />;
  }

  return (
    <>
      <AppHeader name={ts.user.name} role={ts.user.role} fortnightEnd={ts.fortnight.endDate} />
      <Stepper step={step} total={4} />
      {step === 1 && <SetupScreen ts={ts} setTs={setTs} onNext={() => setStep(2)} />}
      {step === 2 && <HoursScreen ts={ts} setTs={setTs} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <PreviewScreen ts={ts} setTs={setTs} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <SendScreen ts={ts} onBack={() => setStep(3)} onReset={resetAll} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
