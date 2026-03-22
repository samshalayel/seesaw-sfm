import bpy
import sys

def check_animations(glb_path):
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)

    actions = bpy.data.actions
    print(f"\n📁 {glb_path}")
    print(f"   Animations ({len(actions)}):")
    for a in actions:
        print(f"   - '{a.name}' | frames: {int(a.frame_range[0])}-{int(a.frame_range[1])}")
    if not actions:
        print("   ❌ لا يوجد animations!")

import os
models_dir = r"D:\seesaw-main\seesaw-main\client\public\models"
for f in ["1.glb", "2.glb", "avatar.glb"]:
    check_animations(os.path.join(models_dir, f))

print("\nDone!")
