Creator Command Center - Smart Snapshot Patch

Copy app/api/youtube/snapshot/route.ts to the same location in your Next.js project.
Copy .github/workflows/smart-snapshot.yml to the same location in your project.

In GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret:
Name: CRON_SECRET
Value: EXACT SAME secret as CRON_SECRET in Vercel production environment variables.
Do not paste the value into code, Git commits, or chat.

Push changes, wait for Vercel deployment, then in GitHub -> Actions -> Smart YouTube Daily Snapshot -> Run workflow.

Behavior: UTC scheduled checks correspond to 06:00–11:45 IST, every 15 minutes.
The API refuses collection outside 06:00–12:00 IST. Existing successful rows are skipped.
Each run still calls Vercel, but completed channels do not trigger YouTube API requests.
This does not wait for YouTube Analytics revenue; it only stores YouTube Data API channel statistics.
First snapshot each day may be captured as early as 06:00 IST; for a consistent 09:00-to-09:00 comparison, change the collection window/strategy before deploying.
GitHub Actions schedules may be delayed or skipped at busy times.
