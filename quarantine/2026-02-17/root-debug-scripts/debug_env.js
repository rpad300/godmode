
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
console.log('Checking .env at:', envPath);

if (fs.existsSync(envPath)) {
    console.log('.env exists');
    const content = fs.readFileSync(envPath, 'utf-8');
    console.log('Content length:', content.length);
    console.log('First 50 chars:', content.substring(0, 50));

    // Parse it
    content.split(/\r?\n/).forEach(line => {
        const [key, value] = line.split('=');
        if (key && key.trim() === 'SUPABASE_URL') {
            console.log('Found SUPABASE_URL:', value ? 'Has value' : 'Empty');
        }
    });
} else {
    console.log('.env does NOT exist');
}
