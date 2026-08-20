// ======================================================================
// INTERACTIVE APPLICATION PIPELINE TRACKER
// Manages the "Application Pipeline" tab with status dropdowns & Gmail auto-sync
// ======================================================================

const ApplicationTracker = {
  TAB_NAME: "Application Pipeline",
  
  HEADERS: [
    "Status",
    "Job Title",
    "Company",
    "Location",
    "Salary / Package",
    "Portal",
    "Direct Apply Link",
    "Notes"
  ],

  STATUSES: [
    "Applied 🟢",
    "Interview Scheduled 🟡",
    "Assessment Completed 🔵",
    "Job Offer 🏆",
    "Rejected 🔴"
  ],

  COLUMN_WIDTHS: [160, 280, 180, 160, 140, 110, 140, 200],
  ALIGNMENTS: ["center", "left", "left", "left", "left", "center", "center", "left"],

  /**
   * Initializes or resets the Application Pipeline tab with dropdown data validation
   */
  setupPipelineTab: function(spreadsheet) {
    let sheet = spreadsheet.getSheetByName(this.TAB_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(this.TAB_NAME);
    } else {
      sheet.clear();
      sheet.clearFormats();
    }

    sheet.appendRow(this.HEADERS);
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

    // Set Data Validation Dropdown for Column 1 (Status) across 100 rows
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(this.STATUSES, true)
      .setAllowInvalid(false)
      .build();
    
    sheet.getRange(2, 1, 100, 1).setDataValidation(rule);

    // Apply Pastel Conditional Formatting for Status (Column 1)
    SheetNotifier.applyStatusConditionalFormatting(sheet, 1);

    console.log(`📊 Initialized "${this.TAB_NAME}" tab with interactive status dropdowns!`);
    return sheet;
  },

  /**
   * AUTOMATED GMAIL SYNC: Auto-updates status in Google Sheet when Gmail receives responses
   */
  syncApplicationStatusFromGmail: function() {
    const files = DriveApp.getFilesByName("Real-Time Job Finder Dashboard");
    if (!files.hasNext()) return;

    const spreadsheet = SpreadsheetApp.open(files.next());
    const sheetNames = ["Realtime Jobs", this.TAB_NAME];
    let updatedCount = 0;

    for (let s = 0; s < sheetNames.length; s++) {
      const sheet = spreadsheet.getSheetByName(sheetNames[s]);
      if (!sheet) continue;

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const companyColIndex = headers.findIndex(h => String(h).toLowerCase().includes("company"));
      const statusColIndex = headers.findIndex(h => String(h).toLowerCase().includes("status"));

      if (companyColIndex === -1 || statusColIndex === -1) continue;

      const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

      for (let i = 0; i < data.length; i++) {
        const company = data[i][companyColIndex];
        if (!company || company === "Company Confidential") continue;

        const query = `in:inbox "${company}"`;
        const threads = GmailApp.search(query, 0, 3);

        for (let t = 0; t < threads.length; t++) {
          const labels = threads[t].getLabels();
          for (let l = 0; l < labels.length; l++) {
            const labelName = labels[l].getName();
            if (labelName === "Jobs/Interview") {
              sheet.getRange(i + 2, statusColIndex + 1).setValue("Interview Scheduled 🟡");
              updatedCount++;
              console.log(`🟡 Auto-updated status for "${company}" -> Interview Scheduled`);
              break;
            } else if (labelName === "Jobs/Applied" && !sheet.getRange(i + 2, statusColIndex + 1).getValue()) {
              sheet.getRange(i + 2, statusColIndex + 1).setValue("Applied 🟢");
              updatedCount++;
              console.log(`🟢 Auto-updated status for "${company}" -> Applied`);
              break;
            } else if (labelName === "Jobs/Rejected") {
              sheet.getRange(i + 2, statusColIndex + 1).setValue("Rejected 🔴");
              updatedCount++;
              console.log(`🔴 Auto-updated status for "${company}" -> Rejected`);
              break;
            }
          }
        }
      }
    }

    console.log(`✅ Gmail status sync complete! Updated ${updatedCount} company statuses.`);
  }
};
