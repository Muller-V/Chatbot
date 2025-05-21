const operations = [
  {
    id: "1",
    name: "Service Huile Moteur",
    category: "Je souhaite entretenir mon véhicule",
    additional_help: "Veuillez noter que lors de la vidange, le remplacement du microfiltre d'habitacle est nécessaire. Aussi, nous vous invitons à l'ajouter à votre sélection.",
    additional_comment: null,
    time_unit: 10,
    price: 494
  },
  {
    id: "2",
    name: "Service microfiltre d'habitacle",
    category: "Je souhaite entretenir mon véhicule",
    additional_help: null,
    additional_comment: null,
    time_unit: 2,
    price: 215
  },
  {
    id: "3",
    name: "Service filtre à carburant",
    category: "Je souhaite entretenir mon véhicule",
    additional_help: null,
    additional_comment: null,
    time_unit: 3,
    price: 339
  },
  {
    id: "4",
    name: "Service filtre à air",
    category: "Je souhaite entretenir mon véhicule",
    additional_help: null,
    additional_comment: null,
    time_unit: 2,
    price: 247
  },
  {
    id: "5",
    name: "Service liquide de freins",
    category: "Je souhaite entretenir mon véhicule",
    additional_help: null,
    additional_comment: null,
    time_unit: 4,
    price: 409
  },
  {
    id: "6",
    name: "Service climatisation",
    category: "Je souhaite entretenir ma climatisation et/ou changer mes essuie-glaces",
    additional_help: null,
    additional_comment: null,
    time_unit: 18,
    price: 675
  },
  {
    id: "7",
    name: "Remplacement pneumatiques x4",
    category: "Je souhaite changer ou réparer mes roues ou pneus",
    additional_help: null,
    additional_comment: null,
    time_unit: 28,
    price: 1062
  },
  {
    id: "8",
    name: "Contrôle technique",
    category: "Je souhaite réaliser mon contrôle technique",
    additional_help: null,
    additional_comment: null,
    time_unit: 6,
    price: 439
  },
  {
    id: "9",
    name: "Demande de rappel",
    category: "Je ne sais pas ce que je veux faire",
    additional_help: "Je souhaite être recontacté(e) par ma concession afin de définir avec exactitude l'étendue des réparations à réaliser.",
    additional_comment: "Merci de donner plus d'indications sur votre demande :",
    time_unit: 0,
    price: 146
  }
  // Ajoutez toutes les autres opérations ici (j'ai limité pour la concision)
];

// Toutes les catégories disponibles
const categories = [
  "Je souhaite entretenir mon véhicule",
  "Je souhaite entretenir ma climatisation et/ou changer mes essuie-glaces",
  "Je souhaite changer ou réparer mes roues ou pneus",
  "Je souhaite réaliser mon contrôle technique",
  "Je souhaite réparer mon véhicule", 
  "Je souhaite profiter des offres promotionnelles",
  "Je ne sais pas ce que je veux faire"
];

// Fonction pour obtenir toutes les opérations
function getAllOperations() {
  return operations;
}

// Fonction pour obtenir toutes les catégories
function getAllCategories() {
  return categories;
}

// Fonction pour chercher des opérations par nom
function findOperationsByName(query) {
  const searchTerm = query.toLowerCase();
  return operations.filter(op => 
    op.name.toLowerCase().includes(searchTerm)
  );
}

// Fonction pour chercher des opérations par catégorie
function findOperationsByCategory(category) {
  return operations.filter(op => op.category === category);
}

// Fonction pour obtenir une opération par son ID
function getOperationById(id) {
  return operations.find(op => op.id === id);
}

// Fonction pour détecter la catégorie à partir d'un texte
function detectCategory(text) {
  const lowercaseText = text.toLowerCase();
  
  // Mappages de mots-clés vers des catégories
  const keywordMap = {
    'entretien': "Je souhaite entretenir mon véhicule",
    'vidange': "Je souhaite entretenir mon véhicule",
    'huile': "Je souhaite entretenir mon véhicule", 
    'filtre': "Je souhaite entretenir mon véhicule",
    'climatisation': "Je souhaite entretenir ma climatisation et/ou changer mes essuie-glaces",
    'clim': "Je souhaite entretenir ma climatisation et/ou changer mes essuie-glaces",
    'essuie': "Je souhaite entretenir ma climatisation et/ou changer mes essuie-glaces",
    'pneu': "Je souhaite changer ou réparer mes roues ou pneus",
    'roue': "Je souhaite changer ou réparer mes roues ou pneus",
    'amortisseur': "Je souhaite changer ou réparer mes roues ou pneus",
    'contrôle technique': "Je souhaite réaliser mon contrôle technique",
    'ct': "Je souhaite réaliser mon contrôle technique",
    'réparation': "Je souhaite réparer mon véhicule",
    'réparer': "Je souhaite réparer mon véhicule",
    'panne': "Je souhaite réparer mon véhicule",
    'promo': "Je souhaite profiter des offres promotionnelles",
    'offre': "Je souhaite profiter des offres promotionnelles"
  };

  // Chercher les correspondances
  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (lowercaseText.includes(keyword)) {
      return category;
    }
  }
  
  // Par défaut
  return "Je ne sais pas ce que je veux faire";
}

// Fonction pour recommander des opérations basées sur une requête
function recommendOperations(query, limit = 3) {
  // Détection de catégorie
  const category = detectCategory(query);
  
  // Obtenir les opérations pour cette catégorie
  const categoryOperations = findOperationsByCategory(category);
  
  // Si aucune opération de cette catégorie, retourner les plus populaires
  if (categoryOperations.length === 0) {
    return operations.slice(0, limit);
  }
  
  return categoryOperations.slice(0, limit);
}

module.exports = {
  getAllOperations,
  getAllCategories,
  findOperationsByName,
  findOperationsByCategory,
  getOperationById,
  detectCategory,
  recommendOperations
}; 