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
        // Ne pas mettre à jour si on est déjà à cette étape ou si elle est invalide
        if (step < 1 || step > 5 || step === this.currentStep) return;
        
        // Mettre à jour les classes d'étape avec animation
        document.querySelectorAll('.step').forEach((el, index) => {
            el.classList.remove('active');
            
            if (index + 1 < step) {
                if (!el.classList.contains('completed')) {
                    el.classList.add('completed');
                    el.style.animation = 'fadeIn 0.5s';
                    setTimeout(() => { el.style.animation = ''; }, 500);
                }
            } else if (index + 1 === step) {
                el.classList.add('active');
                el.style.animation = 'fadeIn 0.5s, pulseStep 2s infinite';
                setTimeout(() => { el.style.animation = 'pulseStep 2s infinite'; }, 500);
            } else {
                el.classList.remove('completed');
            }
        });
        
        // Mettre à jour la barre de progression avec animation
        const progressEl = document.querySelector('.step-progress');
        const progressWidth = ((step - 1) / 4) * 100;
        progressEl.style.width = progressWidth + '%';
        
        // Mettre à jour l'étape courante
        this.currentStep = step;
        
        // Ajouter un message d'action système pour le changement d'étape
        if (step > 1) {
            const stepNames = [
                "Identification du véhicule", 
                "Sélection du service",
                "Choix du garage",
                "Sélection du créneau",
                "Confirmation de la réservation"
            ];
            
            this.addSystemActionMessage(`Étape ${step}: ${stepNames[step-1]}`);
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
    addMessage(message, isUser = false, isLoading = false, isThinking = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(isUser ? 'user-message' : 'bot-message');
        
        if (isLoading) {
            messageElement.classList.add('loading-message');
            messageElement.innerHTML = `${message} <div class="typing-dots"><span></span><span></span><span></span></div>`;
            this.showApiStatus("Consultation des données...", 'info');
        } else if (isThinking) {
            messageElement.classList.add('thinking');
            messageElement.innerHTML = `${message} <div class="typing-dots"><span></span><span></span><span></span></div>`;
            this.showApiStatus("BOB réfléchit...", 'info');
        } else {
            messageElement.textContent = message;
        }
        
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return messageElement;
    }

    /**
     * Affiche une notification de statut API
     */
    showApiStatus(message, type = 'info', duration = 3000) {
        const apiStatus = document.getElementById('api-status');
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
     * Détermine l'étape à partir de la réponse
     */
    determineStepFromResponse(botResponse, processState) {
        // Vérifier d'abord si nous avons obtenu une étape du backend
        if (processState && processState.currentStep > 0) {
            return processState.currentStep;
        }
        
        const lowerResponse = botResponse.toLowerCase();
        
        // Vérifier les indicateurs d'étape dans la réponse
        if (lowerResponse.includes('plaque d\'immatriculation') || 
            lowerResponse.includes('véhicule') ||
            lowerResponse.includes('marque') ||
            lowerResponse.includes('modèle')) {
            return 1; // Identification du véhicule
        } else if (lowerResponse.includes('services disponibles') || 
                 lowerResponse.includes('quel service') ||
                 lowerResponse.includes('prestations')) {
            return 2; // Sélection du service  
        } else if (lowerResponse.includes('garages disponibles') || 
                 lowerResponse.includes('quel garage') ||
                 lowerResponse.includes('établissement')) {
            return 3; // Sélection du garage
        } else if (lowerResponse.includes('créneaux disponibles') || 
                 lowerResponse.includes('horaire') ||
                 lowerResponse.includes('date') ||
                 lowerResponse.includes('rendez-vous')) {
            return 4; // Sélection du créneau
        } else if (lowerResponse.includes('confirmer') || 
                 lowerResponse.includes('récapitulatif') ||
                 lowerResponse.includes('résumé') ||
                 lowerResponse.includes('réservation confirmée')) {
            return 5; // Confirmation
        }
        
        // Par défaut: ne pas changer d'étape si nous ne pouvons pas déterminer
        return this.currentStep;
    }

    /**
     * Met à jour les réponses rapides en utilisant uniquement les données réelles de l'API
     */
    updateQuickReplies(botResponse, processState) {
        this.quickRepliesContainer.innerHTML = '';
        
        // Obtenir l'étape actuelle
        const step = this.determineStepFromResponse(botResponse, processState);
        this.updateStepIndicator(step);
        
        // Récupérer les suggestions basées uniquement sur les données de l'API
        const suggestions = [];
        
        if (!chatbot || !chatbot.cachedData) {
            console.error('Les données du chatbot ne sont pas disponibles');
            return;
        }
        
        switch(step) {
            case 1: // Étape identification véhicule
                // Pour les plaques, on affiche uniquement quelques formats d'exemple
                suggestions.push('AA-123-BB');
                break;
                
            case 2: // Étape sélection service
                if (chatbot.cachedData.services && chatbot.cachedData.services.length > 0) {
                    // Afficher les services réels de l'API
                    chatbot.cachedData.services.slice(0, 5).forEach(service => {
                        suggestions.push(service.name);
                    });
                } else {
                    console.warn('Aucun service disponible dans l\'API');
                    suggestions.push('Aucun service disponible');
                }
                break;
                
            case 3: // Étape sélection garage
                if (chatbot.cachedData.garages && chatbot.cachedData.garages.length > 0) {
                    // Afficher les garages réels de l'API
                    chatbot.cachedData.garages.slice(0, 5).forEach(garage => {
                        suggestions.push(garage.name);
                    });
                } else {
                    console.warn('Aucun garage disponible dans l\'API');
                    suggestions.push('Aucun garage disponible');
                }
                break;
                
            case 4: // Étape sélection créneau
                if (chatbot.cachedData.timeSlots && chatbot.cachedData.timeSlots.length > 0) {
                    // Afficher les créneaux réels de l'API
                    chatbot.cachedData.timeSlots.slice(0, 5).forEach(slot => {
                        suggestions.push(slot.dateTime);
                    });
                } else {
                    console.warn('Aucun créneau disponible dans l\'API');
                    suggestions.push('Aucun créneau disponible');
                }
                break;
                
            case 5: // Étape confirmation
                suggestions.push('Oui, je confirme');
                suggestions.push('Non, je veux modifier');
                break;
                
            default:
                suggestions.push('Comment puis-je vous aider?');
        }
        
        // Créer les boutons de suggestions
        for (const suggestion of suggestions) {
            if (!suggestion) continue; // Ignorer les suggestions vides
            
            const quickReply = document.createElement('div');
            quickReply.classList.add('quick-reply');
            quickReply.textContent = suggestion;
            quickReply.addEventListener('click', () => {
                this.sendMessage(suggestion);
            });
            this.quickRepliesContainer.appendChild(quickReply);
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
        
        // Afficher le message de l'utilisateur
        this.addMessage(message, true);
        this.userInput.value = '';
        
        // Afficher l'indicateur de réflexion
        const thinkingMsg = this.addMessage("BOB réfléchit...", false, false, true);
        
        try {
            // Envoyer la requête au chatbot
            const data = await chatbot.processMessage(message);
            
            // Supprimer l'indicateur de réflexion
            if (thinkingMsg && thinkingMsg.parentNode) {
                thinkingMsg.parentNode.removeChild(thinkingMsg);
            }
            
            // Réactiver le bouton d'envoi
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Envoyer';
            
            if (data.success && data.botResponse) {
                let loadingMessage = null;
                
                // Vérifier les appels API dans la réponse
                if (data.botResponse.includes("Je vérifie") || 
                    data.botResponse.includes("Je consulte") ||
                    data.botResponse.includes("Je recherche")) {
                    
                    this.addSystemActionMessage("BOB consulte notre système d'information...");
                    this.showApiStatus("Vérification des données...", 'info', 2500);
                }
                
                // Gérer l'état de chargement pour le traitement en arrière-plan
                if (data.isLoading || (data.processState && data.processState.isProcessing)) {
                    loadingMessage = this.addMessage("Je consulte nos systèmes pour vous apporter les informations les plus précises...", false, true);
                    this.showApiStatus("Recherche en cours...", 'info', 5000);
                    
                    // Faire une requête de suivi après un délai
                    setTimeout(async () => {
                        try {
                            const followupData = await chatbot.processMessage("continuation");
                            
                            // Supprimer le message de chargement
                            if (loadingMessage && loadingMessage.parentNode) {
                                loadingMessage.parentNode.removeChild(loadingMessage);
                            }
                            
                            if (followupData.success && followupData.botResponse) {
                                // Afficher le statut de l'API
                                this.showApiStatus("Données récupérées", 'success', 2000);
                                
                                // Ajouter la réponse du bot avec une légère animation
                                setTimeout(() => {
                                    // Ajouter la réponse du bot
                                    this.addMessage(followupData.botResponse);
                                    // Mettre à jour les réponses rapides
                                    this.updateQuickReplies(followupData.botResponse, followupData.processState);
                                }, 500);
                            }
                        } catch (error) {
                            console.error('Erreur dans la requête de suivi:', error);
                            if (loadingMessage && loadingMessage.parentNode) {
                                loadingMessage.parentNode.removeChild(loadingMessage);
                            }
                            this.showApiStatus("Erreur de connexion", 'error', 3000);
                            this.addMessage('Désolé, une erreur est survenue lors de la récupération des données.');
                        }
                    }, 1500);
                } else {
                    // Réponse normale
                    this.addMessage(data.botResponse);
                    // Mettre à jour les réponses rapides en fonction de la réponse et de l'état du processus
                    this.updateQuickReplies(data.botResponse, data.processState);
                }
            } else {
                this.showApiStatus("Erreur", 'error', 3000);
                this.addMessage('Désolé, une erreur est survenue. Veuillez réessayer.');
            }
        } catch (error) {
            console.error('Erreur:', error);
            // Supprimer l'indicateur de réflexion
            if (thinkingMsg && thinkingMsg.parentNode) {
                thinkingMsg.parentNode.removeChild(thinkingMsg);
            }
            
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