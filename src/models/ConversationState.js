/**
 * Class representing the chatbot conversation state
 * Manages the step-by-step flow of the booking process
 */
const { CONVERSATION_STEPS } = require('../config/constants');

class ConversationState {
  constructor() {
    this.reset();
  }

  /**
   * Reset the conversation state
   */
  reset() {
    // Current conversation step
    this.currentStep = CONVERSATION_STEPS.VEHICLE_IDENTIFICATION;
    
    // Vehicle information
    this.vehicle = {
      licensePlate: null,
      brand: null,
      model: null,
      confirmed: false
    };
    
    // Service information
    this.service = {
      id: null,
      name: null,
      price: null,
      confirmed: false
    };
    
    // Garage information
    this.garage = {
      id: null,
      name: null,
      address: null,
      confirmed: false
    };
    
    // Appointment information
    this.appointment = {
      date: null,
      time: null,
      confirmed: false
    };
    
    // Final confirmation status
    this.finalConfirmation = false;
    
    // User sentiment for response adaptation
    this.userSentiment = {
      isUrgent: false,
      isFrustrated: false,
      isPositive: false
    };
    
    // Metadata
    this.turnCount = 0;
    this.lastApiCallTime = null;
  }

  /**
   * Move to the next conversation step if current step is confirmed
   */
  advanceStep() {
    // Only advance if current step is confirmed
    switch(this.currentStep) {
      case CONVERSATION_STEPS.VEHICLE_IDENTIFICATION:
        if (this.vehicle.confirmed) {
          this.currentStep = CONVERSATION_STEPS.SERVICE_SELECTION;
          return true;
        }
        break;
      case CONVERSATION_STEPS.SERVICE_SELECTION:
        if (this.service.confirmed) {
          this.currentStep = CONVERSATION_STEPS.GARAGE_SELECTION;
          return true;
        }
        break;
      case CONVERSATION_STEPS.GARAGE_SELECTION:
        if (this.garage.confirmed) {
          this.currentStep = CONVERSATION_STEPS.TIME_SLOT_SELECTION;
          return true;
        }
        break;
      case CONVERSATION_STEPS.TIME_SLOT_SELECTION:
        if (this.appointment.confirmed) {
          this.currentStep = CONVERSATION_STEPS.CONFIRMATION;
          return true;
        }
        break;
      case CONVERSATION_STEPS.CONFIRMATION:
        if (this.finalConfirmation) {
          this.currentStep = CONVERSATION_STEPS.COMPLETED;
          return true;
        }
        break;
    }
    return false;
  }

  /**
   * Go back to a previous step
   * @param {string} step - Step to return to
   */
  goToStep(step) {
    if (Object.values(CONVERSATION_STEPS).includes(step)) {
      this.currentStep = step;
      
      // Reset confirmations for this and all subsequent steps
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

  /**
   * Generate a summary of the booking
   * @returns {string} Formatted summary of the booking details
   */
  generateSummary() {
    let summary = "Récapitulatif de votre rendez-vous :\n";
    
    // Vehicle details
    if (this.vehicle.brand && this.vehicle.model) {
      summary += `- Véhicule : ${this.vehicle.brand} ${this.vehicle.model} (${this.vehicle.licensePlate})\n`;
    } else if (this.vehicle.licensePlate) {
      summary += `- Véhicule : ${this.vehicle.licensePlate}\n`;
    }
    
    // Service details
    if (this.service.name) {
      const priceText = this.service.price ? ` (${this.service.price})` : '';
      summary += `- Service : ${this.service.name}${priceText}\n`;
    }
    
    // Garage details
    if (this.garage.name) {
      summary += `- Garage : ${this.garage.name}${this.garage.address ? ` (${this.garage.address})` : ''}\n`;
    }
    
    // Appointment details
    if (this.appointment.date) {
      const timeText = this.appointment.time ? ` à ${this.appointment.time}` : '';
      summary += `- Date : ${this.appointment.date}${timeText}\n`;
    }
    
    return summary;
  }
  
  /**
   * Check if all required information is present for booking
   * @returns {boolean} True if all required information is available
   */
  isReadyForConfirmation() {
    return (
      this.vehicle.licensePlate && 
      this.service.id && 
      this.garage.id && 
      this.appointment.date && 
      this.appointment.time
    );
  }
}

module.exports = ConversationState; 