const axios = require("axios");
const { DynamicTool } = require("langchain/tools");
const dotenv = require("dotenv");

dotenv.config();

const API_URL = process.env.SYMFONY_API_URL || "http://localhost:8000/api";

/**
 * Récupère la liste des services disponibles au garage
 */
const listServicesTools = new DynamicTool({
  name: "listServices",
  description: "Obtient la liste des services proposés par le garage (révision, vidange, diagnostic, etc.)",
  func: async () => {
    try {
      // En situation réelle, ceci appellerait l'API Symfony
      const response = await axios.get(`${API_URL}/services`);
      return JSON.stringify(response.data);
    } catch (error) {
      // Pour le POC, retournons des données simulées en cas d'erreur
      return JSON.stringify([
        { 
          id: 1, 
          name: "Révision standard", 
          price: 120, 
          duration: 60,
          description: "Contrôle complet du véhicule: niveaux, filtres, freins, suspensions, pneus, éclairage et essai routier.",
          recommendation: "Recommandé tous les 15 000 km ou une fois par an."
        },
        { 
          id: 2, 
          name: "Vidange moteur", 
          price: 80, 
          duration: 45,
          description: "Remplacement de l'huile moteur et du filtre à huile avec produits de qualité supérieure.",
          recommendation: "Recommandé tous les 10 000 km ou une fois par an selon le type de véhicule."
        },
        { 
          id: 3, 
          name: "Diagnostic électronique", 
          price: 60, 
          duration: 30,
          description: "Analyse complète des systèmes électroniques du véhicule pour identifier les anomalies.",
          recommendation: "Recommandé en cas de voyant allumé ou de dysfonctionnement."
        },
        { 
          id: 4, 
          name: "Changement de pneus", 
          price: 200, 
          duration: 60,
          description: "Remplacement des pneus, équilibrage et vérification de la géométrie.",
          recommendation: "Recommandé lorsque la profondeur des sculptures est inférieure à 3mm."
        },
        { 
          id: 5, 
          name: "Réparation freins", 
          price: 150, 
          duration: 90,
          description: "Remplacement des plaquettes et/ou disques de frein selon l'état, purge du liquide si nécessaire.",
          recommendation: "Recommandé en cas de bruit au freinage ou de performance réduite."
        },
        {
          id: 6,
          name: "Contrôle climatisation",
          price: 70,
          duration: 40,
          description: "Vérification et recharge du système de climatisation, contrôle d'étanchéité.",
          recommendation: "Recommandé tous les 2 ans ou en cas de performance réduite."
        },
        {
          id: 7,
          name: "Remplacement batterie",
          price: 110,
          duration: 30,
          description: "Remplacement de la batterie par un modèle adapté au véhicule avec vérification du système de charge.",
          recommendation: "Recommandé tous les 4-5 ans ou en cas de difficulté au démarrage."
        }
      ]);
    }
  },
});

/**
 * Récupère les créneaux disponibles pour un service donné
 */
const getAvailableSlotsTools = new DynamicTool({
  name: "getAvailableSlots",
  description: "Obtient les créneaux horaires disponibles pour un service donné. Requiert un objet JSON avec serviceId (obligatoire) et date (optionnel, format YYYY-MM-DD)",
  func: async (input) => {
    try {
      // Parsing des paramètres (serviceId, date)
      const params = JSON.parse(input);
      
      if (!params.serviceId) {
        return JSON.stringify({
          error: "Le paramètre serviceId est requis pour rechercher des créneaux disponibles."
        });
      }
      
      // En situation réelle, ceci appellerait l'API Symfony
      const response = await axios.get(`${API_URL}/slots`, { params });
      return JSON.stringify(response.data);
    } catch (error) {
      // Pour le POC, retournons des données simulées
      // Générer des créneaux pour les 3 prochains jours
      const slots = [];
      const today = new Date();
      
      // Service demandé
      const serviceId = parseInt(JSON.parse(input).serviceId);
      
      // Noms des services pour les messages de confirmation
      const serviceNames = {
        1: "Révision standard",
        2: "Vidange moteur",
        3: "Diagnostic électronique",
        4: "Changement de pneus",
        5: "Réparation freins",
        6: "Contrôle climatisation",
        7: "Remplacement batterie"
      };
      
      const serviceName = serviceNames[serviceId] || "Service demandé";
      
      // Récupérer la date demandée si fournie
      let startDate = today;
      try {
        const parsedInput = JSON.parse(input);
        if (parsedInput.date) {
          startDate = new Date(parsedInput.date);
          if (isNaN(startDate.getTime())) {
            startDate = today;
          }
        }
      } catch (e) {
        // Ignorer les erreurs et utiliser la date du jour
      }
      
      for (let i = 1; i <= 5; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        // Sauter les dimanches
        if (date.getDay() === 0) continue;
        
        const dateStr = date.toISOString().split('T')[0];
        const readableDate = new Intl.DateTimeFormat('fr-FR', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long'
        }).format(date);
        
        // Ajouter plusieurs créneaux pour chaque jour
        if (date.getDay() !== 6) { // Pas le samedi
          slots.push({ 
            id: i*100+1, 
            date: dateStr, 
            time: "09:00", 
            available: true,
            readableDate: readableDate,
            service: serviceName
          });
          slots.push({ 
            id: i*100+2, 
            date: dateStr, 
            time: "11:00", 
            available: true,
            readableDate: readableDate,
            service: serviceName
          });
          slots.push({ 
            id: i*100+3, 
            date: dateStr, 
            time: "14:00", 
            available: true,
            readableDate: readableDate,
            service: serviceName
          });
          slots.push({ 
            id: i*100+4, 
            date: dateStr, 
            time: "16:00", 
            available: true,
            readableDate: readableDate,
            service: serviceName
          });
        } else { // Samedi: seulement le matin
          slots.push({ 
            id: i*100+5, 
            date: dateStr, 
            time: "09:30", 
            available: true,
            readableDate: readableDate,
            service: serviceName
          });
          slots.push({ 
            id: i*100+6, 
            date: dateStr, 
            time: "11:30", 
            available: true,
            readableDate: readableDate,
            service: serviceName
          });
        }
      }
      
      return JSON.stringify({
        slots: slots,
        message: `Voici les créneaux disponibles pour ${serviceName} dans les prochains jours.`
      });
    }
  },
});

