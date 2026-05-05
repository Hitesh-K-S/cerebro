/**
 * Cerebro — Google Authentication Controller
 */

'use strict';

var CerebroAuth = (function ($) {
    var currentUser = null;
    var googleClientId = null;
    var googleConfigured = false;
    var googleInitialized = false;
    var pendingNotice = '';
    var renderAttempts = 0;
    var maxRenderAttempts = 30;

    function init() {
        bindEvents();
        refreshSession();
    }

    function bindEvents() {
        $(document).on('click', '#user-session-controls .header-signin-btn', function () {
            openAuth('');
        });

        $(document).on('click', '#google-signin-trigger', function () {
            triggerGoogleSignIn();
        });

        $(document).on('click', '#auth-back-btn', function () {
            clearNotice();
        });

        $(document).on('click', '#auth-signout-btn', function () {
            logout();
        });
    }

    function refreshSession() {
        CerebroAPI.get('/auth/session')
            .done(function (response) {
                currentUser = response.user || null;
                googleConfigured = !!response.google_configured;
                googleClientId = response.google_client_id || null;
                renderHeaderState();
                syncAuthView();
                initializeGoogleButton();
            })
            .fail(function () {
                currentUser = null;
                googleConfigured = false;
                googleClientId = null;
                renderHeaderState();
                syncAuthView();
            });
    }

    function initializeGoogleButton() {
        if (!googleConfigured || !googleClientId) {
            $('#auth-config-message').removeClass('hidden');
            $('#auth-google-shell').addClass('hidden');
            return;
        }

        $('#auth-config-message').addClass('hidden');
        $('#auth-google-shell').removeClass('hidden');

        if (googleInitialized) {
            return;
        }

        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            renderAttempts += 1;
            if (renderAttempts <= maxRenderAttempts) {
                window.setTimeout(initializeGoogleButton, 300);
            }
            return;
        }

        google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredential
        });

        google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                width: 320
            }
        );

        googleInitialized = true;
        $('#google-signin-button').attr('aria-hidden', 'true');
    }

    function triggerGoogleSignIn() {
        if (!googleConfigured || !googleClientId) {
            showNotice('Google Sign-In is not configured for this environment yet.');
            return;
        }

        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            initializeGoogleButton();
            showNotice('Google Sign-In is still loading. Try again in a moment.');
            return;
        }

        showNotice('Choose your Google account to continue.');
        google.accounts.id.prompt();
    }

    function handleGoogleCredential(response) {
        if (!response || !response.credential) {
            showNotice('Google sign-in did not return a valid credential.');
            return;
        }

        showNotice('Finishing secure sign-in…');

        CerebroAPI.post('/auth/google', {
            credential: response.credential
        })
            .done(function (result) {
                currentUser = result.user || null;
                renderHeaderState();
                syncAuthView();
                clearNotice();
                $(document).trigger('cerebro:auth-success', [currentUser]);
            })
            .fail(function (error) {
                var message = (error && error.error) ? error.error : 'Google sign-in failed.';
                showNotice(message);
            });
    }

    function renderHeaderState() {
        var $controls = $('#user-session-controls');
        if ($controls.length === 0) {
            return;
        }

        if (!currentUser) {
            $controls.html('<button class="header-signin-btn" type="button">Sign In</button>');
            return;
        }

        var displayName = escapeHtml(currentUser.display_name || currentUser.username || 'Cerebro User');
        var email = escapeHtml(currentUser.email || '');
        var avatarMarkup = currentUser.avatar_url
            ? '<img class="user-avatar" src="' + escapeHtml(currentUser.avatar_url) + '" alt="' + displayName + ' avatar">'
            : '<div class="user-avatar user-avatar-fallback">' + displayName.charAt(0).toUpperCase() + '</div>';

        $controls.html(
            '<div class="user-session">' +
                avatarMarkup +
                '<div class="user-copy">' +
                    '<strong>' + displayName + '</strong>' +
                    '<span>' + email + '</span>' +
                '</div>' +
            '</div>' +
            '<button id="auth-signout-btn" class="header-session-btn" type="button">Sign Out</button>'
        );
    }

    function syncAuthView() {
        if (currentUser) {
            $('.auth-panel-copy').text('Signed in as ' + (currentUser.display_name || currentUser.username || currentUser.email || 'your Google account') + '. You can return to training or switch accounts from your browser session.');
            $('#auth-back-btn').text('Return to Training');
            return;
        }

        $('.auth-panel-copy').text('Choose the Google account you want to use for Cerebro.');
        $('#auth-back-btn').text('Back to Landing Page');
    }

    function logout() {
        CerebroAPI.post('/auth/logout', {})
            .done(function () {
                currentUser = null;
                renderHeaderState();
                clearNotice();
                if (window.CerebroApp) {
                    CerebroApp.showView('dashboard');
                }
            })
            .fail(function (error) {
                showNotice((error && error.error) ? error.error : 'Could not sign out right now.');
                if (window.CerebroApp) {
                    CerebroApp.showView('auth');
                }
            });
    }

    function openAuth(message) {
        if (message) {
            pendingNotice = message;
            showNotice(message);
        } else {
            clearNotice();
        }

        if (window.CerebroApp) {
            CerebroApp.showView('auth');
        }
    }

    function showNotice(message) {
        pendingNotice = message || '';
        if (!pendingNotice) {
            clearNotice();
            return;
        }

        $('#auth-notice').removeClass('hidden').text(pendingNotice);
    }

    function clearNotice() {
        pendingNotice = '';
        $('#auth-notice').addClass('hidden').text('');
    }

    function isAuthenticated() {
        return !!currentUser;
    }

    function getUser() {
        return currentUser;
    }

    function escapeHtml(value) {
        return $('<div>').text(value == null ? '' : String(value)).html();
    }

    $(document).ready(function () {
        init();
    });

    return {
        openAuth: openAuth,
        isAuthenticated: isAuthenticated,
        getUser: getUser,
        refreshSession: refreshSession,
        logout: logout
    };
})(jQuery);
