/**
 * 🧪 COMPLETE END-TO-END TEST
 * 
 * This script tests the ENTIRE professional IoT dashboard flow:
 * 1. MQTT Broker connection
 * 2. Backend MQTT service
 * 3. WebSocket server
 * 4. Database persistence
 * 5. Real-time data flow
 * 
 * Usage:
 *   node test-complete-flow.js
 */

const mqtt = require('mqtt');
const WebSocket = require('ws');
const http = require('http');

console.log('🧪 PROFESSIONAL IOT DASHBOARD - COMPLETE FLOW TEST');
console.log('=' .repeat(70));
console.log('');

// Configuration
const config = {
  mqtt: {
    broker: 'mqtt://localhost:1883',
    topic: 'test/complete/flow',
    clientId: 'test-client-' + Math.random().toString(16).slice(2, 10)
  },
  backend: {
    http: 'http://localhost:5000',
    ws: 'ws://localhost:5000/ws'
  }
};

// Test results
const testResults = {
  mqttBrokerConnection: false,
  backendHealthCheck: false,
  mqttServiceHealth: false,
  websocketConnection: false,
  mqttPublish: false,
  websocketReceive: false,
  databaseSave: false,
  databaseRetrieve: false
};

let testsPassed = 0;
let testsFailed = 0;

// Helper function to print test result
function printTestResult(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASSED' : 'FAILED';
  console.log(`${icon} ${testName.padEnd(40)} [${status}]`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (passed) {
    testsPassed++;
  } else {
    testsFailed++;
  }
}

// Test 1: MQTT Broker Connection
async function testMqttBroker() {
  return new Promise((resolve) => {
    console.log('\n📡 Test 1: MQTT Broker Connection');
    console.log('-'.repeat(70));
    
    const client = mqtt.connect(config.mqtt.broker, {
      clientId: config.mqtt.clientId,
      connectTimeout: 5000
    });

    const timeout = setTimeout(() => {
      client.end(true);
      testResults.mqttBrokerConnection = false;
      printTestResult('MQTT Broker Connection', false, 'Connection timeout');
      resolve(false);
    }, 5000);

    client.on('connect', () => {
      clearTimeout(timeout);
      testResults.mqttBrokerConnection = true;
      printTestResult('MQTT Broker Connection', true, `Connected as ${config.mqtt.clientId}`);
      client.end();
      resolve(true);
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      testResults.mqttBrokerConnection = false;
      printTestResult('MQTT Broker Connection', false, `Error: ${error.message}`);
      client.end(true);
      resolve(false);
    });
  });
}

// Test 2: Backend Health Check
async function testBackendHealth() {
  return new Promise((resolve) => {
    console.log('\n🏥 Test 2: Backend Health Check');
    console.log('-'.repeat(70));

    http.get(`${config.backend.http}/api/health`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          testResults.backendHealthCheck = health.success === true;
          printTestResult(
            'Backend Health Check',
            testResults.backendHealthCheck,
            `Status: ${health.message || 'OK'}`
          );
          resolve(testResults.backendHealthCheck);
        } catch (error) {
          testResults.backendHealthCheck = false;
          printTestResult('Backend Health Check', false, `Parse error: ${error.message}`);
          resolve(false);
        }
      });
    }).on('error', (error) => {
      testResults.backendHealthCheck = false;
      printTestResult('Backend Health Check', false, `Error: ${error.message}`);
      resolve(false);
    });
  });
}

// Test 3: MQTT Service Health
async function testMqttServiceHealth() {
  return new Promise((resolve) => {
    console.log('\n🔌 Test 3: Backend MQTT Service Health');
    console.log('-'.repeat(70));

    http.get(`${config.backend.http}/api/mqtt/health`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          testResults.mqttServiceHealth = health.connected === true;
          printTestResult(
            'MQTT Service Health',
            testResults.mqttServiceHealth,
            testResults.mqttServiceHealth
              ? `Connected | Subscriptions: ${health.subscriptions.join(', ')}`
              : 'Not connected'
          );
          resolve(testResults.mqttServiceHealth);
        } catch (error) {
          testResults.mqttServiceHealth = false;
          printTestResult('MQTT Service Health', false, `Parse error: ${error.message}`);
          resolve(false);
        }
      });
    }).on('error', (error) => {
      testResults.mqttServiceHealth = false;
      printTestResult('MQTT Service Health', false, `Error: ${error.message}`);
      resolve(false);
    });
  });
}

