// Test .env parsing
const fs = require('fs');
const envPath = './src/.env';
const content = fs.readFileSync(envPath, 'utf-8');

console.log('Testing .env parsing:\n');

content.split('\n').forEach((line, i) => {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?(.+?)["']?\s*$/);
    if (match) {
        console.log(`${match[1]}: "${match[2].substring(0, 40)}..."`);
        // Check if value starts with quote
        if (match[2].startsWith('"') || match[2].startsWith("'")) {
            console.log('  WARNING: Value includes quotes!');
        }
    }
});

console.log('\n--- Testing Supabase vars specifically ---');
const supUrl = content.match(/SUPABASE_PROJECT_URL\s*=\s*["']?(.+?)["']?\s*$/m);
const supAnon = content.match(/SUPABASE_PROJECT_ANON_KEY\s*=\s*["']?(.+?)["']?\s*$/m);
console.log('URL match:', supUrl ? supUrl[1] : 'NOT FOUND');
console.log('Anon match:', supAnon ? supAnon[1].substring(0, 40) : 'NOT FOUND');
