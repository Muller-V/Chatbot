
const { CONVERSATION_STEPS } = require('../config/constants');

class ConversationState {
  constructor() {
    this.reset();
  }


  reset() {

    this.currentStep = CONVERSATION_STEPS.VEHICLE_IDENTIFICATION;
    

    this.vehicle = {
      licensePlate: null,
      brand: null,
      model: null,
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
    

    this.userSentiment = {
      isUrgent: false,
      isFrustrated: false,
      isPositive: false
    };
    

    this.turnCount = 0;
    this.lastApiCallTime = null;
  }


  advanceStep() {

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