import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { onCall,HttpsError } from 'firebase-functions/v2/https'
import { catalog } from './catalog.js'
import { validateOperation,canRecord,validPrice } from './domain.js'
initializeApp()
const db=getFirestore(), options={region:'europe-west1',maxInstances:10}
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function profileIn(transaction,request,admin=false) {
  if(!request.auth)throw new HttpsError('unauthenticated','Connexion requise.')
  const snap=await transaction.get(db.doc(`users/${request.auth.uid}`)),profile=snap.data()
  if(!profile || profile.active===false || !['operator','manager','admin'].includes(profile.role) || (admin && profile.role!=='admin'))throw new HttpsError('permission-denied','Accès non autorisé.')
  return profile
}
function audit(transaction,uid,action,target,before,after) {
  transaction.create(db.collection('audit').doc(),{actor:uid,action,target,before:before??null,after,createdAt:FieldValue.serverTimestamp()})
}
export const recordOperation=onCall(options,async request=>{
  let entry
  try {entry=validateOperation(request.data,catalog)}catch(e){throw new HttpsError('invalid-argument',e.message)}
  if(!request.auth)throw new HttpsError('unauthenticated','Connexion requise.')
  const uid=request.auth.uid,date=today(),ref=db.doc(`operations/${uid}_${request.data.requestId}`)
  return db.runTransaction(async transaction=>{
    const profile=await profileIn(transaction,request)
    if(!canRecord(profile,entry.sector))throw new HttpsError('permission-denied','Vous n’avez pas accès à ce secteur.')
    const existing=await transaction.get(ref)
    if(existing.exists)return {id:ref.id}
    const priceDocs=await Promise.all(entry.services.map(s=>transaction.get(db.doc(`prices/${s.id}`))))
    const locks=entry.kind==='daily'?entry.services.map(s=>db.doc(`dailyLocks/${uid}_${date}_${s.id}`)):[]
    const lockDocs=await Promise.all(locks.map(lock=>transaction.get(lock)))
    if(lockDocs.some(s=>s.exists))throw new HttpsError('already-exists','Un de ces forfaits a déjà été enregistré pour vous aujourd’hui. Décochez-le avant de réessayer.')
    const services=entry.services.map((s,i)=>({id:s.id,name:s.name,priceCents:priceDocs[i].exists?priceDocs[i].data().priceCents:s.priceCents}))
    if(services.some(s=>!validPrice(s.priceCents)))throw new HttpsError('failed-precondition','Un tarif est invalide. Contactez l’administrateur.')
    const data={...entry,services,date,operatorId:uid,operatorName:profile.name || profile.email || uid,createdAt:FieldValue.serverTimestamp()}
    transaction.create(ref,data)
    transaction.create(db.doc(`activity/${ref.id}`),{...data,services:services.map(({id,name})=>({id,name}))})
    locks.forEach(lock=>transaction.create(lock,{operationId:ref.id,createdAt:FieldValue.serverTimestamp()}))
    return {id:ref.id}
  })
})
export const updatePrice=onCall(options,async request=>{
  const {id,priceCents}=request.data || {}
  if(!catalog.some(s=>s.id===id) || !validPrice(priceCents))throw new HttpsError('invalid-argument','Tarif invalide.')
  return db.runTransaction(async transaction=>{
    await profileIn(transaction,request,true)
    const ref=db.doc(`prices/${id}`),previous=await transaction.get(ref)
    const data={priceCents,updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid}
    transaction.set(ref,data)
    audit(transaction,request.auth.uid,'price.update',id,previous.data() || {priceCents:catalog.find(s=>s.id===id).priceCents},data)
    return {ok:true}
  })
})
export const updateUser=onCall(options,async request=>{
  const {uid,name,role,parc,atelier,active}=request.data || {}
  if(typeof uid!=='string'||!uid||uid.length>128||uid.includes('/')||typeof name!=='string'||!name.trim()||name.length>80||!['admin','manager','operator'].includes(role)||[parc,atelier,active].some(v=>typeof v!=='boolean'))throw new HttpsError('invalid-argument','Profil invalide.')
  if(!request.auth)throw new HttpsError('unauthenticated','Connexion requise.')
  if(uid===request.auth.uid)throw new HttpsError('failed-precondition','Vous ne pouvez pas modifier votre propre compte.')
  // Check privileges before looking up another Authentication account.
  await db.runTransaction(transaction=>profileIn(transaction,request,true))
  let account
  try {account=await getAuth().getUser(uid)}catch{throw new HttpsError('not-found','Compte Authentication introuvable. Créez-le d’abord dans Firebase.')}
  return db.runTransaction(async transaction=>{
    await profileIn(transaction,request,true)
    const ref=db.doc(`users/${uid}`),previous=await transaction.get(ref)
    const data={name:name.trim(),email:account.email || '',role,parc,atelier,active,updatedAt:FieldValue.serverTimestamp()}
    transaction.set(ref,data)
    audit(transaction,request.auth.uid,'user.update',uid,previous.data(),data)
    return {ok:true}
  })
})

export const getPrices=onCall(options,async request=>db.runTransaction(async transaction=>{
  await profileIn(transaction,request,true)
  const docs=await Promise.all(catalog.map(s=>transaction.get(db.doc(`prices/${s.id}`))))
  return Object.fromEntries(catalog.map((s,i)=>[s.id,docs[i].exists?docs[i].data().priceCents:s.priceCents]))
}))
