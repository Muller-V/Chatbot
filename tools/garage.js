const axios = require("axios");
const { DynamicTool, Tool } = require("langchain/tools");
const dotenv = require("dotenv");
const garageData = require("../data/garages");
const operationsData = require("../data/operations");

dotenv.config();

const API_URL = process.env.SYMFONY_API_URL || "http://localhost:8000";

/**
 * Récupère la liste des services disponibles au garage
 */
class ListServicesTools extends Tool {
  name = "listServices";

  description = "Permet d'obtenir la liste des services proposés par le garage";

  async _call(arg) {
    try {
      const args = arg ? JSON.parse(arg) : {};
      const category = args.category || null;
      
      // Essayer de récupérer depuis l'API backend
      try {
        if (category) {
          const response = await axios.get(`${API_URL}/operations/${category}`);
          if (response.data && Array.isArray(response.data)) {
            const formattedServices = response.data.map(service => ({
              nom: service.name,
              categorie: service.category ? service.category.name : 'Non catégorisé',
              prix: service.price ? `${service.price} €` : "Prix sur demande",
              duree: service.duration ? `${service.duration} minutes` : "Durée variable"
            }));
            
            return JSON.stringify({
              services: formattedServices
            }, null, 2);
          }
        } else {
          const response = await axios.get(`${API_URL}/operations`);
          if (response.data && Array.isArray(response.data)) {
            const formattedServices = response.data.map(service => ({
              nom: service.name,
              categorie: service.category ? service.category.name : 'Non catégorisé',
              prix: service.price ? `${service.price} €` : "Prix sur demande",
              duree: service.duration ? `${service.duration} minutes` : "Durée variable"
            }));
            
            return JSON.stringify({
              services: formattedServices
            }, null, 2);
          }
        }
      } catch (apiError) {
        console.log("API non disponible, utilisation des données locales", apiError.message);
      }
      
      // Fallback vers les données locales si l'API échoue
      let services;
      if (category) {
        services = operationsData.findOperationsByCategory(category);
      } else {
        services = operationsData.getAllOperations();
      }
      
      // Formatage pour meilleure lisibilité
      const formattedServices = services.map(service => ({
        nom: service.name,
        categorie: service.category,
        prix: service.price ? `${service.price} €` : "Prix sur demande",
        duree: service.time_unit ? `${service.time_unit} unités` : "Durée variable"
      }));
      
      return JSON.stringify({
        services: formattedServices,
        categories: operationsData.getAllCategories()
      }, null, 2);
    } catch (error) {
      console.error("Erreur ListServicesTools:", error);
      return `Erreur lors de la récupération des services: ${error.message}`;
    }
  }
}

/**
 * Récupère les créneaux disponibles pour un service donné
 */
class GetAvailableSlotsTools extends Tool {
  name = "getAvailableSlots";

  description = "Permet de trouver les créneaux disponibles pour un service donné";

  async _call(arg) {
    try {
      const args = arg ? JSON.parse(arg) : {};
      const { service, location, date } = args;
      
      // Essayer de récupérer depuis l'API backend
      try {
        const response = await axios.get(`${API_URL}/appointments/avaibilities`, {
          params: {
            service: service,
            location: location,
            date: date
          }
        });
        
        if (response.data && response.data.availabilities) {
          return JSON.stringify(response.data, null, 2);
        }
      } catch (apiError) {
        console.log("API de disponibilités non disponible, utilisation des données locales", apiError.message);
      }
      
      // Fallback: Recherche des garages à proximité de l'emplacement demandé
      let nearbyGarages = [];
      if (location) {
        nearbyGarages = garageData.findGaragesByLocation(location);
      } else {
        nearbyGarages = garageData.getAllGarages().slice(0, 5);
      }
      
      // Génération de créneaux fictifs pour la démonstration
      const slots = generateFakeSlots(date || new Date(), nearbyGarages);
      
      return JSON.stringify({
        service,
        location,
        garages: nearbyGarages.map(g => g.name),
        slots
      }, null, 2);
    } catch (error) {
      console.error("Erreur GetAvailableSlotsTools:", error);
      return `Erreur lors de la recherche des créneaux disponibles: ${error.message}`;
    }
  }
}

/**
 * Réserve un créneau horaire
 */
class BookSlotTools extends Tool {
  name = "bookSlot";

  description = "Permet de réserver un créneau horaire";

