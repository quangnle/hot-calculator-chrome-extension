$(function(){
    var currentTab = 'normal';
    var scalarPlaceholder = 'e.g. sqrt(16), ln(100), 2^(3/4)';
    var storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) ? chrome.storage.sync : null;
    if (typeof math !== 'undefined' && math.import) {
        math.import({ ln: math.log });
    }

    function storageGet(keys, callback) {
        if (!storage) {
            callback({});
            return;
        }
        storage.get(keys, callback);
    }

    function storageSet(values) {
        if (!storage) return;
        storage.set(values);
    }

    storageGet(['expr', 'decimalPlaces', 'calcTab', 'matrixVars', 'matrixExpr'], function(v){
        $('#expression').val((v.expr || '').trim());
        $('#matrixVariables').val((v.matrixVars || '').trim());
        $('#matrixExpression').val((v.matrixExpr || '').trim());
        if (v.decimalPlaces !== undefined) $('#decimalPlaces').val(v.decimalPlaces);
        if (v.calcTab === 'bignum' || v.calcTab === 'matrix') {
            currentTab = v.calcTab;
        }
        setActiveTab(currentTab, false);
    });

    function reformatExpression(expr) {
        return expr.replace(/\s/g, '').replace(/,/g, '');
    }

    function formatResult(num, decimals) {
        if (typeof num !== 'number' || isNaN(num)) return String(num);
        var factor = Math.pow(10, decimals);
        var rounded = Math.round(num * factor) / factor;
        var parts = rounded.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    function formatPlainNumber(num, decimals) {
        if (typeof num !== 'number' || isNaN(num)) return String(num);
        var factor = Math.pow(10, decimals);
        var rounded = Math.round(num * factor) / factor;
        return rounded.toString();
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function clearResult() {
        $('#result').html('Result').addClass('empty').data('value', '');
    }

    function setTextResult(text, copyValue) {
        $('#result').text(text).removeClass('empty');
        $('#result').data('value', copyValue || text);
    }

    function setHtmlResult(html, copyValue) {
        $('#result').html(html).removeClass('empty');
        $('#result').data('value', copyValue || '');
    }

    function setErrorResult(message) {
        setHtmlResult('<div class="result-error">' + escapeHtml(message) + '</div>', '');
    }

    function setActiveTab(tab, persist) {
        currentTab = tab;
        $('.tab-btn').removeClass('active');
        $('.tab-btn[data-tab="' + tab + '"]').addClass('active');

        var isMatrix = tab === 'matrix';
        $('#scalarPanel').toggleClass('hidden', isMatrix);
        $('#matrixPanel').toggleClass('hidden', !isMatrix);
        $('#btnIsPrime').toggleClass('hidden', isMatrix);
        $('#expression').attr('placeholder', scalarPlaceholder);
        clearResult();

        if (persist !== false) {
            storageSet({ calcTab: tab });
        }
    }

    function normalizeMatrixLiteral(literal) {
        var content = literal.substring(1, literal.length - 1);
        var rows = content.split(';').map(function(row){
            var tokens = row.trim().split(/\s+/).filter(Boolean);
            return tokens.join(', ');
        }).filter(function(row){
            return row.length > 0;
        });
        return '[' + rows.join('; ') + ']';
    }

    function rewriteMatrixSyntax(input) {
        if (!input) return '';

        var rewritten = input.replace(/\[[^\[\]]*\]/g, function(match){
            return normalizeMatrixLiteral(match);
        });

        rewritten = rewritten.replace(/\b([A-Za-z_]\w*)\s*\^\s*\{\s*-1\s*\}/g, 'inv($1)');
        rewritten = rewritten.replace(/\b([A-Za-z_]\w*)\s*\^\s*\(\s*-1\s*\)/g, 'inv($1)');
        rewritten = rewritten.replace(/\b([A-Za-z_]\w*)\s*\^\s*-1\b/g, 'inv($1)');
        rewritten = rewritten.replace(/\b([A-Za-z_]\w*)\s*\^\s*\{\s*T\s*\}/g, 'transpose($1)');
        rewritten = rewritten.replace(/\b([A-Za-z_]\w*)\s*\^\s*T\b/g, 'transpose($1)');
        return rewritten;
    }

    function valueToData(value) {
        if (value && typeof value.valueOf === 'function') {
            return value.valueOf();
        }
        return value;
    }

    function isMatrixValue(value) {
        var data = valueToData(value);
        return Array.isArray(data) && Array.isArray(data[0]);
    }

    function scalarToPlain(value, decimals) {
        if (typeof value === 'number') return formatPlainNumber(value, decimals);
        if (value && typeof value.toString === 'function') return value.toString();
        return String(value);
    }

    function scalarToLatex(value, decimals) {
        return scalarToPlain(value, decimals).replace(/,/g, '');
    }

    function matrixToLatex(value, decimals) {
        var data = valueToData(value);
        var rows = data.map(function(row){
            return row.map(function(cell){
                return scalarToLatex(cell, decimals);
            }).join(' & ');
        }).join(' \\\\ ');
        return '\\begin{bmatrix}' + rows + '\\end{bmatrix}';
    }

    function valueToLatex(value, decimals) {
        return isMatrixValue(value) ? matrixToLatex(value, decimals) : scalarToLatex(value, decimals);
    }

    function matrixToPlainText(value, decimals) {
        var data = valueToData(value);
        var rows = data.map(function(row){
            return row.map(function(cell){
                return scalarToPlain(cell, decimals);
            }).join(' ');
        });
        return '[' + rows.join('; ') + ']';
    }

    function valueToCopyText(value, decimals) {
        if (isMatrixValue(value)) return matrixToPlainText(value, decimals);
        if (typeof value === 'number') return formatResult(value, decimals);
        if (value && typeof value.toString === 'function') return value.toString();
        return String(value);
    }

    function renderKatexBlock(tex) {
        try {
            return '<div class="result-block">' + katex.renderToString(tex, {
                displayMode: true,
                throwOnError: false,
                strict: 'ignore'
            }) + '</div>';
        } catch (e) {
            return '<div class="result-error">' + escapeHtml(tex) + '</div>';
        }
    }

    function extractReferencedVariables(expr, scope) {
        var excluded = { inv: true, transpose: true };
        var seen = {};
        var names = [];
        var matches = expr.match(/[A-Za-z_]\w*/g) || [];

        matches.forEach(function(name){
            if (excluded[name] || seen[name] || !Object.prototype.hasOwnProperty.call(scope, name)) return;
            seen[name] = true;
            names.push(name);
        });

        return names;
    }

    function parseMatrixAssignments(raw, scope) {
        var definitions = [];
        var lines = raw.split(/\r?\n/);

        lines.forEach(function(line, index){
            var trimmed = line.trim();
            var match;
            var transformed;
            var value;

            if (!trimmed) return;
            match = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
            if (!match) {
                throw new Error('Invalid assignment on line ' + (index + 1) + '. Use NAME=[...]');
            }

            transformed = rewriteMatrixSyntax(match[2]);
            value = math.evaluate(transformed, scope);
            scope[match[1]] = value;
            definitions.push({
                name: match[1],
                value: value
            });
        });

        return definitions;
    }

    function buildMatrixCopyText(definitions, expressionLatex, result, decimals) {
        var lines = definitions.map(function(def){
            return def.name + ' = ' + valueToCopyText(def.value, decimals);
        });

        lines.push('C = ' + valueToCopyText(result, decimals));
        lines.push('Expression = ' + expressionLatex);
        return lines.join('\n');
    }

    function renderMatrixResult(definitions, expressionTex, result, decimals) {
        var blocks = definitions.map(function(def){
            return renderKatexBlock(def.name + ' = ' + valueToLatex(def.value, decimals));
        });

        blocks.push(renderKatexBlock('C = ' + expressionTex + ' = ' + valueToLatex(result, decimals)));

        setHtmlResult(blocks.join(''), buildMatrixCopyText(definitions, expressionTex, result, decimals));
    }

    function calculateNormal() {
        var rawExpr = $('#expression').val();
        var expr = reformatExpression(rawExpr);
        var decimals = parseInt($('#decimalPlaces').val(), 10);
        try {
            var result = math.evaluate(expr);
            var formatted = formatResult(result, decimals);
            setTextResult(formatted, formatted);
            storageSet({ expr: rawExpr, decimalPlaces: decimals });
        } catch (e) {
            setTextResult('Error: ' + e.message, '');
        }
    }



    function calculateBigNumber() {
        var rawExpr = $('#expression').val();
        var expr = reformatExpression(rawExpr);
        var decimals = parseInt($('#decimalPlaces').val(), 10);
        try {
            var result = window.BigNumber.evaluate(expr, decimals);
            var formatted = window.BigNumber.formatWithCommas(result);
            setTextResult(formatted, formatted);
            storageSet({ expr: rawExpr, decimalPlaces: decimals });
        } catch (e) {
            setTextResult('Error: ' + e.message, '');
        }
    }

    function calculateMatrix() {
        var rawVars = $('#matrixVariables').val();
        var rawExpr = $('#matrixExpression').val();
        var decimals = parseInt($('#decimalPlaces').val(), 10);
        var scope = {};
        var definitions;
        var transformedExpr;
        var referencedNames;
        var visibleDefinitions;
        var result;
        var expressionTex;

        if (!rawExpr || !rawExpr.trim()) {
            setErrorResult('Error: Enter a matrix expression');
            return;
        }

        try {
            definitions = parseMatrixAssignments(rawVars || '', scope);
            transformedExpr = rewriteMatrixSyntax(rawExpr.trim());
            result = math.evaluate(transformedExpr, scope);
            expressionTex = math.parse(transformedExpr).toTex({ parenthesis: 'auto' });
            referencedNames = extractReferencedVariables(transformedExpr, scope);
            visibleDefinitions = definitions.filter(function(def){
                return referencedNames.indexOf(def.name) >= 0;
            });

            if (!visibleDefinitions.length) {
                visibleDefinitions = definitions;
            }

            renderMatrixResult(visibleDefinitions, expressionTex, result, decimals);
            storageSet({ matrixVars: rawVars, matrixExpr: rawExpr, decimalPlaces: decimals });
        } catch (e) {
            setErrorResult('Error: ' + e.message);
        }
    }

    function showLoading() {
        $('#loadingOverlay').removeClass('hidden');
    }

    function hideLoading() {
        $('#loadingOverlay').addClass('hidden');
    }

    function calculate() {
        showLoading();
        setTimeout(function(){
            try {
                if (currentTab === 'bignum') calculateBigNumber();
                else if (currentTab === 'matrix') calculateMatrix();
                else calculateNormal();
            } finally {
                hideLoading();
            }
        }, 0);
    }

    function toIntegerString(val) {
        var str;
        if (val && typeof val.toString === 'function') {
            str = val.toString();
        } else {
            str = String(val);
        }
        str = str.replace(/,/g, '').trim();
        if (str.charAt(0) === '-') str = str.substring(1);
        var dot = str.indexOf('.');
        if (dot >= 0) str = str.substring(0, dot);
        if (str.indexOf('e') >= 0 || str.indexOf('E') >= 0) return null;
        if (!/^\d+$/.test(str)) return null;
        return str;
    }

    function getValueToCheck() {
        if (currentTab === 'matrix') return null;
        var rawExpr = $('#expression').val();
        if (!rawExpr || !rawExpr.trim()) return null;
        var expr = reformatExpression(rawExpr);
        if (/^\d+$/.test(expr)) return expr;
        var decimals = parseInt($('#decimalPlaces').val(), 10);
        try {
            var result;
            if (currentTab === 'bignum') {
                result = window.BigNumber.evaluate(expr, decimals);
            } else {
                result = math.evaluate(expr);
            }
            return toIntegerString(result);
        } catch (e) {
            return null;
        }
    }

    function checkPrime() {
        var intStr = getValueToCheck();
        if (!intStr || !window.BigNumber || !window.BigNumber.isPrime) {
            setTextResult('Error: Enter a positive integer', '');
            return;
        }
        showLoading();
        setTimeout(function(){
            try {
                var r = window.BigNumber.isPrime(intStr);
                var text = r.prime ? 'True' : 'False';
                if (r.millerRabin) text += ' (Miller-Rabin)';
                setTextResult(text, text);
            } catch (e) {
                setTextResult('Error: ' + e.message, '');
            } finally {
                hideLoading();
            }
        }, 0);
    }

    $('.tab-btn').click(function(){
        var tab = $(this).data('tab');
        setActiveTab(tab, true);
    });

    $('#btnCalculate').click(calculate);
    $('#btnMatrixCalculate').click(calculate);
    $('#btnIsPrime').click(checkPrime);

    $('#expression').keydown(function(e){
        if (e.key === 'Enter') {
            e.preventDefault();
            calculate();
        }
    });

    $('#matrixVariables, #matrixExpression').keydown(function(e){
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            calculate();
        }
    });

    $('#btnCopy').click(function(){
        var value = $('#result').data('value') || $('#result').text();
        if (!value || value.indexOf('Error') === 0 || value === 'Result') return;
        navigator.clipboard.writeText(value).then(function(){
            var $btn = $('#btnCopy');
            $btn.addClass('copied');
            setTimeout(function(){ $btn.removeClass('copied'); }, 1500);
        });
    });

    $('#decimalPlaces').change(function(){
        storageSet({ decimalPlaces: $(this).val() });
    });
});
