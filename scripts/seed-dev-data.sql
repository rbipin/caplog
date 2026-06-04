-- Seed script: 3 months of realistic CapLog dev data
-- Run with: sqlite3 ~/Library/Application\ Support/com.bipin.caplog/caplog.db < scripts/seed-dev-data.sql

DELETE FROM log_entries;
DELETE FROM todos;

-- ─── MARCH 2026 ───────────────────────────────────────────────────────────────

INSERT INTO log_entries (date, raw_text, formatted_text, created_at) VALUES
('2026-03-03', 'Kicked off the new sprint. Reviewed backlog and assigned tickets for the auth refactor.', '<p>Kicked off the new sprint. Reviewed backlog and assigned tickets for the auth refactor.</p>', '2026-03-03T09:15:00Z'),
('2026-03-03', 'Had a long sync with design on the onboarding flow. Three rounds of feedback but we landed on a direction.', '<p>Had a long sync with design on the onboarding flow. Three rounds of feedback but we landed on a direction.</p>', '2026-03-03T14:30:00Z'),
('2026-03-04', 'Started implementing JWT refresh token rotation. Hit a snag with clock skew on the test servers.', '<p>Started implementing JWT refresh token rotation. Hit a snag with clock skew on the test servers.</p>', '2026-03-04T10:00:00Z'),
('2026-03-04', 'Fixed the clock skew issue — was an NTP drift on ci-runner-02. Tests now green.', '<p>Fixed the clock skew issue — was an NTP drift on ci-runner-02. Tests now green.</p>', '2026-03-04T16:45:00Z'),
('2026-03-05', 'Code review for Maya''s PR on the rate limiter. Left comments on the sliding window implementation.', '<p>Code review for Maya''s PR on the rate limiter. Left comments on the sliding window implementation.</p>', '2026-03-05T11:00:00Z'),
('2026-03-06', 'Wrote unit tests for token rotation edge cases. 18 tests, all passing.', '<p>Wrote unit tests for token rotation edge cases. 18 tests, all passing.</p>', '2026-03-06T09:30:00Z'),
('2026-03-06', 'Quick call with infra about the Redis upgrade path. Targeting end of month for the migration.', '<p>Quick call with infra about the Redis upgrade path. Targeting end of month for the migration.</p>', '2026-03-06T15:00:00Z'),
('2026-03-09', 'Back from the weekend. Caught up on Slack. Nothing critical.', '<p>Back from the weekend. Caught up on Slack. Nothing critical.</p>', '2026-03-09T09:00:00Z'),
('2026-03-09', 'Merged the auth refactor after addressing review comments. Deployed to staging.', '<p>Merged the auth refactor after addressing review comments. Deployed to staging.</p>', '2026-03-09T17:00:00Z'),
('2026-03-10', 'Pair programmed with Kenji on the dashboard query optimisation. Dropped p99 latency from 800ms to 120ms.', '<p>Pair programmed with Kenji on the dashboard query optimisation. Dropped p99 latency from 800ms to 120ms.</p>', '2026-03-10T14:00:00Z'),
('2026-03-11', 'Investigated a memory leak in the worker pool. Traced it to unclosed DB connections in the retry path.', '<p>Investigated a memory leak in the worker pool. Traced it to unclosed DB connections in the retry path.</p>', '2026-03-11T10:30:00Z'),
('2026-03-11', 'Fixed the connection leak. Added a finally block and integration test to prevent regression.', '<p>Fixed the connection leak. Added a finally block and integration test to prevent regression.</p>', '2026-03-11T16:00:00Z'),
('2026-03-12', 'Wrote a tech spec for the file upload service. Shared with the team for async review.', '<p>Wrote a tech spec for the file upload service. Shared with the team for async review.</p>', '2026-03-12T11:00:00Z'),
('2026-03-13', 'Sprint retrospective. Main theme: more async review, fewer sync standups.', '<p>Sprint retrospective. Main theme: more async review, fewer sync standups.</p>', '2026-03-13T15:30:00Z'),
('2026-03-16', 'Started on the file upload service. Set up S3 bucket structure and presigned URL generation.', '<p>Started on the file upload service. Set up S3 bucket structure and presigned URL generation.</p>', '2026-03-16T10:00:00Z'),
('2026-03-17', 'Implemented multipart upload with resumable chunks. Works end-to-end in dev.', '<p>Implemented multipart upload with resumable chunks. Works end-to-end in dev.</p>', '2026-03-17T16:30:00Z'),
('2026-03-18', 'Debugging a CORS issue with the upload endpoint on Safari. Turns out Safari sends an extra preflight for PUT.', '<p>Debugging a CORS issue with the upload endpoint on Safari. Turns out Safari sends an extra preflight for PUT.</p>', '2026-03-18T11:00:00Z'),
('2026-03-19', 'Fixed CORS. Added integration test for Safari-style preflight. PR open.', '<p>Fixed CORS. Added integration test for Safari-style preflight. PR open.</p>', '2026-03-19T14:00:00Z'),
('2026-03-20', 'Reviewed three PRs. Onboarding session with new team member Priya.', '<p>Reviewed three PRs. Onboarding session with new team member Priya.</p>', '2026-03-20T15:00:00Z'),
('2026-03-23', 'Sprint planning for next sprint. Focused on the notification system.', '<p>Sprint planning for next sprint. Focused on the notification system.</p>', '2026-03-23T10:00:00Z'),
('2026-03-24', 'Started notification service scaffolding. Using a fanout queue pattern.', '<p>Started notification service scaffolding. Using a fanout queue pattern.</p>', '2026-03-24T11:00:00Z'),
('2026-03-25', 'Wrote the email notification adapter. Hooked into SendGrid. Basic templates done.', '<p>Wrote the email notification adapter. Hooked into SendGrid. Basic templates done.</p>', '2026-03-25T14:00:00Z'),
('2026-03-26', 'Push notification adapter done. Had to wrestle with APNs cert renewal.', '<p>Push notification adapter done. Had to wrestle with APNs cert renewal.</p>', '2026-03-26T16:00:00Z'),
('2026-03-27', 'End of month retrospective. Good sprint — shipped file upload and notifications MVP.', '<p>End of month retrospective. Good sprint — shipped file upload and notifications MVP.</p>', '2026-03-27T17:00:00Z'),

