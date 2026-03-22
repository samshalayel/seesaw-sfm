import bpy
import os

models_dir = r"D:\seesaw-main\seesaw-main\client\public\models"

idle_fbx    = os.path.join(models_dir, "Idle (1).fbx")
walking_fbx = os.path.join(models_dir, "Walking (1).fbx")

def get_armature(objects):
    for obj in objects:
        if obj.type == "ARMATURE":
            return obj
    return None

def merge_and_export(char_fbx, output_glb):
    print(f"\n▶ Processing: {char_fbx}")
    bpy.ops.wm.read_homefile(use_empty=True)

    # ── 1. Import character (إعدادات Blender الافتراضية — تحافظ على بيانات الـ animation صحيحة)
    bpy.ops.import_scene.fbx(filepath=char_fbx)
    char_arm = get_armature(list(bpy.context.scene.objects))
    if not char_arm:
        print("  ❌ No armature found in character FBX!")
        return

    if bpy.data.actions:
        bpy.data.actions[0].name = "Extra"

    # ── 2. Import Idle FBX & steal animation ────────────────────────────────
    bpy.ops.import_scene.fbx(filepath=idle_fbx, ignore_leaf_bones=False, automatic_bone_orientation=False)
    idle_arm = None
    for obj in bpy.context.selected_objects:
        if obj.type == "ARMATURE" and obj != char_arm:
            idle_arm = obj
            break

    idle_action = None
    if idle_arm and idle_arm.animation_data and idle_arm.animation_data.action:
        idle_action = idle_arm.animation_data.action
        idle_action.name = "Idle"
        if not char_arm.animation_data:
            char_arm.animation_data_create()
        char_arm.animation_data.action = idle_action

    if idle_arm:
        for obj in list(bpy.data.objects):
            if obj != char_arm and obj.type in ("ARMATURE", "MESH"):
                if obj.parent != char_arm:
                    bpy.data.objects.remove(obj, do_unlink=True)

    print(f"  ✅ Idle action: {idle_action.name if idle_action else 'NOT FOUND'}")

    # ── 3. Import Walking FBX & steal animation ──────────────────────────────
    bpy.ops.import_scene.fbx(filepath=walking_fbx, ignore_leaf_bones=False, automatic_bone_orientation=False)
    walk_arm = None
    for obj in bpy.context.selected_objects:
        if obj.type == "ARMATURE" and obj != char_arm:
            walk_arm = obj
            break

    walk_action = None
    if walk_arm and walk_arm.animation_data and walk_arm.animation_data.action:
        walk_action = walk_arm.animation_data.action
        walk_action.name = "Walk"

    if walk_arm:
        for obj in list(bpy.data.objects):
            if obj.type == "ARMATURE" and obj != char_arm:
                bpy.data.objects.remove(obj, do_unlink=True)

    print(f"  ✅ Walk action: {walk_action.name if walk_action else 'NOT FOUND'}")

    # ── 4. Set char armature to Idle for export ──────────────────────────────
    if idle_action and char_arm.animation_data:
        char_arm.animation_data.action = idle_action

    # ── 5. Export as GLB ─────────────────────────────────────────────────────
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format="JPEG",
        export_jpeg_quality=75,
        export_animations=True,
        export_nla_strips=False,
        export_skins=True,
    )
    print(f"  ✅ Exported → {output_glb}")

merge_and_export(
    os.path.join(models_dir, "1.fbx"),
    os.path.join(models_dir, "1.glb"),
)
merge_and_export(
    os.path.join(models_dir, "2.fbx"),
    os.path.join(models_dir, "2.glb"),
)

print("\n✅ All done!")
