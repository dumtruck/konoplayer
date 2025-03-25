import fs from 'node:fs';
import path from 'node:path';
import { Window, type Element } from 'happy-dom';
import { type } from 'arktype';
import { omitBy, isNil } from 'lodash-es';
import { MultiMap } from 'mnemonist';
import assert from 'node:assert/strict';
import { constantCase } from 'change-case';

export const AdHocType = {
  SimpleBlock: {
    code: 'SimpleBlock',
    primitive: () => 'SimpleBlockSchema',
    default: (_d: string): string => {
      throw new Error('adhoc type can not has default');
    },
    primitiveStr: (_d: string): string => {
      throw new Error('adhoc type does not have primitiveStr');
    },
  },
  Block: {
    code: 'Block',
    primitive: () => 'BlockSchema',
    default: (_d: string): string => {
      throw new Error('adhoc type can not has default');
    },
    primitiveStr: (_d: string): string => {
      throw new Error('adhoc type does not have primitiveStr');
    },
  },
};

const EbmlTypeMetas = {
  master: {
    code: 'Master',
    primitive: (d: string): string => `${d}Schema`,
    default: (_d: string): string => {
      throw new Error('master type can not has default');
    },
    primitiveStr: (_d: string): string => {
      throw new Error('master type does not have primitiveStr');
    },
  },
  uinteger: {
    code: 'Uint',
    primitive: () => 'type.number.or(type.bigint)',
    default: (d: string): string => d,
    primitiveStr: () => '(number | bigint)',
  },
  integer: {
    code: 'Int',
    primitive: () => 'type.number.or(type.bigint)',
    default: (d: string) => d,
    primitiveStr: () => '(number | bigint)',
  },
  float: {
    code: 'Float',
    primitive: () => 'type.number',
    default: (d: string) => `${Number.parseFloat(d)}`,
    primitiveStr: () => 'number',
  },
  string: {
    code: 'Ascii',
    primitive: () => 'type.string',
    default: (d: string) => JSON.stringify(d),
    primitiveStr: () => 'string',
  },
  'utf-8': {
    code: 'Utf8',
    primitive: () => 'type.string',
    default: (d: string) => JSON.stringify(d),
    primitiveStr: () => 'string',
  },
  binary: {
    code: 'Binary',
    primitive: () => 'BinarySchema',
    default: (_d: string): string => {
      throw new Error('binary type can not has default');
    },
    primitiveStr: (_d: string): string => {
      throw new Error('binary type does not have primitiveStr');
    },
  },
  date: {
    code: 'Date',
    primitive: () => 'BinarySchema',
    default: (_d: string): string => {
      throw new Error('date type can not has default');
    },
    primitiveStr: (_d: string): string => {
      throw new Error('date type does not have primitiveStr');
    },
  },
};

export const EbmlTypeSchema = type(
  '"uinteger" | "master" | "binary" | "float" | "utf-8" | "string" | "integer" | "date"'
);

export type EbmlTypeSchemaType = typeof EbmlTypeSchema.infer;

const RestrictionEntrySchema = type({
  value: 'string',
  label: 'string',
  desc: 'string?',
});

type RestrictionEntryType = typeof RestrictionEntrySchema.infer;

const EbmlElementSchema = type({
  name: 'string',
  type: EbmlTypeSchema,
  path: type.string.array().atLeastLength(1),
  prefix: type.string.array().atLeastLength(0),
  parentPath: type.string.optional(),
  level: type.number.atLeast(0),
  id: 'string',
  default: type.string.optional(),
  range: type.string.optional(),
  maxOccurs: type.number.optional(),
  minOccurs: type.number.optional(),
  minVer: type.number.optional(),
  maxVer: type.number.optional(),
  restriction: RestrictionEntrySchema.array().optional(),
});

type EbmlElementType = typeof EbmlElementSchema.infer;

