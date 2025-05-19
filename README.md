# Garage Automobile AI Chatbot

Ce projet est un POC (Proof of Concept) d'un chatbot IA agent pour un garage automobile. Il permet de dialoguer naturellement avec les utilisateurs et d'effectuer des actions via API comme proposer des services, des créneaux horaires et réserver des rendez-vous.

## Architecture

- **Backend Node.js**: Orchestrateur d'agent IA avec Express
- **LLM local**: Utilisation d'Ollama (modèle Mistral)
- **LangChain.js**: Framework pour créer l'agent intelligent
- **Backend Symfony**: API REST existante (non incluse dans ce repo)

## Prérequis

- Node.js v16+
- Ollama installé localement (https://ollama.ai/)
- Modèle Mistral ou LLaMA3 chargé dans Ollama

## Installation

1. Cloner le projet
2. Installer les dépendances

```bash
npm install
```

3. Créer un fichier `.env` basé sur `.env.example`
4. Démarrer Ollama en local

```bash
ollama serve
```

5. Vérifier que le modèle Mistral est disponible ou le télécharger

```bash
ollama pull mistral
```

## Démarrage

```bash
npm run dev
```

Le serveur démarrera sur http://localhost:3000

## Endpoints API

- `GET /health`: Vérification de l'état du service
- `POST /chat`: Endpoint principal pour interagir avec le chatbot
  - Body: `{ "message": "Votre message ici" }`
  - Response: `{ "success": true, "botResponse": "Réponse du chatbot" }`

## Structure du projet

- `index.js`: Point d'entrée, serveur Express
- `orchestrator.js`: Configuration de l'agent LangChain
- `tools/garage.js`: Tools/fonctions pour l'agent
- `llm/model.js`: Wrapper pour Ollama

## Exemple d'utilisation

Avec cURL:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Je voudrais faire une révision pour ma voiture"}'
```

## Notes pour le développement

- Pour le POC, des données simulées sont utilisées si l'API Symfony n'est pas disponible
- L'agent est configuré pour être autonome et utiliser les tools appropriés selon le contexte
- La mémoire de conversation est gérée par LangChain pour maintenir le contexte 