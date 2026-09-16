import { test } from 'node:test';
import assert from 'node:assert/strict';
import { returnWire, roundedWire } from '../src/utils/diagramRouting.ts';

function intersects(a, b, box) {
  return a.x === b.x ? a.x > box.x && a.x < box.x + box.width && Math.max(a.y,b.y) > box.y && Math.min(a.y,b.y) < box.y + box.height
    : a.y > box.y && a.y < box.y + box.height && Math.max(a.x,b.x) > box.x && Math.min(a.x,b.x) < box.x + box.width;
}
for (const [name, boxes] of [
  ['same column', [{x:100,y:200,width:208,height:50},{x:100,y:0,width:208,height:50}]],
  ['intervening card', [{x:0,y:200,width:208,height:50},{x:540,y:0,width:208,height:50},{x:270,y:100,width:208,height:50}]],
]) test(`upward wires avoid their endpoints and nearby cards: ${name}`, () => {
  const before = structuredClone(boxes);
  const source = {x: boxes[0].x+104,y:254}, target={x:boxes[1].x+104,y:-4};
  const points = returnWire(source,target,boxes);
  assert.deepEqual(points[0],source); assert.deepEqual(points.at(-1),target);
  for (let i=1;i<points.length;i++) {
    assert.ok(points[i].x===points[i-1].x || points[i].y===points[i-1].y);
    assert.ok(boxes.every(box=>!intersects(points[i-1],points[i],box)));
  }
  const [path,x,y]=roundedWire(points);
  assert.ok(path.includes(' Q ')); assert.ok(!path.includes('NaN'));
  assert.ok(Number.isFinite(x) && Number.isFinite(y));
  assert.deepEqual(boxes,before);
});
