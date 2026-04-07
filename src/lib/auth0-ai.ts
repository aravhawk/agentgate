import { Auth0AI, getAccessTokenFromTokenVault } from "@auth0/ai-vercel";

import { getRefreshToken } from "./auth0";

export const getAccessToken = async () => getAccessTokenFromTokenVault();

const auth0AI = new Auth0AI();

export const withCalendarRead = auth0AI.withTokenVault({
  connection: "google-oauth2",
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
  refreshToken: getRefreshToken,
});

export const withCalendarWrite = auth0AI.withTokenVault({
  connection: "google-oauth2",
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  refreshToken: getRefreshToken,
});

export const withGitHubConnection = auth0AI.withTokenVault({
  connection: "github",
  scopes: [],
  refreshToken: getRefreshToken,
  credentialsContext: "tool-call",
});
