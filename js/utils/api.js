/**
 * Cerebro — API Wrapper
 * 
 * jQuery AJAX wrapper with error handling, retry logic, 
 * and offline queue (localStorage).
 */

'use strict';

var CerebroAPI = (function ($) {

    // ── Configuration ────────────────────────────────────
    var BASE_URL = '/api';
    var MAX_RETRIES = 2;
    var RETRY_DELAY_MS = 1500;
    var QUEUE_KEY = 'cerebro_offline_queue';

    // ── Core Request Method ──────────────────────────────

    /**
     * Make an AJAX request with automatic retry.
     * 
     * @param {string} method  - HTTP method (GET, POST)
     * @param {string} url     - Relative URL (e.g., '/game/start')
     * @param {Object} data    - Request data (query params for GET, body for POST)
     * @param {number} retries - Remaining retry attempts
     * @returns {jQuery.Deferred}
     */
    function request(method, url, data, retries) {
        if (typeof retries === 'undefined') retries = MAX_RETRIES;

        var fullUrl = BASE_URL + url;
        var ajaxConfig = {
            url: fullUrl,
            method: method,
            dataType: 'json',
            timeout: 10000
        };

        if (method === 'POST') {
            ajaxConfig.contentType = 'application/json; charset=utf-8';
            ajaxConfig.data = JSON.stringify(data || {});
        } else {
            ajaxConfig.data = data || {};
        }

        var deferred = $.Deferred();

        $.ajax(ajaxConfig)
            .done(function (response) {
                if (response && response.success) {
                    deferred.resolve(response);
                } else {
                    deferred.reject(response);
                }
            })
            .fail(function (xhr, status, error) {
                // Retry on network errors or 5xx
                if (retries > 0 && (status === 'timeout' || (xhr.status >= 500))) {
                    console.warn('[CerebroAPI] Retrying ' + url + ' (' + retries + ' left)');
                    setTimeout(function () {
                        request(method, url, data, retries - 1)
                            .done(deferred.resolve)
                            .fail(deferred.reject);
                    }, RETRY_DELAY_MS);
                } else {
                    var errorMsg = 'Network error';
                    try {
                        var body = JSON.parse(xhr.responseText);
                        errorMsg = body.error || errorMsg;
                    } catch (e) {
                        // ignore parse error
                    }
                    deferred.reject({
                        success: false,
                        error: errorMsg,
                        status: xhr.status
                    });
                }
            });

        return deferred.promise();
    }

    // ── Public Methods ───────────────────────────────────

    /**
     * GET request.
     */
    function get(url, params) {
        return request('GET', url, params);
    }

    /**
     * POST request.
     */
    function post(url, data) {
        return request('POST', url, data);
    }

    // ── Offline Queue ────────────────────────────────────

    /**
     * Queue a failed request for later retry.
     */
    function queueForRetry(method, url, data) {
        try {
            var queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            queue.push({
                method: method,
                url: url,
                data: data,
                timestamp: Date.now()
            });
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            console.info('[CerebroAPI] Queued offline request:', url);
        } catch (e) {
            console.error('[CerebroAPI] Failed to queue request:', e);
        }
    }

    /**
     * Process all queued requests (call this when back online).
     */
    function processQueue() {
        try {
            var queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            if (queue.length === 0) return;

            console.info('[CerebroAPI] Processing ' + queue.length + ' queued requests');
            localStorage.removeItem(QUEUE_KEY);

            queue.forEach(function (item) {
                request(item.method, item.url, item.data)
                    .fail(function () {
                        // Re-queue if still failing
                        queueForRetry(item.method, item.url, item.data);
                    });
            });
        } catch (e) {
            console.error('[CerebroAPI] Failed to process queue:', e);
        }
    }

    /**
     * Get the count of queued requests.
     */
    function getQueueCount() {
        try {
            var queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            return queue.length;
        } catch (e) {
            return 0;
        }
    }

    // ── Listen for online event ──────────────────────────
    $(window).on('online', function () {
        console.info('[CerebroAPI] Back online — processing queue');
        processQueue();
    });

    // ── Public API ───────────────────────────────────────
    return {
        get: get,
        post: post,
        queueForRetry: queueForRetry,
        processQueue: processQueue,
        getQueueCount: getQueueCount
    };

})(jQuery);
