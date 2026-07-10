# Montexto

Application dashboard d'envoi de SMS multicanal, inspirée de LeTexto.

## Stack

- **Frontend** : React + Vite + TailwindCSS + Recharts + Lucide React
- **Backend** : Node.js + Express + SQLite + Twilio
- **Authentification** : JWT

## Prérequis

- Node.js 18+
- Compte Twilio (optionnel pour l'envoi réel)

## Installation

```bash
# Backend
cd backend
npm install
node scripts/seed.js

# Frontend (nouveau terminal)
cd frontend
npm install
```

## Configuration Twilio

Editer `backend/.env` :

```env
TWILIO_ACCOUNT_SID=votre_account_sid
TWILIO_AUTH_TOKEN=votre_auth_token
TWILIO_PHONE_NUMBER=votre_numero_twilio
```

Sans ces variables, les SMS seront **simulés** (pas d'envoi réel).

## Lancement

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:3001

## Compte de démo

- Email : `demo@montexto.com`
- Mot de passe : `demo123`

## Fonctionnalités

- Tableau de bord avec statistiques SMS et historique de rechargement
- Création et envoi de campagnes SMS (groupes ou numéros manuels)
- Gestion des groupes de contacts
- Gestion des contacts avec import multiple
- Catalogue de modèles de messages
- Génération de clés API
- Page de statistiques avec graphique
