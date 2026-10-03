import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// Prevent a future asset replacement from shipping the original 59 MiB mesh,
// an unexpected external download, or a decoder requiring a weaker CSP.
for (const [name, bytes, triangles] of [
  ['schoolasist-logo.glb', 3_000_000, 100_000],
  ['schoolasist-logo-mobile.glb', 1_250_000, 40_000],
]) {
  test(`${name} fits the device budget and is self-contained`, () => {
    const file = fs.readFileSync(new URL(`../public/models/${name}`, import.meta.url))
    assert.equal(file.readUInt32LE(0), 0x46546c67)
    assert.equal(file.readUInt32LE(4), 2)
    assert.equal(file.readUInt32LE(8), file.length)
    assert.ok(file.length <= bytes, `Asset is ${file.length} bytes; budget is ${bytes}`)
    assert.equal(file.readUInt32LE(16), 0x4e4f534a)
    const model = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString())
    assert.ok(model.buffers.every(buffer => !buffer.uri))
    assert.ok(model.images.every(image => image.bufferView !== undefined && !image.uri))
    const supported = new Set(['EXT_texture_webp', 'KHR_mesh_quantization', 'KHR_materials_volume'])
    assert.ok((model.extensionsRequired ?? []).every(extension => supported.has(extension)))
    let total = 0
    for (const mesh of model.meshes) for (const primitive of mesh.primitives) {
      assert.equal(primitive.mode ?? 4, 4)
      total += model.accessors[primitive.indices].count / 3
    }
    assert.ok(total > 0 && total <= triangles, `Mesh has ${total} triangles; budget is ${triangles}`)
  })
}
