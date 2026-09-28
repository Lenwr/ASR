import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { catalog } from './catalog.js'

export async function hydrateOperations(snapshot, withPrices) {
  const entries = snapshot.docs.map(document => ({ id: document.id, ...document.data() }))
  const versions = new Map()
  if (withPrices) {
    await Promise.all([...new Set(entries.map(entry => entry.tariffVersion))].map(async id => {
      const version = await getDoc(doc(db, 'tariffVersions', id))
      if (!version.exists()) throw new Error('Un tarif historique est introuvable. Les montants ne peuvent pas être affichés.')
      versions.set(id, version.data().rates)
    }))
  }
  return entries.map(entry => {
    const alreadyCountedDailyServiceIds =
      new Set(entry.alreadyCountedDailyServiceIds || [])

    return {
      ...entry,
      services: entry.serviceIds.map(id => {
        const service = catalog.find(item => item.id === id)
        const priceCents =
          withPrices && alreadyCountedDailyServiceIds.has(id)
            ? 0
            : versions.get(entry.tariffVersion)?.[id]

        return {
          id,
          name: service?.name || id,
          kind: service?.kind || entry.kind,
          ...(withPrices ? { priceCents } : {}),
        }
      }),
    }
  }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}
