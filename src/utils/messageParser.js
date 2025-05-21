/**
 * Utilitaires pour l'analyse des messages utilisateur
 */

/**
 * Détecte si un message contient une demande de rendez-vous complète
 * avec plusieurs informations en une fois
 * @param {string} message - Message de l'utilisateur
 * @returns {boolean} - true si intention de rendez-vous détectée
 */
function detectAppointmentIntent(message) {
  const lowercaseMsg = message.toLowerCase();
  
  // Mots clés pour détecter l'intention de rendez-vous
  const appointmentKeywords = [
    'rendez-vous', 'rdv', 'réserver', 'prendre', 'venir', 'passer'
  ];
  
  let hasAppointmentIntent = false;
  
  // Si le message contient un mot clé de rendez-vous
  for (const keyword of appointmentKeywords) {
    if (lowercaseMsg.includes(keyword)) {
      hasAppointmentIntent = true;
      break;
    }
  }
  
  // Si pas d'intention de rendez-vous, ne pas continuer
  if (!hasAppointmentIntent) return false;
  
  // Compter combien d'informations sont présentes dans le message
  let infoCount = 0;
  
  // Vérifier si un service est mentionné
  const services = ['vidange', 'huile', 'pneu', 'contrôle technique', 'ct', 'frein', 'clim', 'climatisation'];
  if (services.some(service => lowercaseMsg.includes(service))) {
    infoCount++;
  }
  
  // Vérifier si un jour est mentionné
  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'semaine prochaine', 'cette semaine'];
  if (jours.some(jour => lowercaseMsg.includes(jour))) {
    infoCount++;
  }
  
  // Vérifier si un horaire est mentionné
  const horaires = ['matin', 'après-midi', 'apres-midi', 'aprem'];
  if (horaires.some(horaire => lowercaseMsg.includes(horaire))) {
    infoCount++;
  }
  
  // Vérifier si un garage est mentionné
  const garages = ['lyon', 'nice'];
  if (garages.some(garage => lowercaseMsg.includes(garage))) {
    infoCount++;
  }
  
  // Si au moins 3 informations sont présentes, c'est probablement une demande complète
  return infoCount >= 3;
}

/**
 * Détecte le service demandé dans le message
 * @param {string} message - Message de l'utilisateur
 * @returns {string|null} - Le code du service détecté ou null
 */
function detectService(message) {
  const lowercaseMsg = message.toLowerCase();
  
  if (lowercaseMsg.includes('vidange') || lowercaseMsg.includes('huile') || lowercaseMsg.includes('entretien moteur')) {
    return 'vidange';
  } 
  
  if (lowercaseMsg.includes('pneu') || lowercaseMsg.includes('roue') || lowercaseMsg.includes('pneumatique')) {
    return 'pneus';
  } 
  
  if (lowercaseMsg.includes('contrôle technique') || lowercaseMsg.includes('controle technique') || lowercaseMsg.includes('ct')) {
    return 'ct';
  } 
  
  if (lowercaseMsg.includes('frein') || lowercaseMsg.includes('plaquette') || lowercaseMsg.includes('freinage')) {
    return 'freins';
  } 
  
  if (lowercaseMsg.includes('clim') || lowercaseMsg.includes('climatisation') || lowercaseMsg.includes('air conditionné')) {
    return 'climatisation';
  }
  
  return null;
}

/**
 * Détecte le jour demandé dans le message
 * @param {string} message - Message de l'utilisateur
 * @returns {object|null} - Objet {jour, jourDate} ou null
 */
