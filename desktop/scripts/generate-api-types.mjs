// Backend C# DTO/entity/enum tanımlarından TypeScript tipleri üretir.
//
//   node scripts/generate-api-types.mjs          → src/types/api/generated.ts yazar
//   node scripts/generate-api-types.mjs --check  → dosya güncel değilse 1 ile çıkar
//
// Kurallar backend'in gerçek JSON davranışını izler (System.Text.Json, Web varsayılanı):
//  - Özellik adları camelCase; [JsonPropertyName] adı aynen kullanılır, [JsonIgnore] atlanır.
//  - <Nullable>enable</Nullable> açık: `string` → string, `string?` → string | null.
//  - Enum'lar SAYI olarak yazılır; yalnız [JsonConverter(typeof(JsonStringEnumConverter))]
//    taşıyan enum'lar ad olarak yazılır. Global converter yoktur.
//  - Guid/DateTime/DateOnly/TimeOnly/TimeSpan → string, decimal/double/long/int → number,
//    byte[] → string (base64), Dictionary<K,V> → Record<string, V>.
//  - Entity'lerdeki gezinme özellikleri (başka entity / entity koleksiyonu) yüklenmediğinde
//    null ya da boş döner; bu yüzden opsiyonel üretilir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, '..');
const backendRoot = path.resolve(desktopRoot, '..', 'backend');
const outFile = path.join(desktopRoot, 'src', 'types', 'api', 'generated.ts');

const SKIP_DIRS = new Set(['bin', 'obj', 'Migrations', 'CourseIntellect.Tests', 'node_modules']);
// Sınıflar yalnız veri taşıyan klasörlerden alınır; kayıtlar (record) her yerden.
const CLASS_DIRS = ['CourseIntellect.Application/DTOs', 'CourseIntellect.Domain/Entities', 'CourseIntellect.Api'];
// Api katmanındaki davranış sınıfları (controller, filtre, servis...) veri tipi değildir.
const NON_DTO_CLASS = /(Controller|Service|Hub|Extensions|Filter|Attribute|Middleware|Provider|Handler|Store|Binder|Factory|Options|Policy|Requirement|Job|Worker|Validator|Helper|Program|Startup|Notifier)$/;

function listCsFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listCsFiles(full));
    else if (entry.name.endsWith('.cs')) result.push(full);
  }
  return result.sort();
}

