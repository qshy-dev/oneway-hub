BEGIN;
INSERT INTO auth.users(id, email) VALUES('00000000-0000-0000-0000-00000000a111','analytics-test@example.invalid');
INSERT INTO public.profiles(id,twitch_id,twitch_username) VALUES('00000000-0000-0000-0000-00000000a111','test-id','analytics_test') ON CONFLICT(id) DO NOTHING;
SELECT public.record_channel_sample('00000000-0000-0000-0000-00000000a111', jsonb_build_object('id','test-stream','started_at',now() - interval '1 hour','viewer_count',20,'title','test'));
SELECT public.record_channel_sample('00000000-0000-0000-0000-00000000a111', jsonb_build_object('id','test-stream','started_at',now() - interval '1 hour','viewer_count',20,'title','test'));
SELECT public.record_bot_message('test-message','00000000-0000-0000-0000-00000000a111','analytics_test','chatter1','Test','hello');
SELECT public.record_bot_message('test-message','00000000-0000-0000-0000-00000000a111','analytics_test','chatter1','Test','hello');
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_twitch_channel_stats_30d('00000000-0000-0000-0000-00000000a111');
  IF s.streams_30d <> 1 OR s.avg_viewers_30d <> 20 OR s.peak_viewers_30d <> 20 THEN RAISE EXCEPTION 'Incorrect viewer aggregation'; END IF;
  IF s.messages_30d <> 1 OR s.chatters_30d <> 1 THEN RAISE EXCEPTION 'Chat deduplication failed'; END IF;
  IF (SELECT count(*) FROM twitch_viewer_samples WHERE user_id = '00000000-0000-0000-0000-00000000a111') <> 1 THEN RAISE EXCEPTION 'Sample duplicated'; END IF;
  IF has_table_privilege('authenticated','bot_config','SELECT') THEN RAISE EXCEPTION 'Bot credentials exposed'; END IF;
  IF has_function_privilege('anon','record_channel_sample(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous sample writes allowed'; END IF;
  IF NOT acquire_bot_lease('test-worker-1') OR acquire_bot_lease('test-worker-2') THEN RAISE EXCEPTION 'Worker lease is not exclusive'; END IF;
END $$;
ROLLBACK;
