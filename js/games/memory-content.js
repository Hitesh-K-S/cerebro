/**
 * Cerebro — Shared verbal memory content helpers
 */

'use strict';

var CerebroMemoryContent = (function () {

    var FACT_SETS = [
        {
            key: 'science',
            label: 'Science',
            cards: [
                { prompt: 'What gas do plants absorb from the air?', answer: 'Carbon dioxide' },
                { prompt: 'What part of the cell contains genetic material?', answer: 'Nucleus' },
                { prompt: 'What force pulls objects toward Earth?', answer: 'Gravity' },
                { prompt: 'What blood cells help fight infection?', answer: 'White blood cells' },
                { prompt: 'What planet is known for its rings?', answer: 'Saturn' },
                { prompt: 'What organ pumps blood through the body?', answer: 'Heart' },
                { prompt: 'What process turns liquid water into vapor?', answer: 'Evaporation' },
                { prompt: 'What mineral helps keep bones strong?', answer: 'Calcium' }
            ]
        },
        {
            key: 'geography',
            label: 'Geography',
            cards: [
                { prompt: 'What is the capital of Japan?', answer: 'Tokyo' },
                { prompt: 'Which desert covers much of northern Africa?', answer: 'Sahara' },
                { prompt: 'What is the longest river in South America?', answer: 'Amazon' },
                { prompt: 'What ocean lies between Africa and Australia?', answer: 'Indian Ocean' },
                { prompt: 'What is the capital of Canada?', answer: 'Ottawa' },
                { prompt: 'Which country is shaped like a boot?', answer: 'Italy' },
                { prompt: 'What mountain range separates France and Spain?', answer: 'Pyrenees' },
                { prompt: 'What is the capital of Australia?', answer: 'Canberra' }
            ]
        },
        {
            key: 'vocabulary',
            label: 'Vocabulary',
            cards: [
                { prompt: 'What word means careful use of money?', answer: 'Frugal' },
                { prompt: 'What word means easy to understand?', answer: 'Clear' },
                { prompt: 'What word means to make something better?', answer: 'Improve' },
                { prompt: 'What word means to remember something vividly?', answer: 'Recall' },
                { prompt: 'What word means to join ideas together?', answer: 'Connect' },
                { prompt: 'What word means to make shorter?', answer: 'Condense' },
                { prompt: 'What word means to slow down and think carefully?', answer: 'Reflect' },
                { prompt: 'What word means to sort into groups?', answer: 'Classify' }
            ]
        }
    ];

    var CHAINS = [
        {
            title: 'Plant Growth',
            steps: ['Seed', 'Root', 'Sprout', 'Leaf', 'Flower', 'Fruit']
        },
        {
            title: 'Writing Process',
            steps: ['Idea', 'Outline', 'Draft', 'Revise', 'Edit', 'Publish']
        },
        {
            title: 'Memory Routine',
            steps: ['Read', 'Summarize', 'Recall', 'Check', 'Repeat', 'Review']
        },
        {
            title: 'Water Cycle',
            steps: ['Evaporation', 'Condensation', 'Clouds', 'Rain', 'Runoff', 'Collection']
        },
        {
            title: 'Learning Loop',
            steps: ['Notice', 'Focus', 'Encode', 'Retrieve', 'Correct', 'Retain']
        }
    ];

    var SEQUENCE_POOLS = [
        { label: 'Digits', tokens: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
        { label: 'Letters', tokens: ['A', 'D', 'F', 'H', 'K', 'M', 'Q', 'R', 'T'] },
        { label: 'Directions', tokens: ['↑', '→', '↓', '←', '↗', '↘', '↙', '↖'] },
        { label: 'Symbols', tokens: ['◆', '●', '▲', '■', '★', '✦', '✚', '⬢'] }
    ];

    var CHUNK_SETS = [
        { label: 'Code Blocks', chunks: ['742', '915', '308', '624', '871', '560'] },
        { label: 'Letter Packs', chunks: ['BKM', 'TRQ', 'LFD', 'PSN', 'WXC', 'GHJ'] },
        { label: 'Study Labels', chunks: ['BIO', 'GEO', 'ALG', 'LIT', 'HIS', 'ART'] },
        { label: 'Mixed Chunks', chunks: ['A7Q', '4LM', 'N92', 'T5R', 'P3X', '8DK'] }
    ];

    var STACK_ENTITIES = [
        { name: 'Door', on: 'Open', off: 'Closed' },
        { name: 'Lamp', on: 'On', off: 'Off' },
        { name: 'Drawer', on: 'Open', off: 'Closed' },
        { name: 'Chest', on: 'Unlocked', off: 'Locked' }
    ];

    function shuffle(arr) {
        var copy = arr.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function sample(arr, count) {
        return shuffle(arr).slice(0, count);
    }

    function randomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function getFactBatch(count) {
        var set = randomItem(FACT_SETS);
        return {
            theme: set.label,
            cards: sample(set.cards, Math.min(count, set.cards.length))
        };
    }

    function getFactChoices(card, totalChoices) {
        var answers = [];
        FACT_SETS.forEach(function (set) {
            set.cards.forEach(function (item) {
                if (item.answer !== card.answer) {
                    answers.push(item.answer);
                }
            });
        });

        var picks = sample(answers, Math.max(0, totalChoices - 1));
        picks.push(card.answer);
        return shuffle(picks);
    }

    function getInterferenceWord() {
        var set = randomItem(FACT_SETS);
        var card = randomItem(set.cards);
        return {
            word: card.answer,
            isLong: card.answer.replace(/\s+/g, '').length >= 7
        };
    }

    function getChain(length) {
        var chain = randomItem(CHAINS);
        return {
            title: chain.title,
            steps: chain.steps.slice(0, Math.min(length, chain.steps.length))
        };
    }

    function getSequenceRound(length) {
        var pool = randomItem(SEQUENCE_POOLS);
        var sequence = sample(pool.tokens, Math.min(length, pool.tokens.length));
        var optionCount = Math.min(pool.tokens.length, Math.max(sequence.length + 2, 6));
        var extras = sample(pool.tokens.filter(function (token) {
            return sequence.indexOf(token) === -1;
        }), Math.max(0, optionCount - sequence.length));
        var options = shuffle(sequence.concat(extras));
        return {
            label: pool.label,
            sequence: sequence,
            options: options
        };
    }

    function getChunkChallenge(count) {
        var set = randomItem(CHUNK_SETS);
        var chunks = sample(set.chunks, Math.min(count, set.chunks.length));
        var distractors = [];
        CHUNK_SETS.forEach(function (group) {
            group.chunks.forEach(function (chunk) {
                if (chunks.indexOf(chunk) === -1) distractors.push(chunk);
            });
        });
        return {
            label: set.label,
            chunks: chunks,
            options: shuffle(chunks.concat(sample(distractors, Math.min(count + 1, distractors.length))))
        };
    }

    function getStackChallenge(level) {
        var entities = sample(STACK_ENTITIES, 3);
        var initial = {};
        entities.forEach(function (entity) {
            initial[entity.name] = Math.random() > 0.5;
        });

        var actions = [];
        var operations = Math.min(3 + Math.floor((level - 1) / 2), 5);
        for (var i = 0; i < operations; i++) {
            var entity = randomItem(entities);
            var actionType = randomItem(['toggle', 'set-on', 'set-off']);
            actions.push({ entity: entity, type: actionType });
        }

        var finalState = {};
        entities.forEach(function (entity) {
            finalState[entity.name] = initial[entity.name];
        });

        actions.forEach(function (action) {
            if (action.type === 'toggle') finalState[action.entity.name] = !finalState[action.entity.name];
            if (action.type === 'set-on') finalState[action.entity.name] = true;
            if (action.type === 'set-off') finalState[action.entity.name] = false;
        });

        var correctLabel = formatStateLabel(entities, finalState);
        var options = [correctLabel];
        while (options.length < 4) {
            var mutant = {};
            entities.forEach(function (entity) {
                mutant[entity.name] = finalState[entity.name];
            });
            var target = randomItem(entities);
            mutant[target.name] = !mutant[target.name];
            var label = formatStateLabel(entities, mutant);
            if (options.indexOf(label) === -1) options.push(label);
        }

        return {
            entities: entities,
            initial: initial,
            actions: actions,
            correctLabel: correctLabel,
            options: shuffle(options)
        };
    }

    function formatStateLabel(entities, stateMap) {
        return entities.map(function (entity) {
            return entity.name + ': ' + (stateMap[entity.name] ? entity.on : entity.off);
        }).join(' • ');
    }

    function describeAction(action) {
        if (action.type === 'toggle') return 'Toggle ' + action.entity.name;
        if (action.type === 'set-on') return 'Set ' + action.entity.name + ' to ' + action.entity.on;
        return 'Set ' + action.entity.name + ' to ' + action.entity.off;
    }

    return {
        shuffle: shuffle,
        sample: sample,
        getFactBatch: getFactBatch,
        getFactChoices: getFactChoices,
        getInterferenceWord: getInterferenceWord,
        getChain: getChain,
        getSequenceRound: getSequenceRound,
        getChunkChallenge: getChunkChallenge,
        getStackChallenge: getStackChallenge,
        describeAction: describeAction
    };

})();
