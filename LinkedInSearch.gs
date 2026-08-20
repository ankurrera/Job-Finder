// ======================================================================
// LINKEDIN REAL-TIME JOB SCRAPER (PAST 24 HOURS ONLY - FRESHERS FILTER)
// Uses LinkedIn Guest Jobs API with f_TPR=r86400 (86,400 seconds = 24h)
// ======================================================================

const LinkedInSearch = {
  /**
   * Fetches job postings from LinkedIn published strictly in the last 24 hours.
   */
  fetchPast24hJobs: function(targetRoles, locations, seenJobIds) {
    const freshJobs = [];
    const seenSet = new Set(seenJobIds);

    // Role clusters: fresher qualifier injected directly to dramatically improve signal quality
    // Adding "Fresher OR Entry Level OR Graduate OR Trainee" pushes LinkedIn to surface only 0-1 YOE postings
    const roleClusters = [
      '("Software Engineer" OR "Associate Software Engineer" OR "Software Developer" OR "SDE") AND (Fresher OR "Entry Level" OR "2026 Batch" OR "Graduate Trainee") NOT Senior NOT Lead NOT Manager NOT Architect NOT Staff',
      '("Full Stack Engineer" OR "Backend Engineer" OR "Frontend Engineer" OR "Python Developer") AND (Fresher OR "Entry Level" OR "0-1 Year") NOT Senior NOT Lead NOT Manager',
      '("AI Engineer" OR "Generative AI Engineer" OR "LLM Engineer" OR "Prompt Engineer" OR "ML Engineer") AND (Fresher OR "Entry Level" OR "2026 Batch") NOT Senior NOT Lead',
      '("System Engineer" OR "Technology Analyst" OR "Graduate Trainee Engineer" OR "Junior Software Engineer") AND (TCS OR Accenture OR Capgemini OR Infosys OR Wipro OR HCL OR "LTI Mindtree" OR Cognizant OR EY OR IBM)'
    ];

    // India-only — single location covers all 9 tech hubs (Bangalore, Hyderabad, Chennai, Kolkata, Delhi, Gurgaon, Pune, Mumbai, Noida)
    const locList = ["India"];

    for (let l = 0; l < locList.length; l++) {
      const location = locList[l];
      for (let c = 0; c < roleClusters.length; c++) {
        const roleQuery = roleClusters[c];
        try {
          // Pause 400ms between requests to avoid rate limits
          Utilities.sleep(400);

          const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(roleQuery)}&location=${encodeURIComponent(location)}&f_TPR=r86400&f_E=1,2&start=0`;
          
          const options = {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9"
            },
            muteHttpExceptions: true
          };

          let response = UrlFetchApp.fetch(url, options);

          // Handle HTTP 429 Rate Limiting with automatic exponential backoff retry!
          if (response.getResponseCode() === 429) {
            console.warn(`⏳ LinkedIn HTTP 429 Rate Limit encountered. Backing off 2.5s before retry for "${location}"...`);
            Utilities.sleep(2500);
            response = UrlFetchApp.fetch(url, options);
          }

          if (response.getResponseCode() !== 200) {
            console.warn(`LinkedIn API warning for "${location}": HTTP ${response.getResponseCode()}`);
            continue;
          }

          const html = response.getContentText();
          const parsedJobs = this.parseLinkedInHtml(html, roleQuery);

          for (let j = 0; j < parsedJobs.length; j++) {
            const job = parsedJobs[j];
            // Pre-filter senior titles at the scraper level!
            if (!GeminiMatcher.isSeniorJob(job) && !seenSet.has(job.id)) {
              seenSet.add(job.id);
              freshJobs.push(job);
            }
          }
        } catch (err) {
          console.error(`Error querying LinkedIn for "${location}": ${err.toString()}`);
        }
      }
    }

    return freshJobs;
  },

  /**
   * HTML Parser for LinkedIn Guest HTML response
   */
  parseLinkedInHtml: function(html, searchKeyword) {
    const jobs = [];

    // Regex matchers for card elements
    const cardRegex = /<li[\s\S]*?<\/li>/g;
    const titleRegex = /<h3 class="base-search-card__title[\s\S]*?>\s*([\s\S]*?)\s*<\/h3>/;
    const companyRegex = /<h4 class="base-search-card__subtitle[\s\S]*?>\s*<a[\s\S]*?>\s*([\s\S]*?)\s*<\/a>|class="base-search-card__subtitle[\s\S]*?>\s*([\s\S]*?)\s*<\/h4>/;
    const locationRegex = /<span class="job-search-card__location[\s\S]*?>\s*([\s\S]*?)\s*<\/span>/;
    const linkRegex = /href="(https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[^"?]+)/;
    const timeRegex = /<time[^>]*?(?:datetime="([^"]*)")?[^>]*?>\s*([\s\S]*?)\s*<\/time>/i;

    const cards = html.match(cardRegex) || [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      
      const linkMatch = card.match(linkRegex);
      const titleMatch = card.match(titleRegex);

      if (linkMatch && titleMatch) {
        const rawUrl = linkMatch[1];
        const title = this.cleanText(titleMatch[1]);

        const companyMatch = card.match(companyRegex);
        const company = companyMatch ? this.cleanText(companyMatch[1] || companyMatch[2]) : "Company Confidential";

        const locMatch = card.match(locationRegex);
        const loc = locMatch ? this.cleanText(locMatch[1]) : "Remote / India";

        const timeMatch = card.match(timeRegex);
        let postedRaw = "Just Now";
        if (timeMatch) {
          const dt = timeMatch[1];
          const text = this.cleanText(timeMatch[2]);
          postedRaw = (text && (text.toLowerCase().includes("ago") || text.toLowerCase().includes("hour") || text.toLowerCase().includes("min"))) ? text : (dt || text || "Just Now");
        }

        // HARD 36-HOUR FRESHNESS FILTER: Skip any LinkedIn job older than 36 hours!
        if (!NaukriSearch.isWithin36Hours(postedRaw)) {
          continue;
        }

        const postedAgo = this.formatHoursAgo(postedRaw);

        // Extract Job ID and construct INSTANT DIRECT URL (no tracking params!)
        const idMatch = rawUrl.match(/\/view\/.*?(\d+)/) || rawUrl.match(/view\/(\d+)/);
        if (idMatch && idMatch[1]) {
          const idNum = parseInt(idMatch[1], 10);
          if (idNum < 100000) {
            continue; // Skip dummy test links like view/2
          }
        }
        const jobId = idMatch ? `linkedin_${idMatch[1]}` : `linkedin_${Math.abs(this.hashCode(rawUrl))}`;
        const cleanDirectUrl = idMatch ? `https://www.linkedin.com/jobs/view/${idMatch[1]}` : rawUrl.split("?")[0];

        jobs.push({
          id: jobId,
          title: title,
          company: company,
          location: loc,
          portal: "LinkedIn",
          url: cleanDirectUrl,
          postedAgo: postedAgo,
          searchRole: searchKeyword
        });
      }
    }

    return jobs;
  },

  formatHoursAgo: function(rawStr) {
    return NaukriSearch.formatHoursAgo(rawStr);
  },

  cleanText: function(str) {
    return ATSResolver.cleanText(str);
  },

  hashCode: function(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return h;
  }
};
