# PROMPT — Développement Frontend complet d'une application Web de gestion des absences

## 1. Rôle

Tu es un développeur Frontend senior spécialisé en :

- React
- TypeScript
- Vite
- Tailwind CSS
- UX/UI
- applications SaaS
- interfaces responsives
- gestion d'état côté client
- intégration d'API REST

Tu dois développer **uniquement le frontend** d'une application web professionnelle de gestion des présences et absences des étudiants.

Le frontend doit être conçu pour communiquer ultérieurement avec une API REST backend.

**Ne développe aucun backend.**

Ne crée pas de serveur Express, de base de données ou de logique serveur.

---

# 2. Objectif de l'application

L'application permet à un établissement scolaire ou universitaire de gérer les présences et absences des étudiants.

Le frontend doit permettre de :

- se connecter ;
- consulter un dashboard ;
- gérer les classes ;
- consulter les étudiants ;
- importer des listes Excel ;
- créer et consulter des cours ;
- effectuer une prise de présence ;
- identifier les absents ;
- déclencher l'action d'envoi des notifications SMS via l'API backend ;
- consulter l'historique ;
- consulter le statut des SMS ;
- rechercher et filtrer les données.

---

# 3. Stack obligatoire

Utiliser :

```text
React
TypeScript
Vite
Tailwind CSS
React Router
Axios
TanStack Query
React Hook Form
Zod
SheetJS (xlsx)
```

Pour les icônes :

```text
Lucide React
```

Ne pas utiliser une bibliothèque UI complète qui impose son propre design system.

Construire les composants avec Tailwind CSS.

---

# 4. Architecture frontend

Créer :

```text
frontend/
│
├── public/
│
├── src/
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── schemas/
│   ├── types/
│   ├── utils/
│   ├── routes/
│   ├── constants/
│   ├── App.tsx
│   └── main.tsx
│
├── .env
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── README.md
```

---

# 5. Design général

Créer une interface :

- moderne ;
- professionnelle ;
- sobre ;
- claire ;
- rapide ;
- responsive ;
- accessible ;
- adaptée à un établissement scolaire/universitaire.

L'interface ne doit pas avoir un aspect "template généré par IA".

Éviter :

- gradients excessifs ;
- animations inutiles ;
- cartes partout ;
- couleurs criardes ;
- ombres trop fortes ;
- textes gigantesques ;
- effets glassmorphism inutiles.

Privilégier :

- espace blanc ;
- grille cohérente ;
- typographie lisible ;
- bordures légères ;
- hiérarchie visuelle forte ;
- boutons clairement identifiables ;
- tableaux professionnels.

---

# 6. Palette visuelle

Utiliser une palette professionnelle.

```text
Primary
#2563EB

Primary dark
#1D4ED8

Background
#F8FAFC

Surface
#FFFFFF

Text primary
#0F172A

Text secondary
#64748B

Border
#E2E8F0

Success
#16A34A

Warning
#D97706

Danger
#DC2626
```

Ne pas utiliser toutes les couleurs simultanément.

La couleur primaire doit être utilisée principalement pour :

- actions principales ;
- liens ;
- éléments actifs ;
- indicateurs importants.

---

# 7. Typographie

Utiliser une police moderne et lisible.

Préférer :

```text
Inter
```

Hiérarchie :

```text
H1 → 28-32px
H2 → 22-24px
H3 → 18-20px
Body → 14-16px
Small → 12-13px
```

---

# 8. Layout principal

Créer un layout dashboard :

```text
┌───────────────────────────────────────────────────────────┐
│ Sidebar              │ Topbar                             │
│                      ├────────────────────────────────────┤
│ Dashboard            │                                    │
│ Classes              │                                    │
│ Étudiants            │         CONTENU                    │
│ Cours                │                                    │
│ Présences            │                                    │
│ Notifications        │                                    │
│ Historique           │                                    │
│                      │                                    │
│ Paramètres           │                                    │
└───────────────────────────────────────────────────────────┘
```

## Sidebar desktop

Menu :

```text
Dashboard
Classes
Étudiants
Cours
Présences
Notifications
Historique
Paramètres
```

En bas :

```text
Utilisateur
Rôle
Déconnexion
```

## Mobile

Transformer la sidebar en :

```text
Drawer
```

ou navigation mobile adaptée.

---

# 9. Routes frontend

Créer :

```text
/login

/dashboard

/classes

/classes/:id

/classes/:id/students

/students

/students/:id

/courses

/courses/:id

/attendance

/notifications

/history

/settings
```

