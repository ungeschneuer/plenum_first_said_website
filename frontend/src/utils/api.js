const API_BASE_URL = '/api';

export { searchWords, getWordTimeline, getWordDetails, getWordsComparison, getStatus } from './staticData';

// Speaker endpoints
export async function getSpeakers() {
  const response = await fetch(`${API_BASE_URL}/redner`);

  if (!response.ok) {
    throw new Error('Failed to fetch speakers');
  }

  return response.json();
}

export async function getSpeakerDetails(speakerId) {
  const response = await fetch(`${API_BASE_URL}/redner/${speakerId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Speaker with ID ${speakerId} not found`);
    }
    throw new Error('Failed to fetch speaker details');
  }

  return response.json();
}

export async function getSpeakerWords(speakerId) {
  const response = await fetch(`${API_BASE_URL}/redner/${speakerId}/woerter`);

  if (!response.ok) {
    throw new Error('Failed to fetch speaker words');
  }

  return response.json();
}

// Party endpoints
export async function getParties() {
  const response = await fetch(`${API_BASE_URL}/parteien`);

  if (!response.ok) {
    throw new Error('Failed to fetch parties');
  }

  return response.json();
}

export async function getPartyDetails(partyId) {
  const response = await fetch(`${API_BASE_URL}/parteien/${partyId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Party with ID ${partyId} not found`);
    }
    throw new Error('Failed to fetch party details');
  }

  return response.json();
}

export async function getPartyWords(partyId) {
  const response = await fetch(`${API_BASE_URL}/parteien/${partyId}/woerter`);

  if (!response.ok) {
    throw new Error('Failed to fetch party words');
  }

  return response.json();
}

// Protocol endpoints
export async function getProtocolDetails(protocolId) {
  const response = await fetch(`${API_BASE_URL}/protokoll/${protocolId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Protocol ${protocolId} not found`);
    }
    throw new Error('Failed to fetch protocol details');
  }

  return response.json();
}

export async function getProtocolWords(protocolId, limit = 100) {
  const response = await fetch(`${API_BASE_URL}/protokoll/${protocolId}/woerter?limit=${limit}`);

  if (!response.ok) {
    throw new Error('Failed to fetch protocol words');
  }

  return response.json();
}

export async function getProtocolNewWords(protocolId) {
  const response = await fetch(`${API_BASE_URL}/protokoll/${protocolId}/neue-woerter`);

  if (!response.ok) {
    throw new Error('Failed to fetch protocol new words');
  }

  return response.json();
}

// Wahlperiode endpoints
export async function getWahlperioden() {
  const response = await fetch(`${API_BASE_URL}/wahlperioden`);

  if (!response.ok) {
    throw new Error('Failed to fetch Wahlperioden');
  }

  return response.json();
}

export async function getWahlperiodeDetails(wpNumber) {
  const response = await fetch(`${API_BASE_URL}/wahlperiode/${wpNumber}`);

  if (!response.ok) {
    throw new Error('Failed to fetch Wahlperiode details');
  }

  return response.json();
}

export async function getWahlperiodeProtocols(wpNumber) {
  const response = await fetch(`${API_BASE_URL}/wahlperiode/${wpNumber}/protokolle`);

  if (!response.ok) {
    throw new Error('Failed to fetch Wahlperiode protocols');
  }

  return response.json();
}

export async function getWahlperiodeStats(wpNumber) {
  const response = await fetch(`${API_BASE_URL}/wahlperiode/${wpNumber}/statistik`);

  if (!response.ok) {
    throw new Error('Failed to fetch Wahlperiode stats');
  }

  return response.json();
}

export async function getWordOfTheDay() {
  const response = await fetch(`${API_BASE_URL}/word-of-the-day`);

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Keine Wörter verfügbar');
    }
    throw new Error('Failed to fetch word of the day');
  }

  return response.json();
}

export async function getNewWordsRanking(wahlperiode = null, party = null, limit = 20) {
  const params = new URLSearchParams();
  if (wahlperiode) params.append('wahlperiode', wahlperiode);
  if (party) params.append('party', party);
  if (limit) params.append('limit', limit);

  const response = await fetch(`${API_BASE_URL}/rankings/neue-woerter?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch new words ranking');
  }

  return response.json();
}
