// ======================================================================
// COMPETITIVE EXAMS & OFF-CAMPUS HIRING DRIVES SCRAPER
// Scrapes national qualifier tests, enterprise assessment drives & hackathons
// Target: TCS NQT, TCS iON, Accenture Assessment, Capgemini Excellence, InfyTQ, Unstop
// ======================================================================

const ExamDriveSearch = {
  /**
   * Fetches active competitive exams, national hiring tests, and off-campus drives.
   * Includes TCS NQT (tcsion.com / nextstep.tcs.com / tcs.com) and active drives posted in the past 30 days.
   */
  fetchPast24hExams: function(targetRoles, seenJobIds) {
    const examJobs = [];
    const seenSet = new Set(seenJobIds);
    const normalizedSeenKeys = new Set();

    // Comprehensive query clusters targeting official MNC portals and national drives
    const siteClusters = [
      {
        query: "(site:tcs.com OR site:tcsion.com OR site:nextstep.tcs.com OR site:infosys.com OR site:accenture.com OR site:wipro.com OR site:capgemini.com) (\"Off Campus\" OR \"Assessment Drive\" OR \"Hiring Drive\" OR \"NQT\" OR \"InfyTQ\") 2026 Freshers",
        name: "Official Enterprise Portals"
      },
      {
        query: "(site:unstop.com OR site:naukri.com OR site:dare2compete.com) (\"Off Campus Drive\" OR \"Hiring Drive\" OR \"Assessment Drive\" OR \"NQT\") Freshers (2026 OR 2025)",
        name: "Unstop / Campus Portals"
      },
      {
        query: "(\"TCS NQT\" OR \"TCS iON\" OR \"InfyTQ\" OR \"HackWithInfy\" OR \"Wipro NLTH\" OR \"Accenture Assessment Drive\" OR \"Capgemini Excellence Drive\" OR \"EY Technology Analyst Drive\") (Registration OR \"Apply Now\" OR \"Deadline\" OR \"Register\") (2026 OR 2025)",
        name: "National Drive Alerts"
      }
    ];

    for (let s = 0; s < siteClusters.length; s++) {
      const site = siteClusters[s];
      try {
        Utilities.sleep(150);

        const queryStr = encodeURIComponent(site.query);
        // Search active drives posted strictly in the past 24-36 hours!
        const rssUrl = `https://news.google.com/rss/search?q=${queryStr}+when:1d&hl=en-IN&gl=IN&ceid=IN:en`;

        const response = UrlFetchApp.fetch(rssUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          muteHttpExceptions: true
        });

        if (response.getResponseCode() === 200) {
          const xml = response.getContentText();
          const items = this.parseExamRss(xml, site.name, seenSet, normalizedSeenKeys);
          examJobs.push(...items);
        }
      } catch (e) {
        console.warn(`Exam Search Warning for ${site.name}: ${e.toString()}`);
      }
    }

    return examJobs;
  },

  /**
   * Parses RSS XML for Exam & Assessment Drives with Deadline Extraction & Anti-Duplication
   */
  parseExamRss: function(xml, portalName, seenSet, normalizedSeenKeys) {
    const jobs = [];
    const itemRegex = /<item>[\s\S]*?<\/item>/g;
    const items = xml.match(itemRegex) || [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
      const sourceMatch = item.match(/<source\s+url="([^"]*)">([\s\S]*?)<\/source>/);

      if (titleMatch && linkMatch) {
        const fullTitle = this.cleanText(titleMatch[1]);
        let rawUrl = linkMatch[1].trim();
        const dateStr = dateMatch ? dateMatch[1] : "";
        const descText = descMatch ? this.cleanText(descMatch[1]) : "";
        const sourceUrl = sourceMatch && sourceMatch[1] ? sourceMatch[1].trim() : "";
        const sourceName = sourceMatch && sourceMatch[2] ? this.cleanText(sourceMatch[2]) : "";

        // HARD 36-HOUR FRESHNESS GATEKEEPER: Skip any drive older than 36 hours!
        if (!NaukriSearch.isWithin36Hours(dateStr)) {
          continue;
        }

        // ── SPAM-BLOG REJECTION GATE ─────────────────────────────────────────
        // Reject prep articles, results pages, answer keys — not registration links
        const spamPhrases = [
          "how to", "tips", "guide", "tricks", "preparation", "syllabus",
          "answer key", "cut off", "cutoff", "mock test", "previous year",
          "sample paper", "study material", "result", "admit card", "score card",
          "news", "update", "notification 2025", "notification 2026",
          "what is", "everything about", "complete guide"
        ];
        const fullTitleLower = fullTitle.toLowerCase();
        const isSpam = spamPhrases.some(p => fullTitleLower.includes(p));
        if (isSpam) continue;

        // ── TITLE-LEVEL EXAM KEYWORD GATE ────────────────────────────────────
        // Only accept items whose title contains at least one hard exam keyword
        const examTitleKeywords = [
          "nqt", "national qualifier", "off campus", "off-campus", "hiring drive",
          "assessment drive", "infytq", "hackwithinfy", "nlth", "amcat", "cocubes",
          "elitmus", "hiring challenge", "recruitment drive", "registration open",
          "apply now", "tcs ion", "tcsion", "excellence drive", "freshers drive",
          "campus drive", "dare2compete", "unstop", "2026 batch", "2025 batch"
        ];
        const hasExamKeyword = examTitleKeywords.some(k => fullTitleLower.includes(k));
        if (!hasExamKeyword) continue;
        // ─────────────────────────────────────────────────────────────────────

        // 1. HARD REJECT 3rd Party Blog / Aggregator Spam Links
        if (ATSResolver.isPaidPortal(rawUrl) || ATSResolver.isPaidPortal(sourceUrl)) {
          continue;
        }

        let title = fullTitle;
        let company = sourceName || "Tata Consultancy Services / National Hiring Body";

        if (fullTitle.includes(" - ")) {
          const parts = fullTitle.split(" - ");
          title = parts[0].trim();
          company = parts[1].trim();
        }

        // Auto-assign official company if title relates to TCS NQT
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("tcs nqt") || lowerTitle.includes("national qualifier test") || lowerTitle.includes("tcs ion")) {
          if (!company || company === "National Hiring Body" || company.includes("Google")) {
            company = "Tata Consultancy Services (TCS iON)";
          }
        }

        // 2. Anti-Duplication Guard: Normalize title and company key
        const normKey = (company + "_" + title).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedSeenKeys && normalizedSeenKeys.has(normKey)) {
          continue; // Skip duplicate drive posting
        }

        // 3. Extract Registration Deadline
        const fullContent = `${title} ${descText}`;
        const registrationDeadline = this.extractDeadline(fullContent);

        // Filter out expired deadlines if explicit date is in past
        if (this.isDeadlineExpired(registrationDeadline)) {
          continue;
        }

        // 4. Resolve Direct Portal Link
        let finalUrl = ATSResolver.resolveDirectAtsUrl(rawUrl);
        if ((!finalUrl || !ATSResolver.isValidJobUrl(finalUrl)) && sourceUrl && sourceUrl.startsWith("http")) {
          if (ATSResolver.isValidJobUrl(sourceUrl)) {
            finalUrl = sourceUrl;
          }
        }

        // HARD REJECT if finalUrl is empty, news article, or invalid portal
        if (!finalUrl || !ATSResolver.isValidJobUrl(finalUrl)) {
          continue;
        }

        const jobId = `exam_${Math.abs(LinkedInSearch.hashCode(finalUrl))}`;
        if (seenSet.has(jobId)) continue;

        const postedAgo = NaukriSearch.formatHoursAgo(dateStr);

        const job = {
          id: jobId,
          title: `📝 ${title}`,
          company: company,
          registrationDeadline: registrationDeadline,
          location: "India / Online",
          portal: portalName || "TCS iON / Enterprise Portal",
          url: finalUrl,
          postedAgo: postedAgo,
          searchRole: title,
          isExamDrive: true
        };

        seenSet.add(jobId);
        if (normalizedSeenKeys) normalizedSeenKeys.add(normKey);
        jobs.push(job);
      }
    }

    return jobs;
  },

  /**
   * Helper: Extracts Registration Deadline date/text from drive content
   */
  extractDeadline: function(text) {
    if (!text) return "Active / Open";

    const match = text.match(/(?:deadline|apply by|last date|register by|ends on|until)[:\s]*([0-9]{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:\d{2,4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z][a-z]+\s+\d{1,2})/i);
    if (match && match[1]) {
      return match[1].trim();
    }

    return "Active / Open";
  },

  /**
   * Helper: Verifies if extracted deadline date is already in the past
   */
  isDeadlineExpired: function(deadlineStr) {
    if (!deadlineStr || deadlineStr === "Active / Open") return false;

    const parsedDate = new Date(deadlineStr);
    if (!isNaN(parsedDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return parsedDate.getTime() < today.getTime();
    }

    return false;
  },

  cleanText: function(str) {
    return ATSResolver.cleanText(str);
  }
};
