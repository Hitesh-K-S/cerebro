/**
 * Cerebro — Hero Grid
 *
 * Lightweight DOM-based interactive grid for the dashboard hero.
 */

'use strict';

var CerebroHero = (function () {

    var grid;
    var authGrid;

    function init() {
        grid = document.getElementById('interactive-grid');
        authGrid = document.getElementById('auth-star-grid');

        buildGrids();
        window.addEventListener('resize', buildGrids);
    }

    function buildGrids() {
        buildGrid();
        buildAuthGrid();
    }

    function buildGrid() {
        if (!grid) return;

        var cols = window.innerWidth < 768 ? 30 : 60;
        var rows = window.innerWidth < 768 ? 42 : 32;
        var html = buildSymbolMarkup(cols * rows, '+', 0.05, 0.15, 160, 40, 'grid-item');

        grid.innerHTML = html;
        grid.style.setProperty('--cols', cols);
        grid.style.setProperty('--rows', rows);
    }

    function buildAuthGrid() {
        if (!authGrid) return;

        var rect = authGrid.getBoundingClientRect();
        var cellSize = window.innerWidth < 768 ? 28 : 34;
        var cols = Math.max(12, Math.floor(rect.width / cellSize));
        var rows = Math.max(10, Math.floor(rect.height / cellSize));
        var html = buildSymbolMarkup(cols * rows, '*', 0.03, 0.1, 20, 28, 'auth-grid-item');

        authGrid.innerHTML = html;
        authGrid.style.setProperty('--cols', cols);
        authGrid.style.setProperty('--rows', rows);
    }

    function buildSymbolMarkup(itemCount, symbol, minOpacity, opacityRange, baseHue, hueRange, className) {
        var html = '';

        for (var i = 0; i < itemCount; i++) {
            var grade = Math.floor(Math.random() * 12 - 6);
            var opacity = (Math.random() * opacityRange + minOpacity).toFixed(2);
            var hueOffset = Math.floor(Math.random() * hueRange - (hueRange / 2));
            var color = 'hsl(' + (baseHue + hueOffset) + ', 38%, 48%)';

            html += '<div class="' + className + '" style="--grade:' + grade + ';--opacity:' + opacity + ';--item-color:' + color + '">' + symbol + '</div>';
        }

        return html;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }

    return {
        start: function () { },
        stop: function () { },
        refresh: buildGrids
    };

})();
