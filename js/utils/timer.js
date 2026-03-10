/**
 * Cerebro — High-Resolution Timer
 * 
 * Uses performance.now() for sub-millisecond accuracy.
 * Avoids Date.now() which is susceptible to system clock adjustments.
 */

'use strict';

var CerebroTimer = (function () {

    /**
     * Create a new Timer instance.
     */
    function Timer() {
        this._startTime = 0;
        this._elapsed = 0;
        this._running = false;
        this._laps = [];
    }

    /**
     * Start or resume the timer.
     */
    Timer.prototype.start = function () {
        if (this._running) return this;
        this._startTime = performance.now() - this._elapsed;
        this._running = true;
        return this;
    };

    /**
     * Stop the timer, preserving elapsed time.
     */
    Timer.prototype.stop = function () {
        if (!this._running) return this;
        this._elapsed = performance.now() - this._startTime;
        this._running = false;
        return this;
    };

    /**
     * Reset the timer to zero.
     */
    Timer.prototype.reset = function () {
        this._startTime = 0;
        this._elapsed = 0;
        this._running = false;
        this._laps = [];
        return this;
    };

    /**
     * Get elapsed time in milliseconds (high precision).
     */
    Timer.prototype.getElapsed = function () {
        if (this._running) {
            return performance.now() - this._startTime;
        }
        return this._elapsed;
    };

    /**
     * Get elapsed time in whole milliseconds.
     */
    Timer.prototype.getElapsedMs = function () {
        return Math.round(this.getElapsed());
    };

    /**
     * Get elapsed time formatted as seconds (e.g., "12.3s").
     */
    Timer.prototype.getFormatted = function () {
        var ms = this.getElapsedMs();
        if (ms < 1000) return ms + 'ms';
        return (ms / 1000).toFixed(1) + 's';
    };

    /**
     * Record a lap time and return the duration since the last lap (or start).
     */
    Timer.prototype.lap = function () {
        var now = this.getElapsedMs();
        var lastLap = this._laps.length > 0 ? this._laps[this._laps.length - 1].total : 0;
        var delta = now - lastLap;
        this._laps.push({ total: now, delta: delta });
        return delta;
    };

    /**
     * Get all recorded laps.
     */
    Timer.prototype.getLaps = function () {
        return this._laps.slice();
    };

    /**
     * Check if the timer is currently running.
     */
    Timer.prototype.isRunning = function () {
        return this._running;
    };

    return {
        create: function () {
            return new Timer();
        }
    };

})();
