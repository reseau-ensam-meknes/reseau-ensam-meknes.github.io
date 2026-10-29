# Fonction « notifier » : mise en ligne

Notifications sur le téléphone (Web Push) et résumé hebdomadaire par email (compte Gmail de la plateforme, sinon Brevo). Un seul fichier sans dépendance : `index.ts`.

## 1. Déployer
1. Supabase > **Edge Functions** > **Deploy a new function** > **Via editor**.
2. Nom : `notifier`. Remplacer tout le code proposé par le contenu de `index.ts`, puis **Deploy function**.
3. Pour une mise à jour : ouvrir `notifier` > **Code**, recoller `index.ts`, **Deploy**.

La base et le site appellent la fonction avec la clé `anon` : « Verify JWT » peut rester activé. Si la fonction répond `401 Invalid JWT` (nouvelles clés `sb_publishable_…`), le désactiver : la fonction vérifie elle-même chaque appel (en-tête `x-notifier` ou jeton du membre).

## 2. Secrets (Edge Functions > **Secrets**)
| Nom | Valeur |
|---|---|
| `GMAIL_USER` | adresse Gmail de la plateforme (l'expéditeur : sa photo de profil s'affiche) |
| `GMAIL_APP_PASSWORD` | mot de passe d'application de ce compte (Google > Sécurité > Mots de passe des applications), espaces permis |
| `BREVO_API_KEY` | Brevo > **SMTP & API** > **API Keys** : clé `xkeysib-…` (pas le mot de passe SMTP) |
| `SENDER_EMAIL` | adresse expéditrice validée dans Brevo (**Senders, Domains & Dedicated IPs**) |
| `SENDER_NAME` | facultatif, `Réseau ENSAM Meknès` par défaut |
| `SITE_URL` | facultatif, `https://reseau-ensam-meknes.github.io/` par défaut |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par Supabase. Avec `GMAIL_USER` et `GMAIL_APP_PASSWORD`, le résumé part de Gmail (SMTP 465, environ 500 emails par jour partagés avec les emails de connexion) ; Brevo, s'il est réglé, prend le relais si Gmail refuse. Sans aucun des deux, les notifications marchent et le résumé est sauté.

## 3. Relier la base à la fonction
`installation.sql` et `mise-a-jour.sql` (générés par `build.sh`) contiennent déjà l'adresse du projet et la clé publique de `config.js`. À la main seulement si besoin (SQL Editor) :
```sql
insert into public.app_secrets (cle, valeur) values
  ('projet_url', 'https://VOTRE-PROJET.supabase.co'), ('anon_key', 'VOTRE_CLE_ANON')
on conflict (cle) do update set valeur = excluded.valeur;
```
Activer **pg_net** et **pg_cron** (Database > Extensions) avant de lancer `schema.sql` (sinon le relancer) : la file part tout de suite ; chaque minute (`taches_minute()`), le rappel 15 min avant un rendez-vous (une notification, sinon `{"job":"rappels_rdv"}` pour l’email) et un nouvel essai pour ce qui attend encore dans les files (`relancer_push()`) ; le résumé chaque matin (8 h UTC), avec les durées de conservation (`conservation_quotidienne()`, puis `{"job":"inactifs"}` pour prévenir 30 jours avant la suppression d’un compte resté 3 ans sans connexion), et chaque soir à 18 h UTC (19 h au Maroc) les rappels de visite (`rappels_soir()` : la notification sur le téléphone, puis la tâche `{"job":"rappels"}` pour les emails, 150 par jour au plus). Les clés VAPID sont créées seules au premier appel.

## 4. Tester
- Clé publique : `curl -X POST https://VOTRE-PROJET.supabase.co/functions/v1/notifier -H "Authorization: Bearer CLE_ANON" -H "Content-Type: application/json" -d '{"job":"cle"}'` donne `{"publicKey":"B…"}`.
- Téléphone : activer les notifications sur le site, puis appeler `{"job":"test"}` avec le jeton de session du membre (`Authorization: Bearer …`) : `{"sent":1}`.
- File et résumé, sans attendre : `select public.appeler_notifier('push');` ou `select public.appeler_notifier('resume');`, puis `select status_code, content from net._http_response order by created desc limit 3;`. Réponses : `{"sent","failed","removed"}` et `{"sent","empty","errors","via"}`.
- Email d'essai, tout de suite, aux administrateurs : `select public.appeler_notifier('essai_email');` puis la réponse doit contenir `"sent":1` et `"via":"gmail"`.
- Renvoyer un résumé déjà parti cette semaine : `update public.notif_etat set resume_at = null;` (les comptes de moins de 2 jours sont exclus).
- Erreurs : Edge Functions > `notifier` > **Logs**.
