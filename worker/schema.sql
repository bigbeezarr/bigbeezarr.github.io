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

-- ===== Site (novembre 2026) : réservations, disponibilités, clients, sélections, statistiques, paiements =====
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',        -- new | discussion | confirmed | declined | cancelled | done
  first_name TEXT, last_name TEXT, email TEXT NOT NULL, phone TEXT, type TEXT, date TEXT, city TEXT, place TEXT,
  duration TEXT, people INTEGER, budget TEXT, description TEXT, lang TEXT,
  note TEXT,                                 -- note privée du photographe
  client_id TEXT,
  price_cents INTEGER, deposit_cents INTEGER, currency TEXT,
  pay_status TEXT NOT NULL DEFAULT 'none'    -- none | deposit_due | deposit_paid | paid | refunded
);
CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date, status);
CREATE INDEX IF NOT EXISTS bookings_created ON bookings(created_at);

CREATE TABLE IF NOT EXISTS blocked_days (
  day TEXT PRIMARY KEY,                      -- AAAA-MM-JJ
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT, phone TEXT, org TEXT, note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Réglages ajoutés aux galeries sans modifier la table d'origine (le schéma reste rejouable à chaque déploiement).
CREATE TABLE IF NOT EXISTS gallery_extra (
  gallery_id TEXT PRIMARY KEY,
  client_id TEXT,
  archived_at INTEGER,                       -- galerie archivée : fermée aux visiteurs, fichiers conservés
  selections_open INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS gallery_extra_client ON gallery_extra(client_id);

CREATE TABLE IF NOT EXISTS selections (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  guest_id TEXT,
  name TEXT, email TEXT, note TEXT,
  purpose TEXT,                              -- download | retouch | print | other
  ids TEXT NOT NULL,                         -- liste JSON des photos choisies
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'         -- new | seen | done
);
CREATE INDEX IF NOT EXISTS selections_gallery ON selections(gallery_id, created_at);

-- Statistiques sans témoin : un compteur par jour, page et type d'appareil (aucune adresse IP, aucun identifiant).
CREATE TABLE IF NOT EXISTS hits (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  device TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, device)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  kind TEXT NOT NULL,                        -- deposit | full
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,                      -- pending | paid | failed | refunded
  provider TEXT NOT NULL,
  provider_ref TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_booking ON payments(booking_id);
