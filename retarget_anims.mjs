import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const MODELS = 'D:/seesaw-main/seesaw-main/client/public/models/';

console.log('Loading avatar.glb (source animations)...');
const srcDoc = await io.read(MODELS + 'avatar.glb');

console.log('Loading avatarss.glb (target)...');
const dstDoc = await io.read(MODELS + 'avatarss.glb');

// Build bone name map: "mixamorig:Head" → node in dstDoc named "Head"
const dstNodeMap = {};
dstDoc.getRoot().listNodes().forEach(n => { dstNodeMap[n.getName()] = n; });

const srcAnims = srcDoc.getRoot().listAnimations();
console.log('Source animations:', srcAnims.map(a => a.getName()));

let added = 0;
for (const srcAnim of srcAnims) {
  const animName = srcAnim.getName();
  console.log(`\nRetargeting "${animName}"...`);

  const newAnim = dstDoc.createAnimation(animName);
  let channelCount = 0;

  for (const channel of srcAnim.listChannels()) {
    const srcNode = channel.getTargetNode();
    if (!srcNode) continue;

    // Strip "mixamorig:" prefix to find matching bone in dst
    const rawName = srcNode.getName().replace(/^mixamorig:/, '');
    const dstNode = dstNodeMap[rawName];
    if (!dstNode) continue;

    const srcSampler = channel.getSampler();
    if (!srcSampler) continue;

    const inputAcc  = srcSampler.getInput();
    const outputAcc = srcSampler.getOutput();
    if (!inputAcc || !outputAcc) continue;

    const newInput = dstDoc.createAccessor()
      .setArray(inputAcc.getArray().slice())
      .setType(inputAcc.getType());

    const newOutput = dstDoc.createAccessor()
      .setArray(outputAcc.getArray().slice())
      .setType(outputAcc.getType());

    const newSampler = dstDoc.createAnimationSampler()
      .setInput(newInput)
      .setOutput(newOutput)
      .setInterpolation(srcSampler.getInterpolation());

    const newChannel = dstDoc.createAnimationChannel()
      .setTargetNode(dstNode)
      .setTargetPath(channel.getTargetPath())
      .setSampler(newSampler);

    newAnim.addSampler(newSampler);
    newAnim.addChannel(newChannel);
    channelCount++;
  }

  console.log(`  ✅ Channels retargeted: ${channelCount}`);
  added++;
}

const OUTPUT = MODELS + 'avatarss.glb';
await io.write(OUTPUT, dstDoc);
console.log('\n✅ Saved:', OUTPUT);

// Verify
const check = await io.read(OUTPUT);
console.log('Final animations:', check.getRoot().listAnimations().map(a => a.getName()));
