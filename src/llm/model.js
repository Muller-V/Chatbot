/**
 * Module for LLM model initialization and configuration
 */
const { Ollama } = require("langchain/llms/ollama");

/**
 * Returns a configured instance of the Ollama model
 * @returns {Ollama} Configured model instance
 */
function getOllamaModel() {
  // Get configuration from environment variables or use defaults
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "mistral";
  const temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || "0.3");
  
  console.log(`🧠 LLM Model initialized: ${model} (${baseUrl})`);
  
  return new Ollama({
    baseUrl: baseUrl,
    model: model,
    temperature: temperature,
    topP: 0.9,
    // Ensure responses are in French with a stronger system directive
    systemPrompt: "Tu es un assistant professionnel de garage automobile. Toutes tes réponses DOIVENT être EN FRANÇAIS EXCLUSIVEMENT. Sois concis, précis et courtois.",
    // Handle potential prompt formatting issues
    formatMessages: (messages) => {
      try {
        // If messages is a promise, resolve it
        if (messages && typeof messages.then === 'function') {
          return messages.then(resolvedMessages => {
            return typeof resolvedMessages === 'string' 
              ? resolvedMessages 
              : JSON.stringify(resolvedMessages);
          });
        }
        
        // Convert object to string if needed
        return typeof messages === 'string' ? messages : JSON.stringify(messages);
      } catch (error) {
        console.error("Error formatting messages:", error);
        return "Tu es un assistant de garage automobile. Réponds en français.";
      }
    }
  });
}

module.exports = { getOllamaModel }; 