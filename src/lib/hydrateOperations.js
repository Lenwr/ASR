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
  return entries.map(entry => ({
    ...entry,
    services: entry.serviceIds.map(id => ({
      id, name: catalog.find(service => service.id === id)?.name || id,
      ...(withPrices ? { priceCents: versions.get(entry.tariffVersion)[id] } : {}),
    })),
  })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}
