/**
 * Classe principale du chatbot côté client
 * Gère la communication avec le serveur et l'état de la conversation
 */
class Chatbot {
    constructor() {
        // ID de session unique
        this.sessionId = 'session_' + Date.now();
        
        // État de la conversation (synchronisé avec le backend)
        this.conversationState = {
            currentStep: 1
        };

        // Informations en cache pour l'UI
        this.cachedData = {
            services: null,
            garages: null,
            timeSlots: null
        };
    }

    /**
     * Initialise le chatbot
     */
    async initialize() {
        try {
            // Initialiser le service API
            const apiInitialized = await apiService.initialize();
            
            if (!apiInitialized) {
                console.error('Échec de l\'initialisation de l\'API');
                return false;
            }
            
            // Précharger les données de l'API pour les suggestions UI
            await this.preloadApiData();
            
            // Initialiser le contrôleur UI
            uiController.initialize();
            
            // Premier message du chatbot
            await this.sendInitialMessage();
            
            console.log('Chatbot initialisé avec succès');
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du chatbot:', error);
            return false;
        }
    }

    /**
     * Précharge les données de l'API pour les suggestions UI
     */
    async preloadApiData() {
        try {
            // Préchargement des services
            try {
                const operationsData = await apiService.getAllOperations();
                if (operationsData && operationsData.length > 0) {
                    this.cachedData.services = operationsData;
                    console.log(`${operationsData.length} services préchargés`);
                }
            } catch (servicesError) {
                console.warn('Impossible de précharger les services:', servicesError);
            }
            
            // Préchargement des garages
            try {
                const garagesData = await apiService.getGarages();
                if (garagesData && garagesData.garages && garagesData.garages.length > 0) {
                    this.cachedData.garages = garagesData.garages;
                    console.log(`${garagesData.garages.length} garages préchargés`);
                }
            } catch (garagesError) {
                console.warn('Impossible de précharger les garages:', garagesError);
            }
            
            // Préchargement des créneaux (première page)
            try {
                const availabilitiesData = await apiService.getAvailabilities(1);
                if (availabilitiesData && availabilitiesData.availabilities) {
                    const slots = [];
                    
                    availabilitiesData.availabilities.forEach(day => {
                        day.slots.forEach(time => {
                            slots.push({
                                date: day.date,
                                time: time,
                                dateTime: `${day.date} à ${time}`
                            });
                        });
                    });
                    
                    this.cachedData.timeSlots = slots;
                    console.log(`${slots.length} créneaux préchargés`);
                }
            } catch (timeslotsError) {
                console.warn('Impossible de précharger les créneaux:', timeslotsError);
            }
            
            return true;
        } catch (error) {
            console.error('Erreur lors du préchargement des données:', error);
            return false;
        }
    }

    /**
     * Envoie le message initial pour démarrer la conversation
     */
    async sendInitialMessage() {
        try {
            // Afficher directement un message de bienvenue
            uiController.addMessage("Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Veuillez me communiquer votre plaque d'immatriculation au format AA-123-AA.", 'bot');
            
            // Mettre à jour l'UI avec des suggestions adaptées pour la première étape
            const quickReplies = [
                { text: "AB-123-CD", action: "send" },
                { text: "Bonjour", action: "send" }
            ];
            
            uiController.updateQuickReplies(quickReplies);
            uiController.updateStepIndicator(1);
            
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message initial:', error);
            uiController.addMessage("Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Veuillez me communiquer votre plaque d'immatriculation au format AA-123-AA.", 'bot');
            return false;
        }
    }

    /**
     * Traite un message utilisateur
     * @param {string} message - Message de l'utilisateur
     * @returns {Object} Réponse du serveur
     */
    async processMessage(message) {
        try {
            // Afficher l'indicateur de chargement
            uiController.showLoadingIndicator(true);
            
            // Envoi du message au backend
            const response = await apiService.sendMessage(message, this.sessionId);
            
            // Masquer l'indicateur de chargement
            uiController.showLoadingIndicator(false);
            
            // Vérifier si la réponse est valide
            if (response && response.success) {
                // Mettre à jour l'état de la conversation
                if (response.processState) {
                    this.conversationState = {
                        ...this.conversationState,
                        ...response.processState
                    };
                    
                    // Mettre à jour l'étape dans l'UI
                    if (response.processState.currentStep) {
                        uiController.updateStepIndicator(response.processState.currentStep);
                    }
                }
                
                // Générer des suggestions adaptées à l'étape actuelle
                this.generateSuggestions();
                
                return response;
            } else {
                console.error('Réponse non valide du backend:', response);
                return {
                    success: false,
                    botResponse: "Je rencontre des difficultés techniques. Pourriez-vous reformuler votre demande?"
                };
            }
        } catch (error) {
            console.error('Erreur lors du traitement du message:', error);
            uiController.showLoadingIndicator(false);
            
            return {
                success: false,
                botResponse: "Une erreur est survenue. Veuillez réessayer dans quelques instants."
            };
        }
    }
    
