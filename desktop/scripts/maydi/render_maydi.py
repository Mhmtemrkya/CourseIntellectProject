"""Render the supplied Maydi scene without changing the source .blend.

Blender --background <maydi_states.blend> --python render_maydi.py -- <frames-dir>
Use --preview after the directory to render only the idle frame.
Use --spin-preview to render three frames of the blue light trail for review.
Use --expressions-only to render the five expression loops without the turntable.
Use --expressions-preview to render just their poster frames.
"""
import math
import os
import sys

import bpy
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
os.makedirs(out, exist_ok=True)
scene = bpy.context.scene

# The supplied scene selects expressions with timeline drivers. Detach them in memory.
for ob in bpy.data.objects:
    if ob.animation_data:
        ob.animation_data_clear()


def state(name):
    pose = list(scene["POSE_" + name])
    for i, obj_name in enumerate(("Maydi_Pose", "Maydi_Head", "Arm_L")):
        ob = bpy.data.objects[obj_name]
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = Quaternion(pose[i * 4:i * 4 + 4])
    for ob in bpy.data.objects:
        if ob.name.startswith("STATE_"):
            ob.scale = (1, 1, 1) if ob.name.startswith("STATE_" + name + "_") else (0, 0, 0)
    bpy.context.view_layer.update()


state("NORMAL")
for ob in scene.objects:
    if ob.name.startswith("HoloRing_") or ob.name == "FloorGlow":
        ob.hide_render = True

scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    if "--metal" not in args:
        raise RuntimeError("CPU selected; pass --metal to opt into Metal")
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == "METAL"
    scene.cycles.device = "GPU" if any(d.use for d in prefs.devices) else "CPU"
except (TypeError, RuntimeError):
    scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.render.resolution_x = 256
scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.use_compositing = False
scene.render.use_persistent_data = True

camera = bpy.data.objects["CAM_State"]
camera.data.type = "ORTHO"
camera.data.ortho_scale = 1.28
target = Vector((-0.03, -0.01, 0.43))
camera.location = target + Vector((0.28, -3.0, 0.24))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

root = bpy.data.objects["Maydi"]
# Preserve all world transforms while moving the turntable pivot to the mascot's centre.
children = [(ob, ob.matrix_world.copy()) for ob in root.children]
root.location = target
bpy.context.view_layer.update()
for ob, matrix in children:
    ob.matrix_world = matrix
bpy.context.view_layer.update()


