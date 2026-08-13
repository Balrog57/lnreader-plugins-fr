# Ajout de J-Garden, Trad-Index et LightNovelVF

Date : 13 août 2026

## Objectif

Supprimer définitivement Phenix Scans du dépôt français et publier trois nouvelles sources LNReader accessibles sans compte : J-Garden, Trad-Index et LightNovelVF.

Le catalogue doit rester consacré aux romans. Les contenus manga, manhwa et scans ne doivent jamais apparaître dans les résultats.

## Périmètre

### J-Garden

- Inclure les œuvres référencées dans les sections `JG LN` et `JG WEB NOVEL`.
- Exclure `JG MANGA`, les pages de séries manga et les téléchargements externes.
- Utiliser l’API REST WordPress publique pour obtenir les pages d’œuvres et les articles de chapitres.
- Récupérer le titre, la couverture, le résumé, les informations disponibles et la liste ordonnée des chapitres.
- Extraire uniquement le corps utile du chapitre, sans navigation, partage, publicité ni pied de page.

### Trad-Index

- Inclure uniquement les formats `Web Novel` et `Light Novel`.
- Exclure explicitement `Manhwa`, manga et scan, y compris dans la recherche et les listes populaires/récentes.
- Exploiter les pages publiques rendues côté serveur afin de ne dépendre ni d’un compte ni d’un navigateur intégré.
- Prendre en charge la pagination du catalogue et des longues listes de chapitres.
- Extraire le texte du lecteur sans les commentaires, formulaires, boutons de partage ou recommandations.

### LightNovelVF

- Inclure le catalogue public de romans.
- Exploiter les pages HTML publiques du catalogue, des œuvres et des chapitres.
- Prendre en charge la pagination et les listes de chapitres volumineuses.
- Ne pas dépendre de la connexion, de la bibliothèque personnelle ou du système de notation.
- Extraire uniquement le contenu de lecture et conserver les paragraphes et illustrations utiles.

### Phenix Scans

- Supprimer `plugins/french/phenixscans.broken.ts`.
- Supprimer son icône et toute référence restante si elles existent.
- Ajouter `phenixscans` aux exclusions permanentes de la projection française afin que la synchronisation automatique ne le réintroduise pas depuis l’amont.

## Architecture

Les trois sites utilisent des architectures incompatibles : WordPress/Elementor pour J-Garden, Next.js pour Trad-Index et Laravel pour LightNovelVF. Ils seront donc implémentés comme trois plugins TypeScript autonomes dans `plugins/french/` plutôt que comme variantes du générateur `lightnovelwp`.

Chaque plugin implémentera directement `Plugin.PluginBase` selon le guide officiel :

- métadonnées `id`, `name`, `icon`, `site` et `version` ;
- `popularNovels` avec prise en charge de la vue récente lorsque le site le permet ;
- `searchNovels` ;
- `parseNovel` ;
- `parseChapter` ;
- `resolveUrl`.

Les requêtes passeront par `fetchApi`. Cheerio sera utilisé pour les pages HTML. J-Garden utilisera en priorité les réponses JSON de WordPress afin de réduire sa dépendance à la mise en page Elementor.

## Icônes

Chaque source recevra une icône PNG 96 × 96 sous `public/static/src/fr/<id>/icon.png`, conformément au guide officiel. L’image proviendra du favicon ou du logo public du site et sera redimensionnée sans déformation.

## Robustesse et erreurs

- Une réponse HTTP non valide produira une erreur LNReader explicite invitant à ouvrir la vue Web si nécessaire.
- Les chemins seront normalisés pour éviter les doublons dus aux URL absolues, relatives ou aux barres obliques finales.
- Les listes ignoreront les entrées sans titre ou sans URL exploitable.
- `parseNovel` retournera une liste de chapitres ordonnée et dédupliquée.
- `parseChapter` échouera si aucun texte utile n’est trouvé, plutôt que de retourner silencieusement une page vide ou la navigation du site.
- Aucun contournement d’authentification ou de protection payante ne sera ajouté.

## Synchronisation automatique

Les nouveaux plugins autonomes font partie du catalogue français local. La projection depuis l’amont doit préserver ces fichiers lorsqu’ils n’existent pas dans l’amont et doit continuer à appliquer la liste d’exclusion permanente.

Phenix Scans, WorldNovel, MassNovel et MTLNovel-FR resteront exclus même si une synchronisation amont tente de les restaurer.

## Tests

Le développement suivra une approche pilotée par les tests :

1. Ajouter des fixtures HTML/JSON minimales et des tests de parseurs avant l’implémentation.
2. Vérifier le filtrage LN/WN de J-Garden et Trad-Index.
3. Vérifier la pagination, la déduplication et l’ordre des chapitres.
4. Vérifier que chaque parseur de chapitre conserve le texte utile et retire les éléments parasites.
5. Vérifier que la projection française exclut Phenix Scans.
6. Exécuter Prettier, le lint français, les tests unitaires, le build complet et la validation du manifeste.
7. Exécuter `npm run check:plugin` sur chacune des trois nouvelles sources contre le site réel.
8. Exécuter le contrôle réel de l’ensemble du catalogue français.

## Critères de réussite

- Phenix Scans n’est présent ni dans les sources, ni dans le build, ni dans le manifeste publié.
- J-Garden n’affiche aucun manga.
- Trad-Index n’affiche aucun manga, manhwa ou scan.
- Les trois plugins retournent au moins une œuvre, ses métadonnées, une liste de chapitres et le texte non vide d’un chapitre sans connexion.
- Les URL résolues ouvrent la bonne page publique.
- Tous les contrôles locaux et le workflow GitHub de publication réussissent.
- Le catalogue distant contient les trois nouveaux identifiants et ne contient pas `phenixscans`.
