# CLAUDE.md — Cadastre Prospect

## Projet

Outil web personnel de prospection terrain. Carte interactive affichant les parcelles cadastrales de Normandie/Bretagne avec une couche d'annotations perso (nom proprio, téléphone, notes, statut vert/rouge/gris).

Un seul utilisateur. Pas d'auth. Hébergé sur Vercel.

## Stack

- **Next.js 14+** (App Router, TypeScript)
- **MapLibre GL JS** pour la carte
- **WMS IGN** (`data.geopf.fr`) pour les contours cadastraux
- **API Carto IGN** (`apicarto.ign.fr`) pour identifier les parcelles au clic
- **Vercel Postgres (Neon)** pour stocker les annotations
- **Drizzle ORM** pour la DB

## Commandes

```bash
npm run dev          # Dev server
npm run build        # Build prod
npx drizzle-kit push # Push schema to DB
npx drizzle-kit generate # Generate migrations
```

## Variables d'environnement

Fournies automatiquement par Vercel Postgres :
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

Pour le dev local, copier depuis Vercel dashboard → Storage → `.env.local`.

## Architecture

```
src/
├── app/
│   ├── page.tsx                    # Page principale
│   ├── layout.tsx
│   └── api/annotations/
│       ├── route.ts                # GET (list) + POST (upsert)
│       └── [id]/route.ts           # GET + DELETE
├── components/
│   ├── Map.tsx                     # MapLibre + couche WMS + couche annotations
│   ├── Sidebar.tsx                 # Liste annotées + recherche + stats
│   ├── DetailPanel.tsx             # Édition d'une parcelle
│   └── StatsBar.tsx                # Compteurs
├── lib/
│   ├── db.ts                       # Connexion Drizzle/Neon
│   └── schema.ts                   # Table annotations
└── types/index.ts
```

## Table `annotations`

```sql
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,             -- ex: "50218000AB0123"
  status TEXT NOT NULL DEFAULT 'neutral',  -- 'ok' | 'nok' | 'neutral'
  owner_name TEXT,
  phone TEXT,
  notes TEXT,
  geometry JSONB,                  -- GeoJSON Polygon
  commune_code TEXT,               -- ex: "50218"
  section TEXT,                    -- ex: "AB"
  numero TEXT,                     -- ex: "0123"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Sources de données externes

### Parcelles cadastrales (affichage)

WMS IGN — affiche les contours des parcelles en overlay sur la carte :
```
https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap
&LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS
&FORMAT=image/png&TRANSPARENT=true
&CRS=EPSG:3857&BBOX={bbox}&WIDTH=256&HEIGHT=256
```

### Identification parcelle au clic

Option 1 — WMS GetFeatureInfo :
```
https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo
&LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS
&QUERY_LAYERS=CADASTRALPARCELS.PARCELLAIRE_EXPRESS
&INFO_FORMAT=application/json
&CRS=EPSG:4326&BBOX={bbox}&WIDTH=256&HEIGHT=256&I={x}&J={y}
```

Option 2 — API Carto (plus fiable, retourne le GeoJSON complet) :
```
https://apicarto.ign.fr/api/cadastre/parcelle?lon={lng}&lat={lat}
```

### Géocodage (recherche par adresse)

API Adresse : `https://api-adresse.data.gouv.fr/search/?q={query}`

## Comportement clé

1. La carte affiche le fond CartoDB Dark + la couche WMS cadastre
2. L'utilisateur clique sur une parcelle → appel GetFeatureInfo/API Carto → identification
3. Le panneau d'édition s'ouvre avec les infos de la parcelle
4. L'utilisateur remplit proprio/tel/notes/statut → POST /api/annotations
5. La géométrie GeoJSON est stockée en base avec l'annotation
6. Au chargement, toutes les annotations sont récupérées et dessinées comme une couche GeoJSON colorée (vert = ok, rouge = nok)
7. La sidebar liste les parcelles annotées avec recherche et filtres

## Conventions

- Code et commentaires en anglais
- UI et labels en français
- Pas de sur-ingénierie : c'est un outil perso, pas un SaaS
- Pas d'auth pour la v1
- Le design est sombre (dark theme), sobre, fonctionnel
- Mobile-friendly n'est pas prioritaire mais ne pas casser le layout non plus

## Ce qu'il ne faut PAS faire

- Ne PAS stocker toutes les parcelles de France en base — on stocke uniquement les parcelles annotées
- Ne PAS essayer de télécharger les GeoJSON communaux complets — on utilise le WMS pour l'affichage
- Ne PAS ajouter d'authentification pour l'instant
- Ne PAS utiliser Mapbox (payant) — MapLibre est le fork gratuit