Créer une protection des routes privées.

---

# 10. Page Login

Créer une page de connexion professionnelle.

```text
┌────────────────────────────────────┐
│                                    │
│         LOGO / NOM APPLICATION     │
│                                    │
│       Gestion des absences         │
│                                    │
│ Email                              │
│ [____________________________]     │
│                                    │
│ Mot de passe                       │
│ [____________________________]     │
│                                    │
│          [ Se connecter ]           │
│                                    │
└────────────────────────────────────┘
```

Fonctionnalités :

- validation ;
- affichage erreur ;
- loading ;
- bouton désactivé pendant l'envoi ;
- mot de passe visible/masqué.

---

# 11. Dashboard

Créer un dashboard professionnel.

## Statistiques

Afficher :

```text
Classes
Étudiants
Absences aujourd'hui
SMS envoyés
SMS échoués
```

Exemple :

```text
┌──────────────┐
│ 12 Classes   │
│ +2 ce mois   │
└──────────────┘
```

## Section absences récentes

Table :

```text
Étudiant
Classe
Cours
Date
Heure
Statut
```

## Section notifications

Afficher :

```text
SMS envoyé
SMS échoué
SMS en attente
```

## Graphique

Créer un graphique simple :

```text
Présence / Absence
```

Ne pas surcharger le dashboard.

---

# 12. Gestion des classes

Page :

```text
/classes
```

Afficher :

```text
Classes
[ Rechercher... ]

[ + Nouvelle classe ]

--------------------------------------------------
Classe       Année       Étudiants      Actions
--------------------------------------------------
L2 RT        2026-2027   45             ...
L1 RT        2026-2027   52             ...
L3 RT        2026-2027   38             ...
--------------------------------------------------
```

Actions :

```text
Voir
Modifier
Supprimer
```

---

# 13. Création d'une classe

Modal ou page :

```text
Nom de la classe
[________________]

Année académique
[________________]

[ Annuler ] [ Créer ]
```

Validation avec Zod.

---

# 14. Page détail classe

```text
/classes/:id
```

Afficher :

```text
L2 Réseaux & Télécommunications

45 étudiants

[ Importer Excel ]
[ Ajouter étudiant ]
```

Sections :

```text
Étudiants
Cours récents
Statistiques de présence
```

---

# 15. Gestion des étudiants

Table professionnelle :

```text
┌────────────────────────────────────────────────────────┐
│ Étudiants                         [ Ajouter étudiant ] │
│                                                        │
│ [ Rechercher un étudiant... ]                          │
│                                                        │
│ Nom       Prénom       Téléphone       Classe          │
│ KOUASSI   Jean         0700000000      L2 RT           │
│ YAO       Marie        0500000000      L2 RT           │
│ TRAORE    Ibrahim      0100000000      L2 RT           │
└────────────────────────────────────────────────────────┘
```

Fonctionnalités :

- recherche ;
- pagination ;
- filtre classe ;
- modification ;
- suppression ;
- consultation historique.

---

# 16. Import Excel

Créer un composant :

```text
ExcelImporter
```

Utiliser :

```text
SheetJS
```

## Interface

```text
┌──────────────────────────────────────────┐
│ Importer les étudiants                   │
│                                          │
│ Glissez votre fichier Excel ici          │
│ ou                                       │
│ [ Choisir un fichier ]                   │
│                                          │
│ Formats acceptés : .xlsx, .xls           │
│                                          │
│ [ Télécharger le modèle ]                │
└──────────────────────────────────────────┘
```

Après sélection :

```text
Fichier détecté
students.xlsx

125 lignes détectées
```

---

# 17. Prévisualisation Excel

Avant l'import :

```text
┌───────────────────────────────────────────────────────┐
│ Prévisualisation                                      │
├──────────┬──────────┬─────────────────┬───────────────┤
│ Nom      │ Prénom   │ Téléphone       │ Statut        │
├──────────┼──────────┼─────────────────┼───────────────┤
│ KOUASSI  │ Jean     │ 0700000000      │ Valide        │
│ YAO      │ Marie    │ 0500000000      │ Valide        │
│ TRAORE   │ Ibrahim  │ 0100000000      │ Invalide      │
└──────────┴──────────┴─────────────────┴───────────────┘
```

Afficher clairement les erreurs.

Exemple :

```text
Ligne 3
Numéro de téléphone invalide
```

Boutons :

