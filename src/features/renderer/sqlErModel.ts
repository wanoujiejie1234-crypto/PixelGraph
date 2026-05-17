export interface SqlColumn {
  name: string;
  dataType: string;
  comment: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface SqlTable {
  name: string;
  comment: string;
  columns: SqlColumn[];
}

export interface SqlRelationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  name: string;
  fromCardinality: string;
  toCardinality: string;
}

export interface SqlErModel {
  tables: SqlTable[];
  relationships: SqlRelationship[];
}

export type SqlErDiagnosticLevel = 'error' | 'warning';

export interface SqlErDiagnostic {
  level: SqlErDiagnosticLevel;
  message: string;
}

export interface SqlErValidationResult {
  diagnostics: SqlErDiagnostic[];
  hasFatalError: boolean;
}

const reservedWords = new Set([
  'constraint',
  'primary',
  'foreign',
  'unique',
  'index',
  'key',
  'check',
  'references',
  'fulltext',
  'spatial',
]);

function cleanIdentifier(value: string): string {
  return value.replace(/[`"'[\]]/g, '').trim();
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '')
    .replace(/^\s*#.*$/gm, '');
}

function splitDefinitions(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const previous = body[index - 1];

    if ((char === "'" || char === '"' || char === '`') && previous !== '\\') {
      quote = quote === char ? null : quote ?? char;
    }

    if (!quote) {
      if (char === '(') depth += 1;
      if (char === ')') depth = Math.max(0, depth - 1);
    }

    if (char === ',' && depth === 0 && !quote) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function findCreateTableStatements(sql: string): Array<{ complete: boolean; name: string; body: string; suffix: string }> {
  const statements: Array<{ complete: boolean; name: string; body: string; suffix: string }> = [];
  const source = stripSqlComments(sql);
  const createRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?([`"'\[\]\w\u4e00-\u9fa5-]+)\s*\(/giu;
  let match: RegExpExecArray | null;

  while ((match = createRegex.exec(source)) !== null) {
    const bodyStart = createRegex.lastIndex;
    let depth = 1;
    let quote: string | null = null;
    let index = bodyStart;

    for (; index < source.length; index += 1) {
      const char = source[index];
      const previous = source[index - 1];

      if ((char === "'" || char === '"' || char === '`') && previous !== '\\') {
        quote = quote === char ? null : quote ?? char;
      }

      if (!quote) {
        if (char === '(') depth += 1;
        if (char === ')') depth -= 1;
        if (depth === 0) break;
      }
    }

    const complete = depth === 0;
    const suffixStart = complete ? index + 1 : index;
    const suffixEnd = source.indexOf(';', suffixStart);
    statements.push({
      complete,
      name: cleanIdentifier(match[1]),
      body: source.slice(bodyStart, complete ? index : source.length),
      suffix: source.slice(suffixStart, suffixEnd === -1 ? source.length : suffixEnd),
    });
    createRegex.lastIndex = suffixEnd === -1 ? suffixStart : suffixEnd + 1;
  }

  return statements;
}

function isLikelyMermaid(source: string): boolean {
  return /^(erDiagram|classDiagram|sequenceDiagram|stateDiagram(?:-v2)?|flowchart|graph)\b/iu.test(source.trimStart());
}

function validateDefinitions(table: SqlTable, definitions: string[]): SqlErDiagnostic[] {
  const diagnostics: SqlErDiagnostic[] = [];
  const columnNames = new Set<string>();

  table.columns.forEach((column) => {
    const key = column.name.toLowerCase();
    if (columnNames.has(key)) {
      diagnostics.push({ level: 'error', message: `表 ${table.name} 中字段 ${column.name} 重复。` });
    }
    columnNames.add(key);
  });

  definitions.forEach((definition) => {
    const trimmed = definition.trim();
    if (!trimmed) return;
    const column = parseColumnDefinition(trimmed);
    const isKnownConstraint = /\b(primary|foreign|unique|index|key|constraint|check)\b/iu.test(trimmed);
    if (!column && !isKnownConstraint) {
      diagnostics.push({ level: 'warning', message: `表 ${table.name} 中有一行未识别：${trimmed.slice(0, 80)}` });
    }
  });

  if (table.columns.length === 0) {
    diagnostics.push({ level: 'error', message: `表 ${table.name} 没有可识别字段，请检查字段定义。` });
  }

  return diagnostics;
}

export function validateSqlErSource(sql: string): SqlErValidationResult {
  const source = sql.trim();
  const diagnostics: SqlErDiagnostic[] = [];

  if (!source) {
    return {
      diagnostics: [{ level: 'error', message: '请输入 CREATE TABLE 建表语句后再生成 ER 图。' }],
      hasFatalError: true,
    };
  }

  if (isLikelyMermaid(source)) {
    return {
      diagnostics: [{ level: 'error', message: '当前是 SQL 生成 ER 模式，但输入看起来是 Mermaid。请切换到 Mermaid ER，或粘贴 CREATE TABLE 语句。' }],
      hasFatalError: true,
    };
  }

  const statements = findCreateTableStatements(source);
  if (statements.length === 0) {
    return {
      diagnostics: [{ level: 'error', message: '未找到 CREATE TABLE 语句。标准输入应类似：CREATE TABLE users (id BIGINT PRIMARY KEY);' }],
      hasFatalError: true,
    };
  }

  const parsedTables = statements.map((statement) => {
    const table: SqlTable = {
      name: statement.name,
      comment: parseTableComment(statement.suffix),
      columns: [],
    };
    const definitions = splitDefinitions(statement.body);

    definitions.forEach((definition) => {
      const column = parseColumnDefinition(definition);
      if (column) table.columns.push(column);
    });
    applyTableConstraints(table, definitions);

    if (!statement.complete) {
      diagnostics.push({ level: 'error', message: `表 ${statement.name} 的 CREATE TABLE 缺少右括号 ")"。` });
    }
    diagnostics.push(...validateDefinitions(table, definitions));
    return table;
  });

  const tableNames = new Set<string>();
  parsedTables.forEach((table) => {
    const key = table.name.toLowerCase();
    if (tableNames.has(key)) diagnostics.push({ level: 'error', message: `表名 ${table.name} 重复。` });
    tableNames.add(key);
  });

  const tableByName = new Map(parsedTables.map((table) => [table.name.toLowerCase(), table]));
  parsedTables.forEach((table) => {
    table.columns.forEach((column) => {
      if (!column.references) return;
      const targetTable = tableByName.get(column.references.table.toLowerCase());
      if (!targetTable) {
        diagnostics.push({ level: 'error', message: `字段 ${table.name}.${column.name} 引用了不存在的表 ${column.references.table}。` });
        return;
      }
      const targetColumn = targetTable.columns.find((item) => item.name.toLowerCase() === column.references?.column.toLowerCase());
      if (!targetColumn) {
        diagnostics.push({ level: 'error', message: `字段 ${table.name}.${column.name} 引用了不存在的字段 ${column.references.table}.${column.references.column}。` });
      }
    });
  });

  return {
    diagnostics,
    hasFatalError: diagnostics.some((item) => item.level === 'error'),
  };
}

function parseTableComment(suffix: string): string {
  const commentMatch = suffix.match(/\bcomment\s*=\s*'([^']*)'/iu) ?? suffix.match(/\bcomment\s*=\s*"([^"]*)"/iu);
  return commentMatch ? commentMatch[1] : '';
}

