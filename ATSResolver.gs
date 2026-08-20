// ======================================================================
// ATS PORTAL DIRECT RESOLVER & FAST LINK SANITIZER
// Unwraps heavy redirect wrappers & tracking params for INSTANT browser loading (<0.2s)
// Prevents junk static assets (gstatic.com, .js, .css), news articles, and dummy links (view/2)
// ======================================================================

const ATSResolver = {
  /**
   * Validates if a URL is a legitimate direct job application portal link.
   * Filters out static assets, Google News redirects, dummy links, and aggregator blogs.
   */
  isValidUrl: function(url) {
    if (!url || typeof url !== "string") return false;
    const lower = url.trim().toLowerCase();

    if (!lower.startsWith("http://") && !lower.startsWith("https://")) return false;
    if (lower.includes("news.google.com") || lower.includes("/rss/articles/")) return false;

    if (lower.includes("gstatic.com") ||
        lower.includes("googleusercontent.com") ||
        lower.includes("googleapis.com") ||
        lower.includes("/_/mss/") ||
        lower.includes("boq-dots") ||
        lower.includes(".js") ||
        lower.includes(".css") ||
        lower.includes("manifest.json") ||
        lower.includes("/favicon.ico")) {
      return false;
    }

    if (this.isBlockedDomain(lower)) return false;

    if (lower.includes("linkedin.com/jobs/view/")) {
      const match = lower.match(/view\/(\d+)/);
      if (match && match[1]) {
        if (parseInt(match[1], 10) < 100000) return false;
      } else {
        return false;
      }
    }

    if (lower === "https://google.com" || lower === "https://www.google.com") return false;
    return true;
  },

  /**
   * Resolves direct ATS links by stripping tracking parameters and unwrapping Google redirects.
   */
  resolveDirectUrl: function(rawUrl) {
    if (!rawUrl) return "";
    let cleanUrl = rawUrl.trim();

    if (cleanUrl.includes("linkedin.com/jobs/view/")) {
      const match = cleanUrl.match(/\/view\/.*?(\d+)/) || cleanUrl.match(/view\/(\d+)/);
      if (match && match[1] && parseInt(match[1], 10) >= 100000) {
        return `https://www.linkedin.com/jobs/view/${match[1]}`;
      }
      return "";
    }

    if (cleanUrl.includes("news.google.com")) {
      let directUrl = "";
      try {
        const res = UrlFetchApp.fetch(cleanUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9"
          },
          followRedirects: true,
          muteHttpExceptions: true
        });
        const html = res.getContentText();
        const targetMatch = html.match(/data-n-au="([^"]+)"/) || 
                            html.match(/c-wiz[\s\S]*?href="(https?:\/\/(?!news\.google|gstatic|googleusercontent|google\.com)[^"]+)"/) || 
                            html.match(/<link rel="canonical" href="(https?:\/\/(?!news\.google|gstatic|googleusercontent|google\.com)[^"]+)"/);

        if (targetMatch && targetMatch[1] && this.isValidUrl(targetMatch[1].trim())) {
          directUrl = targetMatch[1].trim();
        }
      } catch (e) {}

      if (!directUrl || !this.isValidUrl(directUrl)) return "";
      cleanUrl = directUrl;
    }

    if (!this.isValidUrl(cleanUrl)) return "";

    const lower = cleanUrl.toLowerCase();
    const atsDomains = ["greenhouse.io", "lever.co", "myworkdayjobs.com", "ashbyhq.com", "smartrecruiters.com", "bamboohr.com", "jobvite.com"];
    if (atsDomains.some(d => lower.includes(d))) {
      return cleanUrl.split("?")[0];
    }

    if (cleanUrl.includes("?")) {
      if (cleanUrl.includes("naukri.com") || cleanUrl.includes("indeed.com")) {
        return cleanUrl.replace(/([?&])(utm_[^&]+|trackingId=[^&]+|refId=[^&]+|position=[^&]+)&?/gi, "$1").replace(/[?&]$/, "");
      }
      return cleanUrl.split("?")[0];
    }

    return cleanUrl;
  },

  /**
   * Blocked domains: spam blogs, paywalled sites, prep aggregators
   */
  BLOCKED_DOMAINS: [
    "weworkremotely.com", "foundit.in", "foundit.com", "flexjobs.com", "theladders.com",
    "ladders.com", "zippia.com", "experteer.com", "topresume.com", "freshersnow.com",
    "prepinsta.com", "placementdrive.in", "geeksgod.com", "jobseeker.in", "freejobalert.com",
    "testbook.com", "careerguide.com", "ambitionbox.com", "news18.com", "indiatimes.com",
    "moneycontrol.com", "hindustantimes.com", "indianexpress.com", "livemint.com",
    "business-standard.com", "thehindu.com", "financialexpress.com", "ndtv.com",
    "zeenews.com", "crazyengineers.com"
  ],

  isBlockedDomain: function(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return this.BLOCKED_DOMAINS.some(domain => lower.includes(domain));
  },

  /**
   * Strips HTML tags, CDATA wrappers, and extra whitespace.
   */
  cleanText: function(str) {
    if (!str) return "";
    return String(str).replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }
};