/**
 * Réserve un créneau horaire
 */
const bookSlotTools = new DynamicTool({
  name: "bookSlot",
  description: "Réserve un créneau horaire pour un service. Requiert un objet JSON avec slotId, serviceId, customerName, vehicleInfo (marque, modèle, année), et optionnellement customerPhone et comments",
  func: async (input) => {
    try {
      // Parsing des paramètres (slotId, serviceId, customerName, vehicleInfo)
      const bookingData = JSON.parse(input);
      
      // Vérifier que tous les champs requis sont présents
      if (!bookingData.slotId || !bookingData.serviceId || 
          !bookingData.customerName || !bookingData.vehicleInfo) {
        return JSON.stringify({ 
          success: false, 
          error: "Informations manquantes. Veuillez fournir slotId, serviceId, customerName et vehicleInfo" 
        });
      }
      
      // En situation réelle, ceci appellerait l'API Symfony
      const response = await axios.post(`${API_URL}/bookings`, bookingData);
      return JSON.stringify(response.data);
    } catch (error) {
      // Pour le POC, simulons une réservation réussie
      const slotId = parseInt(JSON.parse(input).slotId || 0);
      const serviceId = parseInt(JSON.parse(input).serviceId || 0);
      const customerName = JSON.parse(input).customerName || "le client";
      const vehicleInfo = JSON.parse(input).vehicleInfo || {};
      
      // Générer une "vraie" réservation
      // Récupérer les données du créneau en fonction du slotId
      const day = Math.floor(slotId / 100);
      const today = new Date();
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];
      
      // Déterminer l'heure en fonction du modulo
      const timeMapping = {
        1: "09:00", 2: "11:00", 3: "14:00", 4: "16:00", 5: "09:30", 6: "11:30"
      };
      const time = timeMapping[slotId % 100] || "10:00";
      
      // Noms des services
      const serviceNames = {
        1: "Révision standard",
        2: "Vidange moteur",
        3: "Diagnostic électronique",
        4: "Changement de pneus",
        5: "Réparation freins",
        6: "Contrôle climatisation",
        7: "Remplacement batterie"
      };
      
      const serviceName = serviceNames[serviceId] || "Service demandé";
      const readableDate = new Intl.DateTimeFormat('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric'
      }).format(date);
      
      const vehicleDesc = typeof vehicleInfo === 'string' 
        ? vehicleInfo 
        : `${vehicleInfo.marque || ''} ${vehicleInfo.modele || ''} ${vehicleInfo.annee || ''}`;
      
      return JSON.stringify({ 
        success: true, 
        bookingId: Math.floor(Math.random() * 10000) + 1000,
        service: serviceName,
        date: dateStr,
        time: time,
        readableDate: readableDate,
        customerName: customerName,
        vehicleInfo: vehicleDesc,
        message: `Réservation confirmée pour ${customerName} le ${readableDate} à ${time} pour ${serviceName.toLowerCase()}.`,
        additionalInfo: "Veuillez vous présenter 10 minutes avant l'heure de votre rendez-vous. N'oubliez pas d'apporter votre carte grise."
      });
    }
  },
});

module.exports = {
  listServicesTools,
  getAvailableSlotsTools,
  bookSlotTools
}; 