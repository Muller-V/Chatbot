class UIController {
    constructor() {
        // Éléments DOM
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.quickRepliesContainer = document.getElementById('quick-replies');
        this.resetButton = document.querySelector('.reset-button');
        
        // État courant
        this.currentStep = 1;
        this.loadingMessage = null;
        
        // Fallback messages si l'API ne retourne pas de données
        this.fallbackMessages = {
            vehicleNotFound: "Je n'ai pas trouvé ce véhicule. Veuillez réessayer avec une plaque d'immatriculation valide (format AA-123-BB).",
            noServices: "Désolé, je n'ai pas pu récupérer la liste des services. Veuillez réessayer plus tard.",
            noGarages: "Désolé, je n'ai pas pu récupérer la liste des garages. Veuillez réessayer plus tard.",
            noTimeSlots: "Désolé, je n'ai pas pu récupérer les créneaux disponibles. Veuillez réessayer plus tard."
        };
    }

    /**
     * Initialise le contrôleur d'interface
     */
    initialize() {
        // Configuration des écouteurs d'événements
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Focus sur le champ de saisie
        this.userInput.focus();
        
        // Initialiser l'indicateur d'étape
        this.updateStepIndicator(1);
        
        console.log('Contrôleur d\'interface initialisé');
    }

    /**
     * Met à jour l'indicateur d'étape
     */
    updateStepIndicator(step) {
        // Valider l'entrée
        const numStep = parseInt(step);
        if (isNaN(numStep) || numStep < 1 || numStep > 9 || numStep === this.currentStep) return;
        
        // Mettre à jour les classes d'étape avec animation
        document.querySelectorAll('.step').forEach((el, index) => {
            el.classList.remove('active');
            
            if (index + 1 < numStep) {
                if (!el.classList.contains('completed')) {
                    el.classList.add('completed');
                    el.style.animation = 'fadeIn 0.5s';
                    setTimeout(() => { el.style.animation = ''; }, 500);
                }
            } else if (index + 1 === numStep) {
                el.classList.add('active');
                el.style.animation = 'fadeIn 0.5s, pulseStep 2s infinite';
                setTimeout(() => { el.style.animation = 'pulseStep 2s infinite'; }, 500);
            } else {
                el.classList.remove('completed');
            }
        });
        
        // Mettre à jour la barre de progression avec animation (9 étapes au lieu de 5)
        const progressEl = document.querySelector('.step-progress');
        const progressWidth = ((numStep - 1) / 8) * 100; // 8 intervalles pour 9 étapes
        progressEl.style.width = progressWidth + '%';
        
        // Mettre à jour l'étape courante
        this.currentStep = numStep;
        
        // Ajouter un message d'action système pour le changement d'étape
        if (numStep > 1) {
            const stepNames = [
                "Accueil", 
                "Plaque d'immatriculation",
                "Validation véhicule",
                "Choix du service",
                "Validation service",
                "Choix du garage",
                "Validation garage",
                "Sélection du créneau",
                "Confirmation finale"
            ];
            
            this.addSystemActionMessage(`Étape ${numStep}: ${stepNames[numStep-1]}`);
        }
    }

    /**
     * Ajoute un message d'action système
     */
    addSystemActionMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('system-action');
        messageElement.textContent = message;
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * Ajoute un message à la conversation
     */
    addMessage(message, sender = 'bot', isLoading = false) {
        const isUser = sender === 'user';
        
        // S'assurer que le message est une chaîne de caractères
        let messageText = message;
        if (typeof message !== 'string') {
            if (message && message.botResponse) {
                messageText = message.botResponse;
            } else {
                try {
                    messageText = JSON.stringify(message);
                } catch (e) {
                    messageText = "Message non affichable";
                }
            }
        }
        
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(isUser ? 'user-message' : 'bot-message');
        
        if (isLoading) {
            messageElement.classList.add('loading-message');
            messageElement.innerHTML = `${messageText} <div class="typing-dots"><span></span><span></span><span></span></div>`;
            this.showApiStatus("Consultation des données...", 'info');
        } else {
            messageElement.textContent = messageText;
        }
        
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return messageElement;
    }

    /**
     * Affiche/masque l'indicateur de chargement
     * @param {boolean} show - Indique si l'indicateur doit être affiché ou masqué
     */
    showLoadingIndicator(show) {
        if (show) {
            // Supprimer l'ancien indicateur de chargement s'il existe
            this.hideLoadingIndicator();
            
            // Créer un nouvel indicateur
            this.showApiStatus("BOB réfléchit...", 'info');
            this.loadingMessage = document.createElement('div');
            this.loadingMessage.classList.add('message', 'bot-message', 'thinking');
            this.loadingMessage.innerHTML = `BOB réfléchit... <div class="typing-dots"><span></span><span></span><span></span></div>`;
            this.chatMessages.appendChild(this.loadingMessage);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        } else {
            this.hideLoadingIndicator();
        }
    }
    
    /**
     * Cache l'indicateur de chargement
     */
    hideLoadingIndicator() {
        // Supprimer l'indicateur de chargement s'il existe
        if (this.loadingMessage && this.loadingMessage.parentNode) {
            this.loadingMessage.parentNode.removeChild(this.loadingMessage);
        }
        this.loadingMessage = null;
        
        // Supprimer tous les messages de type "thinking"
        const thinkingMessages = document.querySelectorAll('.message.thinking');
        thinkingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
    }

    /**
     * Affiche une notification de statut API
     */
    showApiStatus(message, type = 'info', duration = 3000) {
        const apiStatus = document.getElementById('api-status');
        if (!apiStatus) return;
        
        apiStatus.textContent = message;
        
        // Réinitialiser les classes précédentes
        apiStatus.classList.remove('visible', 'status-info', 'status-warning', 'status-error', 'status-success');
        
        // Ajouter la classe appropriée en fonction du type
        apiStatus.classList.add('visible');
        apiStatus.classList.add(`status-${type}`);
        
        // Style en fonction du type
        switch(type) {
            case 'warning':
                apiStatus.style.backgroundColor = 'rgba(243, 156, 18, 0.2)';
                apiStatus.style.color = '#f39c12';
                break;
            case 'error':
                apiStatus.style.backgroundColor = 'rgba(231, 76, 60, 0.2)';
                apiStatus.style.color = '#e74c3c';
                break;
            case 'success':
                apiStatus.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                apiStatus.style.color = '#2ecc71';
                break;
            default: // info
                apiStatus.style.backgroundColor = 'rgba(52, 152, 219, 0.2)';
                apiStatus.style.color = '#3498db';
        }
        
        setTimeout(() => {
            apiStatus.classList.remove('visible');
        }, duration);
    }

    /**
     * Met à jour les réponses rapides
     */
    updateQuickReplies(quickReplies) {
        // Nettoyer le conteneur
        this.quickRepliesContainer.innerHTML = '';
        
        // Si aucune réponse rapide, sortir
        if (!quickReplies || quickReplies.length === 0) return;
        
        // Si quickReplies n'est pas un tableau, le transformer
        if (!Array.isArray(quickReplies)) {
            if (typeof quickReplies === 'string') {
                // C'est une chaîne unique, créer un tableau avec cette valeur
                quickReplies = [{ text: quickReplies, action: 'send' }];
            } else if (typeof quickReplies === 'object') {
                // C'est un objet, vérifier s'il contient des quick replies
                if (quickReplies.quickReplies && Array.isArray(quickReplies.quickReplies)) {
                    quickReplies = quickReplies.quickReplies;
                } else {
                    // Utiliser l'étape courante pour générer des quick replies par défaut
                    quickReplies = this.getDefaultQuickReplies(this.currentStep);
                }
            } else {
                // Utiliser les quick replies par défaut
                quickReplies = this.getDefaultQuickReplies(this.currentStep);
            }
        }
        
        // Créer les boutons de suggestions
        for (const quickReply of quickReplies) {
            if (!quickReply || !quickReply.text) continue;
            
            const quickReplyElement = document.createElement('div');
            quickReplyElement.classList.add('quick-reply');
            quickReplyElement.textContent = quickReply.text;
            quickReplyElement.addEventListener('click', () => {
                this.sendMessage(quickReply.text);
            });
            this.quickRepliesContainer.appendChild(quickReplyElement);
        }
    }
    
    /**
     * Retourne des quick replies par défaut selon l'étape
     */
    getDefaultQuickReplies(step) {
        switch(parseInt(step)) {
            case 1: // Identification véhicule
                return [
                    { text: 'AB-123-CD', action: 'send' },
                    { text: 'Que dois-je faire?', action: 'send' }
                ];
            case 2: // Service
                return [
                    { text: 'Vidange', action: 'send' },
                    { text: 'Changement de pneus', action: 'send' }
                ];
            case 3: // Garage
                return [
                    { text: 'Paris', action: 'send' },
                    { text: 'Lyon', action: 'send' }
                ];
            case 4: // Créneau
                return [
                    { text: 'Demain matin', action: 'send' },
                    { text: 'Mardi 14h', action: 'send' }
                ];
            case 5: // Confirmation
                return [
                    { text: 'Oui, je confirme', action: 'send' },
                    { text: 'Non, je souhaite modifier', action: 'send' }
                ];
            default:
                return [];
        }
    }

    /**
     * Envoie un message
     */
    async sendMessage(messageText = null) {
        const message = messageText || this.userInput.value.trim();
        
        if (!message) return;
        
        // Désactiver le bouton d'envoi pendant le traitement
        this.sendButton.disabled = true;
        this.sendButton.textContent = '...';
        
        // Effacer le champ de saisie
        this.userInput.value = '';
        
        // Afficher le message de l'utilisateur
        this.addMessage(message, 'user');
        
        try {
            // Afficher l'indicateur de chargement
            this.showLoadingIndicator(true);
            
            // Envoyer la requête au chatbot
            const data = await chatbot.processMessage(message);
            
            // Cacher l'indicateur de chargement
            this.hideLoadingIndicator();
            
            // Réactiver le bouton d'envoi
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Envoyer';
            
            if (data && data.success && data.botResponse) {
                // Afficher la réponse du bot
                this.addMessage(data.botResponse, 'bot');
                
                // Mettre à jour les réponses rapides et l'étape si nécessaire
                if (data.processState && data.processState.currentStep) {
                    this.updateStepIndicator(data.processState.currentStep);
                }
                
                // Mettre à jour les quick replies
                if (data.quickReplies) {
                    this.updateQuickReplies(data.quickReplies);
                } else {
                    // Utiliser les quick replies par défaut
                    this.updateQuickReplies(this.getDefaultQuickReplies(this.currentStep));
                }
            } else {
                this.showApiStatus("Erreur de réponse", 'error', 3000);
                this.addMessage('Désolé, une erreur est survenue. Veuillez réessayer.');
            }
        } catch (error) {
            console.error('Erreur:', error);
            
            // Cacher l'indicateur de chargement
            this.hideLoadingIndicator();
            
            this.showApiStatus("Erreur de connexion", 'error', 3000);
            this.addMessage('Désolé, une erreur de connexion est survenue. Veuillez réessayer.');
            
            // Réactiver le bouton d'envoi
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Envoyer';
        }
    }
}

// Création de l'instance du contrôleur UI
const uiController = new UIController();
window.uiController = uiController; 