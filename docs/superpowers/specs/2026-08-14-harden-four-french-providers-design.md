# Robustesse des quatre providers français

Date : 14 août 2026

## Objectif

Corriger les défaillances observées dans LightNovelVF, Trad-Index, Chireads et
J-Garden sans modifier leurs sources de contenu ni ajouter de dépendance.

## Conception

### LightNovelVF

- Conserver la récupération séquentielle des pages de chapitres.
- En cas de réponse HTTP 429, lire `Retry-After`, attendre, puis rejouer la
  même page avec un nombre borné de tentatives.
- Accepter `Retry-After` en secondes ou sous forme de date HTTP.
- Valider le type JSON et la forme de la réponse avant de l'utiliser.
- Suivre le `last_page` renvoyé par le serveur sans plafond arbitraire.
- Ne jamais retourner une liste partielle si une page reste inaccessible.

### Trad-Index

- Interroger séparément les catalogues Web Novel et Light Novel avec
  `Promise.allSettled`.
- Conserver la section disponible lorsqu'une seule échoue, mais lever une
  erreur explicite lorsque les deux échouent.
- Réessayer chaque page de chapitres individuellement et refuser une liste
  partielle après épuisement des tentatives.

### Chireads

- Rejeter les réponses HTTP non valides avant de parser le HTML ou le JSON.
- Tolérer la panne d'un seul catalogue ou parent WordPress, mais signaler une
  panne totale.
- Dédupliquer les chapitres par URL compacte et renseigner `chapterNumber` et
  `releaseTime` avant de supprimer l'ancienne URL datée.
- Nettoyer le contenu de lecture et rejeter les chapitres vides ou trop courts.
- Normaliser les couvertures en URL absolues.

### J-Garden

- Tolérer la panne d'une seule section du catalogue et signaler une panne
  totale.
- Refuser toute URL étrangère, y compris dans le fallback de chapitre.
- Normaliser la couverture en URL absolue.
- Ne plus déclarer `Ongoing` sans preuve dans la page.
- Ajouter un `chapterNumber` monotone après le tri métier existant.
- Valider les réponses JSON WordPress.

## Gestion des erreurs

Les retries sont bornés et réservés aux erreurs transitoires : HTTP 429 et
5xx. `Retry-After` est prioritaire; sans valeur exploitable, une courte attente
progressive est utilisée. Les erreurs permanentes et les réponses au format
inattendu échouent immédiatement avec un message explicite.

## Tests

Chaque changement commence par un test de régression observé en échec :

- 429 puis succès sur la même page et pagination supérieure à 500 pour
  LightNovelVF;
- panne partielle et panne totale des catalogues, plus retry de page de
  chapitres, pour Trad-Index;
- statut HTTP, déduplication, métadonnées et contenu court pour Chireads;
- panne partielle, origine étrangère, couverture, statut et numérotation pour
  J-Garden.

La livraison exige ensuite les tests unitaires, la compilation TypeScript, le
lint ciblé, le contrôle de format, les checks live des quatre providers et un
test live spécifique de Supreme Magus.

## Critères de réussite

- Supreme Magus charge ses 2 456 chapitres malgré le quota du serveur.
- Une section de catalogue indisponible ne masque pas la section valide.
- Une panne totale ou une liste de chapitres incomplète est signalée.
- Les chapitres Chireads sont uniques, compacts et dotés de métadonnées.
- J-Garden n'accède à aucun domaine étranger et expose des métadonnées
  normalisées.
- Aucun fichier étranger au périmètre n'est ajouté au commit.
