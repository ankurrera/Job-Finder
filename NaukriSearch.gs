// ======================================================================
// NAUKRI, INDEED, WELLFOUND, INSTAHYRE REAL-TIME JOB SCRAPER
// Searches Naukri, Indeed, Wellfound, Instahyre & Glassdoor for 24h jobs
// ======================================================================

const NaukriSearch = {
  /**
   * Fetches job postings from Naukri, Indeed, Wellfound, Instahyre, Glassdoor published in last 24 hours.
   */
  fetchPast24hJobs: function(targetRoles, locations, seenJobIds) {
    const freshJobs = [];
    const seenSet = new Set(seenJobIds);

    // Role clusters: explicit job titles + MNC names + FRESHER qualifier to surface only entry-level postings
    const roleClusters = [
      '"Software Engineer" OR "Associate Software Engineer" OR "System Engineer" OR "Software Developer" (Fresher OR "2026 Batch" OR "2025 Batch" OR "Entry Level" OR "0-1 Year") -Senior -Lead -Manager -Architect',
      '"Full Stack" OR "Backend Engineer" OR "Frontend Engineer" OR "Python Developer" (Fresher OR "2026 Batch" OR "Entry Level") -Senior -Lead -Manager',
      '"AI Engineer" OR "Generative AI" OR "LLM Engineer" OR "ML Engineer" (Fresher OR "Entry Level" OR "2026 Batch") -Senior -Lead',
      '"TCS" OR "Accenture" OR "Capgemini" OR "Infosys" OR "Wipro" OR "HCL" OR "LTIMindtree" ("Associate Software Engineer" OR "System Engineer" OR "Technology Analyst" OR "Graduate Trainee" OR "Software Engineer") Fresher India'
    ];

    // Consolidated site domain clusters
    const siteClusters = [
      { domainQuery: "(site:naukri.com OR site:indeed.co.in)", name: "Naukri/Indeed" },
      { domainQuery: "(site:wellfound.com OR site:instahyre.com OR site:glassdoor.co.in)", name: "Wellfound/Instahyre" },
      { domainQuery: "(site:myworkdayjobs.com OR site:unstop.com OR site:dare2compete.com)", name: "Workday/Unstop" }
    ];

    for (let s = 0; s < siteClusters.length; s++) {
      const site = siteClusters[s];
      for (let c = 0; c < roleClusters.length; c++) {
        const roleQuery = roleClusters[c];

        try {
          Utilities.sleep(150);

          // India-only — removed "OR Remote" to prevent international job pollution
          const query = encodeURIComponent(`${site.domainQuery} (${roleQuery}) India`);
          const rssUrl = `https://news.google.com/rss/search?q=${query}+when:1d&hl=en-IN&gl=IN&ceid=IN:en`;

          const response = UrlFetchApp.fetch(rssUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            muteHttpExceptions: true
          });

          if (response.getResponseCode() === 200) {
            const xml = response.getContentText();
            const items = this.parseRssXml(xml, roleQuery, site.name);

            for (let j = 0; j < items.length; j++) {
              const job = items[j];
              // Pre-filter senior titles at scraper level!
              if (!GeminiMatcher.isSeniorJob(job) && !seenSet.has(job.id)) {
                seenSet.add(job.id);
                freshJobs.push(job);
              }
            }
          }
        } catch (err) {
          console.error(`Error querying RSS for ${site.name}: ${err.toString()}`);
        }
      }
    }

    return freshJobs;
  },

  /**
   * Parses Google News/Jobs RSS Feed XML
   */
  parseRssXml: function(xml, searchKeyword, fallbackPortalName) {
    const jobs = [];
    const itemRegex = /<item>[\s\S]*?<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const linkRegex = /<link>([\s\S]*?)<\/link>/;
    const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;

    const items = xml.match(itemRegex) || [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleMatch = item.match(titleRegex);
      const linkMatch = item.match(linkRegex);

      if (titleMatch && linkMatch) {
        const fullTitle = this.cleanText(titleMatch[1]);
        const url = linkMatch[1].trim();

        // Title format in Google News RSS:
        // Option A: "Job Title - Company Name - Portal"
        // Option B: "Job Title - Portal"
        const parts = fullTitle.split(" - ");
        let title = fullTitle;
        let company = "Direct Tech Hiring";
        let portal = fallbackPortalName || "Naukri / Indeed";

        if (parts.length >= 3) {
          title = parts[0].trim();
          company = parts[1].trim();
          portal = parts[2].trim();
        } else if (parts.length === 2) {
          title = parts[0].trim();
          const secondPart = parts[1].trim();
          const secondLower = secondPart.toLowerCase();
          
          if (secondLower.includes("naukri") || secondLower.includes("indeed") || 
              secondLower.includes("wellfound") || secondLower.includes("instahyre") || 
              secondLower.includes("glassdoor")) {
            portal = secondPart;
          } else {
            company = secondPart;
          }
        }

        // Standardize portal display names
        const portalLower = portal.toLowerCase();
        if (portalLower.includes("wellfound") || portalLower.includes("angellist")) portal = "Wellfound";
        else if (portalLower.includes("instahyre")) portal = "Instahyre";
        else if (portalLower.includes("glassdoor")) portal = "Glassdoor";
        else if (portalLower.includes("naukri")) portal = "Naukri";
        else if (portalLower.includes("indeed")) portal = "Indeed";
        else if (portalLower.includes("foundit") || portalLower.includes("monster")) portal = "Foundit";

        const pubDate = item.match(dateRegex);
        const rawDate = pubDate ? pubDate[1] : "Today";

        // HARD 36-HOUR FRESHNESS FILTER: Skip any job older than 36 hours!
        if (!this.isWithin36Hours(rawDate)) {
          continue;
        }

        const postedAgo = this.formatHoursAgo(rawDate);

        const jobId = `naukri_${Math.abs(this.hashCode(url))}`;

        jobs.push({
          id: jobId,
          title: title,
          company: company,
          location: "India",
          portal: portal,
          url: url,
          postedAgo: postedAgo,
          searchRole: searchKeyword
        });
      }
    }

    return jobs;
  },

  /**
   * HARD 36-HOUR VERIFICATION GATEKEEPER
   * Strictly rejects any post older than 36 hours (1.5 days / 129,600,000 ms).
   * NO EXCEPTION allowed for any portal or source.
   */
  isWithin36Hours: function(rawStr) {
    if (!rawStr) return false;

    const cleaned = String(rawStr).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim();
    const text = cleaned.toLowerCase();

    // 1. Instant pass for explicit fresh relative terms (< 24 hours)
    if (text.includes("just now") || text.includes("min") || text.includes("sec") || text === "today" || text === "earlier today") {
      return true;
    }

    // 2. Instant reject for old relative terms (> 36 hours)
    if (text.includes("week") || text.includes("month") || text.includes("year")) {
      return false;
    }

    // 3. Check "X days ago" or "X d ago" (e.g. 2 days ago, 145 days ago, 978 days ago, 5522 days ago ARE REJECTED!)
    const matchDays = text.match(/(\d+)\s*d(?:ay)?s?\s*ago/);
    if (matchDays && matchDays[1]) {
      const days = parseInt(matchDays[1], 10);
      return days <= 1; // Only 0 or 1 day ago is allowed (<= 36h). 2+ days ARE HARD REJECTED!
    }

    // 4. Check "X hours ago" or "X hrs ago"
    const matchHours = text.match(/(\d+)\s*h(?:our|r)?s?\s*ago/);
    if (matchHours && matchHours[1]) {
      const hours = parseInt(matchHours[1], 10);
      return hours <= 36;
    }

    // 5. Check Date timestamp string (e.g. RSS pubDate: "Fri, 07 Aug 2026 14:15:43 GMT")
    const parsedDate = new Date(cleaned);
    if (!isNaN(parsedDate.getTime())) {
      const nowMs = new Date().getTime();
      const diffMs = nowMs - parsedDate.getTime();

      if (diffMs < -600000) return false; // reject fake future dates > 10 mins ahead
      
      // 129,600,000 ms = 36 Hours! Hard cutoff at 36 Hours max!
      return diffMs <= 36 * 60 * 60 * 1000;
    }

    return true;
  },

  formatHoursAgo: function(rawStr) {
    if (!rawStr) return "Just now";

    const cleaned = str => str.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim();
    const text = cleaned(rawStr);
    const lower = text.toLowerCase();

    if (lower.includes("hour") || lower.includes("hr") || lower.includes("min") || lower.includes("sec") || lower.includes("just now")) {
      return text;
    }

    if (lower === "today") return "Earlier today";
    if (lower === "yesterday") return "24 hours ago";

    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      const nowMs = new Date().getTime();
      const diffMs = nowMs - parsedDate.getTime();

      if (diffMs <= 60 * 1000) {
        return "Just now";
      }

      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 60) {
        return diffMins === 1 ? "1 min ago" : `${diffMins} mins ago`;
      }

      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      if (diffHours <= 36) {
        return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
      }

      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    }

    return text;
  },

  cleanText: function(str) {
    return ATSResolver.cleanText(str);
  },

  hashCode: function(s) {
    return LinkedInSearch.hashCode(s);
  }
};
