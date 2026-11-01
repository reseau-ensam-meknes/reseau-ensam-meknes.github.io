# Fonction « notifier » : mise en ligne

Notifications sur le téléphone (Web Push) et résumé hebdomadaire par email (compte Gmail de la plateforme, sinon Brevo). Un seul fichier sans dépendance : `index.ts`.

## 0. Dans quel ordre
1. **D'abord la fonction** (partie 1) : la nouvelle version marche aussi avec une base pas encore mise à jour (elle retire alors les téléphones partis comme avant, et l'écrit dans ses Logs).
2. **Ensuite la base** : Supabase > SQL Editor > New query, coller tout `supabase/mise-a-jour.sql`, **Run**. Relançable sans risque.
3. **Enfin les contrôles** (partie 5).

Dans l'autre ordre, rien ne casse non plus, mais tant que l'ancienne fonction tourne, les refus des services de push ne sont pas comptés et le journal ne dit rien des notifications jetées.

## 1. Déployer
1. Supabase > **Edge Functions** > **Deploy a new function** > **Via editor**.
2. Nom : `notifier`. Remplacer tout le code proposé par le contenu de `index.ts`, puis **Deploy function**.
3. Pour une mise à jour : ouvrir `notifier` > **Code**, recoller `index.ts`, **Deploy**.

