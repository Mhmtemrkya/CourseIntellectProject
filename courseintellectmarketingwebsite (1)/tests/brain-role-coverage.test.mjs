import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}
const roleUrl = moduleUrl(fs.readFileSync(new URL('../lib/site-experience-data.ts', import.meta.url), 'utf8'))
const { roles } = await import(roleUrl)
const source = fs.readFileSync(new URL('../lib/school-brain.ts', import.meta.url), 'utf8').replace('"./site-experience-data"', JSON.stringify(roleUrl))
const { brainRoleOrder, brainRolePresentation, brainRoleProgress, brainStoryTimeline, brainTimeline } = await import(moduleUrl(source))

test('the cinematic story includes every platform role exactly once', () => {
  const expected = roles.map(role => role.id).sort()
  assert.deepEqual([...brainRoleOrder].sort(), expected)
  assert.deepEqual(Object.keys(brainRolePresentation).sort(), expected)
})
test('every role reaches its own completed scene, including the final role', () => {
  let previous = 0
  for (const id of brainRoleOrder) {
    const target = brainRoleProgress(id)
    assert.ok(target > previous && target < 1)
    const story = brainStoryTimeline(target)
    assert.equal(story.roleId, id)
    assert.equal(brainTimeline(story.sceneProgress).focus, 1)
    assert.ok(brainRolePresentation[id].title && brainRolePresentation[id].accent)
    previous = target
  }
  assert.equal(brainStoryTimeline(1).roleId, brainRoleOrder.at(-1))
  assert.equal(brainStoryTimeline(0).roleId, 'yonetici')
})
