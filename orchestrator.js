const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { ConversationChain } = require("langchain/chains");
const { BufferMemory } = require("langchain/memory");
const { PromptTemplate } = require("langchain/prompts");
const { getOllamaModel } = require("./llm/model");
const { listServicesTools, getAvailableSlotsTools, bookSlotTools } = require("./tools/garage");
const { SYSTEM_TEMPLATE } = require("./src/config/constants");

/**
 * Configuration du système de mémoire pour l'agent
 */
const memory = new BufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
});

/**
 * Initialisation de l'agent avec ses outils
 */
const initializeAgent = async () => {
  const model = getOllamaModel();
  const tools = [listServicesTools, getAvailableSlotsTools, bookSlotTools];
  
  // Créer l'agent exécuteur avec les options
  const executor = await initializeAgentExecutorWithOptions(
    tools,
    model,
    {
      agentType: "structured-chat-zero-shot-react-description",
      verbose: process.env.NODE_ENV === "development",
      memory: memory,
      maxIterations: 5,
      prefix: SYSTEM_TEMPLATE,
    }
  );
  
  return executor;
};

/**
 * Traite un message utilisateur via l'agent
 * @param {string} message - Message de l'utilisateur
 * @returns {object} Réponse de l'agent
 */
const processMessage = async (message) => {
  try {
    // Initialiser l'agent
    const agent = await initializeAgent();
    
    // Exécuter l'agent avec le message utilisateur
    const result = await agent.call({ input: message });
    
    return {
      success: true,
      botResponse: result.output,
      // Information sur l'état du processus pour le frontend
      processState: {
        isProcessing: false,
        currentStep: detectCurrentStep(result.output)
      }
    };
  } catch (error) {
    console.error("Erreur lors du traitement du message:", error);
    return {
      success: false,
      error: "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
      processState: {
        isProcessing: false,
        error: true
      }
    };
  }
};

/**
 * Détecte l'étape actuelle du processus de réservation basée sur la réponse
 * @param {string} response - Réponse de l'agent
 * @returns {number} Numéro de l'étape actuelle (1-5) ou 0 si indéterminé
 */
const detectCurrentStep = (response) => {
  if (!response) return 0;
  
  const lowercaseResponse = response.toLowerCase();
  
  // Détection basée sur des mots-clés dans la réponse
  if (lowercaseResponse.includes("véhicule") && 
      (lowercaseResponse.includes("marque") || lowercaseResponse.includes("modèle"))) {
    return 1; // Étape d'identification du véhicule
  } else if (lowercaseResponse.includes("service") && 
            (lowercaseResponse.includes("propose") || lowercaseResponse.includes("disponible"))) {
    return 2; // Étape de sélection du service
  } else if (lowercaseResponse.includes("garage") && 
            (lowercaseResponse.includes("proximité") || lowercaseResponse.includes("emplacement"))) {
    return 3; // Étape de choix du garage
  } else if (lowercaseResponse.includes("créneau") || 
            (lowercaseResponse.includes("disponible") && lowercaseResponse.includes("horaire"))) {
    return 4; // Étape de sélection du créneau
  } else if (lowercaseResponse.includes("confirme") || lowercaseResponse.includes("réservation confirmée")) {
    return 5; // Étape de confirmation
  }
  
  return 0; // Indéterminé
};

module.exports = { processMessage }; 