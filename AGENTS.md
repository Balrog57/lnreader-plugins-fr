# Règles du projet

## Périmètre strict

Ce dépôt (`lnreader-plugins-fr`) publie uniquement les plugins français pour LNReader.

- **Interdit de modifier `../lnreader`** : l'application LNReader est téléchargée
  uniquement pour émuler, jamais modifiée.
- **Interdit de modifier `../lnreader-plugins`** : dépôt upstream de référence
  uniquement.
- Ne modifier que :
  - `plugins/french/*` et `plugins/multisrc/*`
  - `src/libs/*` et `src/lib/*` (miroir de l'API fournie par l'app)
  - `scripts/*`, `docs/*`, `public/static/*`

## Règle de vérification

Avant chaque livraison, vérifier avec :

```bash
git status --short
```

Seuls les chemins ci-dessus doivent apparaître comme modifiés.

## Contrainte d'API runtime

L'app LNReader résout `@libs/fetch` vers son propre code embarqué. N'utiliser
que les exports réellement fournis par l'app : `fetchApi`, `fetchText`,
`fetchProto`, `fetchFile` (et non `fetchHtmlChecked`, qui n'existe pas côté app).
Le playground (`vite`) et `check:plugin` aliasent `@libs` vers `src/libs` de ce
repo et peuvent masquer un import inexistant côté app : ne pas s'y fier seul.

## Contrainte de compilation ES5

`tsconfig.production.json` cible ES5 avec `downlevelIteration` désactivé.
Conséquence : étaler un itérateur (`[...map.values()]`, `[...new Set]`)
compile en `__spreadArray([], it, true)` qui renvoie `[]` sur l'app. Utiliser
`Array.from(...)` pour les itérateurs (et non l'étalement). Les `for...of` sur
des tableaux et l'étalement d'objets (`{...obj}`) restent corrects.

## Objectif qualité

Faire fonctionner l'intégralité des plugins français (les 14, dont J-Garden,
Trad-Index et LightNovelVF) dans l'émulateur Android : tous les chapitres dans
le bon ordre, toutes les jaquettes affichées, recherche fonctionnelle.
