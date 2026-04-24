'use client';

import { Annotation } from '@/types';

interface Props {
  annotations: Annotation[];
}

export default function StatsBar({ annotations }: Props) {
  const ok = annotations.filter((a) => a.status === 'ok').length;
  const nok = annotations.filter((a) => a.status === 'nok').length;
  const total = annotations.length;

  return (
    <div className="flex gap-3 p-3 border-b border-border">
      <Stat label="Possible" value={ok} color="text-green" />
      <Stat label="Refusé" value={nok} color="text-red" />
      <Stat label="Total" value={total} color="text-text-dim" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-text-dim">{label}</div>
    </div>
  );
}
