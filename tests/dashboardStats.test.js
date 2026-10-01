import test from 'node:test'
import assert from 'node:assert/strict'
import {dashboardStats,lawsonId,cycleRange} from '../src/lib/dashboardStats.js'
test('cycle includes previous December and leap February',()=>{
  assert.deepEqual(cycleRange('2026-01'),{start:'2025-12-26',end:'2026-01-25'})
  assert.deepEqual(cycleRange('2024-03'),{start:'2024-02-26',end:'2024-03-25'})
})
test('Lawson attribution ignores the administrator who recorded the entry',()=>{
  const rows=[{id:'a',parcIdentifier:'Lawson 1',operatorId:'admin',date:'2026-10-01',services:[],price:'10 €'},
    {id:'b',parcIdentifier:'Lawson 2',operatorId:'admin',date:'2026-10-01',services:[],price:'20 €'}]
  assert.equal(dashboardStats(rows).amount,30)
  assert.equal(dashboardStats(rows.filter(r=>lawsonId(r)==='Lawson 1')).amount,10)
  assert.equal(lawsonId({vehicle:'LAWSON1'}),'Lawson 1')
})
test('normal movements, overtime and prorata stay in separate totals',()=>{
  const result=dashboardStats([{id:'a',parcIdentifier:'Lawson 1',date:'2026-10-01',price:'242,74 €',
    services:[{id:'navette',name:'Navette',kind:'unit'},{id:'controle',name:'Contrôle',kind:'daily'}],
    hours:{navette:10,controle:3.5},hours25:{navette:2},hours50:{navette:1},prorata:{controle:true}},
    {id:'b',parcIdentifier:'Lawson 1',date:'2026-10-02',services:[{id:'inventaire',name:'Inventaire',kind:'daily'}]}])
  assert.equal(result.hours,10.5)
  assert.equal(result.normal,10)
  assert.equal(result.sup25,2)
  assert.equal(result.sup50,1)
  assert.equal(result.groups[0].prorata,1)
  assert.equal(result.missingAmounts,1)
  assert.equal(result.amount,242.74)
})
