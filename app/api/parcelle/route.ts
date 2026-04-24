import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lon = searchParams.get('lon');
  const lat = searchParams.get('lat');

  if (!lon || !lat) {
    return NextResponse.json({ error: 'lon and lat required' }, { status: 400 });
  }

  const res = await fetch(
    `https://apicarto.ign.fr/api/cadastre/parcelle?lon=${lon}&lat=${lat}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!res.ok) {
    console.error('API Carto error:', res.status, await res.text());
    return NextResponse.json({ features: [] });
  }

  const data = await res.json();
  console.log('API Carto response:', JSON.stringify(data).slice(0, 500));
  return NextResponse.json(data);
}
