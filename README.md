# Plugins français pour LNReader

Ce dépôt publie un catalogue communautaire contenant uniquement les plugins
français compatibles avec [LNReader](https://github.com/LNReader/lnreader).
Il est indépendant du dépôt officiel afin que les corrections françaises
puissent être mises à disposition sans attendre leur fusion upstream.

## Ajouter le dépôt dans LNReader

Dans les paramètres des dépôts de plugins, ajoutez cette adresse :

```text
https://raw.githubusercontent.com/Balrog57/lnreader-plugins-fr/plugins/v3.0.0/.dist/plugins.min.json
```

Les plugins marqués comme cassés dans les sources ne sont pas publiés.

## Synchronisation automatique

Chaque jour, GitHub Actions récupère les nouveautés de
`LNReader/lnreader-plugins`. La projection conserve uniquement :

- les plugins du dossier `plugins/french` ;
- les sources françaises des générateurs multi-sources ;
- les moteurs, types, scripts et ressources nécessaires à leur compilation.

Les corrections locales sont fusionnées avec les changements upstream. Une
modification simultanée et incompatible de la même source française arrête la
synchronisation au lieu d'écraser silencieusement la correction locale.

La branche `master` n'est mise à jour que si les tests unitaires, la
compilation, le manifeste uniquement français, le lint et les contrôles réels
des sites ne signalent aucun échec bloquant. Une panne de test ou un conflit ne
modifie ni `master` ni le catalogue déjà publié.

## Vérification locale

Prérequis : Node.js 24 ou version ultérieure.

```bash
npm ci --ignore-scripts
npm run prune:french
npm run test:unit
npm run clean:multisrc
npm run lint:french
npm run build:full
npm run check:french-manifest
npm run check:french-live
```

Pour contrôler un seul plugin :

```bash
npm run check:plugin -- plugins/french/nom-du-plugin.ts
```

## Publication

Après validation d'une modification de `master`, le workflow de publication
reconstruit le catalogue et force la mise à jour de la branche de distribution
`plugins/v3.0.0`. Le jeton GitHub propre au dépôt est utilisé ; aucun jeton
personnel n'est requis.

## Avertissement

Ce projet n'est affilié ni à LNReader ni aux sites référencés. Les contenus
restent soumis aux conditions de leurs éditeurs respectifs.