```text
[ Annuler ]
[ Importer 124 étudiants ]
```

---

# 18. Ajouter un étudiant

Formulaire :

```text
Nom
Prénom
Téléphone
Classe
```

Validation :

```text
Nom obligatoire
Prénom obligatoire
Téléphone obligatoire
Classe obligatoire
```

---

# 19. Gestion des cours

Page :

```text
/courses
```

Afficher :

```text
Cours
[ + Nouveau cours ]

Matière
Classe
Enseignant
Date
Heure
Statut
```

---

# 20. Création d'un cours

Formulaire :

```text
Classe
[ L2 RT ▼ ]

Matière
[ Réseaux informatiques ]

Date
[ 13/09/2026 ]

Heure début
[ 08:00 ]

Heure fin
[ 10:00 ]

[ Créer le cours ]
```

---

# 21. Prise de présence

C'est l'écran principal de l'application.

Créer :

```text
/attendance
```

Interface :

```text
Prise de présence

Classe
[ L2 RT ▼ ]

Cours
[ Réseaux informatiques ▼ ]

Date
[ 13/09/2026 ]

Heure
[ 08:00 ]

──────────────────────────────────────────────

Étudiant          Présent   Absent   Retard
------------------------------------------------
KOUASSI Jean        ●
YAO Marie                     ●
TRAORE Ibrahim      ●
DIALLO Aminata                          ●

──────────────────────────────────────────────

45 étudiants
40 présents
4 absents
1 retard

[ Enregistrer les présences ]
```

---

# 22. UX de la prise de présence

Optimiser l'écran pour une utilisation rapide.

Prévoir :

```text
Présent par défaut
```

avec possibilité de changer rapidement :

```text
Présent
Absent
Retard
Justifié
```

Utiliser des boutons ou segmented controls plutôt que des cases à cocher ambiguës.

Ajouter :

```text
[ Tout présent ]
```

Permettre de rechercher un étudiant.

---

# 23. Confirmation des absences

Après enregistrement :

```text
3 étudiants absents

Jean KOUASSI
Marie YAO
Ibrahim TRAORE

Les contacts associés seront notifiés.

[ Annuler ]
[ Envoyer les notifications ]
```

Le frontend ne doit pas appeler directement le fournisseur SMS.

Il doit appeler uniquement l'API backend prévue pour cela.

---

# 24. Notifications SMS

Page :

```text
/notifications
```

Table :

```text
Étudiant
Téléphone
Message
Date
Statut
Action
```

Statuts visuels :

```text
SENT
→ badge vert

PENDING
→ badge orange

FAILED
→ badge rouge
```

Pour les échecs :

```text
[ Réessayer ]
```

---

# 25. Historique

Page :

```text
/history
```

Créer des filtres :

```text
Classe
Étudiant
Date
Statut
Type
```

Afficher :

```text
Date
Étudiant
Classe
Cours
Statut présence
Notification
```

---

# 26. Page détail étudiant

```text
/students/:id
```

Afficher :

```text
Jean KOUASSI
L2 Réseaux & Télécommunications
0700000000
```

Puis :

```text
Statistiques

Présences
Absences
Retards
Taux de présence
```

Et historique :

```text
Date | Cours | Statut | Notification
```

---

# 27. Composants réutilisables

Créer au minimum :

```text
Button
Input
Select
Modal
Dialog
Table
Pagination
Badge
Card
Dropdown
Toast
Tabs
DatePicker
SearchInput
EmptyState
LoadingState
ErrorState
ConfirmDialog
Sidebar
Topbar
Avatar
StatCard
```

Ne pas dupliquer le même composant dans plusieurs pages.

---

# 28. Gestion des données

Utiliser TanStack Query.

Créer les hooks :

```text
useClasses()
useClass()
useStudents()
useStudent()
useCourses()
useCourse()
useAttendance()
useNotifications()
useHistory()
```

Pour les mutations :

```text
useCreateClass()
useUpdateClass()
useDeleteClass()

useCreateStudent()
useUpdateStudent()
useDeleteStudent()

useCreateCourse()

useSaveAttendance()

useSendNotifications()
useRetryNotification()
```

---

# 29. API frontend

Créer :

```text
src/services/api.ts
```

Configurer Axios :

```text
baseURL = import.meta.env.VITE_API_URL
```

Exemple :

```env
VITE_API_URL=http://localhost:5000/api
```

Ne jamais écrire en dur l'URL de l'API dans les composants.

---

# 30. Services

Créer :

