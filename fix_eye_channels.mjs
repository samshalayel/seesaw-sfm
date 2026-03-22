import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const FILE = 'D:/seesaw-main/seesaw-main/client/public/models/avatarss.glb';

const doc = await io.read(FILE);

let removed = 0;

for (const anim of doc.getRoot().listAnimations()) {
  const toRemove = [];
  for (const channel of anim.listChannels()) {
    const node = channel.getTargetNode();
    const name = node?.getName() ?? '';
    // Remove all channels for eye bones
    if (name.toLowerCase().includes('eye')) {
      toRemove.push(channel);
    }
  }
  for (const ch of toRemove) {
    // Also remove the sampler
    const sampler = ch.getSampler();
    anim.removeChannel(ch);
    if (sampler) anim.removeSampler(sampler);
    removed++;
  }
}

await io.write(FILE, doc);
console.log(`✅ Removed ${removed} eye channels from avatarss.glb`);
