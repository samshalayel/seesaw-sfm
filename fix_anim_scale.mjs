import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const FILE = 'D:/seesaw-main/seesaw-main/client/public/models/avatarss.glb';

const doc = await io.read(FILE);

let fixed = 0;
for (const anim of doc.getRoot().listAnimations()) {
  for (const channel of anim.listChannels()) {
    if (channel.getTargetPath() !== 'translation') continue;
    const sampler = channel.getSampler();
    const output  = sampler?.getOutput();
    if (!output) continue;

    const arr = output.getArray().slice(); // Float32Array copy
    for (let i = 0; i < arr.length; i++) arr[i] *= 0.01;
    output.setArray(arr);
    fixed++;
  }
}

await io.write(FILE, doc);
console.log(`✅ Scaled ${fixed} translation channels × 0.01`);
