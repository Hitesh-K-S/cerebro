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

        $(document).on('click', '#profile-trigger', function () {
            openProfile();
        });

        $(document).on('click', '#auth-signout-btn', function () {
            logout();
        });

        $(document).on('click', '#profile-save-btn', function () {
            saveUsername();
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
        var $gsiButton = $('#google-signin-button [tabindex]');
        if ($gsiButton.length) {
            $gsiButton[0].click();
        } else {
            google.accounts.id.prompt();
        }
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
        $('body').toggleClass('authenticated', !!currentUser);

        var $controls = $('#user-session-controls');
        if ($controls.length === 0) {
            return;
        }

        if (!currentUser) {
            $controls.html('<button class="header-signin-btn" type="button">Sign In</button>');
            return;
        }

        var username = escapeHtml(currentUser.username || 'Cerebro User');

        $controls.html(
            '<div class="user-session" tabindex="0" role="button" id="profile-trigger">' +
                '<span class="user-username">' + username + '</span>' +
            '</div>' +
            '<button id="auth-signout-btn" class="header-session-btn" type="button">Sign Out</button>'
        );
    }

    function syncAuthView() {
        if (currentUser) {
            $('.auth-panel-copy').text('Signed in as ' + (currentUser.username || escapeHtml(currentUser.email || 'your Google account')) + '. You can return to training or switch accounts from your browser session.');
            $('#auth-back-btn').text('Return to Training');
            return;
        }

        $('.auth-panel-copy').text('Choose the Google account you want to use for Cerebro.');
        $('#auth-back-btn').text('Back to Landing Page');
    }

    function openProfile() {
        if (!currentUser) {
            return;
        }

        loadProfile();

        if (window.CerebroApp) {
            CerebroApp.showView('profile');
        }
    }

    function loadProfile() {
        if (!currentUser) {
            return;
        }

        var name = escapeHtml(currentUser.display_name || currentUser.username || '');
        var email = escapeHtml(currentUser.email || '');
        var username = escapeHtml(currentUser.username || '');
        var avatarUrl = currentUser.avatar_url || '';
        var authProvider = escapeHtml(currentUser.auth_provider || 'Google');

        $('#profile-display-name').text(name);
        $('#profile-email').text(email);
        $('#profile-username-input').val(username);
        $('#profile-auth-provider').text(authProvider);
        $('#profile-message').addClass('hidden').text('');

        var $avatar = $('#profile-avatar');
        $avatar.empty();
        if (avatarUrl) {
            $avatar.html('<img src="' + escapeHtml(avatarUrl) + '" alt="Avatar">');
        }

        CerebroAPI.get('/scores/history', {})
            .done(function (response) {
                var stats = response.stats || {};
                $('#profile-member-since').text(formatMemberSince(currentUser.created_at));
                $('#profile-total-sessions').text(stats.total_sessions != null ? stats.total_sessions : '—');
            })
            .fail(function () {
                $('#profile-member-since').text(formatMemberSince(currentUser.created_at));
                $('#profile-total-sessions').text('—');
            });
    }

    function saveUsername() {
        var $input = $('#profile-username-input');
        var $message = $('#profile-message');
        var username = $input.val().trim();

        if (username.length < 3 || username.length > 24) {
            $message.removeClass('hidden success').addClass('error').text('Username must be between 3 and 24 characters.');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            $message.removeClass('hidden success').addClass('error').text('Only letters, numbers, and underscores allowed.');
            return;
        }

        $message.removeClass('hidden error success').text('Saving…');

        CerebroAPI.post('/auth/update-profile', { username: username })
            .done(function (result) {
                currentUser = result.user || null;
                renderHeaderState();
                $message.removeClass('error').addClass('success').text('Username saved.');
            })
            .fail(function (error) {
                var msg = (error && error.error) ? error.error : 'Could not save username.';
                $message.removeClass('success').addClass('error').text(msg);
            });
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

    function formatMemberSince(value) {
        if (!value) {
            return '—';
        }

        var date = new Date(value);
        if (isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function escapeHtml(value) {
        return $('<div>').text(value == null ? '' : String(value)).html();
    }

    $(document).ready(function () {
        init();
    });

    return {
        openAuth: openAuth,
        openProfile: openProfile,
        isAuthenticated: isAuthenticated,
        getUser: getUser,
        refreshSession: refreshSession,
        logout: logout
    };
})(jQuery);
