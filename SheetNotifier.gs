// ======================================================================
// GOOGLE SHEETS DASHBOARD NOTIFIER
// Writes matched jobs to Google Sheet
// ======================================================================

const SheetNotifier = {
  /**
   * Essential 8-Column Layout for Realtime Jobs Tab
   */
  HEADERS: [
    "Match %",
    "Job Title",
    "Company",
    "Location",
    "Salary / Package",
    "Portal",
    "Direct Apply Link",
    "Status"
  ],

  STATUSES: [
    "Not Applied ⚪",
    "Applied 🟢",
    "Assessment Pending 🔵",
    "Interview Scheduled 🟡",
    "Offered 🏆",
    "Rejected 🔴"
  ],

  // Column Widths and Alignments matching HEADERS order
  COLUMN_WIDTHS: [85, 280, 180, 160, 140, 110, 140, 160],
  ALIGNMENTS: ["center", "left", "left", "left", "left", "center", "center", "center"],

  /**
   * Applies header formatting, per-column alignments, row height & column widths
   */
  formatHeaderRow: function(sheet) {
    const headerRange = sheet.getRange(1, 1, 1, this.HEADERS.length);
    headerRange
      .setFontWeight("bold")
      .setBackground("#0f172a")
      .setFontColor("#ffffff")
      .setVerticalAlignment("middle")
      .setFontSize(10);

    sheet.setRowHeight(1, 36);
    sheet.setFrozenRows(1);

    for (let c = 0; c < this.HEADERS.length; c++) {
      const colNum = c + 1;
      sheet.setColumnWidth(colNum, this.COLUMN_WIDTHS[c]);
      sheet.getRange(1, colNum).setHorizontalAlignment(this.ALIGNMENTS[c]);
    }
  },

  /**
   * Applies distinct pastel color conditional formatting for status dropdown values
   */
  applyStatusConditionalFormatting: function(sheet, colNum) {
    const range = sheet.getRange(2, colNum, 500, 1);
    
    const statusColorMap = [
      { text: "Not Applied ⚪", bg: "#f1f5f9", fg: "#475569" },           // Soft Pastel Slate
      { text: "Applied 🟢", bg: "#dcfce7", fg: "#15803d" },               // Soft Pastel Emerald Green
      { text: "Assessment Pending 🔵", bg: "#e0f2fe", fg: "#0369a1" },    // Soft Pastel Sky Blue
      { text: "Assessment Completed 🔵", bg: "#e0f2fe", fg: "#0369a1" },  // Soft Pastel Sky Blue
      { text: "Interview Scheduled 🟡", bg: "#fef3c7", fg: "#b45309" },  // Soft Pastel Amber Yellow
      { text: "Offered 🏆", bg: "#f3e8ff", fg: "#6b21a8" },               // Soft Pastel Lavender
      { text: "Job Offer 🏆", bg: "#f3e8ff", fg: "#6b21a8" },             // Soft Pastel Lavender
      { text: "Rejected 🔴", bg: "#ffe4e6", fg: "#be123c" }                // Soft Pastel Rose Red
    ];

    const rules = statusColorMap.map(item => 
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(item.text)
        .setBackground(item.bg)
        .setFontColor(item.fg)
        .setRanges([range])
        .build()
    );

    sheet.setConditionalFormatRules(rules);
  },

  /**
   * RE-CREATES DASHBOARD SHEET & APPLICATION PIPELINE TABS
   */
  recreateSheetDashboard: function() {
    const sheetName = "Realtime Jobs";
    let spreadsheet;

    const files = DriveApp.getFilesByName("Real-Time Job Finder Dashboard");
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
    } else {
      spreadsheet = SpreadsheetApp.create("Real-Time Job Finder Dashboard");
    }

    // 1. Setup Realtime Jobs Tab
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      sheet.clear();
      sheet.clearFormats();
      console.log(`🧹 Cleared old "${sheetName}" data & formatting to reset 8-column layout.`);
    } else {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    sheet.appendRow(this.HEADERS);
    this.formatHeaderRow(sheet);

    // Set Data Validation Dropdown for Column 8 (Status) across 500 rows
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(this.STATUSES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, 8, 500, 1).setDataValidation(rule);

    // Apply Pastel Conditional Formatting for Status (Column 8)
    this.applyStatusConditionalFormatting(sheet, 8);

    // 2. Setup Application Pipeline Tab (Interactive Tracker)
    ApplicationTracker.setupPipelineTab(spreadsheet);

    // Remove default Sheet1 if present
    const defaultSheet = spreadsheet.getSheetByName("Sheet1");
    if (defaultSheet && spreadsheet.getSheets().length > 1) {
      try {
        spreadsheet.deleteSheet(defaultSheet);
      } catch (e) {}
    }

    console.log(`🎉 Re-created fresh Google Sheet Dashboard with "Realtime Jobs" & "Application Pipeline" tabs: ${spreadsheet.getUrl()}`);
    return spreadsheet.getUrl();
  },

  /**
   * Helper: Identifies competitive exams, national hiring tests & off-campus assessment drives
   */
  isCompetitiveExam: function(job) {
    if (!job) return false;
    const text = (job.title + " " + (job.summary || "") + " " + (job.searchRole || "") + " " + (job.company || "")).toLowerCase();
    const examKeywords = [
      "nqt", "national qualifier test", "tcs nqt", 
      "infytq", "hackwithinfy", "nlth", "national talent hunt", 
      "genc", "genc elevate", "elitmus", "amcat", "cocubes", 
      "hiring test", "hiring challenge", "assessment drive", 
      "national hiring drive", "off campus drive", "off-campus drive", 
      "competitive exam", "hackathon", "national test"
    ];
    for (let i = 0; i < examKeywords.length; i++) {
      if (text.includes(examKeywords[i])) {
        return true;
      }
    }
    return false;
  },

  /**
   * Logs fresh matched jobs into a color-coded Google Sheet
   */
  logJobsToSheet: function(matchedJobs) {
    const sheetName = "Realtime Jobs";
    let spreadsheet;

    const files = DriveApp.getFilesByName("Real-Time Job Finder Dashboard");
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
    } else {
      spreadsheet = SpreadsheetApp.create("Real-Time Job Finder Dashboard");
    }

    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // Auto re-create if sheet is missing or has old mismatched headers
    if (!sheet || sheet.getLastColumn() !== this.HEADERS.length) {
      this.recreateSheetDashboard();
      spreadsheet = SpreadsheetApp.open(files.hasNext() ? files.next() : DriveApp.getFilesByName("Real-Time Job Finder Dashboard").next());
      sheet = spreadsheet.getSheetByName(sheetName);
    }

    for (let i = 0; i < matchedJobs.length; i++) {
      const job = matchedJobs[i];
      const isExam = this.isCompetitiveExam(job);

      const locationDisplay = job.workMode && !job.location.includes(job.workMode)
        ? `${job.location} (${job.workMode})`
        : (job.location || "India");

      const row = [
        `${job.matchScore}%`,
        isExam ? `📝 [EXAM/DRIVE] ${job.title}` : job.title,
        job.company,
        locationDisplay,
        job.salary || "Not Disclosed",
        job.portal,
        job.url,
        "Not Applied ⚪"
      ];

      sheet.appendRow(row);
      const lastRow = sheet.getLastRow();

      // Apply consistent cell alignment, height and font size
      const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
      rowRange.setVerticalAlignment("middle").setFontSize(10);
      sheet.setRowHeight(lastRow, 28);

      for (let c = 0; c < row.length; c++) {
        sheet.getRange(lastRow, c + 1).setHorizontalAlignment(this.ALIGNMENTS[c]);
      }

      // HIGHLIGHTING
      if (isExam) {
        rowRange
          .setBackground("#fbcfe8")  // Soft Pastel Pink
          .setFontColor("#831843")    // Dark Magenta / Bold Pink Text
          .setFontWeight("bold");
      } else if (job.matchScore >= 85) {
        rowRange.setBackground("#dcfce7"); // Light Green for 85%+ Match
      } else if (job.salary && job.salary !== "Not Disclosed") {
        rowRange.setBackground("#fef9c3"); // Light Yellow for Disclosed Salary
      }
    }

    console.log(`✅ Appended ${matchedJobs.length} matched jobs to Google Sheet Dashboard: ${spreadsheet.getUrl()}`);
  }
};
