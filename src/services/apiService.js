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
      
      // S'assurer que la plaque est au format correct (AA-123-BB)
      const formattedPlate = this.formatLicensePlate(licensePlate);
      console.log(`Recherche du véhicule avec la plaque formatée: ${formattedPlate}`);
      
      const response = await this.apiClient.get(`/api/vehicules/${formattedPlate}`);
      
      // Ajouter la plaque d'immatriculation au résultat pour garantir sa présence
      if (response.data) {
        if (!response.data.licensePlate) {
          response.data.licensePlate = formattedPlate;
        }
      }
      
      return response.data;
    } catch (error) {
      // Gérer spécifiquement les erreurs 400 (format invalide) et 404 (véhicule non trouvé)
      if (error.response) {
        if (error.response.status === 400) {
          console.warn(`Format de plaque invalide: ${licensePlate}`);
          return null;
        } else if (error.response.status === 404) {
          console.warn(`Véhicule non trouvé avec la plaque: ${licensePlate}`);
          // Créer un objet véhicule minimal avec la plaque
          return {
            licensePlate: licensePlate,
            brand: "Marque inconnue",
            model: "Modèle inconnu"
          };
        }
      }
      
      console.error(`Erreur lors de la récupération des informations du véhicule ${licensePlate}:`, error.message);
      return null;
    }
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
   * @returns {Promise<Object|null>} Résultat de la création ou null en cas d'erreur
   */
  async createAppointment(appointmentData) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }
      
      const response = await this.apiClient.post('/api/appointments', appointmentData);
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error.message);
      return null;
    }
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