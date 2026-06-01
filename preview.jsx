// preview.jsx — visual recreation of the spreadsheet
const { useMemo: useMemo2 } = React;

function PreviewSheet({ ts }) {
  const dayNames = tsUtils.DAY_NAMES;

  function fmtN(n) {
    if (!n || n <= 0) return "";
    return n.toFixed(2).replace(/\.?0+$/, "");
  }
  function fmtDate(d) {
    if (!(d instanceof Date)) return "";
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  }
  function fullDate(d) {
    if (!(d instanceof Date)) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  const renderWeek = (days, label) => (
    <React.Fragment>
      <p className="sheet__week-label">{label}</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Day</th>
            <th style={{ width: 60 }}>Date</th>
            <th colSpan={2}>AM</th>
            <th colSpan={2}>PM</th>
            <th style={{ width: 50 }}>Break</th>
            <th style={{ width: 45 }}>Total</th>
            <th style={{ width: 40 }}>Sick</th>
            <th style={{ width: 40 }}>Annual</th>
            <th>Description</th>
          </tr>
          <tr>
            <th></th><th></th>
            <th>Start</th><th>Finish</th>
            <th>Start</th><th>Finish</th>
            <th></th><th></th><th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, di) => {
            const shifts = day.shifts && day.shifts.length ? day.shifts : [tsUtils.newShift()];
            // ensure 3 rows for visual parity
            const rows = [];
            for (let r = 0; r < 3; r++) rows.push(shifts[r] || null);
            const phName = tsUtils.publicHolidayName(day.date) || (day.publicHoliday ? "Public Holiday" : null);
            return rows.map((sh, ri) => (
              <tr key={`${di}-${ri}`}>
                {ri === 0 ? <td className={"day" + (phName ? " day--ph" : "")} rowSpan={3}>{dayNames[di]}{phName ? <div style={{ fontSize: 8.5, color: "#6B3FA0", fontWeight: 600, marginTop: 2, lineHeight: 1.1 }}>★ PH</div> : null}</td> : null}
                {ri === 0 ? <td className="num" rowSpan={3}>{fullDate(day.date)}</td> : null}
                <td className="num">{sh?.amStart || ""}</td>
                <td className="num">{sh?.amFinish || ""}</td>
                <td className="num">{sh?.pmStart || ""}</td>
                <td className="num">{sh?.pmFinish || ""}</td>
                <td>{sh?.breakTime || ""}</td>
                <td className="num">{sh && tsUtils.calcShiftHours(sh) > 0 ? fmtN(tsUtils.calcShiftHours(sh)) : ""}</td>
                {ri === 0 ? <td className="num" rowSpan={3}>{fmtN(day.sickLeave)}</td> : null}
                {ri === 0 ? <td className="num" rowSpan={3}>{fmtN(day.annualLeave)}</td> : null}
                <td className="desc">{sh?.description || (ri === 0 && day.dayDescription) || ""}</td>
              </tr>
            ));
          })}
          <tr>
            <td colSpan={11} style={{ background: "#F2F2F2", textAlign: "left", fontStyle: "italic", color: "#666" }}>
              Office Use Totals
            </td>
          </tr>
        </tbody>
      </table>
    </React.Fragment>
  );

  return (
    <div className="sheet" id="preview-sheet">
      <div className="sheet__top">
        <div>
          <div className="sheet__name">Employee Name: {ts.user.name || "_______________"}</div>
        </div>
        <img className="sheet__logo" src="assets/logo.jpg" alt="Coal River Coaches" />
        <div className="sheet__fn">
          FN: {ts.fortnight.endDate ? ts.fortnight.endDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "_______"}
          <small>Fortnight ending</small>
        </div>
      </div>

      {renderWeek(ts.week1, "WEEK 1")}
      <div style={{ marginTop: 12 }}>
        <div className="sheet__name" style={{ marginBottom: 4 }}>NAME: {(ts.user.name || "").toUpperCase()}</div>
        {renderWeek(ts.week2, "WEEK 2")}
      </div>

      <div className="sheet__footer">
        <div className="sheet__footer-block">
          <h4>Office Use Only</h4>
          <div className="sheet__footer-row"><span>Public Holiday</span><span>{fmtN(ts.office.publicHoliday)}</span></div>
          <div className="sheet__footer-row"><span>Overtime</span><span>{fmtN(ts.office.overtime)}</span></div>
          <div className="sheet__footer-row"><span>TOIL</span><span>{fmtN(ts.office.toil)}</span></div>
        </div>
        <div className="sheet__footer-block">
          <h4>Reimbursement <span style={{ fontWeight: 400, fontSize: 9 }}>(Tax invoice must be attached)</span></h4>
          {(ts.reimbursements && ts.reimbursements.length ? ts.reimbursements : [{}, {}, {}]).slice(0, 3).map((r, i) => (
            <div key={i} className="sheet__footer-row">
              <span>{r.description || "—"}</span>
              <span>{r.amount || ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sheet__sig">
        <div>Employee Signature: {ts.signature?.signed && ts.user.name ? <strong style={{ fontFamily: "cursive", marginLeft: 6 }}>{ts.user.name}</strong> : <span style={{ color: "#888" }}>____________</span>}</div>
        <div>Date: {ts.signature?.date ? new Date(ts.signature.date).toLocaleDateString("en-AU") : "________"}</div>
      </div>
    </div>
  );
}

window.PreviewSheet = PreviewSheet;
