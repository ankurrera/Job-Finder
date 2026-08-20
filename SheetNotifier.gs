// ======================================================================
// GOOGLE SHEETS DASHBOARD NOTIFIER
// Writes matched jobs to Google Sheet
// ======================================================================

const SheetNotifier = {
  /**
   * 8-Column Layout for Realtime Jobs Tab
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

  COLUMN_WIDTHS: [85, 280, 180, 160, 140, 110, 140, 160],
  ALIGNMENTS: ["center", "left", "left", "left", "left", "center", "center", "center"],

  /**
   * Applies header formatting, alignments, row height & column widths
   */
  formatHeader: function(sheet) {
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
   * Applies pastel color conditional formatting for status dropdown values
   */
  applyStatusFormatting: function(sheet, colNum) {
    const range = sheet.getRange(2, colNum, 500, 1);
    
    const statusColorMap = [
      { text: "Not Applied ⚪", bg: "#f1f5f9", fg: "#475569" },
      { text: "Applied 🟢", bg: "#dcfce7", fg: "#15803d" },
      { text: "Assessment Pending 🔵", bg: "#e0f2fe", fg: "#0369a1" },
      { text: "Assessment Completed 🔵", bg: "#e0f2fe", fg: "#0369a1" },
      { text: "Interview Scheduled 🟡", bg: "#fef3c7", fg: "#b45309" },
      { text: "Offered 🏆", bg: "#f3e8ff", fg: "#6b21a8" },
      { text: "Job Offer 🏆", bg: "#f3e8ff", fg: "#6b21a8" },
      { text: "Rejected 🔴", bg: "#ffe4e6", fg: "#be123c" }
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
   * Initializes or resets Google Sheet dashboard and tabs
   */
  initializeDashboard: function() {
    const sheetName = "Realtime Jobs";
    let spreadsheet;

    const files = DriveApp.getFilesByName("Real-Time Job Finder Dashboard");
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
    } else {
      spreadsheet = SpreadsheetApp.create("Real-Time Job Finder Dashboard");
    }

    let sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      sheet.clear();
      sheet.clearFormats();
      sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
    } else {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    sheet.appendRow(this.HEADERS);
    this.formatHeader(sheet);

    // Apply validation dropdown strictly to Column 8 (Status)
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(this.STATUSES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, 8, 500, 1).setDataValidation(rule);
    this.applyStatusFormatting(sheet, 8);

    ApplicationTracker.setupTab(spreadsheet);

    const defaultSheet = spreadsheet.getSheetByName("Sheet1");
    if (defaultSheet && spreadsheet.getSheets().length > 1) {
      try {
        spreadsheet.deleteSheet(defaultSheet);
      } catch (e) {}
    }

    console.log(`📊 Initialized Google Sheet Dashboard: ${spreadsheet.getUrl()}`);
    return spreadsheet.getUrl();
  },


  /**
   * Identifies competitive exams, national hiring tests & off-campus assessment drives
   */
  isExamOrDrive: function(job) {
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
    return examKeywords.some(k => text.includes(k));
  },

  /**
   * Appends matched jobs into Google Sheet
   */
  appendJobs: function(matchedJobs) {
    const sheetName = "Realtime Jobs";
    let spreadsheet;

    const files = DriveApp.getFilesByName("Real-Time Job Finder Dashboard");
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
    } else {
      spreadsheet = SpreadsheetApp.create("Real-Time Job Finder Dashboard");
    }

    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastColumn() !== this.HEADERS.length) {
      this.initializeDashboard();
      spreadsheet = SpreadsheetApp.open(files.hasNext() ? files.next() : DriveApp.getFilesByName("Real-Time Job Finder Dashboard").next());
      sheet = spreadsheet.getSheetByName(sheetName);
    }

    for (let i = 0; i < matchedJobs.length; i++) {
      const job = matchedJobs[i];
      const isExam = this.isExamOrDrive(job);

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

      const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
      rowRange.setVerticalAlignment("middle").setFontSize(10);
      sheet.setRowHeight(lastRow, 28);

      // Clear any stray validation from columns 1-7 (e.g. Location column)
      sheet.getRange(lastRow, 1, 1, 7).clearDataValidations();

      // Ensure status dropdown is strictly on Column 8 (Status)
      const statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(this.STATUSES, true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(lastRow, 8).setDataValidation(statusRule);

      for (let c = 0; c < row.length; c++) {
        sheet.getRange(lastRow, c + 1).setHorizontalAlignment(this.ALIGNMENTS[c]);
      }

      if (isExam) {
        rowRange
          .setBackground("#fbcfe8")
          .setFontColor("#831843")
          .setFontWeight("bold");
      } else if (job.matchScore >= 85) {
        rowRange.setBackground("#dcfce7");
      } else if (job.salary && job.salary !== "Not Disclosed") {
        rowRange.setBackground("#fef9c3");
      }
    }

    console.log(`✅ Appended ${matchedJobs.length} matched jobs to Google Sheet: ${spreadsheet.getUrl()}`);
  }
};

