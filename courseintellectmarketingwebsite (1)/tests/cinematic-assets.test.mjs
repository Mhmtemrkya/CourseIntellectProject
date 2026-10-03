import test from "node:test"
import assert from "node:assert/strict"
import { stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const names = ["hall", "core-platform", "lessons", "students", "teachers", "parents", "finance", "management", "workspace", "workspace-mobile"]
test("independent cinematic assets retain real transparency and fit the transfer budget", async () => {
  let total = 0, initial = 0
  for (const name of names) {
    const file = new URL(`../public/images/brain-cinematic-v3/${name}.webp`, import.meta.url)
    const metadata = await sharp(fileURLToPath(file)).metadata()
    assert.equal(metadata.format, "webp")
    assert.ok(metadata.width >= 960 && metadata.width <= 2048)
    assert.ok(metadata.height >= 600 && metadata.height <= 2048)
    if (name !== "hall") {
      assert.equal(metadata.hasAlpha, true, `${name} must composite without an opaque backdrop`)
      const statistics = await sharp(fileURLToPath(file)).stats()
      assert.equal(statistics.channels[metadata.channels - 1].min, 0)
    }
    if (name === "workspace-mobile") assert.ok(metadata.height > metadata.width)
    const size = (await stat(file)).size
    assert.ok(size < 2_000_000, `${name} exceeded its individual image budget`)
    total += size
    if (["hall", "core-platform"].includes(name)) initial += size
  }
  assert.ok(initial < 3_000_000, "initial environment and core transfer exceeded its budget")
  assert.ok(total < 12_000_000, "complete illustration set exceeded its transfer budget")
})
