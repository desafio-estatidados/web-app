import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NasaService } from '../services/nasaService.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root
dotenv.config({ path: join(__dirname, '../../.env') });

async function fetchAndSaveData() {
    const nasaService = new NasaService();
    
    try {
        console.log('Fetching data from NASA FIRMS API for Maranhão...');
        
        // Calculate date range for the last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        
        console.log(`Fetching data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Fetch data from all satellite sources
        const fires = await nasaService.getMaranhaoFireData(startDate, endDate);
        console.log(`\nFetched ${fires.length} fires from NASA FIRMS API`);
        
        if (fires.length === 0) {
            console.log('No fires found in the data. Skipping database save.');
            return;
        }

        // Save the fires to the database
        console.log('Starting database save operation...');
        console.log('Sample fire data:', fires[0]);
        
        await nasaService.saveFireData(fires, 'ALL_SOURCES');
        
        console.log(`\nSuccessfully saved ${fires.length} fire incidents from all satellite sources`);
        console.log('Data fetch and save completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error fetching and saving data:', error);
        if (error.stack) {
            console.error('Error stack:', error.stack);
        }
        process.exit(1);
    }
}

// Run the fetch and save operation
fetchAndSaveData();
