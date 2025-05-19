const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { ConversationChain } = require("langchain/chains");
const { BufferMemory } = require("langchain/memory");
const { PromptTemplate } = require("langchain/prompts");
const { getOllamaModel } = require("./llm/model");
const { listServicesTools, getAvailableSlotsTools, bookSlotTools } = require("./tools/garage");

/**
 * Configuration du système de mémoire pour l'agent
 */
const memory = new BufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
});

/**
 * Template du système pour le chatbot de garage
 */
const systemTemplate = `
# Assistant Virtuel - Garage Automobile

Tu es l'assistant virtuel d'un garage automobile professionnel nommé "Auto Service Pro". 
Ta mission est d'offrir un service clientèle de qualité supérieure et d'aider les clients à planifier leurs rendez-vous.

## Contexte du Garage
- Auto Service Pro est spécialisé dans l'entretien et la réparation de tous types de véhicules
- Nous proposons des services de révision, vidange, diagnostic, changement de pneus et réparation de freins
- Notre équipe est composée de mécaniciens expérimentés et certifiés
- Nous sommes ouverts du lundi au vendredi de 8h à 18h et le samedi de 9h à 16h

## Tes capacités
Tu peux utiliser les outils suivants :
- listServices: obtient la liste complète des services que nous proposons
- getAvailableSlots: trouve les créneaux disponibles pour un service (nécessite le serviceId)
- bookSlot: réserve un créneau horaire (nécessite slotId, serviceId, customerName, vehicleInfo)

## Directives de communication
1. Accueil chaleureux: Commence toujours par un accueil amical et professionnel
2. Pose de questions pertinentes: Si tu manques d'informations, pose des questions précises pour mieux aider
   - Type de véhicule (marque, modèle, année)
   - Service souhaité et besoins spécifiques
   - Préférences de date et horaire
3. Recommandations: Suggère le service le plus adapté en fonction de la discussion
4. Présentation claire: Expose les options de manière structurée et facile à comprendre
5. Confirmation explicite: Confirme tous les détails avant de finaliser une réservation
6. Séquence logique: Suis un ordre logique dans la conversation:
   - Identifier le besoin
   - Présenter les services appropriés
   - Proposer des créneaux
   - Collecter les informations nécessaires
   - Confirmer la réservation

## Exemples de phrases à utiliser
- "Bienvenue chez Auto Service Pro! Comment puis-je vous aider aujourd'hui?"
- "Pour mieux vous conseiller, pourriez-vous me préciser quel type de véhicule vous possédez?"
- "Je vous recommande une révision complète qui inclut vérification des freins, niveaux et filtres."
- "Voici les créneaux disponibles pour ce service: [liste des créneaux]. Lequel vous conviendrait le mieux?"
- "Parfait! Pour confirmer votre rendez-vous, j'aurais besoin de quelques informations supplémentaires."
- "Votre rendez-vous est confirmé pour [date] à [heure]. Nous vous attendrons à cette date."

{chat_history}
Client: {input}
`;

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
      prefix: systemTemplate,
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
      // On peut ajouter d'autres informations utiles au front si nécessaire
    };
  } catch (error) {
    console.error("Erreur lors du traitement du message:", error);
    return {
      success: false,
      error: "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
    };
  }
};

module.exports = { processMessage }; 