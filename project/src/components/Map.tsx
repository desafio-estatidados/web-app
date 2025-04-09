import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FireData } from '../types';
import { format } from 'date-fns';
import L from 'leaflet';
import { FeatureCollection, Polygon } from 'geojson';

// Maranhão state boundaries GeoJSON
const MARANHAO_GEOJSON: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-47.4748, -0.2813],
            [-47.4748, -10.4675],
            [-41.1000, -10.4675],
            [-41.1000, -0.2813],
            [-47.4748, -0.2813]
          ]
        ]
      }
    }
  ]
};

interface MapProps {
  fires: FireData[];
  alertSettings: {
    enabled: boolean;
    radius: number;
    location?: { lat: number; lng: number };
  };
  weatherData: {
    location: string;
    temperature: number | null;
    humidity: number | null;
    date: string;
    municipality: string;
  }[];
  selectedMunicipality: string;
}

function MaranhaoBoundsControl() {
  const map = useMap();

  useEffect(() => {
    // Set initial view to Maranhão's center
    map.setView([-5.04, -45.54], 7);
    
    // Add zoom control
    const zoomControl = L.control.zoom({ position: 'topright' });
    
    // Remove any existing zoom controls
    const existingZoomControls = map.getContainer().querySelectorAll('.leaflet-control-zoom');
    existingZoomControls.forEach(control => control.remove());

    zoomControl.addTo(map);

    // Add layer control
    const baseMaps = {
      'Street Map': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }),
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri'
      })
    };

    // Remove any existing layer controls
    const existingControls = map.getContainer().querySelectorAll('.leaflet-control-layers');
    existingControls.forEach(control => control.remove());

    // Create layer control
    const layerControl = L.control.layers(baseMaps, {}, {
      position: 'topright',
      collapsed: true
    });

    // Add layer control to map
    layerControl.addTo(map);

    // Add Street Map layer first
    const streetMapLayer = baseMaps['Street Map'];
    streetMapLayer.addTo(map);

    // Set up layer change event
    map.on('baselayerchange', function(e) {
      if (e.name === 'Street Map') {
        baseMaps['Street Map'].addTo(map);
        baseMaps['Satellite'].remove();
      } else if (e.name === 'Satellite') {
        baseMaps['Satellite'].addTo(map);
        baseMaps['Street Map'].remove();
      }
    });
  }, [map]);

  return null;
}

function AlertCircle({ location, radius }: { location: { lat: number; lng: number }; radius: number }) {
  return (
    <Circle
      center={[location.lat, location.lng]}
      radius={radius * 1000}
      pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
    />
  );
}

function MapComponent({ fires, alertSettings, weatherData = [], selectedMunicipality = '' }: MapProps) {
  // Filter fires to only show those within Maranhão's bounds
  const maranhaoFires = fires?.filter(fire => 
    fire?.latitude >= -10.4675 &&
    fire?.latitude <= -0.2813 &&
    fire?.longitude >= -47.4748 &&
    fire?.longitude <= -41.1000
  ) || [];

  // If a municipality is selected, filter fires by municipality
  const filteredFires = selectedMunicipality 
    ? maranhaoFires.filter(fire => fire?.municipality?.toLowerCase() === selectedMunicipality?.toLowerCase())
    : maranhaoFires;

  // Filter weather markers based on the selected municipality
  const filteredWeatherData = weatherData?.filter(weather => 
    !selectedMunicipality || weather?.municipality === selectedMunicipality
  ) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] relative" style={{
      position: 'relative',
      zIndex: 0
    }}>
      <div className="flex-1">
        <MapContainer
          center={[-5.04, -45.54]} // Maranhão's center
          zoom={7}
          className="h-full"
          style={{
            height: '100%',
            width: '100%'
          }}
          minZoom={6}
          maxZoom={15}
          attributionControl={false}
        >
          <MaranhaoBoundsControl />
          
          {/* Weather Markers */}
          {filteredWeatherData?.length > 0 && filteredWeatherData?.map((weather, index) => {
            if (!weather?.location) return null;
            const [lat, lng] = weather.location.split(',').map(Number);
            if (!lat || !lng) return null;

            return (
              <Circle
                key={`${weather?.municipality}-${index}`}
                center={[lat, lng]}
                radius={5000} // 5km radius
                pathOptions={{
                  color: 'blue',
                  fillColor: 'blue',
                  fillOpacity: 0.1,
                  weight: 1
                }}
                interactive={false}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-semibold">{weather?.municipality || 'Unknown Municipality'}</h3>
                    {weather?.temperature !== null && (
                      <p>Temperature: {weather?.temperature}°C</p>
                    )}
                    {weather?.humidity !== null && (
                      <p>Humidity: {weather?.humidity}%</p>
                    )}
                    <p>Date: {weather?.date ? new Date(weather?.date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* Fire Markers */}
          {filteredFires?.length > 0 ? (
            filteredFires?.map((fire, index) => (
              <Circle
                key={`${fire?.latitude}-${fire?.longitude}-${index}`}
                center={[fire?.latitude || 0, fire?.longitude || 0]}
                radius={(fire?.brightness || 300) * 25} 
                pathOptions={{
                  color: fire?.confidence >= 80 ? 'red' : fire?.confidence >= 50 ? 'orange' : 'yellow',
                  fillColor: fire?.confidence >= 80 ? 'red' : fire?.confidence >= 50 ? 'orange' : 'yellow',
                  fillOpacity: 0.7,
                  weight: 2
                }}
                interactive={false}
              >
                <Popup>
                  <div className="text-center space-y-2 p-4 bg-white rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold">Fire Details</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Latitude:</span>
                        <span className="font-medium">{Number(fire?.latitude).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Longitude:</span>
                        <span className="font-medium">{Number(fire?.longitude).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Brightness:</span>
                        <span className="font-medium">{Number(fire?.brightness).toFixed(0)} W/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Confidence:</span>
                        <span className="font-medium">{Number(fire?.confidence).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Scan Time:</span>
                        <span className="font-medium">
                          {fire?.acq_date ? format(new Date(fire?.acq_date), 'HH:mm') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Scan Date:</span>
                        <span className="font-medium">
                          {fire?.acq_date ? format(new Date(fire?.acq_date), 'MMM d, yyyy') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Municipality:</span>
                        <span className="font-medium">{fire?.municipality || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              No fires detected
            </div>
          )}

          {/* Alert Circle */}
          {alertSettings?.enabled && alertSettings?.location && (
            <Circle
              center={alertSettings?.location}
              radius={alertSettings?.radius * 1000}
              pathOptions={{
                color: 'blue',
                fillColor: 'rgba(0, 150, 255, 0.1)',
                weight: 2
              }}
              interactive={false}
            >
              <Popup>
                <div className="text-center">
                  <h3 className="font-semibold">Alert Zone</h3>
                  <p>Radius: {alertSettings?.radius} km</p>
                </div>
              </Popup>
            </Circle>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default MapComponent;
