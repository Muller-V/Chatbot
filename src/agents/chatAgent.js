/**
 * Garage booking chatbot agent
 * Handles conversation flow, state management, and API integration
 */
const { BufferMemory } = require("langchain/memory");
const { getOllamaModel } = require("../llm/model");
const { SYSTEM_TEMPLATE, CONVERSATION_STEPS, DEFAULT_SERVICES, DEFAULT_GARAGES } = require("../config/constants");
const ConversationState = require("../models/ConversationState");
const apiService = require("../services/apiService");

// Utility for detecting user sentiment
const { detectUserSentiment } = require("../utils/messageParser");

class ChatAgent {
  constructor() {
    // Memory for conversation history
    this.memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "input",
      outputKey: "output",
      humanPrefix: "User",
      aiPrefix: "Assistant",
    });

    // LLM model
    this.model = getOllamaModel();
    
    // Conversation state
    this.state = new ConversationState();
    
    // API status
    this.apiAvailable = false;
    
    // Processing flags
    this.isProcessing = false;
  }

  /**
   * Initialize the agent
   * @returns {Promise<ChatAgent>} This agent instance
   */
  async initialize() {
    this.apiAvailable = await apiService.checkApiAvailability();
    console.log(`API available: ${this.apiAvailable ? 'yes' : 'no, using mock data'}`);
    return this;
  }

  /**
   * Process a user message
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string, isLoading?: boolean}>} Bot response
   */
  async processMessage(message) {
    try {
      // Prevent concurrent processing
      if (this.isProcessing) {
        return {
          success: true,
          botResponse: "Je suis en train de traiter votre demande, un instant s'il vous plaît..."
        };
      }
      
      this.isProcessing = true;
      
      // Handle "continuation" message specially (used for follow-up requests)
      if (message === "continuation") {
        return await this.processContinuationMessage();
      }

      // Update sentiment
      this.state.userSentiment = detectUserSentiment(message);
      
      // Increment turn counter
      this.state.turnCount++;
      
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
            botResponse: "Je ne comprends pas où nous en sommes. Souhaitez-vous prendre un nouveau rendez-vous ?"
          };
      }
      
      // Save to memory
      await this.saveToMemory(message, response.botResponse);
      
      this.isProcessing = false;
      return response;
    } catch (error) {
      console.error("Error processing message:", error);
      this.isProcessing = false;
      return {
        success: false,
        botResponse: "Je suis désolé, une erreur est survenue. Comment puis-je vous aider avec votre véhicule aujourd'hui ?"
      };
    }
  }

  /**
   * Handle continuation message when retrieving data from backend
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async processContinuationMessage() {
    let response = {
      success: true,
      botResponse: "Je n'ai pas pu terminer l'opération précédente. Comment puis-je vous aider ?"
    };
    
    // Process based on current step
    switch (this.state.currentStep) {
      case CONVERSATION_STEPS.VEHICLE_IDENTIFICATION:
        if (this.state.vehicle.licensePlate) {
          response = await this.handleVehicleDataResponse();
        }
        break;
      case CONVERSATION_STEPS.SERVICE_SELECTION:
        response = await this.handleServiceDataResponse();
        break;
      case CONVERSATION_STEPS.GARAGE_SELECTION:
        response = await this.handleGarageDataResponse();
        break;
      case CONVERSATION_STEPS.TIME_SLOT_SELECTION:
        response = await this.handleTimeSlotDataResponse();
        break;
    }
    
    this.isProcessing = false;
    return response;
  }

  /**
   * Handle vehicle identification step
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string, isLoading?: boolean}>} Bot response
   */
  async handleVehicleIdentificationStep(message) {
    // Check for license plate in message using regex
    const licensePlateRegex = /([A-Z]{2})-(\d{3})-([A-Z]{2})/i;
    const match = message.match(licensePlateRegex);
    
    if (match) {
      const licensePlate = match[0].toUpperCase();
      this.state.vehicle.licensePlate = licensePlate;
      
      // Signal we're looking up vehicle information with a more conversational response
          return {
            success: true,
        botResponse: `Merci pour votre plaque d'immatriculation ${licensePlate}. Je consulte notre base de données pour récupérer les informations de votre véhicule. Un instant s'il vous plaît...`,
        isLoading: true
      };
    }
    
    // If we're at the beginning of the conversation, be more direct about asking for the license plate
    if (this.state.turnCount <= 1) {
          return {
            success: true,
        botResponse: "Bonjour ! Je suis BOB, votre assistant de réservation Auto Service Pro. Pour commencer, pourriez-vous me communiquer votre plaque d'immatriculation au format AA-123-AA ?"
      };
    }
    
    // If no license plate found in message, ask using the LLM with context about current step
    const prompt = await this.buildSystemPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return { success: true, botResponse };
  }

  /**
   * Handle response after vehicle data lookup
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async handleVehicleDataResponse() {
    try {
      // Get vehicle info from API
      const vehicleData = this.apiAvailable 
        ? await apiService.getVehicleInfo(this.state.vehicle.licensePlate)
        : { brand: "Renault", model: "Clio", year: "2020" };  // Mock data if API unavailable
      
      if (vehicleData) {
        this.state.vehicle.brand = vehicleData.brand;
        this.state.vehicle.model = vehicleData.model;
        
        // Generate confirmation message for vehicle with a more conversational tone
        const confirmMessage = `J'ai trouvé votre véhicule dans notre base de données ! Il s'agit d'une ${vehicleData.brand} ${vehicleData.model} (immatriculation ${this.state.vehicle.licensePlate}). Est-ce bien votre véhicule ?`;
        return { success: true, botResponse: confirmMessage };
      } else {
        const errorMessage = `Je n'ai pas trouvé de véhicule correspondant à l'immatriculation ${this.state.vehicle.licensePlate} dans notre base de données. Pourriez-vous vérifier que la plaque est correcte ou nous fournir un autre numéro d'immatriculation ?`;
        this.state.vehicle.licensePlate = null;
        return { success: true, botResponse: errorMessage };
      }
    } catch (error) {
      console.error("Error retrieving vehicle data:", error);
      return {
        success: true,
        botResponse: "Désolé, je n'ai pas pu accéder aux informations de votre véhicule dans notre système. Pourriez-vous vérifier votre plaque d'immatriculation et la saisir à nouveau au format AA-123-AA ?"
      };
    }
  }

  /**
   * Handle service selection step
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string, isLoading?: boolean}>} Bot response
   */
  async handleServiceSelectionStep(message) {
    // Check for confirmation of vehicle
    if (/\b(oui|correct|exact|confirme|bon|bonne|d'accord|c'est ça|bien|ok)\b/i.test(message)) {
      this.state.vehicle.confirmed = true;
      this.state.advanceStep();
      
      // Signal we're getting services with a more conversational message
      return {
        success: true,
        botResponse: "Parfait ! Maintenant que votre véhicule est identifié, je recherche les services disponibles dans nos garages. Un instant s'il vous plaît...",
        isLoading: true
      };
    }
    
    // If the user wants to change the vehicle
    if (/\b(non|incorrect|faux|mauvais|erreur|changer|pas bon|pas correct)\b/i.test(message)) {
      this.state.vehicle.licensePlate = null;
      this.state.vehicle.brand = null;
      this.state.vehicle.model = null;
      
      return {
        success: true,
        botResponse: "Je comprends. Pourriez-vous me fournir à nouveau votre plaque d'immatriculation au format AA-123-AA pour que je puisse identifier correctement votre véhicule ?"
      };
    }
    
    // Default response using LLM
    const prompt = await this.buildSystemPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return { success: true, botResponse };
  }

  /**
   * Handle response after service data lookup
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async handleServiceDataResponse() {
    try {
      // Get services from API
      const services = this.apiAvailable
        ? await apiService.getOperations()
        : [
            { id: '1', name: 'Vidange', price: '80€' },
            { id: '7', name: 'Changement de pneus', price: '70€ par pneu' },
            { id: '8', name: 'Contrôle technique', price: '89€' },
            { id: '5', name: 'Réparation des freins', price: '120€' },
            { id: '6', name: 'Entretien climatisation', price: '60€' }
          ];
      
      // Format services for display - limit to 5 most common
      const topServices = services.slice(0, 5);
      const servicesText = topServices.map(s => `- ${s.name} (${s.price || 'prix sur devis'})`)
        .join('\n');
      
      // Craft a more engaging response
      return {
        success: true,
        botResponse: `Voici les services les plus populaires pour votre ${this.state.vehicle.brand} ${this.state.vehicle.model} :\n${servicesText}\n\nQuel service vous intéresse aujourd'hui ?`
      };
    } catch (error) {
      console.error("Error retrieving service data:", error);
      return {
        success: true,
        botResponse: "Je suis désolé, je n'ai pas pu récupérer la liste complète des services. Nous proposons notamment la vidange (80€), le changement de pneus (70€/pneu), le contrôle technique (89€), les freins (120€) et la climatisation (60€). Quel entretien souhaitez-vous pour votre véhicule ?"
      };
    }
  }

  /**
   * Handle garage selection step
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string, isLoading?: boolean}>} Bot response
   */
  async handleGarageSelectionStep(message) {
    // Try to identify service from message
    if (!this.state.service.id) {
      // Simple service detection logic
      if (/\bvidange\b/i.test(message)) {
        this.state.service.id = '1';
        this.state.service.name = 'Vidange';
        this.state.service.price = '80€';
      } else if (/\bpneus?\b/i.test(message)) {
        this.state.service.id = '7';
        this.state.service.name = 'Changement de pneus';
        this.state.service.price = '70€ par pneu';
      } else if (/\b(contrôle|controle)(\s+technique)?\b/i.test(message)) {
        this.state.service.id = '8';
        this.state.service.name = 'Contrôle technique';
        this.state.service.price = '89€';
      } else if (/\bfreins?\b/i.test(message)) {
        this.state.service.id = '5';
        this.state.service.name = 'Réparation des freins';
        this.state.service.price = '120€';
      } else if (/\bclimatisation\b/i.test(message)) {
        this.state.service.id = '6';
        this.state.service.name = 'Entretien climatisation';
        this.state.service.price = '60€';
      }
    }
    
    // If service identified, look for confirmation
    if (this.state.service.id) {
      if (/\b(oui|correct|exact|confirme|bon|bonne|d'accord)\b/i.test(message)) {
        this.state.service.confirmed = true;
        this.state.advanceStep();
        return {
          success: true,
          botResponse: "Je recherche les garages les plus proches de vous...",
          isLoading: true
        };
      }
    } else {
      // Service not identified yet, use LLM to respond
      const prompt = await this.buildSystemPrompt(message);
      const botResponse = await this.model.call(prompt);
      return { success: true, botResponse };
    }
    
    // Default response - confirm service selection
    return {
      success: true,
      botResponse: `Vous avez sélectionné : ${this.state.service.name} (${this.state.service.price}). Est-ce correct ?`
    };
  }

  /**
   * Handle response after garage data lookup
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async handleGarageDataResponse() {
    try {
      // Get garages from API
      const garages = this.apiAvailable
        ? await apiService.getAllGarages()
        : [
            { id: '1', name: 'Paris', address: '23 Avenue de la République, 75011 Paris' },
            { id: '4', name: 'Lyon', address: '6 Rue Joannès Carret, 69009 Lyon' },
            { id: '6', name: 'Nice', address: '116 Avenue Simone Veil, 06200 Nice' }
          ];
      
      // Format garages for display (limit to 3)
      const garagesToShow = garages.slice(0, 3);
      const garagesText = garagesToShow
        .map(g => `- ${g.name} (${g.address})`)
        .join('\n');
      
      return {
        success: true,
        botResponse: `Voici nos garages disponibles :\n${garagesText}\n\nQuel garage préférez-vous pour votre ${this.state.service.name} ?`
      };
    } catch (error) {
      console.error("Error retrieving garage data:", error);
      return {
        success: true,
        botResponse: "Je suis désolé, je n'ai pas pu récupérer la liste des garages. Souhaitez-vous prendre rendez-vous à Lyon, Nice ou Paris ?"
      };
    }
  }

  /**
   * Handle time slot selection step
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string, isLoading?: boolean}>} Bot response
   */
  async handleTimeSlotSelectionStep(message) {
    // Try to identify garage from message
    if (!this.state.garage.id) {
      if (/\bparis\b/i.test(message)) {
        this.state.garage.id = '1';
        this.state.garage.name = 'Paris';
      } else if (/\blyon\b/i.test(message)) {
        this.state.garage.id = '4';
        this.state.garage.name = 'Lyon';
      } else if (/\bnice\b/i.test(message)) {
        this.state.garage.id = '6';
        this.state.garage.name = 'Nice';
      }
    }
    
    // If garage identified, look for confirmation
    if (this.state.garage.id) {
      if (/\b(oui|correct|exact|confirme|bon|bonne|d'accord)\b/i.test(message)) {
        this.state.garage.confirmed = true;
        this.state.advanceStep();
        return {
          success: true,
          botResponse: "Je consulte les créneaux disponibles...",
          isLoading: true
        };
      }
    } else {
      // Garage not identified yet, use LLM to respond
      const prompt = await this.buildSystemPrompt(message);
      const botResponse = await this.model.call(prompt);
      return { success: true, botResponse };
    }
    
    // Default response - confirm garage selection
    return {
      success: true,
      botResponse: `Vous avez choisi le garage de ${this.state.garage.name}. Est-ce correct ?`
    };
  }

  /**
   * Handle response after time slot data lookup
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async handleTimeSlotDataResponse() {
    try {
      // Default date (next Monday)
      const today = new Date();
      const nextMonday = new Date(today.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7));
      const dateStr = nextMonday.toISOString().split('T')[0];
      
      // Get time slots from API
      const slots = this.apiAvailable
        ? await apiService.getAvailableTimeSlots(this.state.garage.id, this.state.service.id, dateStr)
        : [
            { date: dateStr, time: '09:00', available: true },
            { date: dateStr, time: '10:30', available: true },
            { date: dateStr, time: '14:00', available: true },
            { date: dateStr, time: '16:30', available: true }
          ];
      
      // Format date for display (French format)
      const displayDate = new Date(dateStr)
        .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      // Filter available slots
      const availableSlots = slots.filter(slot => slot.available);
      
      if (availableSlots.length === 0) {
        return {
          success: true,
          botResponse: `Désolé, aucun créneau n'est disponible le ${displayDate}. Souhaitez-vous essayer un autre jour ?`
        };
      }
      
      // Format slots for display
      const slotsText = availableSlots
        .map(slot => `- ${slot.time}`)
        .join('\n');
      
      return {
        success: true,
        botResponse: `Voici les créneaux disponibles le ${displayDate} au garage de ${this.state.garage.name} :\n${slotsText}\n\nQuelle heure vous conviendrait ?`
      };
    } catch (error) {
      console.error("Error retrieving time slot data:", error);
      return {
        success: true,
        botResponse: "Je suis désolé, je n'ai pas pu récupérer les créneaux disponibles. À quelle date et heure souhaiteriez-vous prendre rendez-vous ?"
      };
    }
  }

  /**
   * Handle confirmation step
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async handleConfirmationStep(message) {
    // Try to identify date/time from message
    if (!this.state.appointment.time) {
      // Simple time detection logic
      const timeRegex = /\b(\d{1,2})[h:](\d{0,2})\b/i;
      const timeMatch = message.match(timeRegex);
      
      if (timeMatch) {
        const hours = timeMatch[1];
        const minutes = timeMatch[2] || '00';
        this.state.appointment.time = `${hours}h${minutes}`;
        
        // Set default date if not already set (next Monday)
        if (!this.state.appointment.date) {
          const today = new Date();
          const nextMonday = new Date(today.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7));
          this.state.appointment.date = nextMonday.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
          });
        }
      }
    }
    
    // If time identified, look for confirmation
    if (this.state.appointment.time) {
      if (/\b(oui|correct|exact|confirme|bon|bonne|d'accord)\b/i.test(message)) {
        this.state.appointment.confirmed = true;
        this.state.advanceStep();
        
        // Generate booking summary
        const summary = this.state.generateSummary();
        
    return {
      success: true,
          botResponse: `${summary}\nVeuillez confirmer ce rendez-vous en répondant par "oui" ou "non".`
        };
      }
    } else {
      // Time not identified yet, use LLM to respond
      const prompt = await this.buildSystemPrompt(message);
      const botResponse = await this.model.call(prompt);
      return { success: true, botResponse };
    }
    
    // Default response - confirm time selection
    return {
      success: true,
      botResponse: `Vous avez choisi le créneau de ${this.state.appointment.time}${this.state.appointment.date ? ` le ${this.state.appointment.date}` : ''}. Est-ce correct ?`
    };
  }

  /**
   * Handle final confirmation and appointment booking
   * @param {string} message - User message
   * @returns {Promise<{success: boolean, botResponse: string}>} Bot response
   */
  async handleCompletedStep(message) {
    // Check for confirmation
    if (/\b(oui|correct|exact|confirme|d'accord)\b/i.test(message)) {
      // Attempt to book appointment
        const appointmentData = {
        service_id: this.state.service.id,
        garage_id: this.state.garage.id,
        datetime: this.formatDateTimeForApi(),
        license_plate: this.state.vehicle.licensePlate,
          vehicle_info: {
          brand: this.state.vehicle.brand,
          model: this.state.vehicle.model
        }
      };
      
      const success = this.apiAvailable 
        ? await apiService.bookAppointment(appointmentData)
        : true;
      
      if (success) {
        const confirmMessage = `Super ! Votre rendez-vous est confirmé pour une ${this.state.service.name} de votre ${this.state.vehicle.brand} ${this.state.vehicle.model}, le ${this.state.appointment.date} à ${this.state.appointment.time} au garage de ${this.state.garage.name}. Merci de votre confiance !`;
        
        // Reset state for a new conversation
        this.reset();
        
        return { success: true, botResponse: confirmMessage };
      } else {
        return { 
          success: true, 
          botResponse: "Je suis désolé, je n'ai pas pu confirmer votre rendez-vous. Souhaitez-vous essayer à nouveau ou choisir un autre créneau ?"
        };
      }
    } else if (/\b(non|incorrect|faux|mauvais|erreur|annul|changer)\b/i.test(message)) {
      // Go back to service selection to start over
      this.state.goToStep(CONVERSATION_STEPS.SERVICE_SELECTION);
      return {
        success: true,
        botResponse: "D'accord, reprenons. Quel service souhaitez-vous pour votre véhicule ?"
      };
    }
    
    // Default response using LLM
    const prompt = await this.buildSystemPrompt(message);
    const botResponse = await this.model.call(prompt);
    
    return { success: true, botResponse };
  }

  /**
   * Build the system prompt with current conversation state
   * @param {string} userInput - User message
   * @returns {Promise<string>} Complete system prompt
   */
  async buildSystemPrompt(userInput) {
    try {
      // Get chat history
      const memoryVariables = await this.memory.loadMemoryVariables({});
      let chatHistory = "";
      
      if (memoryVariables && memoryVariables.chat_history) {
        if (typeof memoryVariables.chat_history === 'string') {
          chatHistory = memoryVariables.chat_history;
        } else if (typeof memoryVariables.chat_history.then === 'function') {
          chatHistory = await memoryVariables.chat_history;
        } else {
          chatHistory = JSON.stringify(memoryVariables.chat_history);
        }
      }
      
      // Prepare data for prompt placeholders
      let vehicleData = "Information véhicule non disponible";
      if (this.state.vehicle.brand && this.state.vehicle.model) {
        vehicleData = `${this.state.vehicle.brand} ${this.state.vehicle.model} (immatriculation: ${this.state.vehicle.licensePlate})`;
      } else if (this.state.vehicle.licensePlate) {
        vehicleData = `Immatriculation: ${this.state.vehicle.licensePlate}, informations détaillées en attente`;
      }
      
      // Format available services
      const servicesData = Object.values(DEFAULT_SERVICES)
        .map(service => `${service.name} (${service.price}) - ${service.description}`)
        .join('\n');
      
      // Format garages
      const garagesData = DEFAULT_GARAGES
        .map(garage => `${garage.name} (${garage.address})`)
        .join('\n');
      
      // Format time slots (mock for now)
      const timeSlots = [
        "Lundi: 9h00, 11h00, 14h00, 16h00",
        "Mardi: 9h00, 11h00, 14h00, 16h00",
        "Mercredi: 9h00, 11h00, 14h00, 16h00"
      ].join('\n');
      
      // Add current step information to help guide the model's focus
      let currentStepInfo = "";
      switch(this.state.currentStep) {
        case CONVERSATION_STEPS.VEHICLE_IDENTIFICATION:
          currentStepInfo = `ÉTAPE ACTUELLE: IDENTIFICATION DU VÉHICULE
          - Vous êtes à la première étape du processus de réservation
          - Objectif: obtenir et confirmer la plaque d'immatriculation du véhicule
          - Si la plaque est déjà fournie: ${this.state.vehicle.licensePlate || "non fournie"}
          - Prochaine étape: sélection du service après confirmation du véhicule`;
          break;
        case CONVERSATION_STEPS.SERVICE_SELECTION:
          currentStepInfo = `ÉTAPE ACTUELLE: SÉLECTION DU SERVICE
          - Vous êtes à la deuxième étape du processus de réservation
          - Le véhicule a été identifié: ${vehicleData}
          - Objectif: aider l'utilisateur à choisir un service approprié
          - Service actuellement sélectionné: ${this.state.service.name || "aucun"}
          - Prochaine étape: choix du garage après confirmation du service`;
          break;
        case CONVERSATION_STEPS.GARAGE_SELECTION:
          currentStepInfo = `ÉTAPE ACTUELLE: SÉLECTION DU GARAGE
          - Vous êtes à la troisième étape du processus de réservation
          - Véhicule identifié: ${vehicleData}
          - Service sélectionné: ${this.state.service.name || "à déterminer"}
          - Objectif: aider l'utilisateur à choisir un garage
          - Garage actuellement sélectionné: ${this.state.garage.name || "aucun"}
          - Prochaine étape: choix du créneau horaire après confirmation du garage`;
          break;
        case CONVERSATION_STEPS.TIME_SLOT_SELECTION:
          currentStepInfo = `ÉTAPE ACTUELLE: SÉLECTION DU CRÉNEAU HORAIRE
          - Vous êtes à la quatrième étape du processus de réservation
          - Véhicule identifié: ${vehicleData}
          - Service sélectionné: ${this.state.service.name}
          - Garage sélectionné: ${this.state.garage.name}
          - Objectif: aider l'utilisateur à choisir une date et heure de rendez-vous
          - Créneau actuellement sélectionné: ${this.state.appointment.date ? `${this.state.appointment.date} à ${this.state.appointment.time}` : "aucun"}
          - Prochaine étape: confirmation finale après choix du créneau`;
          break;
        case CONVERSATION_STEPS.CONFIRMATION:
          currentStepInfo = `ÉTAPE ACTUELLE: CONFIRMATION FINALE
          - Vous êtes à la dernière étape du processus de réservation
          - Objectif: obtenir la confirmation finale de l'utilisateur pour valider le rendez-vous
          - Résumé complet à présenter à l'utilisateur
          - Après confirmation: remercier l'utilisateur et fournir un numéro de référence`;
          break;
      }
      
      // Replace placeholder values in the system prompt
      let prompt = SYSTEM_TEMPLATE
        .replace("{{VEHICLE_DATA}}", vehicleData)
        .replace("{{AVAILABLE_SERVICES}}", servicesData)
        .replace("{{NEARBY_GARAGES}}", garagesData)
        .replace("{{AVAILABLE_SLOTS}}", timeSlots)
        .replace("{{CHAT_HISTORY}}", chatHistory)
        .replace("{{USER_INPUT}}", userInput);
      
      // Add the current step information to the prompt
      prompt = prompt.replace("# CONVERSATION HISTORY", `# CURRENT STEP FOCUS\n${currentStepInfo}\n\n# CONVERSATION HISTORY`);
      
      return prompt;
    } catch (error) {
      console.error("Error building prompt:", error);
      // Fallback prompt
      return `Tu es un assistant de garage automobile nommé BOB. Réponds en français à cette demande: ${userInput}`;
    }
  }

  /**
   * Format date and time for API
   * @returns {string} Formatted date and time
   */
  formatDateTimeForApi() {
    try {
      // Extract date components
      const dateStr = this.state.appointment.date;
      const timeStr = this.state.appointment.time;
      
      // Default to current date + 1 week if date not specified
      if (!dateStr) {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return `${date.toISOString().split('T')[0]}T${timeStr.replace('h', ':')}:00`;
      }
      
      // Parse French date format (needs improvement for production)
      const months = {
        'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
        'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
        'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
      };
      
      // Very basic parsing - in production, use a proper date parsing library
      const dateMatch = dateStr.match(/(\d+)\s+(\w+)\s+(\d{4})/);
      if (!dateMatch) return new Date().toISOString();
      
      const day = dateMatch[1].padStart(2, '0');
      const month = months[dateMatch[2].toLowerCase()] || '01';
      const year = dateMatch[3];
      
      // Parse time
      const time = timeStr ? timeStr.replace('h', ':') : '10:00';
      
      return `${year}-${month}-${day}T${time}:00`;
    } catch (error) {
      console.error("Error formatting date for API:", error);
      return new Date().toISOString();
    }
  }

  /**
   * Save message and response to memory
   * @param {string} message - User message
   * @param {string} response - Bot response
   */
  async saveToMemory(message, response) {
    try {
      await this.memory.saveContext({ input: message }, { output: response });
    } catch (error) {
      console.error("Error saving to memory:", error);
    }
  }

  /**
   * Reset the agent
   */
  reset() {
    // Reset state
    this.state.reset();
    
    // Reset memory
    this.memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      inputKey: "input", 
      outputKey: "output",
      humanPrefix: "User",
      aiPrefix: "Assistant",
    });
    
    // Reset model
    this.model = getOllamaModel();
    
    // Reset flags
    this.isProcessing = false;
  }
}

module.exports = ChatAgent; 