    /**
     * Génère des suggestions adaptées à l'étape actuelle
     */
    generateSuggestions() {
        let quickReplies = [];
        const currentStep = this.conversationState.currentStep || 1;
        
        switch (currentStep) {
            case 1: // Identification du véhicule
                quickReplies = [
                    { text: "AB-123-CD", action: "send" },
                    { text: "Qu'est-ce que je dois faire?", action: "send" }
                ];
                break;
                
            case 2: // Sélection du service
                if (this.cachedData.services && this.cachedData.services.length > 0) {
                    // Limiter à 3 services
                    quickReplies = this.cachedData.services.slice(0, 3).map(service => ({
                        text: service.name,
                        action: "send"
                    }));
                } else {
                    quickReplies = [
                        { text: "Vidange", action: "send" },
                        { text: "Changement de pneus", action: "send" }
                    ];
                }
                break;
                
            case 3: // Sélection du garage
                if (this.cachedData.garages && this.cachedData.garages.length > 0) {
                    // Limiter à 3 garages
                    quickReplies = this.cachedData.garages.slice(0, 3).map(garage => ({
                        text: garage.name,
                        action: "send"
                    }));
                } else {
                    quickReplies = [
                        { text: "Paris", action: "send" },
                        { text: "Lyon", action: "send" }
                    ];
                }
                break;
                
            case 4: // Sélection du créneau
                if (this.cachedData.timeSlots && this.cachedData.timeSlots.length > 0) {
                    // Limiter à 3 créneaux
                    quickReplies = this.cachedData.timeSlots.slice(0, 3).map(slot => ({
                        text: `${slot.date} à ${slot.time}`,
                        action: "send"
                    }));
                } else {
                    quickReplies = [
                        { text: "Demain matin", action: "send" },
                        { text: "Vendredi 14h", action: "send" }
                    ];
                }
                break;
                
            case 5: // Confirmation
                quickReplies = [
                    { text: "Oui, je confirme", action: "send" },
                    { text: "Non, je souhaite modifier", action: "send" }
                ];
                break;
                
            default:
                quickReplies = [
                    { text: "Nouvelle réservation", action: "send" }
                ];
        }
        
        // Mettre à jour les quick replies dans l'UI
        uiController.updateQuickReplies(quickReplies);
    }

    /**
     * Réinitialise la conversation
     */
    async resetConversation() {
        try {
            // Réinitialiser la conversation côté backend
            const response = await apiService.resetConversation(this.sessionId);
            
            // Réinitialiser l'état local
            this.conversationState = {
                currentStep: 1
            };
            
            // Effacer les messages dans l'UI
            document.getElementById('chat-messages').innerHTML = '';
            
            // Afficher le message de bienvenue
            if (response && response.success && response.botResponse) {
                uiController.addMessage(response.botResponse, 'bot');
            } else {
                await this.sendInitialMessage();
            }
            
            // Réinitialiser l'indicateur d'étape
            uiController.updateStepIndicator(1);
            
            // Générer des suggestions pour l'étape 1
            this.generateSuggestions();
            
            return true;
        } catch (error) {
            console.error('Erreur lors de la réinitialisation de la conversation:', error);
            return false;
        }
    }
}

// Création de l'instance du chatbot
const chatbot = new Chatbot();

// Initialisation du chatbot au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    await chatbot.initialize();
    
    // Ajouter l'écouteur d'événement pour le bouton de réinitialisation
    document.querySelector('.reset-button').addEventListener('click', async () => {
        await chatbot.resetConversation();
        uiController.showApiStatus("Conversation réinitialisée", 'success', 2000);
    });
}); 