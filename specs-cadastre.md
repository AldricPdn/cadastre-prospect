# SPECS — Carte Cadastrale de Prospection

## Résumé

Outil web personnel pour la prospection de terrains dans le cadre d'un projet associatif. Permet de naviguer sur les parcelles cadastrales de Normandie et Bretagne, d'annoter chaque parcelle (nom proprio, téléphone, notes, statut), et de les colorer selon leur viabilité (vert = possible, rouge = refusé, gris = non visité).

C'est un outil perso de travail, pas un produit public. Un seul utilisateur (moi). Pas besoin d'auth pour le moment, mais la base doit être propre pour l'ajouter plus tard si nécessaire.

---

## Stack technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Framework | **Next.js 14+ (App Router)** | Frontend + API routes dans un seul projet, déploiement natif sur Vercel |
| Carte | **MapLibre GL JS** | Gratuit, performant, supporte les tuiles vectorielles (indispensable pour charger les parcelles dynamiquement) |
| Parcelles cadastrales | **Tuiles WMS de la Géoplateforme IGN** | Pas besoin de stocker les géométries, le rendu est côté serveur IGN |
| Base de données | **Vercel Postgres (Neon)** | Gratuit, intégré, suffisant pour stocker quelques milliers d'annotations |
| ORM | **Drizzle** | Léger, type-safe, bon support Neon/Postgres |
| Hébergement | **Vercel** | Gratuit, déploiement auto depuis GitHub |

---

## Architecture

```
cadastre-prospect/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Page principale (carte + sidebar)
│   │   ├── layout.tsx
│   │   └── api/
│   │       └── annotations/
│   │           ├── route.ts      # GET (list) + POST (create/update)
│   │           └── [id]/
│   │               └── route.ts  # GET (one) + DELETE
│   ├── components/
│   │   ├── Map.tsx               # Carte MapLibre avec couche cadastre
│   │   ├── Sidebar.tsx           # Liste des parcelles annotées + recherche
│   │   ├── DetailPanel.tsx       # Panneau d'édition d'une parcelle
│   │   └── StatsBar.tsx          # Compteurs vert/rouge/total
│   ├── lib/
│   │   ├── db.ts                 # Config Drizzle + connexion Neon
│   │   └── schema.ts             # Schéma de la table annotations
│   └── types/
│       └── index.ts              # Types TypeScript partagés
├── drizzle/
│   └── migrations/               # Migrations auto-générées
├── CLAUDE.md
├── package.json
└── drizzle.config.ts
```

---

## Source des parcelles cadastrales

### Approche retenue : WMS IGN en overlay

On n'a PAS besoin de stocker les géométries des parcelles. L'IGN fournit un service WMS gratuit qui rend les parcelles à la volée côté serveur.

**URL du service WMS :**
```
https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox}&WIDTH=256&HEIGHT=256
```

**Couche principale :** `CADASTRALPARCELS.PARCELLAIRE_EXPRESS`

Le WMS retourne des images (tuiles raster) avec les contours des parcelles dessinés. On les superpose sur la carte MapLibre comme une couche supplémentaire.

### Identification des parcelles au clic

Quand l'utilisateur clique sur la carte, on fait un appel **WMS GetFeatureInfo** pour identifier la parcelle sous le curseur :

```
https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&QUERY_LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&INFO_FORMAT=application/json&CRS=EPSG:4326&BBOX={bbox}&WIDTH=256&HEIGHT=256&I={x}&J={y}
```

Ça retourne l'identifiant de la parcelle (section + numéro), qu'on utilise comme clé pour stocker les annotations.

### Alternative : API Carto (si GetFeatureInfo insuffisant)

```
https://apicarto.ign.fr/api/cadastre/parcelle?lon={lng}&lat={lat}
```

Retourne le GeoJSON de la parcelle avec ses propriétés. Plus fiable pour l'identification, mais plus lent.

---

## Couche d'annotations (overlay coloré)

C'est le cœur de l'outil. Les parcelles annotées doivent être surlignées sur la carte.

### Comment ça marche

1. Au chargement, on récupère toutes les annotations depuis l'API (`GET /api/annotations`).
2. Pour chaque annotation qui a un `status` vert ou rouge, on a besoin de sa géométrie pour la dessiner sur la carte.
3. **Deux options pour les géométries :**

**Option A — Stocker la géométrie à l'annotation (recommandé pour commencer) :**
Quand l'utilisateur annote une parcelle, on récupère sa géométrie via l'API Carto et on la stocke dans la base. Comme on n'aura que quelques dizaines/centaines d'annotations, c'est gérable.

**Option B — Charger les géométries à la volée :**
On ne stocke que l'identifiant, et on re-fetch les géométries au chargement. Plus propre mais plus lent.

→ **Partir sur l'option A.** On stocke le GeoJSON de la parcelle dans la table annotations. Au chargement, on crée une couche GeoJSON MapLibre avec toutes les annotations colorées.

---

