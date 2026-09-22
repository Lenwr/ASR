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
      (requireAdmin && profile.role !== 'admin')
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
    const entry = validateOperation(input, catalog)

    const operatorId = uid()

    // requestId permet d'éviter une double création
    // si l'utilisateur clique plusieurs fois.
    const id = `${operatorId}_${input.requestId}`

    const ref = doc(db, 'entries', id)

    return runTransaction(db, async transaction => {
      const profile = await readProfile(transaction)

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

      if (!tariff.exists()) {
        throw new Error(
          'Les tarifs doivent être initialisés par un administrateur avant la première saisie.'
        )
      }

      const date = dayKey(new Date())

      // -------------------------------------------------------
      // SERVICES SELECTIONNES
      // -------------------------------------------------------

      const serviceIds = entry.services.map(
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

        // Toutes les activités réalisées sur CE véhicule.
        serviceIds,

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

        tariffVersion: tariff.data().version,

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

        const rates = transform(
          previousVersion?.data()?.rates ?? null
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
    getPrices,
    initializePrices,
    updatePrice,
    updateUser
  }
}