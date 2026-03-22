import bpy, math

MODELS = r"D:\seesaw-main\seesaw-main\client\public\models\\"

# ── 1. استيراد avatarss.glb ──────────────────────────────────────────────────
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=MODELS + "avatarss.glb")

# ابحث عن Armature الـ avatarss
dst_arm = None
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        dst_arm = obj
        break
print("DST armature:", dst_arm.name if dst_arm else "NOT FOUND")

# احفظ أسماء العظام في avatarss
dst_bones = {b.name for b in dst_arm.data.bones} if dst_arm else set()

# ── 2. استيراد avatar.glb (مصدر الـ animations) ──────────────────────────────
bpy.ops.import_scene.gltf(filepath=MODELS + "avatar.glb")

# ابحث عن Armature الـ avatar (الثاني)
src_arm = None
for obj in bpy.data.objects:
    if obj.type == "ARMATURE" and obj != dst_arm:
        src_arm = obj
        break
print("SRC armature:", src_arm.name if src_arm else "NOT FOUND")

# ── 3. انقل كل action ────────────────────────────────────────────────────────
def copy_action(src_action, dst_armature, bone_map):
    new_action = bpy.data.actions.new(name=src_action.name)
    print(f"  Copying action: {src_action.name}")
    copied = 0
    for fcurve in src_action.fcurves:
        # الـ data_path مثل: pose.bones["mixamorig:Hips"].rotation_quaternion
        dp = fcurve.data_path
        if 'pose.bones["' not in dp:
            continue
        # استخرج اسم العظمة
        start = dp.index('"') + 1
        end   = dp.index('"', start)
        src_bone = dp[start:end]
        # ابحث عن المقابل في avatarss
        dst_bone = bone_map.get(src_bone)
        if not dst_bone:
            continue
        new_dp = dp.replace(f'"{src_bone}"', f'"{dst_bone}"')
        new_fc = new_action.fcurves.new(data_path=new_dp, index=fcurve.array_index)
        new_fc.keyframe_points.add(len(fcurve.keyframe_points))
        for i, kp in enumerate(fcurve.keyframe_points):
            new_fc.keyframe_points[i].co             = kp.co
            new_fc.keyframe_points[i].interpolation  = kp.interpolation
        copied += 1
    print(f"    Copied {copied} fcurves")
    return new_action

# بناء bone_map: "mixamorig:Hips" → "Hips"
bone_map = {}
for bone in src_arm.data.bones:
    stripped = bone.name.replace("mixamorig:", "")
    if stripped in dst_bones:
        bone_map[bone.name] = stripped

print(f"Bone map size: {len(bone_map)}")

# انسخ كل actions مرتبطة بـ src_arm
src_arm.select_set(True)
bpy.context.view_layer.objects.active = src_arm

new_actions = []
for action in bpy.data.actions:
    # فقط actions الـ avatar (تحتوي على mixamorig:)
    if any('mixamorig:' in fc.data_path for fc in action.fcurves):
        new_act = copy_action(action, dst_arm, bone_map)
        new_actions.append(new_act)

# ── 4. حدّد الـ avatarss armature وأضف الـ NLA strips ──────────────────────
dst_arm.select_set(True)
bpy.context.view_layer.objects.active = dst_arm

if not dst_arm.animation_data:
    dst_arm.animation_data_create()

# امسح NLA strips الموجودة
for track in list(dst_arm.animation_data.nla_tracks):
    dst_arm.animation_data.nla_tracks.remove(track)

for act in new_actions:
    track = dst_arm.animation_data.nla_tracks.new()
    track.name = act.name
    strip = track.strips.new(act.name, 1, act)
    print(f"  Added NLA strip: {act.name}")

# ── 5. احذف src_arm وكل mesh الـ avatar الكلاسيكي ──────────────────────────
for obj in list(bpy.data.objects):
    if obj != dst_arm and (obj.type in ("ARMATURE", "MESH")):
        # نحتفظ فقط بـ objects اللي مرتبطة بـ dst_arm
        if obj.parent != dst_arm and obj != dst_arm:
            # تحقق إذا هو mesh من avatarss
            is_avatarss_mesh = False
            for mod in obj.modifiers:
                if mod.type == 'ARMATURE' and mod.object == dst_arm:
                    is_avatarss_mesh = True
            if not is_avatarss_mesh and obj.type != "ARMATURE":
                bpy.data.objects.remove(obj, do_unlink=True)

# احذف src armature
if src_arm and src_arm.name in bpy.data.objects:
    bpy.data.objects.remove(src_arm, do_unlink=True)

# ── 6. Export ─────────────────────────────────────────────────────────────────
bpy.ops.export_scene.gltf(
    filepath=MODELS + "avatarss.glb",
    export_format="GLB",
    export_animations=True,
    export_nla_strips=True,
    export_skins=True,
    export_image_format="JPEG",
    export_jpeg_quality=75,
)
print("✅ Exported avatarss.glb with retargeted animations")
