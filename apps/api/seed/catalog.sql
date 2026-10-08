-- Rowhouse film catalog: real films and public-domain audiobooks, no users or
-- tracks. Safe for production; idempotent (INSERT OR IGNORE).
--   local:  wrangler d1 execute rowhouse --local  --file=./seed/catalog.sql
--   remote: wrangler d1 execute rowhouse --remote --file=./seed/catalog.sql
-- Mirrors the curated catalog in src/adapters/tmdb.ts so film pages resolve.
INSERT OR IGNORE INTO films (slug, tmdb_id, media_type, title, year, overview, poster_path, backdrop_path, director, runtime_minutes, season, episode, genres) VALUES
  ('mulholland-drive', 1018, 'movie', 'Mulholland Drive', 2001, 'A bright-eyed actress and an amnesiac collide in a Los Angeles that keeps folding in on itself.', NULL, NULL, 'David Lynch', 147, NULL, NULL, '["Mystery","Drama","Thriller"]'),
  ('hereditary', 493922, 'movie', 'Hereditary', 2018, 'After the family matriarch dies, grief curdles into something older and more deliberate.', NULL, NULL, 'Ari Aster', 127, NULL, NULL, '["Horror","Drama","Mystery"]'),
  ('parasite', 496243, 'movie', 'Parasite', 2019, 'One family schemes its way into another, and the basement remembers.', NULL, NULL, 'Bong Joon-ho', 132, NULL, NULL, '["Comedy","Thriller","Drama"]'),
  ('there-will-be-blood', 7345, 'movie', 'There Will Be Blood', 2007, 'Oil, faith, and a milkshake. Daniel Plainview drills straight down into the American soul.', NULL, NULL, 'Paul Thomas Anderson', 158, NULL, NULL, '["Drama"]'),
  ('2001-a-space-odyssey', 62, 'movie', '2001: A Space Odyssey', 1968, 'From a bone thrown into the air to a star-child watching Earth.', NULL, NULL, 'Stanley Kubrick', 149, NULL, NULL, '["Science Fiction","Adventure"]'),
  ('in-the-mood-for-love', 843, 'movie', 'In the Mood for Love', 2000, 'Two neighbors rehearse a love they refuse to have. Longing as architecture.', NULL, NULL, 'Wong Kar-wai', 98, NULL, NULL, '["Drama","Romance"]'),
  ('the-shining', 694, 'movie', 'The Shining', 1980, 'A writer, a hotel, and a winter with no exits.', NULL, NULL, 'Stanley Kubrick', 146, NULL, NULL, '["Horror","Thriller"]'),
  ('no-country-for-old-men', 6977, 'movie', 'No Country for Old Men', 2007, 'A hunter finds money in the desert and a force of nature comes to collect.', NULL, NULL, 'Joel & Ethan Coen', 122, NULL, NULL, '["Crime","Drama","Thriller"]'),
  ('the-sopranos-s06e21', 1398, 'tv', 'The Sopranos', 2007, 'Made in America. Onion rings, a bell over the door, and the cut to black.', NULL, NULL, 'David Chase', 55, 6, 21, '["Drama","Crime"]'),
  ('twin-peaks-s01e01', 1405, 'tv', 'Twin Peaks', 1990, 'Who killed Laura Palmer? The question was always a doorway.', NULL, NULL, 'David Lynch & Mark Frost', 48, 1, 1, '["Drama","Mystery"]'),
  ('frankenstein', 900001, 'audiobook', 'Frankenstein', 1818, 'Mary Shelley''s novel of ambition and the creature it abandons. The public-domain recording is easy to sync and hard to stop talking about.', NULL, NULL, 'Mary Shelley', 512, NULL, NULL, '["Gothic","Horror","Classic"]'),
  ('the-adventures-of-sherlock-holmes', 900002, 'audiobook', 'The Adventures of Sherlock Holmes', 1892, 'Arthur Conan Doyle''s twelve stories, public domain and endlessly narrated. Built for a story-by-story commentary.', NULL, NULL, 'Arthur Conan Doyle', 700, NULL, NULL, '["Mystery","Classic"]');
