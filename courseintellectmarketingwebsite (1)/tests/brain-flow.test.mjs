import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three'

const require = createRequire(import.meta.url)
const source = fs.readFileSync(new URL('../lib/brain-flow.ts', import.meta.url), 'utf8').replace('"three"', JSON.stringify(pathToFileURL(require.resolve('three')).href))
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { createFlowGeometry, updateFlowGeometry } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('flow animation stays within its mesh budget and reuses buffers during camera travel', () => {
  const geometry = createFlowGeometry(), positions = geometry.attributes.position.array, indices = geometry.index.array
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(1.6,.018,-.35),new THREE.Vector3(2.6,.018,-.875),new THREE.Vector3(2.55,.336,-3.65),new THREE.Vector3(3.11,.336,-3.5)])
  assert.ok(geometry.attributes.position.count <= 130)
  assert.ok(geometry.index.count / 3 <= 128)
  for(const focus of [0,.1,.4,.75,1,.5,0]) {
    curve.points[0].set(1.6*(1-focus*.25)-focus*2.5,.018,-.35-focus*11.8)
    curve.points[1].set(2.6-focus*2.5,.018,-.875-focus*11.8*.58)
    curve.points[3].x=4.4-1.29*(1+focus*.44)
    updateFlowGeometry(geometry,curve,.18)
    assert.equal(geometry.attributes.position.array,positions)
    assert.equal(geometry.index.array,indices)
    assert.ok(positions.every(Number.isFinite))
  }
  assert.ok(geometry.attributes.uv.array.every(value=>value>=0&&value<=1))
  geometry.dispose()
})
