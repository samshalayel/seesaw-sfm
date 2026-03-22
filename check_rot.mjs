import { readFileSync } from "fs";

const file = process.argv[2];
const buf = readFileSync(file);

// Parse GLB header
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546C67) { console.log("Not a valid GLB"); process.exit(1); }

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== Nodes with rotation ===");
(gltf.nodes || []).forEach((n, i) => {
  if (n.rotation) {
    console.log(`Node[${i}] "${n.name}": rotation=[${n.rotation.map(v => v.toFixed(4)).join(", ")}]`);
  }
});

console.log("\n=== Nodes with scale ===");
(gltf.nodes || []).forEach((n, i) => {
  if (n.scale) {
    console.log(`Node[${i}] "${n.name}": scale=[${n.scale.map(v => v.toFixed(4)).join(", ")}]`);
  }
});

console.log("\n=== Animations ===");
(gltf.animations || []).forEach(a => console.log(" -", a.name));

console.log("\n=== Total nodes:", (gltf.nodes || []).length);
