const OPENROUTER_CREDENTIAL_KEY = 'openrouter-api-key';
const OPENROUTER_OAUTH_PENDING_KEY = 'openrouter-oauth-pending';
const OPENROUTER_OAUTH_MESSAGE_KEY = 'openrouter-oauth-message';
const OPENROUTER_OAUTH_CALLBACK_PARAM = 'tweetfilter_openrouter_oauth';
const OPENROUTER_OAUTH_MAX_AGE_MS = 10 * 60 * 1000;
const TWEETFILTER_ORIGINS = new Set(['https://x.com', 'https://twitter.com']);

/** Encodes bytes using the URL-safe, unpadded Base64 format required by PKCE. */
function encodeBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

/** Creates a cryptographically random URL-safe value. */
function createOpenRouterOAuthRandomValue(byteLength = 48) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return encodeBase64Url(bytes);
}

/** Creates the S256 challenge associated with a PKCE verifier. */
async function createOpenRouterCodeChallenge(verifier) {
    const verifierBytes = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', verifierBytes);
    return encodeBase64Url(new Uint8Array(digest));
}

/** Returns whether an OpenRouter credential is available for API requests. */
function isOpenRouterConnected() {
    return Boolean(browserGet(OPENROUTER_CREDENTIAL_KEY, ''));
}

/** Starts OpenRouter OAuth using Authorization Code + PKCE. */
async function connectOpenRouter() {
    if (!window.isSecureContext || !crypto?.subtle) {
        throw new Error('OpenRouter sign-in requires a secure browser context.');
    }

    const verifier = createOpenRouterOAuthRandomValue();
    const nonce = createOpenRouterOAuthRandomValue(24);
    const challenge = await createOpenRouterCodeChallenge(verifier);

    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.delete(OPENROUTER_OAUTH_CALLBACK_PARAM);
    returnUrl.searchParams.delete('code');
    returnUrl.searchParams.delete('error');
    returnUrl.searchParams.delete('error_description');

    const callbackUrl = new URL('/home', window.location.origin);
    callbackUrl.searchParams.set(OPENROUTER_OAUTH_CALLBACK_PARAM, nonce);

    browserSet(OPENROUTER_OAUTH_PENDING_KEY, {
        verifier,
        nonce,
        returnUrl: returnUrl.toString(),
        createdAt: Date.now()
    });
    const storedRequest = browserGet(OPENROUTER_OAUTH_PENDING_KEY, null);
    if (!storedRequest || storedRequest.nonce !== nonce) {
        throw new Error('Could not save the OpenRouter sign-in request.');
    }

    const authUrl = new URL('https://openrouter.ai/auth');
    authUrl.searchParams.set('callback_url', callbackUrl.toString());
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    window.location.assign(authUrl.toString());
}

/** Exchanges an OpenRouter authorization code for its user-controlled API key. */
function exchangeOpenRouterAuthorizationCode(code, verifier) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://openrouter.ai/api/v1/auth/keys',
            headers: {
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://greasyfork.org/en/scripts/532459-tweetfilter-ai',
                'X-Title': 'TweetFilter-AI'
            },
            data: JSON.stringify({
                code,
                code_verifier: verifier,
                code_challenge_method: 'S256'
            }),
            timeout: 30000,
            onload(response) {
                let data = null;
                try {
                    data = JSON.parse(response.responseText);
                } catch (error) {
                    reject(new Error('OpenRouter returned an unreadable response.'));
                    return;
                }

                if (response.status >= 200 && response.status < 300 && data?.key) {
                    resolve(data.key);
                    return;
                }

                const errorMessage = (typeof data?.error === 'string' ? data.error : data?.error?.message)
                    || data?.message
                    || 'OpenRouter authorization failed.';
                reject(new Error(errorMessage));
            },
            onerror() {
                reject(new Error('Could not reach OpenRouter. Please try again.'));
            },
            ontimeout() {
                reject(new Error('OpenRouter authorization timed out. Please try again.'));
            }
        });
    });
}

/** Returns a safe post-OAuth destination from the stored pending request. */
function getOpenRouterOAuthReturnUrl(pending) {
    try {
        const returnUrl = new URL(pending?.returnUrl || 'https://x.com/home');
        if (TWEETFILTER_ORIGINS.has(returnUrl.origin)) {
            return returnUrl.toString();
        }
    } catch (error) {
        console.warn('Ignoring invalid OpenRouter OAuth return URL.', error);
    }
    return 'https://x.com/home';
}

/**
 * Completes an OAuth redirect before the regular tweet-processing startup runs.
 * @returns {Promise<boolean>} Whether the current page is an OAuth callback.
 */
async function handleOpenRouterOAuthCallback() {
    const currentUrl = new URL(window.location.href);
    const callbackNonce = currentUrl.searchParams.get(OPENROUTER_OAUTH_CALLBACK_PARAM);
    if (!callbackNonce) return false;

    if (!TWEETFILTER_ORIGINS.has(currentUrl.origin)
        || currentUrl.pathname.replace(/\/$/, '') !== '/home') {
        return false;
    }

    const pending = browserGet(OPENROUTER_OAUTH_PENDING_KEY, null);
    const returnUrl = getOpenRouterOAuthReturnUrl(pending);
    let message;

    try {
        if (!pending || pending.nonce !== callbackNonce) {
            throw new Error('This OpenRouter sign-in request is invalid or no longer active.');
        }
        if (!pending.createdAt || Date.now() - pending.createdAt > OPENROUTER_OAUTH_MAX_AGE_MS) {
            throw new Error('This OpenRouter sign-in request expired. Please try again.');
        }

        const authorizationError = currentUrl.searchParams.get('error_description') || currentUrl.searchParams.get('error');
        if (authorizationError) {
            throw new Error(authorizationError);
        }

        const code = currentUrl.searchParams.get('code');
        if (!code) {
            throw new Error('OpenRouter did not return an authorization code.');
        }

        const credential = await exchangeOpenRouterAuthorizationCode(code, pending.verifier);
        browserSet(OPENROUTER_CREDENTIAL_KEY, credential);
        message = { text: 'Connected to OpenRouter successfully.', type: 'success' };
    } catch (error) {
        console.error('OpenRouter OAuth failed:', error);
        message = { text: error.message || 'OpenRouter authorization failed.', type: 'error' };
    }

    browserSet(OPENROUTER_OAUTH_PENDING_KEY, null);
    browserSet(OPENROUTER_OAUTH_MESSAGE_KEY, message);
    window.location.replace(returnUrl);
    return true;
}

/** Returns the one-time OAuth result message saved across the redirect. */
function consumeOpenRouterOAuthMessage() {
    const message = browserGet(OPENROUTER_OAUTH_MESSAGE_KEY, null);
    if (message) browserSet(OPENROUTER_OAUTH_MESSAGE_KEY, null);
    return message;
}

/** Removes the locally stored OpenRouter credential. */
function disconnectOpenRouter() {
    browserSet(OPENROUTER_CREDENTIAL_KEY, '');
    browserSet(OPENROUTER_OAUTH_PENDING_KEY, null);
}
