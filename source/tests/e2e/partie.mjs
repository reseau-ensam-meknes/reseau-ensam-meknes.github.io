// Sur la CI, les tests du site sont partagés entre plusieurs machines qui tournent en même temps (.github/workflows/tests.yml) :
// PARTIE=2/3, la deuxième de trois parts, ne déclare qu'un test sur trois (le 2e, le 5e, le 8e…) dans l'ordre du fichier.
// Sans PARTIE, tous les tests. Chaque test ouvre sa propre page : aucun n'a besoin d'un autre.
import { test as unTest } from 'node:test';

const [ici, parts] = (process.env.PARTIE || '1/1').split('/').map(Number);
if (!(Number.isInteger(ici) && Number.isInteger(parts) && ici >= 1 && ici <= parts)) throw new Error(`PARTIE invalide : « ${process.env.PARTIE} » (attendu, par exemple : 2/3)`);
let rang = 0;
export const test = (...args) => (rang++ % parts === ici - 1 ? unTest(...args) : undefined);
