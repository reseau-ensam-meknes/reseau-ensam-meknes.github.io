# Fonction « notifier » : mise en ligne

Notifications sur le téléphone (Web Push) et résumé hebdomadaire par email (compte Gmail de la plateforme, sinon Brevo). Un seul fichier sans dépendance : `index.ts`.

## 0. Dans quel ordre
1. **D'abord fusionner, puis régénérer** : une fois la branche fusionnée avec `main`, `sh build.sh` refait `supabase/mise-a-jour.sql` à partir du `schema.sql` fusionné. Ne jamais lancer seul le `mise-a-jour.sql` d'une branche pas encore fusionnée sur une base qui a déjà reçu celui de `main` : `main` a changé des vues (`avis_publics`, `entretiens_publics`, `profils`) et l'ancien script s'arrête sur `cannot drop columns from view`. Un ancien script relancé après le bon remettrait aussi d'anciennes versions des fonctions : toujours le dernier, régénéré.
2. **Ensuite la fonction** (partie 1) : la nouvelle version marche aussi avec une base pas encore mise à jour (elle retire alors les téléphones partis comme avant, ce qu'elle n'a pas eu le temps d'essayer est repris après 2 minutes comme avant, et ses Logs le disent). Elle connaît déjà les nouvelles notifications (la veille d'un rendez-vous, le résumé du dimanche…) : tant que la base n'est pas mise à jour, elle n'en reçoit simplement aucune.
3. **Puis la base** : Supabase > SQL Editor > New query, coller tout le `supabase/mise-a-jour.sql` régénéré, **Run**. Relançable sans risque.
4. **Puis le site** : il marche avec l'ancienne base comme avec la nouvelle (sans `abonner_push_etat`, il s'abonne par `abonner_push` ; sans `admin_sante_notifs`, le panneau dit « Ce panneau apparaît après la mise à jour du serveur. »).
5. **Enfin les contrôles** (partie 5).

