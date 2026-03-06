import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Tooltip,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./DeliveryMapPreview.css";

// Iconos por defecto de Leaflet (Vite requiere import para empaquetar bien)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function FitBounds({ center, maxKm }) {
  const map = useMap();
  useEffect(() => {
    if (center?.lat == null || center?.lng == null) return;
    if (maxKm != null && maxKm > 0) {
      const lat = center.lat;
      const lng = center.lng;
      const offsetLat = maxKm / 111;
      const offsetLng = maxKm / (111 * Math.cos((lat * Math.PI) / 180));
      map.fitBounds([
        [lat - offsetLat, lng - offsetLng],
        [lat + offsetLat, lng + offsetLng],
      ]);
    } else {
      map.setView([center.lat, center.lng], 14);
    }
  }, [map, center, maxKm]);
  return null;
}

export function DeliveryMapPreview({ coordenadas, rangos = [], nombreLocal }) {
  if (coordenadas?.lat == null || coordenadas?.lng == null) return null;

  const lat = coordenadas.lat;
  const lng = coordenadas.lng;
  const center = [lat, lng];

  const rangosOrdenados = [...rangos].sort(
    (a, b) => (b.kmHasta ?? 0) - (a.kmHasta ?? 0),
  );
  const maxKm =
    rangosOrdenados.length > 0
      ? Math.max(...rangosOrdenados.map((r) => r.kmHasta ?? 0))
      : null;

  return (
    <div className="delivery-map-wrap">
      <MapContainer
        key={`${coordenadas.lat}-${coordenadas.lng}`}
        center={center}
        zoom={14}
        style={{ height: 320, width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <FitBounds center={coordenadas} maxKm={maxKm} />
        <Marker position={center}>
          <Popup>{nombreLocal || "Local"}</Popup>
        </Marker>
        {rangosOrdenados.map((rango, idx) => {
          const radius = (rango.kmHasta ?? 0) * 1000;
          const color = COLORS[idx % COLORS.length];
          return (
            <Circle
              key={idx}
              center={center}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.12,
                opacity: 0.7,
                weight: 2,
              }}
            >
              <Tooltip permanent direction="center">
                {rango.label} — $
                {(rango.precio ?? 0).toLocaleString("es-CL")}
              </Tooltip>
            </Circle>
          );
        })}
      </MapContainer>
      {rangosOrdenados.length > 0 && (
        <div className="delivery-map-legend">
          {rangosOrdenados.map((rango, idx) => (
            <div key={idx} className="delivery-map-legend-item">
              <span
                className="delivery-map-legend-dot"
                style={{
                  backgroundColor: COLORS[idx % COLORS.length],
                }}
              />
              <span>
                {rango.label} — $
                {(rango.precio ?? 0).toLocaleString("es-CL")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
