/**
 * Test basé sur la conversation parfaite demandée par l'utilisateur
 */

const ChatAgent = require('./src/agents/chatAgent');

async function testPerfectConversation() {
  console.log('=== TEST DE LA CONVERSATION PARFAITE ===\n');

  const chatAgent = new ChatAgent();
  await chatAgent.initialize();

  console.log('Chatbot initialisé\n');

  // Séquence de test de la conversation parfaite
  const testMessages = [
    "Bonjour, je souhaite prendre un rendez-vous pour ma voiture",  // Demande générale
    "AB-123-CD",                                                       // Plaque
    "Oui c'est bien mon véhicule",                                 // Confirmation véhicule
    "Je pense que c'est un problème moteur",                  // Demande service spécifique
    "huile moteur",                    // Sélection service
    "oui",                                                          // Confirmation service
    "Je préfère le garage de Lyon",                                 // Sélection garage
    "oui",                                                          // Confirmation garage
    "Le 22 mai à 10h",                                             // Sélection créneau
    "Oui je confirme"                                               // Confirmation finale
  ];

  const expectedResponses = [
    "demander la plaque",
    "identifier le véhicule et demander confirmation",
    "proposer des services",
    "proposer des services liés au moteur",
    "demander confirmation du service",
    "proposer des garages",
    "demander confirmation du garage",
    "proposer des créneaux",
    "récapitulatif et demande de confirmation finale",
    "confirmation finale du rendez-vous"
  ];

  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`\n--- MESSAGE ${i + 1}: "${message}" ---`);
    console.log(`Réponse attendue: ${expectedResponses[i]}`);
    
    const response = await chatAgent.processMessage(message);
    
    if (response.success) {
      console.log(`Étape: ${response.processState.currentStep}`);
      console.log(`Bot: ${response.botResponse}`);
      
      if (response.processState.extractedData) {
        const data = response.processState.extractedData;
        console.log('Données extraites:');
        if (data.licensePlate) console.log(`  - Plaque: ${data.licensePlate}`);
        if (data.vehicleValidated) console.log('  - Véhicule: VALIDÉ');
        if (data.serviceName) console.log(`  - Service: ${data.serviceName} (ID: ${data.serviceId})`);
        if (data.serviceValidated) console.log('  - Service: VALIDÉ');
        if (data.garageName) console.log(`  - Garage: ${data.garageName} (ID: ${data.garageId})`);
        if (data.garageValidated) console.log('  - Garage: VALIDÉ');
      }
    } else {
      console.log(`ERREUR: ${response.botResponse}`);
    }
    
    console.log(`État interne: Étape ${chatAgent.state.currentStep}`);
    console.log(`- Véhicule confirmé: ${chatAgent.state.vehicle.confirmed}`);
    console.log(`- Service confirmé: ${chatAgent.state.service.confirmed}`);
    console.log(`- Garage confirmé: ${chatAgent.state.garage.confirmed}`);
    
    // Pause pour la lecture
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== FIN DU TEST ===');
}

// Gestion des erreurs globales
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Lancer le test
testPerfectConversation().catch(console.error); 