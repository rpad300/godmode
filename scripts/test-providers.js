#!/usr/bin/env node
/**
 * Quick provider test script
 */

const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', 'src', '.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?(.+?)["']?\s*$/);
        if (match) {
            process.env[match[1]] = match[2];
        }
    });
    console.log('Loaded .env file\n');
}

const MiniMaxProvider = require('../src/llm/providers/minimax');

async function testMiniMax() {
    const apiKey = process.env.MINIMAX_API_KEY;
    console.log('=== Testing MiniMax ===');
    console.log('API Key:', apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET');
    console.log('Endpoint: https://minimax-m2.com/v1');
    
    if (!apiKey) {
        console.log('SKIPPED - No API key');
        return;
    }
    
    const provider = new MiniMaxProvider({ apiKey });
    
    try {
        console.log('\nTesting generateText...');
        const result = await provider.generateText({
            model: 'MiniMax-M2',
            prompt: 'Say hello in one word.',
            maxTokens: 10
        });
        
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('Error:', error.message);
    }
}

testMiniMax().catch(console.error);
