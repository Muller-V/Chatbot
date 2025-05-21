
try {
  require('dotenv').config();
  console.log('✅ Variables d\'environnement chargées');
} catch (error) {
  console.log('⚠️ Impossible de charger les variables d\'environnement:', error.message);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { processMessage, resetConversation } = require('./src/index');

const app = express();
const PORT = process.env.PORT || 5001;


app.use(express.json());
app.use(cors());


app.use(express.static(path.join(__dirname, 'public')));


console.log('🔌 Configuration:');
console.log(`- Port: ${PORT}`);
console.log(`- API: ${process.env.API_URL || 'http://localhost:8000'}`);
console.log(`- Ollama: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);


app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Le message est requis'
      });
    }
    
    console.log(`Message reçu: "${message}"`);
    const response = await processMessage(message);
    console.log(`Réponse: "${response.botResponse}"`);
    
    return res.json(response);
  } catch (error) {
    console.error('Erreur lors du traitement du message:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement du message',
      botResponse: "Désolé, une erreur est survenue. Pouvez-vous reformuler votre demande ?"
    });
  }
});


app.post('/api/reset', (req, res) => {
  resetConversation();
  console.log('Conversation réinitialisée');
  return res.json({
    success: true,
    botResponse: "Bonjour ! Comment puis-je vous aider avec votre véhicule aujourd'hui ?"
  });
});


app.get('/api/status', (req, res) => {
  return res.json({
    success: true,
    message: 'Le serveur du chatbot est en ligne',
    config: {
      port: PORT,
      api: process.env.API_URL || 'http://localhost:8000',
      ollama: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    }
  });
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('*', (req, res) => {
  res.redirect('/');
});


app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Interface web disponible sur http://localhost:${PORT}`);
}); 