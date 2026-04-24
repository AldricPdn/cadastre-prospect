'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Annotation, AnnotationUpsert, ParcelFeature } from '@/types';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const GEOCODE_URL = 'https://api-adresse.data.gouv.fr/search/';

interface GeocodeSuggestion {
  label: string;
  lng: number;
  lat: number;
}

export default function Home() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<ParcelFeature | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<Annotation | null>(null);
  const [geoQuery, setGeoQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/annotations')
      .then((r) => r.json())
      .then((d) => setAnnotations(d.annotations ?? []));
  }, []);

  const handleParcelClick = useCallback(
    (parcel: ParcelFeature, existing: Annotation | null) => {
      setSelectedParcel(parcel);
      setSelectedExisting(existing);
    },
    []
  );

  async function handleSave(data: AnnotationUpsert) {
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const { annotation } = await res.json();
    setAnnotations((prev) => {
      const idx = prev.findIndex((a) => a.id === annotation.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = annotation;
        return next;
      }
      return [...prev, annotation];
    });
    setSelectedExisting(annotation);
  }

  async function handleDelete() {
    if (!selectedParcel) return;
    await fetch(`/api/annotations/${selectedParcel.id}`, { method: 'DELETE' });
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedParcel.id));
    setSelectedParcel(null);
    setSelectedExisting(null);
  }

  function handleClose() {
    setSelectedParcel(null);
    setSelectedExisting(null);
  }

  function handleSidebarSelect(a: Annotation) {
    if (a.geometry) {
      const coords =
        a.geometry.type === 'Polygon'
          ? (a.geometry.coordinates as number[][][])[0]
          : (a.geometry.coordinates as number[][][][])[0][0];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      setFlyTo({ lng: centerLng, lat: centerLat });
    }
    setSelectedParcel({
      id: a.id,
      commune_code: a.commune_code ?? '',
      section: a.section ?? '',
      numero: a.numero ?? '',
      geometry: a.geometry ?? { type: 'Polygon', coordinates: [] },
    });
    setSelectedExisting(a);
  }

  function handleGeoQueryChange(q: string) {
    setGeoQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${GEOCODE_URL}?q=${encodeURIComponent(q)}&limit=5`);
        const data = await res.json();
        setSuggestions(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.features ?? []).map((f: any) => ({
            label: f.properties.label,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
        );
      } catch {
        // ignore geocode errors
      }
    }, 350);
  }

  function handleSuggestionSelect(s: GeocodeSuggestion) {
    setFlyTo({ lng: s.lng, lat: s.lat });
    setGeoQuery(s.label);
    setSuggestions([]);
  }

  return (
    <div className="flex h-full">
      <Sidebar annotations={annotations} onSelect={handleSidebarSelect} />

      <div className="flex-1 relative">
        <Map
          annotations={annotations}
          onParcelClick={handleParcelClick}
          flyTo={flyTo}
          onFlyToDone={() => setFlyTo(null)}
        />

        <div className="absolute top-3 left-3 right-16 z-10">
          <div className="relative">
            <input
              type="text"
              value={geoQuery}
              onChange={(e) => handleGeoQueryChange(e.target.value)}
              placeholder="Rechercher une adresse…"
              className="w-full bg-surface/90 backdrop-blur border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue placeholder:text-text-dim shadow-lg"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestionSelect(s)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface2 transition-colors border-b border-border last:border-0"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedParcel && (
          <DetailPanel
            parcel={selectedParcel}
            existing={selectedExisting}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
