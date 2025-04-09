export interface FireData {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: number;
  version: string;
  bright_t31: number;
  frp: number;
  daynight: string;
}

export interface WeatherAlert {
  city: string;
  enabled: boolean;
  temperatureThreshold?: number; // Temperature in Celsius
  humidityThreshold?: number;    // Percentage
  windSpeedThreshold?: number;   // in m/s
}

export interface Municipality {
  municipality: string;
  state: string;
}

export interface WeatherData {
  location: string;
  temperature: number | null;
  humidity: number | null;
  date: string;
  municipality: Municipality;
}

export interface AlertSettings {
  enabled: boolean;
  radius: number; // in kilometers
  location?: {
    lat: number;
    lng: number;
  };
  weatherAlerts: WeatherAlert[];
}

// Database Enums
export type AlertStatus = 'active' | 'resolved' | 'monitoring';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'extreme';

// Database Interfaces
export interface FireLocation {
    id: number;
    latitude: number;
    longitude: number;
    location_name?: string;
    state: string;
    country: string;
    created_at: Date;
    updated_at: Date;
}

export interface FireIncident {
    id: number;
    location_id: number;
    start_date: Date;
    end_date?: Date;
    status: AlertStatus;
    severity: SeverityLevel;
    area_affected_hectares?: number;
    description?: string;
    created_at: Date;
    updated_at: Date;
}

export interface WeatherConditions {
    id: number;
    location_id: number;
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction: number | null;
    precipitation: number | null;
    measurement_time: Date;
    created_at: Date;
}

export interface ResponseTeam {
    id: number;
    team_name: string;
    team_type: string;
    contact_number?: string;
    email?: string;
    created_at: Date;
    updated_at: Date;
}

export interface IncidentResponse {
    id: number;
    incident_id: number;
    team_id: number;
    response_status: string;
    deployment_time: Date;
    completion_time?: Date;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}