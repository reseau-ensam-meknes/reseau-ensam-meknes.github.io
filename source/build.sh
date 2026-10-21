#!/bin/sh
# Construit deux versions à partir de src/ :
#   dist/      site complet à déposer sur Netlify (mode réel avec Supabase dès que config.js est rempli)
#   artifact/  version démo publiée comme Artifact
set -e
cd "$(dirname "$0")"
rm -rf dist artifact && mkdir -p dist/vendor artifact/vendor
for d in dist artifact; do cp src/*.js src/vendor/* "$d/" 2>/dev/null || true; mv "$d"/preact-htm.js "$d"/supabase.js "$d"/591.supabase.js "$d"/leaflet.js "$d"/leaflet.css "$d/vendor/"; done
{ printf '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#1670A8" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#0B1320" media="(prefers-color-scheme: dark)">\n<link rel="manifest" href="pwa/manifest.webmanifest">\n<link rel="apple-touch-icon" href="pwa/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Réseau ENSAM">\n'
  sed 's#<!--CONFIG-->#<script src="config.js"></script>#' src/page.html | sed '/^<div id="app">/,$d'
  printf '</head>\n<body>\n'
  sed -n '/^<div id="app">/,$p' src/page.html | sed 's#<!--CONFIG-->#<script src="config.js"></script>#'
  printf '</body>\n</html>\n'; } > dist/index.html
[ -f config.js ] && cp config.js dist/config.js || cp src/config.example.js dist/config.js
# Application installable : manifeste et icônes (le site en ligne seulement, pas la démo)
cp -r src/pwa dist/pwa
# Logos : en-tête des emails et avatar
cp -r src/img dist/img
sed '/<!--CONFIG-->/d' src/page.html > artifact/index.html
# Fichiers SQL dérivés de schema.sql (seule source à modifier)
{ printf -- '-- Installation complète du Réseau ENSAM Meknès : tables, règles de sécurité, puis deux comptes de test.\n-- Supabase > SQL Editor > New query : colle tout ce fichier, puis Run.\n\n'
  cat supabase/schema.sql; [ ! -f supabase/comptes-test.sql ] || { printf '\n\n'; cat supabase/comptes-test.sql; }; } > supabase/installation.sql
{ printf -- '-- =====================================================================\n--  Réseau ENSAM Meknès · Mise à jour de la base\n--  Ajoute ce qui manque (Phase 2 : groupes, cafés, startups, défis, parrainage,\n--  notifications, résumé par email ; Phase 3 : CV, entretiens, avis de stage, guide\n--  étranger, alertes, contact, signalements, visibilité, limites, enquête d’insertion,\n--  liste officielle, agenda, vérification par les pairs ; messagerie privée avec\n--  photos et vocaux) sans toucher aux comptes, offres ni candidatures existants. Relançable sans risque.\n--  Supabase > SQL Editor > New query : colle tout ce fichier, puis Run.\n-- =====================================================================\n\n'
  tail -n +6 supabase/schema.sql; } > supabase/mise-a-jour.sql
# Adresse du projet et clé publique (celles de config.js) : la base s'en sert pour appeler la fonction « notifier »
url=$(sed -n "s/.*supabaseUrl: *'\([^']*\)'.*/\1/p" config.js 2>/dev/null); key=$(sed -n "s/.*supabaseAnonKey: *'\([^']*\)'.*/\1/p" config.js 2>/dev/null)
if [ -n "$url" ] && [ -n "$key" ]; then
  for f in supabase/installation.sql supabase/mise-a-jour.sql; do
    printf "\n-- Projet Supabase de la plateforme (adresse et clé publique, déjà visibles dans config.js)\ninsert into public.app_secrets (cle, valeur) values ('projet_url', '%s'), ('anon_key', '%s')\n  on conflict (cle) do update set valeur = excluded.valeur;\n" "$url" "$key" >> "$f"
  done
fi
for f in supabase/installation.sql supabase/mise-a-jour.sql; do
  printf "\n-- Résultat : 1 = activé\nselect (select count(*) from pg_extension where extname = 'pg_net') as envois_pg_net, (select count(*) from pg_extension where extname = 'pg_cron') as taches_pg_cron, (select count(*) from storage.buckets where id = 'cv') as stockage_cv, (select count(*) from storage.buckets where id = 'chat') as stockage_messagerie;\n" >> "$f"
done
# Chargement rapide en 3G : modules préchargés, et version + liste des fichiers pour le service worker
if command -v node >/dev/null 2>&1; then node outils/precharger.mjs dist; else echo "node absent : préchargement et cache hors ligne non préparés"; fi
echo "OK: dist/ et artifact/ prêts"
