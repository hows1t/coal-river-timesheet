// xlsx-export.js
// Generates the timesheet xlsx by editing the embedded blank template.
// Strategy: unzip the template (fflate), rewrite sharedStrings.xml + sheet1.xml,
// re-zip, return as Blob.
//
// Sheet structure (1-indexed):
//   A1: "Employee Name: <name>"        (mergedCell A1:E1)
//   L1: "FN: <fortnight end date>"     (mergedCell L1:N2)
//   A27: "NAME: <name>"
//
//   Week 1 day blocks (each spans 3 rows):
//     Mon=5, Tue=8, Wed=11, Thu=14, Fri=17, Sat=20, Sun=23
//   Week 2: Mon=30, Tue=33, Wed=36, Thu=39, Fri=42, Sat=45, Sun=48
//
//   Columns per day row:
//     B = date (we'll write as text dd/mm/yyyy in shift 1 row)
//     D = AM Start, E = AM Finish, F = PM Start, G = PM Finish
//     H = Break time (text, e.g. "1hr")
//     I = Total hours (number)
//     J = Sick Leave hours, K = Annual Leave hours
//     L = Description (merged L:N)
//
//   Footer (office-use / reimbursement):
//     Row 53: Public Holiday hours (G53),       Reimbursement #1 (G53 amount, H53 desc)
//     Row 54: Overtime hours (G54),             Reimbursement #2 (G54, H54)
//     Row 55: TOIL hours (G55),                 Reimbursement #3 (G55, H55)
//     E56:F56 = Date label, H56:N56 = signature date
//     A57: Employee Signature, H57:N57 = signed name