## Schéma de base de données

### Table `annotations`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `text` PRIMARY KEY | Identifiant cadastral de la parcelle (ex: "50218000AB0123") |
| `status` | `text` NOT NULL DEFAULT 'neutral' | 'ok', 'nok', ou 'neutral' |
| `owner_name` | `text` | Nom du propriétaire |
| `phone` | `text` | Numéro de téléphone |
| `notes` | `text` | Notes libres |
| `geometry` | `jsonb` | GeoJSON de la géométrie de la parcelle |
| `commune_code` | `text` | Code INSEE de la commune (ex: "50218") |
| `section` | `text` | Section cadastrale (ex: "AB") |
| `numero` | `text` | Numéro de parcelle (ex: "0123") |
| `created_at` | `timestamp` DEFAULT now() | Date de création |
| `updated_at` | `timestamp` DEFAULT now() | Date de dernière modification |

---

## API Routes

### `GET /api/annotations`

Retourne toutes les annotations. Paramètres optionnels :
- `?commune=50218` — filtrer par commune
- `?status=ok` — filtrer par statut

Réponse : `{ annotations: Annotation[] }`

### `POST /api/annotations`

Crée ou met à jour une annotation (upsert sur l'id).

Body :
```json
{
  "id": "50218000AB0123",
  "status": "ok",
  "owner_name": "M. Dupont",
  "phone": "06 12 34 56 78",
  "notes": "Terrain plat, proprio ok",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "commune_code": "50218",
  "section": "AB",
  "numero": "0123"
}
```

### `DELETE /api/annotations/[id]`

Supprime une annotation.

---

## Fonctionnalités UI

### Carte (composant principal)

- Fond de carte sombre (CartoDB Dark Matter ou style MapLibre dark)
- Couche WMS cadastre IGN superposée (contours des parcelles)
- Couche GeoJSON des annotations colorées par-dessus :
  - Vert semi-transparent : status = 'ok'
  - Rouge semi-transparent : status = 'nok'
  - Pas de couleur pour 'neutral' (la parcelle apparaît juste via le WMS)
- Clic sur une parcelle → identifie via GetFeatureInfo → ouvre le panneau d'édition
- Zoom/pan fluide sur toute la Normandie/Bretagne

### Sidebar

- Compteurs en haut : nombre de vert, rouge, total annoté
- Barre de recherche : filtre par nom proprio, numéro de parcelle, commune
- Liste des parcelles annotées (triées : vert d'abord, puis rouge, puis neutre)
- Clic sur un item → zoome sur la parcelle et ouvre le panneau

### Panneau d'édition (overlay sur la carte)

- Titre : identifiant de la parcelle
- Boutons de statut : Possible (vert) / Refusé (rouge) / Non visité (gris)
- Champs : nom proprio, téléphone, notes (textarea)
- Bouton Enregistrer
- Bouton Supprimer l'annotation

### Recherche par adresse

- Barre de recherche en haut de la carte
- Utilise l'API Adresse (api-adresse.data.gouv.fr) pour géocoder
- Résultat → centre la carte sur l'adresse

### Export CSV

- Bouton en bas de la sidebar
- Exporte toutes les annotations en CSV : id, commune, section, numéro, statut, proprio, tel, notes

---

## Contraintes et limites

- **Pas d'auth pour l'instant.** L'app est accessible sans login. La base est exposée. C'est un outil perso sur une URL que personne ne connaît. On ajoutera un simple password middleware ou Vercel Auth plus tard si nécessaire.
- **WMS = images, pas de vecteurs.** On ne peut pas styler individuellement les parcelles côté WMS. La coloration vient de notre couche GeoJSON par-dessus. C'est un peu redondant visuellement (contours WMS + fill GeoJSON) mais c'est le compromis le plus simple.
- **Limites de l'API Carto IGN.** L'API Carto n'a pas de rate limiting documenté mais elle est gratuite et sans clé. Ne pas abuser (pas de scraping massif). Usage normal (quelques requêtes par clic) = aucun problème.
- **Les noms de propriétaires ne viennent PAS du cadastre open data.** Les données MAJIC (propriétaires) ne sont pas publiques. C'est l'utilisateur qui remplit manuellement après avoir contacté la mairie ou fait du bouche à oreille.

---

## Déploiement

1. Push sur GitHub → Vercel déploie automatiquement
2. Créer une base Postgres sur Vercel (dashboard → Storage → Create → Postgres)
3. Variables d'environnement automatiquement injectées par Vercel (`POSTGRES_URL`, etc.)
4. Lancer les migrations : `npx drizzle-kit push`

---

## Évolutions possibles (pas pour la v1)

- Auth basique (password ou Vercel Auth)
- Filtrage par département / région sur la carte
- Import/export JSON des annotations (backup)
- Mode offline (PWA + cache local)
- Multi-utilisateurs avec rôles
- Couche Natura 2000 / zones protégées en overlay
- Intégration Géoportail pour le relief et les photos aériennes
