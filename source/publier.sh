#!/bin/sh
# Publie le site : remplace les fichiers à la racine du dépôt par ceux de dist/ (lancer sh build.sh avant).
# Ne touche pas à source/, .github/, .nojekyll, README.md ni aux fichiers de la licence (LICENSE, CONTRIBUTING.md, SECURITY.md).
set -e
cd "$(dirname "$0")"
[ -f dist/index.html ] || { echo "Lance d'abord : sh build.sh"; exit 1; }
cd ..
find . -mindepth 1 -maxdepth 1 ! -name source ! -name .github ! -name .git ! -name .nojekyll ! -name README.md ! -name LICENSE ! -name CONTRIBUTING.md ! -name SECURITY.md -exec rm -rf {} +
cp -a source/dist/. .
echo "OK: site publié à la racine du dépôt"