def render(name):
    print("MAYDI_RENDER", name, flush=True)
    scene.render.filepath = os.path.join(out, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("MAYDI_FRAME", name, flush=True)


EXPRESSIONS = (("speaking", "KONUSUYOR"), ("happy", "MUTLU"),
               ("thinking", "DUSUNUYOR"), ("guiding", "YONLENDIRIYOR"), ("love", "SEVGI"))


def render_expressions():
    camera_matrix = camera.matrix_world.copy()
    framing = camera.data.ortho_scale
    props = [ob for ob in bpy.data.objects if ob.name.startswith(("Wave_", "Ray_", "QMark", "Bubble_", "Heart_")) or ob.name == "Hand"]
    transforms = {ob.name: ob.matrix_basis.copy() for ob in props}
    mouth = bpy.data.objects["KONUSUYOR_Mouth"]
    mouth_points = [v.co.copy() for v in mouth.data.vertices]
    mouth_mid = (min(v.z for v in mouth_points) + max(v.z for v in mouth_points)) / 2
    visor = bpy.data.objects["Visor"].evaluated_get(bpy.context.evaluated_depsgraph_get())
    surface_mesh = visor.to_mesh()
    surface = BVHTree.FromPolygons([v.co for v in surface_mesh.vertices], [p.vertices for p in surface_mesh.polygons])
    visor.to_mesh_clear()
    emissions = []
    for ob in props:
        if ob.name.startswith(("Wave_", "Ray_")):
            # Each prop pulses separately without modifying a shared source material.
            material = ob.data.materials[0].copy()
            ob.data.materials[0] = material
            shader = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            strength = shader.inputs["Emission Strength"]
            emissions.append((ob, strength, strength.default_value))

    for name, expression in EXPRESSIONS:
        for ob in props:
            ob.matrix_basis = transforms[ob.name]
        state(expression)
        camera.matrix_world = camera_matrix
        camera.data.ortho_scale = framing
        # Leave room for the list bubble and pointing glove, as in the reference tile.
        if name == "guiding":
            camera.data.ortho_scale = 1.60
            camera.location.x += 0.11
        elif name == "speaking":
            camera.data.ortho_scale = 1.36
            camera.location.x += 0.025
        elif name in ("happy", "love"):
            camera.data.ortho_scale = 1.36
        bpy.context.view_layer.update()
        render(name)
        if "--expressions-preview" in args:
            continue
        head = bpy.data.objects["Maydi_Head"]
        head_pose = head.rotation_quaternion.copy()
        for i in range(12):
            phase = math.tau * i / 12
            for ob in props:
                ob.matrix_basis = transforms[ob.name]
                if name == "love" and ob.name.startswith("Heart_"):
                    ob.location.z += 0.016 * math.sin(phase + int(ob.name.split("_")[1]) * 0.7)
                elif name == "speaking" and ob.name.startswith("Wave_"):
                    ob.location.x += 0.012 * math.sin(phase - int(ob.name.split("_")[1]) * 0.8)
                elif name == "thinking" and ob.name.startswith("QMark"):
                    ob.location.z += 0.012 * math.sin(phase)
                elif name == "guiding" and ob.name.startswith("Bubble_"):
                    ob.location.z += 0.008 * math.sin(phase)
                elif name == "guiding" and ob.name == "Hand":
                    ob.rotation_euler.y += 0.05 * math.sin(phase)
            head.rotation_quaternion = head_pose @ Quaternion((0, 1, 0), 0.018 * math.sin(phase))
            for j, (ob, strength, original_strength) in enumerate(emissions):
                strength.default_value = original_strength * (0.9 + 0.25 * math.sin(phase - j * 0.55))
            if name == "speaking":
                squeeze = 0.75 + 0.25 * math.cos(phase * 2)
                for vertex, original in zip(mouth.data.vertices, mouth_points):
                    point = original.copy()
                    point.z = mouth_mid + (point.z - mouth_mid) * squeeze
                    hit, normal, _, _ = surface.ray_cast(Vector((point.x, -2, point.z)), Vector((0, 1, 0)))
                    vertex.co = hit + normal * 0.001 if hit is not None else point
                mouth.data.update()
            render("%s_%02d" % (name, i))
        for vertex, original in zip(mouth.data.vertices, mouth_points):
            vertex.co = original
        mouth.data.update()
        for _, strength, original_strength in emissions:
            strength.default_value = original_strength
    camera.matrix_world = camera_matrix
    camera.data.ortho_scale = framing
    for ob in props:
        ob.matrix_basis = transforms[ob.name]
    state("NORMAL")


render("idle")
if "--preview" in args:
    raise SystemExit(0)
if "--expressions-only" in args or "--expressions-preview" in args:
    render_expressions()
    raise SystemExit(0)


def trail_material(name, opacity, strength):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (0.015, 0.55, 1.0, 1)
    emission.inputs["Strength"].default_value = strength
    mix = nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = opacity
    output = nodes.new("ShaderNodeOutputMaterial")
    links = material.node_tree.links
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material, mix.inputs[0]


# A single tapered orbit with transparent glow shells. Real geometry lets the
# back of the trail disappear behind Maydi without covering the face or emblem.
trail_layers = []
for name, thickness, opacity, strength in (
    ("Core", 0.0045, 0.95, 3.0),
    ("SoftGlow", 0.010, 0.10, 1.5),
    ("OuterGlow", 0.018, 0.035, 1.0),
):
    curve = bpy.data.curves.new("Maydi_SpinTrail_" + name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = thickness
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(95)
    material, alpha = trail_material("Maydi_SpinTrail_" + name, opacity, strength)
    curve.materials.append(material)
    ob = bpy.data.objects.new("Maydi_SpinTrail_" + name, curve)
    scene.collection.objects.link(ob)
    ob.visible_shadow = False
    trail_layers.append((ob, spline, alpha, opacity))

light_data = bpy.data.lights.new("Maydi_TrailReflection", "POINT")
light_data.color = (0.03, 0.55, 1.0)
light_data.shadow_soft_size = 0.12
trail_light = bpy.data.objects.new("Maydi_TrailReflection", light_data)
scene.collection.objects.link(trail_light)


def smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


scene.cycles.samples = 48
for i in ([8, 18, 32] if "--spin-preview" in args else range(48)):
    # Ease the angular motion into and out of the turn.
    t = i / 47
    eased = t * t * (3 - 2 * t)
    root.rotation_euler.z = -math.tau * eased
    fade = smooth(t / 0.15) * smooth((1 - t) / 0.25)
    heading = -math.tau * eased - math.pi * 0.35
    for ob, spline, alpha, opacity in trail_layers:
        alpha.default_value = opacity * fade
        ob.hide_render = fade == 0
        for j, point in enumerate(spline.points):
            s = j / (len(spline.points) - 1)
            angle = heading + (1 - s) * math.radians(245)
            point.co = (-0.03 + 0.36 * math.cos(angle),
                        -0.01 + 0.36 * math.sin(angle),
                        0.075 + 0.025 * math.sin(angle), 1)
            point.radius = min(1, s * 5) ** 1.4 * min(1, (1 - s) * 14) ** 0.6
    trail_light.location = (-0.03 + 0.28 * math.cos(heading),
                            -0.01 + 0.28 * math.sin(heading), 0.08)
    light_data.energy = 1.0 * fade
    render("spin_%02d" % i)
root.rotation_euler.z = 0
scene.cycles.samples = 24
for ob, _, _, _ in trail_layers:
    ob.hide_render = True
trail_light.hide_render = True
if "--spin-preview" in args:
    raise SystemExit(0)

# Flatten the eye on the visor surface; project the deformed vertices back onto it.
visor = bpy.data.objects["Visor"]
depsgraph = bpy.context.evaluated_depsgraph_get()
evaluated = visor.evaluated_get(depsgraph)
mesh = evaluated.to_mesh()
surface = BVHTree.FromPolygons([v.co for v in mesh.vertices], [p.vertices for p in mesh.polygons])
evaluated.to_mesh_clear()
eye = bpy.data.objects["NORMAL_Eye_L"]
original = [v.co.copy() for v in eye.data.vertices]
z_mid = (min(v.z for v in original) + max(v.z for v in original)) / 2
catchlight = bpy.data.objects["NORMAL_Catchlight_L"]
for i, squeeze in enumerate((0.0, 0.18, 0.48, 0.78, 0.93, 0.96)):
    catchlight.hide_render = squeeze > 0.4
    for vertex, co in zip(eye.data.vertices, original):
        point = co.copy()
        point.z = z_mid + (co.z - z_mid) * (1 - squeeze)
        hit, normal, _, _ = surface.ray_cast(Vector((point.x, -2, point.z)), Vector((0, 1, 0)))
        vertex.co = hit + normal * 0.001 if hit is not None else point
    eye.data.update()
    render("wink_%02d" % i)
for vertex, co in zip(eye.data.vertices, original):
    vertex.co = co
eye.data.update()
catchlight.hide_render = False

render_expressions()
