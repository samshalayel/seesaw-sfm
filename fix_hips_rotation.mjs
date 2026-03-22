import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const FILE = 'D:/seesaw-main/seesaw-main/client/public/models/avatarss.glb';

const doc = await io.read(FILE);

// Rx(+90°) quaternion [x,y,z,w]
const RX90 = [0.7071068, 0, 0, 0.7071068];

function quatMul(p, q) {
  // p × q, both [x,y,z,w]
  const [px,py,pz,pw] = p, [qx,qy,qz,qw] = q;
  return [
    pw*qx + px*qw + py*qz - pz*qy,
    pw*qy - px*qz + py*qw + pz*qx,
    pw*qz + px*qy - py*qx + pz*qw,
    pw*qw - px*qx - py*qy - pz*qz,
  ];
}

function applyRx90toVec3(v) {
  // Rx(+90°): [x,y,z] → [x, -z, y]
  return [v[0], -v[2], v[1]];
}

let fixedT = 0, fixedR = 0;

for (const anim of doc.getRoot().listAnimations()) {
  for (const channel of anim.listChannels()) {
    const node = channel.getTargetNode();
    if (!node || node.getName() !== 'Hips') continue;

    const path    = channel.getTargetPath();
    const sampler = channel.getSampler();
    const output  = sampler?.getOutput();
    if (!output) continue;

    const arr = output.getArray().slice();

    if (path === 'translation') {
      for (let i = 0; i < arr.length; i += 3) {
        const fixed = applyRx90toVec3([arr[i], arr[i+1], arr[i+2]]);
        arr[i] = fixed[0]; arr[i+1] = fixed[1]; arr[i+2] = fixed[2];
      }
      output.setArray(arr);
      fixedT += arr.length / 3;

    } else if (path === 'rotation') {
      for (let i = 0; i < arr.length; i += 4) {
        const q     = [arr[i], arr[i+1], arr[i+2], arr[i+3]];
        const fixed = quatMul(RX90, q);
        arr[i] = fixed[0]; arr[i+1] = fixed[1]; arr[i+2] = fixed[2]; arr[i+3] = fixed[3];
      }
      output.setArray(arr);
      fixedR += arr.length / 4;
    }
  }
}

await io.write(FILE, doc);
console.log(`✅ Fixed Hips: ${fixedT} translation keyframes, ${fixedR} rotation keyframes`);
