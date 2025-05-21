/**
 * Module pour initialiser le modèle LLM
 */
const { Ollama } = require("langchain/llms/ollama");

/**
 * Retourne une instance du modèle Ollama configurée
 * @returns {Ollama} Instance du modèle
 */
function getOllamaModel() {
  // Récupérer la configuration depuis les variables d'environnement ou utiliser des valeurs par défaut
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "mistral";
  const temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || "0.3");
  
  console.log(`🧠 Modèle LLM: ${model} (${baseUrl})`);
  
  // Gérer l'erreur "cannot unmarshal object into Go struct field GenerateRequest.prompt of type string"
  // Cette erreur se produit lorsque le prompt envoyé à Ollama n'est pas une chaîne de caractères
  return new Ollama({
    baseUrl: baseUrl,
    model: model,
    temperature: temperature,
    topP: 0.9,
    // Renforcer les instructions pour forcer les réponses en français
    systemPrompt: "Tu es un agent de garage automobile français. TU DOIS RÉPONDRE EXCLUSIVEMENT EN FRANÇAIS sans aucune exception. N'utilise JAMAIS l'anglais. Réponds de manière claire, précise et concise, en français uniquement, comme un agent de garage professionnel. Évite les explications inutiles. Sois direct et courtois. Si tu réponds en anglais, tu ne seras pas utile.",
    // Spécifier le formateur pour s'assurer que le prompt soit toujours une chaîne de caractères
    formatMessages: async (messages) => {
      try {
        // Vérifier si messages est une promesse
        if (typeof messages === 'object' && messages.then) {
          messages = await messages;
        }
        
        // S'assurer que le prompt est une chaîne de caractères
        if (typeof messages === 'object') {
          return JSON.stringify(messages);
        }
        
        if (typeof messages !== 'string') {
          return `Tu es un agent de garage automobile. L'utilisateur demande: ${messages}`;
        }
        
        return messages;
      } catch (error) {
        console.error("Erreur lors du formatage des messages:", error);
        return "Tu es un agent de garage automobile. Réponds en français uniquement.";
      }
    }
  });
}

module.exports = { getOllamaModel }; 