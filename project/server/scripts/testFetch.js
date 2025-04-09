import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NasaService } from '../services/nasaService.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root
dotenv.config({ path: join(__dirname, '../../.env') });

async function testFetch() {
    try {
        const nasaService = new NasaService();
        
        // Get today's date
        const currentDate = new Date().toISOString().split('T')[0];
        
        console.log('Testing NASA service for Maranhão...');
        console.log(`Fetching data for today (${currentDate})`);
        
        // Try both data sources
        const sources = ['VIIRS_SNPP_NRT', 'MODIS_NRT'];
        
        for (const source of sources) {
            console.log(`\nTesting source: ${source}`);
            const fires = await nasaService.getMaranhaoFireData(source);
            console.log(`Found ${fires.length} fires from ${source} for today`);
            
            if (fires.length > 0) {
                console.log('Sample fire data:');
                console.log(`Latitude: ${fires[0].latitude}`);
                console.log(`Longitude: ${fires[0].longitude}`);
                console.log(`Acquisition Date: ${fires[0].acquisition_date}`);
                console.log(`Brightness: ${fires[0].brightness}`);
            }
        }
        
        // Verify data in database
        console.log('\nVerifying database data...');
        const dbFires = await nasaService.getFiresFromDatabase();
        console.log(`Found ${dbFires.length} fires in database for today`);
        
        if (dbFires.length > 0) {
            console.log('Sample database record:');
            console.log(`Latitude: ${dbFires[0].latitude}`);
            console.log(`Longitude: ${dbFires[0].longitude}`);
            console.log(`Acquisition Date: ${dbFires[0].acquisition_date}`);
            console.log(`Brightness: ${dbFires[0].brightness}`);
        }
        
        console.log('\nTest completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testFetch();
