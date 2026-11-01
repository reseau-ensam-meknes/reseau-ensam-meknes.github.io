// Le CSS de la page (tout le site, écrit dans <style> de page.html, avec ses commentaires) raccourci pour le site en ligne :
// sans commentaires ni espaces inutiles, environ 13 Ko compressés de moins avant le premier affichage en 3G.
// Prudent : les chaînes ("…", '…') et les url(…) restent telles quelles ; les espaces ne partent qu'autour de { } ; , >
// (jamais autour de : ni de parenthèses, où ils comptent : « a :hover », « and (max-width…) », « calc(1px + 2px) »).
// Toujours le même résultat pour le même CSS (outils/precharger.mjs, comparé à la racine par la CI).
export function minifierCss(css) {
  const morceaux = []; let code = '', i = 0;
  const pousserCode = () => { if (code) morceaux.push({ code }); code = ''; };
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const j = css.indexOf('*/', i + 2);
      if (j < 0) throw new Error('CSS : commentaire non refermé');
      // Collé des deux côtés (« a/**/b ») : un commentaire vide garde la séparation telle quelle ; sinon un espace
      code += /\s/.test(css[i - 1] ?? ' ') || /\s/.test(css[j + 2] ?? ' ') ? ' ' : '/**/'; i = j + 2; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\\') { j += 2; continue; }
        if (css[j] === '\n') throw new Error('CSS : chaîne non refermée');
        j++;
      }
      if (j >= css.length) throw new Error('CSS : chaîne non refermée');
      pousserCode(); morceaux.push({ brut: css.slice(i, j + 1) }); i = j + 1; continue;
    }
    // url(sans guillemets) : recopiée jusqu'à sa parenthèse
    const url = /^url\(\s*(?!["'])/i.exec(css.slice(i, i + 12));
    if (url) {
      const j = css.indexOf(')', i);
      if (j < 0) throw new Error('CSS : url( non refermée');
      pousserCode(); morceaux.push({ brut: css.slice(i, j + 1).replace(/^url\(\s+/i, 'url(').replace(/\s+\)$/, ')') }); i = j + 1; continue;
    }
    code += c; i++;
  }
  pousserCode();
  return morceaux.map(m => m.brut ?? m.code.replace(/\s+/g, ' ').replace(/ ?([{};,>]) ?/g, '$1').replace(/;}/g, '}')).join('').trim();
}
