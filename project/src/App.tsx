import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Calendar, CloudRain, Sun, MapPin, Search } from 'lucide-react';
import MapComponent from './components/Map';
import AlertSettings from './components/AlertSettings';
import type { FireData, AlertSettings as AlertSettingsType } from './types';
import type { WeatherData } from './types';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';

// Add global style for date picker
const globalStyles = `
  .react-datepicker {
    z-index: 9999 !important;
    position: fixed !important;
  }
  .react-datepicker__portal {
    z-index: 9999 !important;
  }
  .react-datepicker__triangle {
    z-index: 9999 !important;
  }
  .react-datepicker__triangle::before {
    z-index: 9999 !important;
  }
`;

// Custom Date Input Component
const DateInput = ({ value, onChange, label }: { value: Date | null, onChange: (date: Date) => void, label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = React.createRef<HTMLDivElement>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inputRef]);

  return (
    <div className="relative" ref={inputRef}>
      <div className="absolute left-0 top-0 h-full flex items-center">
        <Calendar className="h-5 w-5 text-gray-400 ml-3" />
      </div>
      <div className="relative">
        <DatePicker
          selected={value}
          onChange={onChange}
          className="pl-10 pr-4 py-2 border rounded-md w-48"
          dateFormat="MMMM d, yyyy"
          popperClassName="z-[9999] absolute"
          portalClassName="z-[9999]"
          popperPlacement="bottom-start"
          popperStyle={{ 
            zIndex: 9999, 
            position: 'absolute',
            pointerEvents: 'all'
          }}
          portalStyle={{ 
            zIndex: 9999,
            pointerEvents: 'all'
          }}
          portalContainer={() => document.body}
          onClickOutside={() => setIsOpen(false)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          isOpen={isOpen}
        />
      </div>
    </div>
  );
};

