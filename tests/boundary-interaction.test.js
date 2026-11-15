import test from 'node:test';
import assert from 'node:assert/strict';
import { findEarliestContact, stepSimulation } from '../src/utils/physics.js';
import { boundedStep, pinchCamera } from '../src/utils/interaction.js';

const pair = (time = 10) => [
    { m: 1, r: .1, x: 0, y: 0, vx: 0, vy: 0 },
    { m: 1, r: .1, x: time + .2, y: 0, vx: -1, vy: 0 },
];
test('contact at 9.999999999999999 is included at the deadline', () => {
    assert.ok(findEarliestContact(pair(9.999999999999999), 10));
    assert.ok(findEarliestContact(pair(), 9.999999999999999));
    assert.equal(findEarliestContact(pair(10.000001), 10), null);
});
test('accumulated steps count the final collision without advancing past the deadline', () => {
    const bodies = pair();
    let time = 0, events = [];
    while (time < 10) {
        const next = boundedStep(time, .003, 10);
        events.push(...stepSimulation(bodies, 0, 0, next.dt, { collisions: true }).events);
        time = next.time;
    }
    assert.equal(time, 10);
    assert.equal(events.length, 1);
    assert.equal(bodies.length, 1);
});
test('disabled collisions still let bodies pass through each other', () => {
    const bodies = pair(.1);
    const result = stepSimulation(bodies, 0, 0, .2, { collisions: false });
    assert.equal(result.events.length, 0);
    assert.equal(bodies.length, 2);
});
test('pinch doubles scale and keeps the midpoint world coordinate anchored', () => {
    const camera = { x: 20, y: -30, zoom: 100 };
    const start = [{ x: 100, y: 200 }, { x: 200, y: 200 }];
    const end = [{ x: 70, y: 230 }, { x: 270, y: 230 }];
    const result = pinchCamera(camera, start, end, 390, 844, 10, 1000);
    assert.equal(result.zoom, 200);
    assert.equal((150 - 195 - camera.x) / camera.zoom, (170 - 195 - result.x) / result.zoom);
    assert.ok(Math.abs((200 - 844 * .35 - camera.y) / camera.zoom - (230 - 844 * .35 - result.y) / result.zoom) < 1e-12);
    assert.equal(pinchCamera(camera, start, end, 390, 844, 10, 150).zoom, 150);
});