-- ─── APRIL 2026 ──────────────────────────────────────────────────────────────

('2026-04-01', 'Q2 kickoff. New goals: performance, observability, and the mobile beta.', '<p>Q2 kickoff. New goals: performance, observability, and the mobile beta.</p>', '2026-04-01T09:30:00Z'),
('2026-04-02', 'Set up OpenTelemetry tracing. Spans flowing into Honeycomb.', '<p>Set up OpenTelemetry tracing. Spans flowing into Honeycomb.</p>', '2026-04-02T15:00:00Z'),
('2026-04-03', 'Instrumented the critical path with custom spans. Identified three slow DB queries immediately.', '<p>Instrumented the critical path with custom spans. Identified three slow DB queries immediately.</p>', '2026-04-03T11:00:00Z'),
('2026-04-06', 'Added missing indexes for the three slow queries. p99 on the feed endpoint dropped by 60%.', '<p>Added missing indexes for the three slow queries. p99 on the feed endpoint dropped by 60%.</p>', '2026-04-06T14:00:00Z'),
('2026-04-07', 'Architecture review with the mobile team. Agreed on REST for now, GraphQL later if needed.', '<p>Architecture review with the mobile team. Agreed on REST for now, GraphQL later if needed.</p>', '2026-04-07T10:00:00Z'),
('2026-04-08', 'Wrote the mobile API versioning strategy doc. V1 endpoints frozen, V2 in progress.', '<p>Wrote the mobile API versioning strategy doc. V1 endpoints frozen, V2 in progress.</p>', '2026-04-08T15:30:00Z'),
('2026-04-09', 'Fixed a pagination bug — off-by-one on cursor. Was returning duplicate items at page boundaries.', '<p>Fixed a pagination bug — off-by-one on cursor. Was returning duplicate items at page boundaries.</p>', '2026-04-09T13:00:00Z'),
('2026-04-10', 'Sprint review. Demoed OTel dashboard to stakeholders. Good reception.', '<p>Sprint review. Demoed OTel dashboard to stakeholders. Good reception.</p>', '2026-04-10T16:00:00Z'),
('2026-04-13', 'Started the background job scheduler rewrite. The cron-based approach has been painful.', '<p>Started the background job scheduler rewrite. The cron-based approach has been painful.</p>', '2026-04-13T10:00:00Z'),
('2026-04-14', 'New scheduler uses a priority queue with at-least-once delivery. Basic tests passing.', '<p>New scheduler uses a priority queue with at-least-once delivery. Basic tests passing.</p>', '2026-04-14T15:00:00Z'),
('2026-04-15', 'Chaos testing the scheduler — killed workers mid-job. Recovery works correctly.', '<p>Chaos testing the scheduler — killed workers mid-job. Recovery works correctly.</p>', '2026-04-15T11:00:00Z'),
('2026-04-16', 'Code review day. Reviewed four PRs. Suggested breaking up a 900-line file.', '<p>Code review day. Reviewed four PRs. Suggested breaking up a 900-line file.</p>', '2026-04-16T14:00:00Z'),
('2026-04-17', 'Spent the day on documentation. Updated the architecture diagram and ADR backlog.', '<p>Spent the day on documentation. Updated the architecture diagram and ADR backlog.</p>', '2026-04-17T16:00:00Z'),
('2026-04-20', 'Merged the scheduler rewrite. Monitoring in prod — job latency down 40%.', '<p>Merged the scheduler rewrite. Monitoring in prod — job latency down 40%.</p>', '2026-04-20T17:00:00Z'),
('2026-04-21', 'One-on-one with my manager. Discussed the path to staff eng. Good conversation.', '<p>One-on-one with my manager. Discussed the path to staff eng. Good conversation.</p>', '2026-04-21T14:00:00Z'),
('2026-04-22', 'Started the mobile auth flow — device-bound keys using the Secure Enclave on iOS.', '<p>Started the mobile auth flow — device-bound keys using the Secure Enclave on iOS.</p>', '2026-04-22T10:00:00Z'),
('2026-04-23', 'iOS Secure Enclave integration working. Android Keystore next.', '<p>iOS Secure Enclave integration working. Android Keystore next.</p>', '2026-04-23T15:00:00Z'),
('2026-04-24', 'Android Keystore integration done. Wrote the server-side key attestation verifier.', '<p>Android Keystore integration done. Wrote the server-side key attestation verifier.</p>', '2026-04-24T16:30:00Z'),
('2026-04-27', 'Security review of the mobile auth flow with the security team. Two minor findings, both fixed same day.', '<p>Security review of the mobile auth flow with the security team. Two minor findings, both fixed same day.</p>', '2026-04-27T11:00:00Z'),
('2026-04-28', 'Sprint retrospective. Team morale high. Main concern: test suite is slow (8 min).', '<p>Sprint retrospective. Team morale high. Main concern: test suite is slow (8 min).</p>', '2026-04-28T15:00:00Z'),
('2026-04-29', 'Profiled the test suite. 70% of time is integration tests waiting on DB. Parallelising.', '<p>Profiled the test suite. 70% of time is integration tests waiting on DB. Parallelising.</p>', '2026-04-29T14:00:00Z'),
('2026-04-30', 'Test suite parallelisation done. Down from 8 min to 2.5 min. Team is happy.', '<p>Test suite parallelisation done. Down from 8 min to 2.5 min. Team is happy.</p>', '2026-04-30T17:00:00Z'),

