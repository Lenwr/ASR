<script setup>
import { ref,onUnmounted,computed,onMounted } from 'vue'
import { collection,onSnapshot } from 'firebase/firestore'
import AppShell from '../../components/AppShell.vue'
import { db } from '../../firebase/firebase'
import { catalog,roles } from '../../lib/catalog'
import { call,errorText } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'

const props=defineProps({users:Boolean}),auth=useAuthStore()
const entries=ref([]),prices=ref({}),error=ref(''),success=ref(''),busy=ref(false),loading=ref(true),initialized=ref(false)
const profile=ref({uid:'',name:'',role:'operator',parc:true,atelier:false,active:true})
const services=computed(()=>catalog.map(s=>({...s,priceCents:Object.hasOwn(prices.value,s.id)?prices.value[s.id]:null})))
const priceInputs=ref({})
let stop=null

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
</script>

<template><AppShell>
  <div class="eyebrow">ADMINISTRATION</div>
  <h1>{{ users?'Une équipe, les bons accès.':'Prestations & forfaits journaliers.' }}</h1>
  <p class="subtitle">{{ users?'Attribuez à chaque personne un rôle et ses secteurs autorisés.':'Les tarifs sont visibles uniquement dans l’espace de pilotage. Chaque nouvelle version est conservée pour l’historique.' }}</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="success" class="success" role="status">{{ success }}</p><p v-if="loading">Chargement…</p>

  <template v-else-if="users">
    <section class="panel"><h2>Configurer un accès</h2><p class="muted">Créez d’abord le compte dans Firebase Authentication, puis renseignez son UID ici. Aucun mot de passe n’est stocké dans l’application.</p><form class="settings-form" @submit.prevent="action('updateUser',profile)"><label>UID Firebase<input v-model="profile.uid" required placeholder="Identifiant du compte Authentication"/></label><label>Nom / identifiant opérateur<input v-model="profile.name" required maxlength="80"/></label><label>Rôle<select v-model="profile.role"><option v-for="(label,key) in roles" :key="key" :value="key">{{ label }}</option></select></label><div class="checks"><label><input type="checkbox" v-model="profile.parc"/> Parc</label><label><input type="checkbox" v-model="profile.atelier"/> Atelier</label><label><input type="checkbox" v-model="profile.active"/> Compte actif</label></div><p class="muted">Opérateur : saisie et historique personnel. Administrateur : gestion complète.</p><button class="primary" :disabled="busy || profile.uid===auth.user.uid">Enregistrer les accès</button><small v-if="profile.uid===auth.user.uid">Votre propre compte ne peut pas être modifié ici.</small></form></section>
    <section class="panel"><div class="table-scroll"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Accès</th><th>Statut</th><th></th></tr></thead><tbody><tr v-for="u in entries" :key="u.uid"><td><strong>{{ u.name || u.email || u.uid }}</strong></td><td>{{ roles[u.role] }}</td><td>{{ u.role==='admin'?'Tous':[u.parc?'Parc':'',u.atelier?'Atelier':''].filter(Boolean).join(' · ') || 'Aucun' }}</td><td><span class="badge">{{ u.active===false?'Désactivé':'Actif' }}</span></td><td><button class="secondary" :disabled="busy" @click="profile={uid:u.uid,name:u.name||'',role:u.role,parc:!!u.parc,atelier:!!u.atelier,active:u.active!==false}">Modifier</button></td></tr></tbody></table></div></section>
  </template>

  <template v-else-if="!loading">
    <section v-if="!initialized" class="panel"><h2>Initialiser le catalogue</h2><p>Cette opération crée les tarifs de départ : Parc unitaire, forfaits Parc à 177,80 €, Atelier unitaire, et laisse les forfaits Atelier à définir.</p><button class="primary" :disabled="busy" @click="initialize">Initialiser les tarifs</button></section>
    <section v-else class="panel"><div class="table-scroll"><table><thead><tr><th>Prestation / activité</th><th>Secteur</th><th>Facturation</th><th>Tarif (€)</th><th></th></tr></thead><tbody><tr v-for="s in services" :key="s.id"><td><strong>{{ s.name }}</strong></td><td><span class="badge" :class="s.sector">{{ s.sector }}</span></td><td>{{ s.kind==='daily'?'Forfait journalier / opérateur':'Prix unitaire / véhicule' }}</td><td><input class="price-input" type="number" step="0.01" min="0" max="1000000" v-model="priceInputs[s.id]" :aria-label="`Tarif ${s.name}`" placeholder="À définir"/></td><td><button class="secondary" :disabled="busy" @click="savePrice(s)">Enregistrer</button></td></tr></tbody></table></div><p class="muted"><strong>Règle forfait journalier :</strong> une activité est facturée une seule fois par opérateur et par journée, même si elle concerne plusieurs véhicules. Les forfaits Atelier peuvent être renseignés ou modifiés ici. Un tarif vide reste « à tarifer ».</p></section>
  </template>
</AppShell></template>
