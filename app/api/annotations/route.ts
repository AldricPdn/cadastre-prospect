import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { annotations } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const commune = searchParams.get('commune');
  const status = searchParams.get('status');

  let query = db.select().from(annotations);

  if (commune) {
    query = query.where(eq(annotations.commune_code, commune)) as typeof query;
  }
  if (status) {
    query = query.where(eq(annotations.status, status)) as typeof query;
  }

  const rows = await query.orderBy(annotations.updated_at);
  return NextResponse.json({ annotations: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, status, owner_name, phone, notes, geometry, commune_code, section, numero } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const now = new Date();
  const result = await db
    .insert(annotations)
    .values({
      id,
      status: status ?? 'neutral',
      owner_name: owner_name ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
      geometry: geometry ?? null,
      commune_code: commune_code ?? null,
      section: section ?? null,
      numero: numero ?? null,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: annotations.id,
      set: {
        status: status ?? 'neutral',
        owner_name: owner_name ?? null,
        phone: phone ?? null,
        notes: notes ?? null,
        geometry: geometry ?? null,
        commune_code: commune_code ?? null,
        section: section ?? null,
        numero: numero ?? null,
        updated_at: now,
      },
    })
    .returning();

  return NextResponse.json({ annotation: result[0] });
}
