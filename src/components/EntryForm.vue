<script setup>
import { ref, computed, onMounted } from 'vue'
import { Check, ArrowRight, MapPin } from 'lucide-vue-next'
import { catalog } from '../lib/catalog'
import { call, errorText } from '../lib/api'

const props = defineProps({
  parc: Boolean
})

const location = ref('')
const locationSuggestions = ref([])
const selected = ref([])
const busy = ref(false)
const error = ref('')
const success = ref('')

let requestId = null

const sector = computed(() => props.parc ? 'parc' : 'atelier')
const locationStorageKey = 'asr.locationSuggestions'

const unitServices = computed(() =>
  catalog.filter(
    service =>
      service.sector === sector.value &&
      service.kind === 'unit'
  )
)

const dailyServices = computed(() =>
  catalog.filter(
    service =>
      service.sector === sector.value &&
      service.kind === 'daily'
  )
)


onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(locationStorageKey) || '[]')
    locationSuggestions.value = Array.isArray(saved)
      ? saved.filter(item => typeof item === 'string').slice(0, 20)
      : []
  } catch {
    locationSuggestions.value = []
  }
})

function normalizeLocation(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function rememberLocation(value) {
  const normalized = normalizeLocation(value)
  if (!normalized) return

  const next = [
    normalized,
    ...locationSuggestions.value.filter(item => item !== normalized)
  ].slice(0, 20)

  locationSuggestions.value = next
  localStorage.setItem(locationStorageKey, JSON.stringify(next))
}

async function submit() {
  if (busy.value) return

  error.value = ''
  success.value = ''

  if (!selected.value.length) {
    error.value = 'Sélectionnez au moins une prestation.'
    return
  }

  busy.value = true
  requestId ||= crypto.randomUUID()

  try {
    await call('recordOperation', {
      requestId,
      sector: sector.value,
      vehicle: '',
      location: normalizeLocation(location.value),
      serviceIds: selected.value
    })

    if (props.parc) {
      rememberLocation(location.value)
    }

    success.value =
      'Saisie enregistrée. Vous pouvez saisir le véhicule suivant.'

    location.value = ''
    selected.value = []
    requestId = null

  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="formCard" @submit.prevent="submit">

    <fieldset
      :disabled="busy"
      @input="requestId = null"
    >

      <!-- PRESTATIONS UNITAIRES -->
      <label>
        01
        <span>Prestations effectuées</span>
      </label>

      <p class="muted">
        Prestations facturées par véhicule
      </p>

      <div class="service-grid">

        <label
          v-for="service in unitServices"
          :key="service.id"
          class="service"
          :class="{ checked: selected.includes(service.id) }"
        >
          <input
            v-model="selected"
            type="checkbox"
            :value="service.id"
          />

          <span>{{ service.name }}</span>

          <Check
            v-if="selected.includes(service.id)"
            :size="18"
          />
        </label>

      </div>

      <!-- FORFAITS -->
      <label class="daily-title">
        02
        <span>Activités au forfait journalier</span>
      </label>

      <p class="muted">
        Une seule facturation par activité, utilisateur et journée.
      </p>

      <div class="service-grid">

        <label
          v-for="service in dailyServices"
          :key="service.id"
          class="service"
          :class="{ checked: selected.includes(service.id) }"
        >
          <input
            v-model="selected"
            type="checkbox"
            :value="service.id"
          />

          <span>{{ service.name }}</span>

          <Check
            v-if="selected.includes(service.id)"
            :size="18"
          />
        </label>

      </div>

      <!-- EMPLACEMENT PARC -->
      <template v-if="parc">

        <label for="location">
          03
          <span>Emplacement de dépôt</span>
        </label>

        <div class="input-icon">

          <MapPin :size="18" />

          <input
            id="location"
            v-model="location"
            list="location-suggestions"
            placeholder="Ex. B-124, ZONE C-42, RANG 3"
            maxlength="50"
            required
          />

        </div>

        <datalist id="location-suggestions">
          <option
            v-for="item in locationSuggestions"
            :key="item"
            :value="item"
          />
        </datalist>

      </template>

    </fieldset>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>

    <p
      v-if="success"
      class="success"
      role="status"
    >
      {{ success }}
    </p>

    <div class="form-footer">

      <span>
        {{ selected.length }} activité(s) sélectionnée(s)
      </span>

      <button
        class="primary"
        :disabled="busy || !selected.length"
      >
        {{ busy ? 'Enregistrement…' : 'Valider la saisie' }}

        <ArrowRight :size="18" />
      </button>

    </div>

    <small class="muted">
      Votre identité et l’heure sont enregistrées automatiquement.
    </small>

  </form>
</template>
