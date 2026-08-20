// ======================================================================
// COMPETITIVE EXAMS & OFF-CAMPUS HIRING DRIVES SCRAPER
// Scrapes national qualifier tests, enterprise assessment drives & hackathons
// Target: TCS NQT, TCS iON, Accenture Assessment, Capgemini Excellence, InfyTQ, Unstop
// ======================================================================

const ExamDriveSearch = {
  /**
   * Fetches active competitive exams, national hiring tests, and off-campus drives.
   * Targets TCS NQT, InfyTQ, Accenture, Capgemini, Unstop.
   */
  fetchDrives: function(targetRoles, seenJobIds) {
    const examJobs = [];
    const seenSet = new Set(seenJobIds);
    const normalizedSeenKeys = new Set();

    const siteClusters = [
      {
        query: '"TCS NQT" OR "TCS iON" (2026 OR 2025 OR Fresher OR "Off Campus")',
        name: "TCS iON / TCS NQT"
      },
      {
        query: '(site:unstop.com OR site:dare2compete.com) ("Hiring Challenge" OR "Off Campus Drive" OR "Assessment Drive")',
        name: "Unstop / Campus Portals"
      },
      {
        query: '("Accenture" OR "Capgemini" OR "Infosys" OR "Cognizant" OR "Wipro") ("Assessment Drive" OR "National Qualifier" OR "Off Campus Drive" OR "Excellence Drive") 2026',
        name: "Enterprise National Drives"
      },
      {
        query: '"Off Campus Drive" ("2026 Batch" OR "2025 Batch" OR "Fresher") Engineering India',
        name: "National Off-Campus Alerts"
      }
    ];

    for (let s = 0; s < siteClusters.length; s++) {
      const site = siteClusters[s];
      try {
        Utilities.sleep(150);

        const queryStr = encodeURIComponent(site.query);
        const rssUrl = `https://news.google.com/rss/search?q=${queryStr}+when:1d&hl=en-IN&gl=IN&ceid=IN:en`;

        const response = UrlFetchApp.fetch(rssUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
          },
          muteHttpExceptions: true
        });

        if (response.getResponseCode() === 200) {
          const xml = response.getContentText();
          const items = this.parseRss(xml, site.name, seenSet, normalizedSeenKeys);
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
  parseRss: function(xml, portalName, seenSet, normalizedSeenKeys) {
    const jobs = [];
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    const spamPhrases = [
      "how to", "tips", "guide", "tricks", "preparation", "syllabus",
      "answer key", "cut off", "cutoff", "mock test", "previous year",
      "sample paper", "study material", "result", "admit card", "score card",
      "news", "update", "notification 2025", "notification 2026",
      "what is", "everything about", "complete guide"
    ];

    const examTitleKeywords = [
      "nqt", "national qualifier", "off campus", "off-campus", "hiring drive",
      "assessment drive", "infytq", "hackwithinfy", "nlth", "amcat", "cocubes",
      "elitmus", "hiring challenge", "recruitment drive", "registration open",
      "apply now", "tcs ion", "tcsion", "excellence drive", "freshers drive",
      "campus drive", "dare2compete", "unstop", "2026 batch", "2025 batch"
    ];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
      const sourceMatch = item.match(/<source\s+url="([^"]*)">([\s\S]*?)<\/source>/);

      if (titleMatch && linkMatch) {
        const fullTitle = ATSResolver.cleanText(titleMatch[1]);
        let rawUrl = linkMatch[1].trim();
        const dateStr = dateMatch ? dateMatch[1] : "";
        const descText = descMatch ? ATSResolver.cleanText(descMatch[1]) : "";
        const sourceUrl = sourceMatch && sourceMatch[1] ? sourceMatch[1].trim() : "";
        const sourceName = sourceMatch && sourceMatch[2] ? ATSResolver.cleanText(sourceMatch[2]) : "";

        if (!NaukriSearch.isRecent(dateStr)) continue;

        const fullTitleLower = fullTitle.toLowerCase();
        if (spamPhrases.some(p => fullTitleLower.includes(p))) continue;
        if (!examTitleKeywords.some(k => fullTitleLower.includes(k))) continue;
        if (ATSResolver.isBlockedDomain(rawUrl) || ATSResolver.isBlockedDomain(sourceUrl)) continue;

        let title = fullTitle;
        let company = sourceName || "Tata Consultancy Services / National Hiring Body";

        if (fullTitle.includes(" - ")) {
          const parts = fullTitle.split(" - ");
          title = parts[0].trim();
          company = parts[1].trim();
        }

        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("tcs nqt") || lowerTitle.includes("national qualifier test") || lowerTitle.includes("tcs ion")) {
          if (!company || company === "National Hiring Body" || company.includes("Google")) {
            company = "Tata Consultancy Services (TCS iON)";
          }
        }

        const normKey = (company + "_" + title).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedSeenKeys && normalizedSeenKeys.has(normKey)) continue;

        const registrationDeadline = this.extractDeadline(`${title} ${descText}`);
        if (this.isDeadlineExpired(registrationDeadline)) continue;

        let finalUrl = ATSResolver.resolveDirectUrl(rawUrl);
        if ((!finalUrl || !ATSResolver.isValidUrl(finalUrl)) && sourceUrl && sourceUrl.startsWith("http")) {
          if (ATSResolver.isValidUrl(sourceUrl)) {
            finalUrl = sourceUrl;
          }
        }

        if (!finalUrl || !ATSResolver.isValidUrl(finalUrl)) continue;

        const jobId = `exam_${Math.abs(LinkedInSearch.hashCode(finalUrl))}`;
        if (seenSet.has(jobId)) continue;

        const postedAgo = NaukriSearch.formatRelativeTime(dateStr);

        jobs.push({
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
        });

        seenSet.add(jobId);
        if (normalizedSeenKeys) normalizedSeenKeys.add(normKey);
      }
    }

    return jobs;
  },

  /**
   * Extracts Registration Deadline date/text from drive content
   */
  extractDeadline: function(text) {
    if (!text) return "Active / Open";
    const match = text.match(/(?:deadline|apply by|last date|register by|ends on|until)[:\s]*([0-9]{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:\d{2,4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z][a-z]+\s+\d{1,2})/i);
    return (match && match[1]) ? match[1].trim() : "Active / Open";
  },

  /**
   * Verifies if extracted deadline date is already in the past
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
  }
};

