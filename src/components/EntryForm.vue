<script setup>
import { ref, computed, nextTick } from 'vue'
import { Check, ArrowRight, MapPin } from 'lucide-vue-next'
import { catalog } from '../lib/catalog'
import { call, errorText } from '../lib/api'

const props = defineProps({
  parc: Boolean
})

const vehicle = ref('')
const location = ref('')
const selected = ref([])
const busy = ref(false)
const error = ref('')
const success = ref('')
const vehicleInput = ref(null)

let requestId = null

const sector = computed(() => props.parc ? 'parc' : 'atelier')

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
      vehicle: vehicle.value,
      location: location.value,
      serviceIds: selected.value
    })

    success.value =
      'Saisie enregistrée. Vous pouvez saisir le véhicule suivant.'

    vehicle.value = ''
    location.value = ''
    selected.value = []
    requestId = null

    await nextTick()
    vehicleInput.value?.focus()

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

      <!-- VEHICULE -->
      <label for="vehicle">
        01
        <span>Plaque d’immatriculation ou VIN</span>
      </label>

      <input
        id="vehicle"
        ref="vehicleInput"
        v-model="vehicle"
        placeholder="Ex. AB-123-CD"
        maxlength="30"
        required
        autocomplete="off"
        class="vehicle-input"
      />

      <!-- PRESTATIONS UNITAIRES -->
      <label>
        02
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
        03
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
          04
          <span>Emplacement de dépôt</span>
        </label>

        <div class="input-icon">

          <MapPin :size="18" />

          <input
            id="location"
            v-model="location"
            placeholder="Ex. B-124 ou ZONE C-42"
            maxlength="50"
            required
          />

        </div>

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