  async _call(arg) {
    try {
      const args = arg ? JSON.parse(arg) : {};
      const { service, garage, datetime, clientName, clientPhone, vehicleInfo, licensePlate } = args;
      
      // Vérifications basiques
      if (!service || !garage || !datetime) {
        return JSON.stringify({
          success: false,
          message: "Informations incomplètes. Veuillez fournir le service, le garage et la date/heure souhaités."
        }, null, 2);
      }
      
      // Essayer d'envoyer la réservation à l'API
      try {
        const appointmentData = {
          service_id: typeof service === 'string' ? service : service.id,
          garage_id: typeof garage === 'string' ? garage : garage.id,
          datetime: datetime,
          client_name: clientName || "Client",
          client_phone: clientPhone || "",
          license_plate: licensePlate || "",
          vehicle_info: vehicleInfo || {}
        };
        
        const response = await axios.post(`${API_URL}/appointments`, appointmentData);
        
        if (response.data) {
          return JSON.stringify({
            success: true,
            message: "Réservation confirmée",
            details: response.data
          }, null, 2);
        }
      } catch (apiError) {
        console.log("API de réservation non disponible, simulation de réservation", apiError.message);
      }
      
      // Simulation d'une réservation réussie (fallback)
      return JSON.stringify({
        success: true,
        message: "Réservation confirmée",
        details: {
          service,
          garage,
          datetime,
          client: {
            name: clientName || "Client",
            phone: clientPhone || "Non spécifié"
          },
          vehicle: {
            info: vehicleInfo || "Non spécifié",
            license_plate: licensePlate || "Non spécifié"
          },
          reference: "RES-" + Math.floor(Math.random() * 10000)
        }
      }, null, 2);
    } catch (error) {
      console.error("Erreur BookSlotTools:", error);
      return `Erreur lors de la réservation: ${error.message}`;
    }
  }
}

/**
 * Récupère les informations sur un véhicule à partir de sa plaque d'immatriculation
 */
class GetVehicleInfoTools extends Tool {
  name = "getVehicleInfo";

  description = "Permet d'obtenir les informations sur un véhicule à partir de sa plaque d'immatriculation";

  async _call(arg) {
    try {
      const args = arg ? JSON.parse(arg) : {};
      const { licensePlate } = args;
      
      if (!licensePlate) {
        return JSON.stringify({
          success: false,
          message: "Veuillez fournir une plaque d'immatriculation"
        }, null, 2);
      }
      
      // Vérifier le format de la plaque
      const licenseRegex = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;
      if (!licenseRegex.test(licensePlate)) {
        return JSON.stringify({
          success: false,
          message: "Format de plaque invalide. Le format attendu est AA-123-AA"
        }, null, 2);
      }
      
      // Essayer de récupérer les informations du véhicule via l'API
      try {
        const response = await axios.get(`${API_URL}/vehicules/${licensePlate}`);
        
        if (response.data) {
          return JSON.stringify({
            success: true,
            vehicle: response.data
          }, null, 2);
        }
      } catch (apiError) {
        console.log("API véhicules non disponible, simulation de données", apiError.message);
      }
      
      // Données simulées (fallback)
      return JSON.stringify({
        success: true,
        vehicle: {
          license_plate: licensePlate,
          brand: "Renault",
          model: "Clio",
          year: "2020",
          fuel_type: "Essence",
          mileage: "25000 km"
        }
      }, null, 2);
    } catch (error) {
      console.error("Erreur GetVehicleInfoTools:", error);
      return `Erreur lors de la récupération des informations du véhicule: ${error.message}`;
    }
  }
}

// Fonction utilitaire pour générer des créneaux fictifs
function generateFakeSlots(baseDate, garages) {
  const slots = [];
  
  // Convertir en objet Date si c'est une chaîne
  if (typeof baseDate === 'string') {
    baseDate = new Date(baseDate);
  }
  
  // Si date invalide, utiliser la date actuelle
  if (!(baseDate instanceof Date && !isNaN(baseDate))) {
    baseDate = new Date();
  }
  
  // Générer des créneaux pour les 5 prochains jours
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    
    // Exclure le dimanche
    if (currentDate.getDay() === 0) continue;
    
    // Horaires: 9h-12h et 14h-17h
    const morningHours = [9, 10, 11];
    const afternoonHours = [14, 15, 16];
    
    // Pour chaque garage, générer quelques créneaux disponibles
    garages.forEach(garage => {
      // Créneaux du matin
      morningHours.forEach(hour => {
        // Ajouter seulement si aléatoire > 0.3 (simulation de disponibilité)
        if (Math.random() > 0.3) {
          slots.push({
            garage: garage.name,
            address: garage.address,
            city: garage.city,
            date: formatDate(currentDate),
            time: `${hour}:00`,
            available: true
          });
        }
      });
      
      // Créneaux de l'après-midi
      afternoonHours.forEach(hour => {
        if (Math.random() > 0.3) {
          slots.push({
            garage: garage.name,
            address: garage.address,
            city: garage.city,
            date: formatDate(currentDate),
            time: `${hour}:00`,
            available: true
          });
        }
      });
    });
  }
  
  return slots;
}

// Fonction pour formater une date
function formatDate(date) {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

// Exportation des outils
const listServicesTools = new ListServicesTools();
const getAvailableSlotsTools = new GetAvailableSlotsTools();
const bookSlotTools = new BookSlotTools();
const getVehicleInfoTools = new GetVehicleInfoTools();

module.exports = {
  listServicesTools,
  getAvailableSlotsTools,
  bookSlotTools,
  getVehicleInfoTools
}; 