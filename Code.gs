// ======================================================================
// REAL-TIME JOB FINDER & AI MATCHER (PAST 24 HOURS - FRESHERS FOCUS)
// ======================================================================

const CONFIG = {
  CANDIDATE_PROFILE: {
    NAME: "Ankur",
    DEGREE: "B.Tech in Computer Science & Engineering (CSE)",
    CGPA: 7.38,
    PASSOUT_YEAR: "2026",
    TARGET_STATUS: "Fresher / 2026 Batch Passout (0 - 1 Year Max)"
  },

  TARGET_EXPERIENCE: "Fresher / 2026 Batch Passout (0 - 1 Year Max)",
  
  TARGET_ROLES: [
    "Software Development Engineer",
    "Software Engineer",
    "SDE",
    "Associate Software Engineer",
    "System Engineer",
    "Technology Analyst",
    "Junior Software Engineer",
    "Graduate Trainee Engineer",
    "Software Developer",
    "Full Stack Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "Python Developer",
    "AI Engineer",
    "Generative AI Engineer",
    "LLM Engineer",
    "AI Product Engineer",
    "Prompt Engineer",
    "TCS NQT / TCS Off Campus",
    "Accenture Associate Software Engineer",
    "Capgemini Excellence Drive",
    "EY Technology Analyst"
  ],

  LOCATIONS: [
    "Kolkata", "Bangalore", "Hyderabad", "Chennai", "Gurgaon", "Delhi", "Pune", "Mumbai", "Noida"
  ],
  LOCATION: "India",
  
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",
  MIN_MATCH_SCORE: 70,
  
  MAX_JOBS_PER_PASS: 60,
  TIME_FILTER_SECONDS: 86400
};

/**
 * ======================================================================
 * USER-FACING EXECUTABLE FUNCTIONS (Visible in Apps Script Dropdown)
 * ======================================================================
 */

/**
 * 1. Executes real-time job search pass across all portals and logs to Google Sheets.
 */
function runJobSearch() {
  console.log(`🚀 Starting Job Search Pass - Target: ${CONFIG.TARGET_EXPERIENCE}...`);
  
  const startTime = new Date().getTime();
  const seenJobIds = JobMemory.getSeenIds();

  let linkedinJobs = [];
  let naukriJobs = [];
  let fetchedExams = [];

  try {
    linkedinJobs = LinkedInSearch.fetchJobs(CONFIG.TARGET_ROLES, CONFIG.LOCATIONS, seenJobIds);
    console.log(`🔎 Found ${linkedinJobs.length} jobs from LinkedIn.`);
  } catch (e) {
    console.error("LinkedIn Search Error: " + e.toString());
  }

  try {
    naukriJobs = NaukriSearch.fetchJobs(CONFIG.TARGET_ROLES, CONFIG.LOCATIONS, seenJobIds);
    console.log(`🔎 Found ${naukriJobs.length} jobs from Multi-Portal search.`);
  } catch (e) {
    console.error("Multi-Portal Search Error: " + e.toString());
  }

  try {
    fetchedExams = ExamDriveSearch.fetchDrives(CONFIG.TARGET_ROLES, seenJobIds);
    console.log(`📝 Found ${fetchedExams.length} active exam & assessment drives.`);
  } catch (e) {
    console.error("Exam Drive Search Error: " + e.toString());
  }

  const freshJobs = JobUtils.interleaveSources([fetchedExams, naukriJobs, linkedinJobs]);

  if (freshJobs.length === 0) {
    console.log("✅ No new job postings found in this pass.");
    return;
  }

  console.log(`\n🤖 Evaluating ${freshJobs.length} fresh jobs for Fresher compatibility via Gemini 2.0 Flash AI...`);
  
  const matchedJobs = [];

  for (let i = 0; i < Math.min(freshJobs.length, CONFIG.MAX_JOBS_PER_PASS); i++) {
    const job = freshJobs[i];

    if (!NaukriSearch.isRecent(job.postedAgo)) {
      JobMemory.markSeen(job.id);
      continue;
    }

    if (!ATSResolver.isValidUrl(job.url) || ATSResolver.isBlockedDomain(job.url)) {
      JobMemory.markSeen(job.id);
      continue;
    }
    
    const evaluation = GeminiMatcher.evaluate(job, CONFIG.TARGET_ROLES, CONFIG.GEMINI_API_KEY, CONFIG.CANDIDATE_PROFILE);
    
    job.matchScore = evaluation.score;
    job.summary = evaluation.summary;
    job.salary = evaluation.salary;
    job.experience = evaluation.experience;
    job.workMode = evaluation.workMode;
    job.matchingSkills = evaluation.matchingSkills;
    job.missingSkills = evaluation.missingSkills;

    const expCheck = String(job.experience || "").toLowerCase();
    if (expCheck.match(/([2-9]|1[0-9])\s*(?:\+|\-|to)\s*([0-9]+)?\s*(?:year|yoe|yrs)/i) || 
        expCheck.includes("2+") || expCheck.includes("3+") || expCheck.includes("4+") || expCheck.includes("5+") ||
        expCheck.includes("3 to 8") || expCheck.includes("3-8") || expCheck.includes("2-3") || expCheck.includes("3-5")) {
      if (!expCheck.includes("0-1") && !expCheck.includes("0 to 1") && !expCheck.includes("0-2") && !expCheck.includes("fresher")) {
        job.matchScore = 0;
      }
    }

    if (job.matchScore >= CONFIG.MIN_MATCH_SCORE) {
      job.url = ATSResolver.resolveDirectUrl(job.url);
      matchedJobs.push(job);
    }

    JobMemory.markSeen(job.id);
  }

  if (matchedJobs.length > 0) {
    SheetNotifier.appendJobs(matchedJobs);
  }

  const elapsedSec = Math.round((new Date().getTime() - startTime) / 1000);
  console.log(`\n🎉 Job search pass completed in ${elapsedSec}s. Logged ${matchedJobs.length} matched jobs.`);
}

