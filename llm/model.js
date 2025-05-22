const { ChatOllama } = require("langchain/chat_models/ollama");
const dotenv = require("dotenv");

dotenv.config();

const getOllamaModel = () => {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "mistral",
    temperature: 0.5,
    retry: true,
    maxRetries: 3,
    timeout: 120000,
    topP: 0.95,
    cache: true,
    systemMessage: "Tu es BOB, l'assistant virtuel Auto Service Pro. Réponds de façon concise, professionnelle mais amicale."
  });
};

module.exports = { getOllamaModel };