function App() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = globalStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [alertSettings, setAlertSettings] = useState<AlertSettingsType>({
    enabled: false,
    radius: 50,
    weatherAlerts: []
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Set date range to last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    setStartDate(thirtyDaysAgo);
    setEndDate(now);
  }, []);

  // Fetch all municipalities in Maranhão
  const { data: municipalities = [], isLoading: isMunicipalitiesLoading, error: municipalitiesError } = useQuery<Municipality[]>({
    queryKey: ['municipalities'],
    queryFn: async () => {
      console.log('Fetching all municipalities in Maranhão...');
      try {
        const response = await fetch('http://localhost:3001/api/maranhao/municipalities');
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          throw new Error(`Failed to fetch municipalities: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (!contentType?.includes('application/json')) {
          const text = await response.text();
          console.error('Response is not JSON:', text);
          throw new Error('Response is not JSON');
        }

        const data = await response.json();
        console.log('Raw municipalities data:', JSON.stringify(data, null, 2));
        
        return data;
      } catch (error) {
        console.error('Error fetching municipalities:', error);
        throw error;
      }
    },
    onError: (error) => {
      console.error('Municipalities query error:', error);
    }
  });

  // Filter municipalities based on search query
  const filteredMunicipalities = searchQuery
    ? municipalities.filter(m => 
        m.municipality.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : municipalities;

  // Fetch fires for selected municipality in Maranhão
  const { data: fires = [], isLoading: isFiresLoading, error: firesError } = useQuery<FireData[]>({
    queryKey: ['fires', selectedMunicipality, startDate, endDate],
    queryFn: async () => {
      console.log('Fetching fires data for municipality:', selectedMunicipality);
      console.log('Date range:', startDate.toISOString(), endDate.toISOString());
      
      try {
        const response = await fetch(
          `http://localhost:3001/api/maranhao/fires?municipality=${encodeURIComponent(selectedMunicipality || '')}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Fires API error:', response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (!contentType?.includes('application/json')) {
          const text = await response.text();
          console.error('Response is not JSON:', text);
          throw new Error('Response is not JSON');
        }

        const data = await response.json();
        console.log('Fires data received:', data.length, 'points');
        if (data.length > 0) {
          console.log('First fire data point:', data[0]);
        }
        return data;
      } catch (error) {
        console.error('Error fetching fires data:', error);
        throw error;
      }
    },
    enabled: !!selectedMunicipality,
    refetchInterval: 3600000,
    onError: (error) => {
      console.error('Fires query error:', error);
    }
  });

  // Fetch weather data for selected municipality
  const { data: weather = [], isLoading: isWeatherLoading, error: weatherError } = useQuery<WeatherData[]>({
    queryKey: ['weather', selectedMunicipality],
    queryFn: async () => {
      console.log('Fetching weather data for municipality:', selectedMunicipality);
      try {
        const response = await fetch(
          `http://localhost:3001/api/maranhao/weather/${encodeURIComponent(selectedMunicipality || '')}`
        );

        if (!response.ok) {
          console.error('Weather API error:', response.status);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Weather data fetched successfully:', data);
        return Array.isArray(data) ? data : [data]; // Ensure we always return an array
      } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
      }
    },
    enabled: !!selectedMunicipality,
    refetchInterval: 3600000,
    onError: (error) => {
      console.error('Weather query error:', error);
    }
  });

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
  const filteredWeatherData = weather?.filter(weather => 
    !selectedMunicipality || weather?.municipality === selectedMunicipality
  ) || [];

  const handleRefresh = () => {
    // The weather data will automatically refresh every hour
  };

  return (
    <div className="min-h-screen bg-gray-100 relative" style={{
      position: 'relative',
      zIndex: 0
    }}>
      {/* Top Bar */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Flame className="h-8 w-8 text-red-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900">Alertas de Incêndios em Maranhão</h1>
            </div>

            {/* Municipality and Date Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <select
                  value={selectedMunicipality}
                  onChange={(e) => setSelectedMunicipality(e.target.value)}
                  className="w-64 p-2 border rounded-md"
                  disabled={isMunicipalitiesLoading}
                >
                  <option value="" key="all">Todos os Municípios</option>
                  {filteredMunicipalities && filteredMunicipalities.length > 0 && 
                    filteredMunicipalities.map((m, index) => (
                      <option key={index} value={m.municipality}>
                        {m.municipality}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div className="text-sm text-gray-500">
                Found {filteredMunicipalities.length} municipalities
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex items-center space-x-4">
              <DateInput
                value={startDate}
                onChange={(date) => setStartDate(date)}
                label="Start Date"
              />
              <DateInput
                value={endDate}
                onChange={(date) => setEndDate(date)}
                label="End Date"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4">
          <div className="lg:col-span-1 space-y-6">
            {/* Fire Status Card */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-2">Incêndios ativos em {selectedMunicipality || 'Maranhão'}</h2>
              {isFiresLoading ? (
                <div className="text-center py-4">Carregando dados de incêndio...</div>
              ) : firesError ? (
                <div className="text-center py-4 text-red-600">Erro ao carregar dados de incêndio</div>
              ) : filteredFires.length > 0 ? (
                <>
                  <p className="text-3xl font-bold text-red-600">{filteredFires.length}</p>
                  <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleTimeString()}</p>
                </>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhum foco de incêndio encontrado para {selectedMunicipality || 'esta área'}
                </div>
              )}
            </div>

            {/* Weather Status Card */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-2">Clima para {selectedMunicipality || 'Maranhão'}</h2>
              {isWeatherLoading ? (
                <div className="text-center py-4">Carregando dados de clima...</div>
              ) : weatherError ? (
                <div className="text-center py-4 text-red-600">Erro ao carregar dados de clima</div>
              ) : filteredWeatherData.length > 0 ? (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="mt-2 space-y-1">
                    {filteredWeatherData[0] && (
                      <>
                        <p className="flex items-center">
                          <Sun className="h-4 w-4 mr-2 text-yellow-500" />
                          {filteredWeatherData[0].temperature !== null ? 
                            `${filteredWeatherData[0].temperature}°C` : 'N/A'}
                        </p>
                        <p className="flex items-center">
                          <CloudRain className="h-4 w-4 mr-2 text-blue-500" />
                          {filteredWeatherData[0].humidity !== null ? 
                            `${filteredWeatherData[0].humidity}% Umidade` : 'N/A'}
                        </p>
                        <p className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                          {filteredWeatherData[0].date ? new Date(filteredWeatherData[0].date).toLocaleDateString() : 'N/A'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhum dado de clima disponível para {selectedMunicipality || 'esta área'}
                </div>
              )}
            </div>

            {/* Alert Settings */}
            <AlertSettings
              settings={alertSettings}
              onSettingsChange={setAlertSettings}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="h-[600px] bg-white rounded-lg shadow-md overflow-hidden relative">
              {isFiresLoading || isWeatherLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                </div>
              ) : (
                <div className="absolute inset-0">
                  <MapComponent
                    fires={filteredFires}
                    alertSettings={alertSettings}
                    weatherData={filteredWeatherData}
                    selectedMunicipality={selectedMunicipality}
                  />
                </div>
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-md h-[100px] mt-4">
              <h3 className="text-sm font-semibold mb-2">Fire Confidence Legend</h3>
              <div className="grid grid-cols-3 gap-1 p-2">
                <div className="flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-xs ml-2">High (80%+)</span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-xs ml-2">Med (50-79%)</span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-xs ml-2">Low (0-49%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;