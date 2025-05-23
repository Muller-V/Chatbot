/**
 * Module pour parser et traiter les réponses du LLM
 */
const { CONVERSATION_STEPS } = require('../config/constants');

class ResponseParser {
  /**
   * Parse une réponse du LLM et la convertit en objet structuré
   * @param {string|Object} llmResponse - Réponse brute du LLM
   * @returns {Object} Réponse structurée avec message, étape et données extraites
   */
  static parseResponse(llmResponse) {
    let responseText = '';
    
    // Extraire le texte de la réponse selon le format
    if (typeof llmResponse === 'string') {
      responseText = llmResponse;
    } else if (llmResponse && llmResponse.content) {
      responseText = llmResponse.content;
    } else if (llmResponse && llmResponse.text) {
      responseText = llmResponse.text;
    } else {
      console.warn('Format de réponse LLM non reconnu:', llmResponse);
      return this.createFallbackResponse();
    }
    
    try {
      return this.parseStringResponse(responseText);
    } catch (error) {
      console.error('Erreur lors du parsing de la réponse LLM:', error);
      console.log('Contenu de la réponse:', responseText);
      return this.createFallbackResponse(responseText);
    }
  }

  /**
   * Parse une réponse textuelle contenant du JSON
   */
  static parseStringResponse(text) {
    // Nettoyer le texte d'entrée
    let cleanedText = text.trim();
    
    // Cas 1: JSON dans des blocs de code
    let jsonMatch = cleanedText.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return this.tryParseJson(jsonMatch[1].trim());
    }
    
