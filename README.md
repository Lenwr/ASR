# Automotive System Repair — Parc & Atelier

Application Vue 3 / Vite / Firebase, en V1 **sans Cloud Functions**.

## Fonctionnement métier

### Parc — prestations unitaires par véhicule
- Jumelage : 3,28 €
- Navette : 4,36 €
- Mise en carburant : 1,18 €
- Convoyeur : 3,28 €
- Emplacement obligatoire.

### Parc — forfait journalier par opérateur
- Chef Navette : 177,80 € / jour
- Inventaire : 177,80 € / jour
- Contrôle : 177,80 € / jour

Une activité au forfait journalier ne compte qu'une seule fois pour un opérateur et une journée, même si elle concerne plusieurs véhicules.

### Atelier — prestations unitaires
- Esthétique complète : 15,80 €
- Loueur : 10,35 €
- VO : 50,00 €

### Atelier — forfaits journaliers administrables
- Entrée de chaîne
- Sortie de chaîne
- Diag
- Pneumatiques
- Contrôle Batterie
- Contrôle esthétique

Les montants de ces forfaits sont à définir depuis **Prestations & tarifs** dans l'espace administrateur.

## Sécurité et rôles

- `operator` : saisie uniquement sur les secteurs autorisés + consultation de ses propres saisies sans montants.
- `admin` : dashboard, historique global, montants, tarifs et gestion des profils.
- Les montants des tarifs ne sont pas lisibles par les opérateurs. Ils ne lisent que l'identifiant de la version tarifaire active nécessaire à la traçabilité historique.
- Les comptes Firebase Authentication sont créés manuellement dans la console Firebase. L'application admin configure ensuite le document `users/{uid}`.

## Installation

```bash
npm install
npm run dev
```

Node 20.19+ recommandé.

## Firebase — étape obligatoire

Le message « Action refusée » apparaît tant que les règles Firestore du dépôt ne sont pas publiées.

```bash
firebase login
firebase use automotive-88ebc
firebase deploy --only firestore:rules,firestore:indexes
```

Aucune Cloud Function n'est nécessaire.

Ensuite, dans l'application avec un compte admin, ouvrir **Prestations & tarifs** puis cliquer sur **Initialiser les tarifs** une seule fois. Cette action crée la première version tarifaire.

## Vérification

```bash
npm test
npm run build
```
# ASR
