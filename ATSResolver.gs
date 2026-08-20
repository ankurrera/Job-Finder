// ======================================================================
// ATS PORTAL DIRECT RESOLVER & FAST LINK SANITIZER
// Unwraps heavy redirect wrappers & tracking params for INSTANT browser loading (<0.2s)
// Prevents junk static assets (gstatic.com, .js, .css), news articles, and dummy links (view/2)
// ======================================================================

const ATSResolver = {
  /**
   * STRICT VALIDATOR: Rejects junk static asset links (gstatic, google.com assets, .js, .css),
   * news/article redirect links (news.google.com), news portals, and dummy links (e.g. linkedin.com/jobs/view/2).
   * ONLY ACCEPTS VALID DIRECT JOB APPLYING PORTAL LINKS.
   */
  isValidJobUrl: function(url) {
    if (!url || typeof url !== 'string') return false;

    const lower = url.trim().toLowerCase();

    // 1. Must start with http:// or https://
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      return false;
    }

    // 2. HARD REJECT Google News / RSS Redirect Articles (news.google.com)
    if (lower.includes("news.google.com") || lower.includes("/rss/articles/")) {
      return false;
    }

    // 3. HARD REJECT Google Static Assets, Scripts, and CSS
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

    // 4. HARD REJECT News / Media Article Sites & Paid Portals
    if (this.isPaidPortal(lower)) {
      return false;
    }

    // 5. HARD REJECT Dummy / Test LinkedIn Job View IDs (e.g. view/2, view/1, view/0)
    if (lower.includes("linkedin.com/jobs/view/")) {
      const match = lower.match(/view\/(\d+)/);
      if (match && match[1]) {
        const idNum = parseInt(match[1], 10);
        // Genuine LinkedIn Job IDs are at least 6 digits long (e.g. 4450741001)
        if (idNum < 100000) {
          return false;
        }
      } else {
        return false;
      }
    }

    // 6. HARD REJECT generic Google homepage or search URLs
    if (lower === "https://google.com" || lower === "https://www.google.com" || lower === "https://news.google.com") {
      return false;
    }

    return true;
  },

  /**
   * Cleans heavy tracking parameters and resolves fast direct ATS URLs.
   * If unwrapping fails to find a direct ATS/apply portal, returns empty string to discard news links.
   */
  resolveDirectAtsUrl: function(rawUrl) {
    if (!rawUrl) return "";

    let cleanUrl = rawUrl.trim();

    // 1. LinkedIn Fast Direct Link: https://www.linkedin.com/jobs/view/{jobId}
    if (cleanUrl.includes("linkedin.com/jobs/view/")) {
      const idMatch = cleanUrl.match(/\/view\/.*?(\d+)/) || cleanUrl.match(/view\/(\d+)/);
      if (idMatch && idMatch[1]) {
        const idNum = parseInt(idMatch[1], 10);
        if (idNum >= 100000) {
          return `https://www.linkedin.com/jobs/view/${idMatch[1]}`;
        }
      }
      return "";
    }

    // 2. Unwrap Google News / RSS Heavy Redirects
    if (cleanUrl.includes("news.google.com")) {
      let resolvedDirectUrl = "";
      try {
        const res = UrlFetchApp.fetch(cleanUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
          },
          followRedirects: true,
          muteHttpExceptions: true
        });
        
        const html = res.getContentText();
        const targetMatch = html.match(/data-n-au="([^"]+)"/) || 
                            html.match(/c-wiz[\s\S]*?href="(https?:\/\/(?!news\.google|gstatic|googleusercontent|google\.com)[^"]+)"/) || 
                            html.match(/<link rel="canonical" href="(https?:\/\/(?!news\.google|gstatic|googleusercontent|google\.com)[^"]+)"/);

        if (targetMatch && targetMatch[1]) {
          const candidateUrl = targetMatch[1].trim();
          if (this.isValidJobUrl(candidateUrl)) {
            resolvedDirectUrl = candidateUrl;
          }
        }
      } catch (e) {
        // Fallback if HTTP fetch fails
      }

      // STRICT REQUIREMENT: If Google News link could not be unwrapped to a valid direct job portal link, REJECT IT!
      if (!resolvedDirectUrl || !this.isValidJobUrl(resolvedDirectUrl)) {
        return "";
      }
      cleanUrl = resolvedDirectUrl;
    }

    // Reject if final URL is invalid or static asset or news article
    if (!this.isValidJobUrl(cleanUrl)) {
      return "";
    }

    // 3. Check for Direct ATS Domains (Greenhouse, Lever, Workday, Ashby, SmartRecruiters)
    const lower = cleanUrl.toLowerCase();
    if (lower.includes("greenhouse.io") ||
        lower.includes("lever.co") ||
        lower.includes("myworkdayjobs.com") ||
        lower.includes("ashbyhq.com") ||
        lower.includes("smartrecruiters.com") ||
        lower.includes("bamboohr.com") ||
        lower.includes("jobvite.com")) {
      return cleanUrl.split("?")[0];
    }

    // 4. Strip heavy tracking parameters (?utm_source=..., ?trackingId=..., &refId=...)
    if (cleanUrl.includes("?")) {
      const baseUrl = cleanUrl.split("?")[0];
      if (cleanUrl.includes("naukri.com") || cleanUrl.includes("indeed.com")) {
        return cleanUrl.replace(/([?&])(utm_[^&]+|trackingId=[^&]+|refId=[^&]+|position=[^&]+)&?/gi, '$1').replace(/[?&]$/, '');
      }
      return baseUrl;
    }

    return cleanUrl;
  },

  /**
   * Known paid / paywalled / 3rd-party aggregator spam domains to automatically block
   */
  PAID_PORTAL_DOMAINS: [
    "weworkremotely.com",
    "foundit.in",
    "foundit.com",
    "flexjobs.com",
    "theladders.com",
    "ladders.com",
    "zippia.com",
    "experteer.com",
    "topresume.com",
    "freshersnow.com",
    "prepinsta.com",
    "placementdrive.in",
    "geeksgod.com",
    "jobseeker.in",
    "freejobalert.com",
    "testbook.com",
    "careerguide.com",
    "ambitionbox.com",
    "news18.com",
    "indiatimes.com",
    "moneycontrol.com",
    "hindustantimes.com",
    "indianexpress.com",
    "livemint.com",
    "business-standard.com",
    "thehindu.com",
    "financialexpress.com",
    "ndtv.com",
    "zeenews.com",
    "crazyengineers.com"
  ],

  /**
   * Checks if a job listing URL belongs to a paid/paywalled candidate site or news site
   */
  isPaidPortal: function(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    for (let i = 0; i < this.PAID_PORTAL_DOMAINS.length; i++) {
      if (lower.includes(this.PAID_PORTAL_DOMAINS[i])) {
        return true;
      }
    }
    return false;
  },

  /**
   * Universal HTML tag & CDATA stripper
   */
  cleanText: function(str) {
    if (!str) return "";
    return String(str).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
};
