const { BufferMemory } = require("langchain/memory");
const { getOllamaModel } = require("../llm/model");
const { SYSTEM_TEMPLATE, CONVERSATION_STEPS } = require("../config/constants");
const ConversationState = require("../models/ConversationState");
const apiService = require("../services/apiService");
const { detectUserSentiment } = require("../utils/messageParser");

class ChatAgent {
  constructor() {
    this.memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "input",
      outputKey: "output",
      humanPrefix: "User",
      aiPrefix: "Assistant",
    });

    this.model = getOllamaModel();
    this.state = new ConversationState();
    this.apiAvailable = false;
    this.isProcessing = false;
    this.debug = false;
  }

  async initialize() {
    try {
      console.log('Initializing chat agent...');

      this.state = new ConversationState();

      this.memory = new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true,
        inputKey: "input", 
        outputKey: "output",
        humanPrefix: "User",
        aiPrefix: "Assistant",
      });

      this.model = getOllamaModel();
      this.state.availableServices = [];
      this.state.availableGarages = [];

      try {
        const authSuccess = await apiService.authenticate();
        if (authSuccess) {
          this.apiAvailable = true;
          console.log('API authentication successful');
        } else {
          console.warn('API authentication failed, will use fallback data');
          this.apiAvailable = false;
        }
      } catch (authError) {
        console.warn('Error during API authentication:', authError);
        this.apiAvailable = false;
      }

      try {
        const operationsData = await apiService.getOperations();
        if (operationsData && operationsData.length > 0) {
          this.state.availableServices = operationsData;
          console.log(`Services préchargés avec succès (${operationsData.length})`);
          console.log("SERVICES DISPONIBLES:");
          for (const service of operationsData) {
            console.log(`- ${service.id}: ${service.name} (${service.price || 'prix non défini'})`);
          }
        }
      } catch (servicesError) {
        console.warn('Impossible de précharger les services:', servicesError);
        this.state.availableServices = [
          { id: '1', name: 'Vidange', price: '80€' },
          { id: '2', name: 'Service Huile Moteur', price: '75€' },
          { id: '3', name: 'Service Microfiltre d\'huile', price: '45€' },
          { id: '4', name: 'Service Filtre à Air', price: '35€' }
        ];
        console.log("Services de secours chargés:", this.state.availableServices.length);
      }

      try {
        const garagesData = await apiService.getAllGarages();
        if (garagesData && garagesData.garages && garagesData.garages.length > 0) {
          this.state.availableGarages = garagesData.garages;
          console.log(`Garages préchargés avec succès (${garagesData.garages.length})`);
        }
      } catch (garagesError) {
        console.warn('Impossible de précharger les garages:', garagesError);
        this.state.availableGarages = [
          { id: '1', name: 'Paris', address: '23 Avenue de la République, 75011 Paris' },
          { id: '2', name: 'Lyon', address: '6 Rue Joannès Carret, 69009 Lyon' }
        ];
      }

      console.log('Chat agent initialized');
      return this;
    } catch (error) {
      console.error('Error initializing chat agent:', error);
    return this;
    }
  }

  async processMessage(message) {
    try {
      // Prevent concurrent processing with timeout
      if (this.isProcessing) {
        // Vérifier si le traitement est bloqué depuis trop longtemps (plus de 5 secondes)
        const now = Date.now();
        if (this.processingStartTime && (now - this.processingStartTime > 5000)) {
          // Forcer la réinitialisation si bloqué trop longtemps
          console.log("Processus bloqué détecté, réinitialisation forcée");
          this.isProcessing = false;
        } else {
          // Réponse plus utile en cas de traitement en cours
          return {
            success: true,
            botResponse: "Quel service automobile vous intéresse aujourd'hui ?"
          };
        }
      }
      
      // Enregistrer l'heure de début de traitement
      this.isProcessing = true;
      this.processingStartTime = Date.now();
      
      // Handle "continuation" message specially (used for follow-up requests)
      if (message === "continuation") {
        const result = await this.processContinuationMessage();
        this.isProcessing = false;
        this.processingStartTime = null;
        return result;
      }

      // Update sentiment
      this.state.userSentiment = detectUserSentiment(message);
      
      // Increment turn counter
      this.state.turnCount++;
      
      if (this.debug) {
        console.log(`[DEBUG] Current step: ${this.state.currentStep}`);
        console.log(`[DEBUG] Vehicle state: ${JSON.stringify(this.state.vehicle)}`);
        console.log(`[DEBUG] Service state: ${JSON.stringify(this.state.service)}`);
        console.log(`[DEBUG] Garage state: ${JSON.stringify(this.state.garage)}`);
      }
      
      // Forcer la progression si une plaque est détectée et que nous sommes au début
      const licensePlateRegex = /([A-Z]{2})-(\d{3})-([A-Z]{2})/i;
      const plateMatch = message.match(licensePlateRegex);
      
      if (plateMatch && this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
        const licensePlate = plateMatch[0].toUpperCase();
        this.state.vehicle.licensePlate = licensePlate;
        this.state.vehicle.confirmed = true;
        
        // Forcer l'avancement à l'étape suivante
        const didAdvance = this.state.advanceStep();
        
        // Message concis pour la recherche du véhicule
        this.isProcessing = false;
        this.processingStartTime = null;
        
        if (didAdvance) {
          console.log(`[DEBUG] Avancé à l'étape ${this.state.currentStep} après détection de plaque`);
          return {
            success: true,
            botResponse: `Véhicule ${licensePlate} identifié. Quel service souhaitez-vous ?`,
            isLoading: false
          };
        } else {
          return {
            success: true,
            botResponse: `Je recherche votre véhicule ${licensePlate}...`,
            isLoading: true
          };
        }
      }
      
      // Détecter les services spécifiques dans le message si nous sommes à l'étape appropriée
      if ((this.state.currentStep === CONVERSATION_STEPS.SERVICE_SELECTION || 
          (this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION && this.state.vehicle.confirmed)) 
          && !this.state.service.id) {
        const lowerMessage = message.toLowerCase();
        
        // Ajout de détection spécifique pour "Service Huile Moteur"
        if (lowerMessage.includes('huile moteur')) {
          if (this.state.availableServices && this.state.availableServices.length > 0) {
            for (const service of this.state.availableServices) {
              if (service.name && 
                  service.name.toLowerCase().includes('huile moteur')) {
                this.state.service.id = service.id;
                this.state.service.name = service.name;
                this.state.service.price = service.price;
                this.state.service.confirmed = true;
                
                // Si nous sommes encore à l'étape d'identification du véhicule,
                // passer d'abord à la sélection de service
                if (this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
                  this.state.advanceStep();
                }
                
                // Puis avancer à l'étape garage
                this.state.advanceStep();
                
                console.log(`[DEBUG] Service "Huile Moteur" détecté et sélectionné: ${service.id}, étape: ${this.state.currentStep}`);
                
                // Retourner immédiatement pour passer à l'étape suivante
                this.isProcessing = false;
                this.processingStartTime = null;
                return {
                  success: true,
                  botResponse: "Service huile moteur sélectionné. Recherche des garages disponibles...",
                  isLoading: true
                };
              }
            }
          }
        }
        
        // Recherche directe des noms de services exacts y compris "microfiltre"
        if (lowerMessage.includes('microfiltre') || lowerMessage.includes('filtre')) {
          // Chercher dans les services disponibles
          if (this.state.availableServices && this.state.availableServices.length > 0) {
            for (const service of this.state.availableServices) {
              if (service.name && 
                  (service.name.toLowerCase().includes('microfiltre') || 
                   service.name.toLowerCase().includes('filtre'))) {
                this.state.service.id = service.id;
                this.state.service.name = service.name;
                this.state.service.price = service.price;
                this.state.service.confirmed = true;
                
                // Si nous sommes encore à l'étape d'identification du véhicule,
                // passer d'abord à la sélection de service
                if (this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
                  this.state.advanceStep();
                }
                
                // Puis avancer à l'étape garage
                this.state.advanceStep();
                
                console.log(`[DEBUG] Service "Filtre" détecté et sélectionné: ${service.id}, étape: ${this.state.currentStep}`);
                
                // Retourner immédiatement pour passer à l'étape suivante
                this.isProcessing = false;
                this.processingStartTime = null;
                return {
                  success: true,
                  botResponse: `Service ${service.name} sélectionné. Recherche des garages disponibles...`,
                  isLoading: true
                };
              }
            }
          }
        }
        
        // Détection générique de services par mots-clés
        const serviceKeywords = [
          { keyword: 'vidange', id: '1' },
          { keyword: 'pneu', id: '7' },
          { keyword: 'contrôle', id: '8' },
          { keyword: 'frein', id: '5' },
          { keyword: 'climatisation', id: '6' },
          { keyword: 'huile', id: '2' },
          { keyword: 'filtre', id: '9' }
        ];
        
        for (const keyword of serviceKeywords) {
          if (lowerMessage.includes(keyword.keyword)) {
            if (this.state.availableServices && this.state.availableServices.length > 0) {
              for (const service of this.state.availableServices) {
                if ((service.id === keyword.id) || 
                    (service.name && service.name.toLowerCase().includes(keyword.keyword))) {
                  this.state.service.id = service.id;
                  this.state.service.name = service.name;
                  this.state.service.price = service.price;
                  this.state.service.confirmed = true;
                  
                  // Si nous sommes encore à l'étape d'identification du véhicule,
                  // passer d'abord à la sélection de service
                  if (this.state.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
                    this.state.advanceStep();
                  }
                  
                  // Puis avancer à l'étape garage
                  this.state.advanceStep();
                  
                  console.log(`[DEBUG] Service par mot-clé détecté: ${keyword.keyword} -> ${service.id}, étape: ${this.state.currentStep}`);
                  
                  // Retourner immédiatement pour passer à l'étape suivante
                  this.isProcessing = false;
                  this.processingStartTime = null;
                  return {
                    success: true,
                    botResponse: `Service ${service.name} sélectionné. Recherche des garages disponibles...`,
                    isLoading: true
                  };
                }
              }
            }
          }
        }
      }
      
      // Process based on current conversation step
      let response;
      switch (this.state.currentStep) {
        case CONVERSATION_STEPS.VEHICLE_IDENTIFICATION:
          response = await this.handleVehicleIdentificationStep(message);
          break;
        case CONVERSATION_STEPS.SERVICE_SELECTION:
          response = await this.handleServiceSelectionStep(message);
          break;
        case CONVERSATION_STEPS.GARAGE_SELECTION:
          response = await this.handleGarageSelectionStep(message);
          break;
        case CONVERSATION_STEPS.TIME_SLOT_SELECTION:
          response = await this.handleTimeSlotSelectionStep(message);
          break;
        case CONVERSATION_STEPS.CONFIRMATION:
          response = await this.handleConfirmationStep(message);
          break;
        case CONVERSATION_STEPS.COMPLETED:
          response = await this.handleCompletedStep(message);
          break;
        default:
          response = {
            success: true,
            botResponse: "Souhaitez-vous prendre un nouveau rendez-vous ?"
          };
      }
      
      // Save to memory
      await this.saveToMemory(message, response.botResponse);
      
      this.isProcessing = false;
      this.processingStartTime = null;
      return response;
    } catch (error) {
      console.error("Error processing message:", error);
      this.isProcessing = false;
      this.processingStartTime = null;
      return {
        success: false,
        botResponse: "Comment puis-je vous aider avec votre véhicule aujourd'hui ?"
      };
    }
  }

  async processContinuationMessage() {
    try {
      // Si on était en train de traiter un service, on vérifie si on peut avancer
      if (this.state.currentStep === CONVERSATION_STEPS.SERVICE_SELECTION && this.state.service.name) {
        // Si le service a déjà été identifié, mais pas confirmé
        if (!this.state.service.confirmed) {
          this.state.service.confirmed = true;
          this.state.advanceStep();
          
          // Passer immédiatement à la sélection de garage
          return {
            success: true,
            botResponse: "Recherche des garages disponibles...",
            isLoading: true
          };
        }
      }
      
      // Si on était en train de traiter un garage, vérifier si on peut avancer
      if (this.state.currentStep === CONVERSATION_STEPS.GARAGE_SELECTION && this.state.garage.name) {
        if (!this.state.garage.confirmed) {
          this.state.garage.confirmed = true;
          this.state.advanceStep();
          
          // Passer immédiatement à la sélection des horaires
          return {
            success: true,
            botResponse: "Recherche des horaires disponibles pour ce garage...",
            isLoading: true
          };
        }
      }
      
      // Si on était en train de confirmer, faire la confirmation finale
      if (this.state.currentStep === CONVERSATION_STEPS.CONFIRMATION && !this.state.finalConfirmation) {
        // Vérifier que toutes les données sont disponibles, sinon utiliser des valeurs par défaut
        if (!this.state.isReadyForConfirmation()) {
          // Utiliser des valeurs par défaut si nécessaire
          if (!this.state.vehicle.licensePlate) {
            this.state.vehicle.licensePlate = "non spécifié";
          }
          
          if (!this.state.service.id) {
            // Prendre le premier service disponible si aucun n'est sélectionné
            if (this.state.availableServices && this.state.availableServices.length > 0) {
              this.state.service.id = this.state.availableServices[0].id;
              this.state.service.name = this.state.availableServices[0].name;
              this.state.service.price = this.state.availableServices[0].price;
            } else {
              this.state.service.name = "service standard";
            }
          }
          
          if (!this.state.garage.id && this.state.nearbyGarages && this.state.nearbyGarages.length > 0) {
            this.state.garage.id = this.state.nearbyGarages[0].id;
            this.state.garage.name = this.state.nearbyGarages[0].name;
            this.state.garage.address = this.state.nearbyGarages[0].address;
          }
          
          if (!this.state.appointment.date) {
            // Utiliser le lendemain comme date par défaut
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            this.state.appointment.date = tomorrow.toLocaleDateString('fr-FR');
          }
          
          if (!this.state.appointment.time) {
            this.state.appointment.time = "14:00";
          }
        }
        
        this.state.finalConfirmation = true;
        this.state.advanceStep();
        
        return {
          success: true,
          botResponse: `Votre rendez-vous est confirmé pour le ${this.state.appointment.date} à ${this.state.appointment.time}. Merci de votre confiance !`,
        };
      }
      
      // Générer une réponse basée sur l'état actuel
      const prompt = await this.constructPrompt("continuation");
      let botResponse = await this.llm.call(prompt);
      
      // Si la réponse est trop générique, fournir une réponse plus spécifique
      if (botResponse.includes("Je traite votre demande") || 
          botResponse.length < 20 || 
          botResponse.includes("un instant")) {
        
        switch (this.state.currentStep) {
          case CONVERSATION_STEPS.VEHICLE_IDENTIFICATION:
            botResponse = "Pouvez-vous me donner votre plaque d'immatriculation pour commencer ?";
            break;
          case CONVERSATION_STEPS.SERVICE_SELECTION:
            botResponse = "Quel type de service souhaitez-vous pour votre véhicule ?";
            break;
          case CONVERSATION_STEPS.GARAGE_SELECTION:
            botResponse = "Quel garage préférez-vous parmi les options disponibles ?";
            break;
          case CONVERSATION_STEPS.TIME_SLOT_SELECTION:
            botResponse = "Quand souhaitez-vous prendre rendez-vous ?";
            break;
          case CONVERSATION_STEPS.CONFIRMATION:
            botResponse = "Confirmez-vous ce rendez-vous ?";
            break;
          default:
            botResponse = "Comment puis-je vous aider aujourd'hui ?";
        }
      }
      
      return {
        success: true,
        botResponse: botResponse
      };
    } catch (error) {
      console.error("Error processing continuation message:", error);
      return {
        success: false,
        botResponse: "Une erreur est survenue. Comment puis-je vous aider avec votre véhicule ?"
      };
    }
  }

  // Ajouter les méthodes de gestion des étapes
  async handleVehicleIdentificationStep(message) {
    const prompt = await this.constructPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    // Si le traitement de plaque d'immatriculation a été effectué
    // et nous sommes encore dans cette étape, faire progresser manuellement
    if (this.state.vehicle.licensePlate && this.state.vehicle.confirmed) {
      this.state.advanceStep();
      
      return {
        success: true,
        botResponse: `Véhicule ${this.state.vehicle.licensePlate} identifié. Quel service souhaitez-vous ?`,
        isLoading: false
      };
    }
    
    return {
      success: true,
      botResponse: botResponse
    };
  }
  
  async handleServiceSelectionStep(message) {
    const prompt = await this.constructPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return {
      success: true,
      botResponse: botResponse
    };
  }
  
  async handleGarageSelectionStep(message) {
    // Chercher un nom de garage dans le message
    const lowerMessage = message.toLowerCase();
    
    // Vérifier si l'un des noms de garage est mentionné
    if (this.state.availableGarages && this.state.availableGarages.length > 0) {
      for (const garage of this.state.availableGarages) {
        if (garage.name && lowerMessage.includes(garage.name.toLowerCase())) {
          this.state.garage.id = garage.id;
          this.state.garage.name = garage.name;
          this.state.garage.address = garage.address;
          this.state.garage.confirmed = true;
          this.state.advanceStep();
          
          console.log(`[DEBUG] Garage "${garage.name}" détecté et sélectionné, étape: ${this.state.currentStep}`);
          
          return {
            success: true,
            botResponse: `Garage ${garage.name} sélectionné. Quand souhaitez-vous prendre rendez-vous ?`,
            isLoading: false
          };
        }
      }
    }
    
    // Vérifier les noms de ville communs qui pourraient être une demande de garage
    const cityNames = ["paris", "lyon", "marseille", "toulouse", "bordeaux", "lille", "strasbourg", "nantes"];
    
    for (const city of cityNames) {
      if (lowerMessage.includes(city)) {
        // Sélectionner le premier garage disponible par défaut
        if (this.state.availableGarages && this.state.availableGarages.length > 0) {
          const garage = this.state.availableGarages[0];
          this.state.garage.id = garage.id;
          this.state.garage.name = garage.name;
          this.state.garage.address = garage.address;
          this.state.garage.confirmed = true;
          this.state.advanceStep();
          
          console.log(`[DEBUG] Ville "${city}" détectée, garage "${garage.name}" sélectionné, étape: ${this.state.currentStep}`);
          
          return {
            success: true,
            botResponse: `Garage ${garage.name} sélectionné pour ${city}. Quand souhaitez-vous prendre rendez-vous ?`,
            isLoading: false
          };
        }
      }
    }
    
    const prompt = await this.constructPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return {
      success: true,
      botResponse: botResponse
    };
  }
  
  async handleTimeSlotSelectionStep(message) {
    // Vérifier si le message contient des mentions de dates/heures
    const lowerMessage = message.toLowerCase();
    
    // Rechercher des mentions de dates/heures
    const dateTimeRegex = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|aujourd['']hui|[\d]{1,2}\/[\d]{1,2})\b.*?(\d{1,2}[h:]\d{0,2}|\d{1,2}\s*h)/i;
    const timeMatch = message.match(dateTimeRegex);
    
    if (timeMatch) {
      const fullDateTime = timeMatch[0];
      // Extraire date et heure
      const dateMatch = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|aujourd['']hui|[\d]{1,2}\/[\d]{1,2})/i.exec(fullDateTime);
      const timeRegex = /(\d{1,2})[h:](\d{0,2})/i;
      const timeOnlyMatch = fullDateTime.match(timeRegex);
      
      if (dateMatch && timeOnlyMatch) {
        this.state.appointment.date = dateMatch[0];
        this.state.appointment.time = `${timeOnlyMatch[1]}:${timeOnlyMatch[2] || '00'}`;
        this.state.appointment.confirmed = true;
        this.state.advanceStep();
        
        console.log(`[DEBUG] Date/heure détectée: ${this.state.appointment.date} à ${this.state.appointment.time}, étape: ${this.state.currentStep}`);
        
        return {
          success: true,
          botResponse: `Rendez-vous prévu le ${this.state.appointment.date} à ${this.state.appointment.time}. Confirmez-vous ce rendez-vous ?`,
        };
      }
    }
    
    // Détection simplifiée des horaires communs
    const commonTimes = [
      { keyword: "matin", time: "10:00" },
      { keyword: "midi", time: "12:00" },
      { keyword: "après-midi", time: "14:00" },
      { keyword: "soir", time: "17:00" },
      { keyword: "demain", time: "10:00", date: "demain" },
      { keyword: "lundi", time: "10:00", date: "lundi" },
      { keyword: "mardi", time: "10:00", date: "mardi" },
      { keyword: "mercredi", time: "10:00", date: "mercredi" },
      { keyword: "jeudi", time: "10:00", date: "jeudi" },
      { keyword: "vendredi", time: "10:00", date: "vendredi" }
    ];
    
    for (const timeOption of commonTimes) {
      if (lowerMessage.includes(timeOption.keyword)) {
        this.state.appointment.time = timeOption.time;
        
        if (timeOption.date) {
          this.state.appointment.date = timeOption.date;
        } else if (!this.state.appointment.date) {
          this.state.appointment.date = "demain";
        }
        
        this.state.appointment.confirmed = true;
        this.state.advanceStep();
        
        console.log(`[DEBUG] Horaire commun détecté via "${timeOption.keyword}": ${this.state.appointment.date} à ${this.state.appointment.time}, étape: ${this.state.currentStep}`);
        
        return {
          success: true,
          botResponse: `Rendez-vous prévu le ${this.state.appointment.date} à ${this.state.appointment.time}. Confirmez-vous ce rendez-vous ?`,
        };
      }
    }
    
    const prompt = await this.constructPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return {
      success: true,
      botResponse: botResponse
    };
  }
  
  async handleConfirmationStep(message) {
    // Rechercher une confirmation
    const confirmRegex = /(oui|confirme|d['']accord|ok|bien sûr|valide|parfait|très bien|je confirme|tout à fait)/i;
    const confirmMatch = message.match(confirmRegex);
    
    if (confirmMatch) {
      this.state.finalConfirmation = true;
      this.state.advanceStep();
      
      console.log(`[DEBUG] Confirmation détectée via "${confirmMatch[0]}", étape: ${this.state.currentStep}`);
      
      return {
        success: true,
        botResponse: `Votre rendez-vous est confirmé pour le ${this.state.appointment.date || 'jour convenu'} à ${this.state.appointment.time || 'l\'heure convenue'}. Merci de votre confiance !`,
      };
    }
    
    const prompt = await this.constructPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return {
      success: true,
      botResponse: botResponse
    };
  }
  
  async handleCompletedStep(message) {
    // Rechercher une demande de nouveau rendez-vous
    const newAppointmentRegex = /(nouveau|autre|different|encore|refaire)/i;
    const newMatch = message.match(newAppointmentRegex);
    
    if (newMatch) {
      this.state.reset();
      return {
        success: true,
        botResponse: "Très bien, pour un nouveau rendez-vous, pouvez-vous me donner votre plaque d'immatriculation ?"
      };
    }
    
    const prompt = await this.constructPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return {
      success: true,
      botResponse: botResponse
    };
  }
  
  async constructPrompt(message) {
    try {
      // Construire le contexte pour le prompt
      let vehicleData = "Non disponible";
      if (this.state.vehicle.licensePlate) {
        if (this.state.vehicle.brand && this.state.vehicle.model) {
          vehicleData = `Plaque: ${this.state.vehicle.licensePlate}, Marque: ${this.state.vehicle.brand}, Modèle: ${this.state.vehicle.model}`;
        } else {
          vehicleData = `Plaque: ${this.state.vehicle.licensePlate}`;
        }
      }
      
      let availableServices = "Non disponible";
      if (this.state.availableServices && this.state.availableServices.length > 0) {
        availableServices = this.state.availableServices
          .slice(0, 5)
          .map(s => `${s.name} (${s.price || 'prix non disponible'})`)
          .join(", ");
      }
      
      let nearbyGarages = "Non disponible";
      if (this.state.availableGarages && this.state.availableGarages.length > 0) {
        nearbyGarages = this.state.availableGarages
          .slice(0, 5)
          .map(g => g.name)
          .join(", ");
      }
      
      let availableSlots = "Lundi 10h, Mardi 14h, Mercredi 16h";
      
      // Récupérer l'historique de conversation
      const history = await this.memory.loadMemoryVariables({});
      let chatHistory = "";
      if (history && history.chat_history) {
        chatHistory = history.chat_history;
      }
      
      // Remplacer les placeholders dans le template système
      let systemPrompt = SYSTEM_TEMPLATE
        .replace("{{VEHICLE_DATA}}", vehicleData)
        .replace("{{AVAILABLE_SERVICES}}", availableServices)
        .replace("{{NEARBY_GARAGES}}", nearbyGarages)
        .replace("{{AVAILABLE_SLOTS}}", availableSlots)
        .replace("{{CHAT_HISTORY}}", chatHistory)
        .replace("{{USER_INPUT}}", message);
      
      return systemPrompt;
    } catch (error) {
      console.error("Error constructing prompt:", error);
      return SYSTEM_TEMPLATE.replace("{{USER_INPUT}}", message);
    }
  }
  
  async saveToMemory(userInput, botOutput) {
    try {
      await this.memory.saveContext(
        { input: userInput },
        { output: botOutput }
      );
    } catch (error) {
      console.error("Error saving to memory:", error);
    }
  }
}

module.exports = ChatAgent; 