// Yorumları siler, dize/karakter sabitlerini korur (varsayılan değerlerde virgül/parantez olabilir).
function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
    } else if (ch === '"' || ch === "'") {
      const verbatim = text[i - 1] === '@';
      const quote = ch;
      out += ch;
      i += 1;
      while (i < text.length) {
        if (!verbatim && text[i] === '\\') { out += text[i] + (text[i + 1] ?? ''); i += 2; continue; }
        if (verbatim && text[i] === '"' && text[i + 1] === '"') { out += '""'; i += 2; continue; }
        out += text[i];
        if (text[i] === quote) { i += 1; break; }
        i += 1;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

// text[start] açılış karakteri olmalı; eşleşen kapanışın indeksini döner.
function matchBracket(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      i += 1;
      while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Üst düzey virgüllerden böler (<>, (), [], {} iç içeliğine saygılı).
function splitTopLevel(text, separator = ',') {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') { if (text[j] === '\\') j += 1; j += 1; }
      current += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if ('<([{'.includes(ch)) depth += 1;
    if ('>)]}'.includes(ch)) depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function readAttributes(text) {
  // Baştaki [..] özniteliklerini ayıklar.
  const attributes = [];
  let rest = text.trim();
  while (rest.startsWith('[')) {
    const end = matchBracket(rest, 0, '[', ']');
    if (end < 0) break;
    attributes.push(rest.slice(1, end));
    rest = rest.slice(end + 1).trim();
  }
  return { attributes, rest };
}

function jsonName(name, attributes) {
  for (const attribute of attributes) {
    const match = /JsonPropertyName\(\s*"([^"]+)"\s*\)/.exec(attribute);
    if (match) return match[1];
  }
  // System.Text.Json camelCase: baştaki büyük harf dizisini küçültür (URLValue → urlValue).
  if (/^[A-Z]+$/.test(name)) return name.toLowerCase();
  const leading = /^[A-Z]+/.exec(name)?.[0] ?? '';
  if (leading.length <= 1) return name.charAt(0).toLowerCase() + name.slice(1);
  return leading.slice(0, -1).toLowerCase() + name.slice(leading.length - 1);
}

const isIgnored = (attributes) => attributes.some((attribute) => /^JsonIgnore\b/.test(attribute.trim()) && !/Condition\s*=\s*JsonIgnoreCondition\.(WhenWritingNull|WhenWritingDefault)/.test(attribute));

const declarations = new Map(); // ad → [{ kind, ... }]

function addDeclaration(decl) {
  if (!declarations.has(decl.name)) declarations.set(decl.name, []);
  declarations.get(decl.name).push(decl);
}

function parseParameters(paramText) {
  return splitTopLevel(paramText).map((raw) => {
    const { attributes, rest } = readAttributes(raw);
    const withoutDefault = splitTopLevel(rest, '=')[0] ?? rest;
    const hasDefault = rest.includes('=') && splitTopLevel(rest, '=').length > 1;
    const tokens = withoutDefault.trim().split(/\s+/);
    const name = tokens.pop();
    const type = tokens.filter((token) => !['this', 'params', 'ref', 'out', 'in'].includes(token)).join(' ');
    return { name, type, attributes, hasDefault };
  }).filter((param) => param.name && param.type);
}

// Otomatik özellik (`{ get; set; }`) ya da ifade gövdeli salt-okunur özellik (`=> ...`);
// System.Text.Json ikisini de yazar. Metotlar `(` ile ayrışır, eşleşmez.
const PROPERTY_RE = /((?:\[[^\]]*\]\s*)*)public\s+(?:required\s+|virtual\s+|override\s+|new\s+|static\s+|readonly\s+)*([\w<>?,.\[\]\s()]+?)\s+(\w+)\s*(\{\s*(?:get|init|set)|=>)/g;

function parseBodyProperties(body) {
  // Yalnız doğrudan gövdedeki (iç içe tipler hariç) otomatik özellikler.
  const flat = removeNestedTypes(body);
  const props = [];
  PROPERTY_RE.lastIndex = 0;
  let match;
  while ((match = PROPERTY_RE.exec(flat))) {
    const attributes = readAttributes(match[1] ?? '').attributes;
    if (/\bstatic\b/.test(match[0])) continue;
    // Hesaplanan (=>) özellik yanıtta yazılır ama istekte yok sayılır → opsiyonel.
    props.push({ name: match[3], type: match[2].trim(), attributes, hasDefault: false, computed: match[4] === '=>' });
  }
  return props;
}

function removeNestedTypes(body) {
  let result = '';
  let i = 0;
  const declRe = /\b(class|record|struct|enum|interface)\s+\w+/y;
  while (i < body.length) {
    declRe.lastIndex = i;
    if (/\w/.test(body[i - 1] ?? '') === false && declRe.test(body)) {
      const braceIndex = body.indexOf('{', i);
      const semiIndex = body.indexOf(';', i);
      if (braceIndex >= 0 && (semiIndex < 0 || braceIndex < semiIndex)) {
        const end = matchBracket(body, braceIndex, '{', '}');
        i = end + 1;
        continue;
      }
      i = semiIndex + 1;
      continue;
    }
    result += body[i];
    i += 1;
  }
  return result;
}

// Bildirimler satır başında olur; dize/açıklama içindeki "record in ..." gibi metinler eşleşmesin.
const TYPE_DECL_RE = /^[ \t]*((?:\[[^\]]*\]\s*)*)(?:(?:public|internal|private|protected|sealed|abstract|static|partial|readonly)\s+)*(record(?:\s+class|\s+struct)?|class|enum)\s+(\w+)(<[^>]+>)?/gm;

function parseFile(file) {
  const rel = path.relative(backendRoot, file);
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const allowClasses = CLASS_DIRS.some((dir) => rel.startsWith(dir));
  const isEntity = rel.startsWith('CourseIntellect.Domain/Entities');
  TYPE_DECL_RE.lastIndex = 0;
  let match;
  while ((match = TYPE_DECL_RE.exec(text))) {
    const attributes = readAttributes(match[1] ?? '').attributes;
    const kind = match[2].startsWith('record') ? 'record' : match[2];
    const name = match[3];
    const generics = match[4] ? match[4].slice(1, -1).split(',').map((g) => g.trim()) : [];
    let cursor = match.index + match[0].length;

    if (kind === 'enum') {
      const braceIndex = text.indexOf('{', cursor);
      const end = matchBracket(text, braceIndex, '{', '}');
      const members = [];
      let value = -1;
      for (const raw of splitTopLevel(text.slice(braceIndex + 1, end))) {
        const cleaned = readAttributes(raw).rest;
        const [memberName, explicit] = cleaned.split('=').map((part) => part.trim());
        if (!memberName) continue;
        if (explicit !== undefined && /^-?\d+$/.test(explicit)) value = Number(explicit);
        else if (explicit !== undefined && /^0x[0-9a-f]+$/i.test(explicit)) value = parseInt(explicit, 16);
        else if (explicit !== undefined && /<</.test(explicit)) {
          const [a, b] = explicit.split('<<').map((part) => Number(part.trim()));
          value = a << b;
        } else if (explicit !== undefined) {
          const ref = members.find((member) => member.name === explicit);
          value = ref ? ref.value : value + 1;
        } else value += 1;
        members.push({ name: memberName, value });
      }
      const asString = attributes.some((attribute) => /JsonStringEnumConverter/.test(attribute));
      addDeclaration({ kind, name, members, asString, file: rel });
      continue;
    }

    if (kind === 'class' && !allowClasses) continue;
    if (kind === 'class' && rel.startsWith('CourseIntellect.Api') && NON_DTO_CLASS.test(name)) continue;
    // Statik sınıflar yalnız sabit taşır, JSON'a hiç çıkmaz.
    if (/\bstatic\s/.test(match[0])) continue;

    let params = [];
    if (kind === 'record') {
      const after = text.slice(cursor).trimStart();
      if (after.startsWith('(')) {
        const openIndex = text.indexOf('(', cursor);
        const closeIndex = matchBracket(text, openIndex, '(', ')');
        params = parseParameters(text.slice(openIndex + 1, closeIndex));
        cursor = closeIndex + 1;
      }
    }

    // Kalıtım: ": Base(args), IInterface"
    let base = null;
    const headerEnd = (() => {
      const brace = text.indexOf('{', cursor);
      const semi = text.indexOf(';', cursor);
      if (brace < 0) return { index: semi, body: false };
      if (semi >= 0 && semi < brace) return { index: semi, body: false };
      return { index: brace, body: true };
    })();
    const header = text.slice(cursor, headerEnd.index);
    const baseMatch = /:\s*([\w.]+)(<[^>]+>)?/.exec(header);
    if (baseMatch && !/^I[A-Z]/.test(baseMatch[1])) base = baseMatch[1].split('.').pop();

    let props = [];
    if (headerEnd.body) {
      const end = matchBracket(text, headerEnd.index, '{', '}');
      props = parseBodyProperties(text.slice(headerEnd.index + 1, end));
    }

    addDeclaration({
      kind,
      name,
      generics,
      base,
      members: [...params, ...props],
      isEntity,
      file: rel,
    });
  }
}

for (const file of listCsFiles(backendRoot)) parseFile(file);

// Aynı adla birden fazla tanım: yapısal olarak aynıysa tek, farklıysa dosya adıyla önekli.
const emitted = new Map(); // C# adı → TS adı (tekil ise)
const finalDecls = [];
for (const [name, list] of declarations) {
  const signatures = new Set(list.map((decl) => JSON.stringify({ kind: decl.kind, members: decl.members, base: decl.base })));
  if (signatures.size === 1) {
    emitted.set(name, name);
    finalDecls.push({ ...list[0], tsName: name });
  } else {
    for (const decl of list) {
      const owner = path.basename(decl.file, '.cs').replace(/Controller$/, '');
      finalDecls.push({ ...decl, tsName: `${owner}_${name}` });
    }
  }
}

const entityNames = new Set(finalDecls.filter((decl) => decl.isEntity && decl.kind !== 'enum').map((decl) => decl.name));

const PRIMITIVES = {
  string: 'string', char: 'string', Guid: 'string', DateTime: 'string', DateTimeOffset: 'string',
  DateOnly: 'string', TimeOnly: 'string', TimeSpan: 'string', Uri: 'string',
  int: 'number', long: 'number', short: 'number', byte: 'number', sbyte: 'number', uint: 'number',
  ulong: 'number', ushort: 'number', decimal: 'number', double: 'number', float: 'number',
  Int32: 'number', Int64: 'number', Decimal: 'number', Double: 'number',
  bool: 'boolean', Boolean: 'boolean',
  DayOfWeek: 'number',
  object: 'unknown', dynamic: 'unknown', JsonElement: 'unknown', JsonDocument: 'unknown', JsonNode: 'unknown', JsonObject: 'Record<string, unknown>',
};
const LIST_TYPES = new Set(['List', 'IList', 'IReadOnlyList', 'IEnumerable', 'ICollection', 'IReadOnlyCollection', 'HashSet', 'ISet', 'IReadOnlySet', 'Collection']);
const MAP_TYPES = new Set(['Dictionary', 'IDictionary', 'IReadOnlyDictionary', 'SortedDictionary', 'ConcurrentDictionary']);
const unresolved = new Set();

function mapType(rawType, generics = []) {
  let type = rawType.trim().replace(/^global::/, '');
  let nullable = false;
  if (type.endsWith('?')) { nullable = true; type = type.slice(0, -1).trim(); }
  let ts;
  if (type.endsWith('[]')) {
    const inner = type.slice(0, -2);
    ts = inner === 'byte' ? 'string' : `${wrap(mapType(inner, generics))}[]`;
  } else {
    const genericMatch = /^([\w.]+)<(.+)>$/.exec(type);
    if (genericMatch) {
      const outer = genericMatch[1].split('.').pop();
      const args = splitTopLevel(genericMatch[2]);
      if (LIST_TYPES.has(outer)) ts = `${wrap(mapType(args[0], generics))}[]`;
      else if (MAP_TYPES.has(outer)) ts = `Record<string, ${mapType(args[1] ?? 'object', generics)}>`;
      else if (outer === 'Nullable') { nullable = true; ts = mapType(args[0], generics); }
      else if (outer === 'KeyValuePair') ts = `{ key: ${mapType(args[0], generics)}; value: ${mapType(args[1] ?? 'object', generics)} }`;
      else if (emitted.has(outer)) ts = `${emitted.get(outer)}<${args.map((arg) => mapType(arg, generics)).join(', ')}>`;
      else { unresolved.add(outer); ts = 'unknown'; }
    } else {
      const simple = type.split('.').pop();
      if (generics.includes(simple)) ts = simple;
      else if (PRIMITIVES[simple]) ts = PRIMITIVES[simple];
      else if (emitted.has(simple)) ts = emitted.get(simple);
      else { unresolved.add(simple); ts = 'unknown'; }
    }
  }
  return nullable ? `${ts} | null` : ts;
}

const isRequestType = (name) => /(Request|Command|Input)$/.test(name);

const wrap = (ts) => (/[|&]/.test(ts) ? `(${ts})` : ts);

function isNavigation(type) {
  const bare = type.replace(/\?$/, '').trim();
  const genericMatch = /^([\w.]+)<(.+)>$/.exec(bare);
  if (genericMatch && LIST_TYPES.has(genericMatch[1].split('.').pop())) {
    return entityNames.has(genericMatch[2].trim().replace(/\?$/, ''));
  }
  return entityNames.has(bare);
}

const lines = [
  '// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.',
  '// Kaynak: backend C# DTO/entity/enum tanımları. Yeniden üret: `npm run api:types`.',
  '/* eslint-disable */',
  '',
];

for (const decl of finalDecls.sort((a, b) => a.tsName.localeCompare(b.tsName))) {
  const source = `// ${decl.file}`;
  if (decl.kind === 'enum') {
    lines.push(source);
    lines.push(`export const ${decl.tsName} = {`);
    for (const member of decl.members) {
      lines.push(`  ${member.name}: ${decl.asString ? `'${member.name}'` : member.value},`);
    }
    lines.push('} as const;');
    lines.push(`export type ${decl.tsName} = (typeof ${decl.tsName})[keyof typeof ${decl.tsName}];`);
    lines.push('');
    continue;
  }
  const generic = decl.generics.length ? `<${decl.generics.join(', ')}>` : '';
  const baseTs = decl.base && emitted.has(decl.base) ? ` extends ${emitted.get(decl.base)}` : '';
  lines.push(source);
  lines.push(`export interface ${decl.tsName}${generic}${baseTs} {`);
  const seen = new Set();
  for (const member of decl.members) {
    if (isIgnored(member.attributes)) continue;
    const key = jsonName(member.name, member.attributes);
    if (seen.has(key)) continue;
    seen.add(key);
    const navigation = decl.isEntity && isNavigation(member.type);
    const tsType = mapType(member.type, decl.generics);
    // İstek tipleri: varsayılan değerli ya da null olabilen alanlar gönderilmeyebilir
    // (bağlayıcı eksik alanı varsayılana düşürür).
    const optionalInRequest = isRequestType(decl.name) && (member.hasDefault || /\?\s*$/.test(member.type.trim()));
    if (navigation) lines.push(`  ${key}?: ${tsType} | null;`);
    else if (optionalInRequest) lines.push(`  ${key}?: ${tsType};`);
    else if (member.computed) lines.push(`  readonly ${key}?: ${tsType};`);
    else lines.push(`  ${key}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');
}

const output = `${lines.join('\n').trimEnd()}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (current !== output) {
    console.error('src/types/api/generated.ts güncel değil: `npm run api:types` çalıştırın.');
    process.exit(1);
  }
  console.log('API tipleri güncel.');
} else {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, output);
  console.log(`${finalDecls.length} tip yazıldı → ${path.relative(desktopRoot, outFile)}`);
  if (unresolved.size && process.argv.includes('--verbose')) {
    console.log(`Çözülemeyen (unknown yazıldı): ${[...unresolved].sort().join(', ')}`);
  }
}
