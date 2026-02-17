
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, 'src', '.env');
let hasDbUrl = false;

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    if (content.includes('DATABASE_URL=')) {
        hasDbUrl = true;
        // Print safely (masking password)
        const match = content.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
        if (match) {
            console.log('DATABASE_URL found');
        }
    }
}

if (!hasDbUrl) {
    console.log('DATABASE_URL NOT found in src/.env');
}