    // Cas 2: JSON dans des blocs de code sans spécification de langage
    jsonMatch = cleanedText.match(/```\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return this.tryParseJson(jsonMatch[1].trim());
    }
    
    // Cas 3: JSON direct (commence par { et finit par })
    if (cleanedText.startsWith('{') && cleanedText.includes('}')) {
      // Trouver la dernière accolade fermante pour gérer les JSON avec du texte après
      const lastBraceIndex = cleanedText.lastIndexOf('}');
      const jsonCandidate = cleanedText.substring(0, lastBraceIndex + 1);
      return this.tryParseJson(jsonCandidate);
    }
    
    // Cas 4: Texte contenant du JSON
    jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return this.tryParseJson(jsonMatch[0]);
    }
    
    // Aucun JSON trouvé
    throw new Error('Aucun JSON valide trouvé dans la réponse');
  }
  
  /**
   * Tente de parser le JSON avec correction d'erreurs communes
   */
  static tryParseJson(jsonString) {
    // Tentative de parsing direct
    try {
      const parsed = JSON.parse(jsonString);
      return this.validateAndCompleteResponse(parsed);
    } catch (error) {
      console.warn('Parsing JSON direct échoué:', error.message);
    }
    
    // Tentative avec corrections communes
    let correctedJson = jsonString;
    
    // Correction 1: Guillemets manquants ou mal échappés
    correctedJson = correctedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Correction 2: Virgules manquantes entre propriétés
    correctedJson = correctedJson.replace(/"\s*\n\s*"/g, '",\n  "');
    
    // Correction 3: Virgules supplémentaires avant }
    correctedJson = correctedJson.replace(/,(\s*[}\]])/g, '$1');
    
    // Correction 4: Guillements non fermés
    correctedJson = correctedJson.replace(/:\s*"([^"]*)\n/g, ': "$1",\n');
    
    try {
      const parsed = JSON.parse(correctedJson);
      console.log('JSON corrigé avec succès');
      return this.validateAndCompleteResponse(parsed);
    } catch (error) {
      console.error('Impossible de corriger le JSON:', error.message);
      console.log('JSON original:', jsonString);
      console.log('JSON corrigé:', correctedJson);
      throw error;
    }
  }
  
  /**
   * Valide et complète la réponse parsée
   */
  static validateAndCompleteResponse(parsed) {
    // Vérifier que c'est un objet valide
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('La réponse parsée n\'est pas un objet valide');
    }
    
    // Compléter les champs manquants avec des valeurs par défaut
    const response = {
      message: parsed.message || "Réponse non disponible",
      currentStep: parsed.currentStep || 1,
      extractedData: {
        licensePlate: null,
        vehicleValidated: false,
        serviceId: null,
        serviceName: null,
        serviceValidated: false,
        garageId: null,
        garageName: null,
        garageValidated: false,
        slotDate: null,
        slotTime: null,
        slotValidated: false,
        finalConfirmed: false,
        appointmentCreated: false,
        appointmentId: null,
        ...parsed.extractedData
      }
    };
    
    // Valider les types
    if (typeof response.message !== 'string') {
      response.message = String(response.message);
    }
    
    if (typeof response.currentStep !== 'number' || response.currentStep < 1 || response.currentStep > 9) {
      response.currentStep = 1;
    }
    
    return response;
  }
  
  /**
   * Crée une réponse de fallback en cas d'erreur
   */
  static createFallbackResponse(originalText = '') {
    console.log('Création d\'une réponse de fallback à partir du texte');
    
    // Extraire la plaque si présente dans le texte
    const plateMatch = originalText.match(/([A-Z]{2}-?\d{3}-?[A-Z]{2})/i);
    const licensePlate = plateMatch ? plateMatch[1] : null;
    
    return {
      message: originalText || "Je n'ai pas compris votre demande. Pouvez-vous reformuler ?",
      currentStep: 2, // Étape sécurisée par défaut
      extractedData: {
        licensePlate: licensePlate,
        vehicleValidated: false,
        serviceId: null,
        serviceName: null,
        serviceValidated: false,
        garageId: null,
        garageName: null,
        garageValidated: false,
        slotDate: null,
        slotTime: null,
        slotValidated: false,
        finalConfirmed: false
      }
    };
  }

  /**
   * Nettoie et répare les erreurs courantes dans les chaînes JSON
   * @param {string} jsonString - Chaîne JSON à nettoyer
   * @returns {string} Chaîne JSON nettoyée
   */
  static cleanJsonString(jsonString) {
    let cleaned = jsonString.trim();
    
    // Corriger les guillemets manquants autour des clés
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Corriger les virgules manquantes avant la fermeture d'objets/tableaux
    cleaned = cleaned.replace(/([^,\{\[\s])\s*([}\]])/g, '$1$2');
    
    // Supprimer les virgules en trop avant les fermetures
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    
    // Échapper les guillemets dans les valeurs de chaînes
    cleaned = cleaned.replace(/"([^"]*(?:\\"[^"]*)*)"/g, (match, content) => {
      return '"' + content.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    });

    return cleaned;
  }

  /**
   * Tente d'extraire des données utiles du texte libre
   * @param {string} text - Texte à analyser
   * @returns {Object} Données extraites
   */
  static extractDataFromText(text) {
    const extracted = {
      licensePlate: null,
      isConfirmation: false,
      serviceSelection: null,
      garageSelection: null
    };
    
    // Chercher une plaque d'immatriculation dans le texte
    const plateRegex = /([A-Z]{1,2}-?\d{3}-?[A-Z]{1,2})/gi;
    const plateMatch = text.match(plateRegex);
    
    if (plateMatch && plateMatch[0]) {
      const plate = plateMatch[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      // Reformater la plaque au format standard
      if (plate.length >= 6) {
        const formattedPlate = `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`;
        extracted.licensePlate = formattedPlate;
      }
    }
    
    // Détecter les confirmations
    const confirmationWords = ['oui', 'yes', 'ok', 'correct', 'exact', 'parfait', 'c\'est ça', 'd\'accord', 'confirme'];
    const textLower = text.toLowerCase();
    extracted.isConfirmation = confirmationWords.some(word => textLower.includes(word));
    
    // Détecter sélection de service (recherche de mots-clés)
    const serviceKeywords = [
      'service huile moteur', 'huile moteur', 'huile',
      'service microfiltre', 'microfiltre', 'filtre habitacle',
      'service filtre carburant', 'filtre carburant', 'carburant',
      'service filtre air', 'filtre air', 'air',
      'service liquide freins', 'liquide freins', 'freins'
    ];
    
    for (const keyword of serviceKeywords) {
      if (textLower.includes(keyword)) {
        extracted.serviceSelection = keyword;
        break;
      }
    }
    
    // Détecter sélection de garage par nom ou mots-clés
    const garageKeywords = ['garage', 'atelier', 'centre auto'];
    for (const keyword of garageKeywords) {
      if (textLower.includes(keyword)) {
        extracted.garageSelection = text; // Garder le texte original pour analyse plus poussée
        break;
      }
    }
    
    return extracted;
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
      currentStep: this.validateStep(response.currentStep) || CONVERSATION_STEPS.REQUEST_PLATE,
      extractedData: {
        licensePlate: response.extractedData?.licensePlate || null,
        vehicleValidated: !!response.extractedData?.vehicleValidated,
        serviceId: response.extractedData?.serviceId || null,
        serviceName: response.extractedData?.serviceName || null,
        serviceValidated: !!response.extractedData?.serviceValidated,
        garageId: response.extractedData?.garageId || null,
        garageName: response.extractedData?.garageName || null,
        garageValidated: !!response.extractedData?.garageValidated,
        slotDate: response.extractedData?.slotDate || null,
        slotTime: response.extractedData?.slotTime || null,
        slotValidated: !!response.extractedData?.slotValidated,
        finalConfirmed: !!response.extractedData?.finalConfirmed,
        appointmentCreated: !!response.extractedData?.appointmentCreated,
        appointmentId: response.extractedData?.appointmentId || null
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
    if (isNaN(numStep) || numStep < 1 || numStep > 9) {
      return null;
    }
    return numStep;
  }
}

module.exports = ResponseParser; 