```text
auth.service.ts
class.service.ts
student.service.ts
course.service.ts
attendance.service.ts
notification.service.ts
```

Exemple conceptuel :

```text
classService.getClasses()
classService.createClass()

studentService.getStudents()
studentService.importStudents()

attendanceService.saveAttendance()

notificationService.sendNotifications()
```

---

# 31. Types TypeScript

Créer des types centralisés :

```text
User
Class
Student
Course
Attendance
AttendanceStatus
Notification
NotificationStatus
DashboardStats
```

Exemple :

```typescript
type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "JUSTIFIED";
```

Éviter `any`.

---

# 32. Auth côté frontend

Créer :

```text
AuthContext
```

ou une architecture équivalente.

Gérer :

```text
user
token
login
logout
isAuthenticated
```

Créer :

```text
ProtectedRoute
```

Si l'utilisateur n'est pas authentifié :

```text
→ /login
```

---

# 33. Loading states

Chaque requête doit avoir un état de chargement.

Exemple :

```text
Skeleton
```

plutôt qu'une page vide.

Pour les actions :

```text
Enregistrement...
Importation...
Envoi...
Suppression...
```

Le bouton doit être désactivé pendant l'opération.

---

# 34. Empty states

Exemple :

```text
Aucun étudiant

Cette classe ne contient encore aucun étudiant.

[ Importer Excel ]
```

Ne jamais afficher simplement une table vide.

---

# 35. Error states

Exemple :

```text
Impossible de charger les étudiants.

[ Réessayer ]
```

Les erreurs techniques ne doivent pas être directement affichées à l'utilisateur.

---

# 36. Notifications UI

Utiliser des Toasts pour :

```text
Classe créée
Étudiant supprimé
Import terminé
Présences enregistrées
SMS envoyé
Erreur lors de l'envoi
```

---

# 37. Responsive Design

L'application doit fonctionner sur :

```text
Mobile
Tablet
Laptop
Desktop
```

Breakpoints :

```text
sm
md
lg
xl
```

Sur mobile :

- sidebar → drawer ;
- tables → scroll horizontal ou cards adaptées ;
- boutons → largeur suffisante ;
- formulaires → une colonne ;
- dashboard → cards empilées.

La page de prise de présence doit être particulièrement optimisée pour mobile.

---

# 38. Accessibilité

Respecter :

- labels explicites ;
- contraste suffisant ;
- navigation clavier ;
- focus visible ;
- boutons accessibles ;
- `aria-label` lorsque nécessaire ;
- messages d'erreur associés aux champs.

Ne pas utiliser uniquement la couleur pour indiquer un statut.

---

# 39. Animations

Utiliser très peu d'animations.

Autorisé :

```text
hover
transition
fade léger
drawer
modal
skeleton
```

Interdit :

- animations permanentes ;
- éléments qui bougent inutilement ;
- transitions longues ;
- effets décoratifs qui ralentissent l'interface.

---

# 40. Sécurité frontend

Ne jamais stocker :

```text
SMS_API_KEY
SMS_SECRET
DATABASE_URL
JWT_SECRET
```

dans le frontend.

Le frontend ne possède aucune clé secrète du backend.

Utiliser uniquement :

```env
VITE_API_URL=
```

pour l'URL publique de l'API.

---

# 41. Mock API pour le développement frontend

Comme le backend n'est pas développé dans cette tâche, créer une couche permettant de travailler avec des données fictives.

Architecture :

```text
components
    ↓
hooks
    ↓
services
    ↓
API adapter
    ↓
Mock API / Real API
```

Prévoir un mode :

```env
VITE_USE_MOCK_API=true
```

Le mode mock doit être facilement désactivable.

Les mocks ne doivent pas être mélangés directement aux composants UI.

---

# 42. Données de démonstration

Créer suffisamment de données fictives pour tester :

```text
5 classes
100+ étudiants
plusieurs cours
présences
absences
retards
notifications
```

Les données doivent ressembler à de vraies données mais ne doivent utiliser aucune donnée personnelle réelle.

---

# 43. Gestion de l'import Excel

Le frontend doit gérer :

```text
Fichier vide
Mauvais format
Colonnes manquantes
Téléphone invalide
Nom manquant
Prénom manquant
Doublons
Fichier trop volumineux
```

Afficher des messages précis.

---

# 44. Performance

Optimiser :

- pagination ;
- recherche avec debounce ;
- lazy loading des pages ;
- composants réutilisables ;
- images optimisées ;
- éviter les rerenders inutiles ;
- TanStack Query pour le cache.

