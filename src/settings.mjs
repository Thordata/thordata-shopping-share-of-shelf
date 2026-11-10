export const Settings = (() => {
// Supplementary full case folds generated from Python Unicode 14.0.0; standard lowercasing handles the remaining characters.
const CASE_FOLD = {"\u00b5":"\u03bc","\u00df":"ss","\u0149":"\u02bcn","\u017f":"s","\u01f0":"j\u030c","\u0345":"\u03b9","\u0390":"\u03b9\u0308\u0301","\u03b0":"\u03c5\u0308\u0301","\u03c2":"\u03c3","\u03d0":"\u03b2","\u03d1":"\u03b8","\u03d5":"\u03c6","\u03d6":"\u03c0","\u03f0":"\u03ba","\u03f1":"\u03c1","\u03f5":"\u03b5","\u0587":"\u0565\u0582","\uab70":"\u13a0","\uab71":"\u13a1","\uab72":"\u13a2","\uab73":"\u13a3","\uab74":"\u13a4","\uab75":"\u13a5","\uab76":"\u13a6","\uab77":"\u13a7","\uab78":"\u13a8","\uab79":"\u13a9","\uab7a":"\u13aa","\uab7b":"\u13ab","\uab7c":"\u13ac","\uab7d":"\u13ad","\uab7e":"\u13ae","\uab7f":"\u13af","\uab80":"\u13b0","\uab81":"\u13b1","\uab82":"\u13b2","\uab83":"\u13b3","\uab84":"\u13b4","\uab85":"\u13b5","\uab86":"\u13b6","\uab87":"\u13b7","\uab88":"\u13b8","\uab89":"\u13b9","\uab8a":"\u13ba","\uab8b":"\u13bb","\uab8c":"\u13bc","\uab8d":"\u13bd","\uab8e":"\u13be","\uab8f":"\u13bf","\uab90":"\u13c0","\uab91":"\u13c1","\uab92":"\u13c2","\uab93":"\u13c3","\uab94":"\u13c4","\uab95":"\u13c5","\uab96":"\u13c6","\uab97":"\u13c7","\uab98":"\u13c8","\uab99":"\u13c9","\uab9a":"\u13ca","\uab9b":"\u13cb","\uab9c":"\u13cc","\uab9d":"\u13cd","\uab9e":"\u13ce","\uab9f":"\u13cf","\uaba0":"\u13d0","\uaba1":"\u13d1","\uaba2":"\u13d2","\uaba3":"\u13d3","\uaba4":"\u13d4","\uaba5":"\u13d5","\uaba6":"\u13d6","\uaba7":"\u13d7","\uaba8":"\u13d8","\uaba9":"\u13d9","\uabaa":"\u13da","\uabab":"\u13db","\uabac":"\u13dc","\uabad":"\u13dd","\uabae":"\u13de","\uabaf":"\u13df","\uabb0":"\u13e0","\uabb1":"\u13e1","\uabb2":"\u13e2","\uabb3":"\u13e3","\uabb4":"\u13e4","\uabb5":"\u13e5","\uabb6":"\u13e6","\uabb7":"\u13e7","\uabb8":"\u13e8","\uabb9":"\u13e9","\uabba":"\u13ea","\uabbb":"\u13eb","\uabbc":"\u13ec","\uabbd":"\u13ed","\uabbe":"\u13ee","\uabbf":"\u13ef","\u13f8":"\u13f0","\u13f9":"\u13f1","\u13fa":"\u13f2","\u13fb":"\u13f3","\u13fc":"\u13f4","\u13fd":"\u13f5","\u1c80":"\u0432","\u1c81":"\u0434","\u1c82":"\u043e","\u1c83":"\u0441","\u1c84":"\u0442","\u1c85":"\u0442","\u1c86":"\u044a","\u1c87":"\u0463","\u1c88":"\ua64b","\u1e96":"h\u0331","\u1e97":"t\u0308","\u1e98":"w\u030a","\u1e99":"y\u030a","\u1e9a":"a\u02be","\u1e9b":"\u1e61","\u1f50":"\u03c5\u0313","\u1f52":"\u03c5\u0313\u0300","\u1f54":"\u03c5\u0313\u0301","\u1f56":"\u03c5\u0313\u0342","\u1f80":"\u1f00\u03b9","\u1f81":"\u1f01\u03b9","\u1f82":"\u1f02\u03b9","\u1f83":"\u1f03\u03b9","\u1f84":"\u1f04\u03b9","\u1f85":"\u1f05\u03b9","\u1f86":"\u1f06\u03b9","\u1f87":"\u1f07\u03b9","\u1f90":"\u1f20\u03b9","\u1f91":"\u1f21\u03b9","\u1f92":"\u1f22\u03b9","\u1f93":"\u1f23\u03b9","\u1f94":"\u1f24\u03b9","\u1f95":"\u1f25\u03b9","\u1f96":"\u1f26\u03b9","\u1f97":"\u1f27\u03b9","\u1fa0":"\u1f60\u03b9","\u1fa1":"\u1f61\u03b9","\u1fa2":"\u1f62\u03b9","\u1fa3":"\u1f63\u03b9","\u1fa4":"\u1f64\u03b9","\u1fa5":"\u1f65\u03b9","\u1fa6":"\u1f66\u03b9","\u1fa7":"\u1f67\u03b9","\u1fb2":"\u1f70\u03b9","\u1fb3":"\u03b1\u03b9","\u1fb4":"\u03ac\u03b9","\u1fb6":"\u03b1\u0342","\u1fb7":"\u03b1\u0342\u03b9","\u1fbe":"\u03b9","\u1fc2":"\u1f74\u03b9","\u1fc3":"\u03b7\u03b9","\u1fc4":"\u03ae\u03b9","\u1fc6":"\u03b7\u0342","\u1fc7":"\u03b7\u0342\u03b9","\u1fd2":"\u03b9\u0308\u0300","\u1fd3":"\u03b9\u0308\u0301","\u1fd6":"\u03b9\u0342","\u1fd7":"\u03b9\u0308\u0342","\u1fe2":"\u03c5\u0308\u0300","\u1fe3":"\u03c5\u0308\u0301","\u1fe4":"\u03c1\u0313","\u1fe6":"\u03c5\u0342","\u1fe7":"\u03c5\u0308\u0342","\u1ff2":"\u1f7c\u03b9","\u1ff3":"\u03c9\u03b9","\u1ff4":"\u03ce\u03b9","\u1ff6":"\u03c9\u0342","\u1ff7":"\u03c9\u0342\u03b9","\ufb00":"ff","\ufb01":"fi","\ufb02":"fl","\ufb03":"ffi","\ufb04":"ffl","\ufb05":"st","\ufb06":"st","\ufb13":"\u0574\u0576","\ufb14":"\u0574\u0565","\ufb15":"\u0574\u056b","\ufb16":"\u057e\u0576","\ufb17":"\u0574\u056d"};
function caseFold(value) {
  return Array.from(value.normalize('NFKC').toLowerCase(), char => CASE_FOLD[char] ?? char).join('');
}
// Country and language values mirror the bundled Google Shopping engine schema.
const COUNTRIES = 'af al dz as ad ao ai aq ag ar am aw au at az bs bh bd bb by be bz bj bm bt bo ba bw bv br io bn bg bf bi kh cm ca cv ky cf td cl cn cx cc co km cg cd ck cr ci hr cu cy cz dk dj dm do ec eg sv gq er ee et fk fo fj fi fr gf pf tf ga gm ge de gh gi gr gl gd gp gu gt gg gn gw gy ht hm va hn hk hu is in id ir iq ie im il it je jm jp jo kz ke ki kp kr kw kg la lv lb ls lr ly li lt lu mo mk mg mw my mv ml mt mh mq mr mu yt mx fm md mc mn me ms ma mz mm na nr np nl an nc nz ni ne ng nu nf mp no om pk pw ps pa pg py pe ph pn pl pt pr qa re ro ru rw sh kn lc pm vc ws sm st sa sn rs sc sl sg sk si sb so za gs es lk sd sr sj sz se ch sy tw tj tz th tl tg tk to tt tn tr tm tc tv ug ua ae uk gb us um uy uz vu ve vn vg vi wf eh ye zm zw'.split(' ');
const LANGUAGES = 'af ak ws am ar hy az ceb eu be bem bn bh xx-bork bs br bg bt km ca chr ny zh-cn zh-tw co hr cs da nl xx-elmer en eo et ee fo tl fi fr fy gaa gl ka de el kl gn gu xx-hacker ht ha haw iw he hi hu is ig id ia ga it ja jw kn kk rw rn xx-klingon kg ko kri ku ckb ky lo la lv ln lt loz lg ach mk mg ms ml mt mv mi mr mfe mo mn sr-me my ne pcm nso no nn oc or om ps fa xx-pirate pl pt pt-br pt-pt pa qu ro rm nyn ru gd sr sh st tn crs sn sd si sk sl so es es-419 su sw sv tg ta tt te th ti to lua tum tr tk tw ug uk ur uz vu vi cy wo xh yi yo zu'.split(' ');
const DEFAULT_KEYWORDS = ['wireless earbuds', 'bluetooth headphones', 'portable speakers'];
const DEFAULT_ALIASES = ['JBL'];
const METRIC_VERSION = 1;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(text) {
  let h = 0x6c62272e07bb014262b821756295c58dn;
  const prime = 0x1000000000000000000013bn;
  const mask = (1n << 128n) - 1n;
  for (const char of text) {
    const point = char.codePointAt(0);
    const bytes = point <= 0x7f ? [point]
      : point <= 0x7ff ? [0xc0 | (point >> 6), 0x80 | (point & 0x3f)]
      : point <= 0xffff ? [0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f)]
      : [0xf0 | (point >> 18), 0x80 | ((point >> 12) & 0x3f), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f)];
    for (const byte of bytes) h = ((h ^ BigInt(byte)) * prime) & mask;
  }
  return h.toString(16).padStart(32, '0');
}