function detectJour(message) {
  const lowercaseMsg = message.toLowerCase();
  let jour = null;
  let jourDate = null;
  
  // Détection des dates précises comme "15 juin" ou "25/06"
  const dateRegex = /(\d{1,2})[\/\s\-\.]{1}(\d{1,2}|\janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i;
  const dateMatch = lowercaseMsg.match(dateRegex);

  if (dateMatch) {
    // Convertir la date détectée en une chaîne formatée
    const day = parseInt(dateMatch[1]);
    let month;
    
    // Si le mois est un chiffre
    if (!isNaN(parseInt(dateMatch[2]))) {
      month = parseInt(dateMatch[2]);
    } else {
      // Si le mois est en texte
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                          'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      month = monthNames.indexOf(dateMatch[2].toLowerCase()) + 1;
    }
    
    // Vérifier si la date est valide
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const currentYear = new Date().getFullYear();
      // Stocker la date formatée
      jourDate = {
        day: day,
        month: month,
        year: currentYear
      };
      jour = `${day}/${month}`;
    }
  } else if (lowercaseMsg.includes('lundi')) {
    jour = 'lundi';
  } else if (lowercaseMsg.includes('mardi')) {
    jour = 'mardi';
  } else if (lowercaseMsg.includes('mercredi')) {
    jour = 'mercredi';
  } else if (lowercaseMsg.includes('jeudi')) {
    jour = 'jeudi';
  } else if (lowercaseMsg.includes('vendredi')) {
    jour = 'vendredi';
  } else if (lowercaseMsg.includes('semaine prochaine')) {
    jour = 'semaine prochaine';
  } else if (lowercaseMsg.includes('cette semaine')) {
    jour = 'cette semaine';
  } else if (lowercaseMsg.includes('demain')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.getDate();
    const month = tomorrow.getMonth() + 1;
    
    jourDate = {
      day: day,
      month: month,
      year: tomorrow.getFullYear()
    };
    
    jour = `demain (${day}/${month})`;
  } else if (lowercaseMsg.includes('après-demain') || lowercaseMsg.includes('apres-demain') || 
             lowercaseMsg.includes('après demain') || lowercaseMsg.includes('apres demain')) {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const day = dayAfterTomorrow.getDate();
    const month = dayAfterTomorrow.getMonth() + 1;
    
    jourDate = {
      day: day,
      month: month,
      year: dayAfterTomorrow.getFullYear()
    };
    
    jour = `après-demain (${day}/${month})`;
  } else {
    // Détection de "dans X jours"
    const dansXJoursRegex = /dans\s+(\d+)\s+jours?/i;
    const dansXJoursMatch = lowercaseMsg.match(dansXJoursRegex);
    
    if (dansXJoursMatch) {
      const nbJours = parseInt(dansXJoursMatch[1]);
      if (nbJours > 0 && nbJours < 31) { // limitation raisonnable
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + nbJours);
        const day = futureDate.getDate();
        const month = futureDate.getMonth() + 1;
        
        jourDate = {
          day: day,
          month: month,
          year: futureDate.getFullYear()
        };
        
        jour = `dans ${nbJours} jour${nbJours > 1 ? 's' : ''} (${day}/${month})`;
      }
    }
  }
  
  return jour ? { jour, jourDate } : null;
}

/**
 * Détecte l'horaire demandé dans le message
 * @param {string} message - Message de l'utilisateur
 * @returns {object|null} - Objet {horaire, heuresPrecises} ou null
 */
function detectHoraire(message) {
  const lowercaseMsg = message.toLowerCase();
  let horaire = null;
  let heuresPrecises = null;
  
  if (lowercaseMsg.includes('matin')) {
    horaire = 'matin';
  } else if (lowercaseMsg.includes('après-midi') || lowercaseMsg.includes('apres-midi') || 
            lowercaseMsg.includes('aprem') || lowercaseMsg.includes('pm') ||
            lowercaseMsg.includes('après midi') || lowercaseMsg.includes('apres midi') ||
            lowercaseMsg.includes('soir') || lowercaseMsg.includes('tantot') ||
            lowercaseMsg.includes('14h') || lowercaseMsg.includes('15h') ||
            lowercaseMsg.includes('16h') || lowercaseMsg.includes('17h')) {
    horaire = 'après-midi';
  }
  
  // Détection d'heures précises
  const heureRegex = /(\d{1,2})[h:](\d{0,2})/i;
  const heureMatch = lowercaseMsg.match(heureRegex);
  
  if (heureMatch) {
    const heure = parseInt(heureMatch[1]);
    const minutes = heureMatch[2] ? parseInt(heureMatch[2]) : 0;
    
    // Vérifier que l'heure est valide (entre 8h et 18h)
    if (heure >= 8 && heure <= 18) {
      // Formater l'heure (ex: '14:30')
      const minutesFormatted = minutes < 10 ? `0${minutes}` : minutes;
      heuresPrecises = `${heure}:${minutesFormatted}`;
      
      // Détecter matin/après-midi basé sur l'heure
      if (heure < 12) {
        horaire = 'matin';
      } else {
        horaire = 'après-midi';
      }
    }
  }
  
  return horaire ? { horaire, heuresPrecises } : null;
}

/**
 * Détecte le garage demandé dans le message
 * @param {string} message - Message de l'utilisateur
 * @returns {string|null} - Le nom du garage détecté ou null
 */
function detectGarage(message) {
  const lowercaseMsg = message.toLowerCase();
  
  if (lowercaseMsg === 'lyon' || lowercaseMsg.includes('garage') && lowercaseMsg.includes('lyon') || 
      lowercaseMsg.includes('à lyon') || lowercaseMsg.includes('lyon')) {
    return 'Lyon';
  } 
  
  if (lowercaseMsg === 'nice' || lowercaseMsg.includes('garage') && lowercaseMsg.includes('nice') || 
      lowercaseMsg.includes('à nice') || lowercaseMsg.includes('nice')) {
    return 'Nice';
  }
  
  return null;
}

