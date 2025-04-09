import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
import { cities } from '../data/cities.js';

dotenv.config();
const { Pool } = pg;

// Maranhão state bounding box coordinates
const MARANHAO_STATE_BOUNDS = {
    north: -0.2813,    // Northern most point
    south: -10.4675,  // Southern most point
    west: -47.4748,   // Western most point
    east: -41.1000    // Eastern most point
};

// Data source configurations
const SATELLITE_SOURCES = [
    {
        id: 'VIIRS_SNPP_NRT',
        name: 'VIIRS SNPP NRT',
        description: 'Visible Infrared Imaging Radiometer Suite (VIIRS) from Suomi NPP satellite - Near Real-Time'
    },
    {
        id: 'VIIRS_NOAA20_NRT',
        name: 'VIIRS NOAA-20 NRT',
        description: 'VIIRS from NOAA-20 satellite - Near Real-Time'
    },
    {
        id: 'MODIS_NRT',
        name: 'MODIS NRT',
        description: 'Moderate Resolution Imaging Spectroradiometer (MODIS) - Near Real-Time'
    },
    {
        id: 'VIIRS_SNPP_SP',
        name: 'VIIRS SNPP Standard',
        description: 'VIIRS from Suomi NPP satellite - Standard Processing'
    },
    {
        id: 'VIIRS_NOAA20_SP',
        name: 'VIIRS NOAA-20 Standard',
        description: 'VIIRS from NOAA-20 satellite - Standard Processing'
    },
    {
        id: 'MODIS_SP',
        name: 'MODIS Standard',
        description: 'MODIS - Standard Processing'
    }
];

export class NasaService {
    constructor() {
        this.apiKey = process.env.NASA_FIRMS_API_KEY;
        this.baseUrl = process.env.NASA_FIRMS_API_BASE_URL;
        
        // Initialize database pool
        this.pool = new Pool({
            host: process.env.LOCAL_DB_HOST,
            port: parseInt(process.env.LOCAL_DB_PORT),
            database: process.env.LOCAL_DB_NAME,
            user: process.env.LOCAL_DB_USER,
            password: process.env.LOCAL_DB_PASSWORD
        });

        // Initialize tables
        this.initializeTables();
    }

