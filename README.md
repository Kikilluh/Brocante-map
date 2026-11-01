# Brocante Map

Carte interactive des brocantes, vide-greniers, braderies et marchés aux puces, d'abord en **Indre-et-Loire (37)**, et prévue pour couvrir ensuite la France entière.

- Carte Leaflet (fond **Plan IGN** ou OpenStreetMap), regroupement des marqueurs, géolocalisation
- Filtre par **date ou plage de dates** : aujourd'hui, ce week-end, week-end prochain, 7 / 30 jours, ou dates libres
- Filtre par type (brocante, vide-grenier, braderie, puces, bourse) et recherche par commune ou mot-clé
- Liste triée par date ou par distance ; les filtres sont dans l'URL, donc on peut partager le lien
- Données **collectées automatiquement chaque jour** par GitHub Actions, puis site déployé sur **Firebase Hosting**

## Arborescence

```
public/                  site statique (aucune étape de build)
  index.html, app.js, style.css
  data/brocantes.json    données réelles (générées par le collecteur)
  data/demo.json         données FICTIVES affichées tant que brocantes.json est absent ou vide
scraper/
  index.mjs              collecte → normalisation → géocodage → dédoublonnage → JSON
  config.json            départements couverts + sources
  sources/               un adaptateur par type de source
  lib/                   extraction schema.org, géocodage BAN, dédoublonnage, HTTP poli
  cache/geocode.json     cache du géocodage (versionné)
  test/                  tests (node --test)
data/manual.json         ajouts manuels d'événements
.github/workflows/       collecte quotidienne + déploiement Firebase
```

Aucune dépendance npm : il faut seulement Node ≥ 20.

```bash
npm test          # tests du collecteur
npm run scrape    # collecte (options : --only=brocabrac.fr  --dept=37,41)
npm run serve     # site en local sur http://localhost:5000
```

## Sources de données

| Source | État | Mise en place |
|---|---|---|
| DATAtourisme (API) | ✅ actif | clé API gratuite → secret `DATATOURISME_API_KEY` (ancien flux Diffuseur : `DATATOURISME_FEED_URL`, fermeture oct. 2027) |
| OpenAgenda | ✅ actif | secret `OPENAGENDA_KEY` + UID des agendas dans `config.json` |
| Manuel | ✅ actif | `data/manual.json` : `[{ "title", "start": "AAAA-MM-JJ", "end", "city", "postcode", "address" }]` |
| vide-greniers.org | ⏸ désactivé | en attente d'accord écrit du site, puis `"enabled": true` |
| brocabrac.fr | ⏸ désactivé | en attente d'accord écrit du site, puis `"enabled": true` |

**API DATAtourisme :** le connecteur interroge `/v1/catalog` avec le paramètre `search` pour chaque mot-clé de `searchTerms`, puis ne garde que les départements configurés. Le format exact des réponses n'a pas pu être vérifié lors de l'écriture : au premier lancement, les logs affichent une ligne `[diagnostic]` avec la structure reçue. Les noms de paramètres (`pageSizeParam`, `pageParam`, `extraParams`) se règlent dans `config.json` sans toucher au code.

Les sites d'annonces sont lus par un **extracteur générique schema.org** (JSON-LD, avec les microdonnées en repli). Ces sites publient en général ces balises pour Google, ce qui résiste mieux à un changement de mise en page qu'un parseur écrit pour un site précis. Pour ajouter un site, il suffit d'ajouter une entrée `structured-html` dans `config.json` avec ses URL de liste (`{dept}` et `{page}` sont remplacés).

> ⚠️ **À vérifier au premier lancement :** les URL de liste et les motifs de liens de vide-greniers.org et brocabrac.fr ont été écrits sans pouvoir accéder à ces sites. Le premier run de l'Action indique dans ses logs combien d'événements chaque source a renvoyés. Si une source renvoie 0, il faut ajuster son URL dans `config.json`.

> ⚖️ **Aspect juridique :** lire les CGU de chaque site. Les bases de données sont protégées en droit français (droit *sui generis* du producteur), et certains sites interdisent l'extraction. Le collecteur respecte `robots.txt`, s'identifie et attend 1,5 s entre deux requêtes. Mais pour un service public à l'échelle de la France, le plus sûr est de **demander une autorisation ou un partenariat** à ces sites, et de privilégier l'open data (DATAtourisme, OpenAgenda).

Le traitement est le suivant :
1. Normalisation (titre, type, dates à l'heure de Paris).
2. Géocodage par la [Base Adresse Nationale](https://adresse.data.gouv.fr), gratuite et sans clé, avec un cache.
3. Filtrage sur les départements configurés et sur les 12 prochains mois.
4. Fusion des doublons publiés sur plusieurs sites (même commune et même date, titres proches).

Si toutes les sources échouent, les données précédentes encore à venir sont conservées.

## Déploiement Firebase

Site en ligne : **https://brocante-map.web.app** (projet Firebase `brocante-map`).

- Le secret GitHub `FIREBASE_SERVICE_ACCOUNT` contient la clé JSON du compte `github@brocante-map-513408.iam.gserviceaccount.com`.
  Ce compte vit dans le projet Google Cloud `brocante-map-513408` (à conserver) et a reçu, dans l'IAM du projet `brocante-map`,
  les rôles *Administrateur Firebase Hosting*, *Consommateur Service Usage*, *Lecteur de clés API* et *Lecteur Cloud Run*.
- Les API *Firebase Management* et *Firebase Hosting* doivent être activées dans `brocante-map-513408`.
- Le workflow `update-and-deploy.yml` tourne chaque jour vers 5 h, à chaque push sur `main`, ou à la main (Actions → Run workflow).
- Pour viser un autre projet : variable GitHub `FIREBASE_PROJECT_ID`.

## Passage à la France entière

- Ajouter les codes de département dans `scraper/config.json` → `departments`.
- Au-delà de quelques milliers d'événements, découper la sortie en un fichier par département (`data/37.json`…) et ne charger que ceux qui sont visibles. On peut aussi migrer vers **Firestore** avec une **Cloud Function planifiée** (`onSchedule`) qui reprend les modules de `scraper/lib`. Le format des événements ne change pas.
- Pour un trafic important, remplacer les tuiles OpenStreetMap par Plan IGN (déjà par défaut) ou par un fournisseur avec clé, comme MapTiler ou Stadia.

## Régénérer les données de démonstration

`node scraper/tools/make-demo.mjs 2026-11-01` génère 140 événements **fictifs** à partir de cette date. Ils ne servent qu'à afficher une carte avant la première collecte.
