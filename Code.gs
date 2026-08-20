// ======================================================================
// REAL-TIME JOB FINDER & AI MATCHER (PAST 24 HOURS ONLY - FRESHERS FOCUS)
// Target: ankurr.era@gmail.com
// ======================================================================

const CONFIG = {
  // Candidate Resume Profile (2026 Batch B.Tech CSE, 7.38 CGPA / 73.8%)
  CANDIDATE_PROFILE: {
    NAME: "Ankur",
    DEGREE: "B.Tech in Computer Science & Engineering (CSE)",
    CGPA: 7.38, // 7.38 CGPA out of 10 (73.8%) - Eligible for TCS (60%), Accenture (65%), Capgemini (60%), EY (60%), Infosys (60%)
    PASSOUT_YEAR: "2026", // 2026 Batch Passout (also eligible for 2025 / Freshers)
    TARGET_STATUS: "Fresher / 2026 Batch Passout / Recent Graduate (0 - 1 Year Max)"
  },

  // Target Experience Criteria
  TARGET_EXPERIENCE: "Fresher / 2026 Batch Passout (0 - 1 Year Max / 1st Off-Campus Job Target)",
  
  // Target Search Roles (Core SDE, MNC Entry-Level Engineering & AI Roles)
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
  // India Tech Hub Location Matrix (India-only, no global remote)
  LOCATIONS: [
    "Kolkata",
    "Bangalore",
    "Hyderabad",
    "Chennai",
    "Gurgaon",
    "Delhi",
    "Pune",
    "Mumbai",
    "Noida"
  ],
  LOCATION: "India", // Default location fallback string
  
  // Gemini AI Key for Match Scoring
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",
  MIN_MATCH_SCORE: 70, // Min score (0-100) to log to Sheet
  
  // Daily Quotas & Safeguards
  MAX_JOBS_PER_PASS: 60, // Evaluates up to 60 jobs per hourly pass
  TIME_FILTER_SECONDS: 86400 // 24 Hours (86,400 seconds)
};

/**
 * MAIN ENTRY POINT: Executed by hourly Apps Script trigger
 */
function findRealtimeJobs() {
  console.log(`🚀 Starting REAL-TIME Job Search Pass (Past 24 Hours Only) - Target: ${CONFIG.TARGET_EXPERIENCE}...`);
  
  const startTime = new Date().getTime();
  const seenJobIds = getSeenJobIds();

  let linkedinJobs = [];
  let naukriJobs = [];
  let fetchedExams = [];

  // 1. Fetch Real-time Jobs from LinkedIn (India — All Tech Hubs)
  try {
    linkedinJobs = LinkedInSearch.fetchPast24hJobs(CONFIG.TARGET_ROLES, CONFIG.LOCATIONS, seenJobIds);
    console.log(`🔎 Discovered ${linkedinJobs.length} fresh jobs from LinkedIn...`);
  } catch (e) {
    console.error("LinkedIn Search Error: " + e.toString());
  }

  // 2. Fetch Real-time Jobs from Naukri, Indeed, Wellfound, Instahyre, Glassdoor, Workday ATS, Unstop
  try {
    naukriJobs = NaukriSearch.fetchPast24hJobs(CONFIG.TARGET_ROLES, CONFIG.LOCATIONS, seenJobIds);
    console.log(`🔎 Discovered ${naukriJobs.length} fresh jobs from Naukri/Indeed/Wellfound/Instahyre...`);
  } catch (e) {
    console.error("Multi-Platform Search Error: " + e.toString());
  }

  // 3. Fetch Competitive Exams, TCS NQT, Assessment Drives & Hackathons
  try {
    fetchedExams = ExamDriveSearch.fetchPast24hExams(CONFIG.TARGET_ROLES, seenJobIds);
    console.log(`📝 Discovered ${fetchedExams.length} active competitive exams & assessment drives...`);
  } catch (e) {
    console.error("Exam Drive Search Error: " + e.toString());
  }

  // 4. Interleave all job sources in round-robin fashion for a balanced multi-portal evaluation!
  const freshJobs = interleaveJobSources([fetchedExams, naukriJobs, linkedinJobs]);

  if (freshJobs.length === 0) {
    console.log("✅ No new job postings found in the last 24 hours pass.");
    return;
  }

  console.log(`\n🤖 Evaluating ${freshJobs.length} fresh jobs across ALL portals for FRESHER compatibility using Gemini 2.0 Flash AI...`);
  
  const matchedJobs = [];

  for (let i = 0; i < Math.min(freshJobs.length, CONFIG.MAX_JOBS_PER_PASS); i++) {
    const job = freshJobs[i];

    // HARD 36-HOUR FRESHNESS GATEKEEPER (MAX 36 HOURS CUTOFF ACROSS ALL PORTALS)
    if (!NaukriSearch.isWithin36Hours(job.postedAgo)) {
      markJobAsSeen(job.id);
      continue;
    }

    // 100% FREE CANDIDATE APPLY GATEKEEPER: Hard-reject paid/paywalled portals and junk static asset links
    if (!ATSResolver.isValidJobUrl(job.url) || ATSResolver.isPaidPortal(job.url)) {
      markJobAsSeen(job.id);
      continue;
    }
    
    // Evaluate Job Relevance & Extract Detailed Package/Skills with Gemini AI
    const evaluation = GeminiMatcher.evaluateJob(job, CONFIG.TARGET_ROLES, CONFIG.GEMINI_API_KEY, CONFIG.CANDIDATE_PROFILE);
    
    job.matchScore = evaluation.score;
    job.summary = evaluation.summary;
    job.salary = evaluation.salary;
    job.experience = evaluation.experience;
    job.workMode = evaluation.workMode;
    job.matchingSkills = evaluation.matchingSkills;
    job.missingSkills = evaluation.missingSkills;

    // HARD REJECT for any experience requirement >= 2 years (e.g. "3 to 8 years", "2-3 YOE", "3-5 YOE")
    const expCheck = String(job.experience || "").toLowerCase();
    if (expCheck.match(/([2-9]|1[0-9])\s*(?:\+|\-|to)\s*([0-9]+)?\s*(?:year|yoe|yrs)/i) || 
        expCheck.includes("2+") || expCheck.includes("3+") || expCheck.includes("4+") || expCheck.includes("5+") ||
        expCheck.includes("3 to 8") || expCheck.includes("3-8") || expCheck.includes("2-3") || expCheck.includes("3-5")) {
      if (!expCheck.includes("0-1") && !expCheck.includes("0 to 1") && !expCheck.includes("0-2") && !expCheck.includes("fresher")) {
        job.matchScore = 0;
      }
    }

    if (job.matchScore >= CONFIG.MIN_MATCH_SCORE) {
      // 1. Resolve Direct Official Company ATS Portal Link
      job.url = ATSResolver.resolveDirectAtsUrl(job.url);

      matchedJobs.push(job);
    }

    markJobAsSeen(job.id);
  }

  // 3. Log to Google Sheet Dashboard (Highlighting Exam rows in Pink!)
  if (matchedJobs.length > 0) {
    SheetNotifier.logJobsToSheet(matchedJobs);
  }

  const elapsedSec = Math.round((new Date().getTime() - startTime) / 1000);
  console.log(`\n🎉 Job Search Pass Complete in ${elapsedSec}s! Saved ${matchedJobs.length} Fresher-friendly matched jobs.`);
}

