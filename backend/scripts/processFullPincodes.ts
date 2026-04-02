import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

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
const OUTPUT_PATH = path.resolve(__dirname, '../data/pincodes_india.json');

const processCSV = async () => {
  console.log('📖 Reading CSV from:', CSV_PATH);
  
  const pincodeMap = new Map<string, NormalizedPincode>();
  let rowCount = 0;
  let skippedCount = 0;

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csvParser())
      .on('data', (row: RawPincodeRow) => {
        rowCount++;
        
        if (rowCount === 1) {
          console.log('📋 CSV Columns:', Object.keys(row));
          console.log('📋 Sample Row:', row);
        }

        const pincode = (
          row.pincode || 
          row.Pincode || 
          row.PIN || 
          row.pin || 
          row.postal_code ||
          row.postalcode ||
          ''
        ).trim();

        if (!/^\d{6}$/.test(pincode)) {
          skippedCount++;
          return;
        }

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

        const district = (
          row.district || 
          row.District || 
          row.districtname ||
          row.DistrictName ||
          row.postal_district ||
          ''
        ).trim();

        const city = (
          row.city || 
          row.City || 
          row.officename ||
          row.OfficeName ||
          row.taluka ||
          row.Taluka ||
          ''
        ).trim().replace(/\s+(S\s*O|B\s*O|H\s*O)$/i, '');

        // Dataset provides location data only - deliverable is business logic
        // Will be determined by distance-based delivery system later
        const deliverable = false;

        const existing = pincodeMap.get(pincode);
        
        if (existing) {
          if (city && !existing.cities.includes(city)) {
            existing.cities.push(city);
          }
        } else {
          pincodeMap.set(pincode, {
            pincode,
            state,
            postal_district: district,
            admin_district: district,
            cities: city ? [city] : [],
            deliverable,
          });
        }
      })
      .on('end', () => {
        console.log(`✅ Processed ${rowCount} rows`);
        console.log(`⚠️  Skipped ${skippedCount} invalid rows`);
        console.log(`📦 Unique pincodes: ${pincodeMap.size}`);
        
        const pincodes = Array.from(pincodeMap.values());
        
        const districtOverrides: Record<string, Record<string, string>> = {
          'ANDHRA PRADESH': {
            'KRISHNA': 'NTR',
            'CHITTOOR': 'Annamayya',
          },
          'TELANGANA': {
            'MEDAK': 'Sangareddy',
          },
        };

        pincodes.forEach(p => {
          const override = districtOverrides[p.state.toUpperCase()]?.[p.postal_district.toUpperCase()];
          if (override) {
            p.admin_district = override;
          }
        });

        // Add missing pincode 521237 manually (not in source CSV)
        // Note: deliverable=false by default, will be determined by business logic
        pincodes.push({
          pincode: '521237',
          state: 'ANDHRA PRADESH',
          postal_district: 'KRISHNA',
          admin_district: 'NTR',
          cities: ['Tiruvuru'],
          deliverable: false,
        });

        console.log(`📦 Total pincodes (with manual additions): ${pincodes.length}`);

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pincodes, null, 2));
        console.log(`✅ Written to: ${OUTPUT_PATH}`);
        
        const test521237 = pincodes.find(p => p.pincode === '521237');
        const test500001 = pincodes.find(p => p.pincode === '500001');
        
        console.log('\n🔍 Test Results:');
        console.log('521237:', test521237 || 'NOT FOUND');
        console.log('500001:', test500001 || 'NOT FOUND');
        
        resolve();
      })
      .on('error', (error: any) => {
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
