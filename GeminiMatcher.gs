// ======================================================================
// GEMINI 2.0 FLASH AI JOB RELEVANCE & MATCH SCORING ENGINE
// Evaluates fresh job titles & roles against FRESHER / ENTRY-LEVEL candidates
// ======================================================================

const GeminiMatcher = {
  /**
   * Exclusion list for senior / experienced roles
   */
  SENIOR_KEYWORDS: [
    "senior", "sr.", "sr ", "lead", "principal", "architect", 
    "manager", "head of", "director", "staff", "vp", "vice president",
    "2+", "3+", "4+", "5+", "6+", "7+", "8+", "10+",
    "2-3", "2-4", "2-5", "3-5", "4-6", "5-8", "5-10", "3-8", "4-8", 
    "2 to 3", "2 to 4", "2 to 5", "3 to 8", "3 to 5", "3 to 6", "4 to 8", "5 to 10",
    "2 years", "3 years", "4 years", "5 years", "6 years", "7 years", "8 years", "9 years", "10 years"
  ],

  /**
   * Checks if a role explicitly requires experience beyond Freshers (0-1 YOE)
   */
  isSeniorRole: function(job) {
    const text = (job.title + " " + (job.summary || "") + " " + (job.experience || "") + " " + (job.searchRole || "")).toLowerCase();
    for (let i = 0; i < this.SENIOR_KEYWORDS.length; i++) {
      if (text.includes(this.SENIOR_KEYWORDS[i])) {
        return true;
      }
    }

    if (text.match(/([2-9]|1[0-9])\s*(?:\+|\-|to)\s*([0-9]+)?\s*(?:year|yoe|yrs)/i)) {
      if (!text.includes("0-1") && !text.includes("0 to 1") && !text.includes("0-2") && !text.includes("fresher")) {
        return true;
      }
    }

    return false;
  },

  /**
   * Evaluates job relevance and extract package/skills using Gemini 2.0 Flash AI
   */
  evaluate: function(job, targetRoles, apiKey, candidateProfile) {
    if (job.isExamDrive || SheetNotifier.isExamOrDrive(job)) {
      return {
        score: 95,
        salary: "Standard Entry Package (3.6 - 9.0 LPA)",
        experience: "Fresher / 2026 & 2025 Batch Passout",
        workMode: "Online Assessment / Pan-India",
        summary: `Matched active competitive exam & national hiring drive: ${job.title}`,
        matchingSkills: "TCS NQT / Aptitude / Coding / Technical Assessment",
        missingSkills: "None"
      };
    }

    if (this.isSeniorRole(job)) {
      return {
        score: 0,
        salary: "Not Disclosed",
        experience: "2+ YOE (Requires Experienced Professional)",
        workMode: "N/A",
        summary: "REJECTED: Requires 2+ years experience (Fresher 0-1 YOE limit exceeded).",
        matchingSkills: "None",
        missingSkills: "Requires prior experienced professional background"
      };
    }

    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.trim() === "") {
      return this.evaluateHeuristic(job, targetRoles);
    }

    const targetList = targetRoles.join(", ");
    const candidateInfo = candidateProfile ? 
      `Candidate Profile:
- Degree: ${candidateProfile.DEGREE || 'B.Tech in Computer Science & Engineering (CSE)'}
- CGPA: ${candidateProfile.CGPA || 7.38} / 10 (73.8%) - Eligible for MNC cutoffs
- Passout Batch: ${candidateProfile.PASSOUT_YEAR || '2026'} Batch Passout
- Target Status: ${candidateProfile.TARGET_STATUS || 'Fresher / 2026 Batch Passout (0-1 YOE Max)'}` : 
      'Candidate Profile: 2026 Batch B.Tech CSE Fresher (7.38 CGPA / 73.8%)';

    const prompt = `You are a strict tech recruiter evaluating job postings EXCLUSIVELY FOR FRESHERS & RECENT GRADUATES targeting India-based companies (0 to 1 Year Max / 2026 & 2025 Batch Passouts).

${candidateInfo}

Target Roles & Companies:
${targetList}
Enterprise MNC Target: TCS, Accenture, Capgemini, EY, Infosys, Wipro, Cognizant, IBM, Deloitte, PwC, HCLTech, LTIMindtree.
Location Focus: India ONLY (Bangalore, Hyderabad, Chennai, Kolkata, Delhi, Gurgaon, Pune, Mumbai, Noida). Reject any job that is outside India or requires physical relocation abroad.

STRICT EVALUATION INSTRUCTIONS:
1. "isFresherFriendly": Must be true ONLY IF this job is suitable for a 2026 or 2025 Batch Passout / Fresher / Recent Graduate (0 to 1 YOE Max). HARD REJECT if it requires 2+ years of experience.
2. "batchPassoutCheck": Candidate is a 2026 Batch Passout. Jobs for 2026 Batch, 2025 Batch, or Freshers are FULLY ELIGIBLE.
3. "cgpaEligibilityCheck": Candidate CGPA is 7.38 (73.8%). ONLY reject if the job explicitly mandates > 7.38 CGPA.
4. "indiaLocationCheck": Job MUST be India-based.
5. "score": 0 if not fresher friendly, 85-100 if fully eligible, 70-84 if borderline.

Return a valid JSON object with:
{
  "isFresherFriendly": true or false,
  "score": integer (0-100),
  "salary": "estimated package or Not Disclosed",
  "experience": "required YOE (e.g. Fresher / 0-1 YOE)",
  "workMode": "Remote (India)", "Hybrid", or "On-site",
  "matchingSkills": ["Skill1", "Skill2"],
  "missingSkills": ["Requirement1"],
  "summary": "1 sentence explanation"
}
Return ONLY single valid JSON object. No markdown fences.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    try {
      const res = UrlFetchApp.fetch(url, {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const json = JSON.parse(res.getContentText());
      if (json.candidates && json.candidates[0] && json.candidates[0].content) {
        const rawText = json.candidates[0].content.parts[0].text.trim().replace(/^```json|```$/g, '').trim();
        const parsed = JSON.parse(rawText);
        
        let finalScore = parsed.isFresherFriendly === false ? 0 : (parsed.score || 70);
        const expStr = String(parsed.experience || "").toLowerCase();

        if (expStr.match(/([2-9]|1[0-9])\s*(?:\+|\-|to)\s*([0-9]+)?\s*(?:year|yoe|yrs)/i) || 
            expStr.includes("2+") || expStr.includes("3+") || expStr.includes("4+") || expStr.includes("5+") || 
            expStr.includes("2-3") || expStr.includes("3-5") || expStr.includes("2 to 4") || expStr.includes("3 to 8")) {
          if (!expStr.includes("0-1") && !expStr.includes("0 to 1") && !expStr.includes("0-2") && !expStr.includes("fresher")) {
            finalScore = 0;
            parsed.summary = `REJECTED: Requires ${parsed.experience} (Fresher 0-1 YOE limit exceeded).`;
          }
        }

        return {
          score: finalScore,
          salary: parsed.salary || "Not Disclosed",
          experience: parsed.experience || "Fresher / 0-2 YOE",
          workMode: parsed.workMode || "Hybrid / Flexible",
          summary: parsed.summary || "Matches fresher candidate profile.",
          matchingSkills: (parsed.matchingSkills || []).join(", "),
          missingSkills: (parsed.missingSkills || []).join(", ")
        };
      }
    } catch (err) {
      console.warn(`Gemini evaluation error for "${job.title}": ${err.toString()}`);
    }

    return this.evaluateHeuristic(job, targetRoles);
  },

  /**
   * Fallback rule-based evaluator when Gemini API key is not configured
   */
  evaluateHeuristic: function(job, targetRoles) {
    if (this.isSeniorRole(job)) {
      return {
        score: 0,
        salary: "Not Disclosed",
        experience: "3+ YOE (Senior / Lead)",
        workMode: "N/A",
        summary: "REJECTED: Contains senior/lead experience keywords.",
        matchingSkills: "None",
        missingSkills: "Requires senior experience level"
      };
    }

    const titleLower = job.title.toLowerCase();

    const isFresherRole = titleLower.includes("fresher") ||
                          titleLower.includes("trainee") ||
                          titleLower.includes("junior") ||
                          titleLower.includes("associate") ||
                          titleLower.includes("entry") ||
                          titleLower.includes("intern") ||
                          titleLower.includes("graduate") ||
                          titleLower.includes("software engineer") ||
                          titleLower.includes("software development engineer") ||
                          titleLower.includes("sde") ||
                          titleLower.includes("software developer") ||
                          titleLower.includes("full stack") ||
                          titleLower.includes("frontend") ||
                          titleLower.includes("backend") ||
                          titleLower.includes("python developer") ||
                          titleLower.includes("java developer") ||
                          titleLower.includes("web developer") ||
                          titleLower.includes("system engineer") ||
                          titleLower.includes("technology analyst") ||
                          titleLower.includes("prompt engineer") ||
                          titleLower.includes("ai product engineer") ||
                          titleLower.includes("ai engineer") ||
                          titleLower.includes("ml engineer") ||
                          titleLower.includes("machine learning") ||
                          titleLower.includes("generative ai") ||
                          titleLower.includes("llm engineer") ||
                          titleLower.includes("0-1") ||
                          titleLower.includes("0-2") ||
                          titleLower.includes("2026 batch") ||
                          titleLower.includes("2025 batch");

    if (!isFresherRole) {
      return {
        score: 0,
        salary: "Not Disclosed",
        experience: "Unverified YOE",
        workMode: "N/A",
        summary: "REJECTED: Title does not match entry-level engineering role pattern.",
        matchingSkills: "None",
        missingSkills: "Requires Gemini API key for accurate evaluation"
      };
    }

    let mode = "On-site / Hybrid";
    if (titleLower.includes("remote") || (job.location && job.location.toLowerCase().includes("remote"))) {
      mode = "Remote (India)";
    }

    return {
      score: 88,
      salary: "Not Disclosed",
      experience: "Fresher / 0-1 YOE",
      workMode: mode,
      summary: `Matched entry-level engineering role: ${job.title}.`,
      matchingSkills: job.searchRole || "Entry-level engineering keywords matched",
      missingSkills: "None"
    };
  }
};

