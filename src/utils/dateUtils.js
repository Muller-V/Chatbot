/**
 * Utilitaires pour la gestion des dates
 */

/**
 * Formate une expression de jour en date pour l'API
 * @param {string} jour - Expression de jour (ex: 'lundi', 'demain', '15/06')
 * @returns {string|null} - Date au format YYYY-MM-DD ou null si invalide
 */
function formatDateForApi(jour) {
  if (!jour) return null;
  
  // Si la date est déjà au format JJ/MM
  if (jour.includes('/')) {
    // Extraire jour et mois
    const parts = jour.split('/');
    if (parts.length === 2) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
  }
  
  // Si la date contient une expression entre parenthèses (ex: "demain (12/06)")
  const dateMatch = jour.match(/\((\d{1,2})\/(\d{1,2})\)/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}`;
  }
  
  // Si la date est une expression ("demain", "lundi", etc.)
  const now = new Date();
  
  if (jour.toLowerCase().includes('demain')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Calcul pour les jours de la semaine
  const dayMap = {
    'lundi': 1,
    'mardi': 2,
    'mercredi': 3,
    'jeudi': 4,
    'vendredi': 5
  };
  
  for (const [dayName, dayOffset] of Object.entries(dayMap)) {
    if (jour.toLowerCase().includes(dayName)) {
      const currentDay = now.getDay() || 7; // 0 est dimanche, on convertit en 7
      let daysToAdd = dayOffset - currentDay;
      
      // Si le jour est déjà passé cette semaine, on prend la semaine prochaine
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysToAdd);
      return targetDate.toISOString().split('T')[0];
    }
  }
  
  if (jour.toLowerCase().includes('semaine prochaine')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }
  
  // Par défaut, retourner la date actuelle
  return now.toISOString().split('T')[0];
}

/**
 * Extrait le jour de la semaine à partir d'une date formatée
 * @param {string} dateStr - Date au format "demain (12/06)"
 * @returns {string|null} - Jour de la semaine ou null
 */
function getDayOfWeekFromDate(dateStr) {
  try {
    // Extraire la date entre parenthèses
    const dateMatch = dateStr.match(/\((\d{1,2})\/(\d{1,2})\)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      
      // Créer un objet date avec l'année en cours
      const date = new Date();
      date.setDate(day);
      date.setMonth(month - 1); // Les mois commencent à 0 en JavaScript
      
      // Obtenir le jour de la semaine
      const daysOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      return daysOfWeek[date.getDay()];
    }
  } catch (error) {
    console.error('Erreur lors de l\'extraction du jour de la semaine:', error);
  }
  
  return null;
}

/**
 * Génère une représentation textuelle formatée d'une date
 * @param {Date} date - Objet Date à formater
 * @returns {string} - Date au format "jour JJ/MM"
 */
function formatDateToFrench(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const daysOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dayName = daysOfWeek[date.getDay()];
  
  return `${dayName} ${day}/${month}`;
}

/**
 * Détermine si une date est aujourd'hui, demain ou plus tard
 * @param {Date} date - Date à évaluer
 * @returns {string} - 'aujourd'hui', 'demain' ou 'plus tard'
 */
function getRelativeDayLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);
  
  if (dateToCheck.getTime() === today.getTime()) {
    return 'aujourd\'hui';
  } else if (dateToCheck.getTime() === tomorrow.getTime()) {
    return 'demain';
  }
  
  return 'plus tard';
}

module.exports = {
  formatDateForApi,
  getDayOfWeekFromDate,
  formatDateToFrench,
  getRelativeDayLabel
}; 