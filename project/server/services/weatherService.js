import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
import { cities } from '../data/cities.js';

const { Pool } = pg;

if (!process.env.WEATHER_API_KEY) {
    throw new Error('WEATHER_API_KEY is not set in environment variables');
}

if (!process.env.WEATHER_API_UNITS) {
    process.env.WEATHER_API_UNITS = 'metric'; // Default to metric if not set
}

// Validate cities data
if (!cities || !Array.isArray(cities) || cities.length === 0) {
    throw new Error('Cities data is not properly loaded');
}

// Create a map of city names to their data for faster lookups
const citiesMap = new Map();
cities.forEach(city => {
    const cityName = city.name.toLowerCase();
    citiesMap.set(cityName, city);
});

console.log('Loaded cities data:', cities.length, 'cities');

class WeatherService {
    constructor() {
        // Validate required environment variables
        const requiredEnvVars = ['LOCAL_DB_HOST', 'LOCAL_DB_PORT', 'LOCAL_DB_NAME', 'LOCAL_DB_USER', 'LOCAL_DB_PASSWORD'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        console.log('Initializing WeatherService with database connection...');
        console.log('Database:', process.env.LOCAL_DB_NAME);
        console.log('Host:', process.env.LOCAL_DB_HOST);
        console.log('Port:', process.env.LOCAL_DB_PORT);
        console.log('User:', process.env.LOCAL_DB_USER);

        // Initialize database connection
        this.pool = new Pool({
            host: process.env.LOCAL_DB_HOST,
            port: parseInt(process.env.LOCAL_DB_PORT),
            database: process.env.LOCAL_DB_NAME,
            user: process.env.LOCAL_DB_USER,
            password: process.env.LOCAL_DB_PASSWORD
        });

        // Test connection
        this.pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('Database connection error:', err);
                throw err;
            }
            console.log('Database connection successful:', res.rows[0].now);
        });
    }

    async initialize() {
        try {
            await this.initializeWeatherTable();
        } catch (error) {
            console.error('Failed to initialize weather table:', error);
            throw error;
        }
    }

    async initializeWeatherTable() {
        try {
            const client = await this.pool.connect();
            try {
                // Create the weather table with proper schema
                const query = `
                    CREATE TABLE IF NOT EXISTS weather (
                        id SERIAL PRIMARY KEY,
                        municipality VARCHAR(255) NOT NULL,
                        temperature DECIMAL(5,2) NOT NULL,
                        humidity INTEGER NOT NULL,
                        date TIMESTAMP WITH TIME ZONE NOT NULL,
                        latitude DECIMAL(9,6) NOT NULL,
                        longitude DECIMAL(9,6) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `;

                await client.query(query);
                console.log('Weather table created successfully');

                // Create indexes for better query performance
                await client.query('CREATE INDEX IF NOT EXISTS idx_weather_municipality ON weather(municipality)');
                await client.query('CREATE INDEX IF NOT EXISTS idx_weather_date ON weather(date)');

                console.log('Weather table indexes created successfully');
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Failed to create weather table:', error);
            throw error;
        }
    }

    async fetchAllCitiesWeather() {
        for (const city of cities) {
            try {
                const weatherData = await this.fetchWeatherData(city, 'MA', 'BR'); // MA is the state code for Maranhão
                await this.saveWeatherData(weatherData);
                console.log(`Weather data saved for ${city.name}`);
            } catch (error) {
                console.error(`Error fetching or saving weather data for ${city.name}:`, error);
            }
        }
    }

    async fetchWeatherData(city, state, country) {
        try {
            // Log city details for debugging
            console.log(`Fetching detailed weather data for ${city.name} (${city.latitude}, ${city.longitude})`);

            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${city.latitude}&lon=${city.longitude}&appid=${process.env.WEATHER_API_KEY}&units=${process.env.WEATHER_API_UNITS}`
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch weather data: ${response.status} ${response.statusText}. API Response: ${errorText}`);
            }

            const data = await response.json();
            
            // Format the weather data with coordinates
            return {
                location: city.name,
                temperature: data.main.temp,
                feels_like: data.main.feels_like,
                condition: data.weather[0].description,
                pressure: data.main.pressure,
                humidity: data.main.humidity,
                wind_speed: data.wind.speed,
                wind_deg: data.wind.deg,
                visibility: data.visibility,
                date: new Date(data.dt * 1000),
                latitude: city.latitude,  // Pass the city's coordinates
                longitude: city.longitude,
                weather_icon: data.weather[0].icon
            };
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }

    async saveWeatherData(weatherData) {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO weather (
                    municipality,
                    temperature,
                    humidity,
                    date,
                    latitude,
                    longitude
                ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
            
            // Log the coordinates being saved
            console.log(`Saving weather data for ${weatherData.location} with coordinates:`, {
                latitude: weatherData.latitude,
                longitude: weatherData.longitude
            });
            
            await client.query(query, [
                weatherData.location,
                weatherData.temperature,
                weatherData.humidity,
                weatherData.date,
                weatherData.latitude,
                weatherData.longitude
            ]);
        } catch (error) {
            console.error('Error saving weather data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getWeatherData() {
        try {
            console.log('Fetching weather data from database...');
            
            const client = await this.pool.connect();
            try {
                // Get the latest weather data for each location
                const query = `
                    SELECT DISTINCT ON (municipality) *
                    FROM weather
                    ORDER BY municipality, date DESC`;
                
                const result = await client.query(query);
                console.log(`Fetched ${result.rows.length} weather records from database`);
                
                return result.rows;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }

    async getWeatherForCity(cityName) {
        try {
            console.log('Looking up city:', cityName);
            
            // First try to find the city in our cities data
            const city = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
            
            if (!city) {
                console.log(`City not found in cities list: ${cityName}`);
                return null;
            }

            console.log(`Found city coordinates: ${cityName} - Lat: ${city.latitude}, Lon: ${city.longitude}`);

            // Fetch weather data from OpenWeatherMap
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${city.latitude}&lon=${city.longitude}&appid=${process.env.WEATHER_API_KEY}&units=${process.env.WEATHER_API_UNITS}`
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`OpenWeatherMap API error for ${cityName}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    response: errorText
                });
                throw new Error(`Failed to fetch weather data for ${cityName}: ${response.status} ${response.statusText}. API Response: ${errorText}`);
            }

            const data = await response.json();
            console.log(`Weather data received from API for ${cityName}:`, {
                temperature: data.main.temp,
                humidity: data.main.humidity
            });

            // Format the weather data
            const weatherData = {
                municipality: cityName,
                temperature: data.main.temp,
                humidity: data.main.humidity,
                date: new Date(data.dt * 1000),
                latitude: city.latitude,
                longitude: city.longitude
            };

            // Save to database
            const client = await this.pool.connect();
            try {
                await client.query(
                    'INSERT INTO weather (municipality, temperature, humidity, date, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [
                        weatherData.municipality,
                        weatherData.temperature,
                        weatherData.humidity,
                        weatherData.date,
                        weatherData.latitude,
                        weatherData.longitude
                    ]
                );
                console.log('Weather data saved to database for:', cityName);
            } finally {
                client.release();
            }

            // Return as an array to match frontend expectations
            return [weatherData];
        } catch (error) {
            console.error('Error getting weather for city:', {
                cityName,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async fetchWeatherDataForAllCities() {
        try {
            const allWeatherData = [];
            const rateLimit = 1000; // 1 second delay between requests

            for (const city of cities) {
                try {
                    // Log city details for debugging
                    console.log(`Fetching weather data for ${city.name} (${city.latitude}, ${city.longitude})`);

                    // Add delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, rateLimit));

                    const response = await fetch(
                        `https://api.openweathermap.org/data/2.5/weather?lat=${city.latitude}&lon=${city.longitude}&appid=${process.env.WEATHER_API_KEY}&units=${process.env.WEATHER_API_UNITS}`
                    );

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Error fetching weather data for ${city.name}: ${response.status} ${response.statusText}`);
                        console.error(`API Response: ${errorText}`);
                        continue;
                    }

                    const data = await response.json();
                    
                    // Transform the data to match our database schema
                    const weatherData = {
                        municipality: city.name,
                        temperature: data.main.temp,
                        humidity: data.main.humidity,
                        date: new Date(data.dt * 1000),
                        latitude: city.latitude,
                        longitude: city.longitude
                    };

                    allWeatherData.push(weatherData);
                    console.log(`Successfully fetched weather data for ${city.name}`);
                } catch (error) {
                    console.error(`Error processing weather data for ${city.name}:`, error);
                    continue;
                }
            }

            return allWeatherData;
        } catch (error) {
            console.error('Error fetching weather data for all cities:', error);
            throw error;
        }
    }

    async fetchAndSaveWeatherData() {
        try {
            console.log('Starting scheduled weather data update...');
            
            // Filter cities to only include those in Maranhão (you may want to add additional filtering criteria)
            const maranhaoCities = cities.filter(city => city.name !== undefined);
            
            // Fetch weather data for each city
            const weatherData = await Promise.all(
                maranhaoCities.map(async (city) => {
                    try {
                        console.log(`Fetching weather data for ${city.name}...`);
                        
                        const response = await fetch(
                            `https://api.openweathermap.org/data/2.5/weather?lat=${city.latitude}&lon=${city.longitude}&appid=${process.env.WEATHER_API_KEY}&units=${process.env.WEATHER_API_UNITS}`
                        );

                        if (!response.ok) {
                            console.error(`Error fetching weather data for ${city.name}: ${response.status} ${response.statusText}`);
                            return null;
                        }

                        const data = await response.json();
                        
                        // Transform the data to match our database schema
                        return {
                            municipality: city.name,
                            temperature: data.main.temp,
                            humidity: data.main.humidity,
                            date: new Date(data.dt * 1000),
                            latitude: city.latitude,
                            longitude: city.longitude
                        };
                    } catch (error) {
                        console.error(`Error processing weather data for ${city.name}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out any null results
            const validWeatherData = weatherData.filter(Boolean);
            
            // Save all valid weather data to the database
            for (const data of validWeatherData) {
                await this.saveWeatherData(data);
            }
            
            console.log(`Successfully saved weather data for ${validWeatherData.length} cities`);
            
        } catch (error) {
            console.error('Error in scheduled weather update:', error);
            throw error;
        }
    }
}

export default WeatherService;