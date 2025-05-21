/**
 * Classe représentant l'état de la conversation du chatbot
 */
class ConversationState {
  constructor() {
    this.reset();
  }

  /**
   * Réinitialise l'état de la conversation
   */
  reset() {
    // Sauvegarder les véhicules mémorisés avant la réinitialisation
    const savedVehicles = this.previousVehicles ? [...this.previousVehicles] : [];
    
    // Informations sur le rendez-vous
    this.service = null;       // Le service demandé (vidange, pneus, etc.)
    this.jour = null;          // Le jour choisi pour le RDV
    this.horaire = null;       // L'horaire choisi (matin, après-midi)
    this.heuresPrecises = null; // Heure précise du rendez-vous (format: '10:30')
    this.garage = null;        // Le garage choisi (Lyon, Nice)
    this.confirmed = false;    // Si le RDV est confirmé
    
    // Informations sur le véhicule
    this.licensePlate = null;  // Plaque d'immatriculation
    this.vehiculeModel = null; // Modèle du véhicule
    this.vehiculeBrand = null; // Marque du véhicule
    
    // État du flux de conversation
    this.askingForLicensePlate = false; // Si on demande actuellement la plaque d'immatriculation
    this.askingForVehicleManually = false; // Si on demande manuellement les informations du véhicule
    this.askingForVehicleBrand = false; // Si on demande la marque du véhicule
    this.askingForVehicleModel = false; // Si on demande le modèle du véhicule
    this.jourDate = null;      // Objet date détaillé pour le jour (jour, mois, année)
    this.turnCount = 0;        // Compteur de tours de conversation
    
    // Sentiment utilisateur
    this.userSentiment = {
      isUrgent: false,         // Si l'utilisateur montre des signes d'urgence
      isFrustrated: false,     // Si l'utilisateur montre des signes de frustration
      isPositive: false,       // Si l'utilisateur montre des signes de satisfaction
    };
    
    // Étape de confirmation
    this.confirmationStep = {
      pending: false,          // Si une confirmation est en attente
      appointmentSummary: null // Résumé du rendez-vous à confirmer
    };
    
    // Historique des véhicules
    this.previousVehicles = savedVehicles; // Liste des véhicules précédemment utilisés par le client
  }

  /**
   * Vérifie si toutes les informations essentielles pour un rendez-vous sont présentes
   * @returns {boolean} Vrai si toutes les informations sont présentes
   */
  hasAllAppointmentInfo() {
    return this.service && this.jour && this.horaire && this.garage;
  }

  /**
   * Vérifie si le rendez-vous est prêt à être confirmé (toutes les infos + plaque)
   * @returns {boolean} Vrai si le rendez-vous est prêt à être confirmé
   */
  isReadyForConfirmation() {
    return this.hasAllAppointmentInfo() && this.licensePlate;
  }

  /**
   * Génère un résumé du rendez-vous
   * @param {Object} servicePrices - Objet contenant les prix des services
   * @returns {string|null} Résumé du rendez-vous ou null si des informations sont manquantes
   */
  generateSummary(servicePrices) {
    if (!this.hasAllAppointmentInfo()) {
      return null;
    }
    
    let summary = `Récapitulatif du rendez-vous :\n`;
    
    // Service
    const servicePrice = servicePrices[this.service] || 'prix à confirmer';
    summary += `- Service : ${this.service} (${servicePrice})\n`;
    
    // Date
    summary += `- Date : ${this.jour}\n`;
    
    // Horaire
    if (this.heuresPrecises) {
      summary += `- Heure : ${this.heuresPrecises}\n`;
    } else {
      summary += `- Période : ${this.horaire}\n`;
    }
    
    // Garage
    summary += `- Garage : ${this.garage}\n`;
    
    // Véhicule
    if (this.licensePlate) {
      summary += `- Véhicule : ${this.licensePlate}`;
      if (this.vehiculeBrand && this.vehiculeModel) {
        summary += ` (${this.vehiculeBrand} ${this.vehiculeModel})`;
      }
      summary += `\n`;
    }
    
    return summary;
  }
}

module.exports = ConversationState; 