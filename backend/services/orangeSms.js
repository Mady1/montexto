const axios = require('axios');

const envClientId = process.env.ORANGE_CLIENT_ID;
const envClientSecret = process.env.ORANGE_CLIENT_SECRET;
const envSenderAddress = process.env.ORANGE_SENDER_ADDRESS; // e.g. +2250700000000
const envSenderName = process.env.ORANGE_SENDER_NAME || '';

if (!envClientId || !envClientSecret || !envSenderAddress) {
  console.warn('Orange SMS credentials not configured. SMS sending will be simulated unless a gateway config provides them.');
}

// Cached OAuth token per clientId, since multiple Orange gateways may use different credentials.
const tokenCache = new Map();

function toTelFormat(number) {
  const trimmed = String(number).trim();
  if (trimmed.startsWith('tel:')) return trimmed;
  return `tel:${trimmed.startsWith('+') ? trimmed : `+${trimmed}`}`;
}

async function getAccessToken(clientId, clientSecret) {
  const cached = tokenCache.get(clientId);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post(
    'https://api.orange.com/oauth/v3/token',
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const token = response.data.access_token;
  // Refresh a minute early to avoid using a token that expires mid-request.
  const expiresAt = Date.now() + (Number(response.data.expires_in) - 60) * 1000;
  tokenCache.set(clientId, { token, expiresAt });
  return token;
}

// Per Orange's docs, a call made with an expired Bearer token returns this shape
// (distinct from the SMS API's own requestError format) — retry once with a fresh token.
function isExpiredCredentialsError(error) {
  return error.response?.status === 401 && error.response?.data?.code === 42;
}

async function withTokenRetry(clientId, clientSecret, makeRequest) {
  const token = await getAccessToken(clientId, clientSecret);
  try {
    return await makeRequest(token);
  } catch (error) {
    if (!isExpiredCredentialsError(error)) throw error;
    tokenCache.delete(clientId);
    const freshToken = await getAccessToken(clientId, clientSecret);
    return makeRequest(freshToken);
  }
}

// Orange's Exception.text uses %1, %2... placeholders filled in by the parallel
// Exception.variables array (e.g. "Error code is %1" + ["Expired contract..."]).
function substituteVariables(text, variables) {
  if (!text || !Array.isArray(variables)) return text;
  return variables.reduce((acc, v, i) => acc.split(`%${i + 1}`).join(v), text);
}

function extractErrorMessage(error) {
  const data = error.response?.data;
  const requestError = data?.requestError;
  const exception = requestError?.serviceException || requestError?.policyException;
  return (
    (exception && substituteVariables(exception.text, exception.variables)) ||
    data?.error_description || // OAuth2 token errors (invalid_client, invalid_grant, ...)
    data?.error ||
    error.message
  );
}

// Subscribes the given senderAddress to delivery receipt (DR) notifications,
// so Orange POSTs real delivery status updates to notifyUrl.
async function subscribeDeliveryReceipts({ config = {}, notifyUrl }) {
  const clientId = config.clientId || envClientId;
  const clientSecret = config.clientSecret || envClientSecret;
  const senderAddress = config.senderAddress || config.sender || envSenderAddress;

  if (!clientId || !clientSecret || !senderAddress) {
    return { subscribed: false, error: 'Orange credentials not configured' };
  }

  try {
    const sender = toTelFormat(senderAddress);

    const response = await withTokenRetry(clientId, clientSecret, (token) =>
      axios.post(
        `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(sender)}/subscriptions`,
        { deliveryReceiptSubscription: { callbackReference: { notifyURL: notifyUrl } } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    return {
      subscribed: true,
      resourceURL: response.data?.deliveryReceiptSubscription?.resourceURL || null,
    };
  } catch (error) {
    return { subscribed: false, error: extractErrorMessage(error) };
  }
}

// Validates credentials by requesting a fresh OAuth token (bypasses the cache
// so a stale cached token from earlier bad credentials can't mask the result).
async function testAuth({ config = {} }) {
  const clientId = config.clientId || envClientId;
  const clientSecret = config.clientSecret || envClientSecret;

  if (!clientId || !clientSecret) {
    return { success: false, message: 'Client ID et Client Secret requis' };
  }

  try {
    tokenCache.delete(clientId);
    const token = await getAccessToken(clientId, clientSecret);
    return { success: true, message: `Authentification réussie (token obtenu, ${token.length} caractères)` };
  } catch (error) {
    return { success: false, message: extractErrorMessage(error) };
  }
}

async function sendSms({ to, body, config = {} }) {
  const clientId = config.clientId || envClientId;
  const clientSecret = config.clientSecret || envClientSecret;
  const senderAddress = config.senderAddress || config.sender || envSenderAddress;
  const senderName = config.senderName || envSenderName;

  if (!clientId || !clientSecret || !senderAddress) {
    return {
      sid: `SIMULATED_${Date.now()}`,
      status: 'simulated',
      error: null,
    };
  }

  try {
    const sender = toTelFormat(senderAddress);

    const payload = {
      outboundSMSMessageRequest: {
        address: toTelFormat(to),
        senderAddress: sender,
        ...(senderName ? { senderName } : {}),
        outboundSMSTextMessage: { message: body },
      },
    };

    await withTokenRetry(clientId, clientSecret, (token) =>
      axios.post(
        `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(sender)}/requests`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    // The send response only echoes the request (address/senderAddress/message) — Orange's
    // API never returns a message identifier here, so there is nothing real to use as sid.
    // Delivery receipts must therefore be correlated by recipient phone number (see routes/inbound.js).
    return {
      sid: `ORANGE_${Date.now()}`,
      status: 'sent',
      error: null,
    };
  } catch (error) {
    return {
      sid: null,
      status: 'failed',
      error: extractErrorMessage(error),
    };
  }
}

module.exports = { sendSms, subscribeDeliveryReceipts, testAuth };
