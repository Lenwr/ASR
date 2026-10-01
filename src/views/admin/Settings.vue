<script setup>import { ref,onUnmounted,computed,onMounted } from 'vue'
import { collection,onSnapshot } from 'firebase/firestore'

import { db } from '../../firebase/firebase'
import { useCatalog } from '../../lib/useCatalog'
import { call,errorText } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'

const props=defineProps({users:Boolean}),auth=useAuthStore()
const entries=ref([]),prices=ref({}),error=ref(''),success=ref(''),busy=ref(false),loading=ref(true),initialized=ref(false)
const { services: catalogServices } = useCatalog()
const profile=ref({uid:'',name:'',accessRole:'admin',role:'admin',parc:true,atelier:true,active:true})
const services=computed(()=>catalogServices.value.map(s=>({...s,priceCents:Object.hasOwn(prices.value,s.id)?prices.value[s.id]:(s.priceCents??s.initialPriceCents??null)})))
const priceInputs=ref({})
const serviceForm=ref({id:'',name:'',sector:'parc',kind:'unit',price:''})
const editingService=ref(false)
let stop=null

const accessRoles = { admin: 'Administrateur', superAdmin: 'Super administrateur' }

function roleKey(user) {
  return user.role === 'superAdmin' ? 'superAdmin' : 'admin'
}

function accessLabel(user) {
  const key = roleKey(user)
  return key === 'admin' ? 'Tous les accès' : accessRoles[key]
}

function applyAccessRole() {
  if (['admin','superAdmin'].includes(profile.value.accessRole)) {
    profile.value.role = profile.value.accessRole
    profile.value.parc = true
    profile.value.atelier = true
    return
  }

  profile.value.role = 'admin'
  profile.value.parc = true
  profile.value.atelier = true
}

function payloadProfile() {
  applyAccessRole()
  const { accessRole, ...payload } = profile.value
  return payload
}

function editUser(user) {
  profile.value = {
    uid: user.uid,
    name: user.name || '',
    accessRole: roleKey(user),
    role: user.role,
    parc: !!user.parc || user.role === 'admin',
    atelier: !!user.atelier || user.role === 'admin',
    active: user.active !== false
  }
}

function fillInputs() {
  for (const s of services.value) priceInputs.value[s.id]=s.priceCents==null?'':(s.priceCents/100).toFixed(2)
}

onMounted(async()=>{
  if(props.users) {
    stop=onSnapshot(collection(db,'users'),snap=>{
      entries.value=snap.docs.map(d=>({...d.data(),uid:d.id}))
      loading.value=false
    },e=>{error.value=errorText(e);loading.value=false})
    return
  }
  try {
    await call('migrateCatalog',{})
    const result=await call('getPrices',{})
    initialized.value=!!result
    prices.value=result||{}
    fillInputs()
  } catch(e) { error.value=errorText(e) }
  finally { loading.value=false }
})
onUnmounted(()=>stop?.())

async function action(name,data) {
  busy.value=true;error.value='';success.value=''
  try {
    await call(name,data)
    success.value='Modification enregistrée et tracée.'
    if(!props.users) {
      const result=await call('getPrices',{})
      initialized.value=!!result;prices.value=result||{};fillInputs()
    }
  } catch(e){error.value=errorText(e)} finally{busy.value=false}
}
async function initialize() {
  await action('initializePrices',{})
}
function savePrice(s){
  const raw=priceInputs.value[s.id]
  const value=raw===''?null:Number(raw)
  if(value!==null&&(!Number.isFinite(value)||value<0)){error.value='Saisissez un tarif positif ou nul.';return}
  action('updatePrice',{id:s.id,priceCents:value===null?null:Math.round(value*100)})
}
function editService(s){serviceForm.value={id:s.id,name:s.name,sector:s.sector,kind:s.kind,price:s.priceCents==null?'':(s.priceCents/100).toFixed(2)};editingService.value=true}
function resetService(){serviceForm.value={id:'',name:'',sector:'parc',kind:'unit',price:''};editingService.value=false}
async function saveService(){
  const raw=serviceForm.value.price,priceCents=raw===''?null:Math.round(Number(raw)*100)
  await action('saveService',{id:serviceForm.value.id,name:serviceForm.value.name,sector:serviceForm.value.sector,kind:serviceForm.value.kind,priceCents})
  resetService()
}
async function deleteServiceItem(s){
  await action('deleteService',{id:s.id})
  if(serviceForm.value.id===s.id)resetService()
}
</script>

