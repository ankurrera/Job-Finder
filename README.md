# 🚀 Real-Time Job Finder & AI Matcher (Google Apps Script)

An advanced real-time job acquisition engine built with **Google Apps Script** and **Gemini 2.0 Flash AI**. It monitors LinkedIn, Naukri, and Indeed for **fresh job openings posted strictly in the last 24 hours**, enforces **100% Fresher (0–2 YOE) precision filtering**, generates **AI recruiter outreach pitches**, resolves **direct official company ATS links**, and populates an **interactive Application Pipeline tracker tab**.

---

## ✨ Advanced Features

- **⏱️ 24-Hour Freshness Filter**: Uses LinkedIn's `f_TPR=r86400` parameter and Google News/Jobs RSS 1-day filters to ignore old job postings.
- **🛡️ 100% Fresher Precision Shield**: Hard-rejects senior/lead roles (`3+`, `5+` YOE, `Senior`, `Manager`, `Architect`) before AI evaluation.
- **✉️ AI Recruiter Outreach Pitch Generator**: Gemini AI drafts customized 3-4 sentence cold emails / LinkedIn DMs for hiring managers.
- **🔗 Direct ATS Portal Link Resolver**: Unwraps aggregator redirects to link directly to official company careers portals (**Workday, Greenhouse, Lever, Ashby, SmartRecruiters**).
- **📊 Interactive Application Pipeline Tracker Tab**: Auto-creates a 2nd tab in Google Sheets (`Application Pipeline`) with status dropdowns (`Applied 🟢` | `Interview 🟡` | `Assessment 🔵` | `Offer 🏆` | `Rejected 🔴`).

---

## 📁 File Overview

| File | Purpose |
| :--- | :--- |
| [`Code.gs`](Code.gs) | Main entry point, configuration settings (`TARGET_ROLES`, `LOCATIONS`), and trigger setup. |
| [`ATSResolver.gs`](ATSResolver.gs) | Direct official company ATS portal link resolver and URL sanitizer. |
| [`ApplicationTracker.gs`](ApplicationTracker.gs) | Interactive Application Pipeline tab manager with status dropdowns. |
| [`ExamDriveSearch.gs`](ExamDriveSearch.gs) | Real-time scraper for competitive exams (TCS NQT, InfyTQ) and off-campus drives. |
| [`LinkedInSearch.gs`](LinkedInSearch.gs) | Real-time scraper targeting LinkedIn Guest Jobs API (`f_TPR=r86400`). |
| [`NaukriSearch.gs`](NaukriSearch.gs) | Real-time scraper for Naukri, Indeed, Wellfound, Instahyre feeds. |
| [`GeminiMatcher.gs`](GeminiMatcher.gs) | Gemini 2.0 Flash AI relevance scoring & 100% Fresher precision filtering. |
| [`SheetNotifier.gs`](SheetNotifier.gs) | Google Sheets dashboard generator with pastel status formatting. |

---

## ⚙️ Quick Setup Guide

1. Open [Google Apps Script](https://script.google.com) and create a new project named **`realtime-job-finder`**.
2. Copy all `.gs` files into the Apps Script editor.
3. Open `Code.gs` and insert your Gemini API Key:
   ```javascript
   const CONFIG = {
     GEMINI_API_KEY: "YOUR_GEMINI_API_KEY", // Get free key from Google AI Studio
     MIN_MATCH_SCORE: 70
   };
   ```
4. Click **Run** on `recreateSheetDashboard` to initialize the 2-tab layout.
5. Click **Run** on `findRealtimeJobs` to execute a manual job search pass!
6. Click **Run** on `setupHourlyJobTrigger` to enable automated hourly job monitoring.
