import bpy
import sys
import os

def convert_fbx_to_glb(fbx_path, glb_path):
    # Clear scene
    bpy.ops.wm.read_homefile(use_empty=True)

    # Import FBX
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    # Export as GLB with compression
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format='JPEG',
        export_jpeg_quality=75,
        export_texcoords=True,
        export_normals=True,
        export_animations=True,
        export_skins=True,
        export_morph=True,
    )
    print(f"✅ Converted: {fbx_path} → {glb_path}")

models_dir = r"D:\seesaw-main\seesaw-main\client\public\models"

files = [
    (os.path.join(models_dir, "1.fbx"), os.path.join(models_dir, "1.glb")),
    (os.path.join(models_dir, "2.fbx"), os.path.join(models_dir, "2.glb")),
]

for fbx, glb in files:
    if os.path.exists(fbx):
        print(f"Converting {fbx}...")
        convert_fbx_to_glb(fbx, glb)
    else:
        print(f"❌ File not found: {fbx}")

print("Done!")
