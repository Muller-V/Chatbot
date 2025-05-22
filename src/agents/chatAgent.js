/**
 * Agent de conversation principal
 * Gère l'interaction avec le LLM et le traitement des réponses
 */
const { BufferMemory } = require("langchain/memory");
const { getOllamaModel } = require("../../llm/model");
const { SYSTEM_TEMPLATE, CONVERSATION_STEPS } = require("../config/constants");
const ConversationState = require("../models/ConversationState");
const apiService = require("../services/apiService");
const ResponseParser = require("../utils/responseParser");

class ChatAgent {
  constructor() {
    // Mémoire de conversation pour stocker l'historique
    this.memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "input",
      outputKey: "output",
      humanPrefix: "User",
      aiPrefix: "Assistant",
    });

    // Modèle LLM
    this.model = getOllamaModel();
    
    // État de la conversation
    this.state = new ConversationState();
    
    // Indicateurs de statut
    this.apiAvailable = false;
    this.isProcessing = false;
  }

  /**
   * Initialise l'agent de chat
   */
  async initialize() {
    try {
      console.log('Initialisation de l\'agent de chat...');

      // Réinitialiser l'état et la mémoire
      this.state = new ConversationState();
      this.memory = new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true,
        inputKey: "input", 
        outputKey: "output",
        humanPrefix: "User",
        aiPrefix: "Assistant",
      });

      // Initialiser le modèle LLM
      this.model = getOllamaModel();
      
      // Données de contexte
      this.state.availableServices = [];
      this.state.availableGarages = [];

      // Authentification avec l'API
      try {
        const authSuccess = await apiService.authenticate();
        if (authSuccess) {
          this.apiAvailable = true;
          console.log('Authentification API réussie');
          
          // Précharger les données si l'API est disponible
          await this.preloadData();
        } else {
          console.warn('Échec de l\'authentification API');
          this.apiAvailable = false;
        }
      } catch (authError) {
        console.warn('Erreur lors de l\'authentification API:', authError);
        this.apiAvailable = false;
      }

      console.log('Agent de chat initialisé');
      return this;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'agent de chat:', error);
      return this;
    }
  }

  /**
   * Précharge les données de services et de garages
   */
  async preloadData() {
    try {
      // Charger les services
      try {
        const operationsData = await apiService.getOperations();
        if (operationsData && operationsData.length > 0) {
          this.state.availableServices = operationsData;
          console.log(`Services préchargés avec succès (${operationsData.length})`);
        }
      } catch (servicesError) {
        console.warn('Impossible de précharger les services:', servicesError);
      }

      // Charger les garages
      try {
        const garagesData = await apiService.getAllGarages();
        if (garagesData && garagesData.garages && garagesData.garages.length > 0) {
          this.state.availableGarages = garagesData.garages;
          console.log(`Garages préchargés avec succès (${garagesData.garages.length})`);
        }
      } catch (garagesError) {
        console.warn('Impossible de précharger les garages:', garagesError);
      }
    } catch (error) {
      console.error('Erreur lors du préchargement des données:', error);
    }
  }

  /**
   * Traite un message utilisateur et génère une réponse
   * @param {string} message - Message de l'utilisateur
   * @returns {Object} Réponse formatée
   */
  async processMessage(message) {
    try {
      // Éviter le traitement concurrent
      if (this.isProcessing) {
        console.log("Un traitement est déjà en cours, veuillez patienter...");
        return {
          success: true,
          botResponse: "Je traite votre demande précédente. Un instant s'il vous plaît."
        };
      }
      
      // Définir le drapeau de traitement
      this.isProcessing = true;
      
      // Incrémenter le compteur de tours
      this.state.turnCount++;
      
      // Pré-traitement pour détecter une plaque d'immatriculation
      const licensePlateRegex = /([A-Za-z]{2})[- ]?(\d{3})[- ]?([A-Za-z]{2})/i;
      const plateMatch = message.match(licensePlateRegex);
      
      if (plateMatch && this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
        // Formater la plaque correctement
        const formattedPlate = `${plateMatch[1].toUpperCase()}-${plateMatch[2]}-${plateMatch[3].toUpperCase()}`;
        console.log(`Plaque d'immatriculation détectée: ${formattedPlate}`);
        
        // Effectuer l'appel API AVANT de générer la réponse du LLM
        if (this.apiAvailable) {
          try {
            console.log("Récupération anticipée des données du véhicule...");
            const vehicleData = await apiService.getVehicleByPlate(formattedPlate);
            if (vehicleData) {
              // Mettre à jour l'état du véhicule immédiatement
              this.state.vehicle.licensePlate = formattedPlate;
              this.state.vehicle.brand = vehicleData.brand || "Marque non spécifiée";
              this.state.vehicle.model = vehicleData.model || "Modèle non spécifié";
              this.state.vehicle.id = vehicleData.id || vehicleData.licensePlate || formattedPlate;
              this.state.vehicle.confirmed = true;
              
              // Forcer le passage à l'étape suivante
              this.state.currentStep = CONVERSATION_STEPS.SERVICE_SELECTION;
              
              console.log(`Véhicule pré-chargé: ${this.state.vehicle.brand} ${this.state.vehicle.model}`);
              console.log(`Passage forcé à l'étape ${this.state.currentStep}`);
            }
          } catch (vehicleError) {
            console.error("Erreur lors de la récupération anticipée du véhicule:", vehicleError);
          }
        } else {
          // Même sans API, on accepte la plaque et on passe à l'étape suivante
          this.state.vehicle.licensePlate = formattedPlate;
          this.state.vehicle.confirmed = true;
          this.state.currentStep = CONVERSATION_STEPS.SERVICE_SELECTION;
          console.log(`API non disponible, mais passage à l'étape ${this.state.currentStep} avec plaque: ${formattedPlate}`);
        }
      }
      
      // Générer la réponse basée sur l'état actuel de la conversation
      const prompt = await this.constructPrompt(message);
      let llmResponse;
      
      try {
        console.log("Envoi de la requête au LLM...");
        llmResponse = await this.model.invoke(prompt);
        console.log("Réponse du LLM reçue:", typeof llmResponse);
      } catch (llmError) {
        console.error("Erreur avec le LLM:", llmError);
        this.isProcessing = false;
        return {
          success: false,
          botResponse: "Je vous prie de m'excuser, mais j'ai rencontré un problème technique. Comment puis-je vous aider?"
        };
      }
      
      // Extraire le texte de la réponse du LLM selon son format
      let responseContent;
      if (typeof llmResponse === 'string') {
        responseContent = llmResponse;
      } else if (llmResponse && typeof llmResponse === 'object') {
        // Différents formats possibles selon la version de LangChain
        if (llmResponse.content) {
          responseContent = llmResponse.content;
        } else if (llmResponse.text) {
          responseContent = llmResponse.text;
        } else if (llmResponse.message && llmResponse.message.content) {
          responseContent = llmResponse.message.content;
        } else {
          // Dernier recours: essayer de convertir tout l'objet en JSON
          responseContent = JSON.stringify(llmResponse);
        }
      } else {
        console.error("Format de réponse LLM non géré:", llmResponse);
        this.isProcessing = false;
        return {
          success: false,
          botResponse: "Désolé, je n'ai pas pu comprendre ma propre réponse. Pourriez-vous reformuler votre demande?"
        };
      }
      
      // Journaliser la réponse brute pour le débogage
      console.log("Contenu de la réponse LLM:", responseContent?.substring(0, 150) + "...");
      
      // Parser la réponse du LLM
      const parsedResponse = ResponseParser.parseResponse(responseContent);
      
      // Sauvegarder dans la mémoire
      await this.saveToMemory(message, parsedResponse.message);
      
      // Mettre à jour l'état de la conversation
      await this.updateState(parsedResponse);
      
      // Exécuter les actions nécessaires
      await this.executeActions(parsedResponse);
      
      // Réinitialiser le drapeau de traitement
      this.isProcessing = false;
      
      // Retourner la réponse formatée pour l'UI
      return {
        success: true,
        botResponse: parsedResponse.message,
        processState: {
          currentStep: this.state.currentStep
        }
      };
    } catch (error) {
      console.error("Erreur lors du traitement du message:", error);
      this.isProcessing = false;
      
      return {
        success: false,
        botResponse: "Une erreur est survenue. Comment puis-je vous aider aujourd'hui?",
        processState: {
          currentStep: this.state.currentStep
        }
      };
    }
  }

  /**
   * Met à jour l'état de la conversation en fonction de la réponse du LLM
   * @param {Object} parsedResponse - Réponse parsée du LLM
   */
  async updateState(parsedResponse) {
    // Mettre à jour l'étape courante si spécifiée
    if (parsedResponse.currentStep) {
      this.state.currentStep = parsedResponse.currentStep;
    }
    
    // Avancer à l'étape suivante si demandé
    if (parsedResponse.actions.advanceStep) {
      this.state.advanceStep();
    }
    
    // Retour à une étape précédente si demandé
    if (parsedResponse.actions.backToStep) {
      this.state.goToStep(parsedResponse.actions.backToStep);
    }
    
    // Mettre à jour les données extraites
    const extractedData = parsedResponse.extractedData;
    
    if (extractedData.licensePlate) {
      this.state.vehicle.licensePlate = extractedData.licensePlate;
      this.state.vehicle.confirmed = true;
      
      // Vérification supplémentaire: si la plaque est validée et qu'on est encore à l'étape 1,
      // forcer le passage à l'étape 2
      if (this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
        console.log("Plaque validée mais toujours à l'étape 1, forçage du passage à l'étape 2");
        this.state.currentStep = CONVERSATION_STEPS.SERVICE_SELECTION;
      }
    }
    
    if (extractedData.serviceId && extractedData.serviceName) {
      this.state.service.id = extractedData.serviceId;
      this.state.service.name = extractedData.serviceName;
      this.state.service.confirmed = true;
    }
    
    if (extractedData.garageId && extractedData.garageName) {
      this.state.garage.id = extractedData.garageId;
      this.state.garage.name = extractedData.garageName;
      this.state.garage.confirmed = true;
    }
    
    if (extractedData.date && extractedData.time) {
      this.state.appointment.date = extractedData.date;
      this.state.appointment.time = extractedData.time;
      this.state.appointment.confirmed = true;
    }
    
    if (extractedData.confirmed) {
      this.state.finalConfirmation = true;
    }
  }

  /**
   * Exécute les actions demandées par le LLM
   * @param {Object} parsedResponse - Réponse parsée du LLM
   */
  async executeActions(parsedResponse) {
    if (!this.apiAvailable || !parsedResponse.actions.apiCall) {
      return;
    }
    
    try {
      const apiCall = parsedResponse.actions.apiCall;
      const params = parsedResponse.actions.apiParams || {};
      
      switch (apiCall) {
        case 'getVehicleByPlate':
          if (parsedResponse.extractedData.licensePlate) {
            console.log(`Récupération des données du véhicule pour la plaque: ${parsedResponse.extractedData.licensePlate}`);
            try {
              const vehicleData = await apiService.getVehicleByPlate(parsedResponse.extractedData.licensePlate);
              console.log("Données du véhicule reçues:", JSON.stringify(vehicleData));
              
              if (vehicleData) {
                // Vérifier que les données contiennent bien les propriétés attendues
                this.state.vehicle.brand = vehicleData.brand || 'Marque non spécifiée';
                this.state.vehicle.model = vehicleData.model || 'Modèle non spécifié';
                this.state.vehicle.id = vehicleData.id || vehicleData.licensePlate || parsedResponse.extractedData.licensePlate;
                this.state.vehicle.confirmed = true;
                
                // Si on a au moins la marque ou le modèle, considérer que les données sont correctes
                if (vehicleData.brand || vehicleData.model) {
                  console.log(`Véhicule identifié: ${this.state.vehicle.brand} ${this.state.vehicle.model}`);
                } else {
                  console.warn("API a renvoyé des données de véhicule incomplètes");
                }
              } else {
                console.warn("Aucune donnée de véhicule reçue de l'API");
                // Utiliser la plaque d'immatriculation comme identifiant de secours
                this.state.vehicle.id = parsedResponse.extractedData.licensePlate;
                this.state.vehicle.confirmed = true;
              }
            } catch (error) {
              console.error("Erreur lors de la récupération des données du véhicule:", error);
              // Même en cas d'erreur, on considère que le véhicule est confirmé avec sa plaque d'immatriculation
              this.state.vehicle.id = parsedResponse.extractedData.licensePlate;
              this.state.vehicle.confirmed = true;
            }
          }
          break;
          
        case 'getServices':
          const services = await apiService.getOperations();
          if (services && services.length > 0) {
            this.state.availableServices = services;
          }
          break;
          
        case 'getGarages':
          const garages = await apiService.getAllGarages();
          if (garages && garages.garages && garages.garages.length > 0) {
            this.state.availableGarages = garages.garages;
          }
          break;
          
        case 'getTimeSlots':
          // Paramètres optionnels: date, garageId
          const availabilities = await apiService.getAvailabilities(
            params.garageId || this.state.garage.id,
            params.date,
            params.page || 1
          );
          if (availabilities && availabilities.availabilities) {
            this.state.availableTimeSlots = availabilities.availabilities;
          }
          break;
          
        case 'createAppointment':
          if (this.state.isReadyForConfirmation()) {
            await this.createAppointment();
          }
          break;
      }
    } catch (error) {
      console.error(`Erreur lors de l'exécution de l'action ${parsedResponse.actions.apiCall}:`, error);
    }
  }

  /**
   * Crée un rendez-vous dans le système
   */
  async createAppointment() {
    if (!this.state.isReadyForConfirmation()) {
      console.warn('Tous les champs requis ne sont pas remplis pour la création du rendez-vous');
      return;
    }
    
    if (!this.apiAvailable) {
      console.warn('API non disponible, impossible de créer le rendez-vous');
      return;
    }
    
    try {
      // Formater la date pour l'API
      let appointmentDate;
      const frenchDateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      const frenchMatch = this.state.appointment.date.match(frenchDateRegex);
      
      if (frenchMatch) {
        // Convertir DD/MM/YYYY en YYYY-MM-DD
        appointmentDate = `${frenchMatch[3]}-${frenchMatch[2].padStart(2, '0')}-${frenchMatch[1].padStart(2, '0')}`;
      } else {
        // Utiliser demain comme fallback
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        appointmentDate = tomorrow.toISOString().split('T')[0];
      }
      
      // Créer le payload de rendez-vous
      const appointmentData = {
        date: `${appointmentDate} ${this.state.appointment.time}:00`,
        status: 'pending',
        notes: `Réservation pour ${this.state.service.name}`,
        vehicule_id: this.state.vehicle.id || this.state.vehicle.licensePlate,
        garage_id: this.state.garage.id,
        operations: [this.state.service.id]
      };
      
      const result = await apiService.createAppointment(appointmentData);
      console.log('Rendez-vous créé avec succès:', result);
    } catch (error) {
      console.error('Erreur lors de la création du rendez-vous:', error);
    }
  }
  
  /**
   * Construit le prompt pour le LLM
   * @param {string} message - Message de l'utilisateur
   * @returns {string} Prompt formaté
   */
  async constructPrompt(message) {
    try {
      // Précharger les données nécessaires en fonction de l'étape actuelle
      await this.preloadDataForCurrentStep();
      
      // Construire le contexte pour le prompt avec des données structurées
      let vehicleData = "Non disponible";
      if (this.state.vehicle.licensePlate) {
        if (this.state.vehicle.brand && this.state.vehicle.model) {
          // Format plus détaillé et explicite pour le LLM
          vehicleData = `Plaque: ${this.state.vehicle.licensePlate}, Marque: ${this.state.vehicle.brand}, Modèle: ${this.state.vehicle.model}, ID: ${this.state.vehicle.id || 'Non disponible'}`;
          
          // Afficher un log pour le débogage
          console.log(`Données véhicule incluses dans le prompt: ${vehicleData}`);
        } else {
          vehicleData = `Plaque: ${this.state.vehicle.licensePlate}`;
        }
      }
      
      // Fournir des services détaillés avec ID pour faciliter la sélection
      let availableServices = "Non disponible";
      if (this.state.availableServices && this.state.availableServices.length > 0) {
        availableServices = this.state.availableServices
          .slice(0, 8) // Augmenter le nombre d'options
          .map(s => `ID: ${s.id} - ${s.name} (${s.price || 'prix non disponible'}€)`)
          .join(" | ");
      }
      
      // Fournir des garages détaillés avec ID et adresse
      let nearbyGarages = "Non disponible";
      if (this.state.availableGarages && this.state.availableGarages.length > 0) {
        nearbyGarages = this.state.availableGarages
          .slice(0, 6) // Augmenter le nombre d'options
          .map(g => `ID: ${g.id} - ${g.name} (${g.address || 'adresse non disponible'})`)
          .join(" | ");
      }
      
      // Créneaux disponibles formatés pour être facilement sélectionnables
      let availableSlots = "Non disponible";
      
      if (this.apiAvailable && this.state.availableTimeSlots && this.state.availableTimeSlots.length > 0) {
        availableSlots = this.state.availableTimeSlots
          .map(a => {
            // Formater la date en français JJ/MM/AAAA
            const dateParts = a.date.split('-');
            const formattedDate = dateParts.length === 3 ? 
              `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : a.date;
            
            // Formater les créneaux pour une sélection facile
            const formattedSlots = a.slots.map(slot => `${formattedDate} à ${slot}`).join(" | ");
            return formattedSlots;
          })
          .join(" | ");
      } else {
        // Fallback temporaire avec des créneaux fictifs mais bien formatés
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const day = String(tomorrow.getDate()).padStart(2, '0');
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const year = tomorrow.getFullYear();
        availableSlots = `${day}/${month}/${year} à 10:00 | ${day}/${month}/${year} à 14:00 | ${day}/${month}/${year} à 16:30`;
      }
      
      // Statut actuel de la réservation (utile pour le résumé)
      const reservationStatus = this.getReservationStatusSummary();
      
      // Historique de conversation
      let chatHistory = "";
      try {
        const history = await this.memory.loadMemoryVariables({});
        if (history && history.chat_history) {
          chatHistory = history.chat_history;
        }
      } catch (memoryError) {
        console.warn('Erreur lors du chargement de la mémoire:', memoryError);
      }
      
      // Remplacer les placeholders dans le template système
      let systemPrompt = SYSTEM_TEMPLATE
        .replace("{{VEHICLE_DATA}}", vehicleData)
        .replace("{{AVAILABLE_SERVICES}}", availableServices)
        .replace("{{NEARBY_GARAGES}}", nearbyGarages)
        .replace("{{AVAILABLE_SLOTS}}", availableSlots)
        .replace("{{RESERVATION_STATUS}}", reservationStatus)
        .replace("{{CURRENT_STEP}}", this.state.currentStep)
        .replace("{{CHAT_HISTORY}}", chatHistory)
        .replace("{{USER_INPUT}}", message);
      
      return systemPrompt;
    } catch (error) {
      console.error("Erreur lors de la construction du prompt:", error);
      return SYSTEM_TEMPLATE
        .replace("{{VEHICLE_DATA}}", "Non disponible")
        .replace("{{AVAILABLE_SERVICES}}", "Non disponible")
        .replace("{{NEARBY_GARAGES}}", "Non disponible")
        .replace("{{AVAILABLE_SLOTS}}", "Non disponible")
        .replace("{{RESERVATION_STATUS}}", "Aucune information disponible")
        .replace("{{CURRENT_STEP}}", this.state.currentStep)
        .replace("{{CHAT_HISTORY}}", "")
        .replace("{{USER_INPUT}}", message);
    }
  }
  
  /**
   * Précharge les données nécessaires en fonction de l'étape actuelle
   */
  async preloadDataForCurrentStep() {
    if (!this.apiAvailable) return;
    
    try {
      // Précharger les services si on est à l'étape 2 ou avant
      if (this.state.currentStep <= CONVERSATION_STEPS.SERVICE_SELECTION && 
          (!this.state.availableServices || this.state.availableServices.length === 0)) {
        console.log("Préchargement des services pour l'étape de sélection...");
        const services = await apiService.getOperations();
        if (services && services.length > 0) {
          this.state.availableServices = services;
        }
      }
      
      // Précharger les garages si on est à l'étape 3 ou qu'on va y arriver
      if (this.state.currentStep <= CONVERSATION_STEPS.GARAGE_SELECTION && 
          (!this.state.availableGarages || this.state.availableGarages.length === 0)) {
        console.log("Préchargement des garages pour l'étape de sélection...");
        const garages = await apiService.getAllGarages();
        if (garages && garages.garages && garages.garages.length > 0) {
          this.state.availableGarages = garages.garages;
        }
      }
      
      // Précharger les créneaux si on est à l'étape 4 et qu'on a un garage sélectionné
      if (this.state.currentStep === CONVERSATION_STEPS.TIME_SLOT_SELECTION && 
          this.state.garage.id &&
          (!this.state.availableTimeSlots || this.state.availableTimeSlots.length === 0)) {
        console.log("Préchargement des créneaux pour l'étape de sélection...");
        const availabilities = await apiService.getAvailabilities(
          this.state.garage.id,
          null, // date
          1 // page
        );
        if (availabilities && availabilities.availabilities) {
          this.state.availableTimeSlots = availabilities.availabilities;
        }
      }
    } catch (error) {
      console.error("Erreur lors du préchargement des données:", error);
    }
  }

  /**
   * Génère un résumé de l'état actuel de la réservation
   * @returns {string} Résumé formaté
   */
  getReservationStatusSummary() {
    const parts = [];
    
    if (this.state.vehicle.licensePlate) {
      let vehicleInfo = `Véhicule: ${this.state.vehicle.licensePlate}`;
      if (this.state.vehicle.brand && this.state.vehicle.model) {
        vehicleInfo += ` (${this.state.vehicle.brand} ${this.state.vehicle.model})`;
      }
      parts.push(vehicleInfo);
    }
    
    if (this.state.service.name) {
      let serviceInfo = `Service: ${this.state.service.name}`;
      if (this.state.service.id) {
        serviceInfo += ` (ID: ${this.state.service.id})`;
      }
      parts.push(serviceInfo);
    }
    
    if (this.state.garage.name) {
      let garageInfo = `Garage: ${this.state.garage.name}`;
      if (this.state.garage.id) {
        garageInfo += ` (ID: ${this.state.garage.id})`;
      }
      parts.push(garageInfo);
    }
    
    if (this.state.appointment.date && this.state.appointment.time) {
      parts.push(`Date et heure: ${this.state.appointment.date} à ${this.state.appointment.time}`);
    }
    
    return parts.length > 0 ? parts.join(" | ") : "Aucune information de réservation disponible";
  }

  /**
   * Sauvegarde les messages dans la mémoire
   * @param {string} userInput - Message de l'utilisateur
   * @param {string} botOutput - Réponse du bot
   */
  async saveToMemory(userInput, botOutput) {
    try {
      await this.memory.saveContext(
        { input: userInput },
        { output: botOutput }
      );
    } catch (error) {
      console.error("Erreur lors de la sauvegarde dans la mémoire:", error);
    }
  }
}

module.exports = ChatAgent; 