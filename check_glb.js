const fs = require('fs');

function parseGLB(filename) {
  const buf = fs.readFileSync('client/public/models/' + filename);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546C67) { console.log(filename + ': not a valid GLB'); return; }
  
  const jsonChunkLen = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + jsonChunkLen).toString('utf8');
  const json = JSON.parse(jsonStr);
  
  console.log('=== ' + filename + ' ===');
  console.log('Meshes   :', (json.meshes||[]).map(m => m.name).join(', ') || 'none');
  console.log('Animations:', (json.animations||[]).map(a => a.name).join(', ') || 'NONE');
  console.log('Nodes    :', (json.nodes||[]).length + ' nodes');
  console.log('Skins    :', (json.skins||[]).length + ' skins (rigged: ' + ((json.skins||[]).length > 0) + ')');
  console.log('');
}

parseGLB('base_basic_shaded.glb');
parseGLB('base_basic_pbr.glb');
parseGLB('avatar.glb');
