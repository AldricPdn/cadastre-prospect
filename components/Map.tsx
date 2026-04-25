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
    const url = `/api/parcelle?lon=${lng}&lat=${lat}`;
    console.log('[cadastre] fetching', url);
    const res = await fetch(url);
    console.log('[cadastre] proxy status', res.status);
    if (!res.ok) return null;
    const data = await res.json();
    console.log('[cadastre] proxy data', JSON.stringify(data).slice(0, 300));
    if (!data.features?.length) return null;
    const f = data.features[0];
    const props = f.properties;
    const communeCode =
      props.code_insee ??
      `${props.code_dep ?? ''}${String(props.code_com ?? '').padStart(3, '0')}`;
    const section = (props.section ?? '').trim();
    const numero = (props.numero ?? '').trim();
    const id = `${communeCode}${section}${numero}`;
    console.log('[cadastre] parcel id', id, props);
    return {
      id,
      commune_code: communeCode,
      section,
      numero,
      nom_com: props.nom_com ?? '',
      superficie: props.superficie ? Number(props.superficie) : null,
      geometry: f.geometry,
    };
  } catch (err) {
    console.error('[cadastre] fetch error', err);
    return null;
  }
}

interface Props {
  annotations: Annotation[];
  onParcelClick: (parcel: ParcelFeature, existing: Annotation | null) => void;
  flyTo: { lng: number; lat: number } | null;
  onFlyToDone: () => void;
}

function updateScaleBar(
  map: maplibregl.Map,
  barEl: HTMLDivElement | null,
  labelEl: HTMLSpanElement | null,
) {
  if (!barEl || !labelEl) return;
  const { height } = map.getContainer().getBoundingClientRect();
  const cy = height / 2;
  const p1 = map.unproject([0, cy]);
  const p2 = map.unproject([100, cy]);
  const R = 6371008;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const metersPerPx = (2 * R * Math.asin(Math.sqrt(a))) / 100;
  const targets = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const nice = targets.find((t) => t >= metersPerPx * 120) ?? 50000;
  barEl.style.width = `${Math.round(nice / metersPerPx)}px`;
  labelEl.textContent = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
}

export default function Map({ annotations, onParcelClick, flyTo, onFlyToDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const annotationsRef = useRef<Annotation[]>(annotations);
  const onParcelClickRef = useRef(onParcelClick);
  const onFlyToDoneRef = useRef(onFlyToDone);
  const scaleBarRef = useRef<HTMLDivElement>(null);
  const scaleLabelRef = useRef<HTMLSpanElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  annotationsRef.current = annotations;
  onParcelClickRef.current = onParcelClick;
  onFlyToDoneRef.current = onFlyToDone;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-1.6, 48.5],
      zoom: 9,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      if (map.getLayer('boundary_county')) {
        map.setLayerZoomRange('boundary_county', 9, 14);
      }

      fetch('https://geo.api.gouv.fr/departements?fields=nom,code,contour&format=geojson')
        .then((r) => r.json())
        .then((data) => {
          if (!map.isStyleLoaded()) return;
          map.addSource('departements', { type: 'geojson', data });
          map.addLayer({
            id: 'departements-outline',
            type: 'line',
            source: 'departements',
            minzoom: 4,
            paint: {
              'line-color': '#818cf8',
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 2],
              'line-opacity': 0.7,
              'line-dasharray': [5, 3],
            },
          });
        })
        .catch(() => {});


      if (map.getLayer('building-top')) {
        map.setPaintProperty('building-top', 'fill-color', '#ef4444');
        map.setPaintProperty('building-top', 'fill-opacity', [
          'interpolate', ['linear'], ['zoom'],
          13, 0,
          14, 0.45,
          16, 0.65,
        ]);
      }

      updateScaleBar(map, scaleBarRef.current, scaleLabelRef.current);

      map.addSource('wmts-cadastre', {
        type: 'raster',
        tiles: [WMTS_CADASTRE],
        tileSize: 256,
        minzoom: 8,
        maxzoom: 19,
      });
      map.addLayer({
        id: 'wmts-cadastre',
        type: 'raster',
        source: 'wmts-cadastre',
        minzoom: 8,
        paint: {
          'raster-opacity': 0.45,
          'raster-saturation': -0.85,
        },
      });

      map.addSource('annotations', {
        type: 'geojson',
        data: buildAnnotationsGeoJSON(annotationsRef.current),
      });

      map.addLayer({
        id: 'annotations-fill',
        type: 'fill',
        source: 'annotations',
        paint: {
          'fill-color': ['match', ['get', 'status'], 'ok', '#22c55e', 'nok', '#ef4444', 'maybe', '#f97316', '#6b7280'],
          'fill-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'annotations-outline',
        type: 'line',
        source: 'annotations',
        paint: {
          'line-color': ['match', ['get', 'status'], 'ok', '#22c55e', 'nok', '#ef4444', 'maybe', '#f97316', '#6b7280'],
          'line-width': 2,
        },
      });
    });

    map.on('move', () => updateScaleBar(map, scaleBarRef.current, scaleLabelRef.current));

    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat;
      map.getCanvas().style.cursor = 'wait';
      if (loadingRef.current) loadingRef.current.style.display = 'flex';
      const parcel = await fetchParcelAtPoint(lng, lat);
      map.getCanvas().style.cursor = 'crosshair';
      if (loadingRef.current) loadingRef.current.style.display = 'none';
      if (!parcel) return;
      const existing = annotationsRef.current.find((a) => a.id === parcel.id) ?? null;
      onParcelClickRef.current(parcel, existing);
    });

    map.getCanvas().style.cursor = 'crosshair';

    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('annotations') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(buildAnnotationsGeoJSON(annotations));
  }, [annotations]);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 16 });
    onFlyToDoneRef.current();
  }, [flyTo]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Scale bar — slightly below vertical center */}
      <div className="absolute top-1/2 mt-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none select-none z-10">
        <div
          ref={scaleBarRef}
          className="border-b-2 border-l-2 border-r-2 border-white/50 h-2"
          style={{ width: 120 }}
        />
        <span ref={scaleLabelRef} className="text-[11px] text-white/50 font-mono mt-0.5" />
      </div>

      {/* Loading indicator while WFS fetches */}
      <div
        ref={loadingRef}
        style={{ display: 'none' }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
      >
        <div className="bg-black/60 backdrop-blur rounded-lg px-4 py-2 text-sm text-white/80 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
          Identification…
        </div>
      </div>
    </div>
  );
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
