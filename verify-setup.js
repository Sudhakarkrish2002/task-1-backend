/**
 * Setup Verification Script
 * Run this to verify everything is working for your interview demo
 */

const mqtt = require('mqtt');
const WebSocket = require('ws');

console.log('🔍 Verifying IoT Dashboard Setup for Interview Demo...\n');

// Test MQTT Connection
async function testMQTT() {
  return new Promise((resolve) => {
    console.log('1️⃣ Testing MQTT Connection to Mosquitto...');
    
    const client = mqtt.connect('mqtt://localhost:1883', {
      clientId: 'test-client-' + Math.random().toString(16).slice(2, 8),
      clean: true,
      connectTimeout: 5000
    });

    const timeout = setTimeout(() => {
      console.log('❌ MQTT connection timeout - Mosquitto not running');
      console.log('💡 Start Mosquitto: docker run -it -p 1883:1883 -p 9001:9001 eclipse-mosquitto');
      client.end();
      resolve(false);
    }, 5000);

    client.on('connect', () => {
      clearTimeout(timeout);
      console.log('✅ MQTT connection successful');
      client.end();
      resolve(true);
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      console.log('❌ MQTT connection failed:', err.message);
      console.log('💡 Start Mosquitto: docker run -it -p 1883:1883 -p 9001:9001 eclipse-mosquitto');
      resolve(false);
    });
  });
}

// Test Backend WebSocket
async function testBackend() {
  return new Promise((resolve) => {
    console.log('2️⃣ Testing Backend WebSocket Server...');
    
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    const timeout = setTimeout(() => {
      console.log('❌ Backend WebSocket timeout - Backend not running');
      console.log('💡 Start Backend: cd iot-dashboard-backend-old && npm start');
      ws.close();
      resolve(false);
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ Backend WebSocket connection successful');
      ws.close();
      resolve(true);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log('❌ Backend WebSocket failed:', err.message);
      console.log('💡 Start Backend: cd iot-dashboard-backend-old && npm start');
      resolve(false);
    });
  });
}

// Test Frontend
async function testFrontend() {
  return new Promise((resolve) => {
    console.log('3️⃣ Testing Frontend Server...');
    
    const http = require('http');
    
    const req = http.get('http://localhost:5173', (res) => {
      console.log('✅ Frontend server is running');
      resolve(true);
    });

    req.on('error', (err) => {
      console.log('❌ Frontend server not running:', err.message);
      console.log('💡 Start Frontend: cd iot-dashboard && npm run dev');
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('❌ Frontend server timeout');
      console.log('💡 Start Frontend: cd iot-dashboard && npm run dev');
      req.destroy();
      resolve(false);
    });
  });
}

// Main verification
async function verifySetup() {
  console.log('🚀 IoT Dashboard Setup Verification\n');
  
  const mqttOk = await testMQTT();
  const backendOk = await testBackend();
  const frontendOk = await testFrontend();
  
  console.log('\n📊 Verification Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`MQTT (Mosquitto):     ${mqttOk ? '✅ Ready' : '❌ Not Ready'}`);
  console.log(`Backend (Node.js):    ${backendOk ? '✅ Ready' : '❌ Not Ready'}`);
  console.log(`Frontend (React):     ${frontendOk ? '✅ Ready' : '❌ Not Ready'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (mqttOk && backendOk && frontendOk) {
    console.log('\n🎉 ALL SYSTEMS READY FOR INTERVIEW DEMO!');
    console.log('\n📋 Next Steps:');
    console.log('1. Run: node test-temp-sensor.js');
    console.log('2. Open: http://localhost:5173');
    console.log('3. Create Gauge widget with topic: home/livingroom/temp');
    console.log('4. Watch real-time updates!');
    console.log('\n🚀 You\'re ready to impress! Good luck!');
  } else {
    console.log('\n⚠️  Some services need to be started:');
    if (!mqttOk) {
      console.log('   • Start Mosquitto: docker run -it -p 1883:1883 -p 9001:9001 eclipse-mosquitto');
    }
    if (!backendOk) {
      console.log('   • Start Backend: cd iot-dashboard-backend-old && npm start');
    }
    if (!frontendOk) {
      console.log('   • Start Frontend: cd iot-dashboard && npm run dev');
    }
  }
}

// Run verification
verifySetup().catch(console.error);
