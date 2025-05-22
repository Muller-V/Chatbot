const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ChatAgent = require('./agents/chatAgent');
const { detectConfirmationOrDenial } = require('./utils/messageParser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});

app.use('/api', limiter);

const chatAgents = {};

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Le message est requis' });
    }
    
    if (!chatAgents[sessionId]) {
      console.log(`Creating new chat agent for session ${sessionId}`);
      chatAgents[sessionId] = await new ChatAgent().initialize();
    }
    
    const result = await chatAgents[sessionId].processMessage(message);
    
    res.json(result);
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du traitement de la demande',
      botResponse: "Je suis désolé, une erreur s'est produite. Comment puis-je vous aider ?"
    });
  }
});

app.post('/api/reset', (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    if (chatAgents[sessionId]) {
      chatAgents[sessionId].reset();
      console.log(`Chat session reset: ${sessionId}`);
    }
    
    res.json({ success: true, message: 'Session réinitialisée' });
  } catch (error) {
    console.error('Error resetting chat session:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la réinitialisation de la session' });
  }
});

app.use(express.static('public'));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 