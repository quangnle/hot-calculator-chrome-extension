$(function(){
    var currentTab = 'normal';
    if (typeof math !== 'undefined' && math.import) {
        math.import({ ln: math.log });
    }

    chrome.storage.sync.get(['expr', 'decimalPlaces', 'calcTab'], function(v){
        $('#expression').val((v.expr || '').trim());
        if (v.decimalPlaces !== undefined) $('#decimalPlaces').val(v.decimalPlaces);
        if (v.calcTab === 'bignum') {
            currentTab = 'bignum';
            $('.tab-btn[data-tab="bignum"]').addClass('active');
            $('.tab-btn[data-tab="normal"]').removeClass('active');
        }
        $('#expression').attr('placeholder', 'e.g. sqrt(16), ln(100), 2^(3/4)');
        $('#syntaxHint').removeClass('hidden');
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

    function calculateNormal() {
        var rawExpr = $('#expression').val();
        var expr = reformatExpression(rawExpr);
        var decimals = parseInt($('#decimalPlaces').val(), 10);
        try {
            var result = math.evaluate(expr);
            var formatted = formatResult(result, decimals);
            $('#result').text(formatted).removeClass('empty');
            $('#result').data('value', formatted);
            chrome.storage.sync.set({ expr: rawExpr, decimalPlaces: decimals });
        } catch (e) {
            $('#result').text('Error: ' + e.message).removeClass('empty');
            $('#result').data('value', '');
        }
    }



    function calculateBigNumber() {
        var rawExpr = $('#expression').val();
        var expr = reformatExpression(rawExpr);
        var decimals = parseInt($('#decimalPlaces').val(), 10);
        try {
            var result = window.BigNumber.evaluate(expr, decimals);
            var formatted = window.BigNumber.formatWithCommas(result);
            $('#result').text(formatted).removeClass('empty');
            $('#result').data('value', formatted);
            chrome.storage.sync.set({ expr: rawExpr, decimalPlaces: decimals });
        } catch (e) {
            $('#result').text('Error: ' + e.message).removeClass('empty');
            $('#result').data('value', '');
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
            $('#result').text('Error: Enter a positive integer').removeClass('empty');
            $('#result').data('value', '');
            return;
        }
        showLoading();
        setTimeout(function(){
            try {
                var r = window.BigNumber.isPrime(intStr);
                var text = r.prime ? 'True' : 'False';
                if (r.millerRabin) text += ' (Miller-Rabin)';
                $('#result').text(text).removeClass('empty');
                $('#result').data('value', text);
            } catch (e) {
                $('#result').text('Error: ' + e.message).removeClass('empty');
                $('#result').data('value', '');
            } finally {
                hideLoading();
            }
        }, 0);
    }

    $('.tab-btn').click(function(){
        var tab = $(this).data('tab');
        currentTab = tab;
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        chrome.storage.sync.set({ calcTab: tab });
        $('#result').text('Result').addClass('empty').data('value', '');
        $('#expression').attr('placeholder', 'e.g. sqrt(16), ln(100), 2^(3/4)');
        $('#syntaxHint').removeClass('hidden');
    });

    $('#btnCalculate').click(calculate);
    $('#btnIsPrime').click(checkPrime);

    $('#expression').keydown(function(e){
        if (e.key === 'Enter') {
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
        chrome.storage.sync.set({ decimalPlaces: $(this).val() });
    });
});
