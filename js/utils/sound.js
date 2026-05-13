/**
 * Cerebro — Sound Effects (Web Audio API)
 * Lightweight tone-based feedback, no external files needed.
 */

var CerebroSound = (function () {

    var ctx = null;

    function getCtx() {
        if (!ctx) {
            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                return null;
            }
        }
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        return ctx;
    }

    function correct() {
        var ac = getCtx();
        if (!ac) return;
        try {
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.frequency.setValueAtTime(523, ac.currentTime);
            osc.frequency.setValueAtTime(659, ac.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.25);
        } catch (e) {}
    }

    function wrong() {
        var ac = getCtx();
        if (!ac) return;
        try {
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ac.currentTime);
            osc.frequency.setValueAtTime(150, ac.currentTime + 0.12);
            gain.gain.setValueAtTime(0.08, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.3);
        } catch (e) {}
    }

    function complete() {
        var ac = getCtx();
        if (!ac) return;
        try {
            var notes = [523, 659, 784, 1047];
            notes.forEach(function (freq, i) {
                var osc = ac.createOscillator();
                var gain = ac.createGain();
                osc.connect(gain);
                gain.connect(ac.destination);
                osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.1);
                gain.gain.setValueAtTime(0.1, ac.currentTime + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 0.3);
                osc.start(ac.currentTime + i * 0.1);
                osc.stop(ac.currentTime + i * 0.1 + 0.3);
            });
        } catch (e) {}
    }

    function tap() {
        var ac = getCtx();
        if (!ac) return;
        try {
            var osc = ac.createOscillator();
            var gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.frequency.setValueAtTime(880, ac.currentTime);
            gain.gain.setValueAtTime(0.06, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.08);
        } catch (e) {}
    }

    return {
        correct: correct,
        wrong: wrong,
        complete: complete,
        tap: tap
    };

})();
