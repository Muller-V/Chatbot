/**
 * Auto Service Pro Chatbot - Main entry point
 * Handles API routes and serves the frontend 
 */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const ChatAgent = require('./src/agents/chatAgent');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Configure middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Create a chatbot instance map to handle multiple sessions
const chatbots = new Map();

// Initialize a default chatbot
let defaultChatbot;
(async () => {
  // Créer l'instance de ChatAgent d'abord, puis initialiser
  defaultChatbot = new ChatAgent();
  await defaultChatbot.initialize();
  console.log('Default chatbot initialized');
})();

// API Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    
    // Vérifier si l'agent par défaut existe
    if (!defaultChatbot) {
      defaultChatbot = new ChatAgent();
      await defaultChatbot.initialize();
    }
    
    // Get or create a chatbot for this session
    let chatbot = chatbots.get(sessionId);
    if (!chatbot) {
      chatbot = defaultChatbot;
      chatbots.set(sessionId, chatbot);
    }
    
    // Process the message
    const result = await chatbot.processMessage(message);
    res.json(result);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      botResponse: "Je suis désolé, une erreur est survenue. Comment puis-je vous aider aujourd'hui ?"
    });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    // Vérifier si l'agent par défaut existe
    if (!defaultChatbot) {
      defaultChatbot = new ChatAgent();
      await defaultChatbot.initialize();
    }
    
    // Get chatbot for this session
    let chatbot = chatbots.get(sessionId);
    if (chatbot) {
      chatbot.reset();
    } else {
      chatbot = defaultChatbot;
      chatbots.set(sessionId, chatbot);
    }
    
    res.json({
      success: true,
      botResponse: "Bonjour ! Comment puis-je vous aider avec votre véhicule aujourd'hui ?"
    });
  } catch (error) {
    console.error('Error resetting chatbot:', error);
    res.status(500).json({
      success: false,
      botResponse: "Je suis désolé, une erreur est survenue lors de la réinitialisation."
    });
  }
});

// Ajouter une route d'état pour le chatbot
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

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Auto Service Pro Chatbot running on port ${port}`);
  console.log(`📱 Access the chatbot at http://localhost:${port}`);
}); 