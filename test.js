const { classifyEvent } = require('./src/logic/classifyEvent');

function makePayload(type, deviceId, timestamp, subType) {
  return {
    data: {
      type,
      attributes: { source: deviceId, timestamp, subType }
    }
  };
}

const test1 = classifyEvent(makePayload('button_press', 'cam1', Date.now()));
console.log('Test 1 (doorbell press):', test1);

const now = Date.now();
const test2 = classifyEvent(
  makePayload('motion_detected', 'cam1', now + 30000, 'human'),
  [{ deviceId: 'cam1', timestamp: now }]
);
console.log('Test 2 (short human visit):', test2);

const test3 = classifyEvent(
  makePayload('motion_detected', 'cam1', now + 300000, 'human'),
  [{ deviceId: 'cam1', timestamp: now }]
);
console.log('Test 3 (long human visit):', test3);

const test4 = classifyEvent(
  makePayload('motion_detected', 'cam1', now + 10000, 'animal')
);
console.log('Test 4 (animal motion):', test4);