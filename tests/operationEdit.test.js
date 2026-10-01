import test from 'node:test'
import assert from 'node:assert/strict'
import {operationEdit} from '../src/lib/operationEdit.js'
const input={sector:'parc',parcIdentifier:'Lawson 2',operationDate:'2026-10-02',hours:{navette:10,controle:3.5,jumelage:99},hours25:{navette:2},hours50:{navette:1},prorata:{controle:true},price:'999 €'}
test('editing recalculates quantities and discards removed activities',()=>{
  const result=operationEdit(input,[{id:'navette'},{id:'controle'}])
  assert.equal(result.price,'149.94 €')
  assert.equal(result.hours.jumelage,undefined)
  assert.equal(result.parcIdentifier,'Lawson 2')
  assert.equal(result.date,'2026-10-02')
})
test('full daily activity defaults to seven hours without overtime',()=>{
  const result=operationEdit({...input,prorata:{}},[{id:'controle'}])
  assert.equal(result.price,'177.80 €')
  assert.equal(result.hours.controle,7)
  assert.deepEqual(result.hours25,{})
})
test('rejects invalid date and negative quantities',()=>{
  assert.throws(()=>operationEdit({...input,operationDate:'2026-02-30'},[]))
  assert.throws(()=>operationEdit({...input,hours:{navette:-1}},[{id:'navette'}]))
})
