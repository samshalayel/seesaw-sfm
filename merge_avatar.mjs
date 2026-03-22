import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync, writeFileSync } from 'fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const MODELS_DIR = 'D:/seesaw-main/seesaw-main/client/public/models/';

console.log('Loading walk GLB...');
const walkDoc = await io.read(MODELS_DIR + 'avatar_suit_walk.glb');

console.log('Loading idle GLB...');
const idleDoc = await io.read(MODELS_DIR + 'avatar_idle_temp.glb');

// Get animations from each doc
const walkAnims = walkDoc.getRoot().listAnimations();
const idleAnims = idleDoc.getRoot().listAnimations();

console.log('Walk animations:', walkAnims.map(a => a.getName()));
console.log('Idle animations:', idleAnims.map(a => a.getName()));

// Rename animation in walk doc → "Walk"
if (walkAnims[0]) {
  walkAnims[0].setName('Walk');
  console.log('Renamed walk anim → Walk');
}

// We need to copy the idle animation into the walk document
// Strategy: merge by extracting idle anim channels and samplers

const idleAnim = idleAnims[0];
if (idleAnim) {
  // Clone the idle animation into the walk document
  // Get the idle doc's nodes by name
  const idleNodes = {};
  idleDoc.getRoot().listNodes().forEach(n => {
    idleNodes[n.getName()] = n;
  });
  
  const walkNodes = {};
  walkDoc.getRoot().listNodes().forEach(n => {
    walkNodes[n.getName()] = n;
  });

  console.log('Walk doc nodes count:', Object.keys(walkNodes).length);
  console.log('Idle doc nodes count:', Object.keys(idleNodes).length);

  // Create new animation in walk doc
  const newIdleAnim = walkDoc.createAnimation('Idle');
  
  let channelCount = 0;
  for (const channel of idleAnim.listChannels()) {
    const targetNode = channel.getTargetNode();
    if (!targetNode) continue;
    
    const nodeName = targetNode.getName();
    const walkNode = walkNodes[nodeName];
    if (!walkNode) continue;

    const sampler = channel.getSampler();
    if (!sampler) continue;

    const inputAccessor = sampler.getInput();
    const outputAccessor = sampler.getOutput();
    if (!inputAccessor || !outputAccessor) continue;

    // Clone accessors into walk doc
    const newInput = walkDoc.createAccessor()
      .setArray(inputAccessor.getArray().slice())
      .setType(inputAccessor.getType());
    
    const newOutput = walkDoc.createAccessor()
      .setArray(outputAccessor.getArray().slice())
      .setType(outputAccessor.getType());

    const newSampler = walkDoc.createAnimationSampler()
      .setInput(newInput)
      .setOutput(newOutput)
      .setInterpolation(sampler.getInterpolation());

    const newChannel = walkDoc.createAnimationChannel()
      .setTargetNode(walkNode)
      .setTargetPath(channel.getTargetPath())
      .setSampler(newSampler);

    newIdleAnim.addSampler(newSampler);
    newIdleAnim.addChannel(newChannel);
    channelCount++;
  }
  
  console.log('Idle animation channels copied:', channelCount);
}

// Save merged GLB
const OUTPUT = MODELS_DIR + 'avatar_suit.glb';
await io.write(OUTPUT, walkDoc);
console.log('✅ Saved merged GLB to:', OUTPUT);

// Verify
const verifyDoc = await io.read(OUTPUT);
const anims = verifyDoc.getRoot().listAnimations();
console.log('Final animations:', anims.map(a => a.getName()));
console.log('Final nodes:', verifyDoc.getRoot().listNodes().length);