function parseDecimalSafe(value: string | undefined): number | undefined {
  if (value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function extractElement(element: Element) {
  const attrs = element.attributes;
  const name = attrs.getNamedItem('name')?.value?.replace(/-/g, '')!;
  const type = attrs.getNamedItem('type')?.value!;
  const path_ = attrs.getNamedItem('path')?.value!;
  const id = attrs.getNamedItem('id')?.value!;
  const default_ = attrs.getNamedItem('default')?.value;
  const range = attrs.getNamedItem('range')?.value;
  const maxOccurs = parseDecimalSafe(attrs.getNamedItem('maxOccurs')?.value);
  const minOccurs = parseDecimalSafe(attrs.getNamedItem('minOccurs')?.value);
  const minVer = parseDecimalSafe(attrs.getNamedItem('minVer')?.value);
  const maxVer = parseDecimalSafe(attrs.getNamedItem('maxVer')?.value);
  const restriction = [...element.querySelectorAll('restriction>enum')].map(
    (e) => {
      const value = e.getAttribute('value');
      const label = e.getAttribute('label');
      return {
        value,
        label,
      };
    }
  );

  assert(typeof path_ === 'string', `path of ${name} is not string ${element}`);
  const path = path_.replace(/\\\+/g, '\\').split('\\').filter(Boolean);
  const parentPath = path.at(-2);
  const prefix = path.slice(0, -1);
  const level = path.length - 1;
  const el: EbmlElementType = {
    name,
    type: type as any,
    path,
    prefix,
    parentPath,
    level,
    id,
    default: default_,
    range,
    maxOccurs,
    minOccurs,
    minVer,
    maxVer,
    restriction: restriction.length >= 0 ? (restriction as any) : undefined,
  };
  try {
    return EbmlElementSchema.assert(omitBy(el, isNil));
  } catch (e) {
    console.error('error element is: ', name);
    throw e;
  }
}

function extractElementAll() {
  const allElements = new Map<string, EbmlElementType>();

  // the later has the higher priority
  const specs = [
    // 'ebml_mkv_legacy.xml', // ignore legacy when building hirerachy
    'ebml.xml',
    'ebml_mkv.xml',
  ];

  for (const spec of specs) {
    const window = new Window();

    const xmlString = fs.readFileSync(
      path.join(import.meta.dirname, '..', 'assets', 'specification', spec),
      'utf-8'
    );

    const domParser = new window.DOMParser();
    const xmlDoc = domParser.parseFromString(xmlString, 'application/xml');

    const elements = Array.from(xmlDoc.querySelectorAll('element'));

    for (const el of elements) {
      const extracted = extractElement(el);
      if (BigInt(extracted.id) >= Number.MAX_SAFE_INTEGER) {
        throw new Error('unsafe impl use int, should refactor');
      }
      // if (
      //   allElements.has(extracted.id) &&
      //   !isEqual(extracted, allElements.get(extracted.id))
      // ) {
      //   console.warn(
      //     `conflicts id = 0x${extracted.id}, name = ${extracted.name}, overwriting...`
      //   );
      // }
      allElements.set(extracted.id, extracted);
    }
  }

  return Array.from(allElements.values());
}

function preprocessLabels(
  restrictions: RestrictionEntryType[],
  type: EbmlTypeSchemaType
): RestrictionEntryType[] {
  const labels = restrictions.map((r) => r.label);
  const values = restrictions.map((r) => r.value);
  let preprocessed = labels.map((label) =>
    constantCase(
      label
        .replace(/[\s\-_\\/()]+/g, ' ')
        .trim()
        .replace(/\s/g, '_')
    ).replace(/^(\d)/g, '_$1')
  );
  let noValidChars = preprocessed.every((p) => /^[\w_]+$/.test(p));
  let noDuplicated = new Set(preprocessed).size === preprocessed.length;

  if (
    (!noValidChars || !noDuplicated) &&
    (type === 'string' || type === 'utf-8')
  ) {
    preprocessed = values.map((value) =>
      constantCase(
        value
          .replace(/[\s\-_\\/()]+/g, ' ')
          .trim()
          .replace(/\s/g, '_')
      ).replace(/^(\d)/g, '_$1')
    );
    noValidChars = preprocessed.every((p) => /^\w[\w\d_]*$/.test(p));
    noDuplicated = new Set(preprocessed).size === preprocessed.length;
  }

  if (noValidChars && noDuplicated) {
    return preprocessed.map((l, i) => ({
      label: l,
      value: restrictions[i].value,
      desc: restrictions[i].label,
    }));
  }
  return restrictions.map((r) => ({
    label: `Value${r.value}`,
    value: r.value,
    desc: r.label,
  }));
}

function preprocessedValues(
  restrictions: RestrictionEntryType[],
  type: EbmlTypeSchemaType
): RestrictionEntryType[] | undefined {
  if (type === 'integer' || type === 'uinteger') {
    return restrictions.map((r) => ({
      ...r,
      value: /^0x/.test(r.value) ? `${Number.parseInt(r.value, 16)}` : r.value,
    }));
  }
  if (type === 'utf-8' || type === 'string') {
    return restrictions.map((r) => ({ ...r, value: JSON.stringify(r.value) }));
  }
  return undefined;
}

function generateRestriction(element: EbmlElementType): string | undefined {
  const restriction = element.restriction;
  if (!restriction?.length) {
    return;
  }
  const preprocessed = preprocessedValues(
    preprocessLabels(restriction, element.type),
    element.type
  );

  if (!preprocessed) {
    return;
  }

  return [
    `export enum ${element.name}RestrictionEnum {`,
    ...preprocessed.map((r) =>
      [`  // ${r.desc}`, `  ${r.label} = ${r.value},`].join('\n')
    ),
    '};',
    `export const ${element.name}Restriction = type('${preprocessed.map((r) => r.value).join(' | ')}');`,
    `export type ${element.name}RestrictionType = typeof ${element.name}Restriction.infer;`,
  ].join('\n');
}

function generateMkvSchemaImports(_elements: EbmlElementType[]) {
  return `import { type, match } from 'arktype';
import { EbmlTagIdEnum, ${Object.keys(AdHocType)
    .map((typeCode) => `Ebml${typeCode}Tag`)
    .join(' ,')} } from 'konoebml';`;
}

function generateMkvSchemaHierarchy(elements_: EbmlElementType[]) {
  const elements = elements_.toSorted((a, b) => a.level - b.level);
  const seeds = elements.filter((e) => e.level === 0);

  const hirerachy = new MultiMap<string, EbmlElementType>();

  for (const el of elements) {
    const parentPath = el.parentPath;
    if (parentPath) {
      hirerachy.set(parentPath, el);
    }
  }

  const idMulti = new Set<string>();
  const preDefs = [
    'export const BinarySchema = type.instanceOf(Uint8Array);',
    'export type BinaryType = typeof BinarySchema.infer;',
    ...Object.entries(AdHocType).map(
      ([name, meta]) =>
        `export const ${meta.primitive()} = type.instanceOf(Ebml${name}Tag);`
    ),
    ...Object.entries(AdHocType).map(
      ([name, meta]) =>
        `export type ${name}Type = typeof ${meta.primitive()}.infer;`
    ),
  ];

  const generateAssociated = (el: EbmlElementType): string | undefined => {
    const associated = hirerachy.get(el.name);

    if (!associated?.length) {
      return undefined;
    }

    const childrenSchema = [
      ...associated.map(generateAssociated).filter(Boolean),
    ];

    const restrictions: string[] = [];

    const selfSchema = [
      `export const ${el.name}Schema = type({`,
      ...associated.map((v) => {
        let meta: any;
        const restriction = generateRestriction(v);
        if (restriction) {
          restrictions.push(restriction);
        }
        if (v.type === 'master') {
          if (hirerachy.has(v.name)) {
            meta = EbmlTypeMetas.master;
          }
        } else {
          const adHocKey = v.name as keyof typeof AdHocType;
          if (AdHocType[adHocKey]) {
            meta = AdHocType[adHocKey];
          } else {
            meta = EbmlTypeMetas[v.type as keyof typeof EbmlTypeMetas];
          }
        }
        if (!meta) {
          return null;
        }
        let expr = restriction
          ? `${v.name}Restriction`
          : meta.primitive(v.name);
        if (v.maxOccurs !== 1) {
          expr = `${expr}.array()`;
          if (v.maxOccurs !== 1 && v.minOccurs === 1 && !v.default) {
            expr = `${expr}.atLeastLength(1)`;
          }
          idMulti.add(v.name);
        }
        if (v.default) {
          if (v.maxOccurs === 1) {
            expr = `${expr}.default(${meta.default(v.default)})`;
          } else {
            childrenSchema.push(`export const ${v.name}Schema = match({
"${meta.primitiveStr(v.name)}[]": v => v.length > 0 ? v : [${meta.default(v.default)}],
default: () => [${meta.default(v.default)}],
}).optional();`);
            expr = `${v.name}Schema`;
          }
        } else if (!v.minOccurs) {
          expr = `${expr}.optional()`;
        }
        return `  ${v.name}: ${expr},`;
      }),
      '});',
      '',
      `export type ${el.name}Type = typeof ${el.name}Schema.infer;`,
    ].join('\n');

    return [...childrenSchema, ...restrictions, selfSchema].join('\n\n');
  };

  const associations = seeds.map(generateAssociated).filter(Boolean);

  const idMultiSchema = `export const IdMultiSet = new Set([\n${Array.from(
    idMulti.keys()
  )
    .map((name) => `  EbmlTagIdEnum.${name}`)
    .join(',\n')}\n])`;

  return [preDefs.join('\n'), ...associations, idMultiSchema].join('\n\n');
}

function main() {
  const elementSchemas = extractElementAll();

  const files = {
    'schema': [
      generateMkvSchemaImports(elementSchemas),
      generateMkvSchemaHierarchy(elementSchemas),
    ],
  };

  const outDir = path.join(import.meta.dirname, '..', 'temp', 'codegen', 'mkv');

  fs.mkdirSync(outDir, { recursive: true });

  for (const [filename, fragments] of Object.entries(files)) {
    const filepath = path.join(outDir, filename);

    fs.writeFileSync(filepath, fragments.join('\n\n'), 'utf-8');
  }
}

main();
