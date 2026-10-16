# Job Finder

The job feed uses a JSON snapshot, with no database. It refreshes daily and shows
only USA listings with a valid source date in the past **48 hours**. Undated,
invalid, future-dated, and older listings are excluded. The API checks the window
on every request so listings expire between refreshes.

## Run locally

Use Node.js 22, run `npm ci`, then `npm run fetch-jobs` to refresh
`data/jobs-snapshot.json`. Run `npm run dev` to view the app. For local development, a missing snapshot or
one older than 25 hours triggers a refresh when the jobs API is requested.
An all-source empty result fails without overwriting the previous snapshot.
Companies are retained when their board returns no listings.

## Daily automation

The **Fetch latest jobs daily** GitHub Actions workflow runs daily at **8:00 AM
America/New_York** (Eastern time, automatically adjusting for daylight saving)
and supports **Run workflow**. Push these changes to the
repository's default branch to activate the updated workflow. Actions must be
enabled and allowed to push to that branch. Fetch and push failures are reported
as workflow failures.

The workflow commits only the refreshed JSON snapshot. With a Vercel Git
integration deploying that branch, each data commit triggers a deployment that
bundles the latest snapshot. Each Vercel instance reads the bundled snapshot; the GitHub workflow supplies
the durable daily data.

## Daily AI summaries on GitHub Actions

After fetching jobs, the daily workflow installs Ollama, starts it on port 11435,
loads `qwen2.5:3b`, and runs `npm run enrich-jobs`. Model weights are cached between
runs. The model processes public job details only; uploaded resumes stay out of
GitHub Actions and the saved snapshot.

Enrichment prioritizes the newest jobs, with a default cap of 100 new summaries
and eight minutes per run. Remaining jobs still appear normally without a
summary. Existing summaries carry forward when the source text is unchanged.
Set `JOB_AI_LIMIT` and `JOB_AI_BUDGET_MS` in the workflow to adjust coverage.
Model setup and generation failures do not block publication of fresh listings.

Vercel serves the saved snapshot and applies the rolling 48-hour filter on every
request. It does not run Ollama or fetch all job boards. The Vercel cron and
manual refresh button have been removed. Job cards display saved **AI job
summaries** rather than an on-demand personalized answer. Resume upload and
browser-side match scoring still work.

Push these changes to your GitHub default branch, then run **Fetch latest jobs
daily** from the repository's Actions tab once. With the Vercel Git integration
connected to that branch, the resulting snapshot commit triggers deployment.

## Optional local model service

The existing dedicated local service remains usable for development:

- `npm run llm:install`: install the macOS launch agent on port 11435.
- `npm run llm:start`: start a separate Ollama process in your terminal.
- `npm run llm:pull`: pull the model into `ollama_models/` through port 11435.
- `npm run fetch-jobs`: refresh the local snapshot.
- `npm run enrich-jobs`: add summaries using the default localhost endpoint.

Copy `.env.example` to `.env.local` for local configuration. The CLI enrichment
script uses exported environment variables; use
`node --env-file=.env.local --import tsx scripts/enrich-jobs.ts` to load that file
explicitly. `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, and optional
`LOCAL_LLM_API_KEY` configure the compatible API. The local fit-answer API is
retained for development; it is disabled on Vercel and is no longer called by
job cards.

The macOS service uses `OLLAMA_HOST=127.0.0.1:11435` and a dedicated
`OLLAMA_MODELS` directory, with cloud inference disabled. Its launch agent is
`~/Library/LaunchAgents/com.jobfinder.ollama.plist`. Stop it with
`launchctl bootout gui/$(id -u)/com.jobfinder.ollama` if no longer needed.

Greenhouse supplies `updated_at`, an update timestamp rather than a guaranteed
original posting date. Lever supplies its creation timestamp. The feed's window
uses those source timestamps and never treats collection time as posting time.
