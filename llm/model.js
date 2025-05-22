const { ChatOllama } = require("langchain/chat_models/ollama");
require('dotenv').config();

/**
 * Configuration et initialisation du modèle LLM (Ollama)
 */
/**
 * Obtient une instance du modèle Ollama configurée
 * @returns {ChatOllama} Instance du modèle Ollama
 */
function getOllamaModel() {
  // Vérifier l'environnement pour les paramètres du modèle
  const modelName = process.env.OLLAMA_MODEL || "mistral";
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const temperature = parseFloat(process.env.LLM_TEMPERATURE || "0.1");
  const timeout = parseInt(process.env.LLM_TIMEOUT || "180000");
  const contextSize = parseInt(process.env.OLLAMA_CONTEXT_SIZE || "8192");

  // Créer et configurer le modèle
  const model = new ChatOllama({
    baseUrl: baseUrl,
    model: modelName,
    temperature: temperature,
    timeout: timeout,
    context: contextSize,
    format: "json"
  });

  console.log(`Modèle LLM initialisé: ${modelName} (température: ${temperature}, contexte: ${contextSize}, format: json)`);
  return model;
}

module.exports = {
  getOllamaModel,
};