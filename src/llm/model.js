/**
 * Module for LLM model initialization and configuration
 */
const { Ollama } = require("langchain/llms/ollama");

/**
 * Returns a configured instance of the Ollama model
 * @returns {Ollama} Configured model instance
 */
function getOllamaModel() {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "mistral";
  const temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || "0.3");
  
  console.log(`🧠 LLM Model initialized: ${model} (${baseUrl})`);
  
  const ollama = new Ollama({
    baseUrl: baseUrl,
    model: model,
    temperature: temperature,
    topP: 0.9,
  });
  
  return ollama;
}

module.exports = { getOllamaModel }; 