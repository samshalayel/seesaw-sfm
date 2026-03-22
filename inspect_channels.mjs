import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const FILE = 'D:/seesaw-main/seesaw-main/client/public/models/avatarss.glb';

const doc = await io.read(FILE);

for (const anim of doc.getRoot().listAnimations()) {
  console.log(`\nAnimation: "${anim.getName()}"`);
  for (const channel of anim.listChannels()) {
    const node = channel.getTargetNode();
    const name = node?.getName() ?? '(null)';
    const path = channel.getTargetPath();
    const output = channel.getSampler()?.getOutput();
    const arr = output?.getArray();
    // Show first value to diagnose scale
    const first = arr ? [...arr].slice(0, path === 'rotation' ? 4 : 3) : [];
    console.log(`  ${name} / ${path}  → first: [${first.map(v=>v.toFixed(4)).join(', ')}]`);
  }
}
