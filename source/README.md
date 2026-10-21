# Réseau ENSAM Meknès · sources

Le site publié à la racine du dépôt (https://reseau-ensam-meknes.github.io/) est construit à partir de ce dossier `source/`.

- `src/` : l'application (Preact + htm, sans outil de compilation).
- `supabase/schema.sql` : la base (tables, règles de sécurité, tâches planifiées). `build.sh` en tire `supabase/mise-a-jour.sql`, à lancer dans Supabase > SQL Editor.
- `supabase/functions/notifier/` : emails et notifications (Edge Function « notifier »).
- `supabase/emails-auth/` : les 6 emails de compte (français + arabe).
- `outils/` : préchargement et cache hors ligne (`precharger.mjs`), logos.
- `tests/` : tests automatiques, lancés par GitHub à chaque changement (`.github/workflows/tests.yml`).

## Construire

```sh
sh build.sh            # crée dist/ (le site) et artifact/ (la démo)
```

Puis `sh publier.sh` : il remplace les fichiers du site à la racine du dépôt par ceux de `dist/`. Les tests vérifient que les deux sont identiques.

## Tester

```sh
sh build.sh
cd tests && npm ci && npx playwright install chromium && npm test
```

- `npm run unit` : calculs (saisons, niveaux, enquête, taux d'insertion), lecture d'un profil LinkedIn collé, traductions arabes.
- `npm run sql` : la base dans un Postgres local (PGlite) : règles d'accès, limites, enquête, liste officielle, mise à jour depuis la Phase 2.
- `npm run notifier` : emails (Gmail puis Brevo en secours), notifications push, résumé de la semaine, alertes, enquêtes.
- `npm run site` : le site en démo dans Chromium : tous les écrans pour chaque profil (ordinateur en français, téléphone en arabe), coordonnées après accord, signalement et modération, agenda, mode sombre, hors ligne, lien d'invitation par promo, remplissage depuis LinkedIn, clavier, et audit d'accessibilité (axe-core : contrastes, noms, repères) sur chaque écran.