<template>
  <div class="eyebrow">ADMINISTRATION</div>
  <h1>{{ users?'Une équipe, les bons accès.':'Prestations & forfaits journaliers.' }}</h1>
  <p class="subtitle">{{ users?'Attribuez à chaque personne un rôle et ses secteurs autorisés.':'Les tarifs sont visibles uniquement dans l’espace de pilotage. Chaque nouvelle version est conservée pour l’historique.' }}</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="success" class="success" role="status">{{ success }}</p><p v-if="loading">Chargement…</p>

  <template v-else-if="users">
    <section class="panel"><h2>Configurer un accès</h2><p class="muted">Créez d’abord le compte dans Firebase Authentication, puis renseignez son UID ici. Aucun mot de passe n’est stocké dans l’application.</p><form class="settings-form" @submit.prevent="action('updateUser',payloadProfile())"><label>UID Firebase<input v-model="profile.uid" required placeholder="Identifiant du compte Authentication"/></label><label>Nom / identifiant opérateur<input v-model="profile.name" required maxlength="80"/></label><label>Rôle<select v-model="profile.accessRole" @change="applyAccessRole"><option v-for="(label,key) in accessRoles" :key="key" :value="key">{{ label }}</option></select></label><div class="checks"><label><input type="checkbox" :checked="profile.accessRole==='admin' || profile.accessRole==='parc'" disabled/> Parc</label><label><input type="checkbox" :checked="profile.accessRole==='admin' || profile.accessRole==='atelier'" disabled/> Atelier</label><label><input type="checkbox" v-model="profile.active"/> Compte actif</label></div><p class="muted">Administrateur : gestion complète. Parc : saisie Parc uniquement. Atelier : saisie Atelier uniquement.</p><button class="primary" :disabled="busy || profile.uid===auth.user.uid">Enregistrer les accès</button><small v-if="profile.uid===auth.user.uid">Votre propre compte ne peut pas être modifié ici.</small></form></section>
    <section class="panel"><div class="table-scroll"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Accès</th><th>Statut</th><th></th></tr></thead><tbody><tr v-for="u in entries" :key="u.uid"><td><strong>{{ u.name || u.email || u.uid }}</strong><small>{{ u.email || u.uid }}</small></td><td>{{ accessRoles[roleKey(u)] || 'Rôle inconnu' }}</td><td><span class="badge" :class="{parc:roleKey(u)==='parc'||roleKey(u)==='admin',atelier:roleKey(u)==='atelier'||roleKey(u)==='admin'}">{{ accessLabel(u) }}</span></td><td><span class="badge" :class="{green:u.active!==false,orange:u.active===false}">{{ u.active===false?'Désactivé':'Actif' }}</span></td><td><button class="secondary" :disabled="busy" @click="editUser(u)">Modifier</button></td></tr></tbody></table></div></section>
  </template>

  <template v-else-if="!loading">
    <section class="panel"><div class="panel-heading"><div><h2>{{ editingService?'Modifier la prestation':'Créer une prestation' }}</h2><p>Une prestation appartient à un seul secteur.</p></div><button v-if="editingService" class="secondary" @click="resetService">Annuler</button></div><form class="service-admin-form" @submit.prevent="saveService"><label>Identifiant<input v-model="serviceForm.id" required pattern="[a-z0-9][a-z0-9-]{1,63}" :disabled="editingService" placeholder="ex. lavage-exterieur"/></label><label>Nom<input v-model="serviceForm.name" required maxlength="80" placeholder="Nom de la prestation"/></label><label>Secteur<select v-model="serviceForm.sector"><option value="parc">Parc</option><option value="atelier">Atelier</option></select></label><label>Facturation<select v-model="serviceForm.kind"><option value="unit">Unitaire</option><option value="daily">Forfait journalier</option></select></label><label>Tarif (€)<input v-model="serviceForm.price" type="number" min="0" step="0.01" placeholder="À définir"/></label><button class="primary" :disabled="busy">{{ editingService?'Enregistrer':'Créer' }}</button></form></section>
    <section v-if="!initialized" class="panel"><h2>Initialiser le catalogue</h2><p>Cette opération crée les tarifs de départ : Parc unitaire, forfaits Parc à 177,80 €, Atelier unitaire, et laisse les forfaits Atelier à définir.</p><button class="primary" :disabled="busy" @click="initialize">Initialiser les tarifs</button></section>
    <section v-else class="panel"><div class="table-scroll"><table><thead><tr><th>Prestation / activité</th><th>Secteur</th><th>Facturation</th><th>Tarif (€)</th><th></th></tr></thead><tbody><tr v-for="s in services" :key="s.id"><td><strong>{{ s.name }}</strong></td><td><span class="badge" :class="s.sector">{{ s.sector }}</span></td><td>{{ s.kind==='daily'?'Forfait journalier / opérateur':'Prix unitaire' }}</td><td>{{ s.priceCents==null?'À définir':(s.priceCents/100).toFixed(2) }}</td><td><div class="row-actions"><button class="secondary" :disabled="busy" @click="editService(s)">Modifier</button><button class="secondary danger" :disabled="busy" @click="deleteServiceItem(s)">Supprimer</button></div></td></tr></tbody></table></div></section>
  </template>
</template>
