-- Drop existing tables if they exist
DROP TABLE IF EXISTS incident_responses CASCADE;
DROP TABLE IF EXISTS response_teams CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS weather_conditions CASCADE;
DROP TABLE IF EXISTS satellite_data CASCADE;
DROP TABLE IF EXISTS fire_incidents CASCADE;
DROP TABLE IF EXISTS fire_locations CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS alert_status CASCADE;
DROP TYPE IF EXISTS severity_level CASCADE;

-- Create enum types
CREATE TYPE alert_status AS ENUM ('active', 'resolved', 'monitoring');
CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'extreme');

-- Create fire_locations table
CREATE TABLE fire_locations (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_name VARCHAR(255),
    state VARCHAR(100),
    country VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create fire_incidents table
CREATE TABLE fire_incidents (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES fire_locations(id),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    status alert_status DEFAULT 'active',
    severity severity_level DEFAULT 'medium',
    area_affected_hectares DOUBLE PRECISION,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create satellite_data table
CREATE TABLE satellite_data (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES fire_incidents(id),
    satellite_name VARCHAR(100) NOT NULL,
    brightness DOUBLE PRECISION,
    scan DOUBLE PRECISION,
    track DOUBLE PRECISION,
    frp DOUBLE PRECISION,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    observation_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--- Create weather table
CREATE TABLE weather (
    id SERIAL PRIMARY KEY,
    location VARCHAR(255) NOT NULL,
    temperature FLOAT NOT NULL,
    feels_like FLOAT NOT NULL,
    condition VARCHAR(255) NOT NULL,
    pressure INT NOT NULL,
    humidity INT NOT NULL,
    wind_speed FLOAT NOT NULL,
    wind_deg INT NOT NULL,
    visibility INT NOT NULL,
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create weather_conditions table
CREATE TABLE weather_conditions (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES fire_locations(id),
    temperature DOUBLE PRECISION,
    humidity INTEGER CHECK (humidity BETWEEN 0 AND 100),
    wind_speed DOUBLE PRECISION,
    wind_direction INTEGER CHECK (wind_direction BETWEEN 0 AND 360),
    precipitation DOUBLE PRECISION,
    measurement_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);



-- Create alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES fire_incidents(id),
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity severity_level DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create response_teams table
CREATE TABLE response_teams (
    id SERIAL PRIMARY KEY,
    team_name VARCHAR(255) NOT NULL,
    team_type VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create incident_responses table
CREATE TABLE incident_responses (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES fire_incidents(id),
    team_id INTEGER REFERENCES response_teams(id),
    response_status VARCHAR(50) NOT NULL,
    deployment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    completion_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_fire_locations_coordinates ON fire_locations(latitude, longitude);
CREATE INDEX idx_fire_incidents_status ON fire_incidents(status);
CREATE INDEX idx_fire_incidents_dates ON fire_incidents(start_date, end_date);
CREATE INDEX idx_satellite_data_observation ON satellite_data(observation_time);
CREATE INDEX idx_weather_conditions_measurement ON weather_conditions(measurement_time);
CREATE INDEX idx_alerts_active ON alerts(is_active);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_fire_locations_updated_at
    BEFORE UPDATE ON fire_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fire_incidents_updated_at
    BEFORE UPDATE ON fire_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_response_teams_updated_at
    BEFORE UPDATE ON response_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incident_responses_updated_at
    BEFORE UPDATE ON incident_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
