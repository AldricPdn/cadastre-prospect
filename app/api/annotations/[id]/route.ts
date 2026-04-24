import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { annotations } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const rows = await db.select().from(annotations).where(eq(annotations.id, params.id));
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ annotation: rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db.delete(annotations).where(eq(annotations.id, params.id));
  return NextResponse.json({ ok: true });
}