function stringList(value, name, max, maxLength, preserve = false) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${name} must contain at most ${max} strings`);
  const result = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > maxLength) throw new Error(`${name} entries must be non-empty strings of at most ${maxLength} characters`);
    result.push(preserve ? item : item.trim());
  }
  return result;
}

function bool(value, name, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function number(value, name, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number between ${min} and ${max}`);
  return value;
}

  function parse(input = {}, runId) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('settings must be an object');
    const keywords = dedupe(stringList(input.keywords === undefined ? DEFAULT_KEYWORDS : input.keywords, 'keywords', 20, 200).map(value => value.replace(/\s+/gu, ' ')), normalize);
    if (!keywords.length) throw new Error('keywords must contain at least one entry');
    const targetName = input.target_name === undefined ? 'JBL' : input.target_name;
    if (typeof targetName !== 'string' || !targetName.trim() || targetName.length > 100) throw new Error('target_name must be a non-empty string of at most 100 characters');
    const brand_aliases = dedupe(stringList(input.brand_aliases === undefined ? DEFAULT_ALIASES : input.brand_aliases, 'brand_aliases', 20, 100), normalize);
    const productIds = dedupe(stringList(input.product_ids === undefined ? [] : input.product_ids, 'product_ids', 100, 100, true), value => value);
    if (!brand_aliases.length && !productIds.length) throw new Error('at least one alias or product_id is required');
    const country = input.country === undefined ? 'us' : typeof input.country === 'string' ? input.country.trim().toLowerCase() : input.country;
    const language = input.language === undefined ? 'en' : typeof input.language === 'string' ? input.language.trim().toLowerCase() : input.language;
    if (typeof country !== 'string' || !COUNTRIES.includes(country)) throw new Error('country must be supported by Google Shopping');
    if (typeof language !== 'string' || !LANGUAGES.includes(language)) throw new Error('language must be supported by Google Shopping');
    if (typeof input.spreadsheet_id !== 'string' || !input.spreadsheet_id.trim()) throw new Error('spreadsheet_id is required');
    const enableSlack = bool(input.enable_slack, 'enable_slack', true);
    const slackChannel = input.slack_channel === undefined ? '' : input.slack_channel;
    if (typeof slackChannel !== 'string') throw new Error('slack_channel must be a string');
    if (enableSlack && (typeof slackChannel !== 'string' || !slackChannel.trim())) throw new Error('slack_channel is required when enable_slack is true');
    const shelfDepth = number(input.shelf_depth, 'shelf_depth', 20, 1, 40);
    const rankThreshold = number(input.rank_alert_threshold, 'rank_alert_threshold', 3, 0, Infinity);
    if (!Number.isInteger(shelfDepth)) throw new Error('shelf_depth must be an integer');
    if (!Number.isInteger(rankThreshold)) throw new Error('rank_alert_threshold must be an integer');
    const shareThreshold = number(input.share_alert_threshold_pp, 'share_alert_threshold_pp', 10, 0, 100);
    const priceThreshold = number(input.price_alert_threshold_pct, 'price_alert_threshold_pct', 5, 0, Infinity);
    if (rankThreshold <= 0 || shareThreshold <= 0 || priceThreshold <= 0) throw new Error('alert thresholds must be positive');
    const runAnchor = input.run_anchor === undefined ? new Date().toISOString() : input.run_anchor;
    if (typeof runAnchor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(runAnchor) || !Number.isFinite(Date.parse(runAnchor)) || new Date(runAnchor).toISOString() !== runAnchor) throw new Error('run_anchor must be a valid UTC ISO timestamp with milliseconds');
    if ((typeof runId !== 'string' && typeof runId !== 'number') || !String(runId).trim()) throw new Error('execution run ID is required');
    return {
      target_name: targetName.trim(), brand_aliases, product_ids: productIds, keywords,
      country: country.toLowerCase(), language, shelf_depth: shelfDepth,
      rank_alert_threshold: rankThreshold, share_alert_threshold_pp: shareThreshold, price_alert_threshold_pct: priceThreshold,
      enable_ai: bool(input.enable_ai, 'enable_ai', true), enable_slack: enableSlack, slack_channel: slackChannel.trim(),
      spreadsheet_id: input.spreadsheet_id.trim(), run_id: String(runId), run_anchor: new Date(runAnchor).toISOString(),
      metric_version: METRIC_VERSION,
    };
  }

  function jobs(config) {
    const identities = new Map();
    function identity(kind, value) {
      const id = hash(value);
      const key = `${kind}:${id}`;
      if (identities.has(key) && identities.get(key) !== value) throw new Error('Deterministic identity collision; no searches were started');
      identities.set(key, value);
      return id;
    }
    return config.keywords.map((keyword) => {
      const normalizedKeyword = normalize(keyword);
      const scope = [
        'google_shopping', normalizedKeyword, config.country, config.language, 0, config.shelf_depth,
        [...new Set(config.brand_aliases.map(normalize))].sort(), [...new Set(config.product_ids)].sort(), config.metric_version ?? METRIC_VERSION,
      ];
      const scopeJson = canonical(scope);
      const scopeId = identity('scope', scopeJson);
      const queryId = identity('query', canonical(['google_shopping', normalizedKeyword, config.country, config.language, 0]));
      const snapshotId = identity('snapshot', canonical([config.run_id, scopeId]));
      return { ...config, engine: 'google_shopping', keyword, query: keyword, query_id: queryId, scope_id: scopeId, scope_json: scopeJson, snapshot_id: snapshotId, start: 0, checked_at: config.run_anchor };
    });
  }

  function normalize(value) { return caseFold(value).replace(/\s+/gu, ' ').trim(); }
  function dedupe(values, key) { const seen = new Set(); return values.filter(value => { const id = key(value); if (seen.has(id)) return false; seen.add(id); return true; }); }
  return { parse, jobs, canonical, hash, METRIC_VERSION, COUNTRIES, LANGUAGES };
})();
