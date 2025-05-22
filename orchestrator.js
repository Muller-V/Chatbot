/**
 * Orchestrateur simplifié pour le chatbot
 * Utilise directement le modèle LLM avec le système de réponse JSON
 */
const { BufferMemory } = require("langchain/memory");
const { getOllamaModel } = require("./llm/model");
const { SYSTEM_TEMPLATE } = require("./src/config/constants");
const ResponseParser = require("./src/utils/responseParser");
const ChatAgent = require("./src/agents/chatAgent");

// Instance du chatAgent pour l'orchestrateur
let chatAgent = null;

/**
 * Initialise l'agent de chat si nécessaire
 * @returns {ChatAgent} Instance de l'agent de chat
 */
const getAgent = async () => {
  if (!chatAgent) {
    chatAgent = new ChatAgent();
    await chatAgent.initialize();
    console.log("Agent de chat initialisé par l'orchestrateur");
  }
  return chatAgent;
};

/**
 * Traite un message utilisateur via l'agent de chat
 * @param {string} message - Message de l'utilisateur
 * @returns {object} Réponse formatée pour l'interface
 */
const processMessage = async (message) => {
  try {
    // Obtenir l'agent de chat
    const agent = await getAgent();
    
    // Traiter le message avec l'agent
    const result = await agent.processMessage(message);
    
    return {
      success: true,
      botResponse: result.botResponse,
      processState: result.processState || {
        currentStep: agent.state.currentStep
      }
    };
  } catch (error) {
    console.error("Erreur lors du traitement du message:", error);
    return {
      success: false,
      error: "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
      botResponse: "Une erreur est survenue lors du traitement de votre message. Pourriez-vous reformuler votre demande?",
      processState: {
        isProcessing: false,
        error: true,
        currentStep: 1
      }
    };
  }
};

/**
 * Réinitialise la conversation
 * @returns {object} Confirmation de réinitialisation
 */
const resetConversation = async () => {
  try {
    if (chatAgent) {
      chatAgent.state.reset();
      console.log("Conversation réinitialisée");
    } else {
      // Initialiser un nouvel agent si aucun n'existe
      await getAgent();
    }
    
    return {
      success: true,
      botResponse: "Bonjour ! Je suis BOB, votre assistant de réservation auto. Comment puis-je vous aider aujourd'hui?",
      processState: {
        currentStep: 1
      }
    };
  } catch (error) {
    console.error("Erreur lors de la réinitialisation:", error);
    return {
      success: false,
      error: "Désolé, je n'ai pas pu réinitialiser la conversation.",
      processState: {
        error: true
      }
    };
  }
};

module.exports = { 
  processMessage,
  resetConversation
}; 