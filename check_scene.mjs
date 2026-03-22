import { readFileSync } from "fs";
const file = process.argv[2];
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));

// Show scene root nodes
console.log("=== Scenes ===");
(gltf.scenes||[]).forEach((s,i)=>{
  console.log(`Scene[${i}] "${s.name}": rootNodes=[${s.nodes}]`);
});

// Show root node details + their direct children
const rootNodes = (gltf.scenes||[])[0]?.nodes || [];
console.log("\n=== Root nodes (full detail) ===");
rootNodes.forEach(ni => {
  const n = gltf.nodes[ni];
  console.log(`Node[${ni}] "${n.name}":`);
  if(n.rotation) console.log(`  rotation=[${n.rotation.map(v=>v.toFixed(4)).join(", ")}]`);
  if(n.scale)    console.log(`  scale=[${n.scale.map(v=>v.toFixed(4)).join(", ")}]`);
  if(n.translation) console.log(`  translation=[${n.translation.map(v=>v.toFixed(4)).join(", ")}]`);
  if(n.children) {
    console.log(`  children (${n.children.length}):`);
    n.children.slice(0,5).forEach(ci => {
      const c = gltf.nodes[ci];
      console.log(`    Node[${ci}] "${c.name}"` + (c.scale ? ` scale=[${c.scale.map(v=>v.toFixed(4)).join(",")}]` : '') + (c.rotation ? ` rot=[${c.rotation.map(v=>v.toFixed(3)).join(",")}]` : ''));
    });
  }
});
