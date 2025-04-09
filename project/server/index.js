import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { NasaService } from './services/nasaService.js';
import WeatherService from './services/weatherService.js';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { cities } from './data/cities.js';

// Load environment variables
dotenv.config();

// Validate cities data
if (!cities || !Array.isArray(cities) || cities.length === 0) {
    console.error('Cities data is not properly loaded');
    process.exit(1);
}

// Log available cities for debugging
console.log('Available cities:', cities.map(c => c.name).join(', '));
console.log('Number of cities loaded:', cities.length);

// Validate required environment variables
const requiredEnvVars = ['WEATHER_API_KEY', 'WEATHER_API_UNITS', 'LOCAL_DB_HOST', 'LOCAL_DB_PORT', 'LOCAL_DB_NAME', 'LOCAL_DB_USER', 'LOCAL_DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Log environment variables for debugging
console.log('Environment variables:', {
    WEATHER_API_KEY: process.env.WEATHER_API_KEY ? 'Set' : 'Not set',
    WEATHER_API_UNITS: process.env.WEATHER_API_UNITS,
    LOCAL_DB_HOST: process.env.LOCAL_DB_HOST,
    LOCAL_DB_PORT: process.env.LOCAL_DB_PORT,
    LOCAL_DB_NAME: process.env.LOCAL_DB_NAME,
    LOCAL_DB_USER: process.env.LOCAL_DB_USER
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const nasaService = new NasaService();
const weatherService = new WeatherService();

// Create a map of city names to their coordinates for quick lookup
const cityCoordinates = new Map();

// Initialize city coordinates map
const initializeCityCoordinates = () => {
  cities.forEach(city => {
    cityCoordinates.set(city.name.toLowerCase(), {
      latitude: city.latitude,
      longitude: city.longitude
    });
  });
};

// Initialize city data when server starts
initializeCityCoordinates();

// Initialize tables
console.log('Initializing database tables...');
try {
    // Initialize weather table
    await weatherService.initialize();
    console.log('Weather table initialized successfully');
} catch (error) {
    console.error('Failed to initialize database tables:', error);
    process.exit(1);
}

// Initialize weather data for all cities
try {
    console.log('Fetching initial weather data for all cities...');
    await weatherService.fetchAllCitiesWeather();
    console.log('Initial weather data fetched successfully');
} catch (error) {
    console.error('Failed to fetch initial weather data:', error);
    process.exit(1);
}

// Initialize fire tables
console.log('Initializing fire tables...');
try {
    // Create satellite_data table if not exists
    await nasaService.pool.query(`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'satellite_data') THEN
                CREATE TABLE satellite_data (
                    id SERIAL PRIMARY KEY,
                    source VARCHAR(50) NOT NULL,
                    satellite VARCHAR(50) NOT NULL,
                    instrument VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            END IF;
        END $$;
    `);

    // Create fire_locations table if not exists
    await nasaService.pool.query(`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fire_locations') THEN
                CREATE TABLE fire_locations (
                    id SERIAL PRIMARY KEY,
                    latitude DECIMAL(10, 7) NOT NULL,
                    longitude DECIMAL(10, 7) NOT NULL,
                    state VARCHAR(2) NOT NULL,
                    municipality VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(latitude, longitude)
                );
            END IF;
        END $$;
    `);

    // Create fire_incidents table if not exists
    await nasaService.pool.query(`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fire_incidents') THEN
                CREATE TABLE fire_incidents (
                    id SERIAL PRIMARY KEY,
                    location_id INTEGER NOT NULL REFERENCES fire_locations(id),
                    satellite_id INTEGER NOT NULL REFERENCES satellite_data(id),
                    acquisition_date TIMESTAMP WITH TIME ZONE NOT NULL,
                    brightness DECIMAL(10, 2),
                    scan DECIMAL(10, 2),
                    track DECIMAL(10, 2),
                    frp DECIMAL(10, 2),
                    daynight CHAR(1),
                    type VARCHAR(50),
                    version VARCHAR(10),
                    confidence INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(location_id, acquisition_date, satellite_id)
                );
            ELSE
                -- Add missing columns if they don't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name = 'fire_incidents' 
                              AND column_name = 'confidence') THEN
                    ALTER TABLE fire_incidents ADD COLUMN confidence INTEGER;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name = 'fire_incidents' 
                              AND column_name = 'created_at') THEN
                    ALTER TABLE fire_incidents ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name = 'fire_incidents' 
                              AND column_name = 'updated_at') THEN
                    ALTER TABLE fire_incidents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END IF;
        END $$;
    `);

    console.log('All tables initialized successfully');
} catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
}

// API Routes

/// Get municipalities in Maranhão
app.get('/api/maranhao/municipalities', async (req, res) => {
    try {
        console.log('Received request for municipalities');
        
        if (!cities || !Array.isArray(cities)) {
            console.error('Cities data is not properly loaded');
            throw new Error('Cities data is not properly loaded');
        }
        
        console.log('Cities data:', cities.length, 'cities found');
        
        // Use the actual cities data format
        const formattedData = cities.map(city => ({
            municipality: city.name,
            state: 'MA',
            latitude: city.latitude,
            longitude: city.longitude
        }));

        console.log('Sending municipalities data:', formattedData.length, 'municipalities');
        console.log('First municipality:', formattedData[0]);
        
        // Set content type explicitly
        res.set('Content-Type', 'application/json');
        
        // Send the data
        res.json(formattedData);
        
    } catch (error) {
        console.error('Error fetching municipalities:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add a utility function to get city coordinates
app.get('/api/maranhao/city-coordinates/:cityName', async (req, res) => {
    try {
        const cityName = req.params.cityName.toLowerCase();
        const coordinates = cityCoordinates.get(cityName);
        
        if (!coordinates) {
            return res.status(404).json({ error: 'City not found' });
        }
        
        res.json(coordinates);
    } catch (error) {
        console.error('Error fetching city coordinates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current weather data for Maranhão
app.get('/api/maranhao/weather', async (req, res) => {
    try {
        // Fetch and save weather data for all cities in Maranhão
        await weatherService.fetchAllCitiesWeather();
        res.json({ success: true });
    } catch (error) {
        console.error('Error fetching weather data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get weather data for a specific city in Maranhão
app.get('/api/maranhao/weather/:city', async (req, res) => {
    try {
        const { city } = req.params;
        console.log('Weather endpoint called for city:', city);
        
        // Log request details
        console.log('Request headers:', req.headers);
        console.log('Request URL:', req.url);
        
        const weatherData = await weatherService.getWeatherForCity(city);
        
        if (!weatherData) {
            console.log('No weather data found for city:', city);
            return res.status(404).json({ 
                error: 'No weather data available for this city',
                details: {
                    city,
                    message: 'Weather data could not be fetched or saved'
                }
            });
        }

        // Format the response
        const formattedWeather = {
            location: weatherData[0].location,
            temperature: weatherData[0].temperature,
            humidity: weatherData[0].humidity,
            date: weatherData[0].date,
            municipality: weatherData[0].municipality,
            state: weatherData[0].state,
            latitude: weatherData[0].latitude,
            longitude: weatherData[0].longitude
        };

        console.log('Sending weather response:', {
            city,
            temperature: formattedWeather.temperature,
            humidity: formattedWeather.humidity
        });

        res.setHeader('Content-Type', 'application/json');
        res.json(formattedWeather);

    } catch (error) {
        console.error('Weather endpoint error:', {
            error: error.message,
            stack: error.stack,
            city: req.params.city,
            requestTime: new Date().toISOString()
        });
        
        // Send detailed error response
        res.status(500).json({
            error: 'Internal server error',
            details: {
                message: error.message,
                city: req.params.city,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Get historical weather data for Maranhão
app.get('/api/maranhao/weather/history', async (req, res) => {
    try {
        console.log('Requesting historical weather data');
        const weatherData = await weatherService.getHistoricalWeather();
        res.json(weatherData);
    } catch (error) {
        console.error('Error fetching historical weather:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack 
        });
    }
});

// Get Maranhão wildfire data
app.get('/api/maranhao/fires', async (req, res) => {
    console.log('Received fires request:', req.query);
    try {
        const { municipality, startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            console.log('Missing required parameters:', { startDate, endDate });
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        console.log('Fetching fires for municipality:', municipality);
        console.log('Date range:', startDate, endDate);

        const decodedMunicipality = decodeURIComponent(municipality || '');

        // Convert date strings to Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Invalid date format:', { startDate, endDate });
            return res.status(400).json({ error: 'Invalid date format. Please use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)' });
        }

        // Add a day to the end date to include the full day
        end.setDate(end.getDate() + 1);

        // Get fires from database
        const fires = await nasaService.getFiresFromDatabase(start, end, decodedMunicipality);
        console.log('Got fires from database:', fires.length);
        
        if (fires.length === 0) {
            console.log('No fires found for the specified date range');
            return res.status(200).json([]);
        }

        // Format response data
        const formattedFires = fires.map(fire => {
            if (!fire || !fire.latitude || !fire.longitude) {
                console.error('Invalid fire data:', fire);
                return null;
            }

            // Handle undefined values
            const latitude = fire.latitude;
            const longitude = fire.longitude;
            const brightness = fire.brightness || 0;
            const scan = fire.scan || 0;
            const track = fire.track || 0;
            const acquisition_date = fire.acquisition_date || new Date().toISOString();
            
            const satellite = fire.satellite || 'N/A';
            const confidence = fire.confidence || 0;
            const version = fire.version || '1.0';
            const bright_t31 = fire.bright_t31 || 0;
            const frp = fire.frp || 0;
            const daynight = fire.daynight || 'N';
            const municipality = fire.municipality || 'Unknown';
            const state = fire.state || 'MA';

            return {
                latitude,
                longitude,
                brightness,
                scan,
                track,
                acquisition_date,
                satellite,
                confidence,
                version,
                bright_t31,
                frp,
                daynight,
                municipality,
                state
            };
        }).filter(fire => fire !== null); // Remove any null entries

        // Log the first fire for debugging
        if (formattedFires.length > 0) {
            console.log('First formatted fire data point:', {
                municipality: formattedFires[0].municipality,
                acquisition_date: formattedFires[0].acquisition_date,
                latitude: formattedFires[0].latitude,
                longitude: formattedFires[0].longitude
            });
        }

        // Log the number of fires returned
        console.log('Sending fires response:', formattedFires.length, 'fires');

        res.setHeader('Content-Type', 'application/json');
        res.json(formattedFires);

    } catch (error) {
        let firesData = null;
        try {
            firesData = await nasaService.getFiresFromDatabase(start, end, decodedMunicipality);
        } catch (fetchError) {
            console.error('Error fetching fires data for error logging:', fetchError);
            firesData = null;
        }
        
        console.error('Error fetching fires:', {
            message: error.message,
            stack: error.stack,
            fires: firesData || [],
            sampleFire: firesData && firesData[0] ? firesData[0] : null
        });
        res.status(500).json({ 
            error: error.message,
            details: {
                message: 'Failed to process fires data',
                numberOfFires: firesData ? firesData.length : 0,
                sampleFire: firesData && firesData[0] ? firesData[0] : null
            }
        });
    }
});

// Test endpoint to verify database connection and check data
app.get('/api/test/db', async (req, res) => {
    try {
        const client = await nasaService.pool.connect();
        try {
            // Check if tables exist
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('fire_incidents', 'fire_locations', 'satellite_data')
                ) as tables_exist
            `);
            
            if (!tableCheck.rows[0].tables_exist) {
                return res.status(404).json({
                    error: 'Required tables not found in database'
                });
            }

            // Check for any fires in the database
            const firesCheck = await client.query(`
                SELECT COUNT(*) as fire_count,
                       MIN(acquisition_date) as oldest_date,
                       MAX(acquisition_date) as newest_date
                FROM fire_incidents
                JOIN fire_locations ON fire_incidents.location_id = fire_locations.id
                WHERE fire_locations.state = 'MA'
            `);

            const fireStats = firesCheck.rows[0];
            
            // Check for any municipalities
            const municipalitiesCheck = await client.query(`
                SELECT COUNT(DISTINCT municipality) as municipality_count,
                       array_agg(DISTINCT municipality) as municipalities
                FROM fire_locations
                WHERE state = 'MA'
            `);

            const municipalityStats = municipalitiesCheck.rows[0];

            // Get sample fire data
            const sampleFires = await client.query(`
                SELECT 
                    fl.latitude,
                    fl.longitude,
                    fl.state,
                    fl.municipality,
                    fi.acquisition_date as acquisition_date,
                    fi.brightness,
                    fi.scan,
                    fi.track,
                    fi.frp,
                    fi.daynight,
                    fi.type,
                    fi.version,
                    sd.source,
                    sd.satellite,
                    sd.instrument,
                    sd.confidence
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                JOIN satellite_data sd ON fi.satellite_id = sd.id
                WHERE fl.state = 'MA'
                ORDER BY fi.acquisition_date DESC
                LIMIT 5
            `);

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                database: {
                    hasTables: true,
                    fireStats: {
                        totalFires: fireStats.fire_count,
                        oldestDate: fireStats.oldest_date,
                        newestDate: fireStats.newest_date
                    },
                    municipalityStats: {
                        totalMunicipalities: municipalityStats.municipality_count,
                        municipalities: municipalityStats.municipalities
                    },
                    sampleFires: sampleFires.rows
                }
            });
        } catch (error) {
            console.error('Error in test db endpoint:', error);
            res.status(500).json({ 
                error: 'Database query failed',
                details: error.message 
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error in test db endpoint:', error);
        res.status(500).json({ 
            error: 'Database connection failed',
            details: error.message 
        });
    }
});

// Test database connection
app.get('/api/test/db', async (req, res) => {
    try {
        const client = await weatherService.pool.connect();
        try {
            // Test query
            const result = await client.query('SELECT NOW() as current_time');
            console.log('Database test query successful:', result.rows[0]);
            res.json({ success: true, timestamp: result.rows[0].current_time });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database test failed:', error);
        res.status(500).json({ 
            error: 'Database connection test failed',
            details: error.message
        });
    }
});

// Get weather data directly from database
app.get('/api/weather', async (req, res) => {
    console.log('Received request for /api/weather');
    
    try {
        // Check if pool exists
        if (!weatherService.pool) {
            console.error('Database pool is not initialized');
            return res.status(500).json({
                error: 'Database connection not initialized'
            });
        }

        const client = await weatherService.pool.connect();
        try {
            console.log('Executing weather query...');
            
            // First check if table exists
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'weather'
                ) as table_exists
            `);
            
            if (!tableCheck.rows[0].table_exists) {
                console.log('Weather table does not exist');
                return res.status(404).json({
                    error: 'Weather table not found in database'
                });
            }

            const query = `
                SELECT DISTINCT ON (location) *
                FROM weather
                ORDER BY location, date DESC`;
            
            console.log('Executing query:', query);
            const result = await client.query(query);
            console.log(`Query returned ${result.rows.length} records`);
            
            // Log first record for debugging
            if (result.rows.length > 0) {
                console.log('First record:', result.rows[0]);
            }

            // Set content type to JSON
            res.setHeader('Content-Type', 'application/json');
            res.json(result.rows);
        } catch (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ 
                error: 'Database query failed',
                details: error.message 
            });
        } finally {
            client.release();
            console.log('Database client released');
        }
    } catch (error) {
        console.error('Error in weather endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// Get historical weather data for Maranhão
app.get('/api/maranhao/weather/history', async (req, res) => {
    try {
        console.log('Requesting historical weather data');
        const client = await weatherService.pool.connect();
        try {
            const query = `
                SELECT *
                FROM weather
                ORDER BY date DESC, location`;
            
            console.log('Executing query:', query);
            const result = await client.query(query);
            console.log(`Query returned ${result.rows.length} records`);
            
            // Log the first record if available
            if (result.rows.length > 0) {
                console.log('First record:', result.rows[0]);
            }
            
            res.json(result.rows);
        } catch (error) {
            console.error('Error executing query:', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching historical weather data:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack 
        });
    }
});

// Test endpoint to get both weather and fire data
app.get('/api/test/data', async (req, res) => {
    try {
        // Get weather data
        const weatherClient = await weatherService.pool.connect();
        const fireClient = await nasaService.pool.connect();
        
        try {
            // Get latest weather data
            const weatherQuery = `
                SELECT DISTINCT ON (location) *
                FROM weather
                ORDER BY location, date DESC`;
            const weatherResult = await weatherClient.query(weatherQuery);
            
            // Get recent fire data (last 7 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            const fireQuery = `
                SELECT 
                    fl.latitude,
                    fl.longitude,
                    fl.state,
                    fl.municipality,
                    fi.acquisition_date as acquisition_date,
                    fi.brightness,
                    fi.scan,
                    fi.track,
                    fi.frp,
                    fi.daynight,
                    fi.type,
                    fi.version,
                    sd.source,
                    sd.satellite,
                    sd.instrument,
                    sd.confidence
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                JOIN satellite_data sd ON fi.satellite_id = sd.id
                WHERE fi.acquisition_date >= $1
                AND fi.acquisition_date <= $2
                ORDER BY fi.acquisition_date DESC`;
            
            const fireResult = await fireClient.query(fireQuery, [startDate.toISOString(), endDate.toISOString()]);
            
            res.json({
                success: true,
                weather: weatherResult.rows,
                fires: fireResult.rows,
                timestamp: new Date().toISOString()
            });
        } finally {
            weatherClient.release();
            fireClient.release();
        }
    } catch (error) {
        console.error('Error in test data endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to fetch test data',
            details: error.message 
        });
    }
});

// Check if dist directory exists
if (!fs.existsSync(distPath)) {
  console.error('Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Serve static files from the dist directory
app.use(express.static(distPath));

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Schedule weather data update at midnight
const scheduleWeatherUpdate = () => {
    // Get the next midnight
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(0, 0, 0, 0);
    
    // If it's already past midnight today, schedule for tomorrow
    if (now > nextMidnight) {
        nextMidnight.setDate(nextMidnight.getDate() + 1);
    }
    
    // Calculate milliseconds until next midnight
    const millisecondsUntilMidnight = nextMidnight.getTime() - now.getTime();
    
    console.log(`Scheduling next weather update for ${nextMidnight.toISOString()}`);
    
    // Schedule the update
    setTimeout(async () => {
        try {
            await weatherService.fetchAndSaveWeatherData();
            // Schedule the next update
            scheduleWeatherUpdate();
        } catch (error) {
            console.error('Error in scheduled weather update:', error);
            // Still schedule the next update even if this one failed
            scheduleWeatherUpdate();
        }
    }, millisecondsUntilMidnight);
};

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Schedule the first weather update
    scheduleWeatherUpdate();
});