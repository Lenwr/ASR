import test from 'node:test'
import assert from 'node:assert/strict'
import { validateOperation,canRecord,canReport,validPrice } from '../src/lib/domain.js'
import { catalog } from '../scripts/initial-tariffs.js'
import { catalog as frontendCatalog } from '../src/lib/catalog.js'
import { summarize,exportCsv,dayKey } from '../src/lib/stats.js'
const base={requestId:'01234567-89101112',sector:'parc',kind:'unit',vehicle:'ab-123-cd',location:' b-124 ',serviceIds:['jumelage','carburant']}
test('normalise véhicule/emplacement et conserve les activités indépendantes',()=>{const r=validateOperation(base,catalog);assert.equal(r.vehicle,'AB123CD');assert.equal(r.location,'B-124');assert.equal(r.services.length,2)})
test('refuse emplacement absent, prestation étrangère et doublons',()=>{for(const data of [{...base,location:' '},{...base,serviceIds:['vo']},{...base,serviceIds:['jumelage','jumelage']},{...base,serviceIds:['inventaire']},{...base,requestId:'../x'}])assert.throws(()=>validateOperation(data,catalog))})
test('forfait sans véhicule et tarif atelier inconnu',()=>{const r=validateOperation({...base,sector:'atelier',kind:'daily',serviceIds:['diagnostic']},catalog);assert.equal(r.vehicle,'');assert.equal(r.location,'');assert.equal(r.services[0].priceCents,null)})
test('permissions : secteurs, admin en lecture, compte désactivé',()=>{assert.equal(canRecord({role:'operator',parc:true},'parc'),true);assert.equal(canRecord({role:'operator',parc:true},'atelier'),false);assert.equal(canRecord({role:'manager',parc:true},'parc'),false);assert.equal(canReport({role:'admin'}),true);assert.equal(canReport({role:'operator'}),false);assert.equal(canRecord({role:'admin',active:false},'parc'),false)})
test('tarifs en centimes, jamais négatifs ou flottants',()=>{for(const v of [-1,NaN,Infinity,3.28,'328',100000001])assert.equal(validPrice(v),false);for(const v of [null,0,328])assert.equal(validPrice(v),true)})
test('stats exactes, véhicules uniques, forfaits et tarifs inconnus séparés',()=>{const rows=[{vehicle:'AB123CD',operatorId:'a',date:'2026-09-22',kind:'unit',services:[{id:'j',name:'Jumelage',priceCents:328}]},{vehicle:'AB123CD',operatorId:'b',date:'2026-09-22',kind:'unit',services:[{id:'j',name:'Jumelage',priceCents:350}]},{vehicle:'',operatorId:'a',date:'2026-09-22',kind:'daily',services:[{id:'d',name:'Diagnostic',priceCents:null}]}];const s=summarize(rows);assert.equal(s.vehicles,1);assert.equal(s.total,678);assert.equal(s.count,3);assert.equal(s.pending,1);assert.equal(s.operators.length,2);assert.equal(s.services[0].total,678)})
test('export CSV neutralise les formules et échappe les guillemets',()=>{const csv=exportCsv([{date:'2026-09-22',operatorName:'=HYPERLINK("evil")',services:[{name:'test',priceCents:328}]}]);assert.ok(csv.includes(`"'=HYPERLINK(""evil"")"`));assert.ok(csv.includes('3,28'))})
test('jour métier en Europe/Paris',()=>assert.equal(dayKey(new Date('2026-09-21T23:00:00Z')),'2026-09-22'))
test('catalogues serveur et interface identiques',()=>assert.deepEqual(catalog.map(({priceCents,...s})=>s),frontendCatalog.map(({initialPriceCents,...s})=>s)))
