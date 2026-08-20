// ======================================================================
// LINKEDIN REAL-TIME JOB SCRAPER (PAST 24 HOURS ONLY - FRESHERS FILTER)
// Uses LinkedIn Guest Jobs API with f_TPR=r86400 (86,400 seconds = 24h)
// ======================================================================

const LinkedInSearch = {
  /**
   * Fetches job postings from LinkedIn published in the last 24 hours.
   */
  fetchJobs: function(targetRoles, locations, seenJobIds) {
    const freshJobs = [];
    const seenSet = new Set(seenJobIds);

    const roleClusters = [
      '("Software Engineer" OR "Associate Software Engineer" OR "Software Developer" OR "SDE") AND (Fresher OR "Entry Level" OR "2026 Batch" OR "Graduate Trainee") NOT Senior NOT Lead NOT Manager NOT Architect NOT Staff',
      '("Full Stack Engineer" OR "Backend Engineer" OR "Frontend Engineer" OR "Python Developer") AND (Fresher OR "Entry Level" OR "0-1 Year") NOT Senior NOT Lead NOT Manager',
      '("AI Engineer" OR "Generative AI Engineer" OR "LLM Engineer" OR "Prompt Engineer" OR "ML Engineer") AND (Fresher OR "Entry Level" OR "2026 Batch") NOT Senior NOT Lead',
      '("System Engineer" OR "Technology Analyst" OR "Graduate Trainee Engineer" OR "Junior Software Engineer") AND (TCS OR Accenture OR Capgemini OR Infosys OR Wipro OR HCL OR "LTI Mindtree" OR Cognizant OR EY OR IBM)'
    ];

    const locList = ["India"];

    for (let l = 0; l < locList.length; l++) {
      const location = locList[l];
      for (let c = 0; c < roleClusters.length; c++) {
        const roleQuery = roleClusters[c];
        try {
          Utilities.sleep(400);

          const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(roleQuery)}&location=${encodeURIComponent(location)}&f_TPR=r86400&f_E=1,2&start=0`;
          
          const options = {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
              "Accept-Language": "en-US,en;q=0.9"
            },
            muteHttpExceptions: true
          };

          let response = UrlFetchApp.fetch(url, options);

          if (response.getResponseCode() === 429) {
            console.warn(`⏳ LinkedIn HTTP 429 Rate Limit encountered. Retrying for "${location}"...`);
            Utilities.sleep(2500);
            response = UrlFetchApp.fetch(url, options);
          }

          if (response.getResponseCode() !== 200) {
            console.warn(`LinkedIn API warning for "${location}": HTTP ${response.getResponseCode()}`);
            continue;
          }

          const html = response.getContentText();
          const parsedJobs = this.parseHtml(html, roleQuery);

          for (let j = 0; j < parsedJobs.length; j++) {
            const job = parsedJobs[j];
            if (!GeminiMatcher.isSeniorRole(job) && !seenSet.has(job.id)) {
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
  parseHtml: function(html, searchKeyword) {
    const jobs = [];
    const cards = html.match(/<li[\s\S]*?<\/li>/g) || [];

    const titleRegex = /<h3 class="base-search-card__title[\s\S]*?>\s*([\s\S]*?)\s*<\/h3>/;
    const companyRegex = /<h4 class="base-search-card__subtitle[\s\S]*?>\s*<a[\s\S]*?>\s*([\s\S]*?)\s*<\/a>|class="base-search-card__subtitle[\s\S]*?>\s*([\s\S]*?)\s*<\/h4>/;
    const locationRegex = /<span class="job-search-card__location[\s\S]*?>\s*([\s\S]*?)\s*<\/span>/;
    const linkRegex = /href="(https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[^"?]+)/;
    const timeRegex = /<time[^>]*?(?:datetime="([^"]*)")?[^>]*?>\s*([\s\S]*?)\s*<\/time>/i;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const linkMatch = card.match(linkRegex);
      const titleMatch = card.match(titleRegex);

      if (linkMatch && titleMatch) {
        const rawUrl = linkMatch[1];
        const title = ATSResolver.cleanText(titleMatch[1]);

        const companyMatch = card.match(companyRegex);
        const company = companyMatch ? ATSResolver.cleanText(companyMatch[1] || companyMatch[2]) : "Company Confidential";

        const locMatch = card.match(locationRegex);
        const loc = locMatch ? ATSResolver.cleanText(locMatch[1]) : "Remote / India";

        const timeMatch = card.match(timeRegex);
        let postedRaw = "Just Now";
        if (timeMatch) {
          const dt = timeMatch[1];
          const text = ATSResolver.cleanText(timeMatch[2]);
          postedRaw = (text && (text.toLowerCase().includes("ago") || text.toLowerCase().includes("hour") || text.toLowerCase().includes("min"))) ? text : (dt || text || "Just Now");
        }

        if (!NaukriSearch.isRecent(postedRaw)) {
          continue;
        }

        const postedAgo = NaukriSearch.formatRelativeTime(postedRaw);

        const idMatch = rawUrl.match(/\/view\/.*?(\d+)/) || rawUrl.match(/view\/(\d+)/);
        if (idMatch && idMatch[1] && parseInt(idMatch[1], 10) < 100000) {
          continue;
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

  hashCode: function(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return h;
  }
};

