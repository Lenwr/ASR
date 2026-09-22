# Audit et mise à jour — 22 septembre 2026

## Diagnostic de l'écran fourni

Le dashboard affiche « Action refusée » parce que le code tente de lire les saisies Firestore alors que les règles actuellement publiées ne correspondent pas au nouveau schéma. Les messages `contentscript.js`, `ObjectMultiplex` et `MaxListenersExceededWarning` visibles dans Chrome proviennent d'extensions du navigateur et ne sont pas la cause de l'erreur applicative.

## Architecture corrigée : sans Cloud Functions

La V1 utilise désormais uniquement Firebase Authentication + Firestore. Le dossier `functions/` a été retiré. Les opérations, profils et tarifs sont écrits avec des transactions Firestore côté client, puis contrôlés par `firestore.rules`.

Les tarifs financiers restent réservés à l'administrateur. Un opérateur peut lire `settings/tariff`, qui ne contient que l'identifiant de la version active, mais il ne peut pas lire `tariffVersions`, qui contient les montants. Chaque opération conserve l'identifiant de sa version tarifaire afin que les changements futurs ne modifient pas l'historique financier.

## Règles métier intégrées

Parc unitaire : Jumelage 3,28 €, Navette 4,36 €, Mise en carburant 1,18 €, Convoyeur 3,28 €. Un véhicule et un emplacement Parc sont obligatoires.

Parc journalier : Chef Navette, Inventaire et Contrôle à 177,80 € par activité. Le verrou `dailyLocks` empêche l'application d'enregistrer deux fois la même activité pour le même opérateur et le même jour.

Atelier unitaire : Esthétique complète 15,80 €, Loueur 10,35 €, VO 50,00 €.

Atelier journalier : Entrée de chaîne, Sortie de chaîne, Diag, Pneumatiques, Contrôle Batterie et Contrôle esthétique. Les tarifs sont volontairement laissés à définir et sont modifiables dans l'espace admin.

## Administration

Le cahier des charges est revenu à deux rôles : `operator` et `admin`. Les statistiques et montants sont admin uniquement. L'écran **Prestations & tarifs** permet d'initialiser le catalogue puis de modifier tous les prix, y compris les forfaits journaliers Atelier. Chaque publication crée une nouvelle version tarifaire et une trace d'audit.

La création du compte Authentication reste manuelle dans Firebase Console en V1. L'admin peut ensuite créer/modifier le profil Firestore à partir de l'UID sans Cloud Function.

## Déploiement nécessaire

Publier les règles et index avant de tester les écrans authentifiés :

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Puis ouvrir **Prestations & tarifs** et cliquer sur **Initialiser les tarifs**. Sans cette initialisation, les saisies sont volontairement bloquées afin qu'aucune opération ne soit enregistrée sans version tarifaire.

## Vérification locale

Les 9 tests métier Node passent après la mise à jour. Le build Vite n'a pas pu être relancé dans l'environnement d'audit car le `node_modules` contenu dans l'archive est incomplet et ne contient pas le binaire Vite. Sur le poste de développement, exécuter `npm install` puis `npm run build`.
