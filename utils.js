// utils.js — pure helpers, no React
(function () {
  // ----- Time parsing & formatting -----
  // Accept: "0600", "600", "6", "6:00", "06:00", "6.5", "6.30"
  // Returns minutes since midnight, or null
  function parseTime(input) {
    if (input == null) return null;
    let s = String(input).trim();
    if (!s) return null;

    // HH:MM
    let m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = +m[1], min = +m[2];
      if (h >= 0 && h <= 24 && min >= 0 && min < 60) return h * 60 + min;
      return null;
    }

    // HHMM (4 digits) or 3-digit HMM
    m = s.match(/^(\d{3,4})$/);
    if (m) {
      const raw = m[1];
      const h = +raw.slice(0, raw.length - 2);
      const min = +raw.slice(-2);
      if (h >= 0 && h <= 24 && min >= 0 && min < 60) return h * 60 + min;
      return null;
    }

    // Hour only "6" or "06"
    m = s.match(/^(\d{1,2})$/);
    if (m) {
      const h = +m[1];
      if (h >= 0 && h <= 24) return h * 60;
      return null;
    }

    return null;
  }

  // Format minutes -> "HHMM" military
  function formatTimeMil(mins) {
    if (mins == null || isNaN(mins)) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, "0") + String(m).padStart(2, "0");
  }

  // Format minutes -> "HH:MM"
  function formatTimeColon(mins) {
    if (mins == null || isNaN(mins)) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  // ----- Shift total calculation -----
  // Rules:
  //   If amStart + pmFinish are present and (amFinish OR pmStart missing): one continuous span
  //   Otherwise: sum any (start→finish) pairs we have
  function calcShiftHours(shift) {
    const a1 = parseTime(shift.amStart);
    const a2 = parseTime(shift.amFinish);
    const p1 = parseTime(shift.pmStart);
    const p2 = parseTime(shift.pmFinish);

    let totalMin = 0;

    if (a1 != null && a2 != null && p1 != null && p2 != null) {
      totalMin = (a2 - a1) + (p2 - p1);
    } else if (a1 != null && p2 != null) {
      // continuous shift (most common per the example)
      totalMin = p2 - a1;
    } else if (a1 != null && a2 != null) {
      totalMin = a2 - a1;
    } else if (p1 != null && p2 != null) {
      totalMin = p2 - p1;
    }

    // Note: the existing template's "Total" column shows GROSS span (e.g., 11.5h
    // for 0600→1730 with 1hr break). So we do NOT subtract break here.
    if (totalMin < 0) totalMin += 24 * 60; // overnight
    return totalMin > 0 ? totalMin / 60 : 0;
  }

  function calcDayHours(day) {
    if (!day) return 0;
    let total = 0;
    for (const s of day.shifts || []) total += calcShiftHours(s);
    total += +(day.sickLeave || 0);
    total += +(day.annualLeave || 0);
    return total;
  }

  function calcWorkedHours(day) {
    if (!day) return 0;
    let total = 0;
    for (const s of day.shifts || []) total += calcShiftHours(s);
    return total;
  }

  // ----- Date utilities -----
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function addDays(d, n) {
    const x = startOfDay(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  // Given a "fortnight ending" date (a Sunday), produce 14 dates Mon-Sun, Mon-Sun
  function fortnightDays(endDate) {
    const end = startOfDay(endDate);
    // Snap end to Sunday: if not Sunday, find the next Sunday
    const dow = end.getDay(); // 0=Sun
    let sunday = end;
    if (dow !== 0) {
      // shift forward to the next Sunday
      sunday = addDays(end, (7 - dow) % 7);
    }
    const week1Mon = addDays(sunday, -13);
    const days = [];
    for (let i = 0; i < 14; i++) days.push(addDays(week1Mon, i));
    return days;
  }

  // Find the fortnight ending Sunday for a given date (containing fortnight)
  // Coal River pay cycle reference (from sample): fortnight ending Sun 19 Apr 2026
  // Compute n fortnights difference from anchor
  function currentFortnightEnd(today = new Date()) {
    const anchor = startOfDay(new Date(2026, 3, 19)); // Sun 19 Apr 2026
    const t = startOfDay(today);
    const days = Math.floor((t - anchor) / 86400000);
    const fortnights = Math.floor(days / 14);
    // candidate end after fortnights complete cycles
    const candidate = addDays(anchor, fortnights * 14);
    // if today > candidate, return next fortnight end
    if (t > candidate) return addDays(candidate, 14);
    return candidate;
  }

  function fmtShortDate(d) {
    if (!(d instanceof Date)) return "";
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  }

  function fmtLongDate(d) {
    if (!(d instanceof Date)) return "";
    return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function fmtRangeShort(start, end) {
    return `${start.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  function fmtIsoDate(d) {
    if (!(d instanceof Date)) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseIsoDate(s) {
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  // ----- Empty data factories -----
  function newShift() {
    return {
      amStart: "",
      amFinish: "",
      pmStart: "",
      pmFinish: "",
      breakTime: "",
      description: "",
    };
  }

  function newDay(date) {
    return {
      date,
      shifts: [newShift()],
      sickLeave: 0,
      annualLeave: 0,
      dayDescription: "",
      publicHoliday: false, // manual override
    };
  }

  // -------- Tasmanian (Hobart-area) public holidays --------
  // Hard-coded list 2025–2027. Each entry { iso: "YYYY-MM-DD", name }
  // Source: TAS Department of Premier & Cabinet public holidays calendar.
  // Excludes Recreation Day (north only). Includes Royal Hobart Show.
  const TAS_PH = [
    // 2025
    ["2025-01-01", "New Year's Day"],
    ["2025-01-27", "Australia Day"],
    ["2025-03-10", "Eight Hours Day"],
    ["2025-04-18", "Good Friday"],
    ["2025-04-19", "Easter Saturday"],
    ["2025-04-21", "Easter Monday"],
    ["2025-04-25", "Anzac Day"],
    ["2025-06-09", "King's Birthday"],
    ["2025-10-23", "Royal Hobart Show"],
    ["2025-12-25", "Christmas Day"],
    ["2025-12-26", "Boxing Day"],
    // 2026
    ["2026-01-01", "New Year's Day"],
    ["2026-01-26", "Australia Day"],
    ["2026-03-09", "Eight Hours Day"],
    ["2026-04-03", "Good Friday"],
    ["2026-04-04", "Easter Saturday"],
    ["2026-04-06", "Easter Monday"],
    ["2026-04-25", "Anzac Day"],
    ["2026-06-08", "King's Birthday"],
    ["2026-10-22", "Royal Hobart Show"],
    ["2026-12-25", "Christmas Day"],
    ["2026-12-28", "Boxing Day (observed)"],
    // 2027
    ["2027-01-01", "New Year's Day"],
    ["2027-01-26", "Australia Day"],
    ["2027-03-08", "Eight Hours Day"],
    ["2027-03-26", "Good Friday"],
    ["2027-03-27", "Easter Saturday"],
    ["2027-03-29", "Easter Monday"],
    ["2027-04-26", "Anzac Day (observed)"],
    ["2027-06-14", "King's Birthday"],
    ["2027-10-21", "Royal Hobart Show"],
    ["2027-12-27", "Christmas Day (observed)"],
    ["2027-12-28", "Boxing Day (observed)"],
  ];
  const TAS_PH_MAP = Object.fromEntries(TAS_PH);

  function publicHolidayName(date) {
    if (!(date instanceof Date)) return null;
    const iso = fmtIsoDate(date);
    return TAS_PH_MAP[iso] || null;
  }

  function isPublicHoliday(day) {
    if (!day) return false;
    if (day.publicHoliday) return true;
    return !!publicHolidayName(day.date);
  }

  function newTimesheet(endDate) {
    const dates = fortnightDays(endDate);
    const days = dates.map((d) => newDay(d));
    return {
      user: { name: "", role: "Driver", accountantName: "Kim" },
      fortnight: { endDate },
      week1: days.slice(0, 7),
      week2: days.slice(7, 14),
      office: { publicHoliday: 0, overtime: 0, toil: 0 },
      reimbursements: [],
      signature: { signed: false, date: null },
    };
  }

  function totalHours(ts) {
    let total = 0;
    for (const d of ts.week1) total += calcDayHours(d);
    for (const d of ts.week2) total += calcDayHours(d);
    return total;
  }

  function workedHours(ts) {
    let total = 0;
    for (const d of ts.week1) total += calcWorkedHours(d);
    for (const d of ts.week2) total += calcWorkedHours(d);
    return total;
  }

  function leaveHours(ts) {
    let total = 0;
    for (const d of [...ts.week1, ...ts.week2]) {
      total += +(d.sickLeave || 0) + +(d.annualLeave || 0);
    }
    return total;
  }

  window.tsUtils = {
    parseTime, formatTimeMil, formatTimeColon,
    calcShiftHours, calcDayHours, calcWorkedHours,
    fortnightDays, currentFortnightEnd, addDays, startOfDay,
    fmtShortDate, fmtLongDate, fmtRangeShort, fmtIsoDate, parseIsoDate,
    DAY_NAMES,
    newShift, newDay, newTimesheet,
    totalHours, workedHours, leaveHours,
    publicHolidayName, isPublicHoliday,
  };
})();