(function () {
  const DAY_ROWS_W1 = [5, 8, 11, 14, 17, 20, 23];
  const DAY_ROWS_W2 = [30, 33, 36, 39, 42, 45, 48];

  // Decode base64 -> Uint8Array
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function xmlEscape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // Parse shared strings to array
  function parseSharedStrings(xml) {
    const strings = [];
    const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(xml)) !== null) {
      const inner = m[1];
      let text = "";
      const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let tm;
      while ((tm = tRe.exec(inner)) !== null) text += tm[1];
      // un-escape basic entities
      text = text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      strings.push(text);
    }
    return strings;
  }

  function buildSharedStringsXml(strings) {
    const items = strings
      .map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`)
      .join("");
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">` +
      items +
      `</sst>`
    );
  }

  // Parse sheet1.xml into a map { "A1": { ref, type, style, value, raw } }
  function parseSheet(xml) {
    // Pull header (everything up to <sheetData>)
    const sdStart = xml.indexOf("<sheetData");
    const sdOpenEnd = xml.indexOf(">", sdStart) + 1;
    const sdClose = xml.indexOf("</sheetData>");
    const head = xml.slice(0, sdOpenEnd);
    const tail = xml.slice(sdClose);
    const body = xml.slice(sdOpenEnd, sdClose);

    // Parse rows with their attributes
    const rows = {}; // row# -> { attrs, cells: { ref: cellObj } }
    const rowRe = /<row\s([^>]*?)>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(body)) !== null) {
      const attrs = rm[1];
      const rowNumMatch = attrs.match(/\br="(\d+)"/);
      const rowNum = parseInt(rowNumMatch[1]);
      const rowContent = rm[2];

      const cells = {};
      const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cm;
      while ((cm = cellRe.exec(rowContent)) !== null) {
        const cAttrs = cm[1];
        const cContent = cm[2] || null;
        const refMatch = cAttrs.match(/\br="([A-Z]+\d+)"/);
        if (!refMatch) continue;
        const ref = refMatch[1];
        const sMatch = cAttrs.match(/\bs="(\d+)"/);
        const tMatch = cAttrs.match(/\bt="([^"]+)"/);
        cells[ref] = {
          ref,
          style: sMatch ? sMatch[1] : null,
          type: tMatch ? tMatch[1] : null,
          rawContent: cContent, // inner xml of <c>...</c>; null for self-closed
        };
      }
      rows[rowNum] = { attrs, cells };
    }
    return { head, tail, rows };
  }

  function buildSheetXml(parsed) {
    const rowNums = Object.keys(parsed.rows)
      .map(Number)
      .sort((a, b) => a - b);
    let body = "";
    for (const r of rowNums) {
      const row = parsed.rows[r];
      const cellRefs = Object.keys(row.cells).sort((a, b) => {
        const ca = a.match(/^([A-Z]+)/)[1];
        const cb = b.match(/^([A-Z]+)/)[1];
        return colToNum(ca) - colToNum(cb);
      });
      let cellsXml = "";
      for (const ref of cellRefs) {
        const c = row.cells[ref];
        let attrs = `r="${c.ref}"`;
        if (c.style != null) attrs += ` s="${c.style}"`;
        if (c.type != null) attrs += ` t="${c.type}"`;
        if (c.rawContent == null) {
          cellsXml += `<c ${attrs}/>`;
        } else {
          cellsXml += `<c ${attrs}>${c.rawContent}</c>`;
        }
      }
      body += `<row ${row.attrs}>${cellsXml}</row>`;
    }
    return parsed.head + body + parsed.tail;
  }

  function colToNum(col) {
    let n = 0;
    for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64);
    return n;
  }

  // Set a cell's value. type: "s" (shared string by index), "inlineStr", "n" (number), null
  function setCell(parsed, ref, value, opts = {}) {
    const rowNum = parseInt(ref.match(/\d+$/)[0]);
    let row = parsed.rows[rowNum];
    if (!row) {
      // create row with default attrs
      row = { attrs: `r="${rowNum}"`, cells: {} };
      parsed.rows[rowNum] = row;
    }
    let cell = row.cells[ref];
    if (!cell) {
      cell = { ref, style: null, type: null, rawContent: null };
      row.cells[ref] = cell;
    }
    if (value === null || value === undefined || value === "") {
      cell.type = null;
      cell.rawContent = null;
      return;
    }
    if (opts.type === "n") {
      cell.type = null;
      cell.rawContent = `<v>${value}</v>`;
    } else if (opts.type === "s") {
      cell.type = "s";
      cell.rawContent = `<v>${value}</v>`;
    } else {
      // inline string (safe, doesn't need sharedStrings update)
      cell.type = "inlineStr";
      cell.rawContent = `<is><t xml:space="preserve">${xmlEscape(value)}</t></is>`;
    }
  }

  // Format a JS Date as dd/mm/yyyy
  function fmtDate(d) {
    if (!(d instanceof Date) || isNaN(d)) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  // Format hours as decimal, hide if 0
  function fmtHours(h) {
    if (!h || h <= 0) return "";
    // 1 decimal, strip trailing .0
    const s = (Math.round(h * 100) / 100).toString();
    return s;
  }

  // -------------- Main export --------------
  async function exportTimesheet(data) {
    if (!window.fflate) throw new Error("fflate not loaded");
    const tpl = b64ToBytes(window.XLSX_TEMPLATE_B64);
    const files = window.fflate.unzipSync(tpl);

    // Strings  
    const ssXmlOrig = new TextDecoder().decode(files["xl/sharedStrings.xml"]);
    const strings = parseSharedStrings(ssXmlOrig);

    // Replace the name strings (indices 33, 34) in shared strings
    const nameU = (data.user.name || "").toUpperCase();
    strings[33] = `Employee Name:  ${data.user.name || ""}`;
    strings[34] = `NAME: ${nameU}`;
    // FN: label string (index 24) - we'll keep it as-is and write FN value to L1
    // But the L1 cell currently uses sharedString 24 ("FN:"). We'll override it inline.

    // Sheet
    const sheetXmlOrig = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
    const parsed = parseSheet(sheetXmlOrig);

    // L1 — fortnight ending date
    setCell(parsed, "L1", `FN: ${fmtDate(data.fortnight.endDate)}`);

    // Days for week 1 and week 2
    const fillDays = (dayList, rowStartList) => {
      for (let i = 0; i < 7; i++) {
        const day = dayList[i];
        const startRow = rowStartList[i];
        if (!day) continue;
        // Date on the first row
        setCell(parsed, `B${startRow}`, fmtDate(day.date));

        // Shifts: up to 3, one per row
        const shifts = (day.shifts || []).slice(0, 3);
        for (let s = 0; s < shifts.length; s++) {
          const r = startRow + s;
          const sh = shifts[s];
          if (sh.amStart) setCell(parsed, `D${r}`, sh.amStart);
          if (sh.amFinish) setCell(parsed, `E${r}`, sh.amFinish);
          if (sh.pmStart) setCell(parsed, `F${r}`, sh.pmStart);
          if (sh.pmFinish) setCell(parsed, `G${r}`, sh.pmFinish);
          if (sh.breakTime) setCell(parsed, `H${r}`, sh.breakTime);
          if (sh.total > 0) setCell(parsed, `I${r}`, fmtHours(sh.total), { type: "n" });
          if (sh.description) setCell(parsed, `L${r}`, sh.description);
        }
        // Leave hours on first row only
        if (day.sickLeave > 0) setCell(parsed, `J${startRow}`, fmtHours(day.sickLeave), { type: "n" });
        if (day.annualLeave > 0) setCell(parsed, `K${startRow}`, fmtHours(day.annualLeave), { type: "n" });
        // If no description on any shift but a day-level description was set, put on first row
        if (day.dayDescription && !shifts.some((s) => s.description)) {
          setCell(parsed, `L${startRow}`, day.dayDescription);
        }
      }
    };

    fillDays(data.week1, DAY_ROWS_W1);
    fillDays(data.week2, DAY_ROWS_W2);

    // Footer — office use cells (Public Holiday / Overtime / TOIL hours) are
    // intentionally left blank for accounts to calculate from the daily hours.

    // Reimbursements (rows 53, 54, 55: G amount, H desc)
    const reimbs = (data.reimbursements || []).slice(0, 3);
    for (let i = 0; i < reimbs.length; i++) {
      const r = 53 + i;
      const rb = reimbs[i];
      if (rb.amount) setCell(parsed, `G${r}`, rb.amount);
      if (rb.description) setCell(parsed, `H${r}`, rb.description);
    }

    // Signature date H56:N56, signed name H57:N57
    if (data.signature.date)
      setCell(parsed, "H56", fmtDate(data.signature.date));
    if (data.signature.signed && data.user.name)
      setCell(parsed, "H57", data.user.name);

    // Rewrite files
    const newSheet = buildSheetXml(parsed);
    const newSS = buildSharedStringsXml(strings);

    files["xl/worksheets/sheet1.xml"] = new TextEncoder().encode(newSheet);
    files["xl/sharedStrings.xml"] = new TextEncoder().encode(newSS);

    // Zip back
    const zipped = window.fflate.zipSync(files, { level: 6 });
    const blob = new Blob([zipped], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return blob;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  window.exportTimesheet = exportTimesheet;
  window.downloadBlob = downloadBlob;
})();
