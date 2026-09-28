<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import { db } from '../../firebase/firebase'
import { dateLabel, money } from '../../lib/stats'
import { call, errorText } from '../../lib/api'
import { hydrateOperations } from '../../lib/hydrateOperations'
import { catalog } from '../../lib/catalog'

const operations = ref([]), sector = ref('all'), operator = ref('all'), service = ref('all'), period = ref('30')
const loading = ref(true), error = ref(''), editing = ref(null), editServiceIds = ref([]), editLocation = ref(''), saving = ref(false), pendingDelete = ref(null)
let stop
const operators = computed(() => [...new Set(operations.value.map(row => row.operatorName).filter(Boolean))].sort())
const services = computed(() => [...new Map(operations.value.flatMap(row => row.services).map(item => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name)))
const filtered = computed(() => {
  const cutoff = period.value === 'all' ? 0 : Date.now() - Number(period.value) * 86400000
  return operations.value.filter(row => {
    const date = row.createdAt?.seconds ? row.createdAt.seconds * 1000 : 0
    return (sector.value === 'all' || row.sector === sector.value) && (operator.value === 'all' || row.operatorName === operator.value) && (service.value === 'all' || row.services.some(item => item.id === service.value)) && (!cutoff || date >= cutoff)
  })
})
const total = computed(() => filtered.value.reduce((sum, row) => sum + row.services.reduce((n, item) => n + (item.priceCents || 0), 0), 0))
const editServices = computed(() => editing.value ? catalog.filter(item => item.sector === editing.value.sector) : [])
function edit(row) { editing.value = row; editServiceIds.value = [...row.serviceIds]; editLocation.value = row.location || '' }
function closeEdit() { editing.value = null; editServiceIds.value = []; editLocation.value = '' }
async function saveEdit() { if (!editing.value || saving.value || !editServiceIds.value.length) return; saving.value = true; try { await call('updateOperation', { id: editing.value.id, serviceIds: editServiceIds.value, location: editLocation.value }); toast.success('Opération modifiée.', { autoClose: 1800 }); closeEdit() } catch (e) { error.value = errorText(e); toast.error(error.value, { autoClose: 3500 }) } finally { saving.value = false } }
function remove(row) { if (saving.value) return; pendingDelete.value = row; toast.warning('Confirme la suppression dans le panneau affiché.', { autoClose: 2500 }) }
function cancelDelete() { pendingDelete.value = null }
async function confirmDelete() { if (!pendingDelete.value || saving.value) return; saving.value = true; try { await call('deleteOperation', { id: pendingDelete.value.id }); toast.success('Opération supprimée.', { autoClose: 1800 }); pendingDelete.value = null } catch (e) { error.value = errorText(e); toast.error(error.value, { autoClose: 3500 }) } finally { saving.value = false } }
onMounted(() => { stop = onSnapshot(query(collection(db, 'entries'), orderBy('date', 'desc'), limit(500)), async snapshot => { try { operations.value = await hydrateOperations(snapshot, true); loading.value = false } catch (e) { error.value = errorText(e); loading.value = false } }, e => { error.value = errorText(e); loading.value = false }) })
onUnmounted(() => stop?.())
</script>
<template>
  <div class="eyebrow">TRAÇABILITÉ</div><h1>Suivi des opérations.</h1><p class="subtitle">Toutes les prestations réalisées, avec leur date, secteur, opérateur et emplacement.</p>
  <section class="panel history-filters"><label>Période<select v-model="period"><option value="1">Aujourd’hui</option><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="all">Tout</option></select></label><label>Secteur<select v-model="sector"><option value="all">Tous</option><option value="parc">Parc</option><option value="atelier">Atelier</option></select></label><label>Opérateur<select v-model="operator"><option value="all">Tous</option><option v-for="item in operators" :key="item" :value="item">{{ item }}</option></select></label><label>Prestation<select v-model="service"><option value="all">Toutes</option><option v-for="item in services" :key="item.id" :value="item.id">{{ item.name }}</option></select></label></section>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-else-if="loading" role="status">Chargement des opérations…</p>
  <section v-if="pendingDelete" class="notice confirm-panel"><span>Supprimer cette opération du {{ dateLabel(pendingDelete.createdAt) }} ?</span><span class="row-actions"><button class="secondary" :disabled="saving" @click="cancelDelete">Annuler</button><button class="secondary danger" :disabled="saving" @click="confirmDelete">{{ saving ? 'Suppression…' : 'Confirmer' }}</button></span></section>
  <section v-else class="panel"><div class="panel-heading"><div><h2>{{ filtered.length }} opération(s)</h2><p>Total filtré : {{ money(total) }}</p></div><span class="badge">Monitoring en temps réel</span></div><div class="table-scroll"><table><thead><tr><th>Date</th><th>Secteur</th><th>Prestations</th><th>Opérateur</th><th>Emplacement</th><th></th></tr></thead><tbody><tr v-for="row in filtered" :key="row.id"><td>{{ dateLabel(row.createdAt) }}</td><td><span class="badge" :class="row.sector">{{ row.sector === 'parc' ? 'Parc' : 'Atelier' }}</span></td><td>{{ row.services.map(item => item.name).join(', ') }}</td><td>{{ row.operatorName || '—' }}</td><td>{{ row.location || '—' }}</td><td><div class="row-actions"><button class="secondary" :disabled="saving" @click="edit(row)">Modifier</button><button class="secondary danger" :disabled="saving" @click="remove(row)">Supprimer</button></div></td></tr><tr v-if="!filtered.length"><td colspan="6" class="empty-cell">Aucune opération pour ces filtres.</td></tr></tbody></table></div></section>
  <section v-if="editing" class="panel edit-panel"><div class="panel-heading"><div><h2>Modifier l’opération</h2><p>{{ dateLabel(editing.createdAt) }} · {{ editing.sector }}</p></div><button class="secondary" @click="closeEdit">Fermer</button></div><label v-if="editing.sector === 'parc'">Emplacement<input v-model="editLocation" maxlength="50" /></label><label>Prestations</label><div class="service-grid"><label v-for="item in editServices" :key="item.id" class="service" :class="{ checked: editServiceIds.includes(item.id) }"><input v-model="editServiceIds" type="checkbox" :value="item.id" /><span>{{ item.name }}</span></label></div><div class="form-footer"><span>{{ editServiceIds.length }} prestation(s)</span><button class="primary" :disabled="saving || !editServiceIds.length" @click="saveEdit">Enregistrer</button></div></section>
</template>
