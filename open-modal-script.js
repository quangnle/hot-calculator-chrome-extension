(function() {
    var green = '#00ff41';
    var darkBg = 'rgba(10, 14, 20, 0.98)';
    var borderGreen = 'rgba(0, 255, 65, 0.4)';

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

    var bigmath = (typeof math !== 'undefined' && math.create) ? math.create({ number: 'BigNumber', precision: 500 }) : null;
    if (typeof math !== 'undefined' && math.import) {
        math.import({ ln: math.log });
        if (bigmath) bigmath.import({ ln: bigmath.log });
    }

    function formatBigNumberResult(result, decimals) {
        var str;
        var roundFn = bigmath ? bigmath.round : (typeof math !== 'undefined' && math.round ? math.round : null);
        if (roundFn && result && typeof result.toNumber === 'function') {
            str = roundFn(result, decimals).toString();
        } else if (result && typeof result.toString === 'function') {
            str = result.toString();
        } else {
            str = String(result);
        }
        var sign = '';
        if (str.charAt(0) === '-') { sign = '-'; str = str.substring(1); }
        var parts = str.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return sign + parts.join('.');
    }

    function showModal(selectionText) {
        var modal = document.createElement("div");
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:2147483647;font-family:"Share Tech Mono",Consolas,monospace';

        var box = document.createElement("div");
        box.style.cssText = 'position:relative;background:' + darkBg + ';border:1px solid ' + borderGreen + ';border-radius:8px;padding:20px;min-width:480px;box-shadow:0 0 30px rgba(0,255,65,0.2)';

        var loadingOverlay = document.createElement("div");
        loadingOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(10,14,20,0.9);border-radius:8px;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px';
        var loadingSpinner = document.createElement("div");
        loadingSpinner.style.cssText = 'width:28px;height:28px;border:3px solid rgba(0,255,65,0.2);border-top-color:' + green + ';border-radius:50%;animation:hcSpin 0.8s linear infinite';
        var loadingText = document.createElement("span");
        loadingText.textContent = 'Processing...';
        loadingText.style.cssText = 'font-size:0.8rem;color:' + green;
        loadingOverlay.appendChild(loadingSpinner);
        loadingOverlay.appendChild(loadingText);
        var styleEl = document.createElement("style");
        styleEl.textContent = '@keyframes hcSpin{to{transform:rotate(360deg)}}';
        (document.head || document.documentElement).appendChild(styleEl);

        function showLoading() { loadingOverlay.style.display = 'flex'; }
        function hideLoading() { loadingOverlay.style.display = 'none'; }

        var header = document.createElement("div");
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:' + green;
        var title = document.createElement("span");
        title.textContent = "HOT CALCULATOR";
        title.style.cssText = 'font-weight:bold;letter-spacing:0.1em;font-size:0.9rem';
        header.appendChild(title);

        var closeButton = document.createElement("button");
        closeButton.textContent = "×";
        closeButton.style.cssText = 'padding:4px 12px;border:1px solid ' + borderGreen + ';background:transparent;color:' + green + ';cursor:pointer;border-radius:4px;font-size:1.2rem;line-height:1';
        closeButton.onclick = function() { document.body.removeChild(modal); };
        header.appendChild(closeButton);

        var inputRow = document.createElement("div");
        inputRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
        var input = document.createElement("input");
        input.type = "text";
        input.value = (selectionText || '').trim().replace(/\s+/g, ' ');
        input.placeholder = "e.g. sqrt(16), ln(100), 2^(3/4)";
        input.style.cssText = 'flex:1;min-width:0;padding:10px;background:rgba(0,20,10,0.8);border:1px solid ' + borderGreen + ';border-radius:4px;color:' + green + ';font-family:inherit;font-size:0.95rem;outline:none';
        var equalsButton = document.createElement("button");
        equalsButton.textContent = "=";
        equalsButton.style.cssText = 'padding:10px 18px;border:1px solid ' + green + ';background:rgba(0,255,65,0.15);color:' + green + ';cursor:pointer;border-radius:4px;font-weight:bold;min-width:48px';
        inputRow.appendChild(input);
        inputRow.appendChild(equalsButton);

        var optionsRow = document.createElement("div");
        optionsRow.style.cssText = 'margin-bottom:12px;font-size:0.8rem;color:' + green + ';display:flex;flex-wrap:wrap;align-items:center;gap:12px';
        var modeLabel = document.createElement("label");
        modeLabel.style.cssText = 'margin-right:12px';
        modeLabel.innerHTML = 'Big Number: ';
        var modeCheck = document.createElement("input");
        modeCheck.type = 'checkbox';
        modeCheck.style.cssText = 'margin-right:4px;cursor:pointer';
        modeLabel.appendChild(modeCheck);
        optionsRow.appendChild(modeLabel);
        var decLabel = document.createElement("label");
        decLabel.innerHTML = 'Decimal places: ';
        var decSelect = document.createElement("select");
        decSelect.style.cssText = 'margin-left:8px;padding:4px 8px;background:rgba(0,20,10,0.8);border:1px solid ' + borderGreen + ';border-radius:4px;color:' + green + ';font-family:inherit;cursor:pointer';
        [0,1,2,3,4,8,16,20].forEach(function(n){
            var opt = document.createElement("option");
            opt.value = n;
            opt.textContent = n;
            if (n === 2) opt.selected = true;
            decSelect.appendChild(opt);
        });
        decLabel.appendChild(decSelect);
        optionsRow.appendChild(decLabel);

        var hintRow = document.createElement("div");
        hintRow.style.cssText = 'font-size:0.7rem;color:rgba(0,255,65,0.6);margin-bottom:10px;line-height:1.4';
        hintRow.textContent = 'sqrt(x) ln(x) log10(x) log(x,base) x^(a/b)';

        modeCheck.onchange = function() {
            hintRow.style.display = 'block';
            input.placeholder = 'e.g. sqrt(16), ln(100), 2^(3/4)';
        };

        var resultRow = document.createElement("div");
        resultRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px;background:rgba(0,15,8,0.6);border:1px solid rgba(0,255,65,0.25);border-radius:4px;margin-bottom:12px';
        var resultLabel = document.createElement("p");
        resultLabel.textContent = "Result";
        resultLabel.style.cssText = 'flex:1;margin:0;color:rgba(0,255,65,0.7);font-style:italic';

        var primeBtn = document.createElement("button");
        primeBtn.textContent = "is Prime?";
        primeBtn.title = "Check if prime";
        primeBtn.style.cssText = 'padding:6px 10px;font-size:0.75rem;border:1px solid ' + borderGreen + ';background:transparent;color:' + green + ';cursor:pointer;border-radius:4px;white-space:nowrap';

        var copyBtn = document.createElement("button");
        copyBtn.title = "Copy result";
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5"/></svg>';
        copyBtn.style.cssText = 'padding:8px 10px;border:1px solid ' + borderGreen + ';background:transparent;color:' + green + ';cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center';
        resultRow.appendChild(resultLabel);
        resultRow.appendChild(primeBtn);
        resultRow.appendChild(copyBtn);

        var lastResult = '';

        function toIntegerString(val) {
            var str;
            if (val && typeof val.toString === 'function') str = val.toString();
            else str = String(val);
            str = str.replace(/,/g, '').trim();
            if (str.charAt(0) === '-') str = str.substring(1);
            var dot = str.indexOf('.');
            if (dot >= 0) str = str.substring(0, dot);
            if (str.indexOf('e') >= 0 || str.indexOf('E') >= 0) return null;
            if (!/^\d+$/.test(str)) return null;
            return str;
        }

        function getValueToCheck() {
            var rawExpr = input.value;
            if (!rawExpr || !rawExpr.trim()) return null;
            var expr = reformatExpression(rawExpr);
            if (/^\d+$/.test(expr)) return expr;
            var decimals = parseInt(decSelect.value, 10);
            try {
                var result;
                if (modeCheck.checked && bigmath) {
                    result = bigmath.evaluate(expr);
                } else if (modeCheck.checked && typeof math !== 'undefined' && math.config) {
                    var prev = math.config();
                    math.config({ number: 'BigNumber', precision: 500 });
                    try { result = math.evaluate(expr); } finally { math.config(prev); }
                } else if (modeCheck.checked && typeof window.BigNumber !== 'undefined') {
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
                resultLabel.textContent = 'Error: Enter a positive integer';
                resultLabel.style.color = '#ff4444';
                lastResult = '';
                return;
            }
            showLoading();
            setTimeout(function(){
            try {
                var r = window.BigNumber.isPrime(intStr);
                var text = r.prime ? 'True' : 'False';
                if (r.millerRabin) text += ' (Miller-Rabin)';
                resultLabel.textContent = text;
                resultLabel.style.color = green;
                resultLabel.style.fontStyle = 'normal';
                lastResult = text;
            } catch (e) {
                resultLabel.textContent = 'Error: ' + e.message;
                resultLabel.style.color = '#ff4444';
                lastResult = '';
            }
            finally { hideLoading(); }
            }, 0);
        }

        primeBtn.onclick = checkPrime;

        function doCalculate() {
            showLoading();
            setTimeout(function(){
            try {
                var rawExpr = input.value;
                var expr = reformatExpression(rawExpr);
                var decimals = parseInt(decSelect.value, 10);
                var result, formatted;
                if (modeCheck.checked && bigmath) {
                    result = bigmath.evaluate(expr);
                    formatted = formatBigNumberResult(result, decimals);
                } else if (modeCheck.checked && typeof math !== 'undefined' && math.config) {
                    var prev = math.config();
                    math.config({ number: 'BigNumber', precision: 500 });
                    try {
                        result = math.evaluate(expr);
                        formatted = formatBigNumberResult(result, decimals);
                    } finally {
                        math.config(prev);
                    }
                } else if (modeCheck.checked && typeof window.BigNumber !== 'undefined') {
                    result = window.BigNumber.evaluate(expr, decimals);
                    formatted = window.BigNumber.formatWithCommas(result);
                } else {
                    result = math.evaluate(expr);
                    formatted = formatResult(result, decimals);
                }
                resultLabel.textContent = formatted;
                resultLabel.style.color = green;
                resultLabel.style.fontStyle = 'normal';
                lastResult = formatted;
            } catch (e) {
                resultLabel.textContent = "Error: " + e.message;
                resultLabel.style.color = '#ff4444';
                lastResult = '';
            }
            finally { hideLoading(); }
            }, 0);
        }

        equalsButton.onclick = doCalculate;
        input.onkeydown = function(e) {
            if (e.key === 'Enter') { e.preventDefault(); doCalculate(); }
        };

        var checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        copyBtn.onclick = function() {
            if (!lastResult) return;
            navigator.clipboard.writeText(lastResult).then(function(){
                copyBtn.innerHTML = checkSvg;
                copyBtn.classList.add('copied');
                setTimeout(function(){ copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5"/></svg>'; copyBtn.classList.remove('copied'); }, 1500);
            });
        };

        box.appendChild(loadingOverlay);
        box.appendChild(header);
        box.appendChild(inputRow);
        box.appendChild(optionsRow);
        box.appendChild(hintRow);
        box.appendChild(resultRow);
        modal.appendChild(box);
        document.body.appendChild(modal);
        input.focus();
    }

    chrome.storage.sync.get(['expr'], function(v){
        showModal(v.expr || '');
    });
})();
