/**
 * Chatbot simplifié et efficace pour la conversation parfaite
 */

const ChatAgent = require('./src/agents/chatAgent');

class SimpleChatbot {
  constructor() {
    this.agent = new ChatAgent();
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.agent.initialize();
      this.initialized = true;
    }
    return this;
  }

  async processMessage(message) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await this.agent.processMessage(message);
      
      // Log pour debug
      console.log(`[CHATBOT] Message: "${message}"`);
      console.log(`[CHATBOT] Étape: ${response.processState?.currentStep || 'N/A'}`);
      console.log(`[CHATBOT] Réponse: ${response.botResponse?.substring(0, 100)}...`);
      
      return {
        success: response.success,
        message: response.botResponse,
        step: response.processState?.currentStep || 1,
        data: response.processState?.extractedData || {}
      };
    } catch (error) {
      console.error('[CHATBOT] Erreur:', error);
      return {
        success: false,
        message: "Désolé, j'ai rencontré un problème technique. Pouvez-vous reformuler ?",
        step: 1,
        data: {}
      };
    }
  }

  reset() {
    if (this.agent) {
      this.agent.reset();
    }
  }

  getState() {
    if (!this.agent || !this.agent.state) {
      return {
        currentStep: 1,
        vehicle: { confirmed: false },
        service: { confirmed: false },
        garage: { confirmed: false },
        appointment: { confirmed: false }
      };
    }

    return {
      currentStep: this.agent.state.currentStep,
      vehicle: this.agent.state.vehicle,
      service: this.agent.state.service,
      garage: this.agent.state.garage,
      appointment: this.agent.state.appointment
    };
  }
}

// Test intégré
async function testPerfectFlow() {
  console.log('=== TEST FLUX PARFAIT ===\n');
  
  const chatbot = new SimpleChatbot();
  await chatbot.initialize();

  const messages = [
    "Bonjour, je souhaite prendre un rendez-vous pour ma voiture",
    "ab123cd",
    "Oui c'est bien mon véhicule",
    "Je pense que c'est un problème de batterie",
    "Très bien, je vais remplacer la batterie",
    "oui",
    "Je préfère le garage de Lyon",
    "oui",
    "Le 22 mai à 10h",
    "Oui je confirme"
  ];

  for (let i = 0; i < messages.length; i++) {
    console.log(`\n--- ${i+1}. "${messages[i]}" ---`);
    const response = await chatbot.processMessage(messages[i]);
    console.log(`Bot: ${response.message}`);
    console.log(`État: Étape ${response.step}`);
    
    if (response.data.licensePlate) console.log(`  - Plaque: ${response.data.licensePlate}`);
    if (response.data.vehicleValidated) console.log('  - Véhicule validé');
    if (response.data.serviceName) console.log(`  - Service: ${response.data.serviceName}`);
    if (response.data.serviceValidated) console.log('  - Service validé');
    if (response.data.garageName) console.log(`  - Garage: ${response.data.garageName}`);
    if (response.data.garageValidated) console.log('  - Garage validé');
    
    // Pause courte
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n=== FIN TEST ===');
}

module.exports = SimpleChatbot;

// Lancer le test si ce fichier est exécuté directement
if (require.main === module) {
  testPerfectFlow().catch(console.error);
} 