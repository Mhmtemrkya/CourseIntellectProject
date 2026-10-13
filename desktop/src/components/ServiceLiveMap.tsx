import { useState } from 'react';
import type { AdminServiceLiveTripDto } from '../types/api/generated';

export function ServiceLiveMap({ trips }: { trips: AdminServiceLiveTripDto[] }) {
  const [selectedId, setSelectedId] = useState('');
  const locatedTrips = trips.filter((trip) =>
    trip.latitude != null && trip.longitude != null
    && Number.isFinite(trip.latitude) && Number.isFinite(trip.longitude)
    && Math.abs(trip.latitude) <= 90 && Math.abs(trip.longitude) <= 180);
  const selected = locatedTrips.find((trip) => trip.tripId === selectedId) || locatedTrips[0];

  if (!selected || selected.latitude == null || selected.longitude == null) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Henüz araç konumu alınmadı. Sefer sırasında gönderilen konum burada görünür.</p>;
  }

  const { latitude, longitude } = selected;
  const params = new URLSearchParams({
    bbox: [Math.max(-180, longitude - 0.012), Math.max(-90, latitude - 0.008), Math.min(180, longitude + 0.012), Math.min(90, latitude + 0.008)].join(','),
    layer: 'mapnik',
    marker: `${latitude},${longitude}`,
  });
  const mapLink = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  return <div className="space-y-3">
    <label className="block text-xs font-semibold">
      Araç / rota
      <select className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" value={selected.tripId} onChange={(event) => setSelectedId(event.target.value)}>
        {locatedTrips.map((trip) => <option key={trip.tripId} value={trip.tripId}>{trip.plateNumber} • {trip.routeName}</option>)}
      </select>
    </label>
    <iframe title={`Servis haritası: ${selected.routeName}`} src={`https://www.openstreetmap.org/export/embed.html?${params}`} className="h-64 w-full rounded-xl border" referrerPolicy="no-referrer" />
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
      <span>Son konum: {selected.lastLocationAt ? new Date(selected.lastLocationAt).toLocaleString('tr-TR') : 'Zaman bilgisi yok'}</span>
      <a href={mapLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-500 hover:underline">Haritada aç</a>
    </div>
  </div>;
}
