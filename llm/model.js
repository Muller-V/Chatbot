const { ChatOllama } = require("langchain/chat_models/ollama");
const dotenv = require("dotenv");

dotenv.config();

/**
 * Configuration et initialisation du modèle LLM Ollama
 * Optimisé pour le chatbot BOB avec des paramètres ajustés
 */
const getOllamaModel = () => {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "mistral",
    temperature: 0.5, // Température réduite pour plus de cohérence dans les réponses
    // Paramètres pour améliorer la stabilité et la qualité des réponses
    retry: true,
    maxRetries: 3,
    timeout: 120000, // 2 minutes
    topP: 0.95, // Filtre les tokens de faible probabilité pour maintenir les réponses cohérentes
    cache: true, // Active le cache pour améliorer les performances
    // Instructions spéciales pour le modèle
    systemMessage: "Tu es BOB, l'assistant virtuel Auto Service Pro. Réponds de façon concise, professionnelle mais amicale."
  });
};

module.exports = { getOllamaModel }; 