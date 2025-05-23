/**
 * Agent de conversation principal simplifié
 * Gère l'interaction avec le LLM Ollama (temporairement avant Mistral)
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

    // Modèle LLM Ollama (temporairement)
    this.model = null;
    
    // État de la conversation
    this.state = new ConversationState();
    
    // Données préchargées
    this.vehicleData = null;
    this.allServices = [];
    this.allGarages = [];
    this.availableSlots = [];
    
    // Indicateurs de statut
    this.apiAvailable = false;
    this.isProcessing = false;
  }

  /**
   * Initialise l'agent de chat et précharge toutes les données
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

      // Initialiser le modèle Ollama
      this.model = getOllamaModel();
      
      // Authentification avec l'API et préchargement des données
      try {
        const authSuccess = await apiService.authenticate();
        if (authSuccess) {
          this.apiAvailable = true;
          console.log('Authentification API réussie');
          
          // Précharger toutes les données
          await this.preloadAllData();
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
   * Précharge toutes les données nécessaires au démarrage
   */
  async preloadAllData() {
    try {
      // Charger les services
      try {
        const operationsData = await apiService.getOperations();
        if (operationsData && operationsData.length > 0) {
          this.allServices = operationsData;
          console.log(`${operationsData.length} services préchargés`);
        }
      } catch (error) {
        console.warn('Impossible de précharger les services:', error);
      }

      // Charger les garages
      try {
        const garagesData = await apiService.getAllGarages();
        if (garagesData && garagesData.garages && garagesData.garages.length > 0) {
          this.allGarages = garagesData.garages;
          console.log(`${garagesData.garages.length} garages préchargés`);
        }
      } catch (error) {
        console.warn('Impossible de précharger les garages:', error);
      }

      // Charger les créneaux (si possible)
      try {
        const slotsData = await apiService.getAvailabilities();
        if (slotsData && slotsData.availabilities && slotsData.availabilities.length > 0) {
          this.availableSlots = slotsData.availabilities;
          console.log(`${slotsData.availabilities.length} créneaux préchargés`);
        }
      } catch (error) {
        console.warn('Impossible de précharger les créneaux:', error);
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
    if (this.isProcessing) {
      return {
        success: false,
        botResponse: "Je traite votre message précédent, veuillez patienter...",
        processState: { currentStep: this.state.currentStep }
      };
    }

    this.isProcessing = true;

    try {
      // Si première interaction, commencer par l'accueil
      if (this.state.currentStep === 0) {
        this.state.currentStep = CONVERSATION_STEPS.WELCOME;
      }

      // Détecter et charger les données du véhicule si une plaque est fournie
      await this.handleLicensePlateDetection(message);

      // Vérifier les demandes spécifiques de l'utilisateur
      this.handleSpecificUserRequests(message);

      // Générer la réponse avec le LLM
      const prompt = this.constructPrompt(message);
      
      console.log("==== PROMPT ENVOYÉ AU LLM ====");
      console.log(prompt);
      console.log("==============================");
      
      let llmResponse;
      try {
        llmResponse = await this.model.invoke(prompt);
        console.log("==== RÉPONSE BRUTE DU LLM ====");
        console.log(llmResponse);
        console.log("==============================");
      } catch (llmError) {
        console.error("Erreur avec le LLM:", llmError);
        this.isProcessing = false;
        return {
          success: false,
          botResponse: "Je vous prie de m'excuser, j'ai rencontré un problème technique. Pouvez-vous reformuler ?"
        };
      }

      // Parser la réponse du LLM
      const parsedResponse = ResponseParser.parseResponse(llmResponse);
      console.log("==== RÉPONSE PARSÉE ====");
      console.log(JSON.stringify(parsedResponse, null, 2));
      console.log("=======================");

      // Mettre à jour l'état de la conversation
      await this.updateConversationState(parsedResponse, message);

      // Sauvegarder dans la mémoire
      await this.saveToMemory(message, parsedResponse.message);

      this.isProcessing = false;
      return {
        success: true,
        botResponse: parsedResponse.message,
        processState: {
          currentStep: this.state.currentStep,
          extractedData: parsedResponse.extractedData
        }
      };

    } catch (error) {
      console.error('Erreur lors du traitement du message:', error);
      this.isProcessing = false;
      return {
        success: false,
        botResponse: "Je n'ai pas compris votre demande. Pourriez-vous reformuler ?"
      };
    }
  }

  /**
   * Détecte une plaque d'immatriculation et charge les données du véhicule
   */
  async handleLicensePlateDetection(message) {
    const plateRegex = /\b[A-Z]{2}-?\d{3}-?[A-Z]{2}\b/i;
    const plateMatch = message.match(plateRegex);
    
    if (plateMatch && (this.state.currentStep === CONVERSATION_STEPS.REQUEST_PLATE || this.state.currentStep === CONVERSATION_STEPS.WELCOME) && !this.vehicleData) {
      const formattedPlate = plateMatch[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      const finalPlate = `${formattedPlate.slice(0, 2)}-${formattedPlate.slice(2, 5)}-${formattedPlate.slice(5)}`;
      
      console.log(`Plaque détectée: ${finalPlate}`);
      
      if (this.apiAvailable) {
        try {
          const vehicleApiData = await apiService.getVehicleByPlate(finalPlate);
          if (vehicleApiData && vehicleApiData.id) {
            this.vehicleData = {
              licensePlate: finalPlate,
              brand: vehicleApiData.brand || "Marque inconnue",
              model: vehicleApiData.model || "Modèle inconnu",
              id: vehicleApiData.id
            };
            console.log(`Véhicule chargé: ${this.vehicleData.brand} ${this.vehicleData.model}`);
          }
        } catch (error) {
          console.error("Erreur lors du chargement du véhicule:", error);
        }
      }
    }
  }

  /**
   * Gère les demandes spécifiques de l'utilisateur qui pourraient forcer une progression
   */
  handleSpecificUserRequests(message) {
    const messageLower = message.toLowerCase();
    
    // Gérer les demandes générales de rendez-vous
    if ((messageLower.includes('rendez-vous') || messageLower.includes('réparation') || 
         messageLower.includes('service') || messageLower.includes('voiture')) 
        && this.state.currentStep === CONVERSATION_STEPS.REQUEST_PLATE) {
      console.log("Demande générale de rendez-vous détectée");
      // Reste à l'étape 1 mais indique qu'il faut demander la plaque
    }
    
    // Si l'utilisateur demande un garage et qu'on a déjà un service validé
    if ((messageLower.includes('garage') || messageLower.includes('atelier')) 
        && this.state.service.confirmed 
        && this.state.currentStep < CONVERSATION_STEPS.CHOOSE_GARAGE) {
      console.log("Utilisateur demande un garage, progression forcée vers étape 5");
      this.state.currentStep = CONVERSATION_STEPS.CHOOSE_GARAGE;
    }
    
    // Si l'utilisateur demande un créneau et qu'on a déjà un garage validé
    if ((messageLower.includes('créneau') || messageLower.includes('heure') || messageLower.includes('rendez-vous'))
        && this.state.garage.confirmed 
        && this.state.currentStep < CONVERSATION_STEPS.CHOOSE_SLOT) {
      console.log("Utilisateur demande un créneau, progression forcée vers étape 7");
      this.state.currentStep = CONVERSATION_STEPS.CHOOSE_SLOT;
    }
  }

  /**
   * Filtre les services selon le problème mentionné par l'utilisateur
   */
  filterServicesByProblem(message) {
    const messageLower = message.toLowerCase();
    const allServices = this.allServices;
    
    // Définir les mots-clés pour chaque type de problème
    const problemKeywords = {
      batterie: ['batterie', 'battery', 'electrical', 'démarrage', 'charge', 'test batterie'],
      pneus: ['pneu', 'pneus', 'tire', 'roue', 'roues', 'jante'],
      freins: ['frein', 'freins', 'brake', 'plaquette', 'disque'],
      vidange: ['huile', 'oil', 'vidange', 'moteur'],
      révision: ['révision', 'maintenance', 'contrôle', 'entretien']
    };
    
    // Chercher quel problème est mentionné
    for (const [problemType, keywords] of Object.entries(problemKeywords)) {
      for (const keyword of keywords) {
        if (messageLower.includes(keyword)) {
          console.log(`Problème détecté: ${problemType}`);
          
          // Filtrer les services correspondants
          const filteredServices = allServices.filter(service => {
            const serviceName = service.name.toLowerCase();
            return keywords.some(k => serviceName.includes(k));
          });
          
          if (filteredServices.length > 0) {
            console.log(`${filteredServices.length} services trouvés pour le problème ${problemType}:`, 
                       filteredServices.map(s => s.name));
            return filteredServices;
          }
        }
      }
    }
    
    // Si aucun problème spécifique détecté, retourner tous les services
    console.log('Aucun problème spécifique détecté, affichage de tous les services');
    return allServices;
  }

  /**
   * Met à jour l'état de la conversation basé sur la réponse du LLM et le message utilisateur
   */
  async updateConversationState(parsedResponse, userMessage) {
    const extractedData = parsedResponse.extractedData;
    const messageLower = userMessage.toLowerCase();
    
    // Mettre à jour l'étape actuelle seulement si elle progresse logiquement
    if (parsedResponse.currentStep && parsedResponse.currentStep > this.state.currentStep) {
      console.log(`Progression d'étape: ${this.state.currentStep} → ${parsedResponse.currentStep}`);
      this.state.currentStep = parsedResponse.currentStep;
    }

    // Synchroniser les données du véhicule
    if (extractedData.licensePlate && !this.state.vehicle.licensePlate) {
      this.state.vehicle.licensePlate = extractedData.licensePlate;
    }
    if (extractedData.vehicleValidated) {
      this.state.vehicle.confirmed = true;
      console.log("Véhicule marqué comme confirmé dans l'état interne");
    }

    // Synchroniser les données du service
    if (extractedData.serviceId && extractedData.serviceName) {
      this.state.service.id = extractedData.serviceId;
      this.state.service.name = extractedData.serviceName;
      console.log(`Service synchronisé: ${extractedData.serviceName} (${extractedData.serviceId})`);
    }
    if (extractedData.serviceValidated) {
      this.state.service.confirmed = true;
      console.log("Service marqué comme confirmé dans l'état interne");
    }

    // Synchroniser les données du garage
    if (extractedData.garageId && extractedData.garageName) {
      this.state.garage.id = extractedData.garageId;
      this.state.garage.name = extractedData.garageName;
      console.log(`Garage synchronisé: ${extractedData.garageName} (${extractedData.garageId})`);
    }
    if (extractedData.garageValidated) {
      this.state.garage.confirmed = true;
      console.log("Garage marqué comme confirmé dans l'état interne");
    }

    // Synchroniser les données du créneau
    if (extractedData.slotDate && extractedData.slotTime) {
      this.state.appointment.date = extractedData.slotDate;
      this.state.appointment.time = extractedData.slotTime;
      console.log(`Créneau synchronisé: ${extractedData.slotDate} à ${extractedData.slotTime}`);
    }
    if (extractedData.finalConfirmed) {
      this.state.appointment.finalConfirmed = true;
      console.log("Rendez-vous marqué comme confirmé dans l'état interne");
    }

    // Gestion spécifique par étape actuelle avec logique de progression automatique
    switch (this.state.currentStep) {
      
      case CONVERSATION_STEPS.WELCOME:
        // Étape 1: Accueil - progression automatique vers demande plaque
        if (messageLower.includes('rendez-vous') || messageLower.includes('voiture') || messageLower.includes('réparation')) {
          this.state.currentStep = CONVERSATION_STEPS.REQUEST_PLATE;
          console.log("Progression automatique vers étape 2 (demande plaque)");
        }
        break;
        
      case CONVERSATION_STEPS.REQUEST_PLATE:
        // Étape 2: Si plaque détectée, passer à validation véhicule
        if (extractedData.licensePlate || this.vehicleData) {
          this.state.vehicle.licensePlate = extractedData.licensePlate || this.vehicleData?.licensePlate;
          this.state.currentStep = CONVERSATION_STEPS.VALIDATE_VEHICLE;
          console.log("Progression automatique vers étape 3 (validation véhicule)");
        }
        break;
          
      case CONVERSATION_STEPS.VALIDATE_VEHICLE:
        // Étape 3: Si confirmation véhicule, passer au choix service
        if (this.isConfirmation(messageLower) || extractedData.vehicleValidated) {
          this.state.vehicle.confirmed = true;
          this.state.currentStep = CONVERSATION_STEPS.CHOOSE_SERVICE;
          console.log("Progression automatique vers étape 4 (choix service)");
        }
        break;
          
      case CONVERSATION_STEPS.CHOOSE_SERVICE:
        // Étape 4: Si service mentionné/sélectionné, passer à validation
        if (this.isServiceSelection(messageLower) || extractedData.serviceId) {
          if (extractedData.serviceId && extractedData.serviceName) {
            this.state.service.id = extractedData.serviceId;
            this.state.service.name = extractedData.serviceName;
          } else {
            // Essayer de détecter le service dans le message
            this.detectAndSetService(messageLower);
          }
          this.state.currentStep = CONVERSATION_STEPS.VALIDATE_SERVICE;
          console.log("Progression automatique vers étape 5 (validation service)");
        }
        break;
        
      case CONVERSATION_STEPS.VALIDATE_SERVICE:
        // Étape 5: Si confirmation service, passer au choix garage
        if (this.isConfirmation(messageLower) || extractedData.serviceValidated) {
          this.state.service.confirmed = true;
          console.log("Service confirmé par l'utilisateur");
          this.state.currentStep = CONVERSATION_STEPS.CHOOSE_GARAGE;
          console.log("Progression automatique vers étape 6 (choix garage)");
        }
        break;
          
      case CONVERSATION_STEPS.CHOOSE_GARAGE:
        // Étape 6: Si garage mentionné/sélectionné, passer à validation
        if (this.isGarageSelection(messageLower) || extractedData.garageId) {
          if (extractedData.garageId && extractedData.garageName) {
            this.state.garage.id = extractedData.garageId;
            this.state.garage.name = extractedData.garageName;
            console.log(`Garage sélectionné: ${extractedData.garageName} (ID: ${extractedData.garageId})`);
          } else {
            // Essayer de détecter le garage dans le message
            this.detectAndSetGarage(messageLower);
          }
          this.state.currentStep = CONVERSATION_STEPS.VALIDATE_GARAGE;
          console.log("Progression automatique vers étape 7 (validation garage)");
        }
        break;
        
      case CONVERSATION_STEPS.VALIDATE_GARAGE:
        // Étape 7: Si confirmation garage, passer au choix créneau
        if (this.isConfirmation(messageLower) || extractedData.garageValidated) {
          this.state.garage.confirmed = true;
          console.log("Garage confirmé par l'utilisateur");
          this.state.currentStep = CONVERSATION_STEPS.CHOOSE_SLOT;
          console.log("Progression automatique vers étape 8 (choix créneau)");
        }
        break;
          
      case CONVERSATION_STEPS.CHOOSE_SLOT:
        // Étape 8: Si créneau mentionné, passer à validation finale
        if (this.isSlotSelection(messageLower) || (extractedData.slotDate && extractedData.slotTime)) {
          if (extractedData.slotDate && extractedData.slotTime) {
            this.state.appointment.date = extractedData.slotDate;
            this.state.appointment.time = extractedData.slotTime;
          } else {
            // Essayer de détecter le créneau dans le message
            this.detectAndSetSlot(messageLower);
          }
          this.state.currentStep = CONVERSATION_STEPS.FINAL_VALIDATION;
          console.log("Progression automatique vers étape 9 (validation finale)");
        }
        break;
        
      case CONVERSATION_STEPS.FINAL_VALIDATION:
        // Étape 9: Si confirmation finale, terminer
        if (this.isConfirmation(messageLower) || extractedData.finalConfirmed) {
          this.state.appointment.finalConfirmed = true;
          console.log("Rendez-vous confirmé");
          
          // Tenter de créer le rendez-vous via l'API
          const appointmentResult = await this.createAppointment();
          
          // Adapter le message selon le résultat de la création
          if (appointmentResult && this.state.appointment.created) {
            // Succès de la création
            console.log("Rendez-vous créé avec succès, mise à jour du message de réponse");
            
            // Créer un message de succès personnalisé
            const successMessage = this.generateSuccessMessage(appointmentResult);
            
            // Remplacer le message de la réponse parsée par le message de succès
            parsedResponse.message = successMessage;
            
            // Marquer comme confirmé et créé dans les données extraites
            parsedResponse.extractedData.finalConfirmed = true;
            parsedResponse.extractedData.appointmentCreated = true;
            parsedResponse.extractedData.appointmentId = appointmentResult.id || this.state.appointment.id;
            
          } else {
            // Échec de la création
            console.log("Échec de la création du rendez-vous");
            
            // Message d'erreur mais confirmation du processus
            const errorMessage = `Votre demande de rendez-vous a été enregistrée pour le ${this.state.appointment.date} à ${this.state.appointment.time} au garage ${this.state.garage.name}. Cependant, il y a eu un problème technique lors de la création. Veuillez contacter le garage directement pour confirmer votre rendez-vous. Référence: ${this.state.service.name} pour votre ${this.vehicleData?.brand || 'véhicule'} ${this.vehicleData?.model || ''} (${this.state.vehicle.licensePlate}).`;
            
            parsedResponse.message = errorMessage;
            parsedResponse.extractedData.finalConfirmed = true;
            parsedResponse.extractedData.appointmentCreated = false;
          }
        }
        break;
    }
  }

  /**
   * Détecte si le message est une confirmation
   */
  isConfirmation(message) {
    const confirmations = ['oui', 'yes', 'correct', 'exact', 'parfait', 'ok', 'd\'accord', 'confirme', 'c\'est ça'];
    return confirmations.some(word => message.includes(word));
  }

  /**
   * Détecte si le message indique une sélection de service
   */
  isServiceSelection(message) {
    const selections = ['je vais', 'je veux', 'remplacer', 'batterie', 'huile', 'frein', 'pneu'];
    return selections.some(word => message.includes(word));
  }

  /**
   * Détecte si le message indique une sélection de garage
   */
  isGarageSelection(message) {
    const selections = ['lyon', 'paris', 'garage', 'préfère'];
    return selections.some(word => message.includes(word));
  }

  /**
   * Détecte si le message indique une sélection de créneau
   */
  isSlotSelection(message) {
    const timePatterns = [/\d{1,2}:\d{2}/, /\d{1,2}h/, /mai|juin|juillet/, /lundi|mardi|mercredi|jeudi|vendredi/];
    return timePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Essaie de détecter et définir un service dans le message
   */
  detectAndSetService(message) {
    // Rechercher des services correspondants aux mots-clés
    const serviceKeywords = ['batterie', 'huile', 'frein', 'pneu', 'révision'];
    for (const keyword of serviceKeywords) {
      if (message.includes(keyword)) {
        const matchingService = this.allServices.find(s => 
          s.name.toLowerCase().includes(keyword)
        );
        if (matchingService) {
          this.state.service.id = matchingService.id;
          this.state.service.name = matchingService.name;
          console.log(`Service détecté: ${matchingService.name}`);
          break;
        }
      }
    }
  }

  /**
   * Essaie de détecter et définir un garage dans le message
   */
  detectAndSetGarage(message) {
    // Rechercher des garages correspondants aux mots-clés
    const garageKeywords = ['lyon', 'paris', 'marseille', 'nantes'];
    for (const keyword of garageKeywords) {
      if (message.includes(keyword)) {
        const matchingGarage = this.allGarages.find(g => 
          g.name.toLowerCase().includes(keyword)
        );
        if (matchingGarage) {
          this.state.garage.id = matchingGarage.id;
          this.state.garage.name = matchingGarage.name;
          console.log(`Garage détecté: ${matchingGarage.name}`);
          break;
        }
      }
    }
  }

  /**
   * Essaie de détecter et définir un créneau dans le message
   */
  detectAndSetSlot(message) {
    // Patterns améliorés pour détecter date et heure
    const dateMatch = message.match(/(\d{1,2})\s*(mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i);
    const timeMatch = message.match(/(\d{1,2})h?(\d{2})?|(\d{1,2}):(\d{2})/);
    
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthNames = {
        'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08', 
        'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
      };
      const month = monthNames[dateMatch[2].toLowerCase()] || '05';
      const year = new Date().getFullYear(); // Année actuelle
      this.state.appointment.date = `${year}-${month}-${day}`;
      console.log(`Date détectée: ${this.state.appointment.date}`);
    }
    
    if (timeMatch) {
      let hour, minute;
      
      if (timeMatch[3] && timeMatch[4]) {
        // Format HH:MM
        hour = timeMatch[3].padStart(2, '0');
        minute = timeMatch[4];
      } else {
        // Format HHh ou HHhMM
        hour = timeMatch[1].padStart(2, '0');
        minute = timeMatch[2] ? timeMatch[2] : '00';
      }
      
      // Valider l'heure
      const hourNum = parseInt(hour);
      const minuteNum = parseInt(minute);
      
      if (hourNum >= 0 && hourNum <= 23 && minuteNum >= 0 && minuteNum <= 59) {
        this.state.appointment.time = `${hour}:${minute}`;
        console.log(`Heure détectée: ${this.state.appointment.time}`);
      }
    }
    
    // Valider le créneau par rapport aux disponibilités de l'API
    if (this.state.appointment.date && this.state.appointment.time && this.availableSlots.length > 0) {
      const isValidSlot = this.validateSlotAvailability(this.state.appointment.date, this.state.appointment.time);
      if (isValidSlot) {
        console.log(`Créneau validé: ${this.state.appointment.date} à ${this.state.appointment.time}`);
      } else {
        console.warn(`Créneau non disponible: ${this.state.appointment.date} à ${this.state.appointment.time}`);
        // Proposer un créneau alternatif proche
        const alternativeSlot = this.findNearestAvailableSlot(this.state.appointment.date, this.state.appointment.time);
        if (alternativeSlot) {
          this.state.appointment.date = alternativeSlot.date;
          this.state.appointment.time = alternativeSlot.time;
          console.log(`Créneau alternatif proposé: ${alternativeSlot.date} à ${alternativeSlot.time}`);
        }
      }
    }
    
    // Si on a réussi à détecter les deux, confirmer
    if (this.state.appointment.date && this.state.appointment.time) {
      console.log(`Créneau complet détecté: ${this.state.appointment.date} à ${this.state.appointment.time}`);
    } else {
      // Valeurs par défaut si détection partielle
      if (!this.state.appointment.date) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.state.appointment.date = tomorrow.toISOString().split('T')[0];
        console.log(`Date par défaut: ${this.state.appointment.date}`);
      }
      
      if (!this.state.appointment.time) {
        this.state.appointment.time = '09:00';
        console.log(`Heure par défaut: ${this.state.appointment.time}`);
      }
    }
  }

  /**
   * Valide si un créneau est disponible dans la liste des créneaux de l'API
   * @param {string} date - Date au format YYYY-MM-DD
   * @param {string} time - Heure au format HH:MM
   * @returns {boolean} True si le créneau est disponible
   */
  validateSlotAvailability(date, time) {
    if (!this.availableSlots || this.availableSlots.length === 0) {
      return false;
    }
    
    // Chercher la date dans les disponibilités
    const dayAvailability = this.availableSlots.find(slot => slot.date === date);
    if (!dayAvailability) {
      return false;
    }
    
    // Vérifier si l'heure est dans les créneaux disponibles
    if (Array.isArray(dayAvailability.slots)) {
      return dayAvailability.slots.includes(time);
    }
    
    return false;
  }

  /**
   * Trouve le créneau disponible le plus proche d'une date/heure donnée
   * @param {string} targetDate - Date cible au format YYYY-MM-DD
   * @param {string} targetTime - Heure cible au format HH:MM
   * @returns {Object|null} Objet {date, time} du créneau le plus proche ou null
   */
  findNearestAvailableSlot(targetDate, targetTime) {
    if (!this.availableSlots || this.availableSlots.length === 0) {
      return null;
    }
    
    let nearestSlot = null;
    let nearestDiff = Infinity;
    const targetDateTime = new Date(`${targetDate}T${targetTime}:00`);
    
    this.availableSlots.forEach(daySlot => {
      if (Array.isArray(daySlot.slots)) {
        daySlot.slots.forEach(timeSlot => {
          const slotDateTime = new Date(`${daySlot.date}T${timeSlot}:00`);
          const diff = Math.abs(slotDateTime.getTime() - targetDateTime.getTime());
          
          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestSlot = {
              date: daySlot.date,
              time: timeSlot
            };
          }
        });
      }
    });
    
    return nearestSlot;
  }

  /**
   * Crée un rendez-vous via l'API
   */
  async createAppointment() {
    if (!this.apiAvailable) {
      console.log("API non disponible pour créer le rendez-vous");
      return;
    }

    try {
      // Vérifier que toutes les données nécessaires sont disponibles
      if (!this.state.vehicle.licensePlate || !this.state.service.id || !this.state.garage.id) {
        console.error("Données manquantes pour créer le rendez-vous:", {
          licensePlate: this.state.vehicle.licensePlate,
          serviceId: this.state.service.id,
          garageId: this.state.garage.id,
          date: this.state.appointment.date,
          time: this.state.appointment.time
        });
        return;
      }

      // Préparer les données du rendez-vous selon le format attendu par l'API
      const appointmentData = {
        licensePlate: this.state.vehicle.licensePlate,
        serviceId: this.state.service.id,
        garageId: this.state.garage.id,
        date: this.state.appointment.date,
        time: this.state.appointment.time,
        notes: `Rendez-vous pris via le chatbot BOB - ${this.state.service.name} pour ${this.vehicleData?.brand || 'véhicule'} ${this.vehicleData?.model || ''} (${this.state.vehicle.licensePlate})`
      };

      console.log("Création du rendez-vous avec les données:", appointmentData);
      
      const result = await apiService.createAppointment(appointmentData);
      
      if (result) {
        console.log("Rendez-vous créé avec succès:", result);
        
        // Marquer le rendez-vous comme créé dans l'état
        this.state.appointment.created = true;
        this.state.appointment.id = result.id || null;
        
        return result;
      } else {
        console.error("Échec de la création du rendez-vous");
        return null;
      }
      
    } catch (error) {
      console.error("Erreur lors de la création du rendez-vous:", error);
      return null;
    }
  }

  /**
   * Construit le prompt pour le LLM avec toutes les données disponibles et remplace les placeholders
   */
  constructPrompt(message) {
    // Préparer les données pour le template
    const vehicleDataStr = this.vehicleData ? 
      `Plaque: ${this.vehicleData.licensePlate}, Marque: ${this.vehicleData.brand}, Modèle: ${this.vehicleData.model}` : 
      "Aucune données véhicule disponibles";

    // Filtrer les services selon le problème mentionné
    let servicesToShow = this.allServices;
    if (this.state.currentStep === CONVERSATION_STEPS.CHOOSE_SERVICE) {
      servicesToShow = this.filterServicesByProblem(message);
    }

    const servicesStr = this.formatServicesForLLM(servicesToShow);

    const garagesStr = this.allGarages.length > 0 ?
      this.allGarages.slice(0, 5).map(g => `${g.name} (${g.address || 'adresse non disponible'}) - ID: ${g.id}`).join(" | ") :
      "Aucun garage disponible";

    const slotsStr = this.availableSlots.length > 0 ?
      this.availableSlots.slice(0, 5).map(s => `${s.date} à ${Array.isArray(s.slots) ? s.slots.join(', ') : 'horaire à définir'}`).join(" | ") :
      "Aucun créneau disponible";

    // Récupérer l'historique de conversation
    const chatHistory = this.memory.chatHistory || [];
    const historyStr = chatHistory.length > 0 ?
      chatHistory.slice(-10).map(msg => `${msg.type}: ${msg.data.content}`).join("\n") :
      "Début de conversation";

    // Construire le contexte enrichi pour aider le LLM
    let enrichedContext = "";
    
    // Ajouter le contexte du véhicule si disponible
    if (this.vehicleData) {
      enrichedContext += `\n# VÉHICULE ACTUEL
Plaque: ${this.vehicleData.licensePlate}
Marque: ${this.vehicleData.brand}
Modèle: ${this.vehicleData.model}
Confirmé: ${this.state.vehicle.confirmed ? 'OUI' : 'NON'}`;
    }
    
    // Ajouter le contexte du service si sélectionné
    if (this.state.service.id) {
      const service = this.allServices.find(s => s.id === this.state.service.id);
      enrichedContext += `\n# SERVICE SÉLECTIONNÉ
ID: ${this.state.service.id}
Nom: ${this.state.service.name || service?.name}
Prix: ${service?.price || 'Non disponible'}€
Confirmé: ${this.state.service.confirmed ? 'OUI' : 'NON'}`;
    }
    
    // Ajouter le contexte du garage si sélectionné
    if (this.state.garage.id) {
      const garage = this.allGarages.find(g => g.id === this.state.garage.id);
      enrichedContext += `\n# GARAGE SÉLECTIONNÉ
ID: ${this.state.garage.id}
Nom: ${this.state.garage.name || garage?.name}
Adresse: ${garage?.address || 'Non disponible'}
Confirmé: ${this.state.garage.confirmed ? 'OUI' : 'NON'}`;
    }
    
    // Ajouter le contexte du créneau si sélectionné
    if (this.state.appointment.date && this.state.appointment.time) {
      enrichedContext += `\n# CRÉNEAU SÉLECTIONNÉ
Date: ${this.state.appointment.date}
Heure: ${this.state.appointment.time}
Confirmé: ${this.state.appointment.finalConfirmed ? 'OUI' : 'NON'}`;
    }

    // Remplacer les variables dans le template
    let prompt = SYSTEM_TEMPLATE
      .replace(/\{\{CURRENT_STEP\}\}/g, this.state.currentStep)
      .replace('{{VEHICLE_DATA}}', vehicleDataStr)
      .replace('{{AVAILABLE_SERVICES}}', servicesStr)
      .replace('{{NEARBY_GARAGES}}', garagesStr)
      .replace('{{AVAILABLE_SLOTS}}', slotsStr)
      .replace('{{CHAT_HISTORY}}', historyStr)
      .replace('{{USER_INPUT}}', message);
    
    // Ajouter le contexte enrichi si disponible
    if (enrichedContext) {
      prompt += enrichedContext;
    }
    
    // Ajouter des instructions spécifiques selon l'étape
    prompt += this.getStepSpecificInstructions();
    
    return prompt;
  }

  /**
   * Retourne des instructions spécifiques selon l'étape actuelle
   */
  getStepSpecificInstructions() {
    const vehicleInfo = this.vehicleData ? 
      `${this.vehicleData.brand} ${this.vehicleData.model} (${this.vehicleData.licensePlate})` :
      "véhicule non identifié";
    
    const serviceInfo = this.state.service.name ? 
      `${this.state.service.name}` :
      "service non sélectionné";
    
    const garageInfo = this.state.garage.name ? 
      `${this.state.garage.name}` :
      "garage non sélectionné";
    
    const appointmentInfo = this.state.appointment.date && this.state.appointment.time ?
      `${this.state.appointment.date} à ${this.state.appointment.time}` :
      "créneau non sélectionné";

    switch (this.state.currentStep) {
      case CONVERSATION_STEPS.VALIDATE_VEHICLE:
        return `\n# INSTRUCTION SPÉCIALE
Remplacer [MARQUE] par "${this.vehicleData?.brand || 'Marque inconnue'}"
Remplacer [MODÈLE] par "${this.vehicleData?.model || 'Modèle inconnu'}"
Remplacer [PLAQUE] par "${this.vehicleData?.licensePlate || 'Plaque inconnue'}"`;
      
      case CONVERSATION_STEPS.CHOOSE_SERVICE:
      case CONVERSATION_STEPS.VALIDATE_SERVICE:
        return `\n# INSTRUCTION SPÉCIALE
Remplacer [MODÈLE] par "${this.vehicleData?.model || 'Modèle inconnu'}"
Remplacer [SERVICE] par "${serviceInfo}"`;
      
      case CONVERSATION_STEPS.CHOOSE_GARAGE:
      case CONVERSATION_STEPS.VALIDATE_GARAGE:
        return `\n# INSTRUCTION SPÉCIALE
Remplacer [SERVICE] par "${serviceInfo}"
Remplacer [MODÈLE] par "${this.vehicleData?.model || 'Modèle inconnu'}"
Remplacer [GARAGE] par "${garageInfo}"`;
      
      case CONVERSATION_STEPS.CHOOSE_SLOT:
        return `\n# INSTRUCTION SPÉCIALE
Remplacer [GARAGE] par "${garageInfo}"`;
      
      case CONVERSATION_STEPS.FINAL_VALIDATION:
        return `\n# INSTRUCTION SPÉCIALE
Remplacer [SERVICE] par "${serviceInfo}"
Remplacer [MARQUE] par "${this.vehicleData?.brand || 'Marque inconnue'}"
Remplacer [MODÈLE] par "${this.vehicleData?.model || 'Modèle inconnu'}"
Remplacer [PLAQUE] par "${this.vehicleData?.licensePlate || 'Plaque inconnue'}"
Remplacer [DATE] par "${this.state.appointment.date || 'date non spécifiée'}"
Remplacer [HEURE] par "${this.state.appointment.time || 'heure non spécifiée'}"
Remplacer [GARAGE] par "${garageInfo}"`;
      
      default:
        return "";
    }
  }

  /**
   * Sauvegarde l'échange dans la mémoire
   */
  async saveToMemory(userInput, botOutput) {
    try {
      await this.memory.saveContext(
        { input: userInput },
        { output: botOutput }
      );
    } catch (error) {
      console.error('Erreur lors de la sauvegarde en mémoire:', error);
    }
  }

  /**
   * Réinitialise la conversation
   */
  reset() {
    this.state = new ConversationState();
    this.vehicleData = null;
    this.memory.clear();
    this.isProcessing = false;
  }

  /**
   * Génère un message de succès personnalisé après création du rendez-vous
   * @param {Object} appointmentResult - Résultat de la création du rendez-vous
   * @returns {string} Message de succès formaté
   */
  generateSuccessMessage(appointmentResult) {
    const vehicleInfo = this.vehicleData ? 
      `${this.vehicleData.brand} ${this.vehicleData.model}` : 
      'votre véhicule';
    
    const serviceInfo = this.state.service.name || 'le service sélectionné';
    const garageInfo = this.state.garage.name || 'le garage sélectionné';
    const dateInfo = this.state.appointment.date || 'la date sélectionnée';
    const timeInfo = this.state.appointment.time || 'l\'heure sélectionnée';
    const plateInfo = this.state.vehicle.licensePlate || 'votre véhicule';
    
    // Formater la date pour l'affichage
    let formattedDate = dateInfo;
    if (dateInfo && dateInfo.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(dateInfo);
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      formattedDate = date.toLocaleDateString('fr-FR', options);
    }
    
    // Message de succès avec ID de rendez-vous si disponible
    const appointmentId = appointmentResult.id || this.state.appointment.id;
    const idInfo = appointmentId ? ` (Référence: ${appointmentId})` : '';
    
    const successMessage = `🎉 Parfait ! Votre rendez-vous a été confirmé avec succès !

📋 **Récapitulatif de votre rendez-vous :**
• **Véhicule :** ${vehicleInfo} (${plateInfo})
• **Service :** ${serviceInfo}
• **Garage :** ${garageInfo}
• **Date :** ${formattedDate}
• **Heure :** ${timeInfo}${idInfo}

📧 Un email de confirmation vous sera envoyé prochainement avec tous les détails.
📞 En cas de besoin, vous pouvez contacter directement le garage.

Merci d'avoir utilisé nos services ! À bientôt ! 🚗✨`;

    return successMessage;
  }

  /**
   * Formate les services pour l'affichage utilisateur (sans IDs)
   * @param {Array} services - Liste des services
   * @returns {string} Services formatés pour l'utilisateur
   */
  formatServicesForUser(services) {
    if (!services || services.length === 0) {
      return "Aucun service disponible";
    }
    
    return services.slice(0, 5).map(s => `${s.name} (${s.price}€)`).join(", ");
  }

  /**
   * Formate les services pour le LLM (avec IDs)
   * @param {Array} services - Liste des services
   * @returns {string} Services formatés pour le LLM
   */
  formatServicesForLLM(services) {
    if (!services || services.length === 0) {
      return "Aucun service disponible";
    }
    
    return services.slice(0, 5).map(s => `${s.name} (${s.price}€) - ID: ${s.id}`).join(" | ");
  }
}

module.exports = ChatAgent; 