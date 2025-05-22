/**
 * Auto Service Pro Chatbot - Point d'entrée principal
 * Gère les routes API et sert le frontend
 */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const ChatAgent = require('./src/agents/chatAgent');
const ResponseParser = require('./src/utils/responseParser');

// Créer l'application Express
const app = express();
const port = process.env.PORT || 3000;

// Configurer les middlewares
app.use(bodyParser.json());
app.use(express.static('public'));

// Créer une map d'instances de chatbot pour gérer plusieurs sessions
const chatbots = new Map();

// Initialiser un chatbot par défaut
let defaultChatbot;
(async () => {
  defaultChatbot = new ChatAgent();
  await defaultChatbot.initialize();
  console.log('Chatbot par défaut initialisé');
})();

/**
 * Obtient ou crée un agent de chat pour la session spécifiée
 * @param {string} sessionId - Identifiant de session
 * @returns {Promise<ChatAgent>} Instance de l'agent de chat
 */
async function getChatbotForSession(sessionId = 'default') {
  let chatbot = chatbots.get(sessionId);
  
  if (!chatbot) {
    // Créer une nouvelle instance pour cette session
    chatbot = new ChatAgent();
    await chatbot.initialize();
    chatbots.set(sessionId, chatbot);
    console.log(`Nouvel agent créé pour la session ${sessionId}`);
  }
  
  return chatbot;
}

// Routes API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        botResponse: "Aucun message fourni."
      });
    }
    
    // Obtenir l'agent de chat pour cette session
    const chatbot = await getChatbotForSession(sessionId);
    
    // Traiter le message
    const result = await chatbot.processMessage(message);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors du traitement du message:', error);
    res.status(500).json({
      success: false,
      botResponse: "Je suis désolé, une erreur est survenue. Comment puis-je vous aider aujourd'hui?",
      processState: { currentStep: 1 }
    });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    // Obtenir l'agent de chat pour cette session
    const chatbot = await getChatbotForSession(sessionId);
    
    // Réinitialiser l'état de la conversation
    chatbot.state.reset();
    
    // Retourner un message de bienvenue
    res.json({
      success: true,
      botResponse: "Bonjour ! Je suis BOB, votre assistant de réservation auto. Comment puis-je vous aider aujourd'hui?",
      processState: { currentStep: 1 }
    });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du chatbot:', error);
    res.status(500).json({
      success: false,
      botResponse: "Je suis désolé, une erreur est survenue lors de la réinitialisation.",
      processState: { currentStep: 1 }
    });
  }
});

// Route de statut pour vérifier que le serveur est en ligne
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Le serveur du chatbot est en ligne',
    config: {
      port: port,
      api: process.env.API_URL || 'http://localhost:8000'
    }
  });
});

// Servir le frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`🚗 Auto Service Pro Chatbot démarré sur le port ${port}`);
  console.log(`📱 Accédez au chatbot à l'adresse http://localhost:${port}`);
}); 