Dans l'autre ordre (la base avant la fonction), rien ne casse non plus, mais tant que l'ancienne fonction tourne, les refus des services de push ne sont pas comptés, le journal ne dit rien des notifications jetées, et les nouvelles notifications que la base programme (sauf le tour Match du jour, qu'elle connaît déjà) sont jetées comme un type inconnu : elles ne sont pas renvoyées ensuite.

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
Activer **pg_net** et **pg_cron** (Database > Extensions) avant de lancer `schema.sql` (sinon le relancer) : la file part tout de suite ; chaque minute (`taches_minute()`, tâche `ensam-rappels`), le rappel 15 min avant un rendez-vous (une notification, sinon `{"job":"rappels_rdv"}` pour l’email) et un nouvel essai pour ce qui attend encore dans les files (`relancer_push()`) ; le résumé chaque matin (8 h UTC), avec les durées de conservation (`conservation_quotidienne()`, puis `{"job":"inactifs"}` pour prévenir 30 jours avant la suppression d’un compte resté 3 ans sans connexion), et chaque soir à **18 h UTC, soit 18 h au Maroc depuis le retour à l'heure GMT le 20 septembre 2026**, les rappels de visite (`rappels_soir()` : la notification sur le téléphone, puis la tâche `{"job":"rappels"}` pour les emails, 150 par jour au plus). Sur le téléphone, le rappel ne redit ni l'agenda des deux jours (chaque événement est annoncé la veille à 19 h 30 ; l'email le garde) ni un « Intéressé » déjà rappelé à midi, et ne part pas le soir du résumé du dimanche (il part le lendemain). Les clés VAPID sont créées seules au premier appel.

Les nouvelles notifications ont leurs tâches, aux mêmes heures UTC (= heure du Maroc) : `ensam-matin` à 8 h (`matin_push()` : les envois à beaucoup publiés la nuit, les demandes mises en pause, le ménage), `ensam-offres-bientot` à 9 h (les offres mises de côté qui ferment demain ou dans 2 jours), `ensam-midi` à 12 h 30 (les intérêts Match qui attendent une réponse, puis le tour Match du jour), `ensam-veille` à 19 h 30 (la veille d'un rendez-vous, d'un entretien ou de l'agenda, un mot après un rendez-vous de mentorat tenu la veille ou le jour même, les messages des groupes du jour, pour qui est venu ces 14 derniers jours) et `ensam-semaine` le dimanche à 10 h (le résumé de la semaine) ; chaque heure de 8 h à 21 h, `ensam-alertes` prévient aussi les lauréats du parcours d'une demande toujours sans aide après un jour. La base programme **au plus 3 notifications par membre et par jour** (`programme_place`, table `notif_programme`) : celles d'un engagement ou d'une personne qui attend (rendez-vous, entretien, événement de demain, après un rendez-vous, intérêts en attente) partent toujours mais comptent, les autres seulement s'il reste de la place ; rien de programmé pour l'administration, même quand elle regarde l'application en lauréat. **Nuit calme de 21 h 30 à 8 h** : rien de programmé, et un envoi à beaucoup publié le soir (nouvelle offre, annonce, événement…) attend 8 h dans `push_nuit` ; à 8 h, ce qui n'est plus vrai (offre ou demande fermée, événement ou café annulé ou déjà commencé, mentorat déjà pris…) ne part pas, et un événement ou un café déplacé dans la nuit part avec sa nouvelle heure et son nouveau lieu. Les notifications entre deux personnes (message, match, candidature, réponse…) partent toujours tout de suite.

Ce que la fonction fait de chaque notification :
- elle prend la file par lots de 300, ne commence plus d'envoi après **45 s** et ne prend plus de lot à moins de **10 s** de cette heure (pg_net attend la réponse 60 s) ; ce qu'elle a pris sans avoir eu le temps de l'essayer est rendu tout de suite à la file, sans essai compté (`push_rendues`), pour l'appel suivant (la tâche de chaque minute) ;
- chaque notification garde sa place dans la barre du téléphone (une par événement). Remplacent la précédente du même type : le rappel du soir, le Match du jour, l'essai, l'enquête, les arrivées dans la promo, le filleul, et ce qui rend la précédente fausse (la vérification par les pairs, la nouvelle date d'un événement ou d'un rendez-vous de mentorat, un nouveau parrain). Une conversation, un match, une offre ou une demande gardent une seule notification, mise à jour ; sur une demande, chaque lauréat qui propose son aide et chaque réponse ont la leur (sinon la deuxième efface la première, et son nom), sauf quand la base les regroupe déjà. De même, un rendez-vous de mentorat (de la demande au rappel de 15 minutes, la veille comprise), un événement (son annonce, puis la veille) ou un groupe gardent une seule ligne, et le résumé du dimanche, plusieurs intérêts Match en attente ou les offres mises de côté qui ferment ensemble ont chacun la leur, qui se met à jour ;
- la nuit calme vaut aussi pour la remise : le service de push garde une notification tant que sa durée de vie court (un téléphone hors réseau, ou un Android en veille quand elle peut attendre). Une notification programmée (le budget du jour : la veille d'un rendez-vous, d'un entretien ou de l'agenda, le mot après un rendez-vous, les intérêts Match en attente, le tour Match, les offres qui ferment, les demandes sans aide ou en pause, le rappel du soir, le résumé du dimanche, les groupes) ne vit donc que **jusqu'à 21 h 30** : envoyée à 19 h 30, 2 h. Un téléphone hors réseau de 19 h 30 à 21 h 30 ne reçoit ni la veille (le rappel 15 minutes avant le rendez-vous arrive quand même) ni les groupes du jour (les messages restent à lire dans les groupes). Prise par la fonction après 21 h 30 (file en retard après une panne), elle ne part pas : sortie de la file, notée -5 au journal, dite dans les Logs (`nuit calme`, avec le type seulement). Les notifications entre personnes gardent leur durée (un jour ; 15 minutes pour un rappel de rendez-vous) ;
- après chaque lot, elle dit à la base ce que chaque téléphone a répondu (`push_resultats`). Un téléphone parti (404, 410) : l'abonnement est retiré et son adresse notée dans `push_morts` (90 jours) ; l'appareil doit se réabonner avec une adresse neuve (`abonner_push_etat` répond `mort` pour une adresse notée : le site le fait seul quand `pwa.js` gère cette réponse, sinon le membre doit désactiver puis réactiver les notifications). Au troisième refus d'affilée (400, 401, 403), l'abonnement n'est retiré que si le même service de push a accepté un envoi vers un autre téléphone depuis le premier de ces refus : c'est alors bien ce téléphone qu'il refuse. Sinon, la clé de la plateforme est sans doute en cause : rien n'est retiré, tout repart quand elle est réparée, et **Logs > Postgres** le dit (`push_resultats : des téléphones refusent trois fois de suite…`). Dans un même tour, quand les téléphones d'au moins 3 membres d'un même service refusent et qu'aucun n'accepte, ces refus ne sont même pas comptés, et les Logs de la fonction le disent (`tous les téléphones de ce service refusent`). Les refus de **Tester** ne comptent jamais (trois appuis ne doivent pas retirer le téléphone qu'on essaie de réparer) ; 413 (trop longue) est seulement noté ;
- tout est au journal (`push_journal`, 7 jours, jamais le contenu) : la réponse du service de push, ou -1 aucun téléphone abonné, -2 catégorie coupée par le membre, -3 abandonnée après au moins un essai (un jour en file, ou 3 essais), -4 jetée par la fonction (type inconnu, ou rien de vrai à dire : un tour Match sans carte, une semaine sans rien de neuf), -5 expirée sans avoir jamais été essayée (un jour en file, ou une notification programmée prise après 21 h 30 : la fonction ou la tâche de chaque minute ne tournait pas) ;
- un email (résumé, alertes d'offres, demandes, messages, rappel de rendez-vous, enquête, rappel de visite) envoyé à un membre sans téléphone abonné finit par une ligne « Reçois tes matchs et tes messages directement sur ton téléphone » (pour le rappel de rendez-vous : « Reçois ces rappels directement sur ton téléphone, 15 minutes avant chaque rendez-vous ») qui ouvre l'activation (`?notifs=1`).

## 4. Tester
- Clé publique : `curl -X POST https://VOTRE-PROJET.supabase.co/functions/v1/notifier -H "Authorization: Bearer CLE_ANON" -H "Content-Type: application/json" -d '{"job":"cle"}'` donne `{"publicKey":"B…"}`.
- Téléphone : activer les notifications sur le site, puis **Tester** (Mon profil), ou appeler `{"job":"test"}` avec le jeton de session du membre (`Authorization: Bearer …`) : `{"sent":1,"failed":0,"removed":0,"codes":[201],"abonnements":1}` (un code par téléphone : 201 accepté ; 404 ou 410 téléphone parti, retiré ; 400, 401 ou 403 refusé, sans que ce refus compte contre le téléphone ; 413 trop longue ; 0, 429 ou 5xx service injoignable).
- File et résumé, sans attendre : `select public.appeler_notifier('push');` ou `select public.appeler_notifier('resume');`, puis `select status_code, content from net._http_response order by id desc limit 3;`. Réponses : `{"sent","failed","removed"}` (et `"retry"` quand des envois sont à refaire) et `{"sent","empty","errors","via"}`.
- Email d'essai, tout de suite, aux administrateurs : `select public.appeler_notifier('essai_email');` puis la réponse doit contenir `"sent":1` et `"via":"gmail"`.
- Renvoyer un résumé déjà parti cette semaine : `update public.notif_etat set resume_at = null;` (les comptes de moins de 2 jours sont exclus).
- Erreurs de la fonction : Edge Functions > `notifier` > **Logs**. Erreurs de la base (une notification qui n'a pas pu partir n'empêche jamais l'action du membre) : **Logs > Postgres**, chercher `appeler_notifier :`, `pousser :`, `push_filtre :`, `push_resultats :` (des téléphones gardés malgré trois refus : la clé de la plateforme), `relancer_push` ou le nom d'une fonction `notif_…`.

## 5. Contrôles après la mise en ligne (SQL Editor)
Le panneau **Santé des notifications** (Administration > Vue d'ensemble) montre l'essentiel. Pour aller plus loin :
```sql
-- 1. La base est à jour : colonnes = 5 ; push_morts = push_morts ; abonner_push = void (sans réponse, comme avant) ;
--    abonner_push_etat = text ('ok' ou 'mort') ; push_rendues, admin_sante_notifs et nouvelles_notifications = true.
--    Une valeur vide ou false : relancer le mise-a-jour.sql régénéré.
select count(*) as colonnes from information_schema.columns
  where table_schema = 'public' and table_name = 'push_subscriptions'
    and column_name in ('dernier_code', 'dernier_envoi_at', 'refus', 'refus_at', 'refus_depuis');
select to_regclass('public.push_morts') as push_morts,
  pg_get_function_result(to_regprocedure('public.abonner_push(text,text,text)')) as abonner_push,
  pg_get_function_result(to_regprocedure('public.abonner_push_etat(text,text,text)')) as abonner_push_etat,
  to_regprocedure('public.push_rendues(bigint[])') is not null as push_rendues,
  to_regprocedure('public.admin_sante_notifs()') is not null as admin_sante_notifs,
  to_regclass('public.notif_programme') is not null and to_regclass('public.push_nuit') is not null
    and to_regprocedure('public.veille_push()') is not null as nouvelles_notifications;

-- 2. La fonction répond : 200 attendu (401 : désactiver « Verify JWT » ; pas de ligne : pg_net ou app_secrets manquent)
select public.appeler_notifier('push');
select status_code, timed_out, error_msg, created from net._http_response order by id desc limit 3;

-- 3. Les tâches tournent : ensam-rappels '* * * * *', ensam-quotidien, ensam-alertes, ensam-rappels-visite '0 18 * * *', ensam-partages,
--    et celles des nouvelles notifications : ensam-matin '0 8 * * *', ensam-offres-bientot '0 9 * * *', ensam-midi '30 12 * * *',
--    ensam-veille '30 19 * * *', ensam-semaine '0 10 * * 0' ; toutes actives
select jobname, schedule, active from cron.job order by jobname;
select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'ensam-rappels') order by start_time desc limit 3;

-- 4. Ce que sont devenues les notifications des dernières 24 h (201 envoyées ; 404, 410 téléphone parti ; 400, 401, 403
--    refusées ; 413 trop longues ; -1 sans téléphone ; -2 coupées ; -3 abandonnées après un essai ; -4 jetées (type
--    inconnu, ou rien de vrai à dire) ;
--    -5 expirées sans essai, ou programmées prises après 21 h 30). Des -5 : la fonction ou la tâche ensam-rappels ne
--    tournait pas (contrôles 2 et 3).
select code, count(*) from public.push_journal where at > now() - interval '24 hours' group by code order by count(*) desc;

-- 5. La file ne s'accumule pas : quelques lignes au plus, la plus ancienne de moins de 2 minutes
select count(*) as en_file, now() - min(created_at) as plus_ancienne from public.push_queue;

-- 6. Les téléphones, par service de push : abonnés, réception confirmée en 7 jours, refus en cours, et les membres dont
--    le dernier envoi a été refusé (3 membres ou plus, et aucun téléphone du service qui accepte : la clé de la
--    plateforme est en cause, pas les membres ; voir les Logs de la fonction)
select public.service_push(endpoint) as service, count(*) as telephones,
  count(*) filter (where recu_at > now() - interval '7 days') as recus_7j, count(*) filter (where refus > 0) as en_refus,
  count(distinct user_id) filter (where dernier_code in (400, 401, 403) and dernier_envoi_at > now() - interval '7 days') as membres_refuses,
  count(*) filter (where dernier_code between 200 and 299 and dernier_envoi_at > now() - interval '7 days') as acceptent_7j
from public.push_subscriptions group by 1 order by 2 desc;

-- 7. Les notifications programmées des dernières 24 h, par type (3 par membre et par jour au plus), et ce qui attend 8 h
--    (push_nuit : vide entre 8 h et 21 h 30 ; sinon, la tâche ensam-matin n'a pas tourné à 8 h, contrôle 3)
select kind, count(*) as programmees, count(distinct user_id) as membres from public.notif_programme
  where at > now() - interval '24 hours' group by kind order by 2 desc;
select count(*) as attendent_8h, min(created_at) as depuis from public.push_nuit;
```

Dans le panneau, après la mise en ligne : le cercle (part des membres avec au moins un téléphone abonné), le nombre de notifications **envoyées** cette semaine et, dessous, ce qui s'est perdu (« X perdues sur Y »), à part celles qui n'ont pas pu partir faute de téléphone ; la ligne « X téléphones sur Y ont affiché une notification cette semaine » (la preuve de réception). Les raisons disent, dans l'ordre, ce qui bloque tout (la fonction, la tâche de chaque minute, la file, un service qui refuse tout, aucun téléphone qui confirme), puis les pertes. Le détail replié donne les services (Acceptent, Refusent), chaque jour, chaque type et le fonctionnement (dernier appel de la fonction, dernier passage de la tâche, dernière notification traitée).
