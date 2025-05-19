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

// Affichage du titre et des instructions
console.log(chalk.blue.bold('\n🔧 AUTO SERVICE PRO - CHATBOT CLI 🔧'));
console.log(chalk.gray('------------------------------------'));
console.log(chalk.yellow('👋 Bienvenue dans l\'interface CLI du chatbot de garage'));
console.log(chalk.gray('- Tapez votre message et appuyez sur Entrée'));
console.log(chalk.gray('- Tapez "exit" ou "quit" pour quitter'));
console.log(chalk.gray('- Tapez "clear" pour effacer l\'historique de conversation'));
console.log(chalk.gray('------------------------------------\n'));

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
    return askQuestion();
  }
  
  // Afficher un spinner pendant le traitement
  const spinner = ora('Le chatbot réfléchit...').start();
  
  try {
    // Traiter le message via l'orchestrateur
    const response = await processMessage(input);
    
    spinner.stop();
    
    if (response.success) {
      // Afficher la réponse du chatbot
      console.log(chalk.green('\n🤖 Chatbot: ') + response.botResponse + '\n');
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
  rl.question(chalk.blue('👤 Vous: '), (input) => {
    handleUserInput(input);
  });
}

// Gestion des erreurs non traitées
process.on('uncaughtException', (err) => {
  console.log(chalk.red('\n⚠️ Erreur critique: ') + err.message + '\n');
  console.log(chalk.gray('Trace: ' + err.stack));
  process.exit(1);
});

// Démarrer la conversation
askQuestion(); 