-- ─── MAY 2026 ────────────────────────────────────────────────────────────────

('2026-05-01', 'May starts. Planning the mobile beta release. Target: May 30.', '<p>May starts. Planning the mobile beta release. Target: May 30.</p>', '2026-05-01T09:00:00Z'),
('2026-05-04', 'Started the mobile onboarding screens. Figma handoff was clean.', '<p>Started the mobile onboarding screens. Figma handoff was clean.</p>', '2026-05-04T10:00:00Z'),
('2026-05-05', 'Onboarding done. Integrated analytics events for funnel tracking.', '<p>Onboarding done. Integrated analytics events for funnel tracking.</p>', '2026-05-05T15:00:00Z'),
('2026-05-06', 'Deep dive into the mobile offline-first sync strategy. Settled on event sourcing with conflict resolution.', '<p>Deep dive into the mobile offline-first sync strategy. Settled on event sourcing with conflict resolution.</p>', '2026-05-06T11:00:00Z'),
('2026-05-07', 'Implemented the local event store with SQLite on mobile. Sync queue working.', '<p>Implemented the local event store with SQLite on mobile. Sync queue working.</p>', '2026-05-07T16:00:00Z'),
('2026-05-08', 'Conflict resolution tests. Last-write-wins for most types, manual merge for documents.', '<p>Conflict resolution tests. Last-write-wins for most types, manual merge for documents.</p>', '2026-05-08T14:00:00Z'),
('2026-05-11', 'Week 3 of mobile work. Starting to feel the pressure of the May 30 deadline.', '<p>Week 3 of mobile work. Starting to feel the pressure of the May 30 deadline.</p>', '2026-05-11T09:00:00Z'),
('2026-05-12', 'Implemented push notification deep links for iOS and Android.', '<p>Implemented push notification deep links for iOS and Android.</p>', '2026-05-12T15:00:00Z'),
('2026-05-13', 'Fixed a crash on Android 12 — was related to the new photo picker API.', '<p>Fixed a crash on Android 12 — was related to the new photo picker API.</p>', '2026-05-13T11:00:00Z'),
('2026-05-14', 'Internal beta to 20 people. First round of feedback: onboarding is confusing.', '<p>Internal beta to 20 people. First round of feedback: onboarding is confusing.</p>', '2026-05-14T17:00:00Z'),
('2026-05-15', 'Redesigned the onboarding based on feedback. Reduced from 6 steps to 3.', '<p>Redesigned the onboarding based on feedback. Reduced from 6 steps to 3.</p>', '2026-05-15T16:00:00Z'),
('2026-05-18', 'Second internal beta. Feedback much better. Onboarding completion up from 60% to 91%.', '<p>Second internal beta. Feedback much better. Onboarding completion up from 60% to 91%.</p>', '2026-05-18T14:00:00Z'),
('2026-05-19', 'Fixed five more bugs from the beta feedback. Mostly edge cases in the sync logic.', '<p>Fixed five more bugs from the beta feedback. Mostly edge cases in the sync logic.</p>', '2026-05-19T15:00:00Z'),
('2026-05-20', 'Performance profiling on Android. Found a main-thread DB read causing jank on scroll.', '<p>Performance profiling on Android. Found a main-thread DB read causing jank on scroll.</p>', '2026-05-20T11:00:00Z'),
('2026-05-21', 'Moved DB reads off the main thread. 60fps on scroll now.', '<p>Moved DB reads off the main thread. 60fps on scroll now.</p>', '2026-05-21T14:00:00Z'),
('2026-05-22', 'Final security scan before beta. One medium finding: token not cleared on logout. Fixed.', '<p>Final security scan before beta. One medium finding: token not cleared on logout. Fixed.</p>', '2026-05-22T16:00:00Z'),
('2026-05-25', 'App store submission prep. Screenshots, descriptions, age ratings.', '<p>App store submission prep. Screenshots, descriptions, age ratings.</p>', '2026-05-25T10:00:00Z'),
('2026-05-26', 'Submitted to App Store. Android APK uploaded to Play Console for review.', '<p>Submitted to App Store. Android APK uploaded to Play Console for review.</p>', '2026-05-26T15:00:00Z'),
('2026-05-27', 'Apple review in progress. Working on post-launch monitoring dashboards in the meantime.', '<p>Apple review in progress. Working on post-launch monitoring dashboards in the meantime.</p>', '2026-05-27T11:00:00Z'),
('2026-05-28', 'App Store approved! Play Store approved! Beta goes live tomorrow.', '<p>App Store approved! Play Store approved! Beta goes live tomorrow.</p>', '2026-05-28T16:00:00Z'),
('2026-05-29', 'Beta is live. 143 installs in the first hour. Monitoring dashboards looking healthy.', '<p>Beta is live. 143 installs in the first hour. Monitoring dashboards looking healthy.</p>', '2026-05-29T18:00:00Z'),
('2026-05-30', 'Post-launch day. Triaged 12 crash reports — 10 are the same root cause on Android 13. Fix in progress.', '<p>Post-launch day. Triaged 12 crash reports — 10 are the same root cause on Android 13. Fix in progress.</p>', '2026-05-30T17:00:00Z');