/**
 * UTILITY: Stores and checks processed Job IDs to prevent duplicates
 */
function getSeenJobIds() {
  const props = PropertiesService.getUserProperties().getProperty("SEEN_JOB_IDS");
  return props ? JSON.parse(props) : [];
}

function markJobAsSeen(jobId) {
  const seen = getSeenJobIds();
  seen.push(jobId);
  // Keep only last 1,000 job IDs in memory to save space
  if (seen.length > 1000) seen.shift();
  PropertiesService.getUserProperties().setProperty("SEEN_JOB_IDS", JSON.stringify(seen));
}

/**
 * RESET HELPER: Clears seen job memory
 */
function resetJobMemory() {
  PropertiesService.getUserProperties().deleteProperty("SEEN_JOB_IDS");
  console.log("🔄 Reset seen job memory.");
}

/**
 * DASHBOARD RESET HELPER: Re-creates Google Sheet Dashboard with clean layout & Application Pipeline tab
 */
function recreateSheetDashboard() {
  return SheetNotifier.recreateSheetDashboard();
}

/**
 * GMAIL SYNC HELPER: Auto-updates Google Sheet Application Pipeline status from incoming Gmail messages
 */
function syncApplicationStatusFromGmail() {
  return ApplicationTracker.syncApplicationStatusFromGmail();
}

/**
 * TRIGGER SETUP: Sets up hourly automatic job search
 */
function setupHourlyJobTrigger() {
  // Clear existing triggers for findRealtimeJobs
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "findRealtimeJobs") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create 1-hour recurring trigger
  ScriptApp.newTrigger("findRealtimeJobs")
    .timeBased()
    .everyHours(1)
    .create();

  console.log("⏰ Successfully scheduled hourly trigger for findRealtimeJobs!");
}

/**
 * UTILITY: Group all jobs by their specific portal name (Naukri, Indeed, Wellfound, Instahyre, Glassdoor, LinkedIn, Remotive, etc.)
 * and round-robin interleave them evenly, guaranteeing NO single portal ever dominates!
 */
function interleaveJobSources(sourceLists) {
  const portalMap = {};
  const allJobs = [];
  
  for (let s = 0; s < sourceLists.length; s++) {
    if (sourceLists[s]) {
      allJobs.push(...sourceLists[s]);
    }
  }

  // Group jobs by portal
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

  // Round-robin interleave across portals
  for (let i = 0; i < maxLen; i++) {
    for (let p = 0; p < portals.length; p++) {
      if (i < portalMap[portals[p]].length) {
        result.push(portalMap[portals[p]][i]);
      }
    }
  }

  return result;
}
