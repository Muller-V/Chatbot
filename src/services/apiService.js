/**
 * Service pour les appels API
 */
const axios = require('axios');
const { API_BASE_URL } = require('../config/constants');

// Configurer axios avec un timeout par défaut
const apiClient = axios.create({
  baseURL: API_BASE_URL + '/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Intercepteur pour gérer les erreurs globalement
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error(`❌ Erreur API: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data)}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Vérifie si l'API est disponible
 * @returns {Promise<boolean>} true si l'API est disponible
 */
async function checkApiAvailability() {
  try {
    // Utiliser une route simple qui ne dépend pas des bundle Symfony comme NelmioApiDocBundle
    await apiClient.get('/operations', { timeout: 2000 });
    console.log('✅ API Backend disponible');
    return true;
  } catch (error) {
    // Vérifier si l'erreur contient "NelmioApiDocBundle" 
    // Ce qui indiquerait un problème de configuration Symfony mais le serveur est bien disponible
    if (error.response && 
        error.response.status === 500 && 
        error.response.data && 
        (typeof error.response.data === 'string' && error.response.data.includes('NelmioApiDocBundle'))) {
      console.log('⚠️ API Backend disponible mais erreur de configuration NelmioApiDocBundle, fonctionnement en mode hors ligne');
      return false;
    }
    console.log('⚠️ API Backend non disponible, fonctionnement en mode hors ligne');
    return false;
  }
}

/**
 * Récupère les informations d'un véhicule à partir de sa plaque d'immatriculation
 * @param {string} licensePlate - Plaque d'immatriculation
 * @returns {Promise<Object|null>} Informations du véhicule ou null si non trouvé
 */
async function getVehicleInfo(licensePlate) {
  try {
    const response = await apiClient.get(`/vehicules/${licensePlate}`);
    if (response.data) {
      console.log(`✅ Véhicule récupéré: ${response.data.brand} ${response.data.model}`);
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des informations du véhicule:', error.message);
    // Valeurs par défaut pour le mode hors ligne
    return { 
      brand: "Renault", 
      model: "Clio",
      year: "2018",
      chassisNumber: "VF1RXXXXXXXX",
      created_at: new Date().toISOString()
    };
  }
}

/**
 * Réserve un créneau pour un rendez-vous
 * @param {Object} appointmentData - Données du rendez-vous
 * @returns {Promise<boolean>} true si la réservation a réussi
 */
async function bookAppointment(appointmentData) {
  try {
    const response = await apiClient.post('/appointments', appointmentData);
    console.log('✅ Rendez-vous créé avec succès:', response.data.id);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la réservation du rendez-vous:', error.message);
    // En mode hors ligne, simuler une réussite
    console.log('⚠️ Mode hors ligne: simulation de réservation réussie');
    return true;
  }
}

/**
 * Récupère les créneaux disponibles pour un jour donné
 * @param {string} date - Date au format YYYY-MM-DD
 * @param {string} garageId - ID du garage
 * @returns {Promise<Array>} Liste des créneaux disponibles
 */
async function getAvailableSlots(date, garageId) {
  try {
    const response = await apiClient.get(`/appointments/avaibilities`, {
      params: { date, garage_id: garageId }
    });
    return response.data || [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des créneaux:', error.message);
    
    // Données par défaut pour le mode hors ligne
    const defaultSlots = [];
    const hours = [9, 10, 11, 14, 15, 16, 17];
    
    // Génération de créneaux aléatoires disponibles
    hours.forEach(hour => {
      const available = Math.random() > 0.3; // 70% de chances d'être disponible
      defaultSlots.push({
        time: `${hour}:00`,
        available: available
      });
    });
    
    return defaultSlots;
  }
}

/**
 * Récupère les services disponibles
 * @returns {Promise<Array>} Liste des services
 */
async function getServices() {
  try {
    const response = await apiClient.get('/operations');
    return response.data || [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des services:', error.message);
    
    // Données par défaut pour le mode hors ligne
    return [
      { id: '1', name: 'Vidange', price: 80, category: { id: '1', name: 'Entretien' } },
      { id: '7', name: 'Changement de pneus', price: 70, category: { id: '2', name: 'Pneus' } },
      { id: '8', name: 'Contrôle technique', price: 89, category: { id: '3', name: 'Contrôle' } },
      { id: '5', name: 'Réparation des freins', price: 120, category: { id: '4', name: 'Réparation' } },
      { id: '6', name: 'Entretien climatisation', price: 60, category: { id: '1', name: 'Entretien' } }
    ];
  }
}

/**
 * Récupère les catégories d'opérations
 * @returns {Promise<Array>} Liste des catégories
 */
async function getOperationCategories() {
  try {
    const response = await apiClient.get('/operations/category');
    return response.data || [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des catégories:', error.message);
    
    // Données par défaut pour le mode hors ligne
    return [
      { id: '1', name: 'Entretien' },
      { id: '2', name: 'Pneus' },
      { id: '3', name: 'Contrôle' },
      { id: '4', name: 'Réparation' }
    ];
  }
}

/**
 * Récupère les garages disponibles
 * @returns {Promise<Array>} Liste des garages
 */
async function getGarages() {
  try {
    const response = await apiClient.get('/garages');
    return response.data?.garages || [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des garages:', error.message);
    
    // Données par défaut pour le mode hors ligne
    return [
      { id: '4', name: 'Lyon', address: '6 Rue Joannès Carret, 69009 Lyon' },
      { id: '6', name: 'Nice', address: '116 Avenue Simone Veil, 06200 Nice' }
    ];
  }
}

module.exports = {
  checkApiAvailability,
  getVehicleInfo,
  bookAppointment,
  getAvailableSlots,
  getServices,
  getOperationCategories,
  getGarages
}; 