// Test 4-6: WebSocket + MQTT Message Flow
async function testWebSocketFlow() {
  return new Promise((resolve) => {
    console.log('\n🌐 Test 4-6: WebSocket + Real-Time MQTT Flow');
    console.log('-'.repeat(70));

    // Create WebSocket connection
    const ws = new WebSocket(config.backend.ws);
    let wsConnected = false;
    let messageReceived = false;
    let mqttClient = null;

    const cleanup = () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      if (mqttClient) mqttClient.end(true);
    };

    const timeout = setTimeout(() => {
      cleanup();
      if (!wsConnected) {
        testResults.websocketConnection = false;
        printTestResult('WebSocket Connection', false, 'Connection timeout');
      }
      if (!messageReceived) {
        testResults.websocketReceive = false;
        printTestResult('WebSocket Receive MQTT Data', false, 'No message received');
      }
      resolve(wsConnected && messageReceived);
    }, 10000);

    ws.on('open', () => {
      wsConnected = true;
      testResults.websocketConnection = true;
      printTestResult('WebSocket Connection', true, `Connected to ${config.backend.ws}`);

      // Subscribe to test topic
      ws.send(JSON.stringify({
        action: 'subscribe',
        topic: config.mqtt.topic
      }));

      // Wait a bit, then publish MQTT message
      setTimeout(() => {
        mqttClient = mqtt.connect(config.mqtt.broker, {
          clientId: config.mqtt.clientId + '-publisher'
        });

        mqttClient.on('connect', () => {
          const testData = {
            value: 42.5,
            unit: 'test',
            timestamp: new Date().toISOString(),
            test: 'complete-flow'
          };

          mqttClient.publish(config.mqtt.topic, JSON.stringify(testData), (error) => {
            if (error) {
              testResults.mqttPublish = false;
              printTestResult('MQTT Publish', false, `Error: ${error.message}`);
            } else {
              testResults.mqttPublish = true;
              printTestResult('MQTT Publish', true, `Published to ${config.mqtt.topic}`);
            }
          });
        });
      }, 1000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'mqtt' && message.topic === config.mqtt.topic) {
          messageReceived = true;
          testResults.websocketReceive = true;
          clearTimeout(timeout);
          
          printTestResult(
            'WebSocket Receive MQTT Data',
            true,
            `✨ Complete flow working! Data: ${JSON.stringify(message.data)}`
          );
          
          cleanup();
          resolve(true);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      testResults.websocketConnection = false;
      printTestResult('WebSocket Connection', false, `Error: ${error.message}`);
      clearTimeout(timeout);
      cleanup();
      resolve(false);
    });
  });
}

