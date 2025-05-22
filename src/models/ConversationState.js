/**
 * Classe représentant l'état de la conversation
 */
const { CONVERSATION_STEPS } = require('../config/constants');

class ConversationState {
  constructor() {
    this.reset();
  }

  /**
   * Réinitialise l'état de la conversation
   */
  reset() {
    this.currentStep = CONVERSATION_STEPS.VEHICLE_IDENTIFICATION;
    
    this.vehicle = {
      licensePlate: null,
      brand: null,
      model: null,
      id: null,
      confirmed: false
    };
    
    this.service = {
      id: null,
      name: null,
      price: null,
      confirmed: false
    };
    
    this.garage = {
      id: null,
      name: null,
      address: null,
      confirmed: false
    };
    
    this.appointment = {
      date: null,
      time: null,
      confirmed: false
    };
    
    this.finalConfirmation = false;
    this.userSentiment = 'neutral';
    this.turnCount = 0;
    this.availableServices = [];
    this.availableGarages = [];
  }

  /**
   * Passe à l'étape suivante
   */
  advanceStep() {
    if (this.currentStep < CONVERSATION_STEPS.COMPLETED) {
      this.currentStep++;
      return true;
    }
    return false;
  }

  /**
   * Vérifie si toutes les informations nécessaires sont disponibles pour la confirmation
   */
  isReadyForConfirmation() {
    return (
      this.vehicle.confirmed &&
      this.service.confirmed &&
      this.garage.confirmed &&
      this.appointment.confirmed
    );
  }

  goToStep(step) {
    if (Object.values(CONVERSATION_STEPS).includes(step)) {
      this.currentStep = step;
      
      if (step === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION || 
          this.currentStep === CONVERSATION_STEPS.VEHICLE_IDENTIFICATION) {
        this.vehicle.confirmed = false;
      }
      
      if (step === CONVERSATION_STEPS.SERVICE_SELECTION || 
          this.currentStep === CONVERSATION_STEPS.SERVICE_SELECTION ||
          !this.vehicle.confirmed) {
        this.service.confirmed = false;
      }
      
      if (step === CONVERSATION_STEPS.GARAGE_SELECTION || 
          this.currentStep === CONVERSATION_STEPS.GARAGE_SELECTION ||
          !this.service.confirmed) {
        this.garage.confirmed = false;
      }
      
      if (step === CONVERSATION_STEPS.TIME_SLOT_SELECTION || 
          this.currentStep === CONVERSATION_STEPS.TIME_SLOT_SELECTION ||
          !this.garage.confirmed) {
        this.appointment.confirmed = false;
      }
      
      this.finalConfirmation = false;
      return true;
    }
    return false;
  }

  generateSummary() {
    let summary = "Récapitulatif de votre rendez-vous :\n";
    
    if (this.vehicle.brand && this.vehicle.model) {
      summary += `- Véhicule : ${this.vehicle.brand} ${this.vehicle.model} (${this.vehicle.licensePlate})\n`;
    } else if (this.vehicle.licensePlate) {
      summary += `- Véhicule : ${this.vehicle.licensePlate}\n`;
    }
    
    if (this.service.name) {
      const priceText = this.service.price ? ` (${this.service.price})` : '';
      summary += `- Service : ${this.service.name}${priceText}\n`;
    }
    
    if (this.garage.name) {
      summary += `- Garage : ${this.garage.name}${this.garage.address ? ` (${this.garage.address})` : ''}\n`;
    }
    
    if (this.appointment.date) {
      const timeText = this.appointment.time ? ` à ${this.appointment.time}` : '';
      summary += `- Date : ${this.appointment.date}${timeText}\n`;
    }
    
    return summary;
  }
}

module.exports = ConversationState; 