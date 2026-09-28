import { onUnmounted, ref } from 'vue'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { catalog as fallbackCatalog } from './catalog'

export function useCatalog() {
  const services = ref([...fallbackCatalog])
  const loading = ref(true)
  const error = ref('')
  const stop = onSnapshot(query(collection(db, 'services'), orderBy('name')), snapshot => {
    services.value = snapshot.empty
      ? [...fallbackCatalog]
      : snapshot.docs.map(document => ({ id: document.id, ...document.data() }))
    loading.value = false
  }, value => { error.value = value.message; loading.value = false })
  onUnmounted(stop)
  return { services, loading, error }
}
