/**
 * Module pour parser et traiter les réponses du LLM
 */
const { CONVERSATION_STEPS } = require('../config/constants');

class ResponseParser {
  /**
   * Parse une réponse du LLM et la convertit en objet structuré
   * @param {string|Object} llmResponse - Réponse brute du LLM
   * @returns {Object} Réponse structurée avec message, étape, actions et données extraites
   */
  static parseResponse(llmResponse) {
    try {
      // Vérifier si la réponse est déjà un objet
      if (typeof llmResponse === 'object' && llmResponse !== null) {
        console.log('Réponse LLM déjà au format objet');
        // Si c'est un objet LangChain, essayer d'extraire le contenu
        if (llmResponse.content) {
          return this.parseStringResponse(llmResponse.content);
        } else if (llmResponse.text) {
          return this.parseStringResponse(llmResponse.text);
        } else {
          // Tenter de traiter directement l'objet
          return this.normalizeResponse(llmResponse);
        }
      } else if (typeof llmResponse === 'string') {
        // Traiter comme une chaîne de caractères
        return this.parseStringResponse(llmResponse);
      } else {
        console.error('Type de réponse LLM non pris en charge:', typeof llmResponse);
        return this.createFallbackResponse("Réponse non interprétable");
      }
    } catch (error) {
      console.error('Erreur lors du parsing de la réponse LLM:', error);
      return this.createFallbackResponse("Erreur lors du traitement de la réponse");
    }
  }

  /**
   * Parse une réponse sous forme de chaîne de caractères
   * @param {string} responseStr - Réponse du LLM en string
   * @returns {Object} Réponse structurée
   */
  static parseStringResponse(responseStr) {
    try {
      // Extraire la partie JSON de la réponse
      const jsonMatch = responseStr.match(/```json\s*([\s\S]*?)\s*```/);
      let parsedResponse;
      
      if (jsonMatch && jsonMatch[1]) {
        // Tenter de parser le JSON trouvé entre les balises ```json
        try {
          parsedResponse = JSON.parse(jsonMatch[1]);
        } catch (jsonError) {
          console.error('Erreur lors du parsing du JSON entre balises:', jsonError);
          // Essayer d'autres méthodes de parsing
          return this.tryAlternativeParsing(responseStr);
        }
      } else {
        // Essayer de parser toute la réponse comme JSON
        return this.tryAlternativeParsing(responseStr);
      }

      // Vérifier que la réponse contient les champs requis
      if (!parsedResponse || !parsedResponse.message) {
        console.warn('Réponse LLM invalide, champs requis manquants');
        return this.createFallbackResponse(responseStr);
      }

      // Normaliser et valider la réponse
      return this.normalizeResponse(parsedResponse);
    } catch (error) {
      console.error('Erreur lors du parsing de la réponse string:', error);
      return this.createFallbackResponse(responseStr);
    }
  }

  /**
   * Essaie différentes méthodes de parsing alternatives
   * @param {string} responseStr - Réponse du LLM en string
   * @returns {Object} Réponse structurée
   */
  static tryAlternativeParsing(responseStr) {
    // Essayer de parser toute la réponse comme JSON
    try {
      const parsedResponse = JSON.parse(responseStr);
      return this.normalizeResponse(parsedResponse);
    } catch (jsonError) {
      console.error('Réponse non conforme au format JSON attendu:', jsonError);
      
      // Rechercher un objet JSON dans la réponse avec une regex plus souple
      try {
        const jsonRegex = /\{[\s\S]*\}/;
        const match = responseStr.match(jsonRegex);
        if (match) {
          const jsonStr = match[0];
          const parsedResponse = JSON.parse(jsonStr);
          return this.normalizeResponse(parsedResponse);
        }
      } catch (regexError) {
        console.error('Échec de l\'extraction JSON par regex:', regexError);
      }
      
      return this.createFallbackResponse(responseStr);
    }
  }

  /**
   * Crée une réponse de secours en cas d'échec du parsing
   * @param {string} rawResponse - Réponse brute du LLM
   * @returns {Object} Réponse structurée de secours
   */
  static createFallbackResponse(rawResponse) {
    // Utiliser la réponse brute comme message
    let messageText = "Je n'ai pas compris votre demande. Pourriez-vous reformuler?";
    
    if (typeof rawResponse === 'string') {
      // Supprimer les blocs JSON et nettoyer la réponse
      messageText = rawResponse.replace(/```json[\s\S]*?```/g, '').trim();
      // Si la réponse est vide après nettoyage, utiliser le message par défaut
      if (!messageText) {
        messageText = "Je n'ai pas compris votre demande. Pourriez-vous reformuler?";
      }
    }

    return {
      message: messageText,
      currentStep: CONVERSATION_STEPS.VEHICLE_IDENTIFICATION,
      actions: {
        apiCall: null,
        apiParams: {},
        advanceStep: false,
        backToStep: null
      },
      extractedData: {
        licensePlate: null,
        serviceId: null,
        serviceName: null,
        garageId: null,
        garageName: null,
        date: null,
        time: null,
        confirmed: false
      }
    };
  }

  /**
   * Normalise et valide une réponse parsée
   * @param {Object} response - Réponse parsée
   * @returns {Object} Réponse normalisée et validée
   */
  static normalizeResponse(response) {
    // S'assurer que tous les champs requis sont présents
    const normalized = {
      message: response.message || "Je n'ai pas compris votre demande. Pourriez-vous reformuler?",
      currentStep: this.validateStep(response.currentStep),
      actions: {
        apiCall: response.actions?.apiCall || null,
        apiParams: response.actions?.apiParams || {},
        advanceStep: !!response.actions?.advanceStep,
        backToStep: this.validateStep(response.actions?.backToStep)
      },
      extractedData: {
        licensePlate: response.extractedData?.licensePlate || null,
        serviceId: response.extractedData?.serviceId || null,
        serviceName: response.extractedData?.serviceName || null,
        garageId: response.extractedData?.garageId || null,
        garageName: response.extractedData?.garageName || null,
        date: response.extractedData?.date || null,
        time: response.extractedData?.time || null,
        confirmed: !!response.extractedData?.confirmed
      }
    };

    return normalized;
  }

  /**
   * Valide que l'étape est une valeur correcte
   * @param {number|null} step - Étape à valider
   * @returns {number|null} Étape validée ou null
   */
  static validateStep(step) {
    const numStep = parseInt(step);
    if (isNaN(numStep) || numStep < 1 || numStep > 6) {
      return null;
    }
    return numStep;
  }
}

module.exports = ResponseParser; 