    async initializeTables() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Create tables if they don't exist
            await client.query(`
                CREATE TABLE IF NOT EXISTS fire_locations (
                    id SERIAL PRIMARY KEY,
                    latitude DECIMAL NOT NULL,
                    longitude DECIMAL NOT NULL,
                    state VARCHAR(100),
                    municipality VARCHAR(100),
                    UNIQUE(latitude, longitude)
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS satellite_data (
                    id SERIAL PRIMARY KEY,
                    source VARCHAR(50) NOT NULL,
                    satellite VARCHAR(50) NOT NULL,
                    instrument VARCHAR(50) NOT NULL,
                    confidence INTEGER,
                    UNIQUE(source, satellite, instrument)
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS fire_incidents (
                    id SERIAL PRIMARY KEY,
                    location_id INTEGER REFERENCES fire_locations(id),
                    satellite_id INTEGER REFERENCES satellite_data(id),
                    acquisition_date TIMESTAMP NOT NULL,
                    brightness DECIMAL,
                    scan DECIMAL,
                    track DECIMAL,
                    frp DECIMAL,
                    daynight VARCHAR(1),
                    type VARCHAR(50),
                    version VARCHAR(50),
                    confidence INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(location_id, satellite_id, acquisition_date)
                )
            `);

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Database initialization error:', error);
            throw new Error(`Failed to initialize database: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async reverseGeocode(latitude, longitude) {
        try {
            // First check if the point is within Maranhão's bounds
            if (latitude < MARANHAO_STATE_BOUNDS.south || 
                latitude > MARANHAO_STATE_BOUNDS.north ||
                longitude < MARANHAO_STATE_BOUNDS.west ||
                longitude > MARANHAO_STATE_BOUNDS.east) {
                return null;
            }

            // Use OpenStreetMap Nominatim API
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&countrycodes=BR`;
            
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data && data.address) {
                    // Check if we have municipality information
                    const municipality = data.address.city || 
                                      data.address.town || 
                                      data.address.village || 
                                      data.address.hamlet;
                    
                    // Validate against our cities data
                    const matchingCity = cities.find(city => 
                        city.name.toLowerCase() === municipality?.toLowerCase()
                    );
                    
                    if (matchingCity) {
                        return {
                            state: 'MA',
                            municipality: matchingCity.name
                        };
                    }
                }
            } catch (error) {
                console.error('Nominatim API error:', error);
            }

            // If Nominatim API fails or returns no results, or if the municipality is not in our cities data
            // Find the closest city from our cities data
            let closestCity = null;
            let minDistance = Infinity;

            for (const city of cities) {
                const dx = latitude - city.latitude;
                const dy = longitude - city.longitude;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCity = city;
                }
            }

            return closestCity ? {
                state: 'MA',
                municipality: closestCity.name
            } : null;
        } catch (error) {
            console.error('Geocoding error:', error);
            // Find the closest city from our cities data as fallback
            let closestCity = null;
            let minDistance = Infinity;

            for (const city of cities) {
                const dx = latitude - city.latitude;
                const dy = longitude - city.longitude;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCity = city;
                }
            }

            return closestCity ? {
                state: 'MA',
                municipality: closestCity.name
            } : null;
        }
    }

    async getMaranhaoFireData(startDate, endDate) {
        try {
            console.log('Fetching data from NASA FIRMS API for Maranhão...');
            console.log(`Fetching data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
            
            // Array to store all fires from different sources
            const allFires = [];
            
            // Process each satellite source
            for (const source of SATELLITE_SOURCES) {
                console.log(`\nFetching data from ${source.name} (${source.id})...`);
                
                // Format dates for NASA API
                const startParam = startDate.toISOString().split('T')[0];
                const endParam = endDate.toISOString().split('T')[0];
                
                // Use Maranhão's bounding box with date range
                const url = new URL(`${this.baseUrl}/area/csv/${this.apiKey}/${source.id}/${MARANHAO_STATE_BOUNDS.west},${MARANHAO_STATE_BOUNDS.south},${MARANHAO_STATE_BOUNDS.east},${MARANHAO_STATE_BOUNDS.north}/10`);
                url.searchParams.append('begin', startParam);
                url.searchParams.append('end', endParam);
                
                console.log('Requesting URL:', url.toString());

                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`Error fetching data from ${source.name}: ${response.status} ${response.statusText}`);
                    continue;
                }

                const text = await response.text();
                console.log(`Received data length from ${source.name}:`, text.length);

                // Parse CSV data
                const lines = text.trim().split('\n');
                const headers = lines[0].split(',');
                const fires = [];

                // Helper function to safely parse numbers
                const safeParseFloat = (value) => {
                    const parsed = parseFloat(value);
                    return isNaN(parsed) ? 0 : parsed;
                };

                const safeParseInt = (value) => {
                    const parsed = parseInt(value);
                    return isNaN(parsed) ? 0 : parsed;
                };

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    if (values.length !== headers.length) continue;

                    const fire = {};
                    headers.forEach((header, index) => {
                        fire[header.trim()] = values[index]?.trim() || null;
                    });

                    // Convert date string to Date object
                    if (fire.acq_date) {
                        fire.acquisition_date = new Date(fire.acq_date);
                    }

                    // Skip if date is outside the requested range
                    if (!fire.acquisition_date) continue;
                    if (fire.acquisition_date < startDate || fire.acquisition_date > endDate) continue;

                    // Parse coordinates
                    const latitude = safeParseFloat(fire.latitude);
                    const longitude = safeParseFloat(fire.longitude);

                    // Skip if coordinates are invalid
                    if (isNaN(latitude) || isNaN(longitude)) continue;

                    // Skip if outside Maranhão bounds
                    if (latitude < MARANHAO_STATE_BOUNDS.south || 
                        latitude > MARANHAO_STATE_BOUNDS.north ||
                        longitude < MARANHAO_STATE_BOUNDS.west ||
                        longitude > MARANHAO_STATE_BOUNDS.east) {
                        continue;
                    }

                    // Get municipality information
                    const municipalityInfo = await this.reverseGeocode(latitude, longitude);
                    if (!municipalityInfo) {
                        console.log(`Could not find municipality for coordinates: ${latitude},${longitude}`);
                        continue;
                    }

                    fires.push({
                        latitude,
                        longitude,
                        acquisition_date: fire.acquisition_date,
                        brightness: safeParseFloat(fire.bright_ti4 || fire.brightness),
                        scan: safeParseFloat(fire.scan),
                        track: safeParseFloat(fire.track),
                        satellite: fire.satellite || source.id,
                        instrument: fire.instrument || source.id.split('_')[0],
                        confidence: safeParseInt(fire.confidence),
                        frp: safeParseFloat(fire.frp),
                        daynight: fire.daynight || 'D',
                        type: 'hotspot',
                        version: '1.0',
                        municipality: municipalityInfo.municipality,
                        state: municipalityInfo.state
                    });
                }

                console.log(`Parsed ${fires.length} fires from ${source.name} within date range`);
                allFires.push(...fires);
            }

            console.log(`\nTotal fires parsed within date range and Maranhão bounds: ${allFires.length}`);
            return allFires;
        } catch (error) {
            console.error('Error in getMaranhaoFireData:', error);
            throw error;
        }
    }

    async saveFireData(fires, source) {
        const client = await this.pool.connect();
        try {
            // First, get or create the satellite data entry
            const satelliteData = await client.query(`
                INSERT INTO satellite_data (source, satellite, instrument)
                VALUES ($1, $2, $3)
                ON CONFLICT (source, satellite, instrument)
                DO NOTHING
                RETURNING id
            `, [source, source, source]);
            
            const satelliteId = satelliteData.rows[0].id;
            
            // Process each fire
            for (const fire of fires) {
                try {
                    // First check if location exists
                    const locationCheck = await client.query(`
                        SELECT id 
                        FROM fire_locations 
                        WHERE latitude = $1 
                        AND longitude = $2
                    `, [fire.latitude, fire.longitude]);
                    
                    let locationId;
                    if (locationCheck.rows.length === 0) {
                        // Location doesn't exist, create it
                        const locationResult = await client.query(`
                            INSERT INTO fire_locations (latitude, longitude, state, municipality)
                            VALUES ($1, $2, $3, $4)
                            RETURNING id
                        `, [fire.latitude, fire.longitude, fire.state || 'MA', fire.municipality || 'Unknown']);
                        locationId = locationResult.rows[0].id;
                    } else {
                        locationId = locationCheck.rows[0].id;
                    }
                    
                    // Check if this fire already exists for this location and date
                    const fireCheck = await client.query(`
                        SELECT id 
                        FROM fire_incidents 
                        WHERE location_id = $1 
                        AND acquisition_date = $2
                        AND satellite_id = $3
                    `, [locationId, fire.acquisition_date, satelliteId]);
                    
                    if (fireCheck.rows.length === 0) {
                        // Fire doesn't exist for this location and date, insert it
                        await client.query(`
                            INSERT INTO fire_incidents (
                                location_id, 
                                satellite_id, 
                                acquisition_date,
                                brightness,
                                scan,
                                track,
                                frp,
                                daynight,
                                type,
                                version,
                                confidence
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        `, [
                            locationId,
                            satelliteId,
                            fire.acquisition_date,
                            fire.brightness,
                            fire.scan,
                            fire.track,
                            fire.frp,
                            fire.daynight,
                            fire.type,
                            fire.version,
                            fire.confidence
                        ]);
                    }
                } catch (error) {
                    console.error(`Error processing fire ${fire.latitude},${fire.longitude}:`, error);
                    // Continue with next fire even if one fails
                    continue;
                }
            }
            
            return fires.length;
        } catch (error) {
            console.error('Error saving fire data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getMunicipalities() {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT DISTINCT municipality, state
                FROM fire_locations
                WHERE municipality IS NOT NULL
                ORDER BY state, municipality
            `;
            const result = await client.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error fetching municipalities:', error);
            throw new Error(`Failed to fetch municipalities: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async getFiresFromDatabase(startDate = null, endDate = null, municipality = null) {
        const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        if (!startDate) startDate = currentDate;
        if (!endDate) endDate = currentDate;

        const client = await this.pool.connect();
        try {
            // First check if any data exists in the tables
            const testQuery = `
                SELECT COUNT(*) as count 
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                WHERE fl.state = 'MA'
            `;
            const testResult = await client.query(testQuery);
            console.log('Total fires in database:', testResult.rows[0].count);

            // Check if we have any fires in the specified date range
            const dateRangeQuery = `
                SELECT COUNT(*) as count 
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                WHERE fl.state = 'MA'
                AND fi.acquisition_date >= $1
                AND fi.acquisition_date <= $2
            `;
            const dateRangeResult = await client.query(dateRangeQuery, [startDate, endDate]);
            console.log('Total fires in date range:', dateRangeResult.rows[0].count);

            // Log the municipality filter
            console.log('Municipality filter:', municipality);

            let query = `
                SELECT 
                    fl.latitude,
                    fl.longitude,
                    fl.state,
                    fl.municipality,
                    fi.acquisition_date,
                    fi.brightness,
                    fi.scan,
                    fi.track,
                    fi.frp,
                    fi.daynight,
                    fi.type,
                    fi.version,
                    fi.confidence,
                    sd.source,
                    sd.satellite,
                    sd.instrument,
                    fi.id,
                    fi.location_id,
                    fi.satellite_id,
                    fi.created_at,
                    fi.updated_at
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                JOIN satellite_data sd ON fi.satellite_id = sd.id
                WHERE fl.state = 'MA'
            `;

            const params = [startDate, endDate];
            
            // Add date range filter
            query += ` AND fi.acquisition_date >= $1
                      AND fi.acquisition_date <= $2`;

            // Add municipality filter if provided
            if (municipality) {
                params.push(municipality);
                query += ` AND fl.municipality ILIKE $${params.length}`;
            }

            query += ' ORDER BY fi.acquisition_date DESC';

            console.log('Executing fire query:', query);
            console.log('With parameters:', params);

            const result = await client.query(query, params);
            console.log('Query returned', result.rows.length, 'rows');
            
            // Log the first few results for debugging
            if (result.rows.length > 0) {
                console.log('First fire data point:', result.rows[0]);
                if (result.rows.length > 1) {
                    console.log('Second fire data point:', result.rows[1]);
                }
            }

            return result.rows;
        } catch (error) {
            console.error('Error in getFiresFromDatabase:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getMaranhaoFireStats(startDate = null, endDate = null) {
        const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        if (!startDate) startDate = currentDate;
        if (!endDate) endDate = currentDate;

        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_fires,
                    AVG(brightness) as avg_brightness,
                    MAX(brightness) as max_brightness,
                    MIN(brightness) as min_brightness,
                    COUNT(DISTINCT municipality) as affected_municipalities
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                WHERE fl.latitude >= $1 AND fl.latitude <= $2
                AND fl.longitude >= $3 AND fl.longitude <= $4
            `;

            const params = [MARANHAO_STATE_BOUNDS.south, MARANHAO_STATE_BOUNDS.north, MARANHAO_STATE_BOUNDS.west, MARANHAO_STATE_BOUNDS.east];
            if (startDate && endDate) {
                query += ` AND fi.acquisition_date BETWEEN $5 AND $6`;
                params.push(startDate, endDate);
            }

            const result = await client.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('Error fetching fire statistics:', error);
            throw new Error(`Failed to fetch fire statistics: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async getActiveFires(startDate = null, endDate = null) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    fl.latitude,
                    fl.longitude,
                    sd.brightness_temp_k,
                    sd.frp,
                    sd.confidence,
                    sd.detection_time,
                    fi.status
                FROM fire_incidents fi
                JOIN fire_locations fl ON fi.location_id = fl.id
                JOIN satellite_data sd ON fl.id = sd.location_id
                WHERE fl.latitude >= $1 AND fl.latitude <= $2 
                AND fl.longitude >= $3 AND fl.longitude <= $4
                AND fi.status = 'active'
            `;

            const params = [MARANHAO_STATE_BOUNDS.south, MARANHAO_STATE_BOUNDS.north, MARANHAO_STATE_BOUNDS.west, MARANHAO_STATE_BOUNDS.east];
            if (startDate && endDate) {
                query += ` AND sd.detection_time BETWEEN $5 AND $6`;
                params.push(startDate, endDate);
            }

            query += ` ORDER BY sd.detection_time DESC`;

            const result = await client.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error fetching active fires:', error);
            throw new Error(`Failed to fetch active fires: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async fetchAllSatelliteData(startDate, endDate) {
        console.log('Fetching data from all available satellites...');
        const allFires = [];

        for (const source of SATELLITE_SOURCES) {
            try {
                console.log(`\nFetching data from ${source.name} (${source.id})...`);
                const fires = await this.getMaranhaoFireData(startDate, endDate);
                console.log(`Successfully fetched ${fires.length} fires from ${source.id}`);
                allFires.push(...fires);
            } catch (error) {
                console.error(`Error fetching data from ${source.id}:`, error);
                // Continue with other sources even if one fails
            }
            
            // Add delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`\nTotal fires fetched from all sources: ${allFires.length}`);
        return allFires;
    }

    calculateSeverity(fire) {
        if (fire.frp > 100 && fire.confidence > 80) return 'extreme';
        if (fire.frp > 50 && fire.confidence > 70) return 'high';
        if (fire.frp > 20 && fire.confidence > 60) return 'medium';
        return 'low';
    }

    isRecentDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(now.getDate() - 2);
        return date >= twoDaysAgo;
    }

    getValidDateRange() {
        const now = new Date();
        const tenDaysAgo = new Date(now);
        tenDaysAgo.setDate(now.getDate() - 10);
        return {
            minDate: tenDaysAgo.toISOString().split('T')[0],
            maxDate: now.toISOString().split('T')[0]
        };
    }

    async getDataAvailability() {
        const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        return SATELLITE_SOURCES.map(source => ({
            data_id: source.id,
            min_date: currentDate,
            max_date: currentDate
        }));
    }
}
