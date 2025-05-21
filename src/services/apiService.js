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
  }

  /**
   * Check if the API is available
   * @returns {Promise<boolean>} True if API is available
   */
  async checkApiAvailability() {
    try {
      await this.apiClient.get('/api/garages');
      return true;
    } catch (error) {
      console.warn('API not available, running in mock mode:', error.message);
      return false;
    }
  }

  /**
   * Get vehicle information by license plate
   * @param {string} licensePlate - Vehicle license plate
   * @returns {Promise<Object|null>} Vehicle information or null if not found
   */
  async getVehicleInfo(licensePlate) {
    try {
      const response = await this.apiClient.get(`/api/vehicules/${licensePlate}`);
      return response.data;
    } catch (error) {
      console.error(`Error getting vehicle info for ${licensePlate}:`, error.message);
      return null;
    }
  }

  /**
   * Get available operations/services
   * @param {string} [categoryId] - Optional category ID to filter by
   * @returns {Promise<Array|null>} List of operations or null on error
   */
  async getOperations(categoryId = null) {
    try {
      const url = categoryId ? `/api/operations/${categoryId}` : '/api/operations';
      const response = await this.apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting operations:', error.message);
      return null;
    }
  }

  /**
   * Get operation categories
   * @returns {Promise<Array|null>} List of operation categories or null on error
   */
  async getOperationCategories() {
    try {
      const response = await this.apiClient.get('/api/operations/category');
      return response.data;
    } catch (error) {
      console.error('Error getting operation categories:', error.message);
      return null;
    }
  }

  /**
   * Get garages near a location
   * @param {number} latitude - User latitude
   * @param {number} longitude - User longitude
   * @returns {Promise<Array|null>} List of nearby garages or null on error
   */
  async getNearbyGarages(latitude, longitude) {
    try {
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
   * Get all available garages
   * @returns {Promise<Array|null>} List of all garages or null on error
   */
  async getAllGarages() {
    try {
      const response = await this.apiClient.get('/api/garages');
      return response.data;
    } catch (error) {
      console.error('Error getting all garages:', error.message);
      return null;
    }
  }

  /**
   * Get available appointment slots
   * @param {string} garageId - Garage ID
   * @param {string} serviceId - Service ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array|null>} List of available time slots or null on error
   */
  async getAvailableTimeSlots(garageId, serviceId, date) {
    try {
      const response = await this.apiClient.get('/api/appointments/avaibilities', {
        params: { garage_id: garageId, service_id: serviceId, date }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting available time slots:', error.message);
      return null;
    }
  }

  /**
   * Book an appointment
   * @param {Object} appointmentData - Appointment data
   * @returns {Promise<boolean>} True if booking was successful
   */
  async bookAppointment(appointmentData) {
    try {
      const response = await this.apiClient.post('/api/appointments', appointmentData);
      return response.status === 201; // Created
    } catch (error) {
      console.error('Error booking appointment:', error.message);
      return false;
    }
  }
}

module.exports = new ApiService(); 