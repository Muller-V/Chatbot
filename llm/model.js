const { ChatMistralAI } = require("@langchain/mistralai");
require('dotenv').config();

/**
 * Configuration et initialisation du modèle LLM (Mistral AI)
 */
/**
 * Obtient une instance du modèle Mistral AI configurée
 * @returns {ChatMistralAI} Instance du modèle Mistral AI
 */
function getMistralModel() {
  // Vérifier l'environnement pour les paramètres du modèle
  const modelName = process.env.MISTRAL_MODEL || "mistral-small-latest";
  const apiKey = process.env.MISTRAL_API_KEY;
  const temperature = parseFloat(process.env.LLM_TEMPERATURE || "0.1");
  const maxTokens = parseInt(process.env.MAX_TOKENS || "4096");

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is required in environment variables");
  }

  // Créer et configurer le modèle
  const model = new ChatMistralAI({
    apiKey: apiKey,
    model: modelName,
    temperature: temperature,
    maxTokens: maxTokens,
    format: "json"
  });

  console.log(`Modèle LLM initialisé: ${modelName} (température: ${temperature}, max tokens: ${maxTokens}, format: json)`);
  return model;
}

// Pour compatibilité avec l'ancien code
function getOllamaModel() {
  return getMistralModel();
}

module.exports = {
  getOllamaModel,
  getMistralModel,
};