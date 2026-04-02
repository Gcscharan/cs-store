import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';

interface RawPincodeRow {
  [key: string]: string;
}

interface NormalizedPincode {
  pincode: string;
  state: string;
  postal_district: string;
  admin_district: string;
  cities: string[];
  deliverable: boolean;
}

const CSV_PATH = '/Users/gannavarapuchiranjeevisatyacharan/Downloads/5c2f62fe-5afa-4119-a499-fec9d604d5bd.csv';
const OUTPUT_PATH = path.resolve(__dirname, '../../data/pincodes_india.json');

const processCSV = async () => {
  console.log('📖 Reading CSV from:', CSV_PATH);
  
  const pincodeMap = new Map<string, NormalizedPincode>();
  let rowCount = 0;
  let skippedCount = 0;

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row: RawPincodeRow) => {
        rowCount++;
        
        // Log first row to understand structure
        if (rowCount === 1) {
          console.log('📋 CSV Columns:', Object.keys(row));
          console.log('📋 Sample Row:', row);
        }

        // Extract pincode (try common column names)
        const pincode = (
          row.pincode || 
          row.Pincode || 
          row.PIN || 
          row.pin || 
          row.postal_code ||
          row.postalcode ||
          ''
        ).trim();

        // Validate pincode
        if (!/^\d{6}$/.test(pincode)) {
          skippedCount++;
          return;
        }

        // Extract state
        const state = (
          row.state || 
          row.State || 
          row.statename ||
          row.StateName ||
          ''
        ).trim();

        if (!state) {
          skippedCount++;
          return;
        }

        // Extract district
        const district = (
          row.district || 
          row.District || 
          row.districtname ||
          row.DistrictName ||
          row.postal_district ||
          ''
        ).trim();

        // Extract city/taluka
        const city = (
          row.city || 
          row.City || 
          row.officename ||
          row.OfficeName ||
          row.taluka ||
          row.Taluka ||
          ''
        ).trim().replace(/\s+(S\s*O|B\s*O|H\s*O)$/i, ''); // Remove S O, B O, H O suffixes

        // Check if deliverable (AP/TS only for now)
        const deliverable = state === 'Andhra Pradesh' || state === 'Telangana' || state === 'ANDHRA PRADESH' || state === 'TELANGANA';

        // Get or create pincode entry
        const existing = pincodeMap.get(pincode);
        
        if (existing) {
          // Merge cities
          if (city && !existing.cities.includes(city)) {
            existing.cities.push(city);
          }
        } else {
          // Create new entry
          pincodeMap.set(pincode, {
            pincode,
            state,
            postal_district: district,
            admin_district: district, // Will apply overrides later
            cities: city ? [city] : [],
            deliverable,
          });
        }
      })
      .on('end', () => {
        console.log(`✅ Processed ${rowCount} rows`);
        console.log(`⚠️  Skipped ${skippedCount} invalid rows`);
        console.log(`📦 Unique pincodes: ${pincodeMap.size}`);
        
        // Convert to array
        const pincodes = Array.from(pincodeMap.values());
        
        // Apply district overrides for AP/TS
        const districtOverrides: Record<string, Record<string, string>> = {
          'Andhra Pradesh': {
            'Krishna': 'NTR',
            'Chittoor': 'Annamayya',
          },
          'ANDHRA PRADESH': {
            'Krishna': 'NTR',
            'Chittoor': 'Annamayya',
          },
          'Telangana': {
            'Medak': 'Sangareddy',
          },
          'TELANGANA': {
            'Medak': 'Sangareddy',
          },
        };

        pincodes.forEach(p => {
          const override = districtOverrides[p.state]?.[p.postal_district];
          if (override) {
            p.admin_district = override;
          }
        });

        // Write to JSON
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pincodes, null, 2));
        console.log(`✅ Written to: ${OUTPUT_PATH}`);
        
        // Test specific pincodes
        const test521237 = pincodes.find(p => p.pincode === '521237');
        const test500001 = pincodes.find(p => p.pincode === '500001');
        
        console.log('\n🔍 Test Results:');
        console.log('521237:', test521237 || 'NOT FOUND');
        console.log('500001:', test500001 || 'NOT FOUND');
        
        resolve();
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV:', error);
        reject(error);
      });
  });
};

processCSV()
  .then(() => {
    console.log('\n✅ CSV processing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ CSV processing failed:', error);
    process.exit(1);
  });
