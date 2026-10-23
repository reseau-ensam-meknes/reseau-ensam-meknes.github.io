# Contribuer au Réseau ENSAM Meknès

Merci de vouloir aider ! Lauréats et étudiants de l'ENSAM sont les bienvenus.

## Comment proposer un changement

1. Dis d'abord en quelques lignes ce que tu veux faire (une issue, ou un message à l'équipe) : on évite ainsi deux personnes sur la même chose.
2. Fais un fork, puis une branche à ton nom de sujet (`correction-offres-arabe`, par exemple).
3. Change les fichiers de `source/` seulement, jamais les fichiers publiés à la racine à la main.
4. Construis et publie : `cd source && sh build.sh && sh publier.sh`.
5. Lance les tests : `cd source/tests && npm ci && npx playwright install chromium && npm test`.
6. Ouvre une pull request : ce qu'on voyait avant, ce qu'on voit après, et comment tu l'as testé. Les tests automatiques tournent sur chaque pull request ; elle est fusionnée après relecture par un administrateur du réseau.

En proposant une contribution, tu acceptes qu'elle soit publiée sous la licence du projet ([AGPL-3.0](LICENSE)).

## Les règles du projet

- **La vie privée d'abord.** Jamais de vraies données de membres dans le code, les tests ou les captures. La démo (`source/src/seed*.js`) n'utilise que des personnes fictives. Respecte « Qui voit quoi » : un étudiant ne voit que le contenu de son année, et les coordonnées ne s'affichent qu'après accord.
- **Aucun secret dans le dépôt.** Pas de clé, de mot de passe ni de compte de test (`supabase/comptes-test.sql` ne doit jamais être publié). La clé publique de `config.js` est faite pour être publique : ce sont les règles de la base qui protègent les données.
- **La base change par ajouts.** Modifie `source/supabase/schema.sql` ; `build.sh` en tire `mise-a-jour.sql`, qui doit pouvoir être lancé deux fois sans dégât. Le site doit continuer de marcher avant que la mise à jour soit appliquée. Une nouvelle règle d'accès se reproduit dans le magasin de démo (`source/src/store.js`).
- **Français et arabe.** Le texte français sert de clé ; chaque nouveau texte a sa traduction arabe (neutre, sans accord de genre). Dis خريج pour un lauréat et متدرب pour un stagiaire. En CSS, utilise les propriétés logiques (`margin-inline-start`…) pour que l'arabe (de droite à gauche) reste juste.
- **Des chiffres vrais.** Aucun chiffre ni aucune phrase qui ne soit vrai, et aucune promesse au nom de l'école.
- **Un ton calme.** Des phrases simples et bienveillantes, peu de boutons, des boutons de 44 px au moins sur téléphone, et les animations respectent « réduire les animations ».
- **Un test par règle.** Une correction arrive avec un test qui échouerait sans elle. On ne désactive ni n'affaiblit jamais un test pour faire passer une pull request.

## Accès

Les contributeurs n'ont accès ni à la base, ni aux comptes, ni aux données. Tout passe par des pull requests, testées sur la démo.
