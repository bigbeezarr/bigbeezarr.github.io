-- Galerie client BIGBEEZARR · schéma D1 (SQLite). Idempotent : peut être rejoué à chaque déploiement.
CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,                 -- jeton public du lien (128 bits)
  title TEXT NOT NULL,
  client TEXT,
  event_date TEXT,
  kind TEXT NOT NULL DEFAULT 'private',      -- private | event | restricted
  listed INTEGER NOT NULL DEFAULT 0,         -- visible dans la liste publique de /galerie/
  pass_hash TEXT,                            -- mot de passe (HMAC salé + poivre secret)
  allow_download INTEGER NOT NULL DEFAULT 1,
  guest_view_all INTEGER NOT NULL DEFAULT 1, -- galerie restreinte : l'invité voit tout (1) ou seulement ses photos (0)
  face_enabled INTEGER NOT NULL DEFAULT 0,
  face_threshold REAL NOT NULL DEFAULT 90,   -- similarité minimale (%) pour « probable »
  face_retention_days INTEGER NOT NULL DEFAULT 30,
  face_until INTEGER,                        -- date d'effacement automatique de l'index des visages
  face_note TEXT,                            -- base légale / consentement noté par le photographe
  expires_at INTEGER,
  delete_after_expiry INTEGER NOT NULL DEFAULT 0,
  cover_photo TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  zips INTEGER NOT NULL DEFAULT 0,
  searches INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL,
  crc32 INTEGER,
  w INTEGER,
  h INTEGER,
  mtime INTEGER,
  has_preview INTEGER NOT NULL DEFAULT 0,
  extra_size INTEGER NOT NULL DEFAULT 0,     -- octets des aperçus
  sort INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading',  -- uploading | ready
  version INTEGER NOT NULL DEFAULT 1,
  allow_all INTEGER NOT NULL DEFAULT 0,      -- galerie restreinte : téléchargeable par tous
  face_state TEXT NOT NULL DEFAULT 'none',   -- none | done | skipped | error
  faces INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_gallery ON photos(gallery_id, sort);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  name TEXT,
  code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS guests_gallery ON guests(gallery_id);

CREATE TABLE IF NOT EXISTS guest_photos (
  guest_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  PRIMARY KEY (guest_id, photo_id)
);
CREATE INDEX IF NOT EXISTS guest_photos_photo ON guest_photos(photo_id);

-- Seuls les identifiants des visages chez Amazon Rekognition sont gardés ici (aucune image, aucun gabarit).
CREATE TABLE IF NOT EXISTS faces (
  face_id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS faces_gallery ON faces(gallery_id);
CREATE INDEX IF NOT EXISTS faces_photo ON faces(photo_id);

CREATE TABLE IF NOT EXISTS zip_tickets (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  ids TEXT NOT NULL,
  label TEXT,
  exp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id TEXT NOT NULL,
  kind TEXT NOT NULL,                        -- view | dl | zip | search | forget
  photo_id TEXT,
  n INTEGER NOT NULL DEFAULT 1,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_gallery ON events(gallery_id, at);

CREATE TABLE IF NOT EXISTS attempts (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
