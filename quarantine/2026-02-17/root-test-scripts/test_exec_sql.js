
const { getAdminClient } = require('./src/supabase/client');

async function testExecSql() {
    const supabase = getAdminClient();

    console.log('Testing exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: 'SELECT 1 as result'
    });

    if (error) {
        console.error('RPC failed:', error);

        // Try 'execute_sql' as alternative name just in case
        console.log('Trying execute_sql...');
        const { data: data2, error: error2 } = await supabase.rpc('execute_sql', {
            sql: 'SELECT 1 as result'
        });

        if (error2) {
            console.error('Alternative RPC failed:', error2);
        } else {
            console.log('Success with execute_sql:', data2);
        }
    } else {
        console.log('Success with exec_sql:', data);
    }
}

// Load .env first
const path = require('path');
const fs = require('fs');
(function loadEnvFirst() {
    const envPaths = [path.join(__dirname, 'src', '.env')];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf-8');
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const eq = trimmed.indexOf('=');
                if (eq <= 0) return;
                const key = trimmed.slice(0, eq).trim();
                let value = trimmed.slice(eq + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                    value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value;
            });
        }
    }
})();

testExecSql();
