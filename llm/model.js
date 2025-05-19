const { ChatOllama } = require("langchain/chat_models/ollama");
const dotenv = require("dotenv");

dotenv.config();

/**
 * Configuration et initialisation du modèle LLM Ollama
 */
const getOllamaModel = () => {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "mistral",
    temperature: 0.7,
    // Paramètres pour améliorer la stabilité
    retry: true,
    maxRetries: 3,
    timeout: 120000, // 2 minutes
  });
};

module.exports = { getOllamaModel }; 