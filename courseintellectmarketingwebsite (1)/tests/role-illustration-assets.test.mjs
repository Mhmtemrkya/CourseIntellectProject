import test from 'node:test'
import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const roles = ['yonetici','veli','ogrenci','muhasebe','personel','rehberlik','sube-muduru','yemekhane','servis-soforu']
test('role illustrations composite transparently and stay within a per-scene image budget', async () => {
  for (const role of roles) {
    const path = fileURLToPath(new URL(`../public/images/brain-role-art/${role}.webp`, import.meta.url))
    const meta = await sharp(path).metadata()
    assert.equal(meta.hasAlpha, true, `${role}: opaque background`)
    assert.ok(meta.width >= 1000 && meta.height >= 700, `${role}: inadequate source resolution`)
    const stats = await sharp(path).stats()
    assert.equal(stats.channels[meta.channels-1].min, 0, `${role}: missing transparency`)
    assert.ok((await stat(path)).size < 2_000_000, `${role}: exceeds scene transfer budget`)
  }
})
