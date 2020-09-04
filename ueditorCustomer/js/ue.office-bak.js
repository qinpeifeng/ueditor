/*
 * ue.Office.js  
 * 针对 ueditor 粘贴 office excel内容的处理类
 * Version:1.0.0 
 * Author:qpf
 * Date:2020/04/08
 */
; (function (win, $) {


    var agent = navigator.userAgent.toLowerCase(),
        edge = agent.match(/edge[ \/](\d+.?\d*)/),
        trident = agent.indexOf('trident/') > -1,
        ie = !!(edge || trident);


    var ampRegex = /&/g,
        gtRegex = />/g,
        ltRegex = /</g,
        quoteRegex = /"/g;

    var namedEntities = {
        lt: '<',
        gt: '>',
        amp: '&',
        quot: '"',
        nbsp: '\u00a0',
        shy: '\u00ad'
    };

    var allEscRegex = /&(lt|gt|amp|quot|nbsp|shy|#\d{1,5});/g;
    var allEscDecode = function (match, code) {
        if (code[0] == '#') {
            return String.fromCharCode(parseInt(code.slice(1), 10));
        } else {
            return namedEntities[code];
        }
    };

    var invalidTags = [
        'o:p',
        'xml',
        'script',
        'meta',
        'link'
    ];
    var shapeTags = [
        'v:arc',
        'v:curve',
        'v:line',
        'v:oval',
        'v:polyline',
        'v:rect',
        'v:roundrect',
        'v:group'
    ];

    var NodeType = {
        NODE_ELEMENT: 1,
        ODE_DOCUMENT: 9,
        NODE_TEXT: 3,
        NODE_COMMENT: 8,
        NODE_DOCUMENT_FRAGMENT: 11,
        POSITION_IDENTICAL: 0,
        POSITION_DISCONNECTED: 1,
        POSITION_FOLLOWING: 2,
        POSITION_PRECEDING: 4,
        POSITION_IS_CONTAINED: 8,
        POSITION_CONTAINS: 16,
    };

    var env = {};
    var Style = {};
    var plugins = {};
    var dom = {};
    var tools = {};
    var htmlParser = {};
    var inComment = 0;
    var List={};
    var commonFilter;


    env = {
        ie: ie,
        edge: !!edge,
        webkit: !ie && (agent.indexOf(' applewebkit/') > -1),
        air: (agent.indexOf(' adobeair/') > -1),
        mac: (agent.indexOf('macintosh') > -1),
        quirks: (document.compatMode == 'BackCompat' && (!document.documentMode || document.documentMode < 10)),
        mobile: (agent.indexOf('mobile') > -1),
        iOS: /(ipad|iphone|ipod)/.test(agent),
        secure: location.protocol == 'https:'
    };

    if (env.ie) {
        // We use env.version for feature detection, so set it properly.
        if (edge) {
            version = parseFloat(edge[1]);
        } else if (env.quirks || !document.documentMode) {
            version = parseFloat(agent.match(/msie (\d+)/)[1]);
        } else {
            version = document.documentMode;
        }

        // Deprecated features available just for backwards compatibility.
        env.ie9Compat = version == 9;
        env.ie8Compat = version == 8;
        env.ie7Compat = version == 7;
        env.ie6Compat = version < 7 || env.quirks;
    }

    tools = {
        parseCssText: function (styleText, normalize, nativeNormalize) {
            var retval = {};

            if (nativeNormalize) {
                // Injects the style in a temporary span object, so the browser parses it,
                // retrieving its final format.
                var temp = new dom.element('span');
                styleText = temp.setAttribute('style', styleText).getAttribute('style') || '';
            }

            // Normalize colors.
            if (styleText) {
                styleText = tools.normalizeHex(tools.convertRgbToHex(styleText));
            }

            if (!styleText || styleText == ';')
                return retval;

            styleText.replace(/&quot;/g, '"').replace(/\s*([^:;\s]+)\s*:\s*([^;]+)\s*(?=;|$)/g, function (match, name, value) {
                if (normalize) {
                    name = name.toLowerCase();
                    // Drop extra whitespacing from font-family.
                    if (name == 'font-family')
                        value = value.replace(/\s*,\s*/g, ',');
                    value = tools.trim(value);
                }

                retval[name] = value;
            });
            return retval;
        },
        bind: function (func, obj) {
            var args = Array.prototype.slice.call(arguments, 2);
            return function () {
                return func.apply(obj, args.concat(Array.prototype.slice.call(arguments)));
            };
        },
        convertToPx: (function () {
            var calculator;

            return function (cssLength) {
                if (!calculator) {
                    calculator = dom.element.createFromHtml('<div style="position:absolute;left:-9999px;' +
                        'top:-9999px;margin:0px;padding:0px;border:0px;"' +
                        '></div>', new dom.document(document));
                    // new dom.document(document).getBody().append(calculator);

                    var t=new dom.document(document);
                    var tt=t.getBody();
                    var ttt=tt.append(calculator)
                }

                if (!(/%$/).test(cssLength)) {
                    var isNegative = parseFloat(cssLength) < 0,
                        ret;

                    if (isNegative) {
                        cssLength = cssLength.replace('-', '');
                    }

                    calculator.setStyle('width', cssLength);
                    ret = calculator.$.clientWidth;

                    if (isNegative) {
                        return -ret;
                    }
                    return ret;
                }

                return cssLength;
            };
        })(),
        createClass: function (definition) {
            var $ = definition.$,
                baseClass = definition.base,
                privates = definition.privates || definition._,
                proto = definition.proto,
                statics = definition.statics;

            // Create the constructor, if not present in the definition.
            !$ && ($ = function () {
                baseClass && this.base.apply(this, arguments);
            });

            if (privates) {
                var originalConstructor = $;
                $ = function () {
                    // Create (and get) the private namespace.
                    var _ = this._ || (this._ = {});

                    // Make some magic so "this" will refer to the main
                    // instance when coding private functions.
                    for (var privateName in privates) {
                        var priv = privates[privateName];

                        _[privateName] = (typeof priv == 'function') ? tools.bind(priv, this) : priv;
                    }

                    originalConstructor.apply(this, arguments);
                };
            }

            if (baseClass) {
                $.prototype = this.prototypedCopy(baseClass.prototype);
                $.prototype.constructor = $;
                // Super references.
                $.base = baseClass;
                $.baseProto = baseClass.prototype;
                // Super constructor.
                $.prototype.base = function baseClassConstructor() {
                    this.base = baseClass.prototype.base;
                    baseClass.apply(this, arguments);
                    this.base = baseClassConstructor;
                };
            }

            if (proto)
                this.extend($.prototype, proto, true);

            if (statics)
                this.extend($, statics, true);

            return $;
        },
        getNextNumber: (function () {
            var last = 0;
            return function () {
                return ++last;
            };
        })(),
        writeCssText: function (styles, sort) {
            var name,
                stylesArr = [];

            for (name in styles)
                stylesArr.push(name + ':' + styles[name]);

            if (sort)
                stylesArr.sort();

            return stylesArr.join('; ');
        },
        convertRgbToHex: function (styleText) {
            return styleText.replace(/(?:rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\))/gi, function (match, red, green, blue) {
                var color = [red, green, blue];
                // Add padding zeros if the hex value is less than 0x10.
                for (var i = 0; i < 3; i++)
                    color[i] = ('0' + parseInt(color[i], 10).toString(16)).slice(-2);
                return '#' + color.join('');
            });
        },
        normalizeHex: function (styleText) {
            return styleText.replace(/#(([0-9a-f]{3}){1,2})($|;|\s+)/gi, function (match, hexColor, hexColorPart, separator) {
                var normalizedHexColor = hexColor.toLowerCase();
                if (normalizedHexColor.length == 3) {
                    var parts = normalizedHexColor.split('');
                    normalizedHexColor = [parts[0], parts[0], parts[1], parts[1], parts[2], parts[2]].join('');
                }
                return '#' + normalizedHexColor + separator;
            });
        },
        extend: function (target) {
            var argsLength = arguments.length,
                overwrite, propertiesList;

            if (typeof (overwrite = arguments[argsLength - 1]) == 'boolean')
                argsLength--;
            else if (typeof (overwrite = arguments[argsLength - 2]) == 'boolean') {
                propertiesList = arguments[argsLength - 1];
                argsLength -= 2;
            }

            for (var i = 1; i < argsLength; i++) {
                var source = arguments[i] || {};

                tools.array.forEach(tools.object.keys(source), function (propertyName) {
                    // Only copy existed fields if in overwrite mode.
                    if (overwrite === true || target[propertyName] == null) {
                        // Only copy specified fields if list is provided.
                        if (!propertiesList || (propertyName in propertiesList))
                            target[propertyName] = source[propertyName];
                    }

                });
            }

            return target;
        },
        clone: function (obj) {
            var clone;

            // Array.
            if (obj && (obj instanceof Array)) {
                clone = [];

                for (var i = 0; i < obj.length; i++)
                    clone[i] = tools.clone(obj[i]);

                return clone;
            }

            // "Static" types.
            if (obj === null || (typeof obj != 'object') || (obj instanceof String) || (obj instanceof Number) || (obj instanceof Boolean) || (obj instanceof Date) || (obj instanceof RegExp))
                return obj;

            // DOM objects and window.
            if (obj.nodeType || obj.window === obj)
                return obj;

            // Objects.
            clone = new obj.constructor();

            for (var propertyName in obj) {
                var property = obj[propertyName];
                clone[propertyName] = tools.clone(property);
            }

            return clone;
        },
        trim: (function () {
            // We are not using \s because we don't want "non-breaking spaces" to be caught.
            var trimRegex = /(?:^[ \t\n\r]+)|(?:[ \t\n\r]+$)/g;
            return function (str) {
                return str.replace(trimRegex, '');
            };
        })(),
        ltrim: (function () {
            // We are not using \s because we don't want "non-breaking spaces" to be caught.
            var trimRegex = /^[ \t\n\r]+/g;
            return function (str) {
                return str.replace(trimRegex, '');
            };
        })(),
        rtrim: (function () {
            // We are not using \s because we don't want "non-breaking spaces" to be caught.
            var trimRegex = /[ \t\n\r]+$/g;
            return function (str) {
                return str.replace(trimRegex, '');
            };
        })(),
        indexOf: function (array, value) {
            if (typeof value == 'function') {
                for (var i = 0, len = array.length; i < len; i++) {
                    if (value(array[i]))
                        return i;
                }
            } else if (array.indexOf)
                return array.indexOf(value);
            else {
                for (i = 0, len = array.length; i < len; i++) {
                    if (array[i] === value)
                        return i;
                }
            }
            return -1;
        },
        htmlDecodeAttr: function (text) {
            return tools.htmlDecode(text);
        },
        htmlEncodeAttr: function (text) {
            return tools.htmlEncode(text).replace(quoteRegex, '&quot;');
        },

        htmlEncode: function (text) {
            if (text === undefined || text === null) {
                return '';
            }
            return String(text).replace(ampRegex, '&amp;').replace(gtRegex, '&gt;').replace(ltRegex, '&lt;');
        },
        htmlDecode: function (text) {
            return text.replace(allEscRegex, allEscDecode);
        },
        isEmpty: function (object) {
            for (var i in object) {
                if (object.hasOwnProperty(i))
                    return false;
            }
            return true;
        },
        object: {
            DONT_ENUMS: [
                'toString',
                'toLocaleString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'constructor'
            ],
            entries: function (obj) {
                return tools.array.map(tools.object.keys(obj), function (key) {
                    return [key, obj[key]];
                });
            },
            values: function (obj) {
                return tools.array.map(tools.object.keys(obj), function (key) {
                    return obj[key];
                });
            },
            keys: function (obj) {
                var hasOwnProperty = Object.prototype.hasOwnProperty,
                    keys = [],
                    dontEnums = tools.object.DONT_ENUMS,
                    isNotObject = !obj || typeof obj !== 'object';

                // We must handle non-object types differently in IE 8,
                // due to the fact that it uses ES5 behaviour, not ES2015+ as other browsers (#3381).
                if (env.ie && env.version < 9 && isNotObject) {
                    return createNonObjectKeys(obj);
                }

                for (var prop in obj) {
                    keys.push(prop);
                }

                // Fix don't enum bug for IE < 9 browsers (#3120).
                if (env.ie && env.version < 9) {
                    for (var i = 0; i < dontEnums.length; i++) {
                        if (hasOwnProperty.call(obj, dontEnums[i])) {
                            keys.push(dontEnums[i]);
                        }
                    }
                }

                return keys;

                function createNonObjectKeys(value) {
                    var keys = [],
                        i;

                    if (typeof value !== 'string') {
                        return keys;
                    }

                    for (i = 0; i < value.length; i++) {
                        keys.push(String(i));
                    }

                    return keys;
                }
            },
            findKey: function (obj, value) {
                if (typeof obj !== 'object') {
                    return null;
                }

                var key;

                for (key in obj) {
                    if (obj[key] === value) {
                        return key;
                    }
                }

                return null;
            },
            merge: function (obj1, obj2) {
                var tools = tools,
                    copy1 = tools.clone(obj1),
                    copy2 = tools.clone(obj2);

                tools.array.forEach(tools.object.keys(copy2), function (key) {
                    if (typeof copy2[key] === 'object' && typeof copy1[key] === 'object') {
                        copy1[key] = tools.object.merge(copy1[key], copy2[key]);
                    } else {
                        copy1[key] = copy2[key];
                    }
                });

                return copy1;
            }
        },
        array: {
            indexOf: function (array, value) {
                if (typeof value == 'function') {
                    for (var i = 0, len = array.length; i < len; i++) {
                        if (value(array[i]))
                            return i;
                    }
                } else if (array.indexOf)
                    return array.indexOf(value);
                else {
                    for (i = 0, len = array.length; i < len; i++) {
                        if (array[i] === value)
                            return i;
                    }
                }
                return -1;
            },
            filter: function (array, fn, thisArg) {
                var ret = [];

                this.forEach(array, function (val, i) {
                    if (fn.call(thisArg, val, i, array)) {
                        ret.push(val);
                    }
                });

                return ret;
            },
            find: function (array, fn, thisArg) {
                var length = array.length,
                    i = 0;

                while (i < length) {
                    if (fn.call(thisArg, array[i], i, array)) {
                        return array[i];
                    }
                    i++;
                }

                return undefined;
            },
            forEach: function (array, fn, thisArg) {
                var len = array.length,
                    i;

                for (i = 0; i < len; i++) {
                    fn.call(thisArg, array[i], i, array);
                }
            },
            map: function (array, fn, thisArg) {
                var result = [];
                for (var i = 0; i < array.length; i++) {
                    result.push(fn.call(thisArg, array[i], i, array));
                }
                return result;
            },
            reduce: function (array, fn, initial, thisArg) {
                var acc = initial;
                for (var i = 0; i < array.length; i++) {
                    acc = fn.call(thisArg, acc, array[i], i, array);
                }
                return acc;
            },
            every: function (array, fn, thisArg) {
                // Empty arrays always return true.
                if (!array.length) {
                    return true;
                }

                var ret = this.filter(array, fn, thisArg);

                return array.length === ret.length;
            },
            some: function (array, fn, thisArg) {
                for (var i = 0; i < array.length; i++) {
                    if (fn.call(thisArg, array[i], i, array)) {
                        return true;
                    }
                }

                return false;
            }
        },
        style: {
            parse: {
                // Color list based on https://www.w3.org/TR/css-color-4/#named-colors.
                _colors: {
                    aliceblue: '#F0F8FF',
                    antiquewhite: '#FAEBD7',
                    aqua: '#00FFFF',
                    aquamarine: '#7FFFD4',
                    azure: '#F0FFFF',
                    beige: '#F5F5DC',
                    bisque: '#FFE4C4',
                    black: '#000000',
                    blanchedalmond: '#FFEBCD',
                    blue: '#0000FF',
                    blueviolet: '#8A2BE2',
                    brown: '#A52A2A',
                    burlywood: '#DEB887',
                    cadetblue: '#5F9EA0',
                    chartreuse: '#7FFF00',
                    chocolate: '#D2691E',
                    coral: '#FF7F50',
                    cornflowerblue: '#6495ED',
                    cornsilk: '#FFF8DC',
                    crimson: '#DC143C',
                    cyan: '#00FFFF',
                    darkblue: '#00008B',
                    darkcyan: '#008B8B',
                    darkgoldenrod: '#B8860B',
                    darkgray: '#A9A9A9',
                    darkgreen: '#006400',
                    darkgrey: '#A9A9A9',
                    darkkhaki: '#BDB76B',
                    darkmagenta: '#8B008B',
                    darkolivegreen: '#556B2F',
                    darkorange: '#FF8C00',
                    darkorchid: '#9932CC',
                    darkred: '#8B0000',
                    darksalmon: '#E9967A',
                    darkseagreen: '#8FBC8F',
                    darkslateblue: '#483D8B',
                    darkslategray: '#2F4F4F',
                    darkslategrey: '#2F4F4F',
                    darkturquoise: '#00CED1',
                    darkviolet: '#9400D3',
                    deeppink: '#FF1493',
                    deepskyblue: '#00BFFF',
                    dimgray: '#696969',
                    dimgrey: '#696969',
                    dodgerblue: '#1E90FF',
                    firebrick: '#B22222',
                    floralwhite: '#FFFAF0',
                    forestgreen: '#228B22',
                    fuchsia: '#FF00FF',
                    gainsboro: '#DCDCDC',
                    ghostwhite: '#F8F8FF',
                    gold: '#FFD700',
                    goldenrod: '#DAA520',
                    gray: '#808080',
                    green: '#008000',
                    greenyellow: '#ADFF2F',
                    grey: '#808080',
                    honeydew: '#F0FFF0',
                    hotpink: '#FF69B4',
                    indianred: '#CD5C5C',
                    indigo: '#4B0082',
                    ivory: '#FFFFF0',
                    khaki: '#F0E68C',
                    lavender: '#E6E6FA',
                    lavenderblush: '#FFF0F5',
                    lawngreen: '#7CFC00',
                    lemonchiffon: '#FFFACD',
                    lightblue: '#ADD8E6',
                    lightcoral: '#F08080',
                    lightcyan: '#E0FFFF',
                    lightgoldenrodyellow: '#FAFAD2',
                    lightgray: '#D3D3D3',
                    lightgreen: '#90EE90',
                    lightgrey: '#D3D3D3',
                    lightpink: '#FFB6C1',
                    lightsalmon: '#FFA07A',
                    lightseagreen: '#20B2AA',
                    lightskyblue: '#87CEFA',
                    lightslategray: '#778899',
                    lightslategrey: '#778899',
                    lightsteelblue: '#B0C4DE',
                    lightyellow: '#FFFFE0',
                    lime: '#00FF00',
                    limegreen: '#32CD32',
                    linen: '#FAF0E6',
                    magenta: '#FF00FF',
                    maroon: '#800000',
                    mediumaquamarine: '#66CDAA',
                    mediumblue: '#0000CD',
                    mediumorchid: '#BA55D3',
                    mediumpurple: '#9370DB',
                    mediumseagreen: '#3CB371',
                    mediumslateblue: '#7B68EE',
                    mediumspringgreen: '#00FA9A',
                    mediumturquoise: '#48D1CC',
                    mediumvioletred: '#C71585',
                    midnightblue: '#191970',
                    mintcream: '#F5FFFA',
                    mistyrose: '#FFE4E1',
                    moccasin: '#FFE4B5',
                    navajowhite: '#FFDEAD',
                    navy: '#000080',
                    oldlace: '#FDF5E6',
                    olive: '#808000',
                    olivedrab: '#6B8E23',
                    orange: '#FFA500',
                    orangered: '#FF4500',
                    orchid: '#DA70D6',
                    palegoldenrod: '#EEE8AA',
                    palegreen: '#98FB98',
                    paleturquoise: '#AFEEEE',
                    palevioletred: '#DB7093',
                    papayawhip: '#FFEFD5',
                    peachpuff: '#FFDAB9',
                    peru: '#CD853F',
                    pink: '#FFC0CB',
                    plum: '#DDA0DD',
                    powderblue: '#B0E0E6',
                    purple: '#800080',
                    rebeccapurple: '#663399',
                    red: '#FF0000',
                    rosybrown: '#BC8F8F',
                    royalblue: '#4169E1',
                    saddlebrown: '#8B4513',
                    salmon: '#FA8072',
                    sandybrown: '#F4A460',
                    seagreen: '#2E8B57',
                    seashell: '#FFF5EE',
                    sienna: '#A0522D',
                    silver: '#C0C0C0',
                    skyblue: '#87CEEB',
                    slateblue: '#6A5ACD',
                    slategray: '#708090',
                    slategrey: '#708090',
                    snow: '#FFFAFA',
                    springgreen: '#00FF7F',
                    steelblue: '#4682B4',
                    tan: '#D2B48C',
                    teal: '#008080',
                    thistle: '#D8BFD8',
                    tomato: '#FF6347',
                    turquoise: '#40E0D0',
                    violet: '#EE82EE',
                    windowtext: 'windowtext',
                    wheat: '#F5DEB3',
                    white: '#FFFFFF',
                    whitesmoke: '#F5F5F5',
                    yellow: '#FFFF00',
                    yellowgreen: '#9ACD32'
                },

                _borderStyle: [
                    'none',
                    'hidden',
                    'dotted',
                    'dashed',
                    'solid',
                    'double',
                    'groove',
                    'ridge',
                    'inset',
                    'outset'
                ],

                _widthRegExp: /^(thin|medium|thick|[\+-]?\d+(\.\d+)?[a-z%]+|[\+-]?0+(\.0+)?|\.\d+[a-z%]+)$/,

                _rgbaRegExp: /rgba?\(\s*\d+%?\s*,\s*\d+%?\s*,\s*\d+%?\s*(?:,\s*[0-9.]+\s*)?\)/gi,

                _hslaRegExp: /hsla?\(\s*[0-9.]+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[0-9.]+\s*)?\)/gi,


                background: function (value) {
                    var ret = {},
                        colors = this._findColor(value);

                    if (colors.length) {
                        ret.color = colors[0];

                        tools.array.forEach(colors, function (colorToken) {
                            value = value.replace(colorToken, '');
                        });
                    }

                    value = tools.trim(value);

                    if (value) {
                        // If anything was left unprocessed include it as unprocessed part.
                        ret.unprocessed = value;
                    }

                    return ret;
                },

                margin: function (value) {
                    return tools.style.parse.sideShorthand(value, function (width) {
                        return width.match(/(?:\-?[\.\d]+(?:%|\w*)|auto|inherit|initial|unset|revert)/g) || ['0px'];
                    });
                },

                sideShorthand: function (value, split) {
                    var ret = {},
                        parts = split ? split(value) : value.split(/\s+/);

                    switch (parts.length) {
                        case 1:
                            mapStyles([0, 0, 0, 0]);
                            break;
                        case 2:
                            mapStyles([0, 1, 0, 1]);
                            break;
                        case 3:
                            mapStyles([0, 1, 2, 1]);
                            break;
                        case 4:
                            mapStyles([0, 1, 2, 3]);
                            break;
                    }

                    function mapStyles(map) {
                        ret.top = parts[map[0]];
                        ret.right = parts[map[1]];
                        ret.bottom = parts[map[2]];
                        ret.left = parts[map[3]];
                    }

                    return ret;
                },

                border: function (value) {
                    return tools.style.border.fromCssRule(value);
                },

                _findColor: function (value) {
                    var ret = [],
                        arrayTools = tools.array;


                    // Check for rgb(a).
                    ret = ret.concat(value.match(this._rgbaRegExp) || []);

                    // Check for hsl(a).
                    ret = ret.concat(value.match(this._hslaRegExp) || []);

                    ret = ret.concat(arrayTools.filter(value.split(/\s+/), function (colorEntry) {
                        // Check for hex format.
                        if (colorEntry.match(/^\#[a-f0-9]{3}(?:[a-f0-9]{3})?$/gi)) {
                            return true;
                        }

                        // Check for preset names.
                        return colorEntry.toLowerCase() in tools.style.parse._colors;
                    }));

                    return ret;
                }
            }
        },
        cssStyleToDomStyle: (function () {
            var test = document.createElement('div').style;

            var cssFloat = (typeof test.cssFloat != 'undefined') ? 'cssFloat' : (typeof test.styleFloat != 'undefined') ? 'styleFloat' : 'float';

            return function (cssName) {
                if (cssName == 'float')
                    return cssFloat;
                else {
                    return cssName.replace(/-./g, function (match) {
                        return match.substr(1).toUpperCase();
                    });
                }
            };
        })(),
    };

    tools.style.border = tools.createClass({
        $: function (props) {
            props = props || {};
            this.width = props.width;
            this.style = props.style;
            this.color = props.color;
            this._.normalize();
        },

        _: {
            normalizeMap: {
                color: [
                    [/windowtext/g, 'black']
                ]
            },

            normalize: function () {
                for (var propName in this._.normalizeMap) {
                    var val = this[propName];

                    if (val) {
                        this[propName] = tools.array.reduce(this._.normalizeMap[propName], function (cur, rule) {
                            return cur.replace(rule[0], rule[1]);
                        }, val);
                    }
                }
            }
        },

        proto: {
            toString: function () {
                return tools.array.filter([this.width, this.style, this.color], function (item) {
                    return !!item;
                }).join(' ');
            }
        },

        statics: {
            fromCssRule: function (value) {
                var props = {},
                    input = value.split(/\s+/g),
                    parseColor = tools.style.parse._findColor(value);

                if (parseColor.length) {
                    props.color = parseColor[0];
                }

                tools.array.forEach(input, function (val) {
                    if (!props.style) {
                        if (tools.indexOf(tools.style.parse._borderStyle, val) !== -1) {
                            props.style = val;
                            return;
                        }
                    }

                    if (!props.width) {
                        if (tools.style.parse._widthRegExp.test(val)) {
                            props.width = val;
                            return;
                        }
                    }

                });

                return new tools.style.border(props);
            },

            splitCssValues: function (styles, fallback) {
                var types = ['width', 'style', 'color'],
                    sides = ['top', 'right', 'bottom', 'left'];

                fallback = fallback || {};

                var stylesMap = tools.array.reduce(types, function (cur, type) {
                    var style = styles['border-' + type] || fallback[type];

                    cur[type] = style ? tools.style.parse.sideShorthand(style) : null;

                    return cur;
                }, {});

                return tools.array.reduce(sides, function (cur, side) {
                    var map = {};

                    for (var style in stylesMap) {
                        // Prefer property with greater specificity e.g
                        // `border-top-color` over `border-color`.
                        var sideProperty = styles['border-' + side + '-' + style];
                        if (sideProperty) {
                            map[style] = sideProperty;
                        } else {
                            map[style] = stylesMap[style] && stylesMap[style][side];
                        }
                    }

                    cur['border-' + side] = new tools.style.border(map);

                    return cur;
                }, {});
            }
        }
    });

    Style = {
        setStyle: function (element, key, value, dontOverwrite) {
            var styles = tools.parseCssText(element.attributes.style);

            if (dontOverwrite && styles[key]) {
                return;
            }

            if (value === '') {
                delete styles[key];
            } else {
                styles[key] = value;
            }

            element.attributes.style = tools.writeCssText(styles);
        },

        convertStyleToPx: function (element) {
            var style = element.attributes.style;

            if (!style) {
                return;
            }

            element.attributes.style = style.replace(/\d+(\.\d+)?pt/g, function (match) {
                return tools.convertToPx(match) + 'px';
            });
        },

        // Map attributes to styles.
        mapStyles: function (element, attributeStyleMap) {
            for (var attribute in attributeStyleMap) {
                if (element.attributes[attribute]) {
                    if (typeof attributeStyleMap[attribute] === 'function') {
                        attributeStyleMap[attribute](element.attributes[attribute]);
                    } else {
                        Style.setStyle(element, attributeStyleMap[attribute], element.attributes[attribute]);
                    }
                    delete element.attributes[attribute];
                }
            }
        },

        // Maps common attributes to styles.
        mapCommonStyles: function (element) {
            return Style.mapStyles(element, {
                vAlign: function (value) {
                    Style.setStyle(element, 'vertical-align', value);
                },
                width: function (value) {
                    Style.setStyle(element, 'width', fixValue(value));
                },
                height: function (value) {
                    Style.setStyle(element, 'height', fixValue(value));
                }
            });
        },

        normalizedStyles: function (element, editor) {

            // Some styles and style values are redundant, so delete them.
            var resetStyles = [
                'background-color:transparent',
                'border-image:none',
                'color:windowtext',
                'direction:ltr',
                'mso-',
                'visibility:visible',
                'div:border:none'
            ],
                textStyles = [
                    'font-family',
                    'font',
                    'font-size',
                    'color',
                    'background-color',
                    'line-height',
                    'text-decoration'
                ],
                matchStyle = function () {
                    var keys = [];
                    for (var i = 0; i < arguments.length; i++) {
                        if (arguments[i]) {
                            keys.push(arguments[i]);
                        }
                    }

                    return tools.indexOf(resetStyles, keys.join(':')) !== -1;
                },
                removeFontStyles = plugins.pastetools.getConfigValue(editor, 'removeFontStyles') === true;

            var styles = tools.parseCssText(element.attributes.style);

            if (element.name == 'cke:li') {

                // IE8 tries to emulate list indentation with a combination of
                // text-indent and left margin. Normalize this. Note that IE8 styles are uppercase.
                if (styles['TEXT-INDENT'] && styles.MARGIN) {
                    element.attributes['cke-indentation'] = plug.lists.getElementIndentation(element);
                    styles.MARGIN = styles.MARGIN.replace(/(([\w\.]+ ){3,3})[\d\.]+(\w+$)/, '$10$3');
                } else {
                    // Remove text indent in other cases, because it works differently with lists in html than in Word.
                    delete styles['TEXT-INDENT'];
                }
                delete styles['text-indent'];
            }

            var keys = tools.object.keys(styles);

            for (var i = 0; i < keys.length; i++) {
                var styleName = keys[i].toLowerCase(),
                    styleValue = styles[keys[i]],
                    indexOf = tools.indexOf,
                    toBeRemoved = removeFontStyles && indexOf(textStyles, styleName.toLowerCase()) !== -1;

                if (toBeRemoved || matchStyle(null, styleName, styleValue) ||
                    matchStyle(null, styleName.replace(/\-.*$/, '-')) ||
                    matchStyle(null, styleName) ||
                    matchStyle(element.name, styleName, styleValue) ||
                    matchStyle(element.name, styleName.replace(/\-.*$/, '-')) ||
                    matchStyle(element.name, styleName) ||
                    matchStyle(styleValue)
                ) {
                    delete styles[keys[i]];
                }
            }

            var keepZeroMargins = plugins.pastetools.getConfigValue(editor, 'keepZeroMargins');
            // Still some elements might have shorthand margins or longhand with zero values.
            parseShorthandMargins(styles);
            normalizeMargins();

            return tools.writeCssText(styles);

            function normalizeMargins() {
                var keys = ['top', 'right', 'bottom', 'left'];
                tools.array.forEach(keys, function (key) {
                    key = 'margin-' + key;
                    if (!(key in styles)) {
                        return;
                    }

                    var value = tools.convertToPx(styles[key]);
                    // We need to get rid of margins, unless they are allowed in config (#2935).
                    if (value || keepZeroMargins) {
                        styles[key] = value ? value + 'px' : 0;
                    } else {
                        delete styles[key];
                    }
                });
            }
        },


        createStyleStack: function (element, filter, editor, skipStyles) {
            var children = [],
                i;

            element.filterChildren(filter);

            // Store element's children somewhere else.
            for (i = element.children.length - 1; i >= 0; i--) {
                children.unshift(element.children[i]);
                element.children[i].remove();
            }

            Style.sortStyles(element);

            // Create a stack of spans with each containing one style.
            var styles = tools.parseCssText(Style.normalizedStyles(element, editor)),
                innermostElement = element,
                styleTopmost = element.name === 'span'; // Ensure that the root element retains at least one style.

            for (var style in styles) {
                if (style.match(skipStyles || /margin((?!-)|-left|-top|-bottom|-right)|text-indent|text-align|width|border|padding/i)) {
                    continue;
                }

                if (styleTopmost) {
                    styleTopmost = false;
                    continue;
                }

                var newElement = new htmlParser.element('span');

                newElement.attributes.style = style + ':' + styles[style];

                innermostElement.add(newElement);
                innermostElement = newElement;

                delete styles[style];
            }

            if (!tools.isEmpty(styles)) {
                element.attributes.style = tools.writeCssText(styles);
            } else {
                delete element.attributes.style;
            }

            // Add the stored children to the innermost span.
            for (i = 0; i < children.length; i++) {
                innermostElement.add(children[i]);
            }
        },

        // Some styles need to be stacked in a particular order to work properly.
        sortStyles: function (element) {
            var orderedStyles = [
                'border',
                'border-bottom',
                'font-size',
                'background'
            ],
                style = tools.parseCssText(element.attributes.style),
                keys = tools.object.keys(style),
                sortedKeys = [],
                nonSortedKeys = [];

            // Divide styles into sorted and non-sorted, because Array.prototype.sort()
            // requires a transitive relation.
            for (var i = 0; i < keys.length; i++) {
                if (tools.indexOf(orderedStyles, keys[i].toLowerCase()) !== -1) {
                    sortedKeys.push(keys[i]);
                } else {
                    nonSortedKeys.push(keys[i]);
                }
            }

            // For styles in orderedStyles[] enforce the same order as in orderedStyles[].
            sortedKeys.sort(function (a, b) {
                var aIndex = tools.indexOf(orderedStyles, a.toLowerCase());
                var bIndex = tools.indexOf(orderedStyles, b.toLowerCase());

                return aIndex - bIndex;
            });

            keys = [].concat(sortedKeys, nonSortedKeys);

            var sortedStyles = {};

            for (i = 0; i < keys.length; i++) {
                sortedStyles[keys[i]] = style[keys[i]];
            }

            element.attributes.style = tools.writeCssText(sortedStyles);
        },

        pushStylesLower: function (element, exceptions, wrapText) {

            if (!element.attributes.style ||
                element.children.length === 0) {
                return false;
            }

            exceptions = exceptions || {};

            // Entries ending with a dash match styles that start with
            // the entry name, e.g. 'border-' matches 'border-style', 'border-color' etc.
            var retainedStyles = {
                'list-style-type': true,
                'width': true,
                'height': true,
                'border': true,
                'border-': true
            };

            var styles = tools.parseCssText(element.attributes.style);

            for (var style in styles) {
                if (style.toLowerCase() in retainedStyles ||
                    retainedStyles[style.toLowerCase().replace(/\-.*$/, '-')] ||
                    style.toLowerCase() in exceptions) {
                    continue;
                }

                var pushed = false;

                for (var i = 0; i < element.children.length; i++) {
                    var child = element.children[i];

                    if (child.type === NodeType.NODE_TEXT && wrapText) {
                        var wrapper = new htmlParser.element('span');
                        wrapper.setHtml(child.value);
                        child.replaceWith(wrapper);
                        child = wrapper;
                    }

                    if (child.type !== NodeType.NODE_ELEMENT) {
                        continue;
                    }

                    pushed = true;

                    Style.setStyle(child, style, styles[style]);
                }

                if (pushed) {
                    delete styles[style];
                }
            }

            element.attributes.style = tools.writeCssText(styles);

            return true;
        },

        inliner: {
            filtered: [
                'break-before',
                'break-after',
                'break-inside',
                'page-break',
                'page-break-before',
                'page-break-after',
                'page-break-inside'
            ],
            parse: function (styles) {
                var parseCssText = tools.parseCssText,
                    filterStyles = Style.inliner.filter,
                    sheet = styles.is ? styles.$.sheet : createIsolatedStylesheet(styles);

                function createIsolatedStylesheet(styles) {
                    var style = new dom.element('style'),
                        iframe = new dom.element('iframe');

                    iframe.hide();
                    dom.document.getBody().append(iframe);
                    iframe.$.contentDocument.documentElement.appendChild(style.$);

                    style.$.textContent = styles;
                    iframe.remove();
                    return style.$.sheet;
                }

                function getStyles(cssText) {
                    var startIndex = cssText.indexOf('{'),
                        endIndex = cssText.indexOf('}');

                    return parseCssText(cssText.substring(startIndex + 1, endIndex), true);
                }

                var parsedStyles = [],
                    rules,
                    i;

                if (sheet) {
                    rules = sheet.cssRules;

                    for (i = 0; i < rules.length; i++) {
                        // To detect if the rule contains styles and is not an at-rule, it's enough to check rule's type.
                        if (rules[i].type === window.CSSRule.STYLE_RULE) {
                            parsedStyles.push({
                                selector: rules[i].selectorText,
                                styles: filterStyles(getStyles(rules[i].cssText))
                            });
                        }
                    }
                }
                return parsedStyles;
            },
            filter: function (stylesObj) {
                var toRemove = Style.inliner.filtered,
                    indexOf = tools.array.indexOf,
                    newObj = {},
                    style;

                for (style in stylesObj) {
                    if (indexOf(toRemove, style) === -1) {
                        newObj[style] = stylesObj[style];
                    }
                }

                return newObj;
            },
            sort: function (stylesArray) {

                // Returns comparison function which sorts all selectors in a way that class selectors are ordered
                // before the rest of the selectors. The order of the selectors with the same specificity
                // is reversed so that the most important will be applied first.
                function getCompareFunction(styles) {
                    var order = tools.array.map(styles, function (item) {
                        return item.selector;
                    });

                    return function (style1, style2) {
                        var value1 = isClassSelector(style1.selector) ? 1 : 0,
                            value2 = isClassSelector(style2.selector) ? 1 : 0,
                            result = value2 - value1;

                        // If the selectors have same specificity, the latter one should
                        // have higher priority (goes first).
                        return result !== 0 ? result :
                            order.indexOf(style2.selector) - order.indexOf(style1.selector);
                    };
                }

                // True if given CSS selector contains a class selector.
                function isClassSelector(selector) {
                    return ('' + selector).indexOf('.') !== -1;
                }

                return stylesArray.sort(getCompareFunction(stylesArray));
            },
            inline: function (html) {
                var parseStyles = Style.inliner.parse,
                    sortStyles = Style.inliner.sort,
                    document = createTempDocument(html),
                    stylesTags = document.find('style'),
                    stylesArray = sortStyles(parseStyleTags(stylesTags));

                function createTempDocument(html) {
                    var parser = new DOMParser(),
                        document = parser.parseFromString(html, 'text/html');

                    return new dom.document(document);
                }

                function parseStyleTags(stylesTags) {
                    var styles = [],
                        i;

                    for (i = 0; i < stylesTags.count(); i++) {
                        styles = styles.concat(parseStyles(stylesTags.getItem(i)));
                    }

                    return styles;
                }

                function applyStyle(document, selector, style) {
                    var elements = document.find(selector),
                        element,
                        oldStyle,
                        newStyle,
                        i;

                    parseShorthandMargins(style);

                    for (i = 0; i < elements.count(); i++) {
                        element = elements.getItem(i);

                        oldStyle = tools.parseCssText(element.getAttribute('style'));

                        parseShorthandMargins(oldStyle);
                        // The styles are applied with decreasing priority so we do not want
                        // to overwrite the existing properties.
                        newStyle = tools.extend({}, oldStyle, style);
                        element.setAttribute('style', tools.writeCssText(newStyle));
                    }
                }

                tools.array.forEach(stylesArray, function (style) {
                    applyStyle(document, style.selector, style.styles);
                });

                return document;
            }
        }
    };

    plugins = {
        pastetools: {
            getConfigValue: function (editor, configVariable) {
                if (!editor || !editor.config) {
                    return;
                }

                var tools = tools,
                    config = editor.config,
                    configVariables = tools.object.keys(config),
                    names = [
                        'pasteTools_' + configVariable,
                        'pasteFromWord_' + configVariable,
                        'pasteFromWord' + tools.capitalize(configVariable, true)
                    ],
                    found = tools.array.find(names, function (name) {
                        return tools.array.indexOf(configVariables, name) !== -1;
                    });

                return config[found];
            },
            filters:{
                common:{
                    elements : {
                        /**
                         * Replaces an element with its children.
                         *
                         * This function is customized to work inside filters.
                         *
                         * @private
                         * @since 4.13.0
                         * @param {CKEDITOR.htmlParser.element} element
                         * @member CKEDITOR.plugins.pastetools.filters.common.elements
                         */
                        replaceWithChildren: function( element ) {
                            for ( var i = element.children.length - 1; i >= 0; i-- ) {
                                element.children[ i ].insertAfter( element );
                            }
                        }
                    }
                }
            }
        },
        rules: function (html, editor, filter) {
            var availableFonts = getMatchingFonts(editor);
            return {
                elements: {
                    '^': function (element) {
                        removeSuperfluousStyles(element);
                        // Don't use "attributeNames", because those rules are applied after elements.
                        // Normalization is required at the very begininng.
                        normalizeAttributesName(element);
                    },

                    'span': function (element) {
                        if (element.hasClass('Apple-converted-space')) {
                            return new htmlParser.text(' ');
                        }
                    },

                    'table': function (element) {
                        element.filterChildren(filter);

                        var parent = element.parent,
                            root = parent && parent.parent,
                            parentChildren,
                            i;

                        if (parent.name && parent.name === 'div' && parent.attributes.align &&
                            tools.object.keys(parent.attributes).length === 1 && parent.children.length === 1) {

                            // If align is the only attribute of parent.
                            element.attributes.align = parent.attributes.align;

                            parentChildren = parent.children.splice(0);

                            element.remove();
                            for (i = parentChildren.length - 1; i >= 0; i--) {
                                root.add(parentChildren[i], parent.getIndex());
                            }
                            parent.remove();
                        }

                        Style.convertStyleToPx(element);

                    },

                    'tr': function (element) {
                        // Attribues are moved to 'td' elements.
                        element.attributes = {};
                    },

                    'td': function (element) {
                        var ascendant = element.getAscendant('table'),
                            ascendantStyle = tools.parseCssText(ascendant.attributes.style, true);

                        // Sometimes the background is set for the whole table - move it to individual cells.
                        var background = ascendantStyle.background;
                        if (background) {
                            Style.setStyle(element, 'background', background, true);
                        }

                        var backgroundColor = ascendantStyle['background-color'];
                        if (backgroundColor) {
                            Style.setStyle(element, 'background-color', backgroundColor, true);
                        }

                        var styles = tools.parseCssText(element.attributes.style, true),
                            borderStyles = styles.border ? tools.style.border.fromCssRule(styles.border) : {},
                            borders = tools.style.border.splitCssValues(styles, borderStyles),
                            tmpStyles = tools.clone(styles);

                        // Drop all border styles before continue,
                        // so there are no leftovers which may conflict with
                        // new border styles.
                        for (var key in tmpStyles) {
                            if (key.indexOf('border') == 0) {
                                delete tmpStyles[key];
                            }
                        }

                        element.attributes.style = tools.writeCssText(tmpStyles);

                        // Unify background color property.
                        if (styles.background) {
                            var bg = tools.style.parse.background(styles.background);

                            if (bg.color) {
                                Style.setStyle(element, 'background-color', bg.color, true);
                                Style.setStyle(element, 'background', '');
                            }
                        }

                        // Unify border properties.
                        for (var border in borders) {
                            var borderStyle = styles[border] ?
                                tools.style.border.fromCssRule(styles[border])
                                : borders[border];

                            // No need for redundant shorthand properties if style is disabled.
                            if (borderStyle.style === 'none') {
                                Style.setStyle(element, border, 'none');
                            } else {
                                Style.setStyle(element, border, borderStyle.toString());
                            }
                        }

                        Style.mapCommonStyles(element);

                        Style.convertStyleToPx(element);

                        Style.createStyleStack(element, filter, editor,
                            /margin|text\-align|padding|list\-style\-type|width|height|border|white\-space|vertical\-align|background/i);
                    },

                    'font': function (element) {
                        if (element.attributes.face && availableFonts) {
                            element.attributes.face = replaceWithMatchingFont(element.attributes.face, availableFonts);
                        }
                    }
                }
            };
        },
        pastefromword: {
            rules: function (html, editor, filter) {
                var msoListsDetected = Boolean(html.match(/mso-list:\s*l\d+\s+level\d+\s+lfo\d+/)),
                    shapesIds = [],
                    rules = {
                        root: function (element) {
                            element.filterChildren(filter);

                            plugins.pastefromword.lists.cleanup(List.createLists(element));
                        },
                        elementNames: [
                            [(/^\?xml:namespace$/), ''],
                            [/^v:shapetype/, ''],
                            [new RegExp(invalidTags.join('|')), ''] // Remove invalid tags.
                        ],
                        elements: {
                            'a': function (element) {
                                // Redundant anchor created by IE8.
                                if (element.attributes.name) {
                                    if (element.attributes.name == '_GoBack') {
                                        delete element.name;
                                        return;
                                    }

                                    // Garbage links that go nowhere.
                                    if (element.attributes.name.match(/^OLE_LINK\d+$/)) {
                                        delete element.name;
                                        return;
                                    }
                                }

                                if (element.attributes.href && element.attributes.href.match(/#.+$/)) {
                                    var name = element.attributes.href.match(/#(.+)$/)[1];
                                    links[name] = element;
                                }

                                if (element.attributes.name && links[element.attributes.name]) {
                                    var link = links[element.attributes.name];
                                    link.attributes.href = link.attributes.href.replace(/.*#(.*)$/, '#$1');
                                }

                            },
                            'div': function (element) {
                                // Don't allow to delete page break element (#3220).
                                if (editor.plugins.pagebreak && element.attributes['data-cke-pagebreak']) {
                                    return element;
                                }

                                Style.createStyleStack(element, filter, editor);
                            },
                            'img': function (element) {
                                // If the parent is DocumentFragment it does not have any attributes.  
                                if (element.parent && element.parent.attributes) {
                                    var attrs = element.parent.attributes,
                                        style = attrs.style || attrs.STYLE;
                                    if (style && style.match(/mso\-list:\s?Ignore/)) {
                                        element.attributes['cke-ignored'] = true;
                                    }
                                }

                                Style.mapCommonStyles(element);

                                if (element.attributes.src && element.attributes.src.match(/^file:\/\//) &&
                                    element.attributes.alt && element.attributes.alt.match(/^https?:\/\//)) {
                                    element.attributes.src = element.attributes.alt;
                                }

                                var imgShapesIds = element.attributes['v:shapes'] ? element.attributes['v:shapes'].split(' ') : [];
                                // Check whether attribute contains shapes recognised earlier (stored in global list of shapesIds).
                                // If so, add additional data-attribute to img tag.
                                var isShapeFromList = tools.array.every(imgShapesIds, function (shapeId) {
                                    return shapesIds.indexOf(shapeId) > -1;
                                });
                                if (imgShapesIds.length && isShapeFromList) {
                                    // As we don't know how to process shapes we can remove them.
                                    return false;
                                }

                            },
                            'p': function (element) {
                                element.filterChildren(filter);

                                if (element.attributes.style && element.attributes.style.match(/display:\s*none/i)) {
                                    return false;
                                }

                                if (List.thisIsAListItem(editor, element)) {
                                    if (Heuristics.isEdgeListItem(editor, element)) {
                                        Heuristics.cleanupEdgeListItem(element);
                                    }

                                    List.convertToFakeListItem(editor, element);

                                    // IE pastes nested paragraphs in list items, which is different from other browsers. 
                                    // There's a possibility that list item will contain multiple paragraphs, in that case we want
                                    // to split them with BR.
                                    tools.array.reduce(element.children, function (paragraphsReplaced, node) {
                                        if (node.name === 'p') {
                                            // If there were already paragraphs replaced, put a br before this paragraph, so that
                                            // it's inline children are displayed in a next line.
                                            if (paragraphsReplaced > 0) {
                                                var br = new htmlParser.element('br');
                                                br.insertBefore(node);
                                            }

                                            node.replaceWithChildren();
                                            paragraphsReplaced += 1;
                                        }

                                        return paragraphsReplaced;
                                    }, 0);
                                } else {
                                    // In IE list level information is stored in <p> elements inside <li> elements.
                                    var container = element.getAscendant(function (element) {
                                        return element.name == 'ul' || element.name == 'ol';
                                    }),
                                        style = tools.parseCssText(element.attributes.style);
                                    if (container &&
                                        !container.attributes['cke-list-level'] &&
                                        style['mso-list'] &&
                                        style['mso-list'].match(/level/)) {
                                        container.attributes['cke-list-level'] = style['mso-list'].match(/level(\d+)/)[1];
                                    }

                                    // Adapt paragraph formatting to editor's convention according to enter-mode (#423).
                                    if (editor.config.enterMode == NodeType.ENTER_BR) {
                                        // We suffer from attribute/style lost in this situation.
                                        delete element.name;
                                        element.add(new htmlParser.element('br'));
                                    }

                                }

                                Style.createStyleStack(element, filter, editor);
                            },
                            'pre': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'h1': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'h2': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'h3': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'h4': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'h5': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'h6': function (element) {
                                if (List.thisIsAListItem(editor, element)) List.convertToFakeListItem(editor, element);

                                Style.createStyleStack(element, filter, editor);
                            },
                            'font': function (element) {
                                if (element.getHtml().match(/^\s*$/)) {
                                    // There might be font tag directly in document fragment, we cannot replace it with a textnode as this generates
                                    // superfluous spaces in output. What later might be transformed into empty paragraphs, so just remove such element.
                                    if (element.parent.type === NodeType.NODE_ELEMENT) {
                                        new htmlParser.text(' ').insertAfter(element);
                                    }
                                    return false;
                                }

                                if (editor && editor.config.pasteFromWordRemoveFontStyles === true && element.attributes.size) {
                                    // font[size] are still used by old IEs for font size.
                                    delete element.attributes.size;
                                }

                                // Create style stack for td/th > font if only class
                                // and style attributes are present. Such markup is produced by Excel.
                                if (dtd.tr[element.parent.name] &&
                                    tools.arrayCompare(tools.object.keys(element.attributes), ['class', 'style'])) {

                                    Style.createStyleStack(element, filter, editor);
                                } else {
                                    createAttributeStack(element, filter);
                                }
                            },
                            'ul': function (element) {
                                if (!msoListsDetected) {
                                    // List should only be processed if we're sure we're working with Word.
                                    return;
                                }

                                // Edge case from 11683 - an unusual way to create a level 2 list.
                                if (element.parent.name == 'li' && tools.indexOf(element.parent.children, element) === 0) {
                                    Style.setStyle(element.parent, 'list-style-type', 'none');
                                }

                                List.dissolveList(element);
                                return false;
                            },
                            'li': function (element) {
                                Heuristics.correctLevelShift(element);

                                if (!msoListsDetected) {
                                    return;
                                }

                                element.attributes.style = Style.normalizedStyles(element, editor);

                                Style.pushStylesLower(element);
                            },
                            'ol': function (element) {
                                if (!msoListsDetected) {
                                    // List should only be processed if we're sure we're working with Word. 
                                    return;
                                }

                                // Fix edge-case where when a list skips a level in IE11, the <ol> element
                                // is implicitly surrounded by a <li>.
                                if (element.parent.name == 'li' && tools.indexOf(element.parent.children, element) === 0) {
                                    Style.setStyle(element.parent, 'list-style-type', 'none');
                                }

                                List.dissolveList(element);
                                return false;
                            },
                            'span': function (element) {
                                element.filterChildren(filter);

                                element.attributes.style = Style.normalizedStyles(element, editor);

                                if (!element.attributes.style ||
                                    // Remove garbage bookmarks that disrupt the content structure.
                                    element.attributes.style.match(/^mso\-bookmark:OLE_LINK\d+$/) ||
                                    element.getHtml().match(/^(\s|&nbsp;)+$/)) {

                                    commonFilter.elements.replaceWithChildren(element);
                                    return false;
                                }

                                if (element.attributes.style.match(/FONT-FAMILY:\s*Symbol/i)) {
                                    element.forEach(function (node) {
                                        node.value = node.value.replace(/&nbsp;/g, '');
                                    }, NodeType.NODE_TEXT, true);
                                }

                                Style.createStyleStack(element, filter, editor);
                            },

                            'v:imagedata': remove,
                            // This is how IE8 presents images.
                            'v:shape': function (element) {
                                // There are 3 paths:
                                // 1. There is regular `v:shape` (no `v:imagedata` inside).
                                // 2. There is a simple situation with `v:shape` with `v:imagedata` inside. We can remove such element and rely on `img` tag found later on.
                                // 3. There is a complicated situation where we cannot find proper `img` tag after `v:shape` or there is some canvas element.
                                // 		a) If shape is a child of v:group, then most probably it belongs to canvas, so we need to treat it as in path 1.
                                // 		b) In other cases, most probably there is no related `img` tag. We need to transform `v:shape` into `img` tag (IE8 integration).

                                var duplicate = false,
                                    child = element.getFirst('v:imagedata');

                                // Path 1:
                                if (child === null) {
                                    shapeTagging(element);
                                    return;
                                }

                                // Path 2:
                                // Sometimes a child with proper ID might be nested in other tag.
                                element.parent.find(function (child) {
                                    if (child.name == 'img' && child.attributes &&
                                        child.attributes['v:shapes'] == element.attributes.id) {

                                        duplicate = true;
                                    }
                                }, true);

                                if (duplicate) {
                                    return false;
                                } else {

                                    // Path 3:
                                    var src = '';

                                    // 3.a) Filter out situation when canvas is used. In such scenario there is v:group containing v:shape containing v:imagedata.
                                    // We streat such v:shapes as in Path 1.
                                    if (element.parent.name === 'v:group') {
                                        shapeTagging(element);
                                        return;
                                    }

                                    // 3.b) Most probably there is no img tag later on, so we need to transform this v:shape into img. This should only happen on IE8.
                                    element.forEach(function (child) {
                                        if (child.attributes && child.attributes.src) {
                                            src = child.attributes.src;
                                        }
                                    }, NodeType.NODE_ELEMENT, true);

                                    element.filterChildren(filter);

                                    element.name = 'img';
                                    element.attributes.src = element.attributes.src || src;

                                    delete element.attributes.type;
                                }

                                return;
                            },

                            'style': function () {
                                // We don't want to let any styles in. Firefox tends to add some.
                                return false;
                            },

                            'object': function (element) {
                                // The specs about object `data` attribute:
                                // 		Address of the resource as a valid URL. At least one of data and type must be defined.
                                // If there is not `data`, skip the object element.  
                                return !!(element.attributes && element.attributes.data);
                            },

                            // Integrate page breaks with `pagebreak` plugin (#2598).
                            'br': function (element) {
                                if (!editor.plugins.pagebreak) {
                                    return;
                                }

                                var styles = tools.parseCssText(element.attributes.style, true);

                                // Safari uses `break-before` instead of `page-break-before` to recognize page breaks.
                                if (styles['page-break-before'] === 'always' || styles['break-before'] === 'page') {
                                    var pagebreakEl = CKEDITOR.plugins.pagebreak.createElement(editor);
                                    return htmlParser.fragment.fromHtml(pagebreakEl.getOuterHtml()).children[0];
                                }
                            }
                        },
                        attributes: {
                            'style': function (styles, element) {
                                // Returning false deletes the attribute.
                                return Style.normalizedStyles(element, editor) || false;
                            },
                            'class': function (classes) {
                                // The (el\d+)|(font\d+) are default Excel classes for table cells and text.
                                return falseIfEmpty(classes.replace(/(el\d+)|(font\d+)|msonormal|msolistparagraph\w*/ig, ''));
                            },
                            'cellspacing': remove,
                            'cellpadding': remove,
                            'border': remove,
                            'v:shapes': remove,
                            'o:spid': remove
                        },
                        comment: function (element) {
                            if (element.match(/\[if.* supportFields.*\]/)) {
                                inComment++;
                            }
                            if (element == '[endif]') {
                                inComment = inComment > 0 ? inComment - 1 : 0;
                            }
                            return false;
                        },
                        text: function (content, node) {
                            if (inComment) {
                                return '';
                            }

                            var grandparent = node.parent && node.parent.parent;

                            if (grandparent && grandparent.attributes && grandparent.attributes.style && grandparent.attributes.style.match(/mso-list:\s*ignore/i)) {
                                return content.replace(/&nbsp;/g, ' ');
                            }

                            return content;
                        }
                    };

                tools.array.forEach(shapeTags, function (shapeTag) {
                    rules.elements[shapeTag] = shapeTagging;
                });

                return rules;

                function shapeTagging(element) {
                    // Check if regular or canvas shape (#1088).
                    if (element.attributes['o:gfxdata'] || element.parent.name === 'v:group') {
                        shapesIds.push(element.attributes.id);
                    }
                }
            },
            lists: {
                thisIsAListItem: function (editor, element) {
                    if (Heuristics.isEdgeListItem(editor, element)) {
                        return true;
                    }

                    /*jshint -W024 */
                    // Normally a style of the sort that looks like "mso-list: l0 level1 lfo1"
                    // indicates a list element, but the same style may appear in a <p> that's within a <li>.
                    if ((element.attributes.style && element.attributes.style.match(/mso\-list:\s?l\d/) &&
                        element.parent.name !== 'li') ||
                        element.attributes['cke-dissolved'] ||
                        element.getHtml().match(/<!\-\-\[if !supportLists]\-\->/)
                    ) {
                        return true;
                    }

                    return false;
                    /*jshint +W024 */
                },
                convertToFakeListItem: function (editor, element) {
                    if (Heuristics.isDegenerateListItem(editor, element)) {
                        Heuristics.assignListLevels(editor, element);
                    }

                    // A dummy call to cache parsed list info inside of cke-list-* attributes.
                    this.getListItemInfo(element);

                    if (!element.attributes['cke-dissolved']) {
                        // The symbol is usually the first text node descendant
                        // of the element that doesn't start with a whitespace character;
                        var symbol;

                        element.forEach(function (element) {
                            // Sometimes there are custom markers represented as images.
                            // They can be recognized by the distinctive alt attribute value.
                            if (!symbol && element.name == 'img' &&
                                element.attributes['cke-ignored'] &&
                                element.attributes.alt == '*') {
                                symbol = '·';
                                // Remove the "symbol" now, since it's the best opportunity to do so.
                                element.remove();
                            }
                        }, NodeType.NODE_ELEMENT);

                        element.forEach(function (element) {
                            if (!symbol && !element.value.match(/^ /)) {
                                symbol = element.value;
                            }
                        }, NodeType.NODE_TEXT);

                        // Without a symbol this isn't really a list item.
                        if (typeof symbol == 'undefined') {
                            return;
                        }

                        element.attributes['cke-symbol'] = symbol.replace(/(?: |&nbsp;).*$/, '');

                        List.removeSymbolText(element);
                    }

                    var styles = element.attributes && tools.parseCssText(element.attributes.style);

                    // Default list has 40px padding. To correct indentation we need to reduce margin-left by 40px for each list level.
                    // Additionally margin has to be reduced by sum of margins of each parent, however it can't be done until list are structured in a tree (#2870).
                    // Note margin left is absent in IE pasted content.
                    if (styles['margin-left']) {
                        var margin = styles['margin-left'],
                            level = element.attributes['cke-list-level'];

                        // Ignore negative margins (#2870).
                        margin = Math.max(tools.convertToPx(margin) - 40 * level, 0);

                        if (margin) {
                            styles['margin-left'] = margin + 'px';
                        } else {
                            delete styles['margin-left'];
                        }

                        element.attributes.style = tools.writeCssText(styles);
                    }

                    // Converting to a normal list item would implicitly wrap the element around an <ul>.
                    element.name = 'cke:li';
                },
                convertToRealListItems: function (root) {
                    var listElements = [];
                    // Select and clean up list elements.
                    root.forEach(function (element) {
                        if (element.name == 'cke:li') {
                            element.name = 'li';

                            listElements.push(element);
                        }
                    }, NodeType.NODE_ELEMENT, false);

                    return listElements;
                },

                removeSymbolText: function (element) { // ...from a list element.
                    var symbol = element.attributes['cke-symbol'],
                        // Find the first element which contains symbol to be replaced (#2690).
                        node = element.findOne(function (node) {
                            // Since symbol may contains special characters we use `indexOf` (instead of RegExp) which is sufficient (#877).
                            return node.value && node.value.indexOf(symbol) > -1;
                        }, true),
                        parent;

                    if (node) {
                        node.value = node.value.replace(symbol, '');
                        parent = node.parent;

                        if (parent.getHtml().match(/^(\s|&nbsp;)*$/) && parent !== element) {
                            parent.remove();
                        } else if (!node.value) {
                            node.remove();
                        }
                    }
                },

                setListSymbol: function (list, symbol, level) {
                    level = level || 1;

                    var style = tools.parseCssText(list.attributes.style);

                    if (list.name == 'ol') {
                        if (list.attributes.type || style['list-style-type']) return;

                        var typeMap = {
                            '[ivx]': 'lower-roman',
                            '[IVX]': 'upper-roman',
                            '[a-z]': 'lower-alpha',
                            '[A-Z]': 'upper-alpha',
                            '\\d': 'decimal'
                        };

                        for (var type in typeMap) {
                            if (List.getSubsectionSymbol(symbol).match(new RegExp(type))) {
                                style['list-style-type'] = typeMap[type];
                                break;
                            }
                        }

                        list.attributes['cke-list-style-type'] = style['list-style-type'];
                    } else {
                        var symbolMap = {
                            '·': 'disc',
                            'o': 'circle',
                            '§': 'square' // In Word this is a square.
                        };

                        if (!style['list-style-type'] && symbolMap[symbol]) {
                            style['list-style-type'] = symbolMap[symbol];
                        }

                    }

                    List.setListSymbol.removeRedundancies(style, level);

                    (list.attributes.style = tools.writeCssText(style)) || delete list.attributes.style;
                },

                setListStart: function (list) {
                    var symbols = [],
                        offset = 0;

                    for (var i = 0; i < list.children.length; i++) {
                        symbols.push(list.children[i].attributes['cke-symbol'] || '');
                    }

                    // When a list starts with a sublist, use the next element as a start indicator.
                    if (!symbols[0]) {
                        offset++;
                    }

                    // Attribute set in setListSymbol()
                    switch (list.attributes['cke-list-style-type']) {
                        case 'lower-roman':
                        case 'upper-roman':
                            list.attributes.start = List.toArabic(List.getSubsectionSymbol(symbols[offset])) - offset;
                            break;
                        case 'lower-alpha':
                        case 'upper-alpha':
                            list.attributes.start = List.getSubsectionSymbol(symbols[offset]).replace(/\W/g, '').toLowerCase().charCodeAt(0) - 96 - offset;
                            break;
                        case 'decimal':
                            list.attributes.start = (parseInt(List.getSubsectionSymbol(symbols[offset]), 10) - offset) || 1;
                            break;
                    }

                    if (list.attributes.start == '1') {
                        delete list.attributes.start;
                    }

                    delete list.attributes['cke-list-style-type'];
                },
                numbering: {
                    toNumber: function (marker, markerType) {
                        // Functions copied straight from old PFW implementation, no need to reinvent the wheel.
                        function fromAlphabet(str) {
                            var alpahbets = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

                            str = str.toUpperCase();
                            var l = alpahbets.length,
                                retVal = 1;
                            for (var x = 1; str.length > 0; x *= l) {
                                retVal += alpahbets.indexOf(str.charAt(str.length - 1)) * x;
                                str = str.substr(0, str.length - 1);
                            }
                            return retVal;
                        }

                        function fromRoman(str) {
                            var romans = [
                                [1000, 'M'],
                                [900, 'CM'],
                                [500, 'D'],
                                [400, 'CD'],
                                [100, 'C'],
                                [90, 'XC'],
                                [50, 'L'],
                                [40, 'XL'],
                                [10, 'X'],
                                [9, 'IX'],
                                [5, 'V'],
                                [4, 'IV'],
                                [1, 'I']
                            ];

                            str = str.toUpperCase();
                            var l = romans.length,
                                retVal = 0;
                            for (var i = 0; i < l; ++i) {
                                for (var j = romans[i], k = j[1].length; str.substr(0, k) == j[1]; str = str.substr(k))
                                    retVal += j[0];
                            }
                            return retVal;
                        }

                        if (markerType == 'decimal') {
                            return Number(marker);
                        } else if (markerType == 'upper-roman' || markerType == 'lower-roman') {
                            return fromRoman(marker.toUpperCase());
                        } else if (markerType == 'lower-alpha' || markerType == 'upper-alpha') {
                            return fromAlphabet(marker);
                        } else {
                            return 1;
                        }
                    },
                    getStyle: function (marker) {
                        var typeMap = {
                            'i': 'lower-roman',
                            'v': 'lower-roman',
                            'x': 'lower-roman',
                            'l': 'lower-roman',
                            'm': 'lower-roman',
                            'I': 'upper-roman',
                            'V': 'upper-roman',
                            'X': 'upper-roman',
                            'L': 'upper-roman',
                            'M': 'upper-roman'
                        },
                            firstCharacter = marker.slice(0, 1),
                            type = typeMap[firstCharacter];

                        if (!type) {
                            type = 'decimal';

                            if (firstCharacter.match(/[a-z]/)) {
                                type = 'lower-alpha';
                            }
                            if (firstCharacter.match(/[A-Z]/)) {
                                type = 'upper-alpha';
                            }
                        }

                        return type;
                    }
                },

                // Taking into account cases like "1.1.2." etc. - get the last element.
                getSubsectionSymbol: function (symbol) {
                    return (symbol.match(/([\da-zA-Z]+).?$/) || ['placeholder', '1'])[1];
                },

                setListDir: function (list) {
                    var dirs = { ltr: 0, rtl: 0 };

                    list.forEach(function (child) {
                        if (child.name == 'li') {
                            var dir = child.attributes.dir || child.attributes.DIR || '';
                            if (dir.toLowerCase() == 'rtl') {
                                dirs.rtl++;
                            } else {
                                dirs.ltr++;
                            }
                        }
                    }, NodeType.ELEMENT_NODE);

                    if (dirs.rtl > dirs.ltr) {
                        list.attributes.dir = 'rtl';
                    }
                },

                createList: function (element) {
                    // "o" symbolizes a circle in unordered lists.
                    if ((element.attributes['cke-symbol'].match(/([\da-np-zA-NP-Z]).?/) || [])[1]) {
                        return new htmlParser.element('ol');
                    }
                    return new htmlParser.element('ul');
                },

                createLists: function (root) {
                    var element, level, i, j,
                        listElements = List.convertToRealListItems(root);

                    if (listElements.length === 0) {
                        return [];
                    }

                    // Chop data into continuous lists.
                    var lists = List.groupLists(listElements);

                    // Create nested list structures.
                    for (i = 0; i < lists.length; i++) {
                        var list = lists[i],
                            firstLevel1Element = list[0];

                        // To determine the type of the top-level list a level 1 element is needed.
                        for (j = 0; j < list.length; j++) {
                            if (list[j].attributes['cke-list-level'] == 1) {
                                firstLevel1Element = list[j];
                                break;
                            }
                        }

                        var containerStack = [List.createList(firstLevel1Element)],
                            // List wrapper (ol/ul).
                            innermostContainer = containerStack[0],
                            allContainers = [containerStack[0]];

                        // Insert first known list item before the list wrapper.
                        innermostContainer.insertBefore(list[0]);

                        for (j = 0; j < list.length; j++) {
                            element = list[j];

                            level = element.attributes['cke-list-level'];

                            while (level > containerStack.length) {
                                var content = List.createList(element);

                                var children = innermostContainer.children;
                                if (children.length > 0) {
                                    children[children.length - 1].add(content);
                                } else {
                                    var container = new htmlParser.element('li', {
                                        style: 'list-style-type:none'
                                    });
                                    container.add(content);
                                    innermostContainer.add(container);
                                }

                                containerStack.push(content);
                                allContainers.push(content);
                                innermostContainer = content;

                                if (level == containerStack.length) {
                                    List.setListSymbol(content, element.attributes['cke-symbol'], level);
                                }
                            }

                            while (level < containerStack.length) {
                                containerStack.pop();
                                innermostContainer = containerStack[containerStack.length - 1];

                                if (level == containerStack.length) {
                                    List.setListSymbol(innermostContainer, element.attributes['cke-symbol'], level);
                                }
                            }

                            // For future reference this is where the list elements are actually put into the lists.
                            element.remove();
                            innermostContainer.add(element);
                        }

                        // Try to set the symbol for the root (level 1) list.
                        var level1Symbol;
                        if (containerStack[0].children.length) {
                            level1Symbol = containerStack[0].children[0].attributes['cke-symbol'];

                            if (!level1Symbol && containerStack[0].children.length > 1) {
                                level1Symbol = containerStack[0].children[1].attributes['cke-symbol'];
                            }

                            if (level1Symbol) {
                                List.setListSymbol(containerStack[0], level1Symbol);
                            }
                        }

                        // This can be done only after all the list elements are where they should be.
                        for (j = 0; j < allContainers.length; j++) {
                            List.setListStart(allContainers[j]);
                        }

                        // Last but not least apply li[start] if needed, also this needs to be done once ols are final.
                        for (j = 0; j < list.length; j++) {
                            this.determineListItemValue(list[j]);
                        }
                    }

                    // Adjust left margin based on parents sum of parents left margin (#2870).
                    tools.array.forEach(listElements, function (element) {
                        var listParents = getParentListItems(element),
                            leftOffset = getTotalMarginLeft(listParents),
                            styles, marginLeft;

                        if (!leftOffset) {
                            return;
                        }

                        element.attributes = element.attributes || {};

                        styles = tools.parseCssText(element.attributes.style);

                        marginLeft = styles['margin-left'] || 0;
                        marginLeft = Math.max(parseInt(marginLeft, 10) - leftOffset, 0);

                        if (marginLeft) {
                            styles['margin-left'] = marginLeft + 'px';
                        } else {
                            delete styles['margin-left'];
                        }

                        element.attributes.style = tools.writeCssText(styles);
                    });

                    return listElements;

                    function getParentListItems(element) {
                        var parents = [],
                            parent = element.parent;

                        while (parent) {
                            if (parent.name === 'li') {
                                parents.push(parent);
                            }
                            parent = parent.parent;
                        }

                        return parents;
                    }

                    function getTotalMarginLeft(elements) {
                        return tools.array.reduce(elements, function (total, element) {
                            if (element.attributes && element.attributes.style) {
                                var marginLeft = tools.parseCssText(element.attributes.style)['margin-left'];
                            }
                            return marginLeft ? total + parseInt(marginLeft, 10) : total;
                        }, 0);
                    }
                },
                cleanup: function (listElements) {
                    var tempAttributes = [
                        'cke-list-level',
                        'cke-symbol',
                        'cke-list-id',
                        'cke-indentation',
                        'cke-dissolved'
                    ],
                        i,
                        j;

                    for (i = 0; i < listElements.length; i++) {
                        for (j = 0; j < tempAttributes.length; j++) {
                            delete listElements[i].attributes[tempAttributes[j]];
                        }
                    }
                },
                determineListItemValue: function (element) {
                    if (element.parent.name !== 'ol') {
                        // li[value] make sense only for list items in ordered list.
                        return;
                    }

                    var assumedValue = this.calculateValue(element),
                        cleanSymbol = element.attributes['cke-symbol'].match(/[a-z0-9]+/gi),
                        computedValue,
                        listType;

                    if (cleanSymbol) {
                        // Note that we always want to use last match, just because of markers like "1.1.4" "1.A.a.IV" etc.
                        cleanSymbol = cleanSymbol[cleanSymbol.length - 1];

                        // We can determine proper value only if we know what type of list is it.
                        // So we need to check list wrapper if it has this information.
                        listType = element.parent.attributes['cke-list-style-type'] || this.numbering.getStyle(cleanSymbol);

                        computedValue = this.numbering.toNumber(cleanSymbol, listType);

                        if (computedValue !== assumedValue) {
                            element.attributes.value = computedValue;
                        }
                    }
                },
                calculateValue: function (element) {
                    if (!element.parent) {
                        return 1;
                    }

                    var list = element.parent,
                        elementIndex = element.getIndex(),
                        valueFound = null,
                        // Index of the element with value attribute.
                        valueElementIndex,
                        curElement,
                        i;

                    // Look for any preceding li[value].
                    for (i = elementIndex; i >= 0 && valueFound === null; i--) {
                        curElement = list.children[i];

                        if (curElement.attributes && curElement.attributes.value !== undefined) {
                            valueElementIndex = i;
                            valueFound = parseInt(curElement.attributes.value, 10);
                        }
                    }

                    // Still if no li[value] was found, we'll check the list.
                    if (valueFound === null) {
                        valueFound = list.attributes.start !== undefined ? parseInt(list.attributes.start, 10) : 1;
                        valueElementIndex = 0;
                    }

                    return valueFound + (elementIndex - valueElementIndex);
                },
                dissolveList: function (element) {
                    var nameIs = function (name) {
                        return function (element) {
                            return element.name == name;
                        };
                    },
                        isList = function (element) {
                            return nameIs('ul')(element) || nameIs('ol')(element);
                        },
                        arrayTools = tools.array,
                        elements = [],
                        children,
                        i;

                    element.forEach(function (child) {
                        elements.push(child);
                    }, NodeType.NODE_ELEMENT, false);

                    var items = arrayTools.filter(elements, nameIs('li')),
                        lists = arrayTools.filter(elements, isList);

                    arrayTools.forEach(lists, function (list) {
                        var type = list.attributes.type,
                            start = parseInt(list.attributes.start, 10) || 1,
                            level = countParents(isList, list) + 1;

                        if (!type) {
                            var style = tools.parseCssText(list.attributes.style);
                            type = style['list-style-type'];
                        }

                        arrayTools.forEach(arrayTools.filter(list.children, nameIs('li')), function (child, index) {
                            var symbol;

                            switch (type) {
                                case 'disc':
                                    symbol = '·';
                                    break;
                                case 'circle':
                                    symbol = 'o';
                                    break;
                                case 'square':
                                    symbol = '§';
                                    break;
                                case '1':
                                case 'decimal':
                                    symbol = (start + index) + '.';
                                    break;
                                case 'a':
                                case 'lower-alpha':
                                    symbol = String.fromCharCode('a'.charCodeAt(0) + start - 1 + index) + '.';
                                    break;
                                case 'A':
                                case 'upper-alpha':
                                    symbol = String.fromCharCode('A'.charCodeAt(0) + start - 1 + index) + '.';
                                    break;
                                case 'i':
                                case 'lower-roman':
                                    symbol = toRoman(start + index) + '.';
                                    break;
                                case 'I':
                                case 'upper-roman':
                                    symbol = toRoman(start + index).toUpperCase() + '.';
                                    break;
                                default:
                                    symbol = list.name == 'ul' ? '·' : (start + index) + '.';
                            }

                            child.attributes['cke-symbol'] = symbol;
                            child.attributes['cke-list-level'] = level;
                        });
                    });

                    children = arrayTools.reduce(items, function (acc, listElement) {
                        var child = listElement.children[0];

                        if (child && child.name && child.attributes.style && child.attributes.style.match(/mso-list:/i)) {
                            Style.pushStylesLower(listElement, {
                                'list-style-type': true,
                                'display': true
                            });

                            var childStyle = tools.parseCssText(child.attributes.style, true);

                            Style.setStyle(listElement, 'mso-list', childStyle['mso-list'], true);
                            Style.setStyle(child, 'mso-list', '');
                            // mso-list takes precedence in determining the level.
                            delete listElement['cke-list-level'];

                            // If this style has a value it's usually "none". This marks such list elements for deletion.
                            var styleName = childStyle.display ? 'display' : childStyle.DISPLAY ? 'DISPLAY' : '';
                            if (styleName) {
                                Style.setStyle(listElement, 'display', childStyle[styleName], true);
                            }
                        }

                        // Don't include elements put there only to contain another list.
                        if (listElement.children.length === 1 && isList(listElement.children[0])) {
                            return acc;
                        }

                        listElement.name = 'p';
                        listElement.attributes['cke-dissolved'] = true;
                        acc.push(listElement);

                        return acc;
                    }, []);

                    for (i = children.length - 1; i >= 0; i--) {
                        children[i].insertAfter(element);
                    }
                    for (i = lists.length - 1; i >= 0; i--) {
                        delete lists[i].name;
                    }

                    function toRoman(number) {
                        if (number >= 50) return 'l' + toRoman(number - 50);
                        if (number >= 40) return 'xl' + toRoman(number - 40);
                        if (number >= 10) return 'x' + toRoman(number - 10);
                        if (number == 9) return 'ix';
                        if (number >= 5) return 'v' + toRoman(number - 5);
                        if (number == 4) return 'iv';
                        if (number >= 1) return 'i' + toRoman(number - 1);
                        return '';
                    }

                    function countParents(condition, element) {
                        return count(element, 0);

                        function count(parent, number) {
                            if (!parent || !parent.parent) {
                                return number;
                            }

                            if (condition(parent.parent)) {
                                return count(parent.parent, number + 1);
                            } else {
                                return count(parent.parent, number);
                            }
                        }
                    }

                },

                groupLists: function (listElements) {
                    // Chop data into continuous lists.
                    var i, element,
                        lists = [[listElements[0]]],
                        lastList = lists[0];

                    element = listElements[0];
                    element.attributes['cke-indentation'] = element.attributes['cke-indentation'] || getElementIndentation(element);

                    for (i = 1; i < listElements.length; i++) {
                        element = listElements[i];
                        var previous = listElements[i - 1];

                        element.attributes['cke-indentation'] = element.attributes['cke-indentation'] || getElementIndentation(element);

                        if (element.previous !== previous) {
                            List.chopDiscontinuousLists(lastList, lists);
                            lists.push(lastList = []);
                        }

                        lastList.push(element);
                    }

                    List.chopDiscontinuousLists(lastList, lists);

                    return lists;
                },
                chopDiscontinuousLists: function (list, lists) {
                    var levelSymbols = {};
                    var choppedLists = [[]],
                        lastListInfo;

                    for (var i = 0; i < list.length; i++) {
                        var lastSymbol = levelSymbols[list[i].attributes['cke-list-level']],
                            currentListInfo = this.getListItemInfo(list[i]),
                            currentSymbol,
                            forceType;

                        if (lastSymbol) {
                            // An "h" before an "i".
                            forceType = lastSymbol.type.match(/alpha/) && lastSymbol.index == 7 ? 'alpha' : forceType;
                            // An "n" before an "o".
                            forceType = list[i].attributes['cke-symbol'] == 'o' && lastSymbol.index == 14 ? 'alpha' : forceType;

                            currentSymbol = List.getSymbolInfo(list[i].attributes['cke-symbol'], forceType);
                            currentListInfo = this.getListItemInfo(list[i]);

                            // Based on current and last index we'll decide if we want to chop list.
                            if (
                                // If the last list was a different list type then chop it!
                                lastSymbol.type != currentSymbol.type ||
                                (lastListInfo && currentListInfo.id != lastListInfo.id && !this.isAListContinuation(list[i]))) {
                                choppedLists.push([]);
                            }
                        } else {
                            currentSymbol = List.getSymbolInfo(list[i].attributes['cke-symbol']);
                        }

                        // Reset all higher levels
                        for (var j = parseInt(list[i].attributes['cke-list-level'], 10) + 1; j < 20; j++) {
                            if (levelSymbols[j]) {
                                delete levelSymbols[j];
                            }
                        }

                        levelSymbols[list[i].attributes['cke-list-level']] = currentSymbol;
                        choppedLists[choppedLists.length - 1].push(list[i]);

                        lastListInfo = currentListInfo;
                    }

                    [].splice.apply(lists, [].concat([tools.indexOf(lists, list), 1], choppedLists));
                },
                isAListContinuation: function (listElement) {
                    var prev = listElement;

                    do {
                        prev = prev.previous;

                        if (prev && prev.type === NodeType.NODE_ELEMENT) {
                            if (prev.attributes['cke-list-level'] === undefined) {
                                // Not a list, so looks like an interrupted list.
                                return false;
                            }

                            if (prev.attributes['cke-list-level'] === listElement.attributes['cke-list-level']) {
                                // Same level, so we want to check if this is a continuation.
                                return prev.attributes['cke-list-id'] === listElement.attributes['cke-list-id'];
                            }
                        }

                    } while (prev);

                    return false;
                },

                // Source: http://stackoverflow.com/a/17534350/3698944
                toArabic: function (symbol) {
                    if (!symbol.match(/[ivxl]/i)) return 0;
                    if (symbol.match(/^l/i)) return 50 + List.toArabic(symbol.slice(1));
                    if (symbol.match(/^lx/i)) return 40 + List.toArabic(symbol.slice(1));
                    if (symbol.match(/^x/i)) return 10 + List.toArabic(symbol.slice(1));
                    if (symbol.match(/^ix/i)) return 9 + List.toArabic(symbol.slice(2));
                    if (symbol.match(/^v/i)) return 5 + List.toArabic(symbol.slice(1));
                    if (symbol.match(/^iv/i)) return 4 + List.toArabic(symbol.slice(2));
                    if (symbol.match(/^i/i)) return 1 + List.toArabic(symbol.slice(1));
                    // Ignore other characters.
                    return List.toArabic(symbol.slice(1));
                },
                getSymbolInfo: function (symbol, type) {
                    var symbolCase = symbol.toUpperCase() == symbol ? 'upper-' : 'lower-',
                        symbolMap = {
                            '·': ['disc', -1],
                            'o': ['circle', -2],
                            '§': ['square', -3]
                        };

                    if (symbol in symbolMap || (type && type.match(/(disc|circle|square)/))) {
                        return {
                            index: symbolMap[symbol][1],
                            type: symbolMap[symbol][0]
                        };
                    }

                    if (symbol.match(/\d/)) {
                        return {
                            index: symbol ? parseInt(List.getSubsectionSymbol(symbol), 10) : 0,
                            type: 'decimal'
                        };
                    }

                    symbol = symbol.replace(/\W/g, '').toLowerCase();

                    if ((!type && symbol.match(/[ivxl]+/i)) || (type && type != 'alpha') || type == 'roman') {
                        return {
                            index: List.toArabic(symbol),
                            type: symbolCase + 'roman'
                        };
                    }

                    if (symbol.match(/[a-z]/i)) {
                        return {
                            index: symbol.charCodeAt(0) - 97,
                            type: symbolCase + 'alpha'
                        };
                    }

                    return {
                        index: -1,
                        type: 'disc'
                    };
                },
                getListItemInfo: function (list) {
                    if (list.attributes['cke-list-id'] !== undefined) {
                        // List was already resolved.
                        return {
                            id: list.attributes['cke-list-id'],
                            level: list.attributes['cke-list-level']
                        };
                    }

                    var propValue = tools.parseCssText(list.attributes.style)['mso-list'],
                        ret = {
                            id: '0',
                            level: '1'
                        };

                    if (propValue) {
                        // Add one whitespace so it's easier to match values assuming that all of these are separated with \s.
                        propValue += ' ';

                        ret.level = propValue.match(/level(.+?)\s+/)[1];
                        ret.id = propValue.match(/l(\d+?)\s+/)[1];
                    }

                    // Store values. List level will be reused if present to prevent regressions.
                    list.attributes['cke-list-level'] = list.attributes['cke-list-level'] !== undefined ? list.attributes['cke-list-level'] : ret.level;
                    list.attributes['cke-list-id'] = ret.id;

                    return ret;
                }
            }
        }
    }

    commonFilter=plugins.pastetools.filters.common;
    List = plugins.pastefromword.lists;

    var dtd = (function () {
        'use strict';

        var X = tools.extend,
            // Subtraction rest of sets, from the first set.
            Y = function (source, removed) {
                var substracted = tools.clone(source);
                for (var i = 1; i < arguments.length; i++) {
                    removed = arguments[i];
                    for (var name in removed)
                        delete substracted[name];
                }
                return substracted;
            };

        // Phrasing elements.
        // P = { a: 1, em: 1, strong: 1, small: 1, abbr: 1, dfn: 1, i: 1, b: 1, s: 1,
        //		u: 1, code: 1, 'var': 1, samp: 1, kbd: 1, sup: 1, sub: 1, q: 1, cite: 1,
        //		span: 1, bdo: 1, bdi: 1, br: 1, wbr: 1, ins: 1, del: 1, img: 1, embed: 1,
        //		object: 1, iframe: 1, map: 1, area: 1, script: 1, noscript: 1, ruby: 1,
        //		video: 1, audio: 1, input: 1, textarea: 1, select: 1, button: 1, label: 1,
        //		output: 1, keygen: 1, progress: 1, command: 1, canvas: 1, time: 1,
        //		meter: 1, detalist: 1 },

        // Flow elements.
        // F = { a: 1, p: 1, hr: 1, pre: 1, ul: 1, ol: 1, dl: 1, div: 1, h1: 1, h2: 1,
        //		h3: 1, h4: 1, h5: 1, h6: 1, hgroup: 1, address: 1, blockquote: 1, ins: 1,
        //		del: 1, object: 1, map: 1, noscript: 1, section: 1, nav: 1, article: 1,
        //		aside: 1, header: 1, footer: 1, video: 1, audio: 1, figure: 1, table: 1,
        //		form: 1, fieldset: 1, menu: 1, canvas: 1, details:1 },

        // Text can be everywhere.
        // X( P, T );
        // Flow elements set consists of phrasing elements set.
        // X( F, P );

        var P = {}, F = {},
            // Intersection of flow elements set and phrasing elements set.
            PF = {
                a: 1, abbr: 1, area: 1, audio: 1, b: 1, bdi: 1, bdo: 1, br: 1, button: 1, canvas: 1, cite: 1,
                code: 1, command: 1, datalist: 1, del: 1, dfn: 1, em: 1, embed: 1, i: 1, iframe: 1, img: 1,
                input: 1, ins: 1, kbd: 1, keygen: 1, label: 1, map: 1, mark: 1, meter: 1, noscript: 1, object: 1,
                output: 1, progress: 1, q: 1, ruby: 1, s: 1, samp: 1, script: 1, select: 1, small: 1, span: 1,
                strong: 1, sub: 1, sup: 1, textarea: 1, time: 1, u: 1, 'var': 1, video: 1, wbr: 1
            },
            // F - PF (Flow Only).
            FO = {
                address: 1, article: 1, aside: 1, blockquote: 1, details: 1, div: 1, dl: 1, fieldset: 1,
                figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, header: 1, hgroup: 1,
                hr: 1, main: 1, menu: 1, nav: 1, ol: 1, p: 1, pre: 1, section: 1, table: 1, ul: 1
            },
            // Metadata elements.
            M = { command: 1, link: 1, meta: 1, noscript: 1, script: 1, style: 1 },
            // Empty.
            E = {},
            // Text.
            T = { '#': 1 },

            // Deprecated phrasing elements.
            DP = { acronym: 1, applet: 1, basefont: 1, big: 1, font: 1, isindex: 1, strike: 1, style: 1, tt: 1 }, // TODO remove "style".
            // Deprecated flow only elements.
            DFO = { center: 1, dir: 1, noframes: 1 };

        // Phrasing elements := PF + T + DP
        X(P, PF, T, DP);
        // Flow elements := FO + P + DFO
        X(F, FO, P, DFO);

        var dtd = {
            a: Y(P, { a: 1, button: 1 }), // Treat as normal inline element (not a transparent one).
            abbr: P,
            address: F,
            area: E,
            article: F,
            aside: F,
            audio: X({ source: 1, track: 1 }, F),
            b: P,
            base: E,
            bdi: P,
            bdo: P,
            blockquote: F,
            body: F,
            br: E,
            button: Y(P, { a: 1, button: 1 }),
            canvas: P, // Treat as normal inline element (not a transparent one).
            caption: F,
            cite: P,
            code: P,
            col: E,
            colgroup: { col: 1 },
            command: E,
            datalist: X({ option: 1 }, P),
            dd: F,
            del: P, // Treat as normal inline element (not a transparent one).
            details: X({ summary: 1 }, F),
            dfn: P,
            div: F,
            dl: { dt: 1, dd: 1 },
            dt: F,
            em: P,
            embed: E,
            fieldset: X({ legend: 1 }, F),
            figcaption: F,
            figure: X({ figcaption: 1 }, F),
            footer: F,
            form: F,
            h1: P,
            h2: P,
            h3: P,
            h4: P,
            h5: P,
            h6: P,
            head: X({ title: 1, base: 1 }, M),
            header: F,
            hgroup: { h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 },
            hr: E,
            html: X({ head: 1, body: 1 }, F, M), // Head and body are optional...
            i: P,
            iframe: T,
            img: E,
            input: E,
            ins: P, // Treat as normal inline element (not a transparent one).
            kbd: P,
            keygen: E,
            label: P,
            legend: P,
            li: F,
            link: E,
            // Can't be a descendant of article, aside, footer, header, nav, but we don't need this
            // complication. As well as checking if it's used only once.
            main: F,
            map: F,
            mark: P, // Treat as normal inline element (not a transparent one).
            menu: X({ li: 1 }, F),
            meta: E,
            meter: Y(P, { meter: 1 }),
            nav: F,
            noscript: X({ link: 1, meta: 1, style: 1 }, P), // Treat as normal inline element (not a transparent one).
            object: X({ param: 1 }, P), // Treat as normal inline element (not a transparent one).
            ol: { li: 1 },
            optgroup: { option: 1 },
            option: T,
            output: P,
            p: P,
            param: E,
            pre: P,
            progress: Y(P, { progress: 1 }),
            q: P,
            rp: P,
            rt: P,
            ruby: X({ rp: 1, rt: 1 }, P),
            s: P,
            samp: P,
            script: T,
            section: F,
            select: { optgroup: 1, option: 1 },
            small: P,
            source: E,
            span: P,
            strong: P,
            style: T,
            sub: P,
            summary: X({ h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 }, P),
            sup: P,
            table: { caption: 1, colgroup: 1, thead: 1, tfoot: 1, tbody: 1, tr: 1 },
            tbody: { tr: 1 },
            td: F,
            textarea: T,
            tfoot: { tr: 1 },
            th: F,
            thead: { tr: 1 },
            time: Y(P, { time: 1 }),
            title: T,
            tr: { th: 1, td: 1 },
            track: E,
            u: P,
            ul: { li: 1 },
            'var': P,
            video: X({ source: 1, track: 1 }, F),
            wbr: E,

            // Deprecated tags.
            acronym: P,
            applet: X({ param: 1 }, F),
            basefont: E,
            big: P,
            center: F,
            dialog: E,
            dir: { li: 1 },
            font: P,
            isindex: E,
            noframes: F,
            strike: P,
            tt: P
        };

        X(dtd, {
            /**
             * List of block elements, like `<p>` or `<div>`.
             */
            $block: X({ audio: 1, dd: 1, dt: 1, figcaption: 1, li: 1, video: 1 }, FO, DFO),


            $blockLimit: {
                article: 1, aside: 1, audio: 1, body: 1, caption: 1, details: 1, dir: 1, div: 1, dl: 1,
                fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, header: 1, hgroup: 1, main: 1, menu: 1, nav: 1,
                ol: 1, section: 1, table: 1, td: 1, th: 1, tr: 1, ul: 1, video: 1
            },

            /**
             * List of elements that contain character data.
             */
            $cdata: { script: 1, style: 1 },

            /**
             * List of elements that are accepted as inline editing hosts.
             */
            $editable: {
                address: 1, article: 1, aside: 1, blockquote: 1, body: 1, details: 1, div: 1, fieldset: 1,
                figcaption: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, header: 1, hgroup: 1,
                main: 1, nav: 1, p: 1, pre: 1, section: 1
            },

            /**
             * List of empty (self-closing) elements, like `<br>` or `<img>`.
             */
            $empty: {
                area: 1, base: 1, basefont: 1, br: 1, col: 1, command: 1, dialog: 1, embed: 1, hr: 1, img: 1,
                input: 1, isindex: 1, keygen: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
            },

            /**
             * List of inline (`<span>` like) elements.
             */
            $inline: P,

            /**
             * List of list root elements.
             */
            $list: { dl: 1, ol: 1, ul: 1 },

            /**
             * List of list item elements, like `<li>` or `<dd>`.
             */
            $listItem: { dd: 1, dt: 1, li: 1 },

            /**
             * List of elements which may live outside body.
             */
            $nonBodyContent: X({ body: 1, head: 1, html: 1 }, dtd.head),

            /**
             * Elements that accept text nodes, but are not possible to edit into the browser.
             */
            $nonEditable: {
                applet: 1, audio: 1, button: 1, embed: 1, iframe: 1, map: 1, object: 1, option: 1,
                param: 1, script: 1, textarea: 1, video: 1
            },

            /**
             * Elements that are considered objects, therefore selected as a whole in the editor.
             */
            $object: {
                applet: 1, audio: 1, button: 1, hr: 1, iframe: 1, img: 1, input: 1, object: 1, select: 1,
                table: 1, textarea: 1, video: 1
            },

            /**
             * List of elements that can be ignored if empty, like `<b>` or `<span>`.
             */
            $removeEmpty: {
                abbr: 1, acronym: 1, b: 1, bdi: 1, bdo: 1, big: 1, cite: 1, code: 1, del: 1, dfn: 1,
                em: 1, font: 1, i: 1, ins: 1, label: 1, kbd: 1, mark: 1, meter: 1, output: 1, q: 1, ruby: 1, s: 1,
                samp: 1, small: 1, span: 1, strike: 1, strong: 1, sub: 1, sup: 1, time: 1, tt: 1, u: 1, 'var': 1
            },

            /**
             * List of elements that have tabindex set to zero by default.
             */
            $tabIndex: { a: 1, area: 1, button: 1, input: 1, object: 1, select: 1, textarea: 1 },

            /**
             * List of elements used inside the `<table>` element, like `<tbody>` or `<td>`.
             */
            $tableContent: { caption: 1, col: 1, colgroup: 1, tbody: 1, td: 1, tfoot: 1, th: 1, thead: 1, tr: 1 },

            /**
             * List of "transparent" elements. See [W3C's definition of "transparent" element](http://dev.w3.org/html5/markup/terminology.html#transparent).
             */
            $transparent: { a: 1, audio: 1, canvas: 1, del: 1, ins: 1, map: 1, noscript: 1, object: 1, video: 1 },

            /**
             * List of elements that are not to exist standalone that must live under it's parent element.
             */
            $intermediate: {
                caption: 1, colgroup: 1, dd: 1, dt: 1, figcaption: 1, legend: 1, li: 1, optgroup: 1,
                option: 1, rp: 1, rt: 1, summary: 1, tbody: 1, td: 1, tfoot: 1, th: 1, thead: 1, tr: 1
            }
        });

        return dtd;
    })();

    dom.document = function (domDocument) {
        dom.domObject.call(this, domDocument);
    };
    dom.domObject = function (nativeDomObject) {
        if (nativeDomObject) {
            this.$ = nativeDomObject;
        }
    };
    dom.nodeList = function (nativeList) {
        this.$ = nativeList;
    };
    dom.node = function (domNode) {
        if (domNode) {
            var type =
                domNode.nodeType == NodeType.NODE_DOCUMENT ? 'document' :
                    domNode.nodeType == NodeType.NODE_ELEMENT ? 'element' :
                        domNode.nodeType == NodeType.NODE_TEXT ? 'text' :
                            domNode.nodeType == NodeType.NODE_COMMENT ? 'comment' :
                                domNode.nodeType == NodeType.NODE_DOCUMENT_FRAGMENT ? 'documentFragment' :
                                    'domObject'; // Call the base constructor otherwise.

            return new dom[type](domNode);
        }

        return this;
    };
    dom.node.prototype = new dom.domObject();
    tools.extend(dom.node.prototype, {
        remove: function (preserveChildren) {
            var $ = this.$;
            var parent = $.parentNode;

            if (parent) {
                if (preserveChildren) {
                    // Move all children before the node.
                    for (var child;
                        (child = $.firstChild);) {
                        parent.insertBefore($.removeChild(child), $);
                    }
                }

                parent.removeChild($);
            }

            return this;
        }
    });
    dom.element = function (element, ownerDocument) {
        if (typeof element == 'string')
            element = (ownerDocument ? ownerDocument.$ : document).createElement(element);

        dom.domObject.call(this, element);
    };
    dom.document.prototype = new dom.domObject();
    dom.document.prototype = $.extend(dom.document.prototype, {
        find: function (selector) {
            return new dom.nodeList(this.$.querySelectorAll(selector));
        },
        getBody: function () {
            return new dom.element(this.$.body);
        },
    });
    dom.nodeList.prototype = {
        count: function () {
            return this.$.length;
        },
        getItem: function (index) {
            if (index < 0 || index >= this.$.length)
                return null;

            var $node = this.$[index];
            return $node ? new dom.node($node) : null;
        },
        toArray: function () {
            return tools.array.map(this.$, function (nativeEl) {
                return new dom.node(nativeEl);
            });
        }
    }
    dom.element.prototype = new dom.node();
    tools.extend(dom.element.prototype, {
        is: function () {
            var name = this.getName();

            // Check against the specified DTD liternal.
            if (typeof arguments[0] == 'object')
                return !!arguments[0][name];

            // Check for tag names
            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] == name)
                    return true;
            }
            return false;
        },
        getAttribute: (function () {
            var standard = function (name) {
                return this.$.getAttribute(name, 2);
            };

            if (env.ie && (env.ie7Compat || env.quirks)) {
                return function (name) {
                    switch (name) {
                        case 'class':
                            name = 'className';
                            break;

                        case 'http-equiv':
                            name = 'httpEquiv';
                            break;

                        case 'name':
                            return this.$.name;

                        case 'tabindex':
                            var tabIndex = standard.call(this, name);

                            // IE returns tabIndex=0 by default for all
                            // elements. For those elements,
                            // getAtrribute( 'tabindex', 2 ) returns 32768
                            // instead. So, we must make this check to give a
                            // uniform result among all browsers.
                            if (tabIndex !== 0 && this.$.tabIndex === 0)
                                tabIndex = null;

                            return tabIndex;

                        case 'checked':
                            var attr = this.$.attributes.getNamedItem(name),
                                attrValue = attr.specified ? attr.nodeValue // For value given by parser.
                                    : this.$.checked; // For value created via DOM interface.

                            return attrValue ? 'checked' : null;

                        case 'hspace':
                        case 'value':
                            return this.$[name];

                        case 'style':
                            return this.$.style.cssText;

                        case 'contenteditable':
                        case 'contentEditable':
                            return this.$.attributes.getNamedItem('contentEditable').specified ? this.$.getAttribute('contentEditable') : null;
                    }

                    return standard.call(this, name);
                };
            } else {
                return standard;
            }
        })(),
        setAttribute: (function () {
            var standard = function (name, value) {
                this.$.setAttribute(name, value);
                return this;
            };

            if (env.ie && (env.ie7Compat || env.quirks)) {
                return function (name, value) {
                    if (name == 'class')
                        this.$.className = value;
                    else if (name == 'style')
                        this.$.style.cssText = value;
                    else if (name == 'tabindex') // Case sensitive.
                        this.$.tabIndex = value;
                    else if (name == 'checked')
                        this.$.checked = value;
                    else if (name == 'contenteditable')
                        standard.call(this, 'contentEditable', value);
                    else
                        standard.apply(this, arguments);
                    return this;
                };
            } else if (env.ie8Compat && env.secure) {
                return function (name, value) {
                    if (name == 'src' && value.match(/^http:\/\//)) {
                        try {
                            standard.apply(this, arguments);
                        } catch (e) { }
                    } else {
                        standard.apply(this, arguments);
                    }
                    return this;
                };
            } else {
                return standard;
            }
        })(),
        getHtml: function () {
            var retval = this.$.innerHTML;
            return env.ie ? retval.replace(/<\?[^>]*>/g, '') : retval;
        },
        setHtml: (env.ie && env.version < 9) ?
            // old IEs throws error on HTML manipulation (through the "innerHTML" property)
            // on the element which resides in an DTD invalid position,  e.g. <span><div></div></span>
            // fortunately it can be worked around with DOM manipulation.
            function (html) {
                try {
                    var $ = this.$;

                    // Fix the case when setHtml is called on detached element.
                    // HTML5 shiv used for document in which this element was created
                    // won't affect that detached element. So get document fragment with
                    // all HTML5 elements enabled and set innerHTML while this element is appended to it.
                    if (this.getParent())
                        return ($.innerHTML = html);
                    else {
                        var $frag = this.getDocument()._getHtml5ShivFrag();
                        $frag.appendChild($);
                        $.innerHTML = html;
                        $frag.removeChild($);

                        return html;
                    }
                }
                catch (e) {
                    this.$.innerHTML = '';

                    var temp = new dom.element('body', this.getDocument());
                    temp.$.innerHTML = html;

                    var children = temp.getChildren();
                    while (children.count())
                        this.append(children.getItem(0));

                    return html;
                }
            } : function (html) {
                return (this.$.innerHTML = html);
            },
        getFirst: function (evaluator) {
            var first = this.$.firstChild,
                retval = first && new dom.node(first);
            if (retval && evaluator && !evaluator(retval))
                retval = retval.getNext(evaluator);

            return retval;
        },
        setStyle: function (name, value) {
            this.$.style[tools.cssStyleToDomStyle(name)] = value;
            return this;
        },
        append: function( node, toStart ) {
			if ( typeof node == 'string' )
				node = this.getDocument().createElement( node );

			if ( toStart )
				this.$.insertBefore( node.$, this.$.firstChild );
			else
				this.$.appendChild( node.$ );

			return node;
		}
    })
    dom.element.createFromHtml = function (html, ownerDocument) {
        var temp = new dom.element('div', ownerDocument);
        temp.setHtml(html);

        // When returning the node, remove it from its parent to detach it.
        // return temp.getFirst().remove();
        var t = temp.getFirst();
        return temp.remove();
    };

    htmlParser = function () {
        this._ = {
            htmlPartsRegex: /<(?:(?:\/([^>]+)>)|(?:!--([\S|\s]*?)-->)|(?:([^\/\s>]+)((?:\s+[\w\-:.]+(?:\s*=\s*?(?:(?:"[^"]*")|(?:'[^']*')|[^\s"'\/>]+))?)*)[\S\s]*?(\/?)>))/g
        };
    };

    // htmlParser.prototype
    (function () {
        var attribsRegex = /([\w\-:.]+)(?:(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^\s>]+)))|(?=\s|$))/g,
            emptyAttribs = { checked: 1, compact: 1, declare: 1, defer: 1, disabled: 1, ismap: 1, multiple: 1, nohref: 1, noresize: 1, noshade: 1, nowrap: 1, readonly: 1, selected: 1 };
        htmlParser.prototype = {
            onTagOpen: function () { },
            onTagClose: function () { },
            onText: function () { },
            onCDATA: function () { },
            onComment: function () { },
            parse: function (html) {
                var parts, tagName,
                    nextIndex = 0,
                    cdata; // The collected data inside a CDATA section.

                while ((parts = this._.htmlPartsRegex.exec(html))) {
                    var tagIndex = parts.index;
                    if (tagIndex > nextIndex) {
                        var text = html.substring(nextIndex, tagIndex);

                        if (cdata)
                            cdata.push(text);
                        else
                            this.onText(text);
                    }

                    nextIndex = this._.htmlPartsRegex.lastIndex;

                    // "parts" is an array with the following items:
                    //		0 : The entire match for opening/closing tags and comments.
                    //		  : Group filled with the tag name for closing tags.
                    //		2 : Group filled with the comment text.
                    //		3 : Group filled with the tag name for opening tags.
                    //		4 : Group filled with the attributes part of opening tags.

                    // Closing tag
                    if ((tagName = parts[1])) {
                        tagName = tagName.toLowerCase();

                        if (cdata && dtd.$cdata[tagName]) {
                            // Send the CDATA data.
                            this.onCDATA(cdata.join(''));
                            cdata = null;
                        }

                        if (!cdata) {
                            this.onTagClose(tagName);
                            continue;
                        }
                    }

                    // If CDATA is enabled, just save the raw match.
                    if (cdata) {
                        cdata.push(parts[0]);
                        continue;
                    }

                    // Opening tag
                    if ((tagName = parts[3])) {
                        tagName = tagName.toLowerCase();

                        // There are some tag names that can break things, so let's 
                        if (/="/.test(tagName))
                            continue;

                        var attribs = {},
                            attribMatch,
                            attribsPart = parts[4],
                            selfClosing = !!parts[5];

                        if (attribsPart) {
                            while ((attribMatch = attribsRegex.exec(attribsPart))) {
                                var attName = attribMatch[1].toLowerCase(),
                                    attValue = attribMatch[2] || attribMatch[3] || attribMatch[4] || '';

                                if (!attValue && emptyAttribs[attName])
                                    attribs[attName] = attName;
                                else
                                    attribs[attName] = tools.htmlDecodeAttr(attValue);
                            }
                        }

                        this.onTagOpen(tagName, attribs, selfClosing);

                        // Open CDATA mode when finding the appropriate tags.
                        if (!cdata && dtd.$cdata[tagName])
                            cdata = [];

                        continue;
                    }

                    // Comment
                    if ((tagName = parts[2]))
                        this.onComment(tagName);
                }

                if (html.length > nextIndex)
                    this.onText(html.substring(nextIndex, html.length));
            }
        };
    })();

    htmlParser.fragment = function () {
        this.children = [];
        this.parent = null;

        /** @private */
        this._ = {
            isBlockLike: true,
            hasInlineStarted: false
        };
    };
    // htmlParser.fragment.prototype
    (function () {
        // Block-level elements whose internal structure should be respected during
        // parser fixing.
        var nonBreakingBlocks = tools.extend({ table: 1, ul: 1, ol: 1, dl: 1 }, dtd.table, dtd.ul, dtd.ol, dtd.dl);

        var listBlocks = { ol: 1, ul: 1 };

        // Dtd of the fragment element, basically it accept anything except for intermediate structure, e.g. orphan <li>.
        var rootDtd = tools.extend({}, { html: 1 }, dtd.html, dtd.body, dtd.head, { style: 1, script: 1 });

        // Which element to create when encountered not allowed content.
        var structureFixes = {
            ul: 'li',
            ol: 'li',
            dl: 'dd',
            table: 'tbody',
            tbody: 'tr',
            thead: 'tr',
            tfoot: 'tr',
            tr: 'td'
        };

        function isRemoveEmpty(node) {
            // Keep marked element event if it is empty.
            if (node.attributes['data-cke-survive'])
                return false;

            // Empty link is to be removed when empty but not anchor. 
            return node.name == 'a' && node.attributes.href || dtd.$removeEmpty[node.name];
        }

        htmlParser.fragment.fromHtml = function (fragmentHtml, parent, fixingBlock) {
            var parser = new htmlParser();

            var root = parent instanceof htmlParser.element ? parent : typeof parent == 'string' ? new htmlParser.element(parent) : new htmlParser.fragment();

            var pendingInline = [],
                pendingBRs = [],
                currentNode = root,
                // Indicate we're inside a <textarea> element, spaces should be touched differently.
                inTextarea = root.name == 'textarea',
                // Indicate we're inside a <pre> element, spaces should be touched differently.
                inPre = root.name == 'pre';

            function checkPending(newTagName) {
                var pendingBRsSent;

                if (pendingInline.length > 0) {
                    for (var i = 0; i < pendingInline.length; i++) {
                        var pendingElement = pendingInline[i],
                            pendingName = pendingElement.name,
                            pendingDtd = dtd[pendingName],
                            currentDtd = currentNode.name && dtd[currentNode.name];

                        if ((!currentDtd || currentDtd[pendingName]) && (!newTagName || !pendingDtd || pendingDtd[newTagName] || !dtd[newTagName])) {
                            if (!pendingBRsSent) {
                                sendPendingBRs();
                                pendingBRsSent = 1;
                            }

                            // Get a clone for the pending element.
                            pendingElement = pendingElement.clone();

                            // Add it to the current node and make it the current,
                            // so the new element will be added inside of it.
                            pendingElement.parent = currentNode;
                            currentNode = pendingElement;

                            // Remove the pending element (back the index by one
                            // to properly process the next entry).
                            pendingInline.splice(i, 1);
                            i--;
                        } else {
                            // Some element of the same type cannot be nested, flat them, 
                            if (pendingName == currentNode.name)
                                addElement(currentNode, currentNode.parent, 1), i--;
                        }
                    }
                }
            }

            function sendPendingBRs() {
                while (pendingBRs.length)
                    addElement(pendingBRs.shift(), currentNode);
            }

            // Rtrim empty spaces on block end boundary.  
            function removeTailWhitespace(element) {
                if (element._.isBlockLike && element.name != 'pre' && element.name != 'textarea') {

                    var length = element.children.length,
                        lastChild = element.children[length - 1],
                        text;
                    if (lastChild && lastChild.type == NodeType.NODE_TEXT) {
                        if (!(text = tools.rtrim(lastChild.value)))
                            element.children.length = length - 1;
                        else
                            lastChild.value = text;
                    }
                }
            }

            // Beside of simply append specified element to target, this function also takes
            // care of other dirty lifts like forcing block in body, trimming spaces at
            // the block boundaries etc.
            //
            // @param {Element} element  The element to be added as the last child of {@link target}.
            // @param {Element} target The parent element to relieve the new node.
            // @param {Boolean} [moveCurrent=false] Don't change the "currentNode" global unless
            // there's a return point node specified on the element, otherwise move current onto {@link target} node.
            //
            function addElement(element, target, moveCurrent) {
                target = target || currentNode || root;

                // Current element might be mangled by fix body below,
                // save it for restore later.
                var savedCurrent = currentNode;

                // Ignore any element that has already been added.
                if (element.previous === undefined) {
                    if (checkAutoParagraphing(target, element)) {
                        // Create a <p> in the fragment.
                        currentNode = target;
                        parser.onTagOpen(fixingBlock, {});

                        // The new target now is the <p>.
                        element.returnPoint = target = currentNode;
                    }

                    removeTailWhitespace(element);

                    // Avoid adding empty inline.
                    if (!(isRemoveEmpty(element) && !element.children.length))
                        target.add(element);

                    if (element.name == 'pre')
                        inPre = false;

                    if (element.name == 'textarea')
                        inTextarea = false;
                }

                if (element.returnPoint) {
                    currentNode = element.returnPoint;
                    delete element.returnPoint;
                } else {
                    currentNode = moveCurrent ? target : savedCurrent;
                }
            }

            // Auto paragraphing should happen when inline content enters the root element.
            function checkAutoParagraphing(parent, node) {

                // Check for parent that can contain block.
                if ((parent == root || parent.name == 'body') && fixingBlock &&
                    (!parent.name || dtd[parent.name][fixingBlock])) {
                    var name, realName;

                    if (node.attributes && (realName = node.attributes['data-cke-real-element-type']))
                        name = realName;
                    else
                        name = node.name;

                    // Text node, inline elements are subjected, except for <script>/<style>.
                    return name && name in dtd.$inline &&
                        !(name in dtd.head) &&
                        !node.isOrphan ||
                        node.type == NodeType.NODE_TEXT;
                }
            }

            // Judge whether two element tag names are likely the siblings from the same
            // structural element.
            function possiblySibling(tag1, tag2) {

                if (tag1 in dtd.$listItem || tag1 in dtd.$tableContent)
                    return tag1 == tag2 || tag1 == 'dt' && tag2 == 'dd' || tag1 == 'dd' && tag2 == 'dt';

                return false;
            }

            parser.onTagOpen = function (tagName, attributes, selfClosing, optionalClose) {
                var element = new htmlParser.element(tagName, attributes);

                // "isEmpty" will be always "false" for unknown elements, so we
                // must force it if the parser has identified it as a selfClosing tag.
                if (element.isUnknown && selfClosing)
                    element.isEmpty = true;

                // Check for optional closed elements, including browser quirks and manually opened blocks.
                element.isOptionalClose = optionalClose;

                // This is a tag to be removed if empty, so do not add it immediately.
                if (isRemoveEmpty(element)) {
                    pendingInline.push(element);
                    return;
                } else if (tagName == 'pre')
                    inPre = true;
                else if (tagName == 'br' && inPre) {
                    currentNode.add(new htmlParser.text('\n'));
                    return;
                } else if (tagName == 'textarea') {
                    inTextarea = true;
                }

                if (tagName == 'br') {
                    pendingBRs.push(element);
                    return;
                }

                while (1) {
                    var currentName = currentNode.name;

                    var currentDtd = currentName ? (dtd[currentName] || (currentNode._.isBlockLike ? dtd.div : dtd.span)) : rootDtd;

                    // If the element cannot be child of the current element.
                    if (!element.isUnknown && !currentNode.isUnknown && !currentDtd[tagName]) {
                        // Current node doesn't have a close tag, time for a close
                        if (currentNode.isOptionalClose)
                            parser.onTagClose(currentName);
                        else if (tagName in listBlocks && currentName in listBlocks) {
                            var children = currentNode.children,
                                lastChild = children[children.length - 1];

                            // Establish the list item if it's not existed.
                            if (!(lastChild && lastChild.name == 'li'))
                                addElement((lastChild = new htmlParser.element('li')), currentNode);

                            !element.returnPoint && (element.returnPoint = currentNode);
                            currentNode = lastChild;
                        }
                        // Establish new list root for orphan list items, but NOT to create
                        // <dl><dt>foo<dd>bar</dl>
                        // <ul><li>foo<li>bar</ul>
                        else if (tagName in dtd.$listItem &&
                            !possiblySibling(tagName, currentName)) {
                            parser.onTagOpen(tagName == 'li' ? 'ul' : 'dl', {}, 0, 1);
                        }
                        // We're inside a structural block like table and list, AND the incoming element
                        // is not of the same type (e.g. <td>td1<td>td2</td>), we simply add this new one before it,
                        // and most importantly, return back to here once this element is added,
                        // e.g. <table><tr><td>td1</td><p>p1</p><td>td2</td></tr></table>
                        else if (currentName in nonBreakingBlocks &&
                            !possiblySibling(tagName, currentName)) {
                            !element.returnPoint && (element.returnPoint = currentNode);
                            currentNode = currentNode.parent;
                        } else {
                            // The current element is an inline element, which
                            // need to be continued even after the close, so put
                            // it in the pending list.
                            if (currentName in dtd.$inline)
                                pendingInline.unshift(currentNode);

                            // The most common case where we just need to close the
                            // current one and append the new one to the parent.
                            if (currentNode.parent)
                                addElement(currentNode, currentNode.parent, 1);
                            // We've tried our best to fix the embarrassment here, while
                            // this element still doesn't find it's parent, mark it as
                            // orphan and show our tolerance to it.
                            else {
                                element.isOrphan = 1;
                                break;
                            }
                        }
                    } else {
                        break;
                    }
                }

                checkPending(tagName);
                sendPendingBRs();

                element.parent = currentNode;

                if (element.isEmpty)
                    addElement(element);
                else
                    currentNode = element;
            };

            parser.onTagClose = function (tagName) {
                // Check if there is any pending tag to be closed.
                for (var i = pendingInline.length - 1; i >= 0; i--) {
                    // If found, just remove it from the list.
                    if (tagName == pendingInline[i].name) {
                        pendingInline.splice(i, 1);
                        return;
                    }
                }

                var pendingAdd = [],
                    newPendingInline = [],
                    candidate = currentNode;

                while (candidate != root && candidate.name != tagName) {
                    // If this is an inline element, add it to the pending list, if we're
                    // really closing one of the parents element later, they will continue
                    // after it.
                    if (!candidate._.isBlockLike)
                        newPendingInline.unshift(candidate);

                    // This node should be added to it's parent at this point. But,
                    // it should happen only if the closing tag is really closing
                    // one of the nodes. So, for now, we just cache it.
                    pendingAdd.push(candidate);

                    // Make sure return point is properly restored.
                    candidate = candidate.returnPoint || candidate.parent;
                }

                if (candidate != root) {
                    // Add all elements that have been found in the above loop.
                    for (i = 0; i < pendingAdd.length; i++) {
                        var node = pendingAdd[i];
                        addElement(node, node.parent);
                    }

                    currentNode = candidate;

                    if (candidate._.isBlockLike)
                        sendPendingBRs();

                    addElement(candidate, candidate.parent);

                    // The parent should start receiving new nodes now, except if
                    // addElement changed the currentNode.
                    if (candidate == currentNode)
                        currentNode = currentNode.parent;

                    pendingInline = pendingInline.concat(newPendingInline);
                }

                if (tagName == 'body')
                    fixingBlock = false;
            };

            parser.onText = function (text) {
                // Trim empty spaces at beginning of text contents except <pre> and <textarea>.
                if ((!currentNode._.hasInlineStarted || pendingBRs.length) && !inPre && !inTextarea) {
                    text = tools.ltrim(text);

                    if (text.length === 0)
                        return;
                }

                var currentName = currentNode.name,
                    currentDtd = currentName ? (dtd[currentName] || (currentNode._.isBlockLike ? dtd.div : dtd.span)) : rootDtd;

                if (!inTextarea && !currentDtd['#'] && currentName in nonBreakingBlocks) {
                    parser.onTagOpen(structureFixes[currentName] || '');
                    parser.onText(text);
                    return;
                }

                sendPendingBRs();
                checkPending();

                // Shrinking consequential spaces into one single for all elements
                // text contents.
                if (!inPre && !inTextarea)
                    text = text.replace(/[\t\r\n ]{2,}|[\t\r\n]/g, ' ');

                text = new htmlParser.text(text);


                if (checkAutoParagraphing(currentNode, text))
                    this.onTagOpen(fixingBlock, {}, 0, 1);

                currentNode.add(text);
            };

            parser.onCDATA = function (cdata) {
                currentNode.add(new htmlParser.cdata(cdata));
            };

            parser.onComment = function (comment) {
                sendPendingBRs();
                checkPending();
                currentNode.add(new htmlParser.comment(comment));
            };

            // Parse it.
            parser.parse(fragmentHtml);

            sendPendingBRs();

            // Close all pending nodes, make sure return point is properly restored.
            while (currentNode != root)
                addElement(currentNode, currentNode.parent, 1);

            removeTailWhitespace(root);

            return root;
        };

        htmlParser.fragment.prototype = {


            type: NodeType.NODE_DOCUMENT_FRAGMENT,

            /**
             * Adds a node to this fragment.
             *
             * @param {htmlParser.node} node The node to be added.
             * @param {Number} [index] From where the insertion happens.
             */
            add: function (node, index) {
                isNaN(index) && (index = this.children.length);

                var previous = index > 0 ? this.children[index - 1] : null;
                if (previous) {
                    // If the block to be appended is following text, trim spaces at
                    // the right of it.
                    if (node._.isBlockLike && previous.type == NodeType.NODE_TEXT) {
                        previous.value = tools.rtrim(previous.value);

                        // If we have completely cleared the previous node.
                        if (previous.value.length === 0) {
                            // Remove it from the list and add the node again.
                            this.children.pop();
                            this.add(node);
                            return;
                        }
                    }

                    previous.next = node;
                }

                node.previous = previous;
                node.parent = this;

                this.children.splice(index, 0, node);

                if (!this._.hasInlineStarted)
                    this._.hasInlineStarted = node.type == NodeType.NODE_TEXT || (node.type == NodeType.NODE_ELEMENT && !node._.isBlockLike);
            },

            /**
             * Filter this fragment's content with given filter.
             *
             * @since 4.1.0
             * @param {htmlParser.filter} filter
             */
            filter: function (filter, context) {
                context = this.getFilterContext(context);

                // Apply the root filter.
                filter.onRoot(context, this);

                this.filterChildren(filter, false, context);
            },

            /**
             * Filter this fragment's children with given filter.
             *
             * Element's children may only be filtered once by one
             * instance of filter.
             *
             * @since 4.1.0
             * @param {htmlParser.filter} filter
             * @param {Boolean} [filterRoot] Whether to apply the "root" filter rule specified in the `filter`.
             */
            filterChildren: function (filter, filterRoot, context) {
                // If this element's children were already filtered
                // by current filter, don't filter them 2nd time.
                // This situation may occur when filtering bottom-up
                // (filterChildren() called manually in element's filter),
                // or in unpredictable edge cases when filter
                // is manipulating DOM structure.
                if (this.childrenFilteredBy == filter.id)
                    return;

                context = this.getFilterContext(context);

                // Filtering root if enforced.
                if (filterRoot && !this.parent)
                    filter.onRoot(context, this);

                this.childrenFilteredBy = filter.id;

                // Don't cache anything, children array may be modified by filter rule.
                for (var i = 0; i < this.children.length; i++) {
                    // Stay in place if filter returned false, what means
                    // that node has been removed.
                    if (this.children[i].filter(filter, context) === false)
                        i--;
                }
            },
            writeHtml: function (writer, filter) {
                if (filter)
                    this.filter(filter);

                this.writeChildrenHtml(writer);
            },
            writeChildrenHtml: function (writer, filter, filterRoot) {
                var context = this.getFilterContext();

                // Filtering root if enforced.
                if (filterRoot && !this.parent && filter)
                    filter.onRoot(context, this);

                if (filter)
                    this.filterChildren(filter, false, context);

                for (var i = 0, children = this.children, l = children.length; i < l; i++)
                    children[i].writeHtml(writer);
            },

            /**
             * Execute callback on each node (of given type) in this document fragment.
             *
             *		var fragment = htmlParser.fragment.fromHtml( '<p>foo<b>bar</b>bom</p>' );
             *		fragment.forEach( function( node ) {
             *			console.log( node );
             *		} );
             *		// Will log:
             *		// 1. document fragment,
             *		// 2. <p> element,
             *		// 3. "foo" text node,
             *		// 4. <b> element,
             *		// 5. "bar" text node,
             *		// 6. "bom" text node.
             *
             * @since 4.1.0
             * @param {Function} callback Function to be executed on every node.
             * **Since 4.3.0** if `callback` returned `false` descendants of current node will be ignored.
             * @param {htmlParser.node} callback.node Node passed as argument.
             * @param {Number} [type] If specified `callback` will be executed only on nodes of this type.
             * @param {Boolean} [skipRoot] Don't execute `callback` on this fragment.
             */
            forEach: function (callback, type, skipRoot) {
                if (!skipRoot && (!type || this.type == type))
                    var ret = callback(this);

                // Do not filter children if callback returned false.
                if (ret === false)
                    return;

                var children = this.children,
                    node,
                    i = 0;

                // We do not cache the size, because the list of nodes may be changed by the callback.
                for (; i < children.length; i++) {
                    node = children[i];
                    if (node.type == NodeType.NODE_ELEMENT)
                        node.forEach(callback, type);
                    else if (!type || node.type == type)
                        callback(node);
                }
            },

            getFilterContext: function (context) {
                return context || {};
            }
        };
    })();


    htmlParser.node = function () { };
    htmlParser.node.prototype = {

        remove: function () {
            var children = this.parent.children,
                index = tools.indexOf(children, this),
                previous = this.previous,
                next = this.next;

            previous && (previous.next = next);
            next && (next.previous = previous);
            children.splice(index, 1);
            this.parent = null;
        },
        replaceWith: function (node) {
            var children = this.parent.children,
                index = tools.indexOf(children, this),
                previous = node.previous = this.previous,
                next = node.next = this.next;

            previous && (previous.next = node);
            next && (next.previous = node);

            children[index] = node;

            node.parent = this.parent;
            this.parent = null;
        },
        insertAfter: function (node) {
            var children = node.parent.children,
                index = tools.indexOf(children, node),
                next = node.next;

            children.splice(index + 1, 0, this);

            this.next = node.next;
            this.previous = node;
            node.next = this;
            next && (next.previous = this);

            this.parent = node.parent;
        },
        insertBefore: function (node) {
            var children = node.parent.children,
                index = tools.indexOf(children, node);

            children.splice(index, 0, this);

            this.next = node;
            this.previous = node.previous;
            node.previous && (node.previous.next = this);
            node.previous = this;

            this.parent = node.parent;
        },
        getAscendant: function (condition) {
            var checkFn =
                typeof condition == 'function' ?
                    condition :
                    typeof condition == 'string' ?
                        function (el) {
                            return el.name == condition;
                        } :
                        function (el) {
                            return el.name in condition;
                        };

            var parent = this.parent;

            // Parent has to be an element - don't check doc fragment.
            while (parent && parent.type == NodeType.NODE_ELEMENT) {
                if (checkFn(parent))
                    return parent;
                parent = parent.parent;
            }

            return null;
        },
        wrapWith: function (wrapper) {
            this.replaceWith(wrapper);
            wrapper.add(this);
            return wrapper;
        },
        getIndex: function () {
            return tools.indexOf(this.parent.children, this);
        },

        getFilterContext: function (context) {
            return context || {};
        }
    };
    htmlParser.text = function (value) {
        /**
         * The text value.
         *
         * @property {String}
         */
        this.value = value;

        /** @private */
        this._ = {
            isBlockLike: false
        };
    };
    htmlParser.text.prototype = tools.extend(new htmlParser.node(), {

        type: NodeType.NODE_TEXT,

        filter: function (filter, context) {
            if (!(this.value = filter.onText(context, this.value, this))) {
                this.remove();
                return false;
            }
        },
        writeHtml: function (writer, filter) {
            if (filter)
                this.filter(filter);

            writer.text(this.value);
        }
    });

    htmlParser.basicWriter = tools.createClass({
        $: function () {
            this._ = {
                output: []
            };
        },
        proto: {
            openTag: function (tagName) {
                this._.output.push('<', tagName);
            },
            openTagClose: function (tagName, isSelfClose) {
                if (isSelfClose)
                    this._.output.push(' />');
                else
                    this._.output.push('>');
            },
            attribute: function (attName, attValue) {
                if (typeof attValue == 'string')
                    attValue = tools.htmlEncodeAttr(attValue);

                this._.output.push(' ', attName, '="', attValue, '"');
            },
            closeTag: function (tagName) {
                this._.output.push('</', tagName, '>');
            },
            text: function (text) {
                this._.output.push(text);
            },
            comment: function (comment) {
                this._.output.push('<!--', comment, '-->');
            },
            write: function (data) {
                this._.output.push(data);
            },
            reset: function () {
                this._.output = [];
                this._.indent = false;
            },
            getHtml: function (reset) {
                var html = this._.output.join('');

                if (reset)
                    this.reset();

                return html;
            }
        }
    });
    htmlParser.filter = tools.createClass({
        $: function (rules) {
            this.id = tools.getNextNumber();
            this.elementNameRules = new filterRulesGroup();
            this.attributeNameRules = new filterRulesGroup();
            this.elementsRules = {};
            this.attributesRules = {};
            this.textRules = new filterRulesGroup();
            this.commentRules = new filterRulesGroup();
            this.rootRules = new filterRulesGroup();

            if (rules)
                this.addRules(rules, 10);
        },

        proto: {
            addRules: function (rules, options) {
                var priority;

                // Backward compatibility.
                if (typeof options == 'number')
                    priority = options;
                // New version - try reading from options.
                else if (options && ('priority' in options))
                    priority = options.priority;

                // Defaults.
                if (typeof priority != 'number')
                    priority = 10;
                if (typeof options != 'object')
                    options = {};

                // Add the elementNames.
                if (rules.elementNames)
                    this.elementNameRules.addMany(rules.elementNames, priority, options);

                // Add the attributeNames.
                if (rules.attributeNames)
                    this.attributeNameRules.addMany(rules.attributeNames, priority, options);

                // Add the elements.
                if (rules.elements)
                    addNamedRules(this.elementsRules, rules.elements, priority, options);

                // Add the attributes.
                if (rules.attributes)
                    addNamedRules(this.attributesRules, rules.attributes, priority, options);

                // Add the text.
                if (rules.text)
                    this.textRules.add(rules.text, priority, options);

                // Add the comment.
                if (rules.comment)
                    this.commentRules.add(rules.comment, priority, options);

                // Add root node rules.
                if (rules.root)
                    this.rootRules.add(rules.root, priority, options);
            },
            applyTo: function (node) {
                node.filter(this);
            },

            onElementName: function (context, name) {
                return this.elementNameRules.execOnName(context, name);
            },

            onAttributeName: function (context, name) {
                return this.attributeNameRules.execOnName(context, name);
            },

            onText: function (context, text, node) {
                return this.textRules.exec(context, text, node);
            },

            onComment: function (context, commentText, comment) {
                return this.commentRules.exec(context, commentText, comment);
            },

            onRoot: function (context, element) {
                return this.rootRules.exec(context, element);
            },

            onElement: function (context, element) {
                // We must apply filters set to the specific element name as
                // well as those set to the generic ^/$ name. So, add both to an
                // array and process them in a small loop.
                var rulesGroups = [this.elementsRules['^'], this.elementsRules[element.name], this.elementsRules.$],
                    rulesGroup, ret;

                for (var i = 0; i < 3; i++) {
                    rulesGroup = rulesGroups[i];
                    if (rulesGroup) {
                        ret = rulesGroup.exec(context, element, this);

                        if (ret === false)
                            return null;

                        if (ret && ret != element)
                            return this.onNode(context, ret);

                        // The non-root element has been dismissed by one of the filters.
                        if (element.parent && !element.name)
                            break;
                    }
                }

                return element;
            },

            onNode: function (context, node) {
                var type = node.type;

                return type == NodeType.NODE_ELEMENT ? this.onElement(context, node) :
                    type == NodeType.NODE_TEXT ? new NodeType.htmlParser.text(this.onText(context, node.value, node)) :
                        type == NodeType.NODE_COMMENT ? new NodeType.htmlParser.comment(this.onComment(context, node.value, node)) : null;
            },

            onAttribute: function (context, element, name, value) {
                var rulesGroup = this.attributesRules[name];

                if (rulesGroup)
                    return rulesGroup.exec(context, value, element, this);
                return value;
            }
        }
    });
    htmlParser.comment = function (value) {
        this.value = value;

        /** @private */
        this._ = {
            isBlockLike: false
        };
    };
    htmlParser.comment.prototype = tools.extend(new htmlParser.node(), {
        type: NodeType.NODE_COMMENT,
        filter: function (filter, context) {
            var comment = this.value;

            if (!(comment = filter.onComment(context, comment, this))) {
                this.remove();
                return false;
            }

            if (typeof comment != 'string') {
                this.replaceWith(comment);
                return false;
            }

            this.value = comment;

            return true;
        },
        writeHtml: function (writer, filter) {
            if (filter)
                this.filter(filter);

            writer.comment(this.value);
        }
    });
    htmlParser.element = function (name, attributes) {

        this.name = name;

        this.attributes = attributes || {};

        this.children = [];

        var realName = name || '',
            prefixed = realName.match(/^cke:(.*)/);
        prefixed && (realName = prefixed[1]);

        var isBlockLike = !!(dtd.$nonBodyContent[realName] || dtd.$block[realName] ||
            dtd.$listItem[realName] || dtd.$tableContent[realName] ||
            dtd.$nonEditable[realName] || realName == 'br');

        this.isEmpty = !!dtd.$empty[name];
        this.isUnknown = !dtd[name];

        /** @private */
        this._ = {
            isBlockLike: isBlockLike,
            hasInlineStarted: this.isEmpty || !isBlockLike
        };
    };

    // htmlParser.element.prototype 
    (function () {
        // Used to sort attribute entries in an array, where the first element of
        // each object is the attribute name.
        var sortAttribs = function (a, b) {
            a = a[0];
            b = b[0];
            return a < b ? -1 : a > b ? 1 : 0;
        },
            fragProto = htmlParser.fragment.prototype;

        htmlParser.element.prototype = tools.extend(new htmlParser.node(), {
            type: NodeType.NODE_ELEMENT,
            add: fragProto.add,
            clone: function () {
                return new htmlParser.element(this.name, this.attributes);
            },
            filter: function (filter, context) {
                var element = this,
                    originalName, name;

                context = element.getFilterContext(context);

                // Filtering if it's the root node.
                if (!element.parent)
                    filter.onRoot(context, element);

                while (true) {
                    originalName = element.name;

                    if (!(name = filter.onElementName(context, originalName))) {
                        this.remove();
                        return false;
                    }

                    element.name = name;

                    if (!(element = filter.onElement(context, element))) {
                        this.remove();
                        return false;
                    }

                    // New element has been returned - replace current one
                    // and process it (stop processing this and return false, what
                    // means that element has been removed).
                    if (element !== this) {
                        this.replaceWith(element);
                        return false;
                    }

                    // If name has been changed - continue loop, so in next iteration
                    // filters for new name will be applied to this element.
                    // If name hasn't been changed - stop.
                    if (element.name == originalName)
                        break;

                    // If element has been replaced with something of a
                    // different type, then make the replacement filter itself.
                    if (element.type != NodeType.NODE_ELEMENT) {
                        this.replaceWith(element);
                        return false;
                    }

                    // This indicate that the element has been dropped by
                    // filter but not the children.
                    if (!element.name) {
                        this.replaceWithChildren();
                        return false;
                    }
                }

                var attributes = element.attributes,
                    a, value, newAttrName;

                for (a in attributes) {
                    newAttrName = a;
                    value = attributes[a];

                    // Loop until name isn't modified.
                    // A little bit senseless, but IE would do that anyway
                    // because it iterates with for-in loop even over properties
                    // created during its run.
                    while (true) {
                        if (!(newAttrName = filter.onAttributeName(context, a))) {
                            delete attributes[a];
                            break;
                        } else if (newAttrName != a) {
                            delete attributes[a];
                            a = newAttrName;
                            continue;
                        } else {
                            break;
                        }
                    }

                    if (newAttrName) {
                        if ((value = filter.onAttribute(context, element, newAttrName, value)) === false)
                            delete attributes[newAttrName];
                        else
                            attributes[newAttrName] = value;
                    }
                }

                if (!element.isEmpty)
                    this.filterChildren(filter, false, context);

                return true;
            },
            filterChildren: fragProto.filterChildren,
            writeHtml: function (writer, filter) {
                if (filter)
                    this.filter(filter);

                var name = this.name,
                    attribsArray = [],
                    attributes = this.attributes,
                    attrName,
                    attr, i, l;

                // Open element tag.
                writer.openTag(name, attributes);

                // Copy all attributes to an array.
                for (attrName in attributes)
                    attribsArray.push([attrName, attributes[attrName]]);

                // Sort the attributes by name.
                if (writer.sortAttributes)
                    attribsArray.sort(sortAttribs);

                // Send the attributes.
                for (i = 0, l = attribsArray.length; i < l; i++) {
                    attr = attribsArray[i];
                    writer.attribute(attr[0], attr[1]);
                }

                // Close the tag.
                writer.openTagClose(name, this.isEmpty);

                this.writeChildrenHtml(writer);

                // Close the element.
                if (!this.isEmpty)
                    writer.closeTag(name);
            },
            writeChildrenHtml: fragProto.writeChildrenHtml,
            replaceWithChildren: function () {
                var children = this.children;

                for (var i = children.length; i;)
                    children[--i].insertAfter(this);

                this.remove();
            },
            forEach: fragProto.forEach,
            getFirst: function (condition) {
                if (!condition)
                    return this.children.length ? this.children[0] : null;

                if (typeof condition != 'function')
                    condition = nameCondition(condition);

                for (var i = 0, l = this.children.length; i < l; ++i) {
                    if (condition(this.children[i]))
                        return this.children[i];
                }
                return null;
            },
            getHtml: function () {
                var writer = new htmlParser.basicWriter();
                this.writeChildrenHtml(writer);
                return writer.getHtml();
            },
            setHtml: function (html) {
                var children = this.children = htmlParser.fragment.fromHtml(html).children;

                for (var i = 0, l = children.length; i < l; ++i)
                    children[i].parent = this;
            },
            getOuterHtml: function () {
                var writer = new htmlParser.basicWriter();
                this.writeHtml(writer);
                return writer.getHtml();
            },
            split: function (index) {
                var cloneChildren = this.children.splice(index, this.children.length - index),
                    clone = this.clone();

                for (var i = 0; i < cloneChildren.length; ++i)
                    cloneChildren[i].parent = clone;

                clone.children = cloneChildren;

                if (cloneChildren[0])
                    cloneChildren[0].previous = null;

                if (index > 0)
                    this.children[index - 1].next = null;

                this.parent.add(clone, this.getIndex() + 1);

                return clone;
            },
            find: function (criteria, recursive) {
                if (recursive === undefined) {
                    recursive = false;
                }

                var ret = [],
                    i;

                for (i = 0; i < this.children.length; i++) {
                    var curChild = this.children[i];

                    if (typeof criteria == 'function' && criteria(curChild)) {
                        ret.push(curChild);
                    } else if (typeof criteria == 'string' && curChild.name === criteria) {
                        ret.push(curChild);
                    }

                    if (recursive && curChild.find) {
                        ret = ret.concat(curChild.find(criteria, recursive));
                    }
                }

                return ret;
            },
            findOne: function (criteria, recursive) {
                var nestedMatch = null,
                    match = tools.array.find(this.children, function (child) {
                        var isMatching = typeof criteria === 'function' ? criteria(child) : child.name === criteria;

                        if (isMatching || !recursive) {
                            return isMatching;
                        }

                        if (child.children && child.findOne) {
                            nestedMatch = child.findOne(criteria, true);
                        }

                        return !!nestedMatch;
                    });

                return nestedMatch || match || null;
            },
            addClass: function (className) {
                if (this.hasClass(className))
                    return;

                var c = this.attributes['class'] || '';

                this.attributes['class'] = c + (c ? ' ' : '') + className;
            },
            removeClass: function (className) {
                var classes = this.attributes['class'];

                if (!classes)
                    return;

                // We can safely assume that className won't break regexp.
                // http://stackoverflow.com/questions/448981/what-characters-are-valid-in-css-class-names
                classes = tools.trim(classes.replace(new RegExp('(?:\\s+|^)' + className + '(?:\\s+|$)'), ' '));

                if (classes)
                    this.attributes['class'] = classes;
                else
                    delete this.attributes['class'];
            },
            hasClass: function (className) {
                var classes = this.attributes['class'];

                if (!classes)
                    return false;

                return (new RegExp('(?:^|\\s)' + className + '(?=\\s|$)')).test(classes);
            },
            getFilterContext: function (ctx) {
                var changes = [];

                if (!ctx) {
                    ctx = {
                        nonEditable: false,
                        nestedEditable: false
                    };
                }

                if (!ctx.nonEditable && this.attributes.contenteditable == 'false')
                    changes.push('nonEditable', true);
                // so ctx.nonEditable has not been yet set to true.
                else if (ctx.nonEditable && !ctx.nestedEditable && this.attributes.contenteditable == 'true')
                    changes.push('nestedEditable', true);

                if (changes.length) {
                    ctx = tools.copy(ctx);
                    for (var i = 0; i < changes.length; i += 2)
                        ctx[changes[i]] = changes[i + 1];
                }

                return ctx;
            }
        }, true);

        function nameCondition(condition) {
            return function (el) {
                return el.type == NodeType.NODE_ELEMENT &&
                    (typeof condition == 'string' ? el.name == condition : el.name in condition);
            };
        }
    })();



    function filterRulesGroup() {
        this.rules = [];
    };
    htmlParser.filterRulesGroup = filterRulesGroup;
    filterRulesGroup.prototype = {
        add: function (rule, priority, options) {
            this.rules.splice(this.findIndex(priority), 0, {
                value: rule,
                priority: priority,
                options: options
            });
        },
        addMany: function (rules, priority, options) {
            var args = [this.findIndex(priority), 0];

            for (var i = 0, len = rules.length; i < len; i++) {
                args.push({
                    value: rules[i],
                    priority: priority,
                    options: options
                });
            }

            this.rules.splice.apply(this.rules, args);
        },
        findIndex: function (priority) {
            var rules = this.rules,
                len = rules.length,
                i = len - 1;

            // Search from the end, because usually rules will be added with default priority, so
            // we will be able to stop loop quickly.
            while (i >= 0 && priority < rules[i].priority)
                i--;

            return i + 1;
        },
        exec: function (context, currentValue) {
            var isNode = currentValue instanceof htmlParser.node || currentValue instanceof htmlParser.fragment,
                // Splice '1' to remove context, which we don't want to pass to filter rules.
                args = Array.prototype.slice.call(arguments, 1),
                rules = this.rules,
                len = rules.length,
                orgType, orgName, ret, i, rule;

            for (i = 0; i < len; i++) {
                // Backup the node info before filtering.
                if (isNode) {
                    orgType = currentValue.type;
                    orgName = currentValue.name;
                }

                rule = rules[i];
                if (isRuleApplicable(context, rule)) {
                    ret = rule.value.apply(null, args);

                    if (ret === false)
                        return ret;

                    // We're filtering node (element/fragment).
                    // No further filtering if it's not anymore fitable for the subsequent filters.
                    if (isNode && ret && (ret.name != orgName || ret.type != orgType))
                        return ret;

                    // Update currentValue and corresponding argument in args array.
                    // Updated values will be used in next for-loop step.
                    if (ret != null)
                        args[0] = currentValue = ret;

                    // ret == undefined will continue loop as nothing has happened.
                }
            }

            return currentValue;
        },
        execOnName: function (context, currentName) {
            var i = 0,
                rules = this.rules,
                len = rules.length,
                rule;

            for (; currentName && i < len; i++) {
                rule = rules[i];
                if (isRuleApplicable(context, rule))
                    currentName = currentName.replace(rule.value[0], rule.value[1]);
            }

            return currentName;
        }
    };

    function falseIfEmpty( value ) {
		if ( value === '' ) {
			return false;
		}

		return value;
	}

	function fixList( element ) {
		var listRegex = /(o|u)l/i;

		if ( !listRegex.test( element.parent.name ) ) {
			return element;
		}

		commonFilter.elements.replaceWithChildren( element );

		return false;
	}

	function unwrapList( element ) {
		var children = element.children,
			listRegex = /(o|u)l/i;

		if ( children.length !== 1 || !listRegex.test( children[ 0 ].name ) ) {
			return element;
		}

		commonFilter.elements.replaceWithChildren( element );

		return false;
	}

    function addNamedRules(rulesGroups, newRules, priority, options) {
        var ruleName, rulesGroup;

        for (ruleName in newRules) {
            rulesGroup = rulesGroups[ruleName];

            if (!rulesGroup)
                rulesGroup = rulesGroups[ruleName] = new filterRulesGroup();

            rulesGroup.add(newRules[ruleName], priority, options);
        }
    }

    function isRuleApplicable(context, rule) {
        if (context.nonEditable && !rule.options.applyToAll)
            return false;

        if (context.nestedEditable && rule.options.excludeNestedEditable)
            return false;

        return true;
    }

    function fixValue(value) {
        // Add 'px' only for values which are not ended with %
        var endsWithPercent = /%$/;

        return endsWithPercent.test(value) ? value : value + 'px';
    }

    function createAttributeStack(element, filter) {
        var i,
            children = [];

        element.filterChildren(filter);

        // Store element's children somewhere else.
        for (i = element.children.length - 1; i >= 0; i--) {
            children.unshift(element.children[i]);
            element.children[i].remove();
        }

        // Create a stack of spans with each containing one style.
        var attributes = element.attributes,
            innermostElement = element,
            topmost = true;

        for (var attribute in attributes) {

            if (topmost) {
                topmost = false;
                continue;
            }

            var newElement = new htmlParser.element(element.name);

            newElement.attributes[attribute] = attributes[attribute];

            innermostElement.add(newElement);
            innermostElement = newElement;

            delete attributes[attribute];
        }

        // Add the stored children to the innermost span.
        for (i = 0; i < children.length; i++) {
            innermostElement.add(children[i]);
        }
    }

    function parseShorthandMargins(style) {
        var marginCase = style.margin ? 'margin' : style.MARGIN ? 'MARGIN' : false,
            key, margin;
        if (marginCase) {
            margin = tools.style.parse.margin(style[marginCase]);
            for (key in margin) {
                style['margin-' + key] = margin[key];
            }
            delete style[marginCase];
        }
    }

    function removeSuperfluousStyles(element) {
        var resetStyles = [
            'background-color:transparent',
            'background:transparent',
            'background-color:none',
            'background:none',
            'background-position:initial initial',
            'background-repeat:initial initial',
            'caret-color',
            'font-family:-webkit-standard',
            'font-variant-caps',
            'letter-spacing:normal',
            'orphans',
            'widows',
            'text-transform:none',
            'word-spacing:0px',
            '-webkit-text-size-adjust:auto',
            '-webkit-text-stroke-width:0px',
            'text-indent:0px',
            'margin-bottom:0in'
        ];

        var styles = tools.parseCssText(element.attributes.style),
            styleName,
            styleString;

        for (styleName in styles) {
            styleString = styleName + ':' + styles[styleName];

            if (tools.array.some(resetStyles, function (val) {
                return styleString.substring(0, val.length).toLowerCase() === val;
            })) {
                delete styles[styleName];
                continue;
            }
        }

        styles = tools.writeCssText(styles);

        if (styles !== '') {
            element.attributes.style = styles;
        } else {
            delete element.attributes.style;
        }
    }
    function getMatchingFonts(editor) {
        var fontNames = editor.config ? editor.config.font_names : null,
            validNames = [];

        if (!fontNames || !fontNames.length) {
            return false;
        }

        validNames = tools.array.map(fontNames.split(';'), function (value) {
            // Font can have a short name at the begining. It's necessary to remove it, to apply correct style.
            if (value.indexOf('/') === -1) {
                return value;
            }

            return value.split('/')[1];
        });

        return validNames.length ? validNames : false;
    }
    function replaceWithMatchingFont(fontValue, availableFonts) {
        var fontParts = fontValue.split(','),
            matchingFont = tools.array.find(availableFonts, function (font) {
                for (var i = 0; i < fontParts.length; i++) {
                    if (font.indexOf(tools.trim(fontParts[i])) === -1) {
                        return false;
                    }
                }

                return true;
            });

        return matchingFont || fontValue;
    }

    function normalizeAttributesName(element) {
        if (element.attributes.bgcolor) {
            var styles = tools.parseCssText(element.attributes.style);

            if (!styles['background-color']) {
                styles['background-color'] = element.attributes.bgcolor;

                element.attributes.style = tools.writeCssText(styles);
            }
        }
    }
    function remove() {
        return false;
    }


    baidu.editor.office = baidu.editor.office || {};
    baidu.editor.office = {
        getContentGeneratorName: function (content) {
            var metaGeneratorTag = /<meta\s+name=["']?generator["']?\s+content=["']?(\w+)/gi,
                result = metaGeneratorTag.exec(content),
                generatorName;

            if (!result || !result.length) {
                return;
            }

            generatorName = result[1].toLowerCase();

            if (generatorName.indexOf('microsoft') === 0) {
                return 'microsoft';
            }

            if (generatorName.indexOf('libreoffice') === 0) {
                return 'libreoffice';
            }

            return 'unknown';
        },
        inliner: {
            inline: function (html) {
                var parseStyles = Style.inliner.parse,
                    sortStyles = Style.inliner.sort,
                    document = createTempDocument(html),
                    stylesTags = document.find('style'),
                    stylesArray = sortStyles(parseStyleTags(stylesTags));

                function createTempDocument(html) {
                    var parser = new DOMParser(),
                        document = parser.parseFromString(html, 'text/html');

                    return new dom.document(document);
                }

                function parseStyleTags(stylesTags) {
                    var styles = [],
                        i;

                    for (i = 0; i < stylesTags.count(); i++) {
                        styles = styles.concat(parseStyles(stylesTags.getItem(i)));
                    }

                    return styles;
                }

                function applyStyle(document, selector, style) {
                    var elements = document.find(selector),
                        element,
                        oldStyle,
                        newStyle,
                        i;

                    parseShorthandMargins(style);

                    for (i = 0; i < elements.count(); i++) {
                        element = elements.getItem(i);

                        oldStyle = tools.parseCssText(element.getAttribute('style'));

                        parseShorthandMargins(oldStyle);
                        // The styles are applied with decreasing priority so we do not want
                        // to overwrite the existing properties.
                        newStyle = tools.extend({}, oldStyle, style);
                        element.setAttribute('style', tools.writeCssText(newStyle));
                    }
                }

                tools.array.forEach(stylesArray, function (style) {
                    applyStyle(document, style.selector, style.styles);
                });

                return document;
            }
        },
        htmlParser: htmlParser,
        plugins: plugins,
        tools: tools
    }
})(window, jQuery);
