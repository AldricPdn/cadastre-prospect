'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSON } from 'geojson';
import { Annotation, ParcelFeature } from '@/types';

// WMTS is far more reliable than WMS with MapLibre (standard xyz tiles, no bbox trick)
const WMTS_CADASTRE =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&FORMAT=image/png' +
  '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

async function fetchParcelAtPoint(lng: number, lat: number): Promise<ParcelFeature | null> {
  try {
    // Proxied through our API route to avoid CORS issues
    const res = await fetch(`/api/parcelle?lon=${lng}&lat=${lat}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.features?.length) return null;
    const f = data.features[0];
    const props = f.properties;
    // API Carto returns code_dep + code_com, or code_insee directly depending on version
    const communeCode =
      props.code_insee ??
      `${props.code_dep ?? ''}${String(props.code_com ?? '').padStart(3, '0')}`;
    const section = (props.section ?? '').trim();
    const numero = (props.numero ?? '').trim();
    const id = `${communeCode}${section}${numero}`;
    console.log('Parcel found:', { id, communeCode, section, numero, props });
    return { id, commune_code: communeCode, section, numero, geometry: f.geometry };
  } catch {
    return null;
  }
}

interface Props {
  annotations: Annotation[];
  onParcelClick: (parcel: ParcelFeature, existing: Annotation | null) => void;
  flyTo: { lng: number; lat: number } | null;
  onFlyToDone: () => void;
}

export default function Map({ annotations, onParcelClick, flyTo, onFlyToDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const annotationsRef = useRef<Annotation[]>(annotations);
  const onParcelClickRef = useRef(onParcelClick);
  const onFlyToDoneRef = useRef(onFlyToDone);

  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { onParcelClickRef.current = onParcelClick; }, [onParcelClick]);
  useEffect(() => { onFlyToDoneRef.current = onFlyToDone; }, [onFlyToDone]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© CartoDB © OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'carto-dark', type: 'raster', source: 'carto-dark' }],
      },
      center: [-1.6, 48.5],
      zoom: 9,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('wmts-cadastre', {
        type: 'raster',
        tiles: [WMTS_CADASTRE],
        tileSize: 256,
        minzoom: 12,
        maxzoom: 20,
      });
      map.addLayer({ id: 'wmts-cadastre', type: 'raster', source: 'wmts-cadastre', minzoom: 12 });

      map.addSource('annotations', {
        type: 'geojson',
        data: buildAnnotationsGeoJSON(annotationsRef.current),
      });

      map.addLayer({
        id: 'annotations-fill',
        type: 'fill',
        source: 'annotations',
        paint: {
          'fill-color': ['match', ['get', 'status'], 'ok', '#22c55e', 'nok', '#ef4444', '#6b7280'],
          'fill-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'annotations-outline',
        type: 'line',
        source: 'annotations',
        paint: {
          'line-color': ['match', ['get', 'status'], 'ok', '#22c55e', 'nok', '#ef4444', '#6b7280'],
          'line-width': 2,
        },
      });
    });

    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat;
      map.getCanvas().style.cursor = 'wait';
      const parcel = await fetchParcelAtPoint(lng, lat);
      map.getCanvas().style.cursor = 'crosshair';
      if (!parcel) return;
      const existing = annotationsRef.current.find((a) => a.id === parcel.id) ?? null;
      onParcelClickRef.current(parcel, existing);
    });

    map.getCanvas().style.cursor = 'crosshair';

    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('annotations') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(buildAnnotationsGeoJSON(annotations));
  }, [annotations]);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 16 });
    onFlyToDoneRef.current();
  }, [flyTo]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function buildAnnotationsGeoJSON(annotations: Annotation[]): GeoJSON {
  return {
    type: 'FeatureCollection',
    features: annotations
      .filter((a) => a.geometry)
      .map((a) => ({
        type: 'Feature' as const,
        // Cast our union type to the GeoJSON spec's discriminated union
        geometry: a.geometry as unknown as GeoJSON.Geometry,
        properties: { id: a.id, status: a.status },
      })),
  };
}
