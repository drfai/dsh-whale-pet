// dsh-whale-pet — Client half (browser bundle, hand-built module-loader factory).
//
// A floating desktop pet rendered from the Coopanion whale-maid layered sprite
// rig (whale-pet/assets/coopanion/whale/model.json): ~26 absolutely-positioned
// part layers + per-mood feat sprite layers for eyes/mouth/blush, animated with
// CSS keyframes that approximate figure.js's spring system (breath, blink, hair,
// bangs, tail, fins, ahoge, head tilt, busy swim, sleep droop). A persistent
// peak/off-peak countdown ring sits under the pet and refreshes locally every
// second from the Host's `/whale-pet/state` route. Outfit themes follow the
// billing phase via a CSS filter crossfade (hue-rotate/saturate/brightness).
//
// Rig facts (from figure.js / rig.js):
//  - rig space: x=128 under the body, soles at y=256; view [-12,-8,268,272] is
//    [x0,y0,x1,y1], i.e. a 280x280 window (the CSS container is 280*scale px).
//  - model.parts[].box [x,y,w,h] is the part's rest rect in rig space; z is the
//    paint order. grid[cols,rows] is the warp MESH density (not a sprite atlas —
//    no uvBox means each tex/<name>.png is one image stretched over its box).
//  - feat sprites are tiny PNGs whose natural size equals their master-pixel
//    rect; master->rig: U(x)=128+(x-X0)*S, V(y)=256-(FEET-y)*S (top edge of
//    master row y), S=0.19, X0=650, FEET=1363.
//  - expressions are layered OVER tex/face.png (which is blank skin): eyes come
//    from feat/eye{L,R}_{ball,iris,lash} (neutral open) or emotion sprites
//    (happy/sleep/surprised/love/dizzy/drag), mouth from feat/<mood>_mouth.png.
window.__ModuleLoader__.load({
  id: 'dsh-whale-pet',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    var React = require('react');

    // ── URLs / storage ──────────────────────────────────────────────────────
    var STATE_URL = 'whale-pet/state';
    var FALLBACK_IMG = 'whale-pet/image';
    var ASSET_BASE = 'whale-pet/assets/coopanion/whale/';
    var POS_KEY = 'dsh-whale-pet.pos';
    var STYLE_ID = 'dsh-whale-pet-style';

    // Anchor all requests to the Host's HTTP origin: the desktop shell page
    // lives on the custom `dsh-app://app` origin, and browser fetches there
    // are CORS-gated against the Host routes. The shell exposes its Host's
    // HTTP origin through `__DSH_TRANSPORT__.streamBaseUrl` — use it, falling
    // back to the page origin when it is already http(s).
    function hostBaseUrl() {
      try {
        var t = (typeof window !== 'undefined' && window.__DSH_TRANSPORT__) ? window.__DSH_TRANSPORT__.streamBaseUrl : null;
        if (t) {
          var u = new URL('/', t);
          if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
        }
      } catch (e) { /* ignore */ }
      try {
        if (location.protocol === 'http:' || location.protocol === 'https:') {
          return new URL('/', location.href).href;
        }
      } catch (e) { /* ignore */ }
      return null;
    }
    var _hb = hostBaseUrl();
    if (_hb) {
      STATE_URL = new URL('/' + STATE_URL, _hb).href;
      FALLBACK_IMG = new URL('/' + FALLBACK_IMG, _hb).href;
      ASSET_BASE = new URL('/' + ASSET_BASE, _hb).href;
    }

    // ── Outfit themes keyed by billing phase ─────────────────────────────────
    var THEMES = {
      peak: {
        label: '高峰计价',
        short: '高峰',
        icon: '🔥',
        nextLabel: '低谷',
        accent: '#ffb648',
        accentStrong: '#ff9d2e',
        glow: 'rgba(255, 157, 46, 0.45)',
        filter: 'url(#dsh-wp-tint-red)',
      },
      offpeak: {
        label: '低谷计价',
        short: '低谷',
        icon: '🌙',
        nextLabel: '高峰',
        accent: '#3fd0ff',
        accentStrong: '#2fb6e8',
        glow: 'rgba(61, 199, 255, 0.42)',
        filter: 'none',
      },
      'offpeak-weekend': {
        label: '周末低谷',
        short: '周末',
        icon: '🎐',
        nextLabel: '高峰',
        accent: '#7dd3ff',
        accentStrong: '#5db8f2',
        glow: 'rgba(125, 211, 255, 0.45)',
        filter: 'none',
      },
      'offpeak-holiday': {
        label: '节假日低谷',
        short: '假日',
        icon: '🎀',
        nextLabel: '高峰',
        accent: '#ff9ec7',
        accentStrong: '#f777ae',
        glow: 'rgba(255, 158, 199, 0.42)',
        filter: 'none',
      },
      unknown: {
        label: '计价未知',
        short: '未知',
        icon: '🐋',
        nextLabel: '…',
        accent: '#4d6bfe',
        accentStrong: '#3f5ce8',
        glow: 'rgba(77, 107, 254, 0.4)',
        filter: 'none',
      },
    };

    function themeOf(phase) {
      return THEMES[phase] || THEMES.unknown;
    }

    // ── Embedded rig: Coopanion whale model.json, verbatim ─────────────────
    var MODEL_JSON = `{
 "units": {
  "S": 0.19,
  "X0": 650,
  "FEET": 1363,
  "DS": 0.6,
  "featDS": 1
 },
 "pivots": {
  "body": [
   128.0,
   256.0
  ],
  "waist": [
   128.0,
   188.93
  ],
  "neck": [
   129.9,
   154.73
  ],
  "armNear": [
   113.18,
   166.13
  ],
  "armFar": [
   153.65,
   168.98
  ],
  "legBack": [
   112.42,
   203.18
  ],
  "legFront": [
   144.15,
   203.18
  ],
  "tail": [
   88.1,
   206.03
  ],
  "finNear": [
   80.88,
   128.13
  ],
  "finFar": [
   173.22,
   126.23
  ],
  "ahoge": [
   118.5,
   54.03
  ],
  "head": [
   137.5,
   114.83
  ]
 },
 "parts": [
  {
   "id": "hair_back",
   "tex": "hair_back",
   "z": 1,
   "parent": "hairSway",
   "grid": [
    8,
    12
   ],
   "box": [
    39.46,
    48.33,
    144.21,
    173.66
   ]
  },
  {
   "id": "tail",
   "tex": "tail",
   "z": 1.5,
   "parent": "tailBend",
   "grid": [
    10,
    4
   ],
   "box": [
    24.26,
    172.21,
    83.03,
    40.47
   ]
  },
  {
   "id": "hair_back_curl",
   "tex": "hair_back_curl",
   "z": 1.75,
   "parent": "hairSway",
   "grid": [
    4,
    8
   ],
   "box": [
    74.23,
    171.83,
    41.23,
    47.88
   ]
  },
  {
   "id": "arm_far",
   "tex": "arm_far",
   "z": 4.5,
   "parent": "armFar",
   "grid": [
    3,
    5
   ],
   "box": [
    144.91,
    163.28,
    28.5,
    39.71
   ]
  },
  {
   "id": "leg_back",
   "tex": "leg_back",
   "z": 3,
   "parent": "legBack",
   "grid": [
    3,
    6
   ],
   "box": [
    96.08,
    173.16,
    40.28,
    84.55
   ]
  },
  {
   "id": "leg_front",
   "tex": "leg_front",
   "z": 4,
   "parent": "legFront",
   "grid": [
    3,
    6
   ],
   "box": [
    120.21,
    168.79,
    43.7,
    86.83
   ]
  },
  {
   "id": "torso_up",
   "tex": "torso_up",
   "z": 5,
   "parent": "body",
   "grid": [
    6,
    6
   ],
   "box": [
    106.15,
    147.89,
    48.83,
    46.55
   ]
  },
  {
   "id": "hair_front_right",
   "tex": "hair_front_right",
   "z": 5.05,
   "parent": "hairSway",
   "grid": [
    4,
    6
   ],
   "box": [
    146.62,
    148.27,
    30.21,
    42.75
   ]
  },
  {
   "id": "arm_far_end_front",
   "tex": "arm_far_end_front",
   "z": 5.1,
   "parent": "armFar",
   "grid": [
    3,
    3
   ],
   "box": [
    156.88,
    183.99,
    16.53,
    19.0
   ]
  },
  {
   "id": "skirt",
   "tex": "skirt",
   "z": 5.2,
   "parent": "skirt",
   "grid": [
    8,
    6
   ],
   "box": [
    79.55,
    168.41,
    98.04,
    61.18
   ]
  },
  {
   "id": "skirt_sit",
   "tex": "skirt_sit",
   "z": 5.3,
   "parent": "skirtSit",
   "grid": [
    8,
    4
   ],
   "box": [
    47.44,
    168.98,
    151.81,
    68.97
   ]
  },
  {
   "id": "hair_front_left",
   "tex": "hair_front_left",
   "z": 5.4,
   "parent": "hairSway",
   "grid": [
    4,
    8
   ],
   "box": [
    60.93,
    118.63,
    44.84,
    76.57
   ]
  },
  {
   "id": "waist_bow_front",
   "tex": "waist_bow_front",
   "z": 5.5,
   "parent": "skirt",
   "grid": [
    4,
    4
   ],
   "box": [
    84.87,
    168.41,
    29.83,
    33.06
   ]
  },
  {
   "id": "waist_bow_sit_front",
   "tex": "waist_bow_sit_front",
   "z": 5.55,
   "parent": "skirtSit",
   "grid": [
    4,
    4
   ],
   "box": [
    79.74,
    168.98,
    39.52,
    28.88
   ]
  },
  {
   "id": "arm_near",
   "tex": "arm_near",
   "z": 6,
   "parent": "armNear",
   "grid": [
    4,
    6
   ],
   "box": [
    93.8,
    157.96,
    28.69,
    54.53
   ]
  },
  {
   "id": "fin_far",
   "tex": "fin_far",
   "z": 7,
   "parent": "finFar",
   "grid": [
    4,
    3
   ],
   "box": [
    166.0,
    103.62,
    38.76,
    39.14
   ]
  },
  {
   "id": "sidelocks",
   "tex": "sidelocks",
   "z": 7.5,
   "parent": "bangsSway",
   "grid": [
    4,
    8
   ],
   "box": [
    87.72,
    124.14,
    98.23,
    49.21
   ]
  },
  {
   "id": "face",
   "tex": "face",
   "z": 8,
   "parent": "headMid",
   "grid": [
    6,
    6
   ],
   "box": [
    100.26,
    73.98,
    75.62,
    82.08
   ]
  },
  {
   "id": "eye_creases",
   "tex": "eye_creases",
   "z": 8.5,
   "parent": "headFeat",
   "grid": [
    4,
    2
   ],
   "box": [
    126.29,
    108.94,
    44.46,
    9.88
   ]
  },
  {
   "id": "brows",
   "tex": "brows",
   "z": 8.6,
   "parent": "headFeat",
   "grid": [
    12,
    2
   ],
   "box": [
    117.74,
    97.35,
    58.33,
    9.12
   ]
  },
  {
   "id": "headdress",
   "tex": "headdress",
   "z": 12.5,
   "parent": "headMid",
   "grid": [
    8,
    4
   ],
   "box": [
    72.71,
    38.64,
    114.76,
    72.2
   ]
  },
  {
   "id": "fin_near",
   "tex": "fin_near",
   "z": 11,
   "parent": "finNear",
   "grid": [
    5,
    3
   ],
   "box": [
    37.37,
    100.39,
    59.85,
    42.75
   ]
  },
  {
   "id": "bow",
   "tex": "bow",
   "z": 13.8,
   "parent": "headMid",
   "grid": [
    3,
    3
   ],
   "box": [
    66.06,
    94.5,
    28.88,
    24.32
   ]
  },
  {
   "id": "bangs",
   "tex": "bangs",
   "z": 13,
   "parent": "bangsSway",
   "grid": [
    8,
    10
   ],
   "box": [
    80.69,
    51.75,
    112.29,
    99.75
   ]
  },
  {
   "id": "ahoge",
   "tex": "ahoge",
   "z": 14,
   "parent": "ahoge",
   "grid": [
    5,
    4
   ],
   "box": [
    87.15,
    20.4,
    53.2,
    36.29
   ]
  }
 ],
 "feat": {
  "eyes": {
   "eyeL": {
    "lash": [
     549,
     609,
     714,
     715
    ],
    "ball": [
     585,
     630,
     710,
     748
    ],
    "iris": [
     611,
     629,
     707,
     748
    ],
    "lidFit": [
     0.008654097031104648,
     -11.40448806820491,
     4388.756473993086
    ],
    "rimFit": [
     -0.011105816330789699,
     14.433190194160977,
     -3943.1944247092115
    ]
   },
   "eyeR": {
    "lash": [
     825,
     617,
     911,
     701
    ],
    "ball": [
     819,
     635,
     886,
     745
    ],
    "iris": [
     822,
     636,
     874,
     744
    ],
    "lidFit": [
     0.034502404875217586,
     -59.064235979945046,
     25913.794804961508
    ],
    "rimFit": [
     -0.053416795724098264,
     90.54594798983726,
     -37627.38070212919
    ]
   }
  },
  "sprites": {
   "neutral_mouth": [
    758,
    764,
    773,
    775
   ],
   "happy_eyeL": [
    554,
    651,
    699,
    756
   ],
   "happy_eyeR": [
    792,
    659,
    877,
    754
   ],
   "happy_mouth": [
    715,
    740,
    772,
    783
   ],
   "sleep_eyeL": [
    557,
    672,
    696,
    721
   ],
   "sleep_eyeR": [
    789,
    681,
    874,
    726
   ],
   "sleep_mouth": [
    739,
    758,
    763,
    772
   ],
   "drag_eyeL": [
    577,
    619,
    685,
    720
   ],
   "drag_eyeR": [
    795,
    631,
    875,
    727
   ],
   "drag_mouth": [
    709,
    745,
    766,
    764
   ],
   "love_eyeL": [
    539,
    607,
    706,
    776
   ],
   "love_eyeR": [
    799,
    608,
    888,
    768
   ],
   "love_mouth": [
    723,
    748,
    785,
    792
   ],
   "dizzy_eyeL": [
    568,
    607,
    701,
    733
   ],
   "dizzy_eyeR": [
    784,
    608,
    878,
    732
   ],
   "dizzy_mouth": [
    711,
    761,
    782,
    779
   ],
   "surprised_eyeL": [
    535,
    594,
    716,
    758
   ],
   "surprised_eyeR": [
    818,
    601,
    904,
    751
   ],
   "surprised_mouth": [
    751,
    747,
    791,
    795
   ]
  },
  "blush": [
   253,
   222,
   209
  ],
  "skin": [
   253,
   242,
   231
  ]
 },
 "schemes": [
  {
   "id": "deepseek",
   "brand": "DeepSeek",
   "label": "\u539f\u7248",
   "accent": "#4D6BFE",
   "ready": true
  },
  {
   "id": "harness",
   "brand": "DeepSeek Harness",
   "label": "\u7eaf\u9ed1",
   "accent": "#555555",
   "ready": true
  },
  {
   "id": "chatgpt",
   "brand": "ChatGPT",
   "label": "\u94f6\u767d",
   "accent": "#303030",
   "ready": true
  },
  {
   "id": "claude",
   "brand": "Claude",
   "label": "\u8d64\u9676",
   "accent": "#D97757",
   "ready": true
  },
  {
   "id": "gemini",
   "brand": "Gemini",
   "label": "\u56db\u8272",
   "accent": "#4285F4",
   "ready": true
  },
  {
   "id": "qwen",
   "brand": "\u5343\u95ee",
   "label": "\u7d2b",
   "accent": "#7F69F0",
   "ready": true
  },
  {
   "id": "kimi",
   "brand": "Kimi",
   "label": "\u9ed1\u84dd",
   "accent": "#007CFF",
   "ready": true
  },
  {
   "id": "minimax",
   "brand": "MiniMax",
   "label": "\u73ab\u7ea2\u6a59",
   "accent": "#D92D7A",
   "ready": true
  }
 ],
 "view": [
  -12,
  -8,
  268,
  272
 ]
}`;

    var MODEL = JSON.parse(MODEL_JSON);
    var UNITS = MODEL.units;
    var PIVOTS = MODEL.pivots;
    var VIEW = MODEL.view;
    var VX0 = VIEW[0];
    var VY0 = VIEW[1];
    var VIEW_W = VIEW[2] - VIEW[0]; // 280
    var VIEW_H = VIEW[3] - VIEW[1]; // 280
    var S = UNITS.S;
    var X0 = UNITS.X0;
    var FEET = UNITS.FEET;

    // master-pixel -> rig space (figure.js units)
    function U(x) { return 128 + (x - X0) * S; }
    function V(y) { return 256 - (FEET - y) * S; }
    // rig-space box -> CSS rect inside the 280x280 viewport
    function viewRect(box) {
      return { l: box[0] - VX0, t: box[1] - VY0, w: box[2], h: box[3] };
    }
    // master-pixel sprite rect [x0,y0,x1,y1] -> CSS rect
    function spriteRect(b) {
      return { l: U(b[0]) - VX0, t: V(b[1]) - VY0, w: (b[2] - b[0]) * S, h: (b[3] - b[1]) * S };
    }

    // Part -> rot pivot (figure.js deformers) + animation class + head group.
    var PART_ORIGIN = {
      hair_back: 'neck', hair_back_curl: 'neck', hair_front_left: 'neck', hair_front_right: 'neck',
      bangs: 'head', sidelocks: 'head',
      tail: 'tail', fin_near: 'finNear', fin_far: 'finFar', ahoge: 'ahoge',
      arm_near: 'armNear', arm_far: 'armFar', arm_far_end_front: 'armFar',
    };
    var PART_CLS = {
      hair_back: 'dsh-wp-p-hair', hair_back_curl: 'dsh-wp-p-hair',
      hair_front_left: 'dsh-wp-p-hair', hair_front_right: 'dsh-wp-p-hair',
      bangs: 'dsh-wp-p-bangs', sidelocks: 'dsh-wp-p-bangs',
      tail: 'dsh-wp-p-tail', fin_near: 'dsh-wp-p-fin-n', fin_far: 'dsh-wp-p-fin-f',
      ahoge: 'dsh-wp-p-ahoge',
      arm_near: 'dsh-wp-p-arm-n', arm_far: 'dsh-wp-p-arm-f', arm_far_end_front: 'dsh-wp-p-arm-f',
    };
    // Parts that ride the neck rotation (headBack/headMid/headFeat/headFront in figure.js).
    var HEAD_IDS = {
      face: true, eye_creases: true, brows: true, headdress: true, bow: true,
      bangs: true, sidelocks: true, hair_front_left: true, hair_front_right: true,
      hair_back: true, hair_back_curl: true, fin_near: true, fin_far: true, ahoge: true,
    };

    // Standing pose only: hide the sit-pose variants (skirt_sit replaces the
    // legs in the original rig's sit mode — rendering both mixes the poses).
    var HIDDEN_IDS = { skirt_sit: true, waist_bow_sit_front: true };
    // Outfit piece that takes the theme tint: the maid headdress ribbon only.
    // Every other part (blue hair, bow, skirt, waist bow) keeps its own colour.
    var TINT_IDS = { headdress: true };

    var PARTS = MODEL.parts.map(function (p) {
      if (HIDDEN_IDS[p.id]) return null;
      var pivot = PART_ORIGIN[p.id] ? PIVOTS[PART_ORIGIN[p.id]] : null;
      return {
        id: p.id,
        tex: p.tex,
        rect: viewRect(p.box),
        zi: Math.round(p.z * 10),
        head: !!HEAD_IDS[p.id],
        cls: PART_CLS[p.id] || '',
        tint: !!TINT_IDS[p.id],
        origin: pivot ? { ox: pivot[0] - p.box[0], oy: pivot[1] - p.box[1] } : null,
      };
    }).filter(function (x) { return x !== null; });
    // figure.js redraws the brows over the fringe, faint (z 13.2, alpha .4).
    var browsPart = MODEL.parts.filter(function (p) { return p.id === 'brows'; })[0];
    PARTS.push({
      id: 'brows_through',
      tex: 'brows',
      rect: viewRect(browsPart.box),
      zi: 132,
      head: true,
      cls: '',
      origin: null,
      alpha: 0.4,
    });

    var SPRITES = {};
    Object.keys(MODEL.feat.sprites).forEach(function (name) {
      SPRITES[name] = spriteRect(MODEL.feat.sprites[name]);
    });

    // Neutral open eyes: bbox of lash/ball/iris; children offset inside it.
    var EYE_STACKS = {};
    ['eyeL', 'eyeR'].forEach(function (k) {
      var e = MODEL.feat.eyes[k];
      var layers = [['lash', e.lash], ['ball', e.ball], ['iris', e.iris]];
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      layers.forEach(function (L) {
        var b = L[1];
        minX = Math.min(minX, b[0]);
        minY = Math.min(minY, b[1]);
        maxX = Math.max(maxX, b[2]);
        maxY = Math.max(maxY, b[3]);
      });
      var rect = spriteRect([minX, minY, maxX, maxY]);
      var children = layers.map(function (L) {
        var r = spriteRect(L[1]);
        return { name: k + '_' + L[0], l: r.l - rect.l, t: r.t - rect.t, w: r.w, h: r.h };
      });
      EYE_STACKS[k] = { rect: rect, children: children };
    });

    // Blush cheeks: centers + radii from figure.js paintBlush (master pixels).
    var CHEEKS = [[618, 770, 40, 20], [852, 762, 22, 15]];
    var BLUSH = CHEEKS.map(function (c) {
      var cx = U(c[0]) - VX0;
      var cy = V(c[1]) - VY0;
      var w = c[2] * 2 * S;
      var h = c[3] * 2 * S;
      return { l: cx - w / 2, t: cy - h / 2, w: w, h: h };
    });

    // Expression state machine: mood -> eyes + mouth (+blush).
    //  neutral    open eyes (lash/ball/iris stack) + neutral_mouth
    //  busy       open eyes + small determined smile (run face ≈ happy_mouth*0.72)
    //  sleep      closed eyes + sleep_mouth
    //  surprised  wide eyes + open mouth + blush
    var FACES = {
      neutral: { eyes: 'stack', mouth: 'neutral_mouth' },
      busy: { eyes: 'stack', mouth: 'happy_mouth', mouthScale: 0.72 },
      sleep: { eyes: 'sleep', mouth: 'sleep_mouth' },
      surprised: { eyes: 'surprised', mouth: 'surprised_mouth', blush: true },
    };

    // Display scale: 280 rig units -> 182 CSS px.
    var FIG_SCALE = 0.65;
    var FIG_W = Math.round(VIEW_W * FIG_SCALE);
    var FIG_H = Math.round(VIEW_H * FIG_SCALE);
    var REST_SCALE = 64 / VIEW_W;

    // ── Styles (injected once) ──────────────────────────────────────────────
    var CSS = [
      '.dsh-wp-root{position:fixed;z-index:6000;right:22px;bottom:140px;user-select:none;-webkit-user-select:none;',
      'cursor:grab;touch-action:none;pointer-events:auto;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}',
      '.dsh-wp-root:active{cursor:grabbing;}',
      '.dsh-wp-root.dsh-wp-rest{cursor:pointer;}',
      '.dsh-wp-figwrap{position:relative;}',
      '.dsh-wp-figwrap.dsh-wp-squish{animation:dsh-wp-squish .35s ease;transform-origin:50% 100%;}',
      '.dsh-wp-glow{position:absolute;left:-12%;right:-12%;top:-10%;bottom:-4%;border-radius:50%;',
      'background:radial-gradient(ellipse at 50% 42%, var(--wp-glow) 0%, rgba(0,0,0,0) 68%);',
      'filter:blur(8px);opacity:.55;pointer-events:none;transition:background 1.6s ease;}',
      '.dsh-wp-body{position:relative;animation:dsh-wp-bob 3.2s ease-in-out infinite;}',
      '.dsh-wp-breathe{position:absolute;left:0;top:0;right:0;bottom:0;',
      'animation:dsh-wp-breathe 2.4s ease-in-out infinite;}',
      '.dsh-wp-part{position:absolute;display:block;pointer-events:none;user-select:none;-webkit-user-drag:none;',
      'transition:filter 1.6s ease;}',
      '.dsh-wp-head{position:absolute;left:0;top:0;right:0;bottom:0;',
      'transform-origin:var(--wp-head-ox) var(--wp-head-oy);',
      'animation:dsh-wp-head-tilt 7s ease-in-out infinite;transition:transform .8s ease;}',
      '.dsh-wp-p-hair{animation:dsh-wp-hair 4.2s ease-in-out infinite;will-change:transform;}',
      '.dsh-wp-p-bangs{animation:dsh-wp-bangs 3.3s ease-in-out infinite;}',
      '.dsh-wp-p-tail{animation:dsh-wp-tail 4.8s ease-in-out infinite;transition:transform .6s ease;}',
      '.dsh-wp-p-fin-n{animation:dsh-wp-fin-n 4.5s ease-in-out infinite;transition:transform .6s ease;}',
      '.dsh-wp-p-fin-f{animation:dsh-wp-fin-f 4.5s ease-in-out infinite;transition:transform .6s ease;}',
      '.dsh-wp-p-ahoge{animation:dsh-wp-ahoge 3s ease-in-out infinite;}',
      '.dsh-wp-p-arm-n{transition:transform .35s ease;}',
      '.dsh-wp-p-arm-f{transition:transform .35s ease;}',
      '.dsh-wp-feat{position:absolute;pointer-events:none;user-select:none;-webkit-user-drag:none;',
      'animation:dsh-wp-feat-in .25s ease;}',
      '.dsh-wp-eye{position:absolute;transform-origin:50% 100%;}',
      '.dsh-wp-root.dsh-wp-blink .dsh-wp-eye{animation:dsh-wp-blink .18s ease;}',
      '.dsh-wp-blush{position:absolute;border-radius:50%;pointer-events:none;animation:dsh-wp-feat-in .3s ease;}',
      // busy (running): fast wag + swim + arm swing
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-body{animation:dsh-wp-swim .85s ease-in-out infinite;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-hair{animation-duration:1.35s;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-bangs{animation-duration:1.05s;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-tail{animation-duration:1.2s;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-fin-n{animation-duration:1.1s;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-fin-f{animation-duration:1.1s;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-ahoge{animation-duration:.9s;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-arm-n{animation:dsh-wp-arm-sw-n .77s ease-in-out infinite;}',
      '.dsh-wp-root.dsh-wp-busy .dsh-wp-p-arm-f{animation:dsh-wp-arm-sw-f .77s ease-in-out infinite;}',
      // sleep (rest): slow breath, drooped tail/fins, tilted head
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-body{animation:none;}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-breathe{animation-duration:3.7s;}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-p-hair{animation-duration:6s;}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-p-bangs{animation-duration:5s;}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-p-tail{animation:none;transform:rotate(-12deg);}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-p-fin-n{animation:none;transform:rotate(-14deg);}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-p-fin-f{animation:none;transform:rotate(10deg);}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-p-ahoge{animation:none;transform:rotate(11deg);}',
      '.dsh-wp-root.dsh-wp-sleep .dsh-wp-head{animation:none;transform:rotate(6deg);}',
      // badge (phase chip)
      '.dsh-wp-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);white-space:nowrap;',
      'padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.02em;',
      'color:var(--wp-accent);background:rgba(16,20,30,.92);border:1px solid var(--wp-accent);',
      'box-shadow:0 4px 14px var(--wp-glow);pointer-events:none;',
      'transition:color .8s ease,border-color .8s ease,box-shadow .8s ease;}',
      '.dsh-wp-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;',
      'background:#43d17c;animation:dsh-wp-pulse 1.6s ease-in-out infinite;vertical-align:1px;}',
      // persistent countdown pill
      '.dsh-wp-cd{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);',
      'display:flex;align-items:center;gap:8px;padding:5px 12px 5px 7px;border-radius:999px;',
      'background:rgba(16,20,30,.92);border:1px solid var(--wp-accent);box-shadow:0 6px 18px var(--wp-glow);',
      'white-space:nowrap;pointer-events:none;transition:border-color .8s ease,box-shadow .8s ease;}',
      '.dsh-wp-cd-ring{width:26px;height:26px;flex:0 0 auto;display:block;}',
      '.dsh-wp-cd-track{stroke:rgba(255,255,255,.15);}',
      '.dsh-wp-cd-bar{transition:stroke-dashoffset .9s linear,stroke .8s ease;}',
      '.dsh-wp-cd-ico{font-size:13px;line-height:1;}',
      '.dsh-wp-cd-text{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;',
      'color:var(--wp-accent);transition:color .8s ease;}',
      '.dsh-wp-cd.dsh-wp-cd-urgent .dsh-wp-cd-text{color:var(--wp-accent-strong);',
      'animation:dsh-wp-cd-pulse 1s ease-in-out infinite;}',
      '.dsh-wp-cd.dsh-wp-cd-indet .dsh-wp-cd-bar{animation:dsh-wp-cd-spin 1.6s linear infinite;}',
      '.dsh-wp-cd.dsh-wp-cd-flash .dsh-wp-cd-text{color:#fff;}',
      // toast / hearts / bubble (ported from the single-image edition)
      '.dsh-wp-toast{position:absolute;left:50%;bottom:112%;transform:translateX(-50%);white-space:nowrap;',
      'padding:6px 12px;border-radius:10px;font-size:12px;font-weight:600;color:#fff;',
      'background:rgba(16,20,30,.94);border:1px solid var(--wp-accent);box-shadow:0 8px 22px var(--wp-glow);',
      'animation:dsh-wp-toast-in .35s ease;pointer-events:none;}',
      '.dsh-wp-heart{position:absolute;bottom:70%;font-size:15px;color:var(--wp-accent);',
      'pointer-events:none;animation:dsh-wp-heart-up 1.15s ease-out forwards;}',
      '.dsh-wp-bubble{position:absolute;bottom:calc(100% + 14px);right:-46px;width:252px;',
      'padding:12px 14px;border-radius:14px;background:rgba(16,20,30,.95);color:#e8ecf4;',
      'border:1px solid var(--wp-accent);box-shadow:0 16px 40px var(--wp-glow),0 4px 12px rgba(0,0,0,.35);',
      'font-size:12px;line-height:1.55;animation:dsh-wp-toast-in .25s ease;cursor:auto;',
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
      'transition:border-color .8s ease,box-shadow .8s ease;}',
      '.dsh-wp-bubble-title{display:flex;align-items:center;justify-content:space-between;',
      'font-weight:700;font-size:13px;color:var(--wp-accent);margin-bottom:6px;transition:color .8s ease;}',
      '.dsh-wp-bubble-close{border:none;background:transparent;color:#9aa4b8;font-size:14px;',
      'cursor:pointer;padding:0 2px;line-height:1;}',
      '.dsh-wp-bubble-close:hover{color:#fff;}',
      '.dsh-wp-row{display:flex;justify-content:space-between;gap:10px;padding:2px 0;}',
      '.dsh-wp-row .k{color:#9aa4b8;}',
      '.dsh-wp-row .v{font-variant-numeric:tabular-nums;color:#f2f5fa;text-align:right;}',
      '.dsh-wp-price-grid{margin:6px 0 4px;border-top:1px dashed rgba(255,255,255,.14);padding-top:6px;}',
      '.dsh-wp-count{color:var(--wp-accent);font-weight:700;}',
      '.dsh-wp-foot{color:#6b7488;font-size:10px;margin-top:6px;}',
      // fallback single-image (whale-pet/image)
      '.dsh-wp-img{display:block;width:100%;height:auto;border-radius:26px;',
      'box-shadow:0 14px 34px var(--wp-glow),0 3px 10px rgba(0,0,0,.18);',
      'transition:box-shadow 1.6s ease;',
      '-webkit-mask-image:radial-gradient(130% 125% at 50% 42%,#000 52%,rgba(0,0,0,.55) 74%,transparent 86%);',
      'mask-image:radial-gradient(130% 125% at 50% 42%,#000 52%,rgba(0,0,0,.55) 74%,transparent 86%);',
      'pointer-events:none;}',
      // rest (collapsed sleeping whale bubble)
      '.dsh-wp-rest{position:relative;width:64px;height:64px;border-radius:50%;',
      'background:rgba(16,20,30,.92);border:1px solid var(--wp-accent);',
      'box-shadow:0 10px 26px var(--wp-glow);overflow:hidden;',
      'animation:dsh-wp-bob 3.2s ease-in-out infinite;',
      'transition:border-color .8s ease,box-shadow .8s ease;}',
      '.dsh-wp-rest-fig{position:absolute;pointer-events:none;}',
      '.dsh-wp-rest-z{position:absolute;top:-10px;right:-2px;font-size:12px;pointer-events:none;',
      'animation:dsh-wp-z 2.6s ease-in-out infinite;}',
      // keyframes
      '@keyframes dsh-wp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}',
      '@keyframes dsh-wp-swim{0%,100%{transform:translateY(0) rotate(-2.4deg)}',
      '50%{transform:translateY(-11px) rotate(2.4deg)}}',
      '@keyframes dsh-wp-breathe{0%,100%{transform:scale(0.994,1.012)}50%{transform:scale(1.006,0.988)}}',
      '@keyframes dsh-wp-hair{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}',
      '@keyframes dsh-wp-bangs{0%,100%{transform:rotate(-1.1deg)}50%{transform:rotate(1.1deg)}}',
      '@keyframes dsh-wp-tail{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(7deg)}}',
      '@keyframes dsh-wp-fin-n{0%,100%{transform:rotate(-4.5deg)}50%{transform:rotate(3.5deg)}}',
      '@keyframes dsh-wp-fin-f{0%,100%{transform:rotate(3.5deg)}50%{transform:rotate(-4.5deg)}}',
      '@keyframes dsh-wp-ahoge{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}',
      '@keyframes dsh-wp-head-tilt{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}',
      '@keyframes dsh-wp-arm-sw-n{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(10deg)}}',
      '@keyframes dsh-wp-arm-sw-f{0%,100%{transform:rotate(9deg)}50%{transform:rotate(-12deg)}}',
      '@keyframes dsh-wp-blink{0%{transform:scaleY(1)}40%{transform:scaleY(.08)}100%{transform:scaleY(1)}}',
      '@keyframes dsh-wp-squish{0%{transform:scale(1,1)}40%{transform:scale(1.07,.9)}100%{transform:scale(1,1)}}',
      '@keyframes dsh-wp-feat-in{from{opacity:0}to{opacity:1}}',
      '@keyframes dsh-wp-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '@keyframes dsh-wp-toast-in{from{opacity:0;transform:translate(-50%,6px)}',
      'to{opacity:1;transform:translate(-50%,0)}}',
      '@keyframes dsh-wp-heart-up{0%{opacity:0;transform:translateY(0) scale(.6)}',
      '15%{opacity:1}100%{opacity:0;transform:translateY(-52px) scale(1.25)}}',
      '@keyframes dsh-wp-z{0%{opacity:0;transform:translateY(4px) scale(.8)}',
      '35%{opacity:.9}100%{opacity:0;transform:translateY(-12px) scale(1.1)}}',
      '@keyframes dsh-wp-cd-pulse{0%,100%{opacity:1}50%{opacity:.5}}',
      '@keyframes dsh-wp-cd-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    ].join('');

    function ensureStyles() {
      if (!document.getElementById(STYLE_ID)) {
        var el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = CSS;
        document.head.appendChild(el);
      }
      // Deterministic theme tint: an sRGB luminance→colour matrix. CSS
      // hue-rotate skews saturated hues (gold instead of red), so the red
      // headdress tint uses an explicit SVG filter instead.
      if (!document.getElementById('dsh-wp-tint-svg')) {
        var holder = document.createElement('div');
        holder.id = 'dsh-wp-tint-svg';
        holder.setAttribute('aria-hidden', 'true');
        holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
        holder.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">' +
          '<defs><filter id="dsh-wp-tint-red" color-interpolation-filters="sRGB">' +
          // R = luminance (boosted, saturating at white), G = B = 0 → pure
          // shaded red: the white ribbon turns #ff0000, its grey shading
          // stays visible as darker red.
          '<feColorMatrix type="matrix" values="' +
          '0.5 0.5 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' +
          '"/></filter></defs></svg>';
        document.head.appendChild(holder);
      }
    }

    // ── Formatting helpers ──────────────────────────────────────────────────
    function clamp01(x) {
      return x < 0 ? 0 : x > 1 ? 1 : x;
    }

    // Countdown pill: 1h 23m / 45m 02s / 12s
    function fmtCD(ms) {
      var s = Math.max(0, Math.floor(ms / 1000));
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var ss = s % 60;
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm ' + (ss < 10 ? '0' : '') + ss + 's';
      return s + 's';
    }

    // Bubble row: 1 小时 23 分 / 45 秒
    function fmtRemaining(ms) {
      if (!isFinite(ms)) return '';
      if (ms <= 0) return '马上切换';
      var s = Math.floor(ms / 1000);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      if (h > 0) return h + ' 小时 ' + m + ' 分';
      if (m > 0) return m + ' 分 ' + (s % 60) + ' 秒';
      return s + ' 秒';
    }

    // ── Host state polling ─────────────────────────────────────────────────
    function usePetState() {
      var [data, setData] = React.useState(null);
      var [offline, setOffline] = React.useState(false);
      React.useEffect(function () {
        var stopped = false;
        var timer = null;
        var pollMs = 5000;
        function tick() {
          fetch(STATE_URL, { cache: 'no-store' })
            .then(function (r) {
              if (!r.ok) throw new Error('http ' + r.status);
              return r.json();
            })
            .then(function (json) {
              if (stopped) return;
              if (json && json.ok) {
                setOffline(false);
                setData(Object.assign({}, json, { _fetchedAt: Date.now() }));
                if (typeof json.pollMs === 'number' && json.pollMs >= 1000) pollMs = json.pollMs;
              }
            })
            .catch(function () {
              if (!stopped) setOffline(true);
            })
            .finally(function () {
              if (!stopped) timer = setTimeout(tick, pollMs);
            });
        }
        tick();
        return function () {
          stopped = true;
          clearTimeout(timer);
        };
      }, []);
      return [data, offline];
    }

    // ── Layered figure ─────────────────────────────────────────────────────
    function Figure(props) {
      var scale = props.scale;
      var failed = React.useRef(0);

      function onPartError(e) {
        e.currentTarget.style.display = 'none';
        failed.current += 1;
        if (failed.current >= PARTS.length && props.onAllFailed) props.onAllFailed();
      }
      function onFeatError(e) {
        e.currentTarget.style.display = 'none';
      }

      function partEl(p) {
        var r = p.rect;
        var style = {
          left: (r.l * scale) + 'px',
          top: (r.t * scale) + 'px',
          width: (r.w * scale) + 'px',
          height: (r.h * scale) + 'px',
          zIndex: p.zi,
          transformOrigin: p.origin
            ? ((p.origin.ox * scale) + 'px ' + (p.origin.oy * scale) + 'px')
            : '50% 50%',
        };
        if (p.alpha != null) style.opacity = p.alpha;
        // Theme tint applies only to the white maid pieces (headdress, skirt,
        // waist bow) — the blue hair/outfit colours stay untouched.
        if (p.tint && props.tint && props.tint !== 'none') style.filter = props.tint;
        return React.createElement('img', {
          key: p.id,
          className: 'dsh-wp-part' + (p.cls ? ' ' + p.cls : ''),
          src: ASSET_BASE + 'tex/' + p.tex + '.png',
          alt: '',
          draggable: false,
          style: style,
          onError: onPartError,
        });
      }

      function featEl(name, key, extraStyle) {
        var r = SPRITES[name];
        if (!r) return null;
        var style = {
          left: (r.l * scale) + 'px',
          top: (r.t * scale) + 'px',
          width: (r.w * scale) + 'px',
          height: (r.h * scale) + 'px',
          zIndex: 90,
        };
        if (extraStyle) Object.assign(style, extraStyle);
        return React.createElement('img', {
          key: key,
          className: 'dsh-wp-feat',
          src: ASSET_BASE + 'feat/' + name + '.png',
          alt: '',
          draggable: false,
          style: style,
          onError: onFeatError,
        });
      }

      function eyeStack(k) {
        var st = EYE_STACKS[k];
        var kids = st.children.map(function (c) {
          return React.createElement('img', {
            key: c.name,
            className: 'dsh-wp-feat',
            src: ASSET_BASE + 'feat/' + c.name + '.png',
            alt: '',
            draggable: false,
            style: {
              left: (c.l * scale) + 'px',
              top: (c.t * scale) + 'px',
              width: (c.w * scale) + 'px',
              height: (c.h * scale) + 'px',
            },
            onError: onFeatError,
          });
        });
        return React.createElement('div', {
          key: k,
          className: 'dsh-wp-eye',
          style: {
            left: (st.rect.l * scale) + 'px',
            top: (st.rect.t * scale) + 'px',
            width: (st.rect.w * scale) + 'px',
            height: (st.rect.h * scale) + 'px',
            zIndex: 90,
          },
        }, kids);
      }

      var mood = props.mood || 'neutral';
      var face = FACES[mood] || FACES.neutral;
      var expr = [];
      if (face.eyes === 'stack') {
        expr.push(eyeStack('eyeL'));
        expr.push(eyeStack('eyeR'));
      } else {
        expr.push(featEl(face.eyes + '_eyeL', 'eyeL'));
        expr.push(featEl(face.eyes + '_eyeR', 'eyeR'));
      }
      expr.push(featEl(face.mouth, 'mouth', face.mouthScale ? { transform: 'scale(' + face.mouthScale + ')' } : null));
      if (face.blush) {
        BLUSH.forEach(function (b, i) {
          expr.push(React.createElement('div', {
            key: 'blush' + i,
            className: 'dsh-wp-blush',
            style: {
              left: (b.l * scale) + 'px',
              top: (b.t * scale) + 'px',
              width: (b.w * scale) + 'px',
              height: (b.h * scale) + 'px',
              zIndex: 91,
              background: 'radial-gradient(ellipse at center, rgba(255,120,140,.45), rgba(255,120,140,0) 72%)',
            },
          }));
        });
      }

      var bodyEls = [];
      var headEls = [];
      PARTS.forEach(function (p) {
        (p.head ? headEls : bodyEls).push(partEl(p));
      });
      headEls = headEls.concat(expr);

      var w = Math.round(VIEW_W * scale);
      var h = Math.round(VIEW_H * scale);

      return React.createElement(
        'div',
        { className: 'dsh-wp-body', style: { width: w + 'px', height: h + 'px' } },
        React.createElement(
          'div',
          { className: 'dsh-wp-breathe', style: { left: 0, top: 0, right: 0, bottom: 0 } },
          bodyEls,
          React.createElement(
            'div',
            {
              className: 'dsh-wp-head',
              style: {
                '--wp-head-ox': ((PIVOTS.neck[0] - VX0) * scale) + 'px',
                '--wp-head-oy': ((PIVOTS.neck[1] - VY0) * scale) + 'px',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              },
            },
            headEls
          )
        )
      );
    }

    // ── Persistent countdown pill (ring + text, 1s local refresh) ──────────
    function Countdown(props) {
      var data = props.data;
      var theme = props.theme;
      var offline = props.offline;
      var flash = props.flash;
      var spanRef = React.useRef({});
      var [, tick] = React.useReducer(function (x) { return x + 1; }, 0);
      React.useEffect(function () {
        var id = setInterval(function () { tick(); }, 1000);
        return function () { clearInterval(id); };
      }, []);

      var now = Date.now();
      var rem = null;
      var prog = null;
      if (data) {
        var fetchedAt = typeof data._fetchedAt === 'number' ? data._fetchedAt : now;
        if (typeof data.remainingMs === 'number') {
          rem = Math.max(0, data.remainingMs - (now - fetchedAt));
        } else if (data.next && typeof data.next.atMs === 'number') {
          rem = Math.max(0, data.next.atMs - now);
        }
        if (data.window && typeof data.window.startMs === 'number' && typeof data.window.endMs === 'number') {
          var s0 = data.window.startMs;
          var s1 = data.window.endMs;
          if (s1 > s0) {
            spanRef.current[data.phase] = s1 - s0;
            if (now >= s0 && now <= s1) prog = clamp01((now - s0) / (s1 - s0));
          }
        }
        // Degraded mode: no window -> progress from remaining vs. last-known span.
        if (prog == null && rem != null && spanRef.current[data.phase]) {
          prog = clamp01(1 - rem / spanRef.current[data.phase]);
        }
      }

      var indet = prog == null;
      var ringC = 2 * Math.PI * 15.5;
      var urgent = rem != null && rem <= 60000 && !flash && !offline;

      var text;
      if (flash) text = '已切换';
      else if (offline) text = '🔌 Host 失联';
      else if (!data) text = '连接中…';
      else if (rem == null) text = theme.icon + ' ' + theme.label;
      else text = '距' + (data.next && data.next.label ? data.next.label : theme.nextLabel) + ' ' + fmtCD(rem);

      var cls = 'dsh-wp-cd';
      if (indet) cls += ' dsh-wp-cd-indet';
      if (urgent) cls += ' dsh-wp-cd-urgent';
      if (flash) cls += ' dsh-wp-cd-flash';

      return React.createElement(
        'div',
        { className: cls },
        React.createElement(
          'svg',
          { className: 'dsh-wp-cd-ring', viewBox: '0 0 36 36' },
          React.createElement('circle', {
            className: 'dsh-wp-cd-track',
            cx: 18,
            cy: 18,
            r: 15.5,
            fill: 'none',
            strokeWidth: 3.2,
          }),
          React.createElement('circle', {
            className: 'dsh-wp-cd-bar',
            cx: 18,
            cy: 18,
            r: 15.5,
            fill: 'none',
            strokeWidth: 3.2,
            strokeLinecap: 'round',
            stroke: theme.accent,
            strokeDasharray: indet ? '26 70' : String(ringC),
            strokeDashoffset: indet ? 0 : ringC * (1 - prog),
            style: { transformOrigin: '18px 18px' },
          })
        ),
        React.createElement('span', { className: 'dsh-wp-cd-ico' }, theme.icon),
        React.createElement('span', { className: 'dsh-wp-cd-text' }, text)
      );
    }

    // ── Info bubble ─────────────────────────────────────────────────────────
    function Bubble(props) {
      var data = props.data;
      var theme = props.theme;
      var offline = props.offline;
      var phase = data && data.phase;
      var pricing = data && data.pricing;
      var price = pricing ? (phase === 'peak' ? pricing.peak : pricing.offpeak) : null;
      var next = data && data.next;
      var remainingMs = next ? next.atMs - Date.now() : NaN;
      var [, tick] = React.useReducer(function (x) { return x + 1; }, 0);
      React.useEffect(function () {
        if (!next) return undefined;
        var id = setInterval(function () { tick(); }, 1000);
        return function () { clearInterval(id); };
      }, [next && next.atMs]);

      var rows = [
        { k: '模型', v: data && data.model && data.model.label ? data.model.label : '—' },
        { k: '时段', v: theme.icon + ' ' + theme.label },
        { k: '状态', v: data && data.running ? '🔧 工作中' : '😴 待命中' },
      ];
      if (price) {
        rows.push({ k: '输入 · 缓存未命中', v: price.inputMiss.toFixed(price.inputMiss >= 1 ? 1 : 2) + ' 元/M' });
        rows.push({ k: '输入 · 缓存命中', v: price.inputHit.toFixed(2) + ' 元/M' });
        rows.push({ k: '输出', v: price.output.toFixed(1) + ' 元/M' });
      }
      if (next) {
        rows.push({ k: '距' + (next.label || '切换'), v: fmtRemaining(remainingMs), count: true });
      }
      var foot = (data && data.source ? '来源 ' + data.source + ' · ' : '') + '单击拖动 · 双击收拢';

      return React.createElement(
        'div',
        { className: 'dsh-wp-bubble', onPointerDown: function (e) { e.stopPropagation(); } },
        React.createElement(
          'div',
          { className: 'dsh-wp-bubble-title' },
          React.createElement('span', null, '🐳 鲸鱼娘'),
          React.createElement('button', {
            className: 'dsh-wp-bubble-close',
            onClick: function (e) { e.stopPropagation(); props.onClose(); },
            title: '关闭',
          }, '✕')
        ),
        offline
          ? React.createElement('div', { className: 'dsh-wp-row' }, React.createElement('span', { className: 'k' }, '与 Host 失联，稍后重试…'))
          : null,
        rows.map(function (row, i) {
          return React.createElement(
            'div',
            { key: i, className: 'dsh-wp-row' + (row.count ? ' dsh-wp-count' : '') },
            React.createElement('span', { className: 'k' }, row.k),
            React.createElement('span', { className: 'v' }, row.v)
          );
        }),
        React.createElement('div', { className: 'dsh-wp-foot' }, foot)
      );
    }

    // ── Pet root component ──────────────────────────────────────────────────
    function WhalePet() {
      var [data, offline] = usePetState();
      var theme = themeOf(data && data.phase);

      var rootRef = React.useRef(null);
      var [pos, setPos] = React.useState(function () {
        try {
          var saved = localStorage.getItem(POS_KEY);
          if (saved) {
            var p = JSON.parse(saved);
            if (typeof p.x === 'number' && typeof p.y === 'number') {
              // Clamp a saved position to the current viewport (window resizes
              // and monitor changes must not leave the pet off-screen).
              var vw = window.innerWidth;
              var vh = window.innerHeight;
              var cx = Math.max(0, Math.min(p.x, vw - 200));
              var cy = Math.max(0, Math.min(p.y, vh - 250));
              return { x: cx, y: cy };
            }
          }
        } catch (e) { /* ignore */ }
        return null;
      });
      var latestPos = React.useRef(pos);
      var dragRef = React.useRef(null);
      var suppressClick = React.useRef(false);
      var clickTimer = React.useRef(null);
      var [bubble, setBubble] = React.useState(false);
      var [rest, setRest] = React.useState(false);
      var [blink, setBlink] = React.useState(false);
      var [surprise, setSurprise] = React.useState(false);
      var [toast, setToast] = React.useState(null);
      var [hearts, setHearts] = React.useState([]);
      var [fallback, setFallback] = React.useState(false);
      var [flash, setFlash] = React.useState(false);
      var prevPhase = React.useRef(null);
      var heartSeq = React.useRef(0);

      // Phase change → surprise face + 「换装完成」toast + hearts + 已切换 flash.
      React.useEffect(function () {
        if (!data) return undefined;
        if (prevPhase.current !== null && prevPhase.current !== data.phase) {
          var t = themeOf(data.phase);
          setSurprise(true);
          setToast(t.icon + ' ' + t.label + ' · 换装完成');
          setFlash(true);
          var spawn = [];
          for (var i = 0; i < 5; i++) {
            spawn.push({ id: ++heartSeq.current, left: 12 + Math.random() * 76, delay: i * 130 });
          }
          setHearts(spawn);
          spawn.forEach(function (h) {
            setTimeout(function () {
              setHearts(function (list) { return list.filter(function (x) { return x.id !== h.id; }); });
            }, 1400 + h.delay);
          });
          var t1 = setTimeout(function () { setSurprise(false); }, 1800);
          var t2 = setTimeout(function () { setToast(null); }, 3600);
          var t3 = setTimeout(function () { setFlash(false); }, 3200);
          return function () {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
          };
        }
        prevPhase.current = data.phase;
        return undefined;
      }, [data]);

      // Blink (scaleY squash of the eye stack), skipped while resting.
      React.useEffect(function () {
        if (rest) return undefined;
        var timer = null;
        function loop() {
          timer = setTimeout(function () {
            setBlink(true);
            setTimeout(function () { setBlink(false); }, 170);
            loop();
          }, 3200 + Math.random() * 2800);
        }
        loop();
        return function () { clearTimeout(timer); };
      }, [rest]);

      // ── Drag (pointer capture, viewport clamp, localStorage) ─────────────
      function onPointerDown(e) {
        if (e.button !== 0 || rest) return;
        var el = rootRef.current;
        var rect = el.getBoundingClientRect();
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origLeft: rect.left,
          origTop: rect.top,
          sizeW: rect.width,
          sizeH: rect.height,
          moved: false,
        };
        if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
      }
      function onPointerMove(e) {
        var d = dragRef.current;
        if (!d) return;
        var dx = e.clientX - d.startX;
        var dy = e.clientY - d.startY;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        if (!d.moved) return;
        var x = Math.max(0, Math.min(window.innerWidth - d.sizeW, d.origLeft + dx));
        var y = Math.max(0, Math.min(window.innerHeight - d.sizeH, d.origTop + dy));
        var next = { x: x, y: y };
        latestPos.current = next;
        setPos(next);
      }
      function onPointerUp() {
        var d = dragRef.current;
        dragRef.current = null;
        if (!d) return;
        if (d.moved) {
          suppressClick.current = true;
          try { localStorage.setItem(POS_KEY, JSON.stringify(latestPos.current)); } catch (err) { /* ignore */ }
        }
      }

      function onClick() {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (rest) {
          setRest(false);
          return;
        }
        clearTimeout(clickTimer.current);
        clickTimer.current = setTimeout(function () { setBubble(true); }, 260);
      }
      function onDoubleClick() {
        clearTimeout(clickTimer.current);
        suppressClick.current = true;
        setRest(function (v) { return !v; });
        setBubble(false);
      }

      var mood = rest ? 'sleep' : surprise ? 'surprised' : data && data.running ? 'busy' : 'neutral';
      var busy = !rest && !!data && !!data.running;

      var vars = {
        '--wp-accent': theme.accent,
        '--wp-accent-strong': theme.accentStrong,
        '--wp-glow': theme.glow,
      };
      var posStyle = pos ? { left: pos.x + 'px', top: pos.y + 'px', right: 'auto', bottom: 'auto' } : null;
      var rootStyle = Object.assign({}, vars, posStyle);
      var rootCls = 'dsh-wp-root' +
        (busy ? ' dsh-wp-busy' : '') +
        (blink && !rest ? ' dsh-wp-blink' : '') +
        (rest ? ' dsh-wp-rest dsh-wp-sleep' : '');

      var figStyle = { width: FIG_W + 'px', height: FIG_H + 'px' };
      var countdown = React.createElement(Countdown, {
        key: 'cd',
        data: data,
        theme: theme,
        offline: offline,
        flash: flash,
      });

      var kids = [];
      if (rest) {
        kids.push(
          React.createElement('div', { key: 'rest', className: 'dsh-wp-rest' },
            React.createElement('div', {
              className: 'dsh-wp-rest-fig',
              style: {
                left: Math.round(32 - 128 * REST_SCALE) + 'px',
                top: Math.round(32 - 150 * REST_SCALE) + 'px',
                width: FIG_W + 'px',
                height: FIG_H + 'px',
              },
            }, React.createElement(Figure, { scale: REST_SCALE, mood: 'sleep', tint: theme.filter })),
            React.createElement('span', { className: 'dsh-wp-rest-z' }, '💤')
          )
        );
        kids.push(countdown);
      } else {
        var fig = fallback
          ? React.createElement('img', {
              key: 'fig',
              className: 'dsh-wp-img',
              src: FALLBACK_IMG,
              alt: '女仆装鲸鱼娘',
              draggable: false,
              onError: function (e) { e.currentTarget.style.display = 'none'; },
            })
          : React.createElement(Figure, {
              key: 'fig',
              scale: FIG_SCALE,
              mood: mood,
              tint: theme.filter,
              onAllFailed: function () { setFallback(true); },
            });

        kids.push(
          React.createElement('div', {
            key: 'wrap',
            className: 'dsh-wp-figwrap' + (surprise ? ' dsh-wp-squish' : ''),
            style: figStyle,
          },
            React.createElement('div', { className: 'dsh-wp-glow' }),
            fig,
            React.createElement('div', { className: 'dsh-wp-badge' },
              React.createElement('span', { className: 'dsh-wp-dot' }),
              (offline ? '🔌 ' : '') + theme.icon + ' ' + theme.label
            )
          )
        );
        kids.push(countdown);
      }
      if (toast) {
        kids.push(React.createElement('div', { key: 'toast', className: 'dsh-wp-toast' }, toast));
      }
      hearts.forEach(function (h) {
        kids.push(React.createElement('span', {
          key: 'h' + h.id,
          className: 'dsh-wp-heart',
          style: { left: h.left + '%', animationDelay: h.delay + 'ms' },
        }, '♥'));
      });
      if (bubble && !rest) {
        kids.push(React.createElement(Bubble, {
          key: 'bubble',
          data: data,
          theme: theme,
          offline: offline,
          onClose: function () { setBubble(false); },
        }));
      }

      return React.createElement(
        'div',
        {
          ref: rootRef,
          className: rootCls,
          style: rootStyle,
          title: 'DeepSeek 鲸鱼娘桌宠 · ' + theme.label + ' · 拖动移动，双击收拢',
          onPointerDown: onPointerDown,
          onPointerMove: onPointerMove,
          onPointerUp: onPointerUp,
          onPointerCancel: onPointerUp,
          onClick: onClick,
          onDoubleClick: onDoubleClick,
        },
        kids
      );
    }

    // ── Plugin entry ────────────────────────────────────────────────────────
    var inject = ['slots'];

    // Error isolation: a render failure inside the pet must never take the
    // shell down; it shows a small card instead.
    var Boundary = React.Component
      ? class Boundary extends React.Component {
          constructor(props) {
            super(props);
            this.state = { error: null };
          }
          static getDerivedStateFromError(error) {
            return { error: error };
          }
          componentDidCatch(error) {
            try { console.error('[whale-pet] render error', error); } catch (e) { /* ignore */ }
          }
          render() {
            if (this.state.error) {
              var msg = String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error);
              return React.createElement('div', {
                style: {
                  position: 'fixed',
                  right: 12,
                  bottom: 12,
                  maxWidth: 420,
                  zIndex: 99999,
                  background: '#7f1d1d',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                },
              }, '🐳 鲸鱼娘渲染错误: ' + msg);
            }
            return this.props.children;
          }
        }
      : null;

    function apply(ctx) {
      ensureStyles();
      var off = ctx.slots.inject('shell.overlay', () => ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'whale-pet',
          order: 1000,
          label: 'DeepSeek 鲸鱼娘桌宠',
        },
        () => Boundary
          ? React.createElement(Boundary, null, React.createElement(WhalePet, null))
          : React.createElement(WhalePet, null)
      ));
      return off;
    }

    exports.apply = apply;
    exports.inject = inject;

    // Test hook (Node only; inert in the browser).
    if (typeof process !== 'undefined' && process.env && process.env.DSH_WP_TEST) {
      exports.__test = {
        view: VIEW,
        viewW: VIEW_W,
        viewH: VIEW_H,
        parts: PARTS,
        sprites: SPRITES,
        eyeStacks: EYE_STACKS,
        blush: BLUSH,
        figW: FIG_W,
        figH: FIG_H,
      };
    }

    return module.exports;
  },
});
