/**
 * Test script for FalkorDB Cloud connection
 */

const { FalkorDB } = require('falkordb');

async function testConnection() {
    console.log('Testing FalkorDB Cloud connection...\n');
    
    const config = {
        socket: {
            host: 'r-6jissuruar.instance-lmsfjoe1r.hc-2uaqqpjgg.us-east-2.aws.f2e0a955bb84.cloud',
            port: 59718,
            tls: true
        },
        password: process.env.FALKORDB_PASSWORD || 'YOUR_PASSWORD_HERE'
    };
    
    console.log('Connection config:');
    console.log('  Host:', config.socket.host);
    console.log('  Port:', config.socket.port);
    console.log('  TLS:', config.socket.tls);
    console.log('  Password:', config.password ? '****' : '(not set)');
    console.log('');
    
    try {
        console.log('Connecting...');
        const db = await FalkorDB.connect(config);
        
        db.on('error', (err) => {
            console.error('Connection error event:', err.message);
        });
        
        console.log('Connected! Selecting graph...');
        const graph = db.selectGraph('test');
        
        console.log('Running test query...');
        const result = await graph.query('RETURN 1 as test');
        
        console.log('Query result:', JSON.stringify(result, null, 2));
        console.log('\nTest value:', result.data?.[0]?.test);
        
        console.log('\nClosing connection...');
        await db.close();
        
        console.log('\n✓ Connection test PASSED!');
    } catch (error) {
        console.error('\n✗ Connection test FAILED!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testConnection();