/**
 * 2. Initializes or resets Google Sheet dashboard layout & interactive pipeline.
 */
function initializeDashboard() {
  return SheetNotifier.initializeDashboard();
}

/**
 * 3. Syncs application pipeline statuses from Gmail labels.
 */
function syncApplicationStatus() {
  return ApplicationTracker.syncStatusFromGmail();
}

/**
 * 4. Configures hourly time-driven trigger for automated job searching.
 */
function setupHourlyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const handler = triggers[i].getHandlerFunction();
    if (handler === "runJobSearch" || handler === "findRealtimeJobs") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("runJobSearch")
    .timeBased()
    .everyHours(1)
    .create();

  console.log("⏰ Successfully scheduled hourly trigger for runJobSearch.");
}

/**
 * ======================================================================
 * INTERNAL HELPERS (Hidden from Apps Script Dropdown)
 * ======================================================================
 */
const JobMemory = {
  getSeenIds: function() {
    const props = PropertiesService.getUserProperties().getProperty("SEEN_JOB_IDS");
    return props ? JSON.parse(props) : [];
  },

  markSeen: function(jobId) {
    const seen = this.getSeenIds();
    seen.push(jobId);
    if (seen.length > 1000) seen.shift();
    PropertiesService.getUserProperties().setProperty("SEEN_JOB_IDS", JSON.stringify(seen));
  },

  clear: function() {
    PropertiesService.getUserProperties().deleteProperty("SEEN_JOB_IDS");
    console.log("🔄 Cleared seen job cache.");
  }
};

const JobUtils = {
  interleaveSources: function(sourceLists) {
    const portalMap = {};
    const allJobs = [];
    
    for (let s = 0; s < sourceLists.length; s++) {
      if (sourceLists[s]) {
        allJobs.push(...sourceLists[s]);
      }
    }

    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      const p = job.portal || "Other";
      if (!portalMap[p]) portalMap[p] = [];
      portalMap[p].push(job);
    }

    const portals = Object.keys(portalMap);
    const result = [];
    let maxLen = 0;
    
    for (let p = 0; p < portals.length; p++) {
      if (portalMap[portals[p]].length > maxLen) {
        maxLen = portalMap[portals[p]].length;
      }
    }

    for (let i = 0; i < maxLen; i++) {
      for (let p = 0; p < portals.length; p++) {
        if (i < portalMap[portals[p]].length) {
          result.push(portalMap[portals[p]][i]);
        }
      }
    }

    return result;
  }
};


