$(function(){
    var currentTab = 'normal';
    var scalarPlaceholder = 'e.g. sqrt(16), ln(100), 2^(3/4)';
    var MATRIX_EPSILON = 1e-10;
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
            if (!tokens.length) return '';
            return '[' + tokens.join(', ') + ']';
        }).filter(function(row){
            return row.length > 0;
        });
        return '[' + rows.join(', ') + ']';
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

    function normalizeMatrixData(value) {
        var data = valueToData(value);

        if (!Array.isArray(data)) return null;
        if (!data.length) return [];
        if (Array.isArray(data[0])) return data;
        return [data];
    }

    function isMatrixValue(value) {
        return normalizeMatrixData(value) !== null;
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
        var data = normalizeMatrixData(value);
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
        var data = normalizeMatrixData(value);
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

    function cloneMatrixData(data) {
        return data.map(function(row){
            return row.slice();
        });
    }

    function roundNearZero(value) {
        return Math.abs(value) < MATRIX_EPSILON ? 0 : value;
    }

    function formatSignedNumber(value, decimals) {
        var absText = scalarToLatex(Math.abs(value), decimals);
        return value < 0 ? '- ' + absText : '+ ' + absText;
    }

    function normalizeNumericMatrix(value) {
        var data = normalizeMatrixData(value);
        var width;

        if (data === null) {
            throw new Error('Expected a matrix value');
        }

        if (!data.length) {
            return [];
        }

        width = data[0].length;
        return data.map(function(row, rowIndex){
            if (!Array.isArray(row) || row.length !== width) {
                throw new Error('Matrix rows must all have the same length');
            }

            return row.map(function(cell, columnIndex){
                var numeric = cell;

                if (numeric && typeof numeric.valueOf === 'function') {
                    numeric = numeric.valueOf();
                }
                if (typeof numeric !== 'number' || !isFinite(numeric)) {
                    throw new Error('Matrix entry at row ' + (rowIndex + 1) + ', column ' + (columnIndex + 1) + ' must be a finite number');
                }
                return roundNearZero(numeric);
            });
        });
    }

    function isZeroRow(row) {
        return row.every(function(value){
            return Math.abs(value) < MATRIX_EPSILON;
        });
    }

    function matrixFromData(data) {
        return cloneMatrixData(data);
    }

    function vectorToLatex(vector, decimals, orientation) {
        if (orientation === 'row') {
            return '\\begin{bmatrix}' + vector.map(function(entry){
                return scalarToLatex(entry, decimals);
            }).join(' & ') + '\\end{bmatrix}';
        }

        return '\\begin{bmatrix}' + vector.map(function(entry){
            return scalarToLatex(entry, decimals);
        }).join(' \\\\ ') + '\\end{bmatrix}';
    }

    function vectorToPlainText(vector) {
        return '[' + vector.join('; ') + ']';
    }

    function rowVectorToPlainText(vector) {
        return '[' + vector.join(' ') + ']';
    }

    function spanToLatex(vectors, decimals, orientation) {
        if (!vectors.length) {
            return '\\{\\mathbf{0}\\}';
        }

        return '\\operatorname{span}\\left\\{' + vectors.map(function(vector){
            return vectorToLatex(vector, decimals, orientation);
        }).join(',\\;') + '\\right\\}';
    }

    function spanToPlainText(vectors, decimals, orientation) {
        if (!vectors.length) {
            return '{0}';
        }

        return 'span{' + vectors.map(function(vector){
            return orientation === 'row'
                ? rowVectorToPlainText(vector.map(function(entry){ return scalarToPlain(entry, decimals); }))
                : vectorToPlainText(vector.map(function(entry){ return scalarToPlain(entry, decimals); }));
        }).join(', ') + '}';
    }

    function matrixOperationToLatex(step, decimals) {
        var target = 'R_{' + (step.target + 1) + '}';
        var source = 'R_{' + (step.source + 1) + '}';

        if (step.type === 'swap') {
            return target + ' \\leftrightarrow ' + source;
        }
        if (step.type === 'scale') {
            return target + ' \\leftarrow ' + scalarToLatex(step.factor, decimals) + target;
        }
        if (step.type === 'combine') {
            return target + ' \\leftarrow ' + target + ' ' + formatSignedNumber(step.factor, decimals) + source;
        }
        return '';
    }

    function matrixOperationToPlainText(step, decimals) {
        var target = 'R' + (step.target + 1);
        var source = 'R' + (step.source + 1);

        if (step.type === 'swap') {
            return target + ' <-> ' + source;
        }
        if (step.type === 'scale') {
            return target + ' <- ' + scalarToPlain(step.factor, decimals) + '*' + target;
        }
        if (step.type === 'combine') {
            return target + ' <- ' + target + ' ' + formatSignedNumber(step.factor, decimals).replace(/\\s+/g, ' ') + ' ' + source;
        }
        return '';
    }

    function reduceToRref(matrixData) {
        var data = cloneMatrixData(matrixData);
        var rowCount = data.length;
        var colCount = rowCount ? data[0].length : 0;
        var pivotColumns = [];
        var steps = [{ type: 'start', matrix: cloneMatrixData(data) }];
        var lead = 0;
        var rowIndex;

        for (rowIndex = 0; rowIndex < rowCount && lead < colCount; rowIndex++) {
            var pivotRow = rowIndex;

            while (pivotRow < rowCount && Math.abs(data[pivotRow][lead]) < MATRIX_EPSILON) {
                pivotRow += 1;
            }

            while (pivotRow === rowCount) {
                lead += 1;
                if (lead >= colCount) {
                    return {
                        matrix: data.map(function(row){
                            return row.map(roundNearZero);
                        }),
                        pivotColumns: pivotColumns,
                        steps: steps
                    };
                }
                pivotRow = rowIndex;
                while (pivotRow < rowCount && Math.abs(data[pivotRow][lead]) < MATRIX_EPSILON) {
                    pivotRow += 1;
                }
            }

            if (pivotRow !== rowIndex) {
                var swapped = data[rowIndex];
                data[rowIndex] = data[pivotRow];
                data[pivotRow] = swapped;
                steps.push({ type: 'swap', target: rowIndex, source: pivotRow, matrix: cloneMatrixData(data) });
            }

            if (Math.abs(data[rowIndex][lead] - 1) >= MATRIX_EPSILON) {
                var scaleFactor = 1 / data[rowIndex][lead];
                data[rowIndex] = data[rowIndex].map(function(value){
                    return roundNearZero(value * scaleFactor);
                });
                steps.push({ type: 'scale', target: rowIndex, factor: scaleFactor, matrix: cloneMatrixData(data) });
            }

            for (var otherRow = 0; otherRow < rowCount; otherRow++) {
                if (otherRow === rowIndex || Math.abs(data[otherRow][lead]) < MATRIX_EPSILON) continue;
                var factor = -data[otherRow][lead];
                data[otherRow] = data[otherRow].map(function(value, columnIndex){
                    return roundNearZero(value + factor * data[rowIndex][columnIndex]);
                });
                steps.push({ type: 'combine', target: otherRow, source: rowIndex, factor: factor, matrix: cloneMatrixData(data) });
            }

            pivotColumns.push(lead);
            lead += 1;
        }

        return {
            matrix: data.map(function(row){
                return row.map(roundNearZero);
            }),
            pivotColumns: pivotColumns,
            steps: steps
        };
    }

    function requireSquareMatrix(matrixData, label) {
        if (!matrixData.length) {
            throw new Error(label + ' requires a non-empty square matrix');
        }
        if (matrixData.length !== matrixData[0].length) {
            throw new Error(label + ' requires a square matrix');
        }
    }

    function identityMatrix(size) {
        return Array.from({ length: size }, function(_, rowIndex){
            return Array.from({ length: size }, function(__, columnIndex){
                return rowIndex === columnIndex ? 1 : 0;
            });
        });
    }

    function zeroMatrix(rowCount, colCount) {
        return Array.from({ length: rowCount }, function(){
            return Array(colCount).fill(0);
        });
    }

    function swapRows(matrixData, firstRow, secondRow) {
        var tempRow = matrixData[firstRow];
        matrixData[firstRow] = matrixData[secondRow];
        matrixData[secondRow] = tempRow;
    }

    function multiplyMatrices(left, right) {
        var rowCount = left.length;
        var innerSize = left[0] ? left[0].length : 0;
        var colCount = right[0] ? right[0].length : 0;
        var product = zeroMatrix(rowCount, colCount);

        for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            for (var colIndex = 0; colIndex < colCount; colIndex++) {
                var sum = 0;
                for (var innerIndex = 0; innerIndex < innerSize; innerIndex++) {
                    sum += left[rowIndex][innerIndex] * right[innerIndex][colIndex];
                }
                product[rowIndex][colIndex] = roundNearZero(sum);
            }
        }

        return product;
    }

    function decomposeLu(matrixData) {
        var size = matrixData.length;
        var permutation = identityMatrix(size);
        var lower = identityMatrix(size);
        var upper = cloneMatrixData(matrixData);
        var steps = [];

        requireSquareMatrix(matrixData, 'lu');

        for (var pivotIndex = 0; pivotIndex < size; pivotIndex++) {
            var pivotRow = pivotIndex;
            var lowerEntries = [];
            var pivotValue = Math.abs(upper[pivotIndex][pivotIndex]);

            for (var candidateRow = pivotIndex + 1; candidateRow < size; candidateRow++) {
                var candidateValue = Math.abs(upper[candidateRow][pivotIndex]);
                if (candidateValue > pivotValue) {
                    pivotValue = candidateValue;
                    pivotRow = candidateRow;
                }
            }

            if (pivotValue < MATRIX_EPSILON) {
                throw new Error('PA=LU is not available because the matrix is singular at pivot column ' + (pivotIndex + 1));
            }

            if (pivotRow !== pivotIndex) {
                swapRows(upper, pivotIndex, pivotRow);
                swapRows(permutation, pivotIndex, pivotRow);
                for (var lowerSwapIndex = 0; lowerSwapIndex < pivotIndex; lowerSwapIndex++) {
                    var lowerTemp = lower[pivotIndex][lowerSwapIndex];
                    lower[pivotIndex][lowerSwapIndex] = lower[pivotRow][lowerSwapIndex];
                    lower[pivotRow][lowerSwapIndex] = lowerTemp;
                }
            }

            for (var rowIndex = pivotIndex + 1; rowIndex < size; rowIndex++) {
                lower[rowIndex][pivotIndex] = roundNearZero(upper[rowIndex][pivotIndex] / upper[pivotIndex][pivotIndex]);
                lowerEntries.push({ row: rowIndex, col: pivotIndex, value: lower[rowIndex][pivotIndex] });
                for (var colIndex = pivotIndex; colIndex < size; colIndex++) {
                    upper[rowIndex][colIndex] = roundNearZero(upper[rowIndex][colIndex] - lower[rowIndex][pivotIndex] * upper[pivotIndex][colIndex]);
                }
            }

            steps.push({
                pivot: pivotIndex,
                pivotRow: pivotRow,
                pivotValue: roundNearZero(upper[pivotIndex][pivotIndex]),
                lowerEntries: lowerEntries,
                permutation: cloneMatrixData(permutation),
                lower: cloneMatrixData(lower),
                upper: cloneMatrixData(upper)
            });
        }

        return {
            permutation: permutation,
            lower: lower,
            upper: upper,
            steps: steps,
            product: multiplyMatrices(lower, upper),
            permutedOriginal: multiplyMatrices(permutation, matrixData)
        };
    }

    function formatEntryListLatex(entries, symbol, decimals) {
        if (!entries.length) return '\\varnothing';
        return entries.map(function(entry){
            return symbol + '_{' + (entry.row + 1) + ',' + (entry.col + 1) + '}=' + scalarToLatex(entry.value, decimals);
        }).join(',\\;');
    }

    function formatEntryListPlain(entries, symbol, decimals) {
        if (!entries.length) return 'none';
        return entries.map(function(entry){
            return symbol + '(' + (entry.row + 1) + ',' + (entry.col + 1) + ')=' + scalarToPlain(entry.value, decimals);
        }).join(', ');
    }

    function isComplexValue(value) {
        return !!(value && typeof value === 'object' && value.mathjs === 'Complex');
    }

    function normalizeComputedScalar(value) {
        if (typeof value === 'number') {
            return roundNearZero(value);
        }

        if (isComplexValue(value)) {
            var realPart = roundNearZero(value.re);
            var imaginaryPart = roundNearZero(value.im);

            if (imaginaryPart === 0) {
                return realPart;
            }

            return math.complex(realPart, imaginaryPart);
        }

        return value;
    }

    function scalarMagnitude(value) {
        if (typeof value === 'number') {
            return Math.abs(value);
        }

        if (isComplexValue(value)) {
            return math.abs(value);
        }

        return Math.abs(Number(value));
    }

    function isScalarZero(value) {
        return scalarMagnitude(value) < MATRIX_EPSILON;
    }

    function normalizeComputedMatrix(value) {
        var data = normalizeMatrixData(value);
        var width;

        if (data === null) {
            throw new Error('Expected a matrix value');
        }

        if (!data.length) {
            return [];
        }

        width = data[0].length;
        return data.map(function(row){
            if (!Array.isArray(row) || row.length !== width) {
                throw new Error('Matrix rows must all have the same length');
            }

            return row.map(function(cell){
                var scalar = cell;

                if (scalar && typeof scalar.valueOf === 'function') {
                    scalar = scalar.valueOf();
                }

                return normalizeComputedScalar(scalar);
            });
        });
    }

    function cloneAnyMatrixData(data) {
        return data.map(function(row){
            return row.slice();
        });
    }

    function subtractLambdaIdentity(matrixData, lambda) {
        return matrixData.map(function(row, rowIndex){
            return row.map(function(value, columnIndex){
                if (rowIndex !== columnIndex) {
                    return normalizeComputedScalar(value);
                }

                return normalizeComputedScalar(math.subtract(value, lambda));
            });
        });
    }

    function reduceToRrefGeneric(matrixData) {
        var data = cloneAnyMatrixData(matrixData);
        var rowCount = data.length;
        var colCount = rowCount ? data[0].length : 0;
        var pivotColumns = [];
        var lead = 0;
        var rowIndex;

        for (rowIndex = 0; rowIndex < rowCount && lead < colCount; rowIndex++) {
            var pivotRow = rowIndex;

            while (pivotRow < rowCount && isScalarZero(data[pivotRow][lead])) {
                pivotRow += 1;
            }

            while (pivotRow === rowCount) {
                lead += 1;
                if (lead >= colCount) {
                    return {
                        matrix: data.map(function(row){
                            return row.map(normalizeComputedScalar);
                        }),
                        pivotColumns: pivotColumns
                    };
                }
                pivotRow = rowIndex;
                while (pivotRow < rowCount && isScalarZero(data[pivotRow][lead])) {
                    pivotRow += 1;
                }
            }

            if (pivotRow !== rowIndex) {
                swapRows(data, rowIndex, pivotRow);
            }

            if (!isScalarZero(math.subtract(data[rowIndex][lead], 1))) {
                var pivotScale = math.divide(1, data[rowIndex][lead]);
                data[rowIndex] = data[rowIndex].map(function(value){
                    return normalizeComputedScalar(math.multiply(value, pivotScale));
                });
            }

            for (var otherRow = 0; otherRow < rowCount; otherRow++) {
                if (otherRow === rowIndex || isScalarZero(data[otherRow][lead])) continue;

                var eliminationFactor = math.multiply(-1, data[otherRow][lead]);
                data[otherRow] = data[otherRow].map(function(value, columnIndex){
                    return normalizeComputedScalar(math.add(value, math.multiply(eliminationFactor, data[rowIndex][columnIndex])));
                });
            }

            pivotColumns.push(lead);
            lead += 1;
        }

        return {
            matrix: data.map(function(row){
                return row.map(normalizeComputedScalar);
            }),
            pivotColumns: pivotColumns
        };
    }

    function buildNullBasisFromRref(rrefData, pivotColumns) {
        var columnCount = (rrefData[0] || []).length;
        var freeColumns = [];
        var basis = [];
        var columnIndex;

        for (columnIndex = 0; columnIndex < columnCount; columnIndex++) {
            if (pivotColumns.indexOf(columnIndex) < 0) {
                freeColumns.push(columnIndex);
            }
        }

        freeColumns.forEach(function(freeColumn){
            var vector = new Array(columnCount).fill(0);
            vector[freeColumn] = 1;

            pivotColumns.forEach(function(pivotColumn, pivotRow){
                vector[pivotColumn] = normalizeComputedScalar(math.multiply(-1, rrefData[pivotRow][freeColumn]));
            });

            basis.push(vector);
        });

        return basis;
    }

    function formatVectorPlainText(vector, decimals) {
        return '[' + vector.map(function(entry){
            return scalarToPlain(entry, decimals);
        }).join('; ') + ']';
    }

    function formatRowVectorPlainText(vector, decimals) {
        return '[' + vector.map(function(entry){
            return scalarToPlain(entry, decimals);
        }).join(' ') + ']';
    }

    function formatEigenvalueLabel(index, value, decimals) {
        return '\\lambda_{' + index + '} = ' + scalarToLatex(value, decimals);
    }

    function buildEigenvalueSummary(values, decimals) {
        return values.map(function(value, index){
            return formatEigenvalueLabel(index + 1, value, decimals);
        }).join(',\\;');
    }

    function traceMatrix(matrixData) {
        return matrixData.reduce(function(sum, row, index){
            return normalizeComputedScalar(math.add(sum, row[index]));
        }, 0);
    }

    function scaleIdentityMatrix(size, scalar) {
        return identityMatrix(size).map(function(row){
            return row.map(function(entry){
                return entry === 0 ? 0 : normalizeComputedScalar(scalar);
            });
        });
    }

    function addMatricesGeneric(left, right) {
        return left.map(function(row, rowIndex){
            return row.map(function(value, columnIndex){
                return normalizeComputedScalar(math.add(value, right[rowIndex][columnIndex]));
            });
        });
    }

    function multiplyMatricesGeneric(left, right) {
        var rowCount = left.length;
        var innerSize = left[0] ? left[0].length : 0;
        var colCount = right[0] ? right[0].length : 0;
        var product = zeroMatrix(rowCount, colCount);

        for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            for (var colIndex = 0; colIndex < colCount; colIndex++) {
                var sum = 0;
                for (var innerIndex = 0; innerIndex < innerSize; innerIndex++) {
                    sum = normalizeComputedScalar(math.add(sum, math.multiply(left[rowIndex][innerIndex], right[innerIndex][colIndex])));
                }
                product[rowIndex][colIndex] = sum;
            }
        }

        return product;
    }

    function buildCharacteristicPolynomialData(matrixData) {
        var size = matrixData.length;
        var previousB;
        var coefficients = [1];
        var steps = [];

        requireSquareMatrix(matrixData, 'characteristic polynomial');
        previousB = identityMatrix(size);

        for (var index = 1; index <= size; index++) {
            var product = multiplyMatricesGeneric(matrixData, previousB);
            var traceValue = traceMatrix(product);
            var coefficient = normalizeComputedScalar(math.multiply(-1 / index, traceValue));
            var currentB = addMatricesGeneric(product, scaleIdentityMatrix(size, coefficient));

            coefficients.push(coefficient);
            steps.push({
                index: index,
                trace: traceValue,
                coefficient: coefficient,
                bMatrix: currentB
            });
            previousB = currentB;
        }

        return {
            coefficients: coefficients,
            steps: steps
        };
    }

    function formatPolynomialLatex(coefficients, decimals, variableName) {
        var degree = coefficients.length - 1;
        var terms = [];

        coefficients.forEach(function(rawCoefficient, index){
            var coefficient = normalizeComputedScalar(rawCoefficient);
            var power = degree - index;
            var isLeading = index === 0;
            var isZero = isScalarZero(coefficient);
            var absoluteValue;
            var coefficientText;
            var powerText;
            var term;

            if (isZero) return;

            absoluteValue = isLeading ? coefficient : normalizeComputedScalar(math.abs ? math.abs(coefficient) : Math.abs(coefficient));
            coefficientText = scalarToLatex(absoluteValue, decimals);
            powerText = power === 0 ? '' : (power === 1 ? variableName : variableName + '^{' + power + '}');

            if (power !== 0 && coefficientText === '1') {
                term = powerText;
            } else {
                term = coefficientText + (powerText ? powerText : '');
            }

            if (isLeading) {
                if (typeof coefficient === 'number' && coefficient < 0) {
                    terms.push('-' + term);
                } else if (isComplexValue(coefficient) && coefficient.re < 0 && coefficient.im === 0) {
                    terms.push('-' + term);
                } else {
                    terms.push(term);
                }
            } else {
                if ((typeof coefficient === 'number' && coefficient < 0) || (isComplexValue(coefficient) && coefficient.re < 0 && coefficient.im === 0)) {
                    terms.push('- ' + term);
                } else {
                    terms.push('+ ' + term);
                }
            }
        });

        return terms.length ? terms.join(' ') : '0';
    }

    function formatPolynomialPlain(coefficients, decimals, variableName) {
        var degree = coefficients.length - 1;
        var terms = [];

        coefficients.forEach(function(rawCoefficient, index){
            var coefficient = normalizeComputedScalar(rawCoefficient);
            var power = degree - index;
            var isLeading = index === 0;
            var isZero = isScalarZero(coefficient);
            var negative = (typeof coefficient === 'number' && coefficient < 0) || (isComplexValue(coefficient) && coefficient.re < 0 && coefficient.im === 0);
            var absoluteValue = negative ? normalizeComputedScalar(math.multiply(-1, coefficient)) : coefficient;
            var coefficientText = scalarToPlain(absoluteValue, decimals);
            var powerText = power === 0 ? '' : (power === 1 ? variableName : variableName + '^' + power);
            var term;

            if (isZero) return;

            if (power !== 0 && coefficientText === '1') {
                term = powerText;
            } else {
                term = coefficientText + powerText;
            }

            if (isLeading) {
                terms.push(negative ? '-' + term : term);
            } else {
                terms.push((negative ? '- ' : '+ ') + term);
            }
        });

        return terms.length ? terms.join(' ') : '0';
    }

    function matrixMinusLambdaToLatex(matrixData, decimals, variableName) {
        var rows = matrixData.map(function(row, rowIndex){
            return row.map(function(value, columnIndex){
                if (rowIndex === columnIndex) {
                    var scalarText = scalarToLatex(value, decimals);
                    if (scalarText === '0') return '-' + variableName;
                    return scalarText + ' - ' + variableName;
                }
                return scalarToLatex(value, decimals);
            }).join(' & ');
        }).join(' \\\\ ');

        return '\\begin{bmatrix}' + rows + '\\end{bmatrix}';
    }

    function matrixMinusLambdaToPlain(matrixData, decimals, variableName) {
        var rows = matrixData.map(function(row, rowIndex){
            return row.map(function(value, columnIndex){
                if (rowIndex === columnIndex) {
                    return scalarToPlain(value, decimals) + ' - ' + variableName;
                }
                return scalarToPlain(value, decimals);
            }).join(' ');
        });

        return '[' + rows.join('; ') + ']';
    }

    function scalarKey(value, decimals) {
        return scalarToPlain(normalizeComputedScalar(value), decimals || 12);
    }

    function getEigenspaceData(matrixData) {
        var eigResult;
        var eigenvalues;
        var groups = [];
        var characteristicPolynomial;

        requireSquareMatrix(matrixData, 'eigen operations');
        eigResult = math.eigs(matrixData);
        eigenvalues = eigResult.values.map(normalizeComputedScalar);
        characteristicPolynomial = buildCharacteristicPolynomialData(matrixData);

        eigenvalues.forEach(function(value){
            var key = scalarKey(value, 12);
            var existingGroup = null;
            var shiftedMatrix;
            var rrefResult;

            groups.some(function(group){
                if (group.key === key) {
                    existingGroup = group;
                    return true;
                }
                return false;
            });

            if (existingGroup) {
                existingGroup.algebraicMultiplicity += 1;
                return;
            }

            shiftedMatrix = subtractLambdaIdentity(matrixData, value);
            rrefResult = reduceToRrefGeneric(shiftedMatrix);
            groups.push({
                key: key,
                value: value,
                shiftedMatrix: shiftedMatrix,
                rrefMatrix: rrefResult.matrix,
                pivotColumns: rrefResult.pivotColumns,
                basis: buildNullBasisFromRref(rrefResult.matrix, rrefResult.pivotColumns),
                algebraicMultiplicity: 1
            });
        });

        groups.forEach(function(group){
            group.geometricMultiplicity = group.basis.length;
        });

        return {
            values: eigenvalues,
            groups: groups,
            characteristicPolynomial: characteristicPolynomial,
            isDiagonalizable: groups.reduce(function(total, group){
                return total + group.geometricMultiplicity;
            }, 0) === matrixData.length
        };
    }

    function buildDiagonalizationData(matrixData) {
        var eigenData = getEigenspaceData(matrixData);
        var basisVectors = [];
        var diagonalEntries = [];
        var sMatrix;
        var lambdaMatrix;
        var inverseMatrix;
        var reconstructed;

        if (!eigenData.isDiagonalizable) {
            throw new Error('Matrix is not diagonalizable because it does not have enough linearly independent eigenvectors');
        }

        eigenData.groups.forEach(function(group){
            group.basis.forEach(function(vector){
                basisVectors.push(vector);
                diagonalEntries.push(group.value);
            });
        });

        sMatrix = matrixData.map(function(_, rowIndex){
            return basisVectors.map(function(vector){
                return vector[rowIndex];
            });
        });
        lambdaMatrix = normalizeComputedMatrix(math.diag(diagonalEntries));
        inverseMatrix = normalizeComputedMatrix(math.inv(sMatrix));
        reconstructed = normalizeComputedMatrix(math.multiply(math.multiply(sMatrix, lambdaMatrix), inverseMatrix));

        return {
            eigenData: eigenData,
            basisVectors: basisVectors,
            diagonalEntries: diagonalEntries,
            sMatrix: sMatrix,
            lambdaMatrix: lambdaMatrix,
            inverseMatrix: inverseMatrix,
            reconstructed: reconstructed
        };
    }

    function getCommandMatch(expr) {
        var match = expr.match(/^\s*([A-Za-z_]\w*)\s*\((.*)\)\s*$/);
        var name;

        if (!match) return null;
        name = match[1].toLowerCase();
        if (['col', 'row', 'null', 'rref', 'solve_rref', 'lu', 'solve_lu', 'cr', 'solve_cr', 'diag', 'eig_vals', 'eig_vec', 'solve_eigen', 'solve_diag'].indexOf(name) < 0) {
            return null;
        }

        return {
            name: name,
            argument: match[2].trim()
        };
    }

    function evaluateMatrixArgument(argumentExpr, scope) {
        var rewritten = rewriteMatrixSyntax(argumentExpr);
        var value = math.evaluate(rewritten, scope);
        var data = normalizeNumericMatrix(value);
        return {
            expr: rewritten,
            value: value,
            data: data,
            rref: reduceToRref(data)
        };
    }

    function renderDefinitionBlocks(definitions, decimals) {
        return definitions.map(function(def){
            return renderKatexBlock(def.name + ' = ' + valueToLatex(def.value, decimals));
        }).join('');
    }

    function renderSectionTitle(text) {
        return '<div class="result-section-title">' + escapeHtml(text) + '</div>';
    }

    function renderSectionSeparator() {
        return '<div class="result-separator">===============</div>';
    }

    function buildDefinitionCopyLines(definitions, decimals) {
        return definitions.map(function(def){
            return def.name + ' = ' + valueToCopyText(def.value, decimals);
        });
    }

    function buildDefinitionMarkdownLines(definitions, decimals) {
        return definitions.map(function(def){
            return def.name + ' = ' + valueToCopyText(def.value, decimals);
        });
    }

    function renderMatrixOutput(definitions, resultBlocks, copyLines, decimals) {
        var html = renderDefinitionBlocks(definitions, decimals) + resultBlocks.join('');
        var allCopyLines = buildDefinitionCopyLines(definitions, decimals).concat(copyLines);
        setHtmlResult(html, allCopyLines.join('\n'));
    }

    function buildMarkdownSection(section, decimals) {
        var lines = ['### ' + section.expression, '', '```text'];

        lines = lines.concat(buildDefinitionMarkdownLines(section.definitions, decimals));
        if (section.definitions.length && section.copyLines.length) {
            lines.push('');
        }
        lines = lines.concat(section.copyLines);
        lines.push('```');
        return lines.join('\n');
    }

    function renderMatrixSections(sections, decimals) {
        var html = sections.map(function(section, index){
            var sectionHtml = renderSectionTitle('Expression: ' + section.expression) + renderDefinitionBlocks(section.definitions, decimals) + section.blocks.join('');
            if (index === 0) return sectionHtml;
            return renderSectionSeparator() + sectionHtml;
        }).join('');
        var markdown = sections.map(function(section){
            return buildMarkdownSection(section, decimals);
        }).join('\n\n===============\n\n');

        setHtmlResult(html, markdown);
    }

    function buildStandardMatrixResult(definitions, expressionTex, result, decimals) {
        return {
            blocks: [renderKatexBlock('C = ' + expressionTex + ' = ' + valueToLatex(result, decimals))],
            copyLines: [
                'C = ' + valueToCopyText(result, decimals),
                'Expression = ' + expressionTex
            ]
        };
    }

    function getPivotColumnsText(pivotColumns) {
        if (!pivotColumns.length) return 'none';
        return pivotColumns.map(function(index){
            return String(index + 1);
        }).join(', ');
    }

    function handleMatrixCommand(command, argumentInfo, decimals) {
        var rrefData = argumentInfo.rref.matrix;
        var pivotColumns = argumentInfo.rref.pivotColumns;
        var originalData = argumentInfo.data;
        var rowBasis;
        var colBasis;
        var freeColumns;
        var nullBasis;
        var lines;
        var exprTex = math.parse(argumentInfo.expr).toTex({ parenthesis: 'auto' });
        var luResult;
        var rankRows;
        var cMatrix;
        var rMatrix;
        var copiedRows;
        var selectedColumns;
        var eigenData;
        var diagonalization;
        var eigenCopyLines;

        if (command.name === 'rref') {
            return {
                blocks: [
                    renderKatexBlock('C = \\operatorname{rref}\\left(' + exprTex + '\\right) = ' + matrixToLatex(matrixFromData(rrefData), decimals)),
                    renderKatexBlock('\\text{Pivot columns: } ' + getPivotColumnsText(pivotColumns))
                ],
                copyLines: [
                    'C = ' + matrixToPlainText(matrixFromData(rrefData), decimals),
                    'Pivot columns = ' + getPivotColumnsText(pivotColumns)
                ]
            };
        }

        if (command.name === 'solve_rref') {
            lines = ['solve_rref(' + argumentInfo.expr + ')'];
            return {
                blocks: argumentInfo.rref.steps.map(function(step, index){
                    if (step.type === 'start') {
                        lines.push('Start = ' + matrixToPlainText(matrixFromData(step.matrix), decimals));
                        return renderKatexBlock('\\text{Start} = ' + matrixToLatex(matrixFromData(step.matrix), decimals));
                    }

                    lines.push('Step ' + index + ': ' + matrixOperationToPlainText(step, decimals) + ' => ' + matrixToPlainText(matrixFromData(step.matrix), decimals));
                    return renderKatexBlock('\\text{Step ' + index + ': } ' + matrixOperationToLatex(step, decimals) + '\\qquad ' + matrixToLatex(matrixFromData(step.matrix), decimals));
                }).concat([
                    renderKatexBlock('C = \\operatorname{rref}\\left(' + exprTex + '\\right) = ' + matrixToLatex(matrixFromData(rrefData), decimals))
                ]),
                copyLines: lines.concat(['C = ' + matrixToPlainText(matrixFromData(rrefData), decimals)])
            };
        }

        if (command.name === 'lu') {
            luResult = decomposeLu(originalData);
            return {
                blocks: [
                    renderKatexBlock('P' + exprTex + ' = LU'),
                    renderKatexBlock('P = ' + matrixToLatex(matrixFromData(luResult.permutation), decimals)),
                    renderKatexBlock('L = ' + matrixToLatex(matrixFromData(luResult.lower), decimals)),
                    renderKatexBlock('U = ' + matrixToLatex(matrixFromData(luResult.upper), decimals)),
                    renderKatexBlock('PA = ' + matrixToLatex(matrixFromData(luResult.permutedOriginal), decimals)),
                    renderKatexBlock('LU = ' + matrixToLatex(matrixFromData(luResult.product), decimals))
                ],
                copyLines: [
                    'P = ' + matrixToPlainText(matrixFromData(luResult.permutation), decimals),
                    'L = ' + matrixToPlainText(matrixFromData(luResult.lower), decimals),
                    'U = ' + matrixToPlainText(matrixFromData(luResult.upper), decimals),
                    'PA = ' + matrixToPlainText(matrixFromData(luResult.permutedOriginal), decimals),
                    'LU = ' + matrixToPlainText(matrixFromData(luResult.product), decimals)
                ]
            };
        }

        if (command.name === 'solve_lu') {
            luResult = decomposeLu(originalData);
            lines = ['solve_lu(' + argumentInfo.expr + ')'];
            return {
                blocks: [
                    renderKatexBlock('P' + exprTex + ' = LU')
                ].concat(luResult.steps.map(function(step, index){
                    lines.push('Stage ' + (index + 1) + ': pivot row = ' + (step.pivotRow + 1));
                    if (step.pivotRow !== step.pivot) {
                        lines.push('Stage ' + (index + 1) + ': swap row ' + (step.pivot + 1) + ' with row ' + (step.pivotRow + 1));
                    }
                    if (step.lowerEntries.length) {
                        lines.push('Stage ' + (index + 1) + ': L entries -> ' + formatEntryListPlain(step.lowerEntries, 'L', decimals));
                    }
                    lines.push('Stage ' + (index + 1) + ': P = ' + matrixToPlainText(matrixFromData(step.permutation), decimals));
                    lines.push('Stage ' + (index + 1) + ': L = ' + matrixToPlainText(matrixFromData(step.lower), decimals));
                    lines.push('Stage ' + (index + 1) + ': U = ' + matrixToPlainText(matrixFromData(step.upper), decimals));
                    return renderKatexBlock('\\text{Stage ' + (index + 1) + ': pivot row } ' + (step.pivotRow + 1) + (step.pivotRow !== step.pivot ? '\\text{, swap } R_{' + (step.pivot + 1) + '} \\leftrightarrow R_{' + (step.pivotRow + 1) + '}' : '') + (step.lowerEntries.length ? ',\\;' + formatEntryListLatex(step.lowerEntries, 'L', decimals) : '') + '\\qquad P=' + matrixToLatex(matrixFromData(step.permutation), decimals) + '\\qquad L=' + matrixToLatex(matrixFromData(step.lower), decimals) + '\\qquad U=' + matrixToLatex(matrixFromData(step.upper), decimals));
                })).concat([
                    renderKatexBlock('P = ' + matrixToLatex(matrixFromData(luResult.permutation), decimals)),
                    renderKatexBlock('L = ' + matrixToLatex(matrixFromData(luResult.lower), decimals)),
                    renderKatexBlock('U = ' + matrixToLatex(matrixFromData(luResult.upper), decimals)),
                    renderKatexBlock('PA = ' + matrixToLatex(matrixFromData(luResult.permutedOriginal), decimals)),
                    renderKatexBlock('LU = ' + matrixToLatex(matrixFromData(luResult.product), decimals))
                ]),
                copyLines: lines.concat([
                    'P = ' + matrixToPlainText(matrixFromData(luResult.permutation), decimals),
                    'L = ' + matrixToPlainText(matrixFromData(luResult.lower), decimals),
                    'U = ' + matrixToPlainText(matrixFromData(luResult.upper), decimals),
                    'PA = ' + matrixToPlainText(matrixFromData(luResult.permutedOriginal), decimals),
                    'LU = ' + matrixToPlainText(matrixFromData(luResult.product), decimals)
                ])
            };
        }

        if (command.name === 'row') {
            rowBasis = rrefData.filter(function(row){
                return !isZeroRow(row);
            });
            return {
                blocks: [
                    renderKatexBlock('C = \\operatorname{row}\\left(' + exprTex + '\\right) = ' + spanToLatex(rowBasis, decimals, 'row'))
                ],
                copyLines: [
                    'C = ' + spanToPlainText(rowBasis, decimals, 'row')
                ]
            };
        }

        if (command.name === 'col') {
            colBasis = pivotColumns.map(function(columnIndex){
                return originalData.map(function(row){
                    return row[columnIndex];
                });
            });
            return {
                blocks: [
                    renderKatexBlock('C = \\operatorname{col}\\left(' + exprTex + '\\right) = ' + spanToLatex(colBasis, decimals, 'column'))
                ],
                copyLines: [
                    'C = ' + spanToPlainText(colBasis, decimals, 'column')
                ]
            };
        }

        if (command.name === 'cr') {
            colBasis = pivotColumns.map(function(columnIndex){
                return originalData.map(function(row){
                    return row[columnIndex];
                });
            });
            rankRows = rrefData.filter(function(row){
                return !isZeroRow(row);
            });
            cMatrix = originalData.map(function(row){
                return pivotColumns.map(function(columnIndex){
                    return row[columnIndex];
                });
            });
            rMatrix = rankRows;
            return {
                blocks: [
                    renderKatexBlock(exprTex + ' = CR'),
                    renderKatexBlock('C = ' + matrixToLatex(matrixFromData(cMatrix), decimals)),
                    renderKatexBlock('R = ' + matrixToLatex(matrixFromData(rMatrix), decimals)),
                    renderKatexBlock('CR = ' + matrixToLatex(matrixFromData(multiplyMatrices(cMatrix, rMatrix)), decimals))
                ],
                copyLines: [
                    'C = ' + matrixToPlainText(matrixFromData(cMatrix), decimals),
                    'R = ' + matrixToPlainText(matrixFromData(rMatrix), decimals),
                    'CR = ' + matrixToPlainText(matrixFromData(multiplyMatrices(cMatrix, rMatrix)), decimals)
                ]
            };
        }

        if (command.name === 'solve_cr') {
            selectedColumns = pivotColumns.map(function(columnIndex){
                return columnIndex + 1;
            });
            cMatrix = originalData.map(function(row){
                return pivotColumns.map(function(columnIndex){
                    return row[columnIndex];
                });
            });
            rankRows = rrefData.filter(function(row){
                return !isZeroRow(row);
            });
            rMatrix = rankRows;
            copiedRows = rankRows.map(function(row, rowIndex){
                return 'Row ' + (rowIndex + 1) + ' = ' + rowVectorToPlainText(row.map(function(entry){
                    return scalarToPlain(entry, decimals);
                }));
            });
            return {
                blocks: [
                    renderKatexBlock(exprTex + ' = CR'),
                    renderKatexBlock('\\text{Pivot columns selected from } \\operatorname{rref}(' + exprTex + ')\\text{: } ' + getPivotColumnsText(pivotColumns)),
                    renderKatexBlock('C = ' + matrixToLatex(matrixFromData(cMatrix), decimals)),
                    renderKatexBlock('\\text{Non-zero rows of } \\operatorname{rref}(' + exprTex + ')\\text{ form } R'),
                    renderKatexBlock('R = ' + matrixToLatex(matrixFromData(rMatrix), decimals)),
                    renderKatexBlock(exprTex + ' = ' + matrixToLatex(matrixFromData(cMatrix), decimals) + '\\,' + matrixToLatex(matrixFromData(rMatrix), decimals))
                ],
                copyLines: [
                    'solve_cr(' + argumentInfo.expr + ')',
                    'Pivot columns = ' + selectedColumns.join(', '),
                    'C = ' + matrixToPlainText(matrixFromData(cMatrix), decimals),
                    'R rows = ' + copiedRows.join(' | '),
                    'R = ' + matrixToPlainText(matrixFromData(rMatrix), decimals),
                    argumentInfo.expr + ' = ' + matrixToPlainText(matrixFromData(cMatrix), decimals) + ' ' + matrixToPlainText(matrixFromData(rMatrix), decimals)
                ]
            };
        }

        if (command.name === 'null') {
            freeColumns = [];
            for (var columnIndex = 0; columnIndex < (originalData[0] || []).length; columnIndex++) {
                if (pivotColumns.indexOf(columnIndex) < 0) {
                    freeColumns.push(columnIndex);
                }
            }

            nullBasis = freeColumns.map(function(freeColumn){
                var vector = new Array((originalData[0] || []).length).fill(0);
                vector[freeColumn] = 1;
                pivotColumns.forEach(function(pivotColumn, pivotRow){
                    vector[pivotColumn] = roundNearZero(-rrefData[pivotRow][freeColumn]);
                });
                return vector;
            });

            return {
                blocks: [
                    renderKatexBlock('C = \\operatorname{null}\\left(' + exprTex + '\\right) = ' + spanToLatex(nullBasis, decimals, 'column'))
                ],
                copyLines: [
                    'C = ' + spanToPlainText(nullBasis, decimals, 'column')
                ]
            };
        }

        if (command.name === 'eig_vals') {
            eigenData = getEigenspaceData(originalData);
            return {
                blocks: [
                    renderKatexBlock('\\text{Eigenvalues of } ' + exprTex + '\\text{: } ' + buildEigenvalueSummary(eigenData.values, decimals)),
                    renderKatexBlock('C = ' + vectorToLatex(eigenData.values, decimals, 'row'))
                ],
                copyLines: [
                    'Eigenvalues = ' + formatRowVectorPlainText(eigenData.values, decimals),
                    'C = ' + formatRowVectorPlainText(eigenData.values, decimals)
                ]
            };
        }

        if (command.name === 'eig_vec') {
            eigenData = getEigenspaceData(originalData);
            eigenCopyLines = ['eig_vec(' + argumentInfo.expr + ')'];

            return {
                blocks: [
                    renderKatexBlock('\\text{Eigenvalues: } ' + buildEigenvalueSummary(eigenData.values, decimals))
                ].concat(eigenData.groups.map(function(group){
                    eigenCopyLines.push('lambda = ' + scalarToPlain(group.value, decimals) + ' -> ' + spanToPlainText(group.basis, decimals, 'column'));
                    return renderKatexBlock('E_{' + scalarToLatex(group.value, decimals) + '} = \\operatorname{null}\\left(' + matrixToLatex(matrixFromData(group.shiftedMatrix), decimals) + '\\right) = ' + spanToLatex(group.basis, decimals, 'column'));
                })),
                copyLines: eigenCopyLines
            };
        }

        if (command.name === 'solve_eigen') {
            eigenData = getEigenspaceData(originalData);
            eigenCopyLines = ['solve_eigen(' + argumentInfo.expr + ')'];
            eigenCopyLines.push('A - lambda*I = ' + matrixMinusLambdaToPlain(originalData, decimals, 'lambda'));
            eigenCopyLines.push('det(A - lambda*I) = ' + formatPolynomialPlain(eigenData.characteristicPolynomial.coefficients, decimals, 'lambda') + ' = 0');
            eigenCopyLines.push('lambda = ' + eigenData.values.map(function(value){
                return scalarToPlain(value, decimals);
            }).join(', '));

            return {
                blocks: [
                    renderKatexBlock('\\text{Step 1: Build } ' + exprTex + ' - \\lambda I = ' + matrixMinusLambdaToLatex(originalData, decimals, '\\lambda')),
                    renderKatexBlock('\\text{Step 2: Characteristic equation } \\det(' + exprTex + ' - \\lambda I) = ' + formatPolynomialLatex(eigenData.characteristicPolynomial.coefficients, decimals, '\\lambda') + ' = 0'),
                    renderKatexBlock('\\text{Step 3: Solve the characteristic equation } ' + buildEigenvalueSummary(eigenData.values, decimals))
                ].concat(eigenData.groups.map(function(group){
                    eigenCopyLines.push('lambda = ' + scalarToPlain(group.value, decimals));
                    eigenCopyLines.push('A - lambda I = ' + matrixToPlainText(matrixFromData(group.shiftedMatrix), decimals));
                    eigenCopyLines.push('rref(A - lambda I) = ' + matrixToPlainText(matrixFromData(group.rrefMatrix), decimals));
                    eigenCopyLines.push('E_lambda = ' + spanToPlainText(group.basis, decimals, 'column'));
                    return renderKatexBlock('\\text{For } \\lambda = ' + scalarToLatex(group.value, decimals) + ':\\quad ' + exprTex + ' - \\lambda I = ' + matrixToLatex(matrixFromData(group.shiftedMatrix), decimals) + ',\\quad \\operatorname{rref}(' + exprTex + ' - \\lambda I) = ' + matrixToLatex(matrixFromData(group.rrefMatrix), decimals) + ',\\quad E_{\\lambda} = ' + spanToLatex(group.basis, decimals, 'column'));
                })),
                copyLines: eigenCopyLines
            };
        }

        if (command.name === 'diag') {
            diagonalization = buildDiagonalizationData(originalData);
            return {
                blocks: [
                    renderKatexBlock(exprTex + ' = S\\Lambda S^{-1}'),
                    renderKatexBlock('S = ' + matrixToLatex(matrixFromData(diagonalization.sMatrix), decimals)),
                    renderKatexBlock('\\Lambda = ' + matrixToLatex(matrixFromData(diagonalization.lambdaMatrix), decimals)),
                    renderKatexBlock('S^{-1} = ' + matrixToLatex(matrixFromData(diagonalization.inverseMatrix), decimals)),
                    renderKatexBlock('S\\Lambda S^{-1} = ' + matrixToLatex(matrixFromData(diagonalization.reconstructed), decimals))
                ],
                copyLines: [
                    'S = ' + matrixToPlainText(matrixFromData(diagonalization.sMatrix), decimals),
                    'Lambda = ' + matrixToPlainText(matrixFromData(diagonalization.lambdaMatrix), decimals),
                    'S^-1 = ' + matrixToPlainText(matrixFromData(diagonalization.inverseMatrix), decimals),
                    'S*Lambda*S^-1 = ' + matrixToPlainText(matrixFromData(diagonalization.reconstructed), decimals)
                ]
            };
        }

        if (command.name === 'solve_diag') {
            diagonalization = buildDiagonalizationData(originalData);
            eigenCopyLines = ['solve_diag(' + argumentInfo.expr + ')'];
            eigenCopyLines.push('A - lambda*I = ' + matrixMinusLambdaToPlain(originalData, decimals, 'lambda'));
            eigenCopyLines.push('det(A - lambda*I) = ' + formatPolynomialPlain(diagonalization.eigenData.characteristicPolynomial.coefficients, decimals, 'lambda') + ' = 0');
            eigenCopyLines.push('lambda = ' + diagonalization.eigenData.values.map(function(value){
                return scalarToPlain(value, decimals);
            }).join(', '));
            diagonalization.eigenData.groups.forEach(function(group){
                eigenCopyLines.push('lambda = ' + scalarToPlain(group.value, decimals));
                eigenCopyLines.push('A - lambda I = ' + matrixToPlainText(matrixFromData(group.shiftedMatrix), decimals));
                eigenCopyLines.push('rref(A - lambda I) = ' + matrixToPlainText(matrixFromData(group.rrefMatrix), decimals));
                eigenCopyLines.push('E_lambda = ' + spanToPlainText(group.basis, decimals, 'column'));
            });
            eigenCopyLines.push('S = ' + matrixToPlainText(matrixFromData(diagonalization.sMatrix), decimals));
            eigenCopyLines.push('Lambda = ' + matrixToPlainText(matrixFromData(diagonalization.lambdaMatrix), decimals));
            eigenCopyLines.push('S^-1 = ' + matrixToPlainText(matrixFromData(diagonalization.inverseMatrix), decimals));
            eigenCopyLines.push(argumentInfo.expr + ' = ' + matrixToPlainText(matrixFromData(diagonalization.sMatrix), decimals) + ' ' + matrixToPlainText(matrixFromData(diagonalization.lambdaMatrix), decimals) + ' ' + matrixToPlainText(matrixFromData(diagonalization.inverseMatrix), decimals));

            return {
                blocks: [
                    renderKatexBlock('\\text{Step 1: Build } ' + exprTex + ' - \\lambda I = ' + matrixMinusLambdaToLatex(originalData, decimals, '\\lambda')),
                    renderKatexBlock('\\text{Step 2: Characteristic equation } \\det(' + exprTex + ' - \\lambda I) = ' + formatPolynomialLatex(diagonalization.eigenData.characteristicPolynomial.coefficients, decimals, '\\lambda') + ' = 0'),
                    renderKatexBlock('\\text{Step 3: Solve the characteristic equation } ' + buildEigenvalueSummary(diagonalization.eigenData.values, decimals))
                ].concat(diagonalization.eigenData.groups.map(function(group){
                    return renderKatexBlock('\\text{Step 4: For } \\lambda = ' + scalarToLatex(group.value, decimals) + ':\\quad ' + exprTex + ' - \\lambda I = ' + matrixToLatex(matrixFromData(group.shiftedMatrix), decimals) + ',\\quad \\operatorname{rref}(' + exprTex + ' - \\lambda I) = ' + matrixToLatex(matrixFromData(group.rrefMatrix), decimals) + ',\\quad E_{\\lambda} = ' + spanToLatex(group.basis, decimals, 'column'));
                })).concat([
                    renderKatexBlock('\\text{Step 5: Build } S \\text{ from an eigenbasis}'),
                    renderKatexBlock('S = ' + matrixToLatex(matrixFromData(diagonalization.sMatrix), decimals)),
                    renderKatexBlock('\\Lambda = ' + matrixToLatex(matrixFromData(diagonalization.lambdaMatrix), decimals)),
                    renderKatexBlock('S^{-1} = ' + matrixToLatex(matrixFromData(diagonalization.inverseMatrix), decimals)),
                    renderKatexBlock(exprTex + ' = S\\Lambda S^{-1} = ' + matrixToLatex(matrixFromData(diagonalization.reconstructed), decimals))
                ]),
                copyLines: eigenCopyLines
            };
        }

        throw new Error('Unsupported matrix command: ' + command.name);
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
        var expressionLines;
        var commandMatch;
        var definitions;
        var transformedExpr;
        var referencedNames;
        var visibleDefinitions;
        var result;
        var expressionTex;
        var resultPayload;
        var argumentInfo;
        var sections = [];

        if (!rawExpr || !rawExpr.trim()) {
            setErrorResult('Error: Enter a matrix expression');
            return;
        }

        try {
            definitions = parseMatrixAssignments(rawVars || '', scope);
            expressionLines = rawExpr.split(/\r?\n/).map(function(line){
                return line.trim();
            }).filter(function(line){
                return line.length > 0;
            });

            expressionLines.forEach(function(expressionLine){
                commandMatch = getCommandMatch(expressionLine);

                if (commandMatch) {
                    argumentInfo = evaluateMatrixArgument(commandMatch.argument, scope);
                    referencedNames = extractReferencedVariables(argumentInfo.expr, scope);
                    resultPayload = handleMatrixCommand(commandMatch, argumentInfo, decimals);
                } else {
                    transformedExpr = rewriteMatrixSyntax(expressionLine);
                    result = math.evaluate(transformedExpr, scope);
                    expressionTex = math.parse(transformedExpr).toTex({ parenthesis: 'auto' });
                    referencedNames = extractReferencedVariables(transformedExpr, scope);
                    resultPayload = buildStandardMatrixResult(definitions, expressionTex, result, decimals);
                }

                visibleDefinitions = definitions.filter(function(def){
                    return referencedNames.indexOf(def.name) >= 0;
                });

                if (!visibleDefinitions.length) {
                    visibleDefinitions = definitions;
                }

                sections.push({
                    expression: expressionLine,
                    definitions: visibleDefinitions,
                    blocks: resultPayload.blocks,
                    copyLines: resultPayload.copyLines
                });
            });

            renderMatrixSections(sections, decimals);
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
