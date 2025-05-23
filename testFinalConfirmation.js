/**
 * Test de la confirmation finale et création de rendez-vous
 */

const ChatAgent = require('./src/agents/chatAgent');

async function testFinalConfirmation() {
  console.log('=== TEST CREATION RENDEZ-VOUS ===\n');

  const chatAgent = new ChatAgent();
  await chatAgent.initialize();
  
  // Simuler un état complet avant la confirmation finale
  console.log('Configuration de l\'état pour la confirmation finale...');
  
  chatAgent.state.currentStep = 9;
  chatAgent.state.vehicle = {
    licensePlate: 'AB-123-CD',
    confirmed: true
  };
  chatAgent.vehicleData = {
    licensePlate: 'AB-123-CD',
    brand: 'Renault',
    model: 'Clio',
    id: 'test-vehicle-id'
  };
  chatAgent.state.service = {
    id: '0196f7f9-812b-7a28-9e39-b2cb5179123f',
    name: 'Service Huile Moteur',
    confirmed: true
  };
  chatAgent.state.garage = {
    id: '0196f7f9-7f76-7638-9f78-2b85ad4a7002',
    name: 'ALTITUDE 69 LYON',
    confirmed: true
  };
  chatAgent.state.appointment = {
    date: '2025-05-22',
    time: '10:00',
    finalConfirmed: false,
    created: false,
    id: null
  };
  
  console.log('État configuré:', {
    step: chatAgent.state.currentStep,
    vehicle: chatAgent.state.vehicle,
    service: chatAgent.state.service,
    garage: chatAgent.state.garage,
    appointment: chatAgent.state.appointment
  });
  
  console.log('\n--- TEST CONFIRMATION FINALE ---');
  console.log('Message utilisateur: "Oui je confirme"');
  
  // Tester la confirmation finale
  const response = await chatAgent.processMessage('Oui je confirme');
  
  console.log('\n--- RÉSULTAT ---');
  console.log('Succès:', response.success);
  console.log('Réponse bot:', response.botResponse);
  
  if (response.processState) {
    console.log('État après confirmation:');
    console.log('- Étape actuelle:', response.processState.currentStep);
    console.log('- Données extraites:', response.processState.extractedData);
  }
  
  console.log('\nÉtat final du rendez-vous:');
  console.log('- Confirmé:', chatAgent.state.appointment.finalConfirmed);
  console.log('- Créé:', chatAgent.state.appointment.created);
  console.log('- ID:', chatAgent.state.appointment.id);
  
  console.log('\n=== FIN DU TEST ===');
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Lancer le test
testFinalConfirmation().catch(console.error); 