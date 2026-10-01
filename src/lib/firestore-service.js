import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore'

import { catalog, initialRates } from './catalog.js'
import { validateOperation, canRecord, validPrice } from './domain.js'
import { dayKey } from './stats.js'
import { operationEdit } from './operationEdit.js'

// V1 sans Cloud Functions : les écritures passent directement par Firestore.
// Les règles Firestore restent la barrière de sécurité et doivent être
// déployées avec l'application.

export function createFirestoreService(db, getUid) {
  const tariffRef = doc(db, 'settings', 'tariff')

  function uid() {
    const value = getUid()

    if (!value) {
      throw new Error('Connectez-vous pour continuer.')
    }

    return value
  }

  async function readProfile(transaction, requireAdmin = false) {
    const id = uid()

    const snapshot = await transaction.get(
      doc(db, 'users', id)
    )

    const profile = snapshot.data()

    if (
      !profile ||
      profile.active === false ||
      (requireAdmin && !['admin','superAdmin'].includes(profile.role))
    ) {
      throw new Error(
        'Votre compte ne dispose pas des droits nécessaires.'
      )
    }

    return {
      ...profile,
      uid: id
    }
  }

  // =========================================================
  // ENREGISTREMENT D'UNE SAISIE VEHICULE
  // =========================================================

  async function recordOperation(input) {
    const operatorId = uid()

    // requestId permet d'éviter une double création
    // si l'utilisateur clique plusieurs fois.
    const id = `${operatorId}_${input.requestId}`

    const ref = doc(db, 'entries', id)

    return runTransaction(db, async transaction => {
      const profile = await readProfile(transaction)
      const serviceIds = Array.isArray(input?.serviceIds) ? input.serviceIds : []
      const serviceSnapshots = []
      for (const serviceId of serviceIds) serviceSnapshots.push(await transaction.get(doc(db, 'services', serviceId)))
      const available = serviceSnapshots.map((snapshot, index) => snapshot.exists() ? { id: serviceIds[index], ...snapshot.data() } : catalog.find(item => item.id === serviceIds[index])).filter(Boolean)
      const entry = validateOperation(input, available)

      if (!canRecord(profile, entry.sector)) {
        throw new Error(
          'Vous n’avez pas accès à ce secteur.'
        )
      }

      // -------------------------------------------------------
      // Anti double-enregistrement de la même saisie
      // -------------------------------------------------------

      const existing = await transaction.get(ref)

      if (existing.exists()) {
        return {
          id,
          alreadyExists: true
        }
      }

      // -------------------------------------------------------
      // Version tarifaire active
      // -------------------------------------------------------

      // L'opérateur ne récupère pas directement les montants.
      // L'entrée conserve seulement la version tarifaire utilisée.

      const tariff = await transaction.get(tariffRef)
      const date = entry.operationDate || dayKey(new Date())

      // -------------------------------------------------------
      // SERVICES SELECTIONNES
      // -------------------------------------------------------

      const validatedServiceIds = entry.services.map(
        service => service.id
      )

      // On sépare uniquement EN INTERNE les deux modes
      // de facturation.
      //
      // Ils restent enregistrés ensemble dans la même saisie.

      const unitServiceIds = entry.services
        .filter(service => service.kind === 'unit')
        .map(service => service.id)

      const dailyServiceIds = entry.services
        .filter(service => service.kind === 'daily')
        .map(service => service.id)

      // -------------------------------------------------------
      // FORFAITS JOURNALIERS
      // -------------------------------------------------------

      // Un lock représente :
      //
      // utilisateur + journée + activité
      //
      // Exemple :
      // OP001_2026-09-22_parc-chef-navette
      //
      // L'activité peut apparaître dans plusieurs véhicules,
      // mais ne sera comptabilisée financièrement qu'une fois.

      const dailyLocks = dailyServiceIds.map(serviceId => ({
        serviceId,

        ref: doc(
          db,
          'dailyLocks',
          `${operatorId}_${date}_${serviceId}`
        )
      }))

      // IMPORTANT :
      // Toutes les lectures de transaction sont effectuées
      // avant les écritures.

      const dailyLockSnapshots = []

      for (const lock of dailyLocks) {
        const snapshot = await transaction.get(lock.ref)

        dailyLockSnapshots.push({
          ...lock,
          exists: snapshot.exists()
        })
      }

      // -------------------------------------------------------
      // IDENTIFICATION DES NOUVEAUX FORFAITS
      // -------------------------------------------------------

      // Un forfait déjà utilisé aujourd'hui reste présent
      // dans l'historique du véhicule.
      //
      // Mais il n'est PAS facturé une deuxième fois.

      const newlyCountedDailyServiceIds =
        dailyLockSnapshots
          .filter(lock => !lock.exists)
          .map(lock => lock.serviceId)

      const alreadyCountedDailyServiceIds =
        dailyLockSnapshots
          .filter(lock => lock.exists)
          .map(lock => lock.serviceId)

      // -------------------------------------------------------
      // DOCUMENT DE L'OPERATION
      // -------------------------------------------------------

      const data = {
        sector: entry.sector,

        vehicle: entry.vehicle,

        location: entry.location,
        parcIdentifier: entry.parcIdentifier,
        color: entry.color,
        revenue: entry.revenue,
        price: entry.price,
        overtime: entry.overtime,
        percent25: entry.percent25,
        percent50: entry.percent50,
        hours: entry.hours,
        hours25: entry.hours25,
        hours50: entry.hours50,
        prorata: entry.prorata,

        // Toutes les activités réalisées sur CE véhicule.
        serviceIds: validatedServiceIds,

        // Prestations facturées à chaque véhicule.
        unitServiceIds,

        // Activités journalières présentes sur ce véhicule.
        dailyServiceIds,

        // Forfaits qui deviennent facturables avec cette saisie.
        newlyCountedDailyServiceIds,

        // Forfaits déjà comptabilisés plus tôt dans la journée.
        alreadyCountedDailyServiceIds,

        date,

        operatorId,

        operatorName:
          profile.name ||
          profile.identifier ||
          profile.email ||
          operatorId,

        tariffVersion: tariff.exists() ? tariff.data().version : 'manual',

        createdAt: serverTimestamp()
      }

      // -------------------------------------------------------
      // CREATION DE L'OPERATION
      // -------------------------------------------------------

      transaction.set(ref, data)

      // -------------------------------------------------------
      // CREATION DES LOCKS UNIQUEMENT SI NECESSAIRE
      // -------------------------------------------------------

      dailyLockSnapshots
        .filter(lock => !lock.exists)
        .forEach(lock => {
          transaction.set(lock.ref, {
            operationId: id,

            operatorId,

            date,

            serviceId: lock.serviceId,

            sector: entry.sector,

            createdAt: serverTimestamp()
          })
        })

      return {
        id,

        unitServiceIds,

        dailyServiceIds,

        newlyCountedDailyServiceIds,

        alreadyCountedDailyServiceIds
      }
    })
  }

  function servicesForEntry(sector, serviceIds, available = catalog) {
    if (
      !['parc', 'atelier'].includes(sector) ||
      !Array.isArray(serviceIds) ||
      serviceIds.length < 1 ||
      serviceIds.length > 16 ||
      new Set(serviceIds).size !== serviceIds.length
    ) {
      throw new Error('Sélection de prestations invalide.')
    }

    const services = serviceIds.map(id =>
      available.find(
        service =>
          service.id === id &&
          service.sector === sector
      )
    )

    if (services.some(service => !service)) {
      throw new Error(
        'Une prestation sélectionnée est incompatible avec ce secteur.'
      )
    }

    return services
  }

  async function updateOperation(input) {
    const id =
      typeof input?.id === 'string'
        ? input.id
        : ''

    if (!id || id.includes('/')) {
      throw new Error('Saisie introuvable.')
    }

    const ref = doc(db, 'entries', id)
    const audit = doc(collection(db, 'audit'))

    return runTransaction(db, async transaction => {
      const admin = await readProfile(transaction, true)
      const snapshot = await transaction.get(ref)

      if (!snapshot.exists()) {
        throw new Error('Cette saisie n’existe plus.')
      }

      const before = snapshot.data()
      const serviceSnapshots = []
      for (const serviceId of input.serviceIds || []) serviceSnapshots.push(await transaction.get(doc(db, 'services', serviceId)))
      const available = serviceSnapshots.map((item, index) => item.exists() ? { id: input.serviceIds[index], ...item.data() } : catalog.find(service => service.id === input.serviceIds[index])).filter(Boolean)
      const services = servicesForEntry(before.sector, input.serviceIds, available)
      const changes = operationEdit({...input, sector:before.sector}, services)
      const serviceIds = services.map(service => service.id)
      const unitServiceIds = services
        .filter(service => service.kind === 'unit')
        .map(service => service.id)
      const dailyServiceIds = services
        .filter(service => service.kind === 'daily')
        .map(service => service.id)

      const location = ''

      const previousNew = new Set(before.newlyCountedDailyServiceIds || [])
      const previousAlready = new Set(before.alreadyCountedDailyServiceIds || [])
      const nextNew = []
      const nextAlready = []
      const lockChecks = []
      const removedLockChecks = []

      for (const serviceId of dailyServiceIds) {
        const lockRef = doc(
          db,
          'dailyLocks',
          `${before.operatorId}_${changes.date}_${serviceId}`
        )
        const lockSnapshot = await transaction.get(lockRef)

        lockChecks.push({
          serviceId,
          ref: lockRef,
          snapshot: lockSnapshot
        })

        if (before.date === changes.date && previousNew.has(serviceId)) {
          nextNew.push(serviceId)
        } else if (
          (before.date === changes.date && previousAlready.has(serviceId)) ||
          lockSnapshot.exists()
        ) {
          nextAlready.push(serviceId)
        } else {
          nextNew.push(serviceId)
        }
      }

      for (const serviceId of previousNew) {
        if (before.date === changes.date && dailyServiceIds.includes(serviceId)) continue

        const lockRef = doc(
          db,
          'dailyLocks',
          `${before.operatorId}_${before.date}_${serviceId}`
        )
        const lockSnapshot = await transaction.get(lockRef)

        removedLockChecks.push({
          ref: lockRef,
          snapshot: lockSnapshot
        })
      }

      for (const lock of lockChecks) {
        if (!nextNew.includes(lock.serviceId)) continue
        if (lock.snapshot.exists()) continue

        transaction.set(lock.ref, {
          operationId: id,
          operatorId: before.operatorId,
          date: changes.date,
          serviceId: lock.serviceId,
          sector: before.sector,
          createdAt: serverTimestamp()
        })
      }

      for (const lock of removedLockChecks) {
        if (
          lock.snapshot.exists() &&
          lock.snapshot.data().operationId === id
        ) {
          transaction.delete(lock.ref)
        }
      }

      const after = {
        ...before,
        ...changes,
        location,
        serviceIds,
        unitServiceIds,
        dailyServiceIds,
        newlyCountedDailyServiceIds: nextNew,
        alreadyCountedDailyServiceIds: nextAlready,
        updatedBy: admin.uid,
        updatedAt: serverTimestamp(),
        auditId: audit.id
      }

      transaction.update(ref, {
        ...changes,
        location: after.location,
        serviceIds: after.serviceIds,
        unitServiceIds: after.unitServiceIds,
        dailyServiceIds: after.dailyServiceIds,
        newlyCountedDailyServiceIds: after.newlyCountedDailyServiceIds,
        alreadyCountedDailyServiceIds: after.alreadyCountedDailyServiceIds,
        updatedBy: after.updatedBy,
        updatedAt: after.updatedAt,
        auditId: after.auditId
      })

      transaction.set(audit, {
        actor: admin.uid,
        action: 'entry.update',
        target: id,
        before,
        after,
        createdAt: serverTimestamp()
      })

      return { ok: true }
    })
  }

  async function deleteOperation({ id } = {}) {
    if (
      typeof id !== 'string' ||
      !id ||
      id.includes('/')
    ) {
      throw new Error('Saisie introuvable.')
    }

    const ref = doc(db, 'entries', id)
    const audit = doc(collection(db, 'audit'))

    return runTransaction(db, async transaction => {
      const admin = await readProfile(transaction, true)
      const snapshot = await transaction.get(ref)

      if (!snapshot.exists()) {
        return { ok: true }
      }

      const before = snapshot.data()
      const lockChecks = []

      for (const serviceId of before.newlyCountedDailyServiceIds || []) {
        const lockRef = doc(
          db,
          'dailyLocks',
          `${before.operatorId}_${before.date}_${serviceId}`
        )
        const lockSnapshot = await transaction.get(lockRef)

        lockChecks.push({
          ref: lockRef,
          snapshot: lockSnapshot
        })
      }

      for (const lock of lockChecks) {
        if (
          lock.snapshot.exists() &&
          lock.snapshot.data().operationId === id
        ) {
          transaction.delete(lock.ref)
        }
      }

      transaction.delete(ref)
      transaction.set(audit, {
        actor: admin.uid,
        action: 'entry.delete',
        target: id,
        before,
        after: null,
        createdAt: serverTimestamp()
      })

      return { ok: true }
    })
  }

  // =========================================================
  // TARIFS
  // =========================================================

  async function getPrices() {
    const current = await getDoc(tariffRef)

    if (!current.exists()) {
      return null
    }

    const version = await getDoc(
      doc(
        db,
        'tariffVersions',
        current.data().version
      )
    )

    if (!version.exists()) {
      throw new Error(
        'Version des tarifs introuvable.'
      )
    }

    return version.data().rates
  }

  async function publishPrices(transform) {
    const version = doc(
      collection(db, 'tariffVersions')
    )

    const audit = doc(
      collection(db, 'audit')
    )

    return runTransaction(
      db,
      async transaction => {
        const profile = await readProfile(
          transaction,
          true
        )

        const current = await transaction.get(
          tariffRef
        )

        const previousVersion = current.exists()
          ? await transaction.get(
              doc(
                db,
                'tariffVersions',
                current.data().version
              )
            )
          : null

        const baseRates = previousVersion?.data()?.rates ?? null
        const currentRates = baseRates
          ? { ...initialRates, ...baseRates }
          : null
        const rates = transform(
          currentRates
        )

        if (!rates) {
          return { ok: true }
        }

        if (
          Object.keys(rates).length !== catalog.length ||
          catalog.some(
            service =>
              !Object.hasOwn(rates, service.id) ||
              !validPrice(rates[service.id])
          )
        ) {
          throw new Error(
            'Catalogue de tarifs invalide.'
          )
        }

        const after = {
          version: version.id,
          updatedBy: profile.uid,
          updatedAt: serverTimestamp(),
          auditId: audit.id
        }

        transaction.set(version, {
          rates,
          createdBy: profile.uid,
          createdAt: serverTimestamp()
        })

        transaction.set(
          tariffRef,
          after
        )

        transaction.set(audit, {
          actor: profile.uid,
          action: 'tariff.publish',
          target: 'tariff',
          before: current.data() ?? null,
          after,
          createdAt: serverTimestamp()
        })

        return {
          ok: true
        }
      }
    )
  }

  async function initializePrices() {
    return publishPrices(current =>
      current
        ? null
        : { ...initialRates }
    )
  }

  async function updatePrice({
    id,
    priceCents
  }) {
    if (
      !catalog.some(
        service => service.id === id
      ) ||
      !validPrice(priceCents)
    ) {
      throw new Error(
        'Tarif invalide.'
      )
    }

    return publishPrices(current => {
      if (!current) {
        throw new Error(
          'Initialisez les tarifs avant de les modifier.'
        )
      }

      return {
        ...current,
        [id]: priceCents
      }
    })
  }

  function normalizeService(input) {
    const id = typeof input?.id === 'string' ? input.id.trim().toLowerCase() : ''
    const name = typeof input?.name === 'string' ? input.name.trim() : ''
    const sector = input?.sector
    const kind = input?.kind
    const priceCents = input?.priceCents ?? null
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || !name || name.length > 80 || !['parc', 'atelier'].includes(sector) || !['unit', 'daily'].includes(kind) || !validPrice(priceCents)) {
      throw new Error('Prestation invalide.')
    }
    return { id, name, sector, kind, priceCents }
  }

  async function migrateCatalog() {
    return runTransaction(db, async transaction => {
      const admin = await readProfile(transaction, true)
      const snapshots = []
      for (const service of catalog) snapshots.push(await transaction.get(doc(db, 'services', service.id)))
      catalog.forEach((service, index) => {
        if (snapshots[index].exists()) return
        transaction.set(doc(db, 'services', service.id), {
          name: service.name, sector: service.sector, kind: service.kind,
          priceCents: service.initialPriceCents, createdAt: serverTimestamp(), createdBy: admin.uid
        })
      })
      return { ok: true, count: catalog.length }
    })
  }

  async function saveService(input) {
    const service = normalizeService(input)
    return runTransaction(db, async transaction => {
      const admin = await readProfile(transaction, true)
      const ref = doc(db, 'services', service.id)
      const previous = await transaction.get(ref)
      transaction.set(ref, {
        name: service.name, sector: service.sector, kind: service.kind, priceCents: service.priceCents,
        updatedAt: serverTimestamp(), updatedBy: admin.uid,
        ...(!previous.exists() ? { createdAt: serverTimestamp(), createdBy: admin.uid } : {})
      }, { merge: true })
      return { ok: true, id: service.id }
    })
  }

  async function deleteService({ id } = {}) {
    if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('Prestation invalide.')
    return runTransaction(db, async transaction => {
      await readProfile(transaction, true)
      transaction.delete(doc(db, 'services', id))
      return { ok: true }
    })
  }

  // =========================================================
  // UTILISATEURS
  // =========================================================

  async function updateUser(input) {
    const {
      uid: target,
      name,
      role,
      parc,
      atelier,
      active
    } = input

    if (
      typeof target !== 'string' ||
      !target ||
      target.length > 128 ||
      target.includes('/') ||

      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 80 ||

      !['admin', 'operator'].includes(role) ||

      [parc, atelier, active].some(
        value => typeof value !== 'boolean'
      )
    ) {
      throw new Error(
        'Profil invalide.'
      )
    }

    if (target === uid()) {
      throw new Error(
        'Vous ne pouvez pas modifier votre propre compte.'
      )
    }

    const ref = doc(
      db,
      'users',
      target
    )

    const audit = doc(
      collection(db, 'audit')
    )

    return runTransaction(
      db,
      async transaction => {
        const admin = await readProfile(
          transaction,
          true
        )

        const previous =
          await transaction.get(ref)

        const after = {
          name: name.trim(),

          role,

          parc,

          atelier,

          active,

          ...(previous.data()?.email
            ? {
                email:
                  previous.data().email
              }
            : {}),

          updatedBy: admin.uid,

          updatedAt:
            serverTimestamp(),

          auditId: audit.id
        }

        transaction.set(
          ref,
          after
        )

        transaction.set(audit, {
          actor: admin.uid,

          action: 'user.update',

          target,

          before:
            previous.data() ?? null,

          after,

          createdAt:
            serverTimestamp()
        })

        return {
          ok: true
        }
      }
    )
  }

  return {
    recordOperation,
    updateOperation,
    deleteOperation,
    getPrices,
    initializePrices,
    updatePrice,
    migrateCatalog,
    saveService,
    deleteService,
    updateUser
  }
}
