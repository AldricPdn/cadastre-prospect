export type Status = 'ok' | 'nok' | 'neutral';

export interface Annotation {
  id: string;
  status: Status;
  owner_name: string | null;
  phone: string | null;
  notes: string | null;
  geometry: GeoJSONPolygon | null;
  commune_code: string | null;
  section: string | null;
  numero: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeoJSONPolygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface ParcelFeature {
  id: string;
  commune_code: string;
  section: string;
  numero: string;
  nom_com: string;
  superficie: number | null;
  geometry: GeoJSONPolygon;
}

export interface AnnotationUpsert {
  id: string;
  status: Status;
  owner_name?: string;
  phone?: string;
  notes?: string;
  geometry?: GeoJSONPolygon;
  commune_code?: string;
  section?: string;
  numero?: string;
}