/**
 * Détecte la plaque d'immatriculation dans le message
 * @param {string} message - Message de l'utilisateur
 * @returns {string|null} - La plaque d'immatriculation détectée ou null
 */
function detectLicensePlate(message) {
  // Regex pour les plaques d'immatriculation françaises
  const licenseRegex = /[A-Z]{2}-\d{3}-[A-Z]{2}/i;
  const licenseMatch = message.match(licenseRegex);
  
  if (licenseMatch) {
    return licenseMatch[0].toUpperCase();
  }
  
  return null;
}

/**
 * Détecte le sentiment de l'utilisateur à partir de son message
 * @param {string} message - Message de l'utilisateur
 * @returns {object} - Objet contenant l'état émotionnel détecté
 */
function detectUserSentiment(message) {
  const lowercaseMsg = message.toLowerCase();
  
  const userSentiment = {
    isUrgent: false,
    isFrustrated: false,
    isPositive: false,
  };
  
  // Mots-clés indiquant l'urgence
  const urgencyKeywords = [
    'urgent', 'rapidement', 'vite', 'au plus tôt', 'dès que possible', 
    'immédiatement', 'aujourd\'hui', 'demain', 'pressé', 'express', 'important'
  ];
  
  // Mots-clés indiquant la frustration
  const frustrationKeywords = [
    'pas compris', 'ne comprend pas', 'frustrant', 'agaçant', 'énervant',
    'ridicule', 'absurde', 'irritant', 'pénible', 'j\'ai déjà dit', 
    'je répète', 'toujours pas', 'pas encore', 'jamais', 'incompétent'
  ];
  
  // Mots-clés indiquant une attitude positive
  const positiveKeywords = [
    'merci', 'parfait', 'super', 'excellent', 'génial', 'formidable',
    'bien', 'cool', 'sympa', 'agréable', 'c\'est bon', 'top', 'content'
  ];
  
  // Détecter les signes d'urgence
  if (urgencyKeywords.some(keyword => lowercaseMsg.includes(keyword))) {
    userSentiment.isUrgent = true;
  }
  
  // Détecter les signes de frustration
  if (frustrationKeywords.some(keyword => lowercaseMsg.includes(keyword))) {
    userSentiment.isFrustrated = true;
  }
  
  // Détecter les signes positifs
  if (positiveKeywords.some(keyword => lowercaseMsg.includes(keyword))) {
    userSentiment.isPositive = true;
  }
  
  // Détecter les émotions via ponctuation et majuscules
  if (message.includes('!!!') || message.includes('???')) {
    userSentiment.isFrustrated = true;
  }
  
  // Détecter si le message est tout en majuscules (signe de colère)
  if (message === message.toUpperCase() && message.length > 10) {
    userSentiment.isFrustrated = true;
  }
  
  return userSentiment;
}

/**
 * Détecte si le message contient une confirmation ou un refus
 * @param {string} message - Message de l'utilisateur
 * @returns {object} - Objet contenant {isConfirmation, isDenial}
 */
function detectConfirmationOrDenial(message) {
  const lowercaseMsg = message.toLowerCase();
  
  // Mots-clés indiquant une confirmation
  const confirmationKeywords = [
    'oui', 'ok', 'd\'accord', 'bien', 'confirme', 'confirmé', 
    'parfait', 'entendu', 'ça marche', 'c\'est bon', 'je confirme'
  ];
  
  // Mots-clés indiquant un refus
  const denialKeywords = [
    'non', 'pas d\'accord', 'pas correct', 'incorrect', 'erreur',
    'pas bon', 'pas ça', 'annuler', 'annulation', 'je refuse'
  ];
  
  const isConfirmation = confirmationKeywords.some(keyword => 
    lowercaseMsg === keyword || lowercaseMsg.includes(` ${keyword}`) || lowercaseMsg.includes(`${keyword} `)
  );
  
  const isDenial = denialKeywords.some(keyword => 
    lowercaseMsg === keyword || lowercaseMsg.includes(` ${keyword}`) || lowercaseMsg.includes(`${keyword} `)
  );
  
  return { isConfirmation, isDenial };
}

module.exports = {
  detectAppointmentIntent,
  detectService,
  detectJour,
  detectHoraire,
  detectGarage,
  detectLicensePlate,
  detectUserSentiment,
  detectConfirmationOrDenial
}; 