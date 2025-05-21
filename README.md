# Auto Service Pro - Chatbot de Réservation

Un chatbot intelligent utilisant un modèle LLM pour faciliter la prise de rendez-vous dans un garage automobile.

## 🚀 Fonctionnalités

- Identification du véhicule utilisateur via sa plaque d'immatriculation
- Sélection du service/opération à effectuer
- Suggestion des garages les plus proches
- Choix des créneaux de rendez-vous disponibles
- Confirmation et récapitulatif de la réservation

## 📋 Workflow de réservation

1. **Identification du véhicule** - Récupération des informations via la plaque d'immatriculation
2. **Sélection du service** - Choix parmi les opérations disponibles
3. **Choix du garage** - Suggestion basée sur la localisation de l'utilisateur
4. **Sélection de créneau** - Propositions de créneaux disponibles
5. **Confirmation** - Récapitulatif et validation finale

## 🛠️ Technologies

- Node.js avec Express
- LangChain pour la gestion du LLM
- Ollama comme backend LLM (modèle Mistral)
- Interface utilisateur responsive en HTML/CSS/JS

## 🔧 Installation

1. Clonez le dépôt
```bash
git clone https://github.com/votre-utilisateur/auto-service-pro-chatbot.git
cd auto-service-pro-chatbot
```

2. Installez les dépendances
```bash
npm install
```

3. Configurez les variables d'environnement en créant un fichier `.env`
```
PORT=3000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
OLLAMA_TEMPERATURE=0.3
API_URL=http://localhost:8000
```

4. Démarrez Ollama (si installé localement)
```bash
ollama run mistral
```

5. Lancez l'application
```bash
npm start
```

## 📡 API Backend

Le chatbot interagit avec une API backend qui fournit les données suivantes:

- **VehiculeController**: 
  - `GET /api/vehicules/{immatriculation}` - Infos sur un véhicule via sa plaque

- **OperationController**:
  - `GET /api/operations/` - Liste des opérations disponibles
  - `GET /api/operations/{categoryId}` - Opérations par catégorie

- **OperationCategoryController**:
  - `GET /api/operations/category` - Liste des catégories d'opérations

- **GarageController**:
  - `GET /api/garages` - Liste des garages
  - `GET /api/garages?latitude=...&longitude=...` - Garages à proximité

- **AppointmentController**:
  - `GET /api/appointments/avaibilities` - Créneaux disponibles

## 🧠 Prompt Engineering

Le système utilise un prompt soigneusement construit pour garantir des réponses cohérentes en français, avec une attention particulière à:

- Respect strict du workflow de réservation
- Vérification/validation à chaque étape
- Réponses courtes et précises
- Gestion de la frustration/urgence utilisateur

## 📱 Interface utilisateur

L'interface propose:
- Une conversation fluide avec l'assistant
- Des suggestions rapides adaptées à chaque étape
- Un indicateur de progression visuel
- La possibilité de réinitialiser la conversation

## 🧪 Mode de test

Le système fonctionne même sans connexion API backend, en utilisant des données simulées pour permettre les tests.

## 💻 Développement

Pour lancer en mode développement avec redémarrage automatique:
```bash
npm run dev
```

## 📄 Licence

MIT

## 👥 Contributeurs

- Votre Nom (@votre-nom) 