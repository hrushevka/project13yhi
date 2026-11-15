import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedStep } from '../src/utils/interaction.js';
import { stepSimulation } from '../src/utils/physics.js';
import { PRESETS } from '../src/utils/presets.js';

test('fixed tick size does not depend on accumulated floating point time', () => {
    let t = 0;
    for(let i=0;i<100000;i++) {
        const next = boundedStep(t,.001);
        assert.equal(next.dt,.001);
        assert.equal(next.time,(i+1)*.001);
        t=next.time;
    }
});
test('same tick sequence gives identical motion despite different frame batches', () => {
    const run = batch => {
        const state = structuredClone(PRESETS[0].bodies);
        for(let i=0;i<1000;i+=batch) for(let j=i;j<Math.min(1000,i+batch);j++) stepSimulation(state,1,0,.001,{collisions:false});
        return state;
    };
    assert.deepEqual(run(1),run(17));
});
test('collision and fragment events are repeatable including IDs', () => {
    const run = () => {
        const state=[{id:'a',m:1,r:.1,x:-.2,y:0,vx:1,vy:0},{id:'b',m:1,r:.1,x:.2,y:0,vx:-1,vy:0}];
        const result=stepSimulation(state,0,0,.2,{collisions:true,vFrag:.1});
        return { state, events:result.events };
    };
    assert.deepEqual(run(),run());
});
