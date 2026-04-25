import { NextRequest, NextResponse } from 'next/server';
import turfArea from '@turf/area';

const WFS_URL = 'https://data.geopf.fr/wfs/ows';
const LAYER = 'BDPARCELLAIRE-VECTEUR_WLD_BDD_WGS84G:parcelle';
// Small bbox around the click point to get the parcel under it
const DELTA = 0.0003;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lon = parseFloat(searchParams.get('lon') ?? '');
  const lat = parseFloat(searchParams.get('lat') ?? '');

  if (isNaN(lon) || isNaN(lat)) {
    return NextResponse.json({ error: 'lon and lat required' }, { status: 400 });
  }

  const bbox = `${lon - DELTA},${lat - DELTA},${lon + DELTA},${lat + DELTA},EPSG:4326`;
  const url =
    `${WFS_URL}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAMES=${encodeURIComponent(LAYER)}` +
    `&outputFormat=application/json` +
    `&COUNT=10` +
    `&BBOX=${bbox}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    console.error('WFS error:', res.status, await res.text());
    return NextResponse.json({ features: [] });
  }

  const data = await res.json();

  // Find the feature whose geometry actually contains the clicked point
  const containing = data.features?.find((f: GeoJSONFeature) =>
    pointInFeature(lon, lat, f)
  ) ?? data.features?.[0] ?? null;

  if (!containing) return NextResponse.json({ features: [] });

  // Calculate area in m² from geometry
  const superficie = Math.round(turfArea(containing));

  // Normalise to the shape fetchParcelAtPoint expects
  const p = containing.properties;
  const normalised = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: containing.geometry,
        properties: {
          code_dep: p.code_dep,
          code_com: p.code_com,
          section: p.section,
          numero: p.numero,
          nom_com: p.nom_com,
          superficie,
        },
      },
    ],
  };

  return NextResponse.json(normalised);
}

interface GeoJSONFeature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, string>;
}

function pointInFeature(lon: number, lat: number, feature: GeoJSONFeature): boolean {
  const { type, coordinates } = feature.geometry as {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  const rings =
    type === 'Polygon'
      ? (coordinates as number[][][])
      : (coordinates as number[][][][]).flat(1);
  return rings.some((ring) => pointInRing(lon, lat, ring));
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