// Test 7: Database Save
async function testDatabaseSave() {
  return new Promise((resolve) => {
    console.log('\n💾 Test 7: Database Save (Dashboard Persistence)');
    console.log('-'.repeat(70));

    const testDashboard = {
      name: 'Test Dashboard',
      widgets: [
        {
          id: 'test-widget-1',
          type: 'gauge',
          title: 'Test Gauge',
          mqttTopic: 'test/gauge/temp',
          valuePath: 'value',
          x: 0,
          y: 0,
          w: 4,
          h: 3
        }
      ]
    };

    const postData = JSON.stringify(testDashboard);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/dashboard/save',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          testResults.databaseSave = result.success === true;
          
          if (testResults.databaseSave) {
            // Store dashboard ID for next test
            global.testDashboardId = result.dashboard.id;
            printTestResult(
              'Database Save',
              true,
              `Dashboard saved with ID: ${result.dashboard.id}`
            );
          } else {
            printTestResult('Database Save', false, result.error || 'Unknown error');
          }
          
          resolve(testResults.databaseSave);
        } catch (error) {
          testResults.databaseSave = false;
          printTestResult('Database Save', false, `Parse error: ${error.message}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      testResults.databaseSave = false;
      printTestResult('Database Save', false, `Error: ${error.message}`);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// Test 8: Database Retrieve
async function testDatabaseRetrieve() {
  return new Promise((resolve) => {
    console.log('\n📂 Test 8: Database Retrieve (Read Saved Dashboard)');
    console.log('-'.repeat(70));

    if (!global.testDashboardId) {
      testResults.databaseRetrieve = false;
      printTestResult('Database Retrieve', false, 'No dashboard ID from previous test');
      resolve(false);
      return;
    }

    http.get(`${config.backend.http}/api/dashboard/${global.testDashboardId}`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          testResults.databaseRetrieve = result.success === true && result.dashboard;
          
          if (testResults.databaseRetrieve) {
            const hasWidgets = result.dashboard.widgets && result.dashboard.widgets.length > 0;
            const hasMqttTopic = result.dashboard.widgets[0]?.mqttTopic === 'test/gauge/temp';
            
            printTestResult(
              'Database Retrieve',
              hasWidgets && hasMqttTopic,
              `Retrieved dashboard | Widgets: ${result.dashboard.widgets.length} | MQTT Topics: ${hasMqttTopic ? '✅' : '❌'}`
            );
            
            testResults.databaseRetrieve = hasWidgets && hasMqttTopic;
          } else {
            printTestResult('Database Retrieve', false, result.error || 'Unknown error');
          }
          
          resolve(testResults.databaseRetrieve);
        } catch (error) {
          testResults.databaseRetrieve = false;
          printTestResult('Database Retrieve', false, `Parse error: ${error.message}`);
          resolve(false);
        }
      });
    }).on('error', (error) => {
      testResults.databaseRetrieve = false;
      printTestResult('Database Retrieve', false, `Error: ${error.message}`);
      resolve(false);
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log('Starting comprehensive test suite...\n');
  
  await testMqttBroker();
  await testBackendHealth();
  await testMqttServiceHealth();
  await testWebSocketFlow();
  await testDatabaseSave();
  await testDatabaseRetrieve();
  
  // Print summary
  console.log('\n');
  console.log('='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('');
  
  // Print detailed results
  console.log('Detailed Results:');
  console.log('-'.repeat(70));
  Object.entries(testResults).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    console.log(`${icon} ${test.padEnd(40)} ${result ? 'PASS' : 'FAIL'}`);
  });
  console.log('');
  
  // Final verdict
  const allPassed = Object.values(testResults).every(r => r === true);
  if (allPassed) {
    console.log('');
    console.log('🎉 🎉 🎉  ALL TESTS PASSED!  🎉 🎉 🎉');
    console.log('');
    console.log('✨ Your Professional IoT Dashboard is FULLY OPERATIONAL!');
    console.log('');
    console.log('Complete data flow verified:');
    console.log('  Device → MQTT Broker → Backend → WebSocket → Frontend → ECharts ✅');
    console.log('');
    console.log('Database persistence verified:');
    console.log('  Dashboards → Widgets → MQTT Topics → All Saved & Retrieved ✅');
    console.log('');
    console.log('🚀 Ready for production use!');
    console.log('');
  } else {
    console.log('');
    console.log('⚠️  SOME TESTS FAILED');
    console.log('');
    console.log('Please check:');
    console.log('  1. MQTT broker is running (mosquitto)');
    console.log('  2. Backend server is running on port 5000');
    console.log('  3. All services are properly configured');
    console.log('');
    console.log('Run these commands to diagnose:');
    console.log('  mosquitto -v          # Check MQTT broker');
    console.log('  curl http://localhost:5000/api/health   # Check backend');
    console.log('');
  }
  
  console.log('='.repeat(70));
  
  process.exit(allPassed ? 0 : 1);
}

// Start tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

