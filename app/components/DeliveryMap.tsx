"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { KARACHI_CENTER } from "@/lib/geo";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type LatLng = { lat: number; lng: number };

function Recenter({ position }: { position: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 14));
  }, [map, position.lat, position.lng]);
  return null;
}

function MapClicks({ onPick }: { onPick: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function DeliveryMap({
  selected,
  onPick,
  height,
}: {
  selected: LatLng | null;
  onPick: (pos: LatLng) => void;
  height: number;
}) {
  const center = selected ?? KARACHI_CENTER;
  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        className="h-full w-full z-[100]"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter position={center} />
        <MapClicks onPick={onPick} />
        {selected ? (
          <Marker
            position={[selected.lat, selected.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onPick({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
