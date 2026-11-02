-- APPLY ONLY AFTER the website version that serves Practice through /api/practice is live.
-- Before that, the old site reads practice_listening and the audio bucket directly.
-- 1) Browsers can no longer read listening sets directly; the server (service role) serves them.
drop policy if exists "read live or review listening sets" on public.practice_listening;
revoke select on public.practice_listening from anon, authenticated;
-- 2) Audio is no longer public: the server hands out 3-hour signed links.
update storage.buckets set public = false where id = 'practice-audio';
