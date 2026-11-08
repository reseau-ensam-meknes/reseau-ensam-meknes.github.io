// Les instants du balayage des dates (.github/workflows/balayage-dates.yml) : le témoin « maintenant », puis les
// prochaines dates où un calendrier se trompe le plus souvent (fins de mois, 1er janvier, 29 février, début et fin de
// l'été, veille et jour de la rentrée du 1er septembre, un samedi soir de juillet, un dimanche soir, une nuit à 3 h,
// dans cinq ans). node dates-a-venir.mjs [ISO,ISO…] : la liste en JSON. Des instants donnés remplacent la liste (le
// témoin reste). Quatre machines par instant, et GitHub refuse plus de 256 machines par lancement : 63 instants au plus.
const donnees = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);
const maintenant = new Date();
const apres = new Date(maintenant.getTime() + 864e5); // au moins un jour d'avance
const utc = (a, m, j, h = 10) => new Date(Date.UTC(a, m, j, h));
// La prochaine occurrence (après demain au plus tôt) d'un jour de l'année ; j = 0 : le dernier jour du mois m
const prochain = (m, j, h = 10, test = () => true) => {
  for (let a = apres.getUTCFullYear(); a < apres.getUTCFullYear() + 9; a++) {
    const d = j === 0 ? utc(a, m + 1, 0, h) : utc(a, m, j, h);
    if (d > apres && d.getUTCMonth() === m && test(d)) return d;
  }
  throw new Error(`aucune date pour ${m + 1}/${j}`);
};
const jour = (d, n, h) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); x.setUTCHours(h, 0, 0, 0); return x; };
let liste;
if (donnees.length) {
  liste = donnees.map(s => { const d = new Date(s); if (isNaN(d)) throw new Error(`date illisible : ${s}`); return d; });
} else {
  const juillet = prochain(6, 17, 19);
  const dimanche = jour(apres, 7 + ((7 - jour(apres, 7, 0).getUTCDay()) % 7), 18);
  liste = [
    prochain(11, 15), prochain(11, 31), prochain(0, 1), prochain(0, 31), prochain(1, 0),
    prochain(1, 29, 10, d => d.getUTCDate() === 29), prochain(2, 31), prochain(3, 15, 3), prochain(4, 31), prochain(5, 1),
    jour(juillet, (6 - juillet.getUTCDay() + 7) % 7, 19), prochain(7, 31), prochain(8, 1), prochain(8, 30), prochain(9, 31),
    dimanche, utc(maintenant.getUTCFullYear() + 5, 8, 15),
  ];
}
const vus = new Set();
const iso = liste.sort((a, b) => a - b).map(d => d.toISOString().replace('.000Z', 'Z')).filter(s => !vus.has(s) && vus.add(s));
if (iso.length > 63) throw new Error(`${iso.length} instants : 63 au plus (quatre machines chacun, 256 au plus par lancement)`);
console.log(JSON.stringify(['maintenant', ...iso]));
