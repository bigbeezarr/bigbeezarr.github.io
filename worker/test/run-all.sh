#!/usr/bin/env bash
# Toute la batterie de tests du serveur, sans compte ni réseau : imitations locales d'AWS Rekognition, GitHub, Stripe et Resend.
#   bash test/run-all.sh          (depuis worker/ ; demande Node 22+, Python 3 et Pillow)
# Utilisé aussi par le déploiement automatique, avant toute mise en ligne.
set -euo pipefail
cd "$(dirname "$0")/.."
T="$(mktemp -d)"; PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; rm -rf "$T"; }
trap cleanup EXIT

python3 - "$T" <<'PY'
import os, sys
from PIL import Image, ImageDraw
t = sys.argv[1]
a = Image.new("RGB", (1200, 1800)); d = ImageDraw.Draw(a)
for x in range(0, 1200, 40): d.rectangle([x, 0, x + 20, 1800], fill=(x % 255, 80, 160))
a.save(f"{t}/photo1.jpg", quality=85)
b = Image.new("RGB", (1800, 1200)); d = ImageDraw.Draw(b)
for y in range(0, 1200, 60): d.rectangle([0, y, 1800, y + 30], fill=(30, y % 255, 90))
d.ellipse([500, 200, 1300, 1000], fill=(240, 240, 240)); b.save(f"{t}/photo2.jpg", quality=85)
c = Image.new("RGB", (1500, 1000), (10, 10, 10)); d = ImageDraw.Draw(c)
for i in range(0, 1500, 90): d.polygon([(i, 0), (i + 45, 1000), (i + 90, 0)], fill=(200, (i * 3) % 255, 40))
c.save(f"{t}/photo3.jpg", quality=85)
open(f"{t}/fichier.NEF", "wb").write(os.urandom(1600000))
PY

# Un ancien serveur de test resté allumé fausserait tout : on refuse de démarrer si un port est déjà pris.
for port in 8787 8788 9911 9922; do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$port/"; then echo "Port $port déjà utilisé : arrêtez l'ancien serveur de test avant de relancer."; exit 1; fi
done
wait_up() { for _ in $(seq 1 60); do curl -fs "$1" >/dev/null 2>&1 && return 0; sleep 0.25; done; echo "serveur injoignable : $1"; exit 1; }
start_api() { # $1 = mode (full | face | bare)
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null && sleep 0.4
  rm -rf "$T/data"
  local e=(SINGLE_MAX=1048576 PART_SIZE=524288 AWS_ACCESS_KEY_ID=AKIATEST AWS_SECRET_ACCESS_KEY=x AWS_ENDPOINT=http://127.0.0.1:9911/)
  [ "$1" != bare ] && e+=(FACE_SEARCH=on)
  [ "$1" = full ] && e+=(GITHUB_TOKEN=gh_test_ci GITHUB_REPO=bigbeezarr/bigbeezarr.github.io GITHUB_BRANCH=source GITHUB_API=http://127.0.0.1:9922
    STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_test STRIPE_API=http://127.0.0.1:9922
    RESEND_API_KEY=re_test NOTIFY_EMAIL=photographe@example.com RESEND_ENDPOINT=http://127.0.0.1:9922/emails
    TURNSTILE_SECRET=ts_secret_test TURNSTILE_ENDPOINT=http://127.0.0.1:9922/turnstile/v0/siteverify)
  env "${e[@]}" node --no-warnings test/devserver.mjs 8787 "$T/data" > "$T/api.log" 2>&1 & API_PID=$!; PIDS+=("$API_PID")
  wait_up http://127.0.0.1:8787/api/health
}

node test/sigv4.test.mjs
python3 test/mock_rekognition.py 9911 > "$T/rek.log" 2>&1 & PIDS+=($!)
node test/mock_services.mjs 9922 > "$T/mock.log" 2>&1 & PIDS+=($!)
wait_up http://127.0.0.1:9911/; wait_up http://127.0.0.1:9922/

echo "== Galeries, téléchargements, ZIP, visages (imitation) =="
start_api face
DATA="$T/data" node --no-warnings test/api.test.mjs "$T/photo1.jpg" "$T/photo2.jpg" "$T/photo3.jpg" "$T/fichier.NEF"

echo "== Réservations, clients, sélections, statistiques, contenu, paiements =="
start_api full
STRIPE_WEBHOOK_SECRET=whsec_test FACE_SEARCH=on node --no-warnings test/site.test.mjs

echo "== Sans aucune clé facultative =="
start_api bare
node --no-warnings test/bare.test.mjs
echo "Tous les tests sont passés."