-- ─── TODOS ───────────────────────────────────────────────────────────────────

INSERT INTO todos (text, is_important, is_completed, deadline, created_at, completed_at) VALUES
-- Completed todos
('Write ADR for JWT refresh token rotation', 0, 1, NULL, '2026-03-04T10:00:00Z', '2026-03-06T09:30:00Z'),
('Fix clock skew on ci-runner-02', 1, 1, '2026-03-05T00:00:00Z', '2026-03-04T10:00:00Z', '2026-03-04T16:45:00Z'),
('Migrate Redis to v7', 0, 1, '2026-03-31T00:00:00Z', '2026-03-06T15:00:00Z', '2026-03-28T14:00:00Z'),
('Ship file upload service MVP', 1, 1, '2026-03-25T00:00:00Z', '2026-03-16T10:00:00Z', '2026-03-19T14:00:00Z'),
('Instrument critical path with OTel spans', 0, 1, NULL, '2026-04-02T15:00:00Z', '2026-04-03T11:00:00Z'),
('Fix pagination off-by-one bug', 1, 1, '2026-04-10T00:00:00Z', '2026-04-09T09:00:00Z', '2026-04-09T13:00:00Z'),
('Rewrite background job scheduler', 1, 1, '2026-04-20T00:00:00Z', '2026-04-13T10:00:00Z', '2026-04-20T17:00:00Z'),
('Parallelise test suite', 0, 1, NULL, '2026-04-29T09:00:00Z', '2026-04-30T17:00:00Z'),
('Mobile beta launch', 1, 1, '2026-05-30T00:00:00Z', '2026-05-01T09:00:00Z', '2026-05-29T18:00:00Z'),
('Fix token not cleared on logout', 1, 1, '2026-05-23T00:00:00Z', '2026-05-22T10:00:00Z', '2026-05-22T16:00:00Z'),

-- Open / in-progress todos
('Fix Android 13 crash (10 reports post-beta)', 1, 0, '2026-06-05T00:00:00Z', '2026-05-30T17:00:00Z', NULL),
('Write post-mortem for Android 13 crash', 0, 0, '2026-06-07T00:00:00Z', '2026-05-30T17:00:00Z', NULL),
('Set up error rate alerting in Honeycomb', 0, 0, NULL, '2026-05-27T11:00:00Z', NULL),
('Document the offline sync conflict resolution strategy', 0, 0, NULL, '2026-05-06T11:00:00Z', NULL),
('Update architecture diagram with mobile components', 0, 0, NULL, '2026-05-11T09:00:00Z', NULL),
('Investigate memory growth on iOS after 24h', 1, 0, '2026-06-10T00:00:00Z', '2026-05-29T18:00:00Z', NULL),
('Review Priya''s PR for the search service', 0, 0, '2026-06-06T00:00:00Z', '2026-06-03T09:00:00Z', NULL),
('Plan Q2 end-of-quarter retrospective', 0, 0, '2026-06-15T00:00:00Z', '2026-06-01T09:00:00Z', NULL);
