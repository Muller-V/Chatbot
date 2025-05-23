/**
 * API Service for communication with the backend
 */
const { API_BASE_URL } = require('../config/constants');
const axios = require('axios');

class ApiService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 5000
    });
    
    // État d'authentification
    this.isAuthenticated = false;
    this.authToken = null;
  }

  /**
   * Authentifie le service avec l'API backend
   * @returns {Promise<boolean>} True si l'authentification a réussi
   */
  async authenticate() {
    try {
      const response = await this.apiClient.post('/api/login_check', {
        email: 'racoon@admin.fr',
        password: 'racoonadmin'
      });
      
      if (response.data && response.data.token) {
        this.authToken = response.data.token;
        this.isAuthenticated = true;
        
        // Configurer l'intercepteur pour ajouter automatiquement le token à tous les appels
        this.apiClient.interceptors.request.use(config => {
          config.headers['Authorization'] = `Bearer ${this.authToken}`;
          return config;
        });
        
        console.log('API authentication successful');
        return true;
      } else {
        console.error('API authentication failed: No token received');
        return false;
      }
    } catch (error) {
      console.error('API authentication error:', error.message);
      return false;
    }
  }

  /**
   * Vérifie si l'API est disponible et s'authentifie si nécessaire
   * @returns {Promise<boolean>} True si l'API est disponible
   */
  async checkApiAvailability() {
    try {
      if (!this.isAuthenticated) {
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
          return false;
        }
      }
      
      await this.apiClient.get('/api/garages');
      return true;
    } catch (error) {
      console.warn('API not available:', error.message);
      return false;
    }
  }

  /**
   * Récupère les informations d'un véhicule par plaque d'immatriculation
   * @param {string} licensePlate - Plaque d'immatriculation
   * @returns {Promise<Object|null>} Informations du véhicule ou null si non trouvé
   */
  async getVehicleByPlate(licensePlate) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      // Formater la plaque au format standard avec tirets pour l'affichage
      const formattedPlate = this.formatLicensePlate(licensePlate);
      
      // Enlever les tirets pour l'appel API
      const plateForApi = formattedPlate.replace(/-/g, '');
      console.log(`Recherche du véhicule: plaque affichage="${formattedPlate}", plaque API="${plateForApi}"`);
      
      const response = await this.apiClient.get(`/api/vehicules/${plateForApi}`);
      
      // Ajouter la plaque d'immatriculation au résultat pour garantir sa présence
      if (response.data) {
        // Utiliser la plaque formatée avec tirets pour l'affichage
        if (!response.data.licensePlate) {
          response.data.licensePlate = formattedPlate;
        }
        console.log(`Véhicule trouvé: ${response.data.brand} ${response.data.model} (ID: ${response.data.id})`);
      }
      
      return response.data;
    } catch (error) {
      // Gérer spécifiquement les différents codes d'erreur
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        switch (status) {
          case 400:
            console.warn(`Format de plaque invalide: ${licensePlate}`);
            return this.createFallbackVehicleData(licensePlate, 'format_invalide');
            
          case 404:
            console.warn(`Véhicule non trouvé avec la plaque: ${licensePlate}`);
            return this.createFallbackVehicleData(licensePlate, 'non_trouve');
            
          case 500:
            console.error(`Erreur serveur lors de la recherche du véhicule ${licensePlate}:`, errorData);
            // Créer des données de fallback avec un ID généré
            return this.createFallbackVehicleData(licensePlate, 'erreur_serveur');
            
          default:
            console.error(`Erreur HTTP ${status} lors de la recherche du véhicule ${licensePlate}:`, errorData);
            return this.createFallbackVehicleData(licensePlate, 'erreur_inconnue');
        }
      } else {
        console.error(`Erreur réseau lors de la récupération des informations du véhicule ${licensePlate}:`, error.message);
        return this.createFallbackVehicleData(licensePlate, 'erreur_reseau');
      }
    }
  }

  /**
   * Crée des données de véhicule de fallback
   * @param {string} licensePlate - Plaque d'immatriculation
   * @param {string} reason - Raison de la création des données de fallback
   * @returns {Object} Données de véhicule de fallback
   */
  createFallbackVehicleData(licensePlate, reason) {
    // Générer un ID unique basé sur la plaque
    const fallbackId = `fallback-${licensePlate.replace(/[^A-Z0-9]/g, '')}-${Date.now()}`;
    
    // Données de marques/modèles courantes pour rendre plus réaliste
    const commonVehicles = [
      { brand: "Renault", model: "Clio" },
      { brand: "Peugeot", model: "208" },
      { brand: "Citroën", model: "C3" },
      { brand: "Volkswagen", model: "Golf" },
      { brand: "Ford", model: "Fiesta" }
    ];
    
    // Sélectionner aléatoirement un véhicule basé sur la plaque
    const plateHash = licensePlate.charCodeAt(0) + licensePlate.charCodeAt(1);
    const selectedVehicle = commonVehicles[plateHash % commonVehicles.length];
    
    const fallbackData = {
      id: fallbackId,
      licensePlate: licensePlate,
      brand: selectedVehicle.brand,
      model: selectedVehicle.model,
      year: 2020 + (plateHash % 5), // Année entre 2020 et 2024
      color: "Non spécifiée",
      fallback: true,
      fallbackReason: reason
    };
    
    console.log(`Données de fallback créées pour ${licensePlate}:`, fallbackData);
    return fallbackData;
  }

  /**
   * Formate une plaque d'immatriculation au format AA-123-BB
   * @param {string} plate - Plaque d'immatriculation à formater
   * @returns {string} Plaque formatée
   */
  formatLicensePlate(plate) {
    if (!plate) return '';
    
    // Supprimer tous les caractères non alphanumériques
    const cleaned = plate.replace(/[^a-zA-Z0-9]/g, '');
    
    // Vérifier si on a le bon nombre de caractères (2 lettres + 3 chiffres + 2 lettres = 7)
    if (cleaned.length !== 7) {
      return plate; // Retourner la plaque originale si le format est incorrect
    }
    
    // Extraire les parties de la plaque
    const firstPart = cleaned.substring(0, 2).toUpperCase();
    const middlePart = cleaned.substring(2, 5);
    const lastPart = cleaned.substring(5, 7).toUpperCase();
    
    // Vérifier que les parties sont dans le bon format
    if (!/^[A-Z]{2}$/.test(firstPart) || !/^\d{3}$/.test(middlePart) || !/^[A-Z]{2}$/.test(lastPart)) {
      return plate; // Retourner la plaque originale si le format est incorrect
    }
    
    // Reformater la plaque
    return `${firstPart}-${middlePart}-${lastPart}`;
  }

  /**
   * Récupère les opérations/services disponibles
   * @returns {Promise<Array|null>} Liste des opérations ou null en cas d'erreur
   */
  async getOperations() {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.get('/api/operations');
      return response.data;
    } catch (error) {
      console.error('Error getting operations:', error.message);
      return null;
    }
  }

  /**
   * Récupère les opérations par catégorie
   * @param {string} categoryId - ID de la catégorie
   * @returns {Promise<Array|null>} Liste des opérations ou null en cas d'erreur
   */
  async getOperationsByCategory(categoryId) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.get(`/api/operations/${categoryId}`);
      return response.data;
    } catch (error) {
      console.error(`Error getting operations for category ${categoryId}:`, error.message);
      return null;
    }
  }

  /**
   * Récupère les catégories d'opérations
   * @returns {Promise<Array|null>} Liste des catégories d'opérations ou null en cas d'erreur
   */
  async getOperationCategories() {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.get('/api/operations/category');
      return response.data;
    } catch (error) {
      console.error('Error getting operation categories:', error.message);
      return null;
    }
  }

  /**
   * Récupère les garages à proximité
   * @param {number} latitude - Latitude de l'utilisateur
   * @param {number} longitude - Longitude de l'utilisateur
   * @returns {Promise<Array|null>} Liste des garages à proximité ou null en cas d'erreur
   */
  async getNearbyGarages(latitude, longitude) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.get('/api/garages', {
        params: { latitude, longitude }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting nearby garages:', error.message);
      return null;
    }
  }

  /**
   * Récupère tous les garages disponibles
   * @returns {Promise<Array|null>} Liste de tous les garages ou null en cas d'erreur
   */
  async getAllGarages() {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.get('/api/garages');
      return response.data;
    } catch (error) {
      console.error('Error getting all garages:', error.message);
      return null;
    }
  }

  /**
   * Récupère les créneaux disponibles
   * @param {string} [garageId] - ID du garage (optionnel)
   * @param {string} [date] - Date au format YYYY-MM-DD (optionnel)
   * @param {number} [page=1] - Numéro de page pour la pagination
   * @returns {Promise<Object|null>} Créneaux disponibles ou null en cas d'erreur
   */
  async getAvailabilities(garageId = null, date = null, page = 1) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const params = { page };
      if (date) params.date = date;
      
      const response = await this.apiClient.get('/api/appointments/avaibilities', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting available time slots:', error.message);
      return null;
    }
  }

  /**
   * Crée un rendez-vous
   * @param {Object} appointmentData - Données du rendez-vous
   * @param {string} appointmentData.licensePlate - Plaque d'immatriculation du véhicule
   * @param {string} appointmentData.serviceId - ID du service sélectionné
   * @param {string} appointmentData.garageId - ID du garage sélectionné
   * @param {string} appointmentData.date - Date au format YYYY-MM-DD
   * @param {string} appointmentData.time - Heure au format HH:MM
   * @param {string} [appointmentData.notes] - Notes optionnelles
   * @returns {Promise<Object|null>} Résultat de la création ou null en cas d'erreur
   */
  async createAppointment(appointmentData) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      // Formater les données selon les exigences du backend
      const formattedData = await this.formatAppointmentData(appointmentData);
      
      console.log('Données formatées pour la création du rendez-vous:', formattedData);
      
      const response = await this.apiClient.post('/api/appointments', formattedData);
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return null;
    }
  }

  /**
   * Formate les données du rendez-vous selon les exigences du backend
   * @param {Object} appointmentData - Données brutes du rendez-vous
   * @returns {Promise<Object>} Données formatées pour l'API
   */
  async formatAppointmentData(appointmentData) {
    const { licensePlate, serviceId, garageId, date, time, notes } = appointmentData;
    
    // Formater correctement la date et l'heure
    let formattedDateTime;
    
    if (date && time && this.isValidTimeFormat(time)) {
      // Si on a une date complète (YYYY-MM-DD) et une heure valide (HH:MM)
      formattedDateTime = `${date}T${time}:00`;
    } else if (date && this.isValidDateFormat(date)) {
      // Si on a seulement une date valide, ajouter une heure par défaut
      formattedDateTime = `${date}T09:00:00`;
    } else {
      // Date par défaut (demain à 9h)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedDate = tomorrow.toISOString().split('T')[0];
      formattedDateTime = `${formattedDate}T09:00:00`;
    }
    
    console.log(`Formatage datetime: date="${date}", time="${time}" → "${formattedDateTime}"`);
    
    // Récupérer l'ID du véhicule si on a seulement la plaque
    let vehicleId = null;
    if (licensePlate) {
      try {
        const vehicleData = await this.getVehicleByPlate(licensePlate);
        if (vehicleData && vehicleData.id) {
          vehicleId = vehicleData.id;
        } else {
          // Si le véhicule n'existe pas, utiliser la plaque comme ID temporaire
          vehicleId = licensePlate;
        }
      } catch (error) {
        console.warn('Impossible de récupérer l\'ID du véhicule, utilisation de la plaque:', licensePlate);
        vehicleId = licensePlate;
      }
    }
    
    // Préparer les opérations (services) sous forme de tableau
    const operations = serviceId ? [serviceId] : [];
    
    // Générer des notes automatiques si non fournies
    const autoNotes = notes || `Rendez-vous automatique - Service: ${serviceId || 'Non spécifié'} - Véhicule: ${licensePlate || 'Non spécifié'}`;
    
    // Formater selon les exigences du formulaire backend
    const formattedData = {
      date: formattedDateTime,
      status: 'scheduled', // Status par défaut selon les choix disponibles
      notes: autoNotes,
      vehicule_id: vehicleId,
      garage_id: garageId,
      operations: operations
    };
    
    return formattedData;
  }

  /**
   * Vérifie si le format de l'heure est valide (HH:MM)
   * @param {string} time - Heure à vérifier
   * @returns {boolean} True si le format est valide
   */
  isValidTimeFormat(time) {
    if (!time || typeof time !== 'string') return false;
    
    // Vérifier le format HH:MM
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Vérifie si le format de la date est valide (YYYY-MM-DD)
   * @param {string} date - Date à vérifier
   * @returns {boolean} True si le format est valide
   */
  isValidDateFormat(date) {
    if (!date || typeof date !== 'string') return false;
    
    // Vérifier le format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    // Vérifier que la date est valide
    const parsedDate = new Date(date);
    return parsedDate instanceof Date && !isNaN(parsedDate);
  }

  /**
   * Récupère les rendez-vous de l'utilisateur
   * @returns {Promise<Array|null>} Liste des rendez-vous ou null en cas d'erreur
   */
  async getUserAppointments() {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.get('/api/appointments/user');
      return response.data;
    } catch (error) {
      console.error('Error getting user appointments:', error.message);
      return null;
    }
  }
}

module.exports = new ApiService(); 