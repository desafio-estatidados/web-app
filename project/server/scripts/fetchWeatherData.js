import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import WeatherService from '../services/weatherService.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root
dotenv.config({ path: join(__dirname, '../../.env') });

async function fetchAndSaveWeatherData() {
    const weatherService = new WeatherService();
    
    // Calculate date range (today's date)
    const endDate = new Date();
    const startDate = new Date();
    const currentDate = startDate.toISOString().split('T')[0]; // Format YYYY-MM-DD

    try {
        console.log('Fetching weather data...');
        console.log(`Date range: ${currentDate} to ${currentDate}`);
        
        // Fetch and save weather data for all cities
        await weatherService.fetchAllCitiesWeather();
        console.log(`Successfully saved weather data for ${currentDate}`);
        
        console.log('\nWeather data fetch and save completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error fetching and saving weather data:', error);
        process.exit(1);
    }
}

// Run the fetch and save operation
fetchAndSaveWeatherData();