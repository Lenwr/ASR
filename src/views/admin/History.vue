<script setup>
import { ref,onUnmounted } from 'vue'
import { collection,query,where,onSnapshot } from 'firebase/firestore'
import { Search } from 'lucide-vue-next'
import { db } from '../../firebase/firebase'
import AppShell from '../../components/AppShell.vue'
import { dateLabel,money } from '../../lib/stats'
import { errorText } from '../../lib/api'
import { hydrateOperations } from '../../lib/hydrateOperations'
const search=ref(''),rows=ref([]),error=ref(''),loading=ref(false),searched=ref(false)
let stop, generation=0
function find() { stop?.();generation++;rows.value=[];error.value='';if(!search.value.trim())return;loading.value=true;searched.value=true;stop=onSnapshot(query(collection(db,'entries'),where('vehicle','==',search.value.toUpperCase().replace(/[^A-Z0-9]/g,''))),async snapshot=>{const current=++generation;try{const result=await hydrateOperations(snapshot,true);if(current!==generation)return;rows.value=result;loading.value=false}catch(e){if(current===generation){error.value=errorText(e);loading.value=false}}},e=>{generation++;rows.value=[];error.value=errorText(e);loading.value=false}) }
onUnmounted(()=>{generation++;stop?.()})
</script>
<template><AppShell><div class="eyebrow">TRAÇABILITÉ</div><h1>Un véhicule, toute son histoire.</h1><p class="subtitle">Retrouvez les prestations, l’opérateur et le dernier emplacement connu.</p><form class="search-form" @submit.prevent="find"><label class="sr-only" for="search">Plaque ou VIN</label><input id="search" v-model="search" placeholder="Saisir une plaque ou un VIN" required maxlength="30"/><button class="primary"><Search :size="18"/> Rechercher</button></form><p v-if="error" class="error" role="alert">{{ error }}</p><p v-else-if="loading" role="status">Recherche en cours…</p><section v-else-if="searched" class="panel"><div class="panel-heading"><h2>{{ rows.length }} opération(s)</h2><span class="badge">Dernier emplacement : {{ rows.find(r=>r.location)?.location || 'Non renseigné' }}</span></div><div class="table-scroll"><table><thead><tr><th>Date</th><th>Prestations</th><th>Opérateur</th><th>Emplacement</th><th>Montant</th></tr></thead><tbody><tr v-for="r in rows" :key="r.id"><td>{{ dateLabel(r.createdAt) }}</td><td>{{ r.services.map(s=>s.name).join(', ') }}<small>{{ r.sector }}</small></td><td>{{ r.operatorName }}</td><td>{{ r.location || '—' }}</td><td>{{ money(r.services.reduce((n,s)=>n+(s.priceCents||0),0)) }}<small v-if="r.services.some(s=>s.priceCents==null)">Tarification incomplète</small></td></tr><tr v-if="!rows.length"><td colspan="5" class="empty-cell">Aucun historique pour ce véhicule.</td></tr></tbody></table></div></section></AppShell></template>
