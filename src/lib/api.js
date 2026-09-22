import { auth, db } from '../firebase/firebase.js'
import { createFirestoreService } from './firestore-service.js'
const service = createFirestoreService(db, () => auth.currentUser?.uid)
export async function call(name, data) {
  if (!Object.hasOwn(service, name)) throw new Error('Action inconnue.')
  return service[name](data)
}
export function errorText(error) {
  if (error.code?.includes('permission-denied')) return 'Action refusée. Vérifiez vos droits, la date de l’appareil et la publication des règles Firestore.'
  if (error.code?.includes('unavailable')) return 'Connexion indisponible. Reconnectez-vous à Internet puis réessayez ; la saisie n’est pas confirmée.'
  return error.message || 'Une erreur est survenue. Réessayez.'
}
