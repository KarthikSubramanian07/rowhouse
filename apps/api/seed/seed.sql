-- Rowhouse demo seed. Idempotent-ish (INSERT OR IGNORE). Run:
--   wrangler d1 execute rowhouse --local --file=./seed/seed.sql
-- Populates the film canon plus a few creators, tracks, reactions, and chapters.

-- Creators
INSERT OR IGNORE INTO users (id, email, display_name, handle, avatar_url, is_creator, pro) VALUES
  ('usr_frame',   'frame@rowhouse.local',   'The Frame',      'theframe',  NULL, 1, 1),
  ('usr_close',   'close@rowhouse.local',   'Close Read',     'closeread', NULL, 1, 0),
  ('usr_reel',    'reel@rowhouse.local',    'Reel Talk',      'reeltalk',  NULL, 1, 0);

INSERT OR IGNORE INTO creators (user_id, bio, tone, follower_count) VALUES
  ('usr_frame', 'Shot-by-shot obsessive. I pause a lot. Live commentary for people who rewind.', 'analytical', 4820),
  ('usr_close', 'Close readings of horror and the uncanny. Dark, funny, occasionally unhinged.', 'chaotic', 2140),
  ('usr_reel',  'Emotional support for devastating third acts. Bring tissues.', 'emotional', 980);

-- Films. Mirror the curated catalog so film pages and discovery resolve.
INSERT OR IGNORE INTO films (slug, tmdb_id, media_type, title, year, overview, poster_path, backdrop_path, director, runtime_minutes, season, episode, genres) VALUES
  ('mulholland-drive', 1018, 'movie', 'Mulholland Drive', 2001, 'A bright-eyed actress and an amnesiac collide in a Los Angeles that keeps folding in on itself.', NULL, NULL, 'David Lynch', 147, NULL, NULL, '["Mystery","Drama","Thriller"]'),
  ('hereditary', 493922, 'movie', 'Hereditary', 2018, 'After the family matriarch dies, grief curdles into something older and more deliberate.', NULL, NULL, 'Ari Aster', 127, NULL, NULL, '["Horror","Drama","Mystery"]'),
  ('parasite', 496243, 'movie', 'Parasite', 2019, 'One family schemes its way into another, and the basement remembers.', NULL, NULL, 'Bong Joon-ho', 132, NULL, NULL, '["Comedy","Thriller","Drama"]'),
  ('there-will-be-blood', 843, 'movie', 'There Will Be Blood', 2007, 'Oil, faith, and a milkshake. Daniel Plainview drills straight down into the American soul.', NULL, NULL, 'Paul Thomas Anderson', 158, NULL, NULL, '["Drama"]'),
  ('2001-a-space-odyssey', 62, 'movie', '2001: A Space Odyssey', 1968, 'From a bone thrown into the air to a star-child watching Earth.', NULL, NULL, 'Stanley Kubrick', 149, NULL, NULL, '["Science Fiction","Adventure"]'),
  ('in-the-mood-for-love', 843906, 'movie', 'In the Mood for Love', 2000, 'Two neighbors rehearse a love they refuse to have. Longing as architecture.', NULL, NULL, 'Wong Kar-wai', 98, NULL, NULL, '["Drama","Romance"]'),
  ('the-shining', 694, 'movie', 'The Shining', 1980, 'A writer, a hotel, and a winter with no exits.', NULL, NULL, 'Stanley Kubrick', 146, NULL, NULL, '["Horror","Thriller"]'),
  ('no-country-for-old-men', 6977, 'movie', 'No Country for Old Men', 2007, 'A hunter finds money in the desert and a force of nature comes to collect.', NULL, NULL, 'Joel & Ethan Coen', 122, NULL, NULL, '["Crime","Drama","Thriller"]'),
  ('the-sopranos-s06e21', 1398, 'tv', 'The Sopranos', 2007, 'Made in America. Onion rings, a bell over the door, and the cut to black.', NULL, NULL, 'David Chase', 55, 6, 21, '["Drama","Crime"]'),
  ('twin-peaks-s01e01', 1405, 'tv', 'Twin Peaks', 1990, 'Who killed Laura Palmer? The question was always a doorway.', NULL, NULL, 'David Lynch & Mark Frost', 48, 1, 1, '["Drama","Mystery"]'),
  ('frankenstein', 900001, 'audiobook', 'Frankenstein', 1818, 'Mary Shelley''s novel of ambition and the creature it abandons. The public-domain recording is easy to sync and hard to stop talking about.', NULL, NULL, 'Mary Shelley', 512, NULL, NULL, '["Gothic","Horror","Classic"]'),
  ('the-adventures-of-sherlock-holmes', 900002, 'audiobook', 'The Adventures of Sherlock Holmes', 1892, 'Arthur Conan Doyle''s twelve stories, public domain and endlessly narrated. Built for a story-by-story commentary.', NULL, NULL, 'Arthur Conan Doyle', 700, NULL, NULL, '["Mystery","Classic"]');

