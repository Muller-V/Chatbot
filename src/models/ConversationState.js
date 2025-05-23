/**
 * Modèle d'état de conversation simplifié pour le nouveau système 9 étapes
 */

const { CONVERSATION_STEPS } = require('../config/constants');

class ConversationState {
  constructor() {
    this.reset();
  }

  reset() {
    // Étape actuelle de la conversation (commence par WELCOME)
    this.currentStep = CONVERSATION_STEPS.WELCOME;
    
    // Informations du véhicule
    this.vehicle = {
      licensePlate: null,
      brand: null,
      model: null,
      id: null,
      confirmed: false
    };

    // Service sélectionné
    this.service = {
      id: null,
      name: null,
      price: null,
      confirmed: false
    };

    // Garage sélectionné
    this.garage = {
      id: null,
      name: null,
      address: null,
      confirmed: false
    };

    // Rendez-vous planifié
    this.appointment = {
      date: null,
      time: null,
      finalConfirmed: false,
      created: false,
      id: null
    };

    // Contexte de conversation
    this.context = {
      problemType: null,       // "batterie", "pneus", etc.
      userPreferences: {},     // Préférences utilisateur
      lastAction: null         // Dernière action effectuée
    };
  }

  /**
   * Vérifie si l'état est prêt pour une progression d'étape
   */
  canAdvanceToStep(targetStep) {
    switch (targetStep) {
      case CONVERSATION_STEPS.REQUEST_PLATE:
        return this.currentStep === CONVERSATION_STEPS.WELCOME;
        
      case CONVERSATION_STEPS.VALIDATE_VEHICLE:
        return this.vehicle.licensePlate !== null;
        
      case CONVERSATION_STEPS.CHOOSE_SERVICE:
        return this.vehicle.confirmed;
        
      case CONVERSATION_STEPS.VALIDATE_SERVICE:
        return this.service.id !== null;
        
      case CONVERSATION_STEPS.CHOOSE_GARAGE:
        return this.service.confirmed;
        
      case CONVERSATION_STEPS.VALIDATE_GARAGE:
        return this.garage.id !== null;
        
      case CONVERSATION_STEPS.CHOOSE_SLOT:
        return this.garage.confirmed;
        
      case CONVERSATION_STEPS.FINAL_VALIDATION:
        return this.appointment.date !== null && this.appointment.time !== null;
        
      default:
        return false;
    }
  }

  /**
   * Retourne un résumé de l'état actuel
   */
  getSummary() {
    return {
      step: this.currentStep,
      vehicle: this.vehicle.confirmed ? `${this.vehicle.brand} ${this.vehicle.model} (${this.vehicle.licensePlate})` : 'Non confirmé',
      service: this.service.confirmed ? `${this.service.name} (${this.service.price}€)` : 'Non confirmé',
      garage: this.garage.confirmed ? this.garage.name : 'Non confirmé',
      appointment: this.appointment.confirmed ? `${this.appointment.date} à ${this.appointment.time}` : 'Non confirmé'
    };
  }
}

module.exports = ConversationState; 