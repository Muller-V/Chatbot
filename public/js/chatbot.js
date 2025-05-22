class Chatbot {
    constructor() {
        // Génération d'une ID de session unique
        this.sessionId = 'session_' + Date.now();
        
        // État de la conversation
        this.conversationState = {
            currentStep: 1,
            vehiculeInfo: null,
            selectedService: null,
            selectedGarage: null,
            selectedTimeSlot: null,
            confirmed: false
        };

        // Informations en cache
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
            
            // Précharger les données de l'API pour éviter les délais pendant la conversation
            await this.preloadApiData();
            
            // Initialiser le contrôleur UI
            uiController.initialize();
            
            // Ajouter le message de bienvenue
            this.displayWelcomeMessage();
            
            console.log('Chatbot initialisé avec succès');
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du chatbot:', error);
            return false;
        }
    }

    /**
     * Précharge les données de l'API
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
                // Continuer même si cette API échoue
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
                // Continuer même si cette API échoue
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
                // Continuer même si cette API échoue
            }
            
            // Toujours retourner true pour ne pas bloquer l'initialisation
            return true;
        } catch (error) {
            console.error('Erreur lors du préchargement des données:', error);
            // Ne pas bloquer l'initialisation du chatbot
            return true;
        }
    }

    /**
     * Affiche le message de bienvenue
     */
    displayWelcomeMessage() {
        uiController.addMessage("Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Veuillez me communiquer votre plaque d'immatriculation au format AA-123-AA");
        
        uiController.updateQuickReplies("Bonjour ! Je suis BOB, votre assistant virtuel Auto Service Pro. Veuillez me communiquer votre plaque d'immatriculation au format AA-123-AA", { currentStep: 1 });
    }

    /**
     * Traite un message utilisateur
     */
    async processMessage(message) {
        try {
            // Traiter les messages spéciaux
            if (message === "continuation") {
                return await this.processContinuation();
            }
            
            // Extraire des informations du message utilisateur
            this.extractInformation(message);
            
            // Compléter les données avec les API si nécessaire
            await this.enrichWithApiData();
            
            // Essayer d'envoyer le message au chatbot backend
            try {
                const response = await apiService.sendMessage(message, this.sessionId);
                
                // Vérifier si la réponse contient un message d'erreur
                if (!response.success) {
                    console.warn('Réponse non valide du backend, utilisation du mode dégradé');
                    return this.generateLocalResponse(message);
                }
                
                // Mettre à jour l'état de la conversation basé sur la réponse
                this.updateConversationState(response);
                
                return response;
            } catch (apiError) {
                console.error('Erreur API, utilisation du mode dégradé:', apiError);
                return this.generateLocalResponse(message);
            }
        } catch (error) {
            console.error('Erreur lors du traitement du message:', error);
            return {
                success: false,
                botResponse: "Désolé, une erreur est survenue. Pouvez-vous reformuler votre demande ?",
                processState: { currentStep: this.conversationState.currentStep }
            };
        }
    }

    /**
     * Traite une continuation de conversation (après un appel API)
     */
    async processContinuation() {
        try {
            // Construire une réponse basée sur l'état actuel et les données en cache
            let response = {
                success: true,
                processState: { 
                    currentStep: this.conversationState.currentStep,
                    isProcessing: false
                }
            };
            
            // Générer une réponse adaptée à l'étape actuelle
            switch (this.conversationState.currentStep) {
                case 1:
                    // Si nous avons des informations sur le véhicule
                    if (this.conversationState.vehiculeInfo) {
                        response.botResponse = `J'ai trouvé votre véhicule : ${this.conversationState.vehiculeInfo.brand} ${this.conversationState.vehiculeInfo.model}. Quel type de service recherchez-vous pour votre véhicule ?`;
                        response.processState.currentStep = 2;
                    } else {
                        response.botResponse = "Je n'ai pas pu trouver votre véhicule. Pouvez-vous me donner votre plaque d'immatriculation au format AA-123-AA ?";
                    }
                    break;
                    
                case 2:
                    // Si nous avons des services en cache
                    if (this.cachedData.services) {
                        let serviceMessage = "Voici les services disponibles :\n";
                        
                        // Limiter à 5 services pour lisibilité
                        const services = this.cachedData.services.slice(0, 5);
                        
                        services.forEach(service => {
                            serviceMessage += `- ${service.name} : ${service.price}\n`;
                        });
                        
                        serviceMessage += "\nQuel service vous intéresse ?";
                        response.botResponse = serviceMessage;
                    } else {
                        response.botResponse = "Nous proposons divers services comme la vidange, le changement de pneus, ou le contrôle technique. Quel service vous intéresse ?";
                    }
                    break;
                    
                case 3:
                    // Si nous avons des garages en cache
                    if (this.cachedData.garages && this.cachedData.garages.length > 0) {
                        let garageMessage = "Voici les garages disponibles :\n";
                        
                        // Limiter à 5 garages pour lisibilité
                        const garages = this.cachedData.garages.slice(0, 5);
                        
                        garages.forEach(garage => {
                            garageMessage += `- ${garage.name} : ${garage.address}\n`;
                        });
                        
                        garageMessage += "\nQuel garage préférez-vous ?";
                        response.botResponse = garageMessage;
                    } else {
                        response.botResponse = "Nous avons des garages à Paris, Lyon et Nice. Quel garage vous conviendrait le mieux ?";
                    }
                    break;
                    
                case 4:
                    // Si nous avons des créneaux en cache
                    if (this.cachedData.timeSlots && this.cachedData.timeSlots.length > 0) {
                        let slotsMessage = "Voici les créneaux disponibles :\n";
                        
                        this.cachedData.timeSlots.forEach(slot => {
                            slotsMessage += `- ${slot.date} à ${slot.time}\n`;
                        });
                        
                        slotsMessage += "\nQuel créneau vous conviendrait ?";
                        response.botResponse = slotsMessage;
                    } else {
                        response.botResponse = "Nous avons des créneaux disponibles la semaine prochaine. Préférez-vous un créneau en matinée ou en après-midi ?";
                    }
                    break;
                    
                case 5:
                    // Récapitulatif de la réservation
                    let summary = "Voici le récapitulatif de votre réservation :\n";
                    
                    if (this.conversationState.vehiculeInfo) {
                        summary += `- Véhicule : ${this.conversationState.vehiculeInfo.brand} ${this.conversationState.vehiculeInfo.model}\n`;
                    }
                    
                    if (this.conversationState.selectedService) {
                        summary += `- Service : ${this.conversationState.selectedService.name}\n`;
                    }
                    
                    if (this.conversationState.selectedGarage) {
                        summary += `- Garage : ${this.conversationState.selectedGarage.name}\n`;
                    }
                    
                    if (this.conversationState.selectedTimeSlot) {
                        summary += `- Créneau : ${this.conversationState.selectedTimeSlot}\n`;
                    }
                    
                    summary += "\nSouhaitez-vous confirmer cette réservation ?";
                    response.botResponse = summary;
                    break;
                    
                default:
                    response.botResponse = "Je suis à votre disposition pour vous aider. Que puis-je faire pour vous ?";
            }
            
            return response;
        } catch (error) {
            console.error('Erreur lors du traitement de la continuation:', error);
            return {
                success: false,
                botResponse: "Désolé, une erreur est survenue lors du traitement de votre demande.",
                processState: { currentStep: this.conversationState.currentStep }
            };
        }
    }

    /**
     * Extrait des informations du message utilisateur
     */
    extractInformation(message) {
        // Convertir en minuscules pour faciliter la détection
        const lowerMessage = message.toLowerCase();
        
        // Détecter les plaques d'immatriculation (format AA-123-AA)
        const plateRegex = /[A-Z]{2}-\d{3}-[A-Z]{2}/g;
        const plateMatches = message.match(plateRegex);
        
        if (plateMatches && plateMatches.length > 0) {
            this.conversationState.extractedPlate = plateMatches[0];
        }
        
        // Détecter les mentions de services
        if (lowerMessage.includes('vidange')) {
            this.conversationState.extractedService = 'vidange';
        } else if (lowerMessage.includes('pneu')) {
            this.conversationState.extractedService = 'pneus';
        } else if (lowerMessage.includes('contrôle technique') || lowerMessage.includes('controle technique')) {
            this.conversationState.extractedService = 'ct';
        } else if (lowerMessage.includes('frein')) {
            this.conversationState.extractedService = 'freins';
        } else if (lowerMessage.includes('climat')) {
            this.conversationState.extractedService = 'climatisation';
        }
        
        // Détecter les mentions de garages
        if (lowerMessage.includes('paris')) {
            this.conversationState.extractedGarage = 'Paris';
        } else if (lowerMessage.includes('lyon')) {
            this.conversationState.extractedGarage = 'Lyon';
        } else if (lowerMessage.includes('nice')) {
            this.conversationState.extractedGarage = 'Nice';
        }
        
        // Détecter la confirmation
        if (lowerMessage.includes('confirm') || lowerMessage === 'oui' || lowerMessage === 'oui, je confirme') {
            this.conversationState.confirmed = true;
        }
    }

    /**
     * Complète les données avec les informations des API
     */
    async enrichWithApiData() {
        try {
            // Si une plaque a été extraite, récupérer les informations du véhicule
            if (this.conversationState.extractedPlate && !this.conversationState.vehiculeInfo) {
                try {
                    const vehiculeData = await apiService.getVehiculeByImmatriculation(this.conversationState.extractedPlate);
                    if (vehiculeData && !vehiculeData.error) {
                        this.conversationState.vehiculeInfo = vehiculeData;
                        // Passage automatique à l'étape suivante si succès
                        if (this.conversationState.currentStep === 1) {
                            this.conversationState.currentStep = 2;
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération des informations du véhicule:', error);
                }
            }
            
            // Récupération des services depuis l'API (peut être nécessaire à différentes étapes)
            if (!this.cachedData.services) {
                try {
                    const operationsData = await apiService.getAllOperations();
                    if (operationsData && operationsData.length > 0) {
                        this.cachedData.services = operationsData;
                        
                        // Si un service a été extrait, trouver le service correspondant
                        if (this.conversationState.extractedService) {
                            const service = operationsData.find(s => 
                                s.name.toLowerCase().includes(this.conversationState.extractedService.toLowerCase())
                            );
                            
                            if (service) {
                                this.conversationState.selectedService = service;
                                // Passage automatique à l'étape suivante si succès et étape courante = 2
                                if (this.conversationState.currentStep === 2) {
                                    this.conversationState.currentStep = 3;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération des services:', error);
                }
            }
            
            // Récupération des garages si nécessaire
            if (!this.cachedData.garages) {
                try {
                    const garagesData = await apiService.getGarages();
                    if (garagesData && garagesData.garages && garagesData.garages.length > 0) {
                        this.cachedData.garages = garagesData.garages;
                        
                        // Si un garage a été extrait, trouver le garage correspondant
                        if (this.conversationState.extractedGarage) {
                            const garage = garagesData.garages.find(g => 
                                g.name.toLowerCase().includes(this.conversationState.extractedGarage.toLowerCase())
                            );
                            
                            if (garage) {
                                this.conversationState.selectedGarage = garage;
                                // Passage automatique à l'étape suivante si succès et étape courante = 3
                                if (this.conversationState.currentStep === 3) {
                                    this.conversationState.currentStep = 4;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération des garages:', error);
                }
            }
            
            // Récupération des créneaux si nécessaire
            if (!this.cachedData.timeSlots && (this.conversationState.currentStep === 4 || 
                this.conversationState.currentStep === 5)) {
                try {
                    const availabilitiesData = await apiService.getAvailabilities();
                    if (availabilitiesData && availabilitiesData.availabilities) {
                        // Transformer les données pour les rendre plus faciles à utiliser
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
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération des créneaux:', error);
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'enrichissement des données:', error);
        }
    }

    /**
     * Met à jour l'état de la conversation basé sur la réponse
     */
    updateConversationState(response) {
        // Mettre à jour l'étape courante si elle est définie dans la réponse
        if (response.processState && response.processState.currentStep > 0) {
            this.conversationState.currentStep = response.processState.currentStep;
        } else {
            // Sinon, déterminer l'étape à partir de la réponse
            const step = uiController.determineStepFromResponse(response.botResponse, response.processState);
            if (step > 0) {
                this.conversationState.currentStep = step;
            }
        }
    }

    /**
     * Réinitialise la conversation
     */
    async resetConversation() {
        try {
            // Réinitialiser l'état de la conversation
            this.conversationState = {
                currentStep: 1,
                vehiculeInfo: null,
                selectedService: null,
                selectedGarage: null,
                selectedTimeSlot: null,
                confirmed: false
            };
            
            // Vider le cache
            this.cachedData = {
                services: null,
                garages: null,
                timeSlots: null
            };
            
            // Réinitialiser la conversation côté backend
            const response = await apiService.resetConversation(this.sessionId);
            
            // Effacer les messages dans l'UI
            document.getElementById('chat-messages').innerHTML = '';
            
            // Afficher le message de bienvenue
            this.displayWelcomeMessage();
            
            // Réinitialiser l'indicateur d'étape
            uiController.updateStepIndicator(1);
            
            return response;
        } catch (error) {
            console.error('Erreur lors de la réinitialisation de la conversation:', error);
            throw error;
        }
    }

    /**
     * Génère une réponse locale en cas d'indisponibilité du backend
     */
    generateLocalResponse(message) {
        const lowerMessage = message.toLowerCase();
        let response = {
            success: true,
            processState: {
                currentStep: this.conversationState.currentStep,
                isProcessing: false
            }
        };
        
        // Générer une réponse basique selon l'étape courante
        switch (this.conversationState.currentStep) {
            case 1:
                if (this.conversationState.vehiculeInfo) {
                    response.botResponse = `J'ai trouvé votre véhicule ${this.conversationState.vehiculeInfo.brand} ${this.conversationState.vehiculeInfo.model}. Quel service recherchez-vous ?`;
                    this.conversationState.currentStep = 2;
                    response.processState.currentStep = 2;
                } else if (this.conversationState.extractedPlate) {
                    response.botResponse = `J'ai bien noté votre plaque d'immatriculation ${this.conversationState.extractedPlate}. Quel service recherchez-vous ?`;
                    this.conversationState.currentStep = 2;
                    response.processState.currentStep = 2;
                } else if (lowerMessage.match(/[a-z]{2}-\d{3}-[a-z]{2}/i)) {
                    const plate = lowerMessage.match(/[a-z]{2}-\d{3}-[a-z]{2}/i)[0].toUpperCase();
                    response.botResponse = `J'ai bien noté votre plaque d'immatriculation ${plate}. Quel service recherchez-vous ?`;
                    this.conversationState.currentStep = 2;
                    response.processState.currentStep = 2;
                } else {
                    response.botResponse = "Pouvez-vous me donner votre plaque d'immatriculation au format AA-123-AA ?";
                }
                break;
                
            case 2:
                if (this.conversationState.selectedService) {
                    response.botResponse = `Vous avez choisi le service : ${this.conversationState.selectedService.name}. Dans quel garage souhaitez-vous prendre rendez-vous ?`;
                    this.conversationState.currentStep = 3;
                    response.processState.currentStep = 3;
                } else if (this.conversationState.extractedService) {
                    response.botResponse = `Vous avez choisi le service : ${this.conversationState.extractedService}. Dans quel garage souhaitez-vous prendre rendez-vous ?`;
                    this.conversationState.currentStep = 3;
                    response.processState.currentStep = 3;
                } else if (lowerMessage.includes('vidange') || lowerMessage.includes('pneu') || 
                           lowerMessage.includes('frein') || lowerMessage.includes('technique')) {
                    response.botResponse = `Vous avez choisi le service : ${lowerMessage}. Dans quel garage souhaitez-vous prendre rendez-vous ?`;
                    this.conversationState.currentStep = 3;
                    response.processState.currentStep = 3;
                } else {
                    response.botResponse = "Nous proposons des services de vidange, changement de pneus, et réparation des freins. Quel service vous intéresse ?";
                }
                break;
                
            case 3:
                if (this.conversationState.selectedGarage) {
                    response.botResponse = `Vous avez choisi le garage de ${this.conversationState.selectedGarage.name}. Quel créneau horaire préférez-vous ?`;
                    this.conversationState.currentStep = 4;
                    response.processState.currentStep = 4;
                } else if (this.conversationState.extractedGarage) {
                    response.botResponse = `Vous avez choisi le garage de ${this.conversationState.extractedGarage}. Quel créneau horaire préférez-vous ?`;
                    this.conversationState.currentStep = 4;
                    response.processState.currentStep = 4;
                } else if (lowerMessage.includes('paris') || lowerMessage.includes('lyon') || lowerMessage.includes('nice')) {
                    const ville = lowerMessage.includes('paris') ? 'Paris' : lowerMessage.includes('lyon') ? 'Lyon' : 'Nice';
                    response.botResponse = `Vous avez choisi le garage de ${ville}. Quel créneau horaire préférez-vous ?`;
                    this.conversationState.currentStep = 4;
                    response.processState.currentStep = 4;
                } else {
                    response.botResponse = "Nous avons des garages à Paris, Lyon et Nice. Quel garage préférez-vous ?";
                }
                break;
                
            case 4:
                if (lowerMessage.includes('lundi') || lowerMessage.includes('mardi') || 
                    lowerMessage.includes('mercredi') || lowerMessage.includes('jeudi') || 
                    lowerMessage.includes('vendredi') || lowerMessage.includes('demain') || 
                    lowerMessage.includes('matin') || lowerMessage.includes('après-midi')) {
                    this.conversationState.selectedTimeSlot = message;
                    response.botResponse = `Parfait ! Voici un récapitulatif de votre rendez-vous :\n` +
                        (this.conversationState.vehiculeInfo ? `- Véhicule : ${this.conversationState.vehiculeInfo.brand} ${this.conversationState.vehiculeInfo.model}\n` : '') +
                        (this.conversationState.selectedService ? `- Service : ${this.conversationState.selectedService.name}\n` : '') +
                        (this.conversationState.extractedService ? `- Service : ${this.conversationState.extractedService}\n` : '') +
                        (this.conversationState.selectedGarage ? `- Garage : ${this.conversationState.selectedGarage.name}\n` : '') +
                        (this.conversationState.extractedGarage ? `- Garage : ${this.conversationState.extractedGarage}\n` : '') +
                        `- Créneau : ${this.conversationState.selectedTimeSlot}\n\n` +
                        `Souhaitez-vous confirmer ce rendez-vous ?`;
                    this.conversationState.currentStep = 5;
                    response.processState.currentStep = 5;
                } else {
                    response.botResponse = "Quand souhaitez-vous prendre rendez-vous ? Nous avons des créneaux disponibles la semaine prochaine.";
                }
                break;
                
            case 5:
                if (lowerMessage.includes('oui') || lowerMessage.includes('confirm')) {
                    response.botResponse = "Votre rendez-vous a été confirmé ! Vous recevrez bientôt un email de confirmation. Merci d'avoir utilisé notre service.";
                    this.conversationState.confirmed = true;
                    this.conversationState.currentStep = 1; // Réinitialiser pour une nouvelle conversation
                    response.processState.currentStep = 1;
                } else if (lowerMessage.includes('non') || lowerMessage.includes('annul') || lowerMessage.includes('modif')) {
                    response.botResponse = "D'accord, nous annulons cette réservation. Souhaitez-vous recommencer ou avez-vous besoin d'autre chose ?";
                    this.conversationState.currentStep = 1; // Réinitialiser pour une nouvelle conversation
                    response.processState.currentStep = 1;
                } else {
                    response.botResponse = "Je n'ai pas compris votre réponse. Souhaitez-vous confirmer le rendez-vous ? Répondez par 'oui' ou 'non'.";
                }
                break;
                
            default:
                response.botResponse = "Comment puis-je vous aider aujourd'hui ?";
        }
        
        return response;
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