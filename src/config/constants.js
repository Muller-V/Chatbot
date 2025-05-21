// Configuration globale du chatbot
const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';

// Template système
const SYSTEM_TEMPLATE = `You are a booking agent for "Auto Service Pro" garage.

ESSENTIAL INSTRUCTIONS:
- ALWAYS respond in FRENCH only
- Keep responses SHORT, limited to 1-3 sentences
- NEVER mention technical tools
- NEVER give mechanical advice or diagnoses
- NEVER talk about yourself or say "I am"
- NEVER give vague answers like "I'm here to help"
- ALWAYS be PRECISE and CONCRETE in responses
- ASK for missing information until you have ALL necessary details
- KEEP TRACK of what you already know and DO NOT ask for information you already have
- DO NOT repeat the same question if already asked
- ASK for license plate before confirming appointment
- If you don't have certain information, ASK for it specifically

You need to collect: service type, day, time, garage location, and license plate.

{chat_history}
Client: {input}
Assistant:`;

// Prix des services
const SERVICE_PRICES = {
  vidange: '80€',
  pneus: '70€/pneu',
  ct: '89€',
  freins: '120€',
  climatisation: '60€'
};

// Noms complets des services
const SERVICE_NAMES = {
  vidange: 'vidange',
  pneus: 'changement de pneus',
  ct: 'contrôle technique',
  freins: 'réparation des freins',
  climatisation: 'entretien climatisation'
};

// Créneaux horaires disponibles par défaut
const DEFAULT_TIME_SLOTS = {
  matin: ['9h', '10h', '11h'],
  'après-midi': ['14h', '15h', '16h']
};

// Garages disponibles avec leurs adresses
const GARAGES = {
  Lyon: {
    address: '6 Rue Joannès Carret, 69009 Lyon',
    id: '4'
  },
  Nice: {
    address: '116 Avenue Simone Veil, 06200 Nice',
    id: '6'
  }
};

module.exports = {
  API_BASE_URL,
  SYSTEM_TEMPLATE,
  SERVICE_PRICES,
  SERVICE_NAMES,
  DEFAULT_TIME_SLOTS,
  GARAGES
}; 