-- Tracks
INSERT OR IGNORE INTO tracks (id, kind, film_slug, creator_id, title, audio_key, fingerprint_key, duration_seconds, platform, tone, spoiler_safe, listen_count, completion_count, live_session_id) VALUES
  ('trk_md_frame', 'commentary', 'mulholland-drive', 'usr_frame', 'Every loop in Mulholland Drive, in order', 'audio/trk_md_frame.bin', NULL, 8820, 'HBO Max', 'analytical', 0, 12840, 9630, 'lvs_seed_md'),
  ('trk_md_close', 'commentary', 'mulholland-drive', 'usr_close', 'The diner scene will end you', 'audio/trk_md_close.bin', NULL, 1620, 'Blu-ray', 'chaotic', 0, 5210, 4100, NULL),
  ('trk_her_close', 'commentary', 'hereditary', 'usr_close', 'Hereditary: the model house is the movie', 'audio/trk_her_close.bin', NULL, 7620, 'Netflix', 'chaotic', 0, 9870, 7100, 'lvs_seed_her'),
  ('trk_par_frame', 'commentary', 'parasite', 'usr_frame', 'Parasite is a staircase: a shot-by-shot', 'audio/trk_par_frame.bin', NULL, 7920, 'Hulu', 'analytical', 1, 15230, 12010, NULL),
  ('trk_twbb_reel', 'commentary', 'there-will-be-blood', 'usr_reel', 'I drink your milkshake: a love letter', 'audio/trk_twbb_reel.bin', NULL, 9480, 'Apple TV', 'emotional', 0, 3320, 2600, NULL),
  ('trk_sop_frame', 'commentary', 'the-sopranos-s06e21', 'usr_frame', 'The cut to black, frame by frame', 'audio/trk_sop_frame.bin', NULL, 3300, 'HBO Max', 'analytical', 0, 20140, 18900, 'lvs_seed_sop'),
  ('trk_tp_close', 'mini_take', 'twin-peaks-s01e01', 'usr_close', 'The red room, in 90 seconds', 'audio/trk_tp_close.bin', NULL, 96, 'Paramount+', 'chaotic', 1, 4400, 3990, NULL),
  ('trk_shining_reel', 'commentary', 'the-shining', 'usr_reel', 'All work and no play: the Overlook was always waiting', 'audio/trk_shining_reel.bin', NULL, 8760, 'Max', 'emotional', 0, 6110, 4200, NULL),
  ('trk_frank_read', 'commentary', 'frankenstein', 'usr_reel', 'Frankenstein, chapter by chapter: who is the real monster', 'audio/trk_frank_read.bin', NULL, 6000, 'LibriVox', 'analytical', 1, 2100, 1700, NULL);

-- Reaction markers. Preset clusters for the waveform.
INSERT OR IGNORE INTO reaction_markers (id, track_id, t, type, count) VALUES
  ('mrk_1', 'trk_sop_frame', 3180, 'shock', 847),
  ('mrk_2', 'trk_sop_frame', 3181, 'cry', 412),
  ('mrk_3', 'trk_sop_frame', 1450, 'laugh', 220),
  ('mrk_4', 'trk_sop_frame', 900, 'fire', 140),
  ('mrk_5', 'trk_her_close', 5400, 'shock', 690),
  ('mrk_6', 'trk_her_close', 3600, 'cry', 355),
  ('mrk_7', 'trk_her_close', 1200, 'fire', 180),
  ('mrk_8', 'trk_md_frame', 4100, 'shock', 510),
  ('mrk_9', 'trk_md_frame', 6800, 'laugh', 190),
  ('mrk_10', 'trk_md_frame', 2000, 'fire', 260);

-- Chapters
INSERT OR IGNORE INTO chapters (id, track_id, t, title) VALUES
  ('chp_1', 'trk_sop_frame', 0, 'Cold open'),
  ('chp_2', 'trk_sop_frame', 1400, 'Members Only'),
  ('chp_3', 'trk_sop_frame', 3120, 'Don''t Stop Believin'''),
  ('chp_4', 'trk_her_close', 0, 'Cold open'),
  ('chp_5', 'trk_her_close', 3600, 'The dinner table'),
  ('chp_6', 'trk_her_close', 5400, 'The treehouse');

-- Watch list and follows
INSERT OR IGNORE INTO watchlist_items (creator_id, film_slug, note, upvotes) VALUES
  ('usr_frame', 'no-country-for-old-men', 'Requested 200+ times. The coin toss, live.', 214),
  ('usr_frame', '2001-a-space-odyssey', 'The jump cut of all time. Bring patience.', 168),
  ('usr_close', 'the-shining', 'Room 237 truthers welcome.', 92);

INSERT OR IGNORE INTO follows (follower_id, creator_id) VALUES
  ('usr_close', 'usr_frame'),
  ('usr_reel', 'usr_frame');
