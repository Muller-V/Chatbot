require('dotenv').config();
const ChatAgent = require('./src/agents/chatAgent');
const { CONVERSATION_STEPS } = require('./src/config/constants');

// Fonction pour attendre un délai
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Messages de test pour une conversation complète
const TEST_CONVERSATION = [
  { 
    input: "Bonjour", 
    expectedStep: CONVERSATION_STEPS.VEHICLE_IDENTIFICATION,
    description: "Message initial"
  },
  { 
    input: "AA-123-BB", 
    expectedStep: CONVERSATION_STEPS.SERVICE_SELECTION,
    description: "Plaque d'immatriculation fournie"
  },
  { 
    input: "Service Huile Moteur", 
    expectedStep: CONVERSATION_STEPS.GARAGE_SELECTION,
    description: "Service sélectionné"
  },
  { 
    input: "Paris", 
    expectedStep: CONVERSATION_STEPS.TIME_SLOT_SELECTION,
    description: "Garage sélectionné"
  },
  { 
    input: "Demain à 14h", 
    expectedStep: CONVERSATION_STEPS.CONFIRMATION,
    description: "Horaire sélectionné" 
  },
  { 
    input: "Oui je confirme", 
    expectedStep: CONVERSATION_STEPS.COMPLETED,
    description: "Confirmation finale"
  }
];

// Test spécifique pour le problème de reconnaissance des services
const SERVICE_TEST = [
  { input: "Bonjour", description: "Message initial" },
  { input: "AA-123-BB", description: "Plaque d'immatriculation fournie" },
  { input: "Service Huile Moteur", description: "Test de reconnaissance du service huile moteur" },
  { input: "microfiltre d'habitacle", description: "Test de reconnaissance du service microfiltre" }
];

async function runServiceTest() {
  console.log("=== TEST DE RECONNAISSANCE DE SERVICES ===");
  const chatbot = new ChatAgent();
  await chatbot.initialize();
  
  console.log("\nÉtat initial du chatbot:");
  console.log("- Étape actuelle:", chatbot.state.currentStep);
  
  for (const step of SERVICE_TEST) {
    console.log(`\n[TEST] Envoi: "${step.input}" (${step.description})`);
    
    console.log("- Avant traitement - Étape:", chatbot.state.currentStep);
    console.log("- Service actuel:", chatbot.state.service.id ? `${chatbot.state.service.id}: ${chatbot.state.service.name}` : "Non sélectionné");
    
    const response = await chatbot.processMessage(step.input);
    console.log(`- Réponse du chatbot: "${response.botResponse}"`);
    
    console.log("- Après traitement - Étape:", chatbot.state.currentStep);
    console.log("- Service sélectionné:", chatbot.state.service.id ? `${chatbot.state.service.id}: ${chatbot.state.service.name}` : "Non sélectionné");
    console.log("- Service confirmé:", chatbot.state.service.confirmed ? "Oui" : "Non");
    
    // Attendre un peu entre les messages
    await wait(500);
  }
}

async function runFullTest() {
  console.log("=== TEST COMPLET DU CHATBOT ===");
  const chatbot = new ChatAgent();
  await chatbot.initialize();
  
  let allTestsPassed = true;
  
  for (const step of TEST_CONVERSATION) {
    console.log(`\n[TEST] Envoi: "${step.input}" (${step.description})`);
    console.log("- Étape actuelle avant:", chatbot.state.currentStep);
    
    const response = await chatbot.processMessage(step.input);
    console.log(`- Réponse du chatbot: "${response.botResponse}"`);
    console.log("- Étape après:", chatbot.state.currentStep);
    
    const stepPassed = chatbot.state.currentStep === step.expectedStep;
    console.log(`- Test ${stepPassed ? "RÉUSSI ✅" : "ÉCHOUÉ ❌"} - Attendu: ${step.expectedStep}`);
    
    if (!stepPassed) {
      allTestsPassed = false;
      console.log("  ⚠️ ERREUR: Le chatbot n'a pas avancé correctement à l'étape suivante!");
      console.log("  ℹ️ État actuel du service:", JSON.stringify(chatbot.state.service));
      console.log("  ℹ️ État actuel du véhicule:", JSON.stringify(chatbot.state.vehicle));
    }
    
    // Attendre un peu entre les messages
    await wait(500);
  }
  
  console.log("\n=== RÉSUMÉ DES TESTS ===");
  console.log(`Tests complets: ${allTestsPassed ? "Tous les tests ont réussi ✅" : "Certains tests ont échoué ❌"}`);
}

async function debugServiceStep() {
  console.log("=== DÉBUG SERVICE_SELECTION ===");
  const chatbot = new ChatAgent();
  await chatbot.initialize();
  
  // Configurer directement l'état pour tester la reconnaissance du service
  chatbot.state.currentStep = CONVERSATION_STEPS.SERVICE_SELECTION;
  chatbot.state.vehicle.licensePlate = "AA-123-BB";
  chatbot.state.vehicle.brand = "Renault";
  chatbot.state.vehicle.model = "Clio";
  chatbot.state.vehicle.confirmed = true;
  
  console.log("Services disponibles:");
  chatbot.state.availableServices.forEach(service => {
    console.log(`- ID: ${service.id}, Nom: ${service.name}, Prix: ${service.price || 'Non défini'}`);
  });
  
  const serviceMessages = [
    "Je voudrais faire une vidange",
    "Service Huile Moteur s'il vous plaît",
    "Microfiltre d'habitacle",
    "J'ai besoin d'un service huile moteur",
    "filtre à air"
  ];
  
  for (const msg of serviceMessages) {
    console.log(`\n[TEST] Message: "${msg}"`);
    
    // Réinitialiser le service à chaque test
    chatbot.state.service = { id: null, name: null, price: null, confirmed: false };
    chatbot.state.currentStep = CONVERSATION_STEPS.SERVICE_SELECTION;
    
    const response = await chatbot.processMessage(msg);
    console.log(`- Réponse: "${response.botResponse}"`);
    console.log("- Service détecté:", chatbot.state.service.id ? `${chatbot.state.service.id}: ${chatbot.state.service.name}` : "Aucun");
    console.log("- Service confirmé:", chatbot.state.service.confirmed ? "Oui" : "Non");
    console.log("- Étape après:", chatbot.state.currentStep);
  }
}

// Exécuter tous les tests
async function runAllTests() {
  try {
    console.log("\n\n======= TESTS CHATBOT AUTO SERVICE PRO =======\n");
    
    await runServiceTest();
    console.log("\n---------------------------------------\n");
    
    await debugServiceStep();
    console.log("\n---------------------------------------\n");
    
    await runFullTest();
    
    console.log("\n======= FIN DES TESTS =======");
  } catch (error) {
    console.error("Erreur lors de l'exécution des tests:", error);
  }
}

// Lancer les tests
runAllTests(); 