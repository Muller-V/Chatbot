const ChatAgent = require('./agents/chatAgent');
const { detectConfirmationOrDenial } = require('./utils/messageParser');

let agentInstance = null;
let pendingOperation = null;

async function processMessage(message) {
  try {
    if (!agentInstance) {
      console.log('Initialisation de l\'agent...');
      const agent = new ChatAgent();
      agentInstance = await agent.initialize();
    }
    
    // Si c'est un message de continuation et qu'une opération est en attente
    if (message === "continuation" && pendingOperation) {
      console.log('Continuation détectée, traitement de l\'opération en attente...');
      const result = await pendingOperation();
      pendingOperation = null;
      return result;
    }
    
    // Sinon, traiter normalement le message
    const response = await agentInstance.processMessage(message);
    
    // Si la réponse indique un chargement, configurer l'opération en attente
    if (response.isLoading) {
      if (agentInstance.isSearchingBackend) {
        if (agentInstance.state.confirmationStep.pending && 
            detectConfirmationOrDenial(message).isConfirmation) {
          pendingOperation = async () => await agentInstance.handleConfirmation();
        } else if (agentInstance.state.askingForLicensePlate && 
                  agentInstance.state.licensePlate) {
          pendingOperation = async () => await agentInstance.handleLicensePlateProvided();
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error('Erreur lors du traitement du message:', error);
    pendingOperation = null;
    return {
      success: true,
      botResponse: "Je suis désolé, une erreur s'est produite. Nos services principaux comprennent la vidange (80€), le changement de pneus (70€/pneu), le contrôle technique (89€). Quel jour souhaitez-vous prendre rendez-vous ?"
    };
  }
}

function resetConversation() {
  if (agentInstance) {
    agentInstance.reset();
    pendingOperation = null;
  }
}

module.exports = { processMessage, resetConversation }; 