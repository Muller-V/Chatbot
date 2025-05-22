class ApiService {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8000';
        this.chatbotBaseUrl = window.location.origin;
        this.authToken = null;
        this.authHeader = {};
    }

    /**
     * Initialise le service API 
     */
    async initialize() {
        try {
            // Authentification à l'API backend
            const authenticated = await this.authenticate();
            
            if (!authenticated) {
                console.error('Échec d\'authentification à l\'API backend');
                return false;
            }
            
            // Tenter de vérifier si le chatbot est disponible, mais continuer même en cas d'échec
            try {
                const status = await this.getChatbotStatus();
                console.log('Chatbot status:', status);
            } catch (statusError) {
                console.warn('Impossible de vérifier le statut du chatbot, mais on continue:', statusError);
                // Ne pas bloquer l'initialisation si la vérification du statut échoue
            }
            
            return true;
        } catch (error) {
            console.error('Erreur d\'initialisation du service API:', error);
            return false;
        }
    }

    /**
     * Authentifie le chatbot auprès de l'API backend
     */
    async authenticate() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/login_check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'racoon@admin.fr',
                    password: 'racoonadmin'
                })
            });

            const data = await response.json();
            
            if (data.token) {
                this.authToken = data.token;
                this.authHeader = {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                };
                console.log('Authentification réussie');
                return true;
            } else {
                console.error('Échec d\'authentification:', data);
                return false;
            }
        } catch (error) {
            console.error('Erreur lors de l\'authentification:', error);
            return false;
        }
    }

    /**
     * Vérifie le statut du chatbot
     */
    async getChatbotStatus() {
        try {
            // Utiliser window.location.origin pour obtenir le bon hôte
            const statusUrl = `${this.chatbotBaseUrl}/api/status`;
            console.log('Vérification du statut du chatbot à:', statusUrl);
            
            const response = await fetch(statusUrl);
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la vérification du statut du chatbot:', error);
            // Retourner un statut par défaut au lieu de lancer une exception
            return { success: false, message: 'Statut non disponible' };
        }
    }

    /**
     * Envoie un message au chatbot
     */
    async sendMessage(message, sessionId) {
        try {
            const response = await fetch(`${this.chatbotBaseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.authHeader
                },
                body: JSON.stringify({ 
                    message,
                    sessionId 
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
            // Retourner une réponse par défaut en cas d'erreur
            return {
                success: false,
                botResponse: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans un instant.",
                processState: { currentStep: 1 }
            };
        }
    }

    /**
     * Réinitialise la conversation avec le chatbot
     */
    async resetConversation(sessionId) {
        try {
            const response = await fetch(`${this.chatbotBaseUrl}/api/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.authHeader
                },
                body: JSON.stringify({ sessionId })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la réinitialisation de la conversation:', error);
            // Retourner une réponse par défaut en cas d'erreur
            return {
                success: true,
                botResponse: "Conversation réinitialisée. Comment puis-je vous aider ?"
            };
        }
    }

    /**
     * Récupère les informations d'un véhicule par immatriculation
     */
    async getVehiculeByImmatriculation(immatriculation) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/vehicules/${immatriculation}`, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des informations du véhicule:', error);
            throw error;
        }
    }

    /**
     * Récupère tous les garages disponibles
     */
    async getGarages(latitude = null, longitude = null) {
        try {
            let url = `${this.apiBaseUrl}/api/garages`;
            
            if (latitude && longitude) {
                url += `?latitude=${latitude}&longitude=${longitude}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des garages:', error);
            throw error;
        }
    }

    /**
     * Récupère toutes les opérations disponibles
     */
    async getAllOperations() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/operations/`, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des opérations:', error);
            throw error;
        }
    }

    /**
     * Récupère les opérations par catégorie
     */
    async getOperationsByCategory(categoryId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/operations/${categoryId}`, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des opérations par catégorie:', error);
            throw error;
        }
    }

    /**
     * Récupère toutes les catégories d'opérations
     */
    async getAllOperationCategories() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/operations/category`, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des catégories d\'opérations:', error);
            throw error;
        }
    }

    /**
     * Récupère les créneaux disponibles
     */
    async getAvailabilities(page = 1) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/appointments/avaibilities?page=${page}`, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des créneaux disponibles:', error);
            throw error;
        }
    }

    /**
     * Crée un rendez-vous
     */
    async createAppointment(appointmentData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/appointments`, {
                method: 'POST',
                headers: {
                    ...this.authHeader
                },
                body: JSON.stringify(appointmentData)
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la création du rendez-vous:', error);
            throw error;
        }
    }

    /**
     * Récupère les rendez-vous de l'utilisateur
     */
    async getUserAppointments() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/appointments/user`, {
                headers: {
                    ...this.authHeader
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des rendez-vous:', error);
            throw error;
        }
    }
}

// Exporte le service API
const apiService = new ApiService();
window.apiService = apiService; 