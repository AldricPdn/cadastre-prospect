'use client';

import { useState, useEffect } from 'react';
import { Annotation, AnnotationUpsert, ParcelFeature, Status } from '@/types';

interface Props {
  parcel: ParcelFeature;
  existing: Annotation | null;
  onSave: (data: AnnotationUpsert) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export default function DetailPanel({ parcel, existing, onSave, onDelete, onClose }: Props) {
  const [status, setStatus] = useState<Status>(existing?.status ?? 'neutral');
  const [ownerName, setOwnerName] = useState(existing?.owner_name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setStatus(existing?.status ?? 'neutral');
    setOwnerName(existing?.owner_name ?? '');
    setPhone(existing?.phone ?? '');
    setNotes(existing?.notes ?? '');
  }, [existing, parcel.id]);

  async function handleSave() {
    setSaving(true);
    await onSave({
      id: parcel.id,
      status,
      owner_name: ownerName,
      phone,
      notes,
      geometry: parcel.geometry,
      commune_code: parcel.commune_code,
      section: parcel.section,
      numero: parcel.numero,
    });
    setSaving(false);
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  const statusButtons: { value: Status; label: string; cls: string }[] = [
    { value: 'ok', label: 'Possible', cls: 'btn-ok' },
    { value: 'nok', label: 'Refusé', cls: 'btn-nok' },
    { value: 'neutral', label: 'Non visité', cls: 'btn-neutral' },
  ];

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-surface border border-border rounded-xl shadow-2xl z-10 flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-0.5">Parcelle</div>
          <div className="font-mono font-semibold text-sm">{parcel.id}</div>
          <div className="text-xs text-text-dim mt-0.5">
            {parcel.commune_code} · Section {parcel.section} · N° {parcel.numero}
          </div>
        </div>
        <button onClick={onClose} className="text-text-dim hover:text-text p-1 -mt-1 -mr-1">
          ✕
        </button>
      </div>

      <div className="flex gap-2">
        {statusButtons.map((b) => (
          <button
            key={b.value}
            onClick={() => setStatus(b.value)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              status === b.value
                ? b.value === 'ok'
                  ? 'bg-green/20 border-green text-green'
                  : b.value === 'nok'
                  ? 'bg-red/20 border-red text-red'
                  : 'bg-surface2 border-border text-text'
                : 'border-border text-text-dim hover:border-text-dim'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Propriétaire" value={ownerName} onChange={setOwnerName} placeholder="Nom du propriétaire" />
        <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="06 12 34 56 78" type="tel" />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-dim">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes libres…"
            rows={3}
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue placeholder:text-text-dim"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue hover:bg-blue/80 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {existing && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 text-red border border-red/30 hover:bg-red/10 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {deleting ? '…' : 'Supprimer'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-text-dim">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue placeholder:text-text-dim"
      />
    </div>
  );
}