**« Verify JWT » : le désactiver** (`notifier` > **Details** : l'interrupteur « Verify JWT », appelé aussi *Enforce JWT verification*, puis **Save**). La fonction vérifie déjà elle-même chaque appel : l'en-tête `x-notifier` (le secret de `app_secrets`) pour la base, le jeton du membre pour « Tester ». Laissé activé, la passerelle de Supabase refuse les appels de la base dès que le projet passe aux nouvelles clés `sb_publishable_…` (réponse `401 Invalid JWT`), et plus aucune notification ne part. La base envoie aussi la clé publique en `apikey`, comme la passerelle l'attend.

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
Activer **pg_net** et **pg_cron** (Database > Extensions) avant de lancer `schema.sql` (sinon le relancer) : la file part tout de suite ; chaque minute (`taches_minute()`, tâche `ensam-rappels`), le rappel 15 min avant un rendez-vous (une notification, sinon `{"job":"rappels_rdv"}` pour l’email) et un nouvel essai pour ce qui attend encore dans les files (`relancer_push()`) ; le résumé chaque matin (8 h UTC), avec les durées de conservation (`conservation_quotidienne()`, puis `{"job":"inactifs"}` pour prévenir 30 jours avant la suppression d’un compte resté 3 ans sans connexion), et chaque soir à **18 h UTC, soit 18 h au Maroc depuis le retour à l'heure GMT le 20 septembre 2026**, les rappels de visite (`rappels_soir()` : la notification sur le téléphone, puis la tâche `{"job":"rappels"}` pour les emails, 150 par jour au plus). Les clés VAPID sont créées seules au premier appel.

Ce que la fonction fait de chaque notification :
- elle prend la file par lots de 300, et ne commence plus d'envoi après **45 s** (pg_net attend la réponse 60 s) : le reste attend l'appel suivant, au plus 2 minutes plus tard ;
- chaque notification garde sa place dans la barre du téléphone (une par événement), sauf le rappel du soir, le Match du jour, l'essai et l'enquête, qui remplacent la précédente du même type ; une conversation, un match ou une offre gardent une seule notification, mise à jour ;
- après chaque lot, elle dit à la base ce que chaque téléphone a répondu (`push_resultats`) : un téléphone parti (404, 410) ou trois refus d'affilée (400, 401, 403) retirent l'abonnement et notent son adresse dans `push_morts` (90 jours) ; l'appareil se réabonne alors avec une adresse neuve ; 413 (trop longue) est seulement noté ; si, dans un même tour, au moins 3 téléphones d'un même service refusent et qu'aucun n'accepte, c'est sans doute la clé de la plateforme et non les téléphones : ces refus ne comptent pas, et les Logs le disent (`tous les téléphones de ce service refusent`) ;
- tout est au journal (`push_journal`, 7 jours, jamais le contenu) : la réponse du service de push, ou -1 aucun téléphone abonné, -2 catégorie coupée par le membre, -3 abandonnée (1 jour ou 3 essais), -4 jetée par la fonction (type inconnu) ;
- un email (résumé, alertes, demandes, messages, rappel de visite) envoyé à un membre sans téléphone abonné finit par une ligne « Reçois tes matchs et tes messages directement sur ton téléphone » qui ouvre l'activation (`?notifs=1`).

## 4. Tester
- Clé publique : `curl -X POST https://VOTRE-PROJET.supabase.co/functions/v1/notifier -H "Authorization: Bearer CLE_ANON" -H "Content-Type: application/json" -d '{"job":"cle"}'` donne `{"publicKey":"B…"}`.
- Téléphone : activer les notifications sur le site, puis **Tester** (Mon profil), ou appeler `{"job":"test"}` avec le jeton de session du membre (`Authorization: Bearer …`) : `{"sent":1,"failed":0,"removed":0,"codes":[201],"abonnements":1}` (un code par téléphone : 201 accepté, 404 ou 410 téléphone parti, 400, 401 ou 403 refusé, 0 service injoignable).
- File et résumé, sans attendre : `select public.appeler_notifier('push');` ou `select public.appeler_notifier('resume');`, puis `select status_code, content from net._http_response order by id desc limit 3;`. Réponses : `{"sent","failed","removed"}` (et `"retry"` quand des envois sont à refaire) et `{"sent","empty","errors","via"}`.
- Email d'essai, tout de suite, aux administrateurs : `select public.appeler_notifier('essai_email');` puis la réponse doit contenir `"sent":1` et `"via":"gmail"`.
- Renvoyer un résumé déjà parti cette semaine : `update public.notif_etat set resume_at = null;` (les comptes de moins de 2 jours sont exclus).
- Erreurs de la fonction : Edge Functions > `notifier` > **Logs**. Erreurs de la base (une notification qui n'a pas pu partir n'empêche jamais l'action du membre) : **Logs > Postgres**, chercher `appeler_notifier :`, `pousser :`, `push_filtre :` ou le nom d'une fonction `notif_…`.

## 5. Contrôles après la mise en ligne (SQL Editor)
Le panneau **Santé des notifications** (Administration > Vue d'ensemble) montre l'essentiel. Pour aller plus loin :
```sql
-- 1. La base est à jour : 4 colonnes, la table des adresses mortes, abonner_push répond (text)
select count(*) as colonnes from information_schema.columns
  where table_schema = 'public' and table_name = 'push_subscriptions' and column_name in ('dernier_code', 'dernier_envoi_at', 'refus', 'refus_at');
select to_regclass('public.push_morts') as push_morts, pg_get_function_result('public.abonner_push(text,text,text)'::regprocedure) as abonner_push;

-- 2. La fonction répond : 200 attendu (401 : désactiver « Verify JWT » ; pas de ligne : pg_net ou app_secrets manquent)
select public.appeler_notifier('push');
select status_code, timed_out, error_msg, created from net._http_response order by id desc limit 3;

-- 3. Les tâches tournent : ensam-rappels '* * * * *', ensam-quotidien, ensam-alertes, ensam-rappels-visite '0 18 * * *', ensam-partages, toutes actives
select jobname, schedule, active from cron.job order by jobname;
select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'ensam-rappels') order by start_time desc limit 3;

-- 4. Ce que sont devenues les notifications des dernières 24 h (201 envoyées ; -1 sans téléphone ; -2 coupées ; -3 abandonnées ; -4 jetées)
select code, count(*) from public.push_journal where at > now() - interval '24 hours' group by code order by count(*) desc;

-- 5. La file ne s'accumule pas : quelques lignes au plus, la plus ancienne de moins de 2 minutes
select count(*) as en_file, now() - min(created_at) as plus_ancienne from public.push_queue;

-- 6. Les téléphones, par service de push : abonnés, réception confirmée en 7 jours, refus en cours
select public.service_push(endpoint) as service, count(*) as telephones,
  count(*) filter (where recu_at > now() - interval '7 days') as recus_7j, count(*) filter (where refus > 0) as en_refus
from public.push_subscriptions group by 1 order by 2 desc;
```