function parseColumnComment(definition: string): string {
  const commentMatch = definition.match(/\bcomment\s+'([^']*)'/iu) ?? definition.match(/\bcomment\s+"([^"]*)"/iu);
  return commentMatch ? commentMatch[1] : '';
}

function parseColumnType(definition: string, rawName: string): string {
  const rest = definition.slice(definition.indexOf(rawName) + rawName.length).trim();
  const typeMatch = rest.match(/^([a-zA-Z]+(?:\s*\([^)]*\))?(?:\s+unsigned)?)/u);
  return typeMatch ? typeMatch[1].replace(/\s+/g, ' ') : 'TEXT';
}

function parseColumnDefinition(definition: string): SqlColumn | null {
  const nameMatch = definition.match(/^\s*([`"'\[\]\w\u4e00-\u9fa5-]+)/u);
  if (!nameMatch) return null;

  const rawName = nameMatch[1];
  const name = cleanIdentifier(rawName);
  if (!name || reservedWords.has(name.toLowerCase())) return null;

  const referencesMatch = definition.match(/references\s+([`"'\[\]\w\u4e00-\u9fa5-]+)\s*\(\s*([`"'\[\]\w\u4e00-\u9fa5-]+)\s*\)/iu);

  return {
    name,
    dataType: parseColumnType(definition, rawName),
    comment: parseColumnComment(definition),
    isPrimaryKey: /\bprimary\s+key\b/iu.test(definition),
    isForeignKey: Boolean(referencesMatch),
    isNullable: !/\bnot\s+null\b/iu.test(definition),
    references: referencesMatch
      ? {
          table: cleanIdentifier(referencesMatch[1]),
          column: cleanIdentifier(referencesMatch[2]),
        }
      : undefined,
  };
}

function applyTableConstraints(table: SqlTable, definitions: string[]): void {
  definitions.forEach((definition) => {
    const primaryMatch = definition.match(/\bprimary\s+key\s*\(([^)]+)\)/iu);
    if (primaryMatch) {
      primaryMatch[1].split(',').forEach((columnName) => {
        const column = table.columns.find((item) => item.name.toLowerCase() === cleanIdentifier(columnName).toLowerCase());
        if (column) column.isPrimaryKey = true;
      });
    }

    const foreignMatches = definition.matchAll(
      /\b(?:constraint\s+[`"'\[\]\w\u4e00-\u9fa5-]+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+([`"'\[\]\w\u4e00-\u9fa5-]+)\s*\(([^)]+)\)/giu,
    );

    for (const foreignMatch of foreignMatches) {
      const localColumn = cleanIdentifier(foreignMatch[1].split(',')[0]);
      const column = table.columns.find((item) => item.name.toLowerCase() === localColumn.toLowerCase());
      if (column) {
        column.isForeignKey = true;
        column.references = {
          table: cleanIdentifier(foreignMatch[2]),
          column: cleanIdentifier(foreignMatch[3].split(',')[0]),
        };
      }
    }
  });
}

function singularize(value: string): string {
  return value.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');
}

function readableName(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b(id|code|no|number)\b/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeRelationshipName(sourceTable: SqlTable, sourceColumn: SqlColumn, targetTable: SqlTable): string {
  const columnLabel = readableName(sourceColumn.comment || sourceColumn.name.replace(/_id$|_code$/iu, ''));
  if (columnLabel) return columnLabel;

  const sourceLabel = readableName(sourceTable.comment || sourceTable.name);
  if (sourceLabel && sourceTable.columns.filter((column) => column.references || column.isForeignKey).length > 1) {
    return sourceLabel;
  }

  return readableName(targetTable.comment || targetTable.name) || targetTable.name;
}

function inferRelationships(tables: SqlTable[]): SqlRelationship[] {
  const tableByName = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  const relationships: SqlRelationship[] = [];
  const seen = new Set<string>();

  tables.forEach((table) => {
    table.columns.forEach((column) => {
      let targetTable = column.references?.table;
      let targetColumn = column.references?.column ?? 'id';

      if (!targetTable && column.name.toLowerCase().endsWith('_id')) {
        const prefix = column.name.slice(0, -3).toLowerCase();
        const inferred = tables.find((item) => {
          const tableName = item.name.toLowerCase();
          return tableName === prefix || singularize(tableName) === prefix;
        });
        if (inferred) {
          targetTable = inferred.name;
          targetColumn = inferred.columns.find((item) => item.isPrimaryKey)?.name ?? 'id';
        }
      }

      if (!targetTable || !tableByName.has(targetTable.toLowerCase())) return;
      const target = tableByName.get(targetTable.toLowerCase());
      if (!target) return;

      const key = `${targetTable}.${targetColumn}->${table.name}.${column.name}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      column.isForeignKey = true;
      column.references = { table: targetTable, column: targetColumn };
      relationships.push({
        id: key,
        fromTable: targetTable,
        fromColumn: targetColumn,
        toTable: table.name,
        toColumn: column.name,
        name: makeRelationshipName(table, column, target),
        fromCardinality: '1',
        toCardinality: 'N',
      });
    });
  });

  return relationships;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

export function parseSqlErModel(sql: string): SqlErModel {
  const tables = findCreateTableStatements(sql).filter((statement) => statement.complete).map((statement) => {
    const table: SqlTable = {
      name: statement.name,
      comment: parseTableComment(statement.suffix),
      columns: [],
    };
    const definitions = splitDefinitions(statement.body);

    definitions.forEach((definition) => {
      const column = parseColumnDefinition(definition);
      if (column) table.columns.push(column);
    });

    applyTableConstraints(table, definitions);
    return table;
  });

  return {
    tables,
    relationships: inferRelationships(tables),
  };
}

export function modelToSql(model: SqlErModel): string {
  return model.tables
    .map((table) => {
      const columnLines = table.columns.map((column) => {
        const parts = [`  \`${column.name}\` ${column.dataType || 'TEXT'}`];
        if (!column.isNullable || column.isPrimaryKey) parts.push('NOT NULL');
        if (column.isPrimaryKey) parts.push('PRIMARY KEY');
        if (column.comment) parts.push(`COMMENT '${escapeSql(column.comment)}'`);
        return parts.join(' ');
      });
      const foreignLines = table.columns
        .filter((column) => column.references)
        .map(
          (column) =>
            `  FOREIGN KEY (\`${column.name}\`) REFERENCES \`${column.references?.table}\`(\`${column.references?.column}\`)`,
        );
      const body = [...columnLines, ...foreignLines].join(',\n');
      const suffix = table.comment ? ` COMMENT='${escapeSql(table.comment)}'` : '';
      return `CREATE TABLE \`${table.name}\` (\n${body}\n)${suffix};`;
    })
    .join('\n\n');
}
