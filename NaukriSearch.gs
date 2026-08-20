// ======================================================================
// NAUKRI, INDEED, WELLFOUND, INSTAHYRE REAL-TIME JOB SCRAPER
// Searches Naukri, Indeed, Wellfound, Instahyre & Glassdoor for 24h jobs
// ======================================================================

const NaukriSearch = {
  /**
   * Fetches job postings from Naukri, Indeed, Wellfound, Instahyre, Glassdoor published in the last 24-36 hours.
   */
  fetchJobs: function(targetRoles, locations, seenJobIds) {
    const freshJobs = [];
    const seenSet = new Set(seenJobIds);

    const searchFeeds = [
      { query: 'site:naukri.com ("Software Engineer" OR "Developer" OR "Fresher" OR "Trainee") India', name: "Naukri" },
      { query: 'site:indeed.co.in ("Fresher" OR "Associate Software Engineer" OR "Junior Developer") India', name: "Indeed" },
      { query: 'site:wellfound.com ("Software Engineer" OR "Full Stack" OR "AI Engineer") India', name: "Wellfound" },
      { query: 'site:instahyre.com ("Fresher" OR "Software Engineer" OR "Python Developer") India', name: "Instahyre" },
      { query: 'site:unstop.com ("Software Engineer" OR "Hiring" OR "Graduate Engineer Trainee" OR "2026 Batch")', name: "Unstop" },
      { query: '("TCS" OR "Accenture" OR "Capgemini" OR "Infosys" OR "Wipro" OR "Cognizant") ("Off Campus" OR "Fresher" OR "Associate Software Engineer") India', name: "MNC Enterprise" }
    ];

    for (let s = 0; s < searchFeeds.length; s++) {
      const feed = searchFeeds[s];
      try {
        Utilities.sleep(150);

        const query = encodeURIComponent(feed.query);
        const rssUrl = `https://news.google.com/rss/search?q=${query}+when:1d&hl=en-IN&gl=IN&ceid=IN:en`;

        const response = UrlFetchApp.fetch(rssUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
          },
          muteHttpExceptions: true
        });

        if (response.getResponseCode() === 200) {
          const xml = response.getContentText();
          const items = this.parseXml(xml, feed.query, feed.name);

          for (let j = 0; j < items.length; j++) {
            const job = items[j];
            if (!GeminiMatcher.isSeniorRole(job) && !seenSet.has(job.id)) {
              seenSet.add(job.id);
              freshJobs.push(job);
            }
          }
        }
      } catch (err) {
        console.error(`Error querying RSS for ${feed.name}: ${err.toString()}`);
      }
    }

    return freshJobs;
  },

  /**
   * Parses Google News/Jobs RSS Feed XML
   */
  parseXml: function(xml, searchKeyword, fallbackPortalName) {
    const jobs = [];
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);

      if (titleMatch && linkMatch) {
        const fullTitle = ATSResolver.cleanText(titleMatch[1]);
        const url = linkMatch[1].trim();

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

        const portalLower = portal.toLowerCase();
        if (portalLower.includes("wellfound") || portalLower.includes("angellist")) portal = "Wellfound";
        else if (portalLower.includes("instahyre")) portal = "Instahyre";
        else if (portalLower.includes("glassdoor")) portal = "Glassdoor";
        else if (portalLower.includes("naukri")) portal = "Naukri";
        else if (portalLower.includes("indeed")) portal = "Indeed";
        else if (portalLower.includes("foundit") || portalLower.includes("monster")) portal = "Foundit";

        const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const rawDate = pubDate ? pubDate[1] : "Today";

        if (!this.isRecent(rawDate)) {
          continue;
        }

        const postedAgo = this.formatRelativeTime(rawDate);
        const jobId = `naukri_${Math.abs(LinkedInSearch.hashCode(url))}`;

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
   * Filters out postings older than 36 hours.
   */
  isRecent: function(rawStr) {
    if (!rawStr) return false;
    const text = ATSResolver.cleanText(rawStr).toLowerCase();

    if (text.includes("just now") || text.includes("min") || text.includes("sec") || text === "today" || text === "earlier today") {
      return true;
    }
    if (text.includes("week") || text.includes("month") || text.includes("year")) {
      return false;
    }

    const matchDays = text.match(/(\d+)\s*d(?:ay)?s?\s*ago/);
    if (matchDays && matchDays[1]) {
      return parseInt(matchDays[1], 10) <= 1;
    }

    const matchHours = text.match(/(\d+)\s*h(?:our|r)?s?\s*ago/);
    if (matchHours && matchHours[1]) {
      return parseInt(matchHours[1], 10) <= 36;
    }

    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      const diffMs = new Date().getTime() - parsedDate.getTime();
      if (diffMs < -600000) return false;
      return diffMs <= 36 * 60 * 60 * 1000;
    }

    return true;
  },

  /**
   * Formats relative timestamp strings.
   */
  formatRelativeTime: function(rawStr) {
    if (!rawStr) return "Just now";
    const text = ATSResolver.cleanText(rawStr);
    const lower = text.toLowerCase();

    if (lower.includes("hour") || lower.includes("hr") || lower.includes("min") || lower.includes("sec") || lower.includes("just now")) {
      return text;
    }
    if (lower === "today") return "Earlier today";
    if (lower === "yesterday") return "24 hours ago";

    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      const diffMs = new Date().getTime() - parsedDate.getTime();
      if (diffMs <= 60 * 1000) return "Just now";

      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 60) return diffMins === 1 ? "1 min ago" : `${diffMins} mins ago`;

      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      if (diffHours <= 36) return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;

      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    }

    return text;
  }
};

