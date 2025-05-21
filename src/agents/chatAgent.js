/**
 * Agent de conversation pour le chatbot
 */
const { BufferMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
// Nous n'utilisons plus PromptTemplate
// const { PromptTemplate } = require("langchain/prompts");
const { getOllamaModel } = require("../llm/model");
const { SYSTEM_TEMPLATE, SERVICE_PRICES, SERVICE_NAMES } = require("../config/constants");
const ConversationState = require("../models/ConversationState");
const { 
  detectService, 
  detectJour, 
  detectHoraire, 
  detectGarage, 
  detectLicensePlate, 
  detectConfirmationOrDenial,
  detectUserSentiment
} = require("../utils/messageParser");
const { formatDateForApi } = require("../utils/dateUtils");
const apiService = require("../services/apiService");

class ChatAgent {
  constructor() {
    this.memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "input",
      outputKey: "output",
      humanPrefix: "Client",
      aiPrefix: "Assistant",
    });

    // Nous n'utilisons plus le prompt template pour éviter les problèmes avec les promesses
    // this.prompt = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE);
    this.model = getOllamaModel();
    
    // Nous n'utilisons plus cette chaîne dans notre approche modifiée
    // this.chain = new ConversationChain({
    //   llm: this.model,
    //   memory: this.memory,
    //   prompt: this.prompt,
    // });

    this.state = new ConversationState();
    this.apiAvailable = false;
    this.previousResponses = [];
    this.isSearchingBackend = false;
  }

  /**
   * Initialise l'agent
   */
  async initialize() {
    this.apiAvailable = await apiService.checkApiAvailability();
    return this;
  }

  /**
   * Traite un message de l'utilisateur
   * @param {string} message - Message de l'utilisateur
   * @returns {Promise<{success: boolean, botResponse: string}>} Réponse du bot
   */
  async processMessage(message) {
    try {
      // Analyser le message et mettre à jour l'état de la conversation
      this.updateState(message);
      
      // Si une confirmation est demandée et que l'utilisateur répond clairement
      const { isConfirmation, isDenial } = detectConfirmationOrDenial(message);
      
      if (this.state.confirmationStep.pending) {
        if (isConfirmation) {
          this.isSearchingBackend = true;
          return {
            success: true,
            botResponse: "Je recherche des informations dans notre système, un instant s'il vous plaît...",
            isLoading: true
          };
        } else if (isDenial) {
          return this.handleDenial();
        }
      }
      
      // Si on attend une plaque d'immatriculation et qu'elle est fournie
      if (this.state.askingForLicensePlate && this.state.licensePlate) {
        this.isSearchingBackend = true;
        return {
          success: true,
          botResponse: "Je recherche les informations de votre véhicule dans notre base de données, un instant s'il vous plaît...",
          isLoading: true
        };
      }
      
      // Si les informations de rendez-vous sont complètes, demander la plaque
      if (this.state.hasAllAppointmentInfo() && !this.state.licensePlate && !this.state.askingForLicensePlate) {
        this.state.askingForLicensePlate = true;
        const summary = this.state.generateSummary(SERVICE_PRICES);
        
        return {
          success: true,
          botResponse: `${summary}\nPour finaliser votre rendez-vous, pourriez-vous indiquer votre plaque d'immatriculation au format AA-123-AA ?`
        };
      }
      
      // Générer une réponse standard via le LLM
      try {
        // Plutôt que d'utiliser chain.call, utilisons une approche plus directe pour éviter les problèmes de mémoire
        const chainInput = { input: message };
        
        // Récupérer l'historique de chat de manière synchrone
        let chatHistory = "";
        try {
          const memoryVariables = await this.memory.loadMemoryVariables({});
          if (memoryVariables && memoryVariables.chat_history) {
            if (typeof memoryVariables.chat_history.then === 'function') {
              chatHistory = await memoryVariables.chat_history;
            } else {
              chatHistory = memoryVariables.chat_history;
            }
          }
          
          // Convertir en chaîne si nécessaire
          if (typeof chatHistory !== 'string') {
            chatHistory = JSON.stringify(chatHistory);
          }
        } catch (memoryError) {
          console.error("Erreur lors du chargement de la mémoire:", memoryError);
          chatHistory = "";
        }
        
        // Construction manuelle du prompt
        const systemPrompt = "You are a booking agent for 'Auto Service Pro' garage. ALWAYS respond in FRENCH only. "
          + "Keep responses SHORT, limited to 1-3 sentences. Voici notre contexte:\n\n"
          + "Nous sommes un garage qui propose les services suivants:\n"
          + "- Vidange: 80€\n"
          + "- Changement de pneus: 70€ par pneu\n"
          + "- Contrôle technique: 89€\n"
          + "- Réparation des freins: 120€\n"
          + "- Entretien climatisation: 60€\n\n"
          + "Nous avons des garages à Paris, Lyon et Nice.\n"
          + "Nos horaires sont 8h-19h du lundi au vendredi, et 9h-17h le samedi.\n\n"
          + "IMPORTANT: Ask for missing information until you have ALL necessary details (service type, day, time, garage location, and license plate). "
          + "KEEP TRACK of what you already know and DO NOT ask for information you already have. "
          + "DO NOT repeat the same question if already asked. "
          + "ASK for license plate before confirming appointment. "
          + "If you don't have certain information, ASK for it specifically.\n\n"
          + `Historique de la conversation: ${chatHistory}\n\n`
          + `Question du client: ${message}`;
        
        console.log("Envoi du prompt suivant à Ollama:", systemPrompt.substring(0, 100) + "...");
        
        // Appeler le modèle avec le prompt manuel
        const response = await this.model.call(systemPrompt);
        
        // Vérifier que la réponse est en français
        const isEnglish = /\b(the|is|are|what|how|when|where|why|this|that|these|those|it|a|an|in|on|at|to|for|with|by|from|of|about)\b/i.test(response) && !/é|è|ê|à|ù|ç|ô|œ|î|ï|û|â|ë|ü/i.test(response);
        
        if (isEnglish) {
          console.error("❌ La réponse détectée comme étant en anglais:", response);
          // Si la réponse semble être en anglais, utiliser une réponse par défaut
          const defaultResponse = "Nos services principaux comprennent la vidange (80€), le changement de pneus (70€/pneu), le contrôle technique (89€), la réparation des freins (120€) et l'entretien climatisation (60€). Pour quel jour souhaitez-vous prendre rendez-vous ?";
          
          // Mise à jour de la mémoire avec la réponse par défaut
          try {
            await this.memory.saveContext({ input: message }, { output: defaultResponse });
          } catch (memoryError) {
            console.error("Erreur lors de la mise à jour de la mémoire:", memoryError);
          }
          
          return {
            success: true,
            botResponse: defaultResponse
          };
        }
        
        // Mise à jour de la mémoire avec la méthode saveContext
        try {
          await this.memory.saveContext({ input: message }, { output: response });
        } catch (memoryError) {
          console.error("Erreur lors de la mise à jour de la mémoire:", memoryError);
        }
        
        // Vérification que la réponse est valide
        if (!response || response.trim().length < 10) {
          return {
            success: true,
            botResponse: "Nos services principaux comprennent la vidange (80€), le changement de pneus (70€/pneu), le contrôle technique (89€), la réparation des freins (120€) et l'entretien climatisation (60€). Pour quel jour souhaitez-vous prendre rendez-vous ?"
          };
        }

        // Adapter la réponse en fonction de l'état émotionnel de l'utilisateur
        let botResponse = this.adaptResponseToSentiment(response);
        
        // Stocker la réponse dans l'historique
        this.previousResponses.push(botResponse);
        if (this.previousResponses.length > 5) {
          this.previousResponses.shift();
        }
        
        return {
          success: true,
          botResponse
        };
      } catch (llmError) {
        console.error("Erreur lors de l'appel au modèle LLM:", llmError);
        return {
          success: true,
          botResponse: "Nos services principaux comprennent la vidange (80€), le changement de pneus (70€/pneu), le contrôle technique (89€), la réparation des freins (120€) et l'entretien climatisation (60€). Pour quel jour souhaitez-vous prendre rendez-vous ?"
        };
      }
    } catch (error) {
      console.error("Erreur lors du traitement du message:", error);
      return {
        success: true,
        botResponse: "Nos services principaux comprennent la vidange (80€), le changement de pneus (70€/pneu), le contrôle technique (89€), la réparation des freins (120€) et l'entretien climatisation (60€). Pour quel jour souhaitez-vous prendre rendez-vous ?"
      };
    }
  }

  /**
   * Met à jour l'état de la conversation en fonction du message
   * @param {string} message - Message de l'utilisateur 
   */
  updateState(message) {
    // Détection du service
    const service = detectService(message);
    if (service) {
      this.state.service = service;
    }
    
    // Détection du jour
    const jourInfo = detectJour(message);
    if (jourInfo) {
      this.state.jour = jourInfo.jour;
      this.state.jourDate = jourInfo.jourDate;
    }
    
    // Détection de l'horaire
    const horaireInfo = detectHoraire(message);
    if (horaireInfo) {
      this.state.horaire = horaireInfo.horaire;
      this.state.heuresPrecises = horaireInfo.heuresPrecises;
    }
    
    // Détection du garage
    const garage = detectGarage(message);
    if (garage) {
      this.state.garage = garage;
    }
    
    // Détection de la plaque d'immatriculation
    const licensePlate = detectLicensePlate(message);
    if (licensePlate) {
      this.state.licensePlate = licensePlate;
      this.getVehicleInfo(licensePlate);
    }
    
    // Détection du sentiment utilisateur
    const sentiment = detectUserSentiment(message);
    this.state.userSentiment = sentiment;
    
    // Incrémentation du compteur de tours
    this.state.turnCount++;
    
    console.log('État de la conversation mis à jour:', this.state);
  }

  /**
   * Récupère les informations d'un véhicule
   * @param {string} licensePlate - Plaque d'immatriculation
   */
  async getVehicleInfo(licensePlate) {
    let vehicleInfo = null;
    
    if (this.apiAvailable) {
      vehicleInfo = await apiService.getVehicleInfo(licensePlate);
      if (vehicleInfo) {
        this.state.vehiculeBrand = vehicleInfo.brand;
        this.state.vehiculeModel = vehicleInfo.model;
        console.log(`Informations récupérées pour le véhicule ${licensePlate}:`, vehicleInfo);
      } else {
        console.error(`Aucune information trouvée pour le véhicule ${licensePlate}`);
        this.state.vehiculeBrand = null;
        this.state.vehiculeModel = null;
      }
    } else {
      // Mode de test avec valeurs fictives
      console.log("API non disponible, utilisation de données fictives pour test");
      this.state.vehiculeBrand = "Renault";
      this.state.vehiculeModel = "Clio";
    }
    
    if (this.isSearchingBackend) {
      this.isSearchingBackend = false;
      return await this.handleLicensePlateProvided();
    }
  }

  /**
   * Gère la confirmation d'un rendez-vous
   * @returns {Promise<{success: boolean, botResponse: string}>}
   */
  async handleConfirmation() {
    // Réinitialiser l'état de confirmation
    this.state.confirmationStep.pending = false;
    
    if (!this.state.licensePlate) {
      // Demander la plaque d'immatriculation
      this.state.askingForLicensePlate = true;
      return {
        success: true,
        botResponse: `Parfait ! Pour finaliser votre rendez-vous, pourriez-vous indiquer votre plaque d'immatriculation au format AA-123-AA ?`
      };
    } else {
      // Confirmer le rendez-vous
      const success = await this.bookAppointment();
      
      if (!success) {
        return {
          success: true,
          botResponse: `Je suis désolé, nous n'avons pas pu confirmer votre rendez-vous. Veuillez vérifier les informations et réessayer.`
        };
      }
      
      let vehicleInfoText = "";
      if (this.state.vehiculeBrand && this.state.vehiculeModel) {
        vehicleInfoText = `votre ${this.state.vehiculeBrand} ${this.state.vehiculeModel}`;
      } else {
        vehicleInfoText = "votre véhicule";
      }
      
      const confirmationMsg = `Votre rendez-vous est confirmé pour ${vehicleInfoText} (immatriculation ${this.state.licensePlate}) au garage de ${this.state.garage} le ${this.state.jour} ${this.state.horaire} pour ${SERVICE_NAMES[this.state.service] || this.state.service}. Le prix sera de ${SERVICE_PRICES[this.state.service] || 'à confirmer'}. Merci de votre confiance !`;
      
      // Réinitialiser l'état pour une nouvelle conversation
      this.state.reset();
      this.isSearchingBackend = false;
      
      return {
        success: true,
        botResponse: confirmationMsg
      };
    }
  }

  /**
   * Gère le refus d'un rendez-vous
   * @returns {{success: boolean, botResponse: string}}
   */
  handleDenial() {
    this.state.confirmationStep.pending = false;
    return {
      success: true,
      botResponse: `D'accord, que souhaitez-vous modifier dans votre rendez-vous ?`
    };
  }

  /**
   * Gère la fourniture d'une plaque d'immatriculation
   * @returns {Promise<{success: boolean, botResponse: string}>}
   */
  async handleLicensePlateProvided() {
    // Préparer la confirmation
    this.state.askingForLicensePlate = false;
    this.state.confirmationStep.pending = true;
    
    const summary = this.state.generateSummary(SERVICE_PRICES);
    this.state.confirmationStep.appointmentSummary = summary;
    
    let vehicleInfoText = "";
    if (this.state.vehiculeBrand && this.state.vehiculeModel) {
      vehicleInfoText = `\nVéhicule identifié : ${this.state.vehiculeBrand} ${this.state.vehiculeModel}`;
    }
    
    return {
      success: true,
      botResponse: `${summary}${vehicleInfoText}\nPouvez-vous confirmer ce rendez-vous ? Répondez par "oui" pour confirmer ou "non" pour modifier.`
    };
  }

  /**
   * Enregistre un rendez-vous
   * @returns {Promise<boolean>} - true si l'enregistrement a réussi
   */
  async bookAppointment() {
    if (!this.state.isReadyForConfirmation()) {
      console.error('Informations insuffisantes pour réserver un rendez-vous');
      return false;
    }

    if (this.apiAvailable) {
      try {
        const appointmentData = {
          service_id: this.getServiceId(this.state.service),
          garage_id: this.getGarageId(this.state.garage),
          datetime: `${formatDateForApi(this.state.jour)}T${this.state.heuresPrecises || '10:00'}:00`,
          client_name: "Client Web",
          license_plate: this.state.licensePlate,
          vehicle_info: {
            brand: this.state.vehiculeBrand || 'Non identifié',
            model: this.state.vehiculeModel || 'Non identifié'
          }
        };
        
        console.log("Tentative de réservation avec les données:", appointmentData);
        const result = await apiService.bookAppointment(appointmentData);
        console.log("Résultat de la réservation:", result);
        
        return result;
      } catch (error) {
        console.error("Erreur lors de la réservation:", error);
        return false;
      }
    }
    
    // Simulation d'un succès si l'API n'est pas disponible
    console.log('ℹ️ Simulation de succès pour le test (API non disponible)');
    return true;
  }

  /**
   * Adapte la réponse en fonction du sentiment de l'utilisateur
   * @param {string} baseResponse - Réponse de base
   * @returns {string} - Réponse adaptée
   */
  adaptResponseToSentiment(baseResponse) {
    let adaptedResponse = baseResponse;
    
    // Adapter la réponse en cas d'urgence
    if (this.state.userSentiment.isUrgent) {
      if (!adaptedResponse.includes('rapidement') && !adaptedResponse.includes('au plus tôt')) {
        adaptedResponse = adaptedResponse.replace('Souhaitez-vous prendre rendez-vous', 'Nous pouvons organiser un rendez-vous rapidement');
        adaptedResponse = adaptedResponse.replace('Souhaitez-vous un rendez-vous', 'Nous pouvons vous proposer un rendez-vous prioritaire');
      }
    }
    
    // Adapter la réponse en cas de frustration
    if (this.state.userSentiment.isFrustrated) {
      if (!adaptedResponse.includes('désolé') && !adaptedResponse.includes('pardon')) {
        adaptedResponse = 'Je vous prie de m\'excuser pour la gêne occasionnée. ' + adaptedResponse;
      }
    }
    
    // Adapter la réponse en cas de sentiment positif
    if (this.state.userSentiment.isPositive) {
      if (!adaptedResponse.includes('merci')) {
        adaptedResponse += ' Merci pour votre confiance !';
      }
    }
    
    return adaptedResponse;
  }

  /**
   * Obtient l'ID du service à partir de son code
   * @param {string} serviceCode - Code du service
   * @returns {string} - ID du service
   */
  getServiceId(serviceCode) {
    const serviceIdMap = {
      'vidange': '1',
      'pneus': '7',
      'ct': '8',
      'freins': '5',
      'climatisation': '6'
    };
    
    return serviceIdMap[serviceCode] || '1';
  }

  /**
   * Obtient l'ID du garage à partir de son nom
   * @param {string} garageName - Nom du garage
   * @returns {string} - ID du garage
   */
  getGarageId(garageName) {
    if (garageName === 'Lyon') {
      return '4';
    } else if (garageName === 'Nice') {
      return '6';
    }
    return '1';
  }

  /**
   * Réinitialise l'agent
   */
  reset() {
    this.state.reset();
    this.previousResponses = [];
    this.memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "input", 
      outputKey: "output",
      humanPrefix: "Client",
      aiPrefix: "Assistant",
    });
    
    // Nous n'utilisons plus le prompt template pour éviter les problèmes avec les promesses
    // this.prompt = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE);
    this.model = getOllamaModel();
  }
}

module.exports = ChatAgent; 