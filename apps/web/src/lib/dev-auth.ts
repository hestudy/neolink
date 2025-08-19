// Development authentication helper
// This file provides helper functions to set up authentication during development

export const DEV_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiM2MzYzI1OC0zNDc5LTQ3MDgtYjcyNi0xYmEyNTljMzg2MjQiLCJ1c2VybmFtZSI6IlRlc3QgVXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc1NTU4MDQyNywiZXhwIjoxNzU1NjY2ODI3LCJhdWQiOiJuZW9saW5rLWNsaWVudCIsImlzcyI6Im5lb2xpbmstYXBpIn0.oGgdkI2nK0BJT6VoP9jipH5ipdtCznOeCbyeazzHfrI';

/**
 * Set up development authentication
 * Call this function to authenticate with the development user
 */
export const setupDevAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', DEV_TOKEN);
    console.log('🔑 Development authentication set up');
    console.log('📧 User: test@example.com');
    console.log('🆔 User ID: b3c3c258-3479-4708-b726-1ba259c38624');
  }
};

/**
 * Clear development authentication
 */
export const clearDevAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    console.log('🔑 Development authentication cleared');
  }
};

/**
 * Check if development authentication is set up
 */
export const isDevAuthSetup = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken') === DEV_TOKEN;
  }
  return false;
};

// Auto-setup in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Auto-setup auth if not already set or if token doesn't match current dev token
  const currentToken = localStorage.getItem('authToken');
  if (!currentToken || currentToken !== DEV_TOKEN) {
    setupDevAuth();
  }
}
