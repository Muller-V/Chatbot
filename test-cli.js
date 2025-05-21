#!/usr/bin/env node

const readline = require('readline');
const chalk = require('chalk');
const ora = require('ora');
const dotenv = require('dotenv');
const { processMessage } = require('./orchestrator');

// Chargement des variables d'environnement
dotenv.config();

// Configuration de l'interface de ligne de commande
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Constantes pour les étapes
const STEPS = [
  { name: "Identification du véhicule", emoji: "🚗" },
  { name: "Sélection du service", emoji: "🔧" },
  { name: "Choix du garage", emoji: "🏢" },
  { name: "Sélection du créneau", emoji: "📅" },
  { name: "Confirmation", emoji: "📋" }
];

// État actuel de la conversation
let currentState = {
  step: 0,
  vehicleInfo: null,
  serviceSelected: null,
  garageSelected: null,
  appointmentTime: null,
  isConfirmed: false
};

// Affichage du titre et des instructions
console.log(chalk.blue.bold('\n🔧 AUTO SERVICE PRO - CHATBOT CLI 🔧'));
console.log(chalk.gray('------------------------------------'));
console.log(chalk.yellow(`👋 Bienvenue dans l'interface CLI de BOB - L'assistant de réservation automobile`));
console.log(chalk.gray('- Tapez votre message et appuyez sur Entrée'));
console.log(chalk.gray('- Tapez "exit" ou "quit" pour quitter'));
console.log(chalk.gray('- Tapez "clear" pour effacer l\'historique de conversation'));
console.log(chalk.gray('- Tapez "status" pour voir l\'état actuel du processus'));
console.log(chalk.gray('------------------------------------\n'));

// Afficher les étapes actuelles
function showSteps() {
  console.log(chalk.cyan('\n[Processus de réservation]'));
  
  STEPS.forEach((step, index) => {
    const stepNumber = index + 1;
    let prefix = ' ';
    
    if (currentState.step === stepNumber) {
      prefix = '>';
      console.log(chalk.green.bold(`${prefix} ${stepNumber}. ${step.emoji} ${step.name} (étape actuelle)`));
    } else if (currentState.step > stepNumber) {
      prefix = '✓';
      console.log(chalk.dim(`${prefix} ${stepNumber}. ${step.emoji} ${step.name} (complété)`));
    } else {
      console.log(chalk.dim(`${prefix} ${stepNumber}. ${step.emoji} ${step.name}`));
    }
  });
  
  console.log(''); // Ligne vide pour une meilleure lisibilité
}

// Mise à jour de l'état basé sur la réponse
function updateState(botResponse) {
  // Détection de l'étape à partir de la réponse
  const lowerResponse = botResponse.toLowerCase();
  
  // Déterminer l'étape basée sur des mots clés
  if (lowerResponse.includes('plaque d\'immatriculation') || 
      lowerResponse.includes('véhicule') ||
      lowerResponse.includes('marque')) {
    currentState.step = 1;
  } else if (lowerResponse.includes('services disponibles') || 
           lowerResponse.includes('quel service')) {
    currentState.step = 2;
  } else if (lowerResponse.includes('garages disponibles') || 
           lowerResponse.includes('quel garage')) {
    currentState.step = 3;
  } else if (lowerResponse.includes('créneaux disponibles') || 
           lowerResponse.includes('horaire') ||
           lowerResponse.includes('date')) {
    currentState.step = 4;
  } else if (lowerResponse.includes('confirmer') || 
           lowerResponse.includes('récapitulatif') ||
           lowerResponse.includes('réservation confirmée')) {
    currentState.step = 5;
  }
}

// Fonction pour traiter les messages
async function handleUserInput(input) {
  // Commandes spéciales
  if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
    console.log(chalk.yellow('\nMerci d\'avoir utilisé notre service. À bientôt!'));
    rl.close();
    process.exit(0);
  }
  
  if (input.toLowerCase() === 'clear') {
    console.clear();
    console.log(chalk.blue.bold('🔧 AUTO SERVICE PRO - CHATBOT CLI 🔧'));
    console.log(chalk.yellow('Conversation réinitialisée.\n'));
    currentState.step = 0;
    return askQuestion();
  }
  
  if (input.toLowerCase() === 'status') {
    showSteps();
    return askQuestion();
  }
  
  // Afficher un spinner pendant le traitement
  const spinner = ora('BOB réfléchit...').start();
  
  try {
    // Traiter le message via l'orchestrateur
    const response = await processMessage(input);
    
    spinner.stop();
    
    if (response.success) {
      // Afficher la réponse du chatbot
      console.log(chalk.green('\n🤖 BOB: ') + response.botResponse + '\n');
      
      // Mettre à jour l'état en fonction de la réponse
      if (response.processState && response.processState.currentStep > 0) {
        currentState.step = response.processState.currentStep;
      } else {
        updateState(response.botResponse);
      }
    } else {
      // Afficher l'erreur
      console.log(chalk.red('\n⚠️ Erreur: ') + (response.error || 'Une erreur inconnue est survenue') + '\n');
    }
  } catch (error) {
    spinner.stop();
    console.log(chalk.red('\n⚠️ Erreur système: ') + error.message + '\n');
  }
  
  // Continuer la conversation
  askQuestion();
}

// Fonction pour demander l'entrée utilisateur
function askQuestion() {
  // Afficher la progression actuelle si nous sommes dans une étape
  if (currentState.step > 0) {
    const stepIndicator = chalk.cyan(`[Étape ${currentState.step}/${STEPS.length}: ${STEPS[currentState.step-1].name}] `);
    rl.question(stepIndicator + chalk.blue('👤 Vous: '), (input) => {
      handleUserInput(input);
    });
  } else {
    rl.question(chalk.blue('👤 Vous: '), (input) => {
      handleUserInput(input);
    });
  }
}

// Gestion des erreurs non traitées
process.on('uncaughtException', (err) => {
  console.log(chalk.red('\n⚠️ Erreur critique: ') + err.message + '\n');
  console.log(chalk.gray('Trace: ' + err.stack));
  process.exit(1);
});

// Démarrer la conversation
console.log(chalk.green('🤖 BOB: ') + 'Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Comment puis-je vous aider avec votre véhicule aujourd\'hui ?\n');
askQuestion(); 