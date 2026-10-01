import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../lib/admin/institutions.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { emptyTenantFilters, filterTenants, tenantCsv, withoutCredentials } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const tenant = (overrides = {}) => ({ id: '1', name: 'İstanbul Eğitim', email: 'info@example.com', status: 'active', users: 2, branches: 1, createdAtUtc: '2026-10-01T10:00:00Z', institutionType: 'PrivateSchool', city: 'İstanbul', verificationState: 'verified', ...overrides })
test('Turkish search finds institution names, contacts and customer numbers', () => {
 const rows = [tenant({customerNumber:'SA-123456', contactName:'Işık Demir'})]
 for (const search of ['istanbul', 'ışık', 'sa-123456', 'INFO@EXAMPLE']) assert.equal(filterTenants(rows, {...emptyTenantFilters, search}).length, 1)
 assert.equal(filterTenants(rows, {...emptyTenantFilters, search:'olmayan'}).length, 0)
})
test('combined filters exclude unverified, other cities, suspicious false and incorrect types', () => {
 const matching = tenant({ id:'match', status:'pending', isSuspicious:true })
 const rows = [matching, tenant({id:'unverified',status:'pending',isSuspicious:true,verificationState:'awaiting'}),tenant({id:'wrongcity',status:'pending',isSuspicious:true,city:'Ankara'}),tenant({id:'wrongtype',status:'pending',isSuspicious:true,institutionType:'CourseCenter'}),tenant({id:'unflagged',status:'pending'})]
 assert.deepEqual(filterTenants(rows, {...emptyTenantFilters,status:'pending',city:'İstanbul',type:'PrivateSchool',verification:'verified',suspicious:true}).map(t=>t.id), ['match'])
})
test('date filtering and sorting use original application date after approval and include whole final day', () => {
 const rows = [tenant({id:'old',createdAtUtc:'2026-10-01T10:00:00Z',registrationCreatedAtUtc:'2026-08-01T10:00:00Z'}),tenant({id:'new',createdAtUtc:'2026-09-30T10:00:00Z'}),tenant({id:'today',createdAtUtc:'2026-10-01T23:59:59'})]
 const filters={...emptyTenantFilters,date:'custom',from:'2026-09-30',to:'2026-10-01'}
 assert.deepEqual(filterTenants(rows,filters).map(t=>t.id), ['today','new'])
 assert.deepEqual(filterTenants(rows,{...filters,sort:'oldest'}).map(t=>t.id),['new','today'])
 assert.deepEqual(filterTenants(rows,{...emptyTenantFilters,date:'30'},new Date('2026-10-01T12:00:00')).map(t=>t.id),['today','new'])
})
test('export quotes delimiters/newlines, neutralizes formulas and never exports credentials', () => {
 const csv=tenantCsv([tenant({name:' =HYPERLINK("x")',email:'a;"b\nc',temporaryPassword:'SECRET',setupDocumentBase64:'PRIVATE',contactName:'PRIVATE CONTACT'})])
 assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\' =HYPERLINK(""x"")"')); assert.ok(csv.includes('"a;""b\nc"')); assert.ok(!csv.includes('SECRET')); assert.ok(!csv.includes('PRIVATE'))
})
test('credentials returned from approval stay out of the institution list state',()=>{
 const safe=withoutCredentials(tenant({temporaryPassword:'SECRET',adminUsername:'user',setupDocumentBase64:'PRIVATE',setupDocumentFileName:'file.pdf'}))
 assert.equal('temporaryPassword' in safe,false); assert.equal('adminUsername' in safe,false); assert.equal('setupDocumentBase64' in safe,false); assert.equal(safe.name,'İstanbul Eğitim')
})
