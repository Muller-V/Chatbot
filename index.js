const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { processMessage } = require("./orchestrator");

// Chargement des variables d'environnement
dotenv.config();

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Route de santé
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Garage AI Chatbot API is running" });
});

// Route principale pour le chat
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    
    // Validation basique
    if (!message || typeof message !== "string") {
      return res.status(400).json({ 
        success: false, 
        error: "Le message est requis et doit être une chaîne de caractères" 
      });
    }
    
    // Traitement du message par l'orchestrateur
    const response = await processMessage(message);
    
    // Retour de la réponse
    res.status(200).json(response);
  } catch (error) {
    console.error("Erreur dans le traitement de la requête:", error);
    res.status(500).json({
      success: false,
      error: "Une erreur est survenue lors du traitement de votre demande"
    });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🤖 Garage AI Chatbot API running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/chat (POST)`);
}); 