Ne pas charger tous les étudiants si la classe contient plusieurs milliers de lignes.

---

# 45. Architecture des features

Organiser les fonctionnalités :

```text
features/
├── auth/
├── dashboard/
├── classes/
├── students/
├── courses/
├── attendance/
├── notifications/
└── history/
```

Chaque feature peut contenir :

```text
components/
hooks/
services/
types/
schemas/
```

---

# 46. Exemple de structure

```text
features/
└── attendance/
    ├── components/
    │   ├── AttendanceTable.tsx
    │   ├── AttendanceFilters.tsx
    │   └── AttendanceSummary.tsx
    │
    ├── hooks/
    │   └── useAttendance.ts
    │
    ├── schemas/
    │   └── attendance.schema.ts
    │
    ├── services/
    │   └── attendance.service.ts
    │
    └── types/
        └── attendance.types.ts
```

---

# 47. Gestion des permissions UI

L'interface doit tenir compte des rôles :

```text
ADMIN
TEACHER
```

Exemple :

```text
ADMIN
→ Paramètres utilisateurs
→ Toutes les classes

TEACHER
→ Ses classes
→ Présences
→ Notifications
```

Ne considérer cette logique que comme une couche UX.

La vraie sécurité sera assurée par le backend.

---

# 48. Tests frontend

Tester au minimum :

```text
Login
ProtectedRoute
Classes
Students
Excel import
Course creation
Attendance
Notifications
Filters
Responsive layout
```

Cas critiques :

```text
Import Excel invalide
Aucun étudiant
API indisponible
SMS échoué
Double clic
Session expirée
```

---

# 49. README frontend

Créer un README contenant :

```text
Présentation
Stack
Installation
Variables d'environnement
Lancement
Structure du projet
Mode mock
Connexion API backend
Build production
```

Commandes :

```bash
npm install
npm run dev
npm run build
npm run preview
```

---

# 50. Critères d'acceptation

Le frontend est considéré comme terminé lorsque le parcours suivant est entièrement fonctionnel en mode mock :

```text
Login
  ↓
Dashboard
  ↓
Classes
  ↓
Classe
  ↓
Étudiants
  ↓
Import Excel
  ↓
Cours
  ↓
Prise de présence
  ↓
Absences
  ↓
Notifications
  ↓
Historique
```

Chaque écran doit :

- fonctionner ;
- être responsive ;
- gérer loading ;
- gérer erreur ;
- gérer état vide ;
- avoir une UX cohérente.

---

# 51. Règles importantes

Ne fais pas :

```text
❌ backend dans React
❌ clé API SMS dans le frontend
❌ données hardcodées dans les composants
❌ énorme composant App.tsx
❌ duplication de composants
❌ any partout
❌ pages sans loading/error state
❌ tableaux non responsive
❌ logique métier dispersée
```

Faire :

```text
✓ composants réutilisables
✓ TypeScript strict
✓ services séparés
✓ hooks dédiés
✓ schemas Zod
✓ TanStack Query
✓ responsive design
✓ architecture feature-first
✓ mock API isolée
✓ code maintenable
```

---

# 52. Méthode de développement

Développer dans cet ordre :

```text
1. Initialisation Vite
2. Tailwind
3. Routing
4. Layout
5. Design system
6. Login
7. Dashboard
8. Classes
9. Étudiants
10. Import Excel
11. Cours
12. Présences
13. Notifications
14. Historique
15. Responsive
16. Gestion des erreurs
17. Tests
18. Optimisation
19. Build production
```

Pour chaque étape :

```text
- créer les fichiers nécessaires ;
- écrire le code complet ;
- connecter les composants ;
- tester le comportement ;
- corriger les erreurs ;
- ne pas laisser de TODO critiques.
```

---

# 53. Résultat attendu

À la fin, fournir un frontend complet avec :

```text
React
+
TypeScript
+
Tailwind
+
Routing
+
Dashboard
+
Authentication UI
+
Classes
+
Étudiants
+
Excel Import
+
Cours
+
Présences
+
Notifications
+
Historique
+
Responsive Design
+
Mock API
+
Architecture prête pour backend
```

Le résultat doit ressembler à une véritable application SaaS prête à être connectée à une API REST, et non à une simple démonstration visuelle.

Le backend sera développé séparément et devra pouvoir remplacer la couche Mock API sans nécessiter de réécriture des composants d'interface.