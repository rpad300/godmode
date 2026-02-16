
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres'
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        await client.query(`
      ALTER TABLE team_profiles 
      ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ;
    `);

        console.log('Migration successful: Added last_analyzed_at to team_profiles');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
