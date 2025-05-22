#!/usr/bin/env node

const readline = require('readline');
const chalk = require('chalk');
const ora = require('ora');
const dotenv = require('dotenv');
const { processMessage, resetConversation } = require('./orchestrator');

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
  step: 1
};

// Affichage du titre et des instructions
console.log(chalk.blue.bold('\n🔧 AUTO SERVICE PRO - CHATBOT CLI 🔧'));
console.log(chalk.gray('------------------------------------'));
console.log(chalk.yellow(`👋 Bienvenue dans l'interface CLI de BOB - L'assistant de réservation automobile`));
console.log(chalk.gray('- Tapez votre message et appuyez sur Entrée'));
console.log(chalk.gray('- Tapez "exit" ou "quit" pour quitter'));
console.log(chalk.gray('- Tapez "clear" ou "reset" pour réinitialiser la conversation'));
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

// Fonction pour traiter les messages
async function handleUserInput(input) {
  // Commandes spéciales
  if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
    console.log(chalk.yellow('\nMerci d\'avoir utilisé notre service. À bientôt!'));
    rl.close();
    process.exit(0);
  }
  
  if (input.toLowerCase() === 'clear' || input.toLowerCase() === 'reset') {
    console.clear();
    console.log(chalk.blue.bold('🔧 AUTO SERVICE PRO - CHATBOT CLI 🔧'));
    
    // Réinitialiser la conversation via l'orchestrateur
    const spinner = ora('Réinitialisation...').start();
    try {
      const resetResponse = await resetConversation();
      spinner.stop();
      
      if (resetResponse.success) {
        console.log(chalk.yellow('Conversation réinitialisée.\n'));
        console.log(chalk.green('🤖 BOB: ') + resetResponse.botResponse + '\n');
        currentState.step = resetResponse.processState?.currentStep || 1;
      } else {
        console.log(chalk.red('\n⚠️ Erreur: ') + (resetResponse.error || 'Erreur lors de la réinitialisation') + '\n');
      }
    } catch (error) {
      spinner.stop();
      console.log(chalk.red('\n⚠️ Erreur système: ') + error.message + '\n');
    }
    
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
      if (response.processState && response.processState.currentStep) {
        currentState.step = response.processState.currentStep;
      }
    } else {
      // Afficher l'erreur
      console.log(chalk.red('\n⚠️ Erreur: ') + (response.error || response.botResponse || 'Une erreur inconnue est survenue') + '\n');
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
  if (currentState.step > 0 && currentState.step <= STEPS.length) {
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
(async () => {
  // Initialiser la conversation
  const spinner = ora('Initialisation...').start();
  try {
    const initResponse = await resetConversation();
    spinner.stop();
    
    if (initResponse.success) {
      console.log(chalk.green('🤖 BOB: ') + initResponse.botResponse + '\n');
      currentState.step = initResponse.processState?.currentStep || 1;
    } else {
      console.log(chalk.green('🤖 BOB: ') + 'Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Comment puis-je vous aider avec votre véhicule aujourd\'hui ?\n');
    }
  } catch (error) {
    spinner.stop();
    console.log(chalk.green('🤖 BOB: ') + 'Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Comment puis-je vous aider avec votre véhicule aujourd\'hui ?\n');
  }
  
  askQuestion();
})(); 