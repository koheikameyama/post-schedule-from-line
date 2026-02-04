import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Buffer time before expiry to refresh token (5 minutes)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date | null;
}

export interface RefreshResult {
  accessToken: string;
  expiryDate: Date | null;
  refreshed: boolean;
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials are not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Check if the token is expired or will expire soon
 */
export function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) {
    // If no expiry date, assume it might be expired
    return true;
  }

  const now = Date.now();
  const expiryTime = expiryDate.getTime();

  // Return true if token is expired or will expire within buffer time
  return now >= expiryTime - TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Refresh the access token using the refresh token
 * Returns new access token and expiry date, or throws if refresh fails
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token: no access token returned');
    }

    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      refreshed: true,
    };
  } catch (error) {
    // Check if the error is due to invalid/revoked refresh token
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been revoked')) {
      throw new Error('TOKEN_REVOKED');
    }
    throw error;
  }
}

export function getAuthUrl(lineUserId: string): string {
  const oauth2Client = getOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: lineUserId, // Pass LINE User ID via state parameter
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getCalendarList(accessToken: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.calendarList.list();

  return response.data.items || [];
}
