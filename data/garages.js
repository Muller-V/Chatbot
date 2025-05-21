const garages = [
  {
    id: "1",
    name: "ENVERGURE LA ROCHELLE",
    city: "Puilboreau",
    address: "48 Rue du 8 Mai 1945",
    zipcode: "17138",
    latitude: 46.179446,
    longitude: -1.104911
  },
  {
    id: "2",
    name: "ROYAL SA MEYLAN",
    city: "Meylan",
    address: "1 bis Boulevard des Alpes",
    zipcode: "38240",
    latitude: 45.202648,
    longitude: 5.766119
  },
  {
    id: "3",
    name: "PAYS DE LOIRE AUTOMOBILES NANTES",
    city: "Saint-Herblain",
    address: "104 Avenue des Lions",
    zipcode: "44800",
    latitude: 47.249614,
    longitude: -1.619745
  },
  {
    id: "4",
    name: "ALTITUDE 69 LYON",
    city: "Lyon",
    address: "6 Rue Joannès Carret",
    zipcode: "69009",
    latitude: 45.784958,
    longitude: 4.809382
  },
  {
    id: "5",
    name: "INDIGO LES ULIS",
    city: "Villebon-sur-Yvette",
    address: "8 Avenue du Québec",
    zipcode: "91140",
    latitude: 48.688082,
    longitude: 2.208137
  },
  // ... etc. avec tous les garages du dataset
  {
    id: "6",
    name: "BMW NICE PREMIUM MOTORS",
    city: "Nice",
    address: "116 Avenue Simone Veil",
    zipcode: "06200",
    latitude: 43.689393,
    longitude: 7.201394
  }
  // Ajoutez tous les autres garages ici (j'ai limité pour la concision)
];

// Fonction pour obtenir tous les garages
function getAllGarages() {
  return garages;
}

// Fonction pour chercher des garages par ville ou code postal
function findGaragesByLocation(query) {
  const searchTerm = query.toLowerCase();
  return garages.filter(garage => 
    garage.city.toLowerCase().includes(searchTerm) || 
    garage.zipcode.includes(searchTerm)
  );
}

// Fonction pour chercher les garages les plus proches d'un point (lat, lng)
function findNearestGarages(latitude, longitude, limit = 5) {
  // Calcul de la distance (formule de Haversine simplifiée)
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calcul de la distance pour chaque garage
  const garagesWithDistance = garages.map(garage => ({
    ...garage,
    distance: calculateDistance(
      latitude, 
      longitude, 
      garage.latitude, 
      garage.longitude
    )
  }));

  // Trier par distance
  return garagesWithDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

// Fonction pour obtenir un garage par son ID
function getGarageById(id) {
  return garages.find(garage => garage.id === id);
}

module.exports = {
  getAllGarages,
  findGaragesByLocation,
  findNearestGarages,
  getGarageById
}; 