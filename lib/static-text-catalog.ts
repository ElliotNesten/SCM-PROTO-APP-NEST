import { promises as fs } from "fs";
import path from "path";
import ts from "typescript";

import { normalizeTextCustomizationKey } from "@/lib/text-customization-shared";

const sourceDirectories = [
  path.join(process.cwd(), "app"),
  path.join(process.cwd(), "components"),
];

const supportedExtensions = new Set([".ts", ".tsx"]);
const excludedDirectoryNames = new Set(["api"]);
const excludedJsxAttributeNames = new Set([
  "className",
  "href",
  "src",
  "id",
  "name",
  "type",
  "role",
  "method",
  "action",
  "target",
  "rel",
  "value",
  "placeholder",
  "viewBox",
  "d",
  "fill",
  "key",
]);

function isVisibleTextCandidate(value: string) {
  const normalized = normalizeTextCustomizationKey(value);

  if (!normalized || normalized.length > 180) {
    return false;
  }

  if (!/[\p{L}]/u.test(normalized)) {
    return false;
  }

  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes(".tsx") ||
    normalized.includes(".ts") ||
    normalized.includes(".json") ||
    normalized.startsWith("use client") ||
    normalized.startsWith("use server")
  ) {
    return false;
  }

  return true;
}

function shouldIncludeStringLiteral(node: ts.StringLiteralLike) {
  const parent = node.parent;

  if (!parent) {
    return true;
  }

  if (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent)
  ) {
    return false;
  }

  let currentAttributeOwner: ts.Node | undefined = parent;

  while (currentAttributeOwner) {
    if (ts.isJsxAttribute(currentAttributeOwner)) {
      if (!ts.isIdentifier(currentAttributeOwner.name)) {
        return false;
      }

      const attributeName = currentAttributeOwner.name.text;

      if (excludedJsxAttributeNames.has(attributeName)) {
        return false;
      }

      const jsxAttributes = currentAttributeOwner.parent;
      const jsxElement = jsxAttributes?.parent;

      if (!jsxElement) {
        return false;
      }

      if (ts.isJsxOpeningElement(jsxElement) || ts.isJsxSelfClosingElement(jsxElement)) {
        const tagName = jsxElement.tagName;

        if (ts.isIdentifier(tagName)) {
          return /^[A-Z]/.test(tagName.text);
        }

        return ts.isPropertyAccessExpression(tagName);
      }

      return false;
    }

    currentAttributeOwner = currentAttributeOwner.parent;
  }

  let currentNode: ts.Node | undefined = parent;

  while (currentNode) {
    if (
      ts.isJsxExpression(currentNode) ||
      ts.isJsxElement(currentNode) ||
      ts.isJsxFragment(currentNode)
    ) {
      return true;
    }

    currentNode = currentNode.parent;
  }

  return false;
}

async function collectSourceFiles(directoryPath: string): Promise<string[]> {
  let directoryEntries: Awaited<ReturnType<typeof fs.readdir>>;

  try {
    directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nestedFiles = await Promise.all(
    directoryEntries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (excludedDirectoryNames.has(entry.name)) {
          return [];
        }

        return collectSourceFiles(entryPath);
      }

      if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name))) {
        return [];
      }

      return [entryPath];
    }),
  );

  return nestedFiles.flat();
}

async function extractVisibleTextCandidates(filePath: string) {
  const source = await fs.readFile(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const collectedValues = new Set<string>();

  function collectValue(rawValue: string) {
    const normalized = normalizeTextCustomizationKey(rawValue);

    if (isVisibleTextCandidate(normalized)) {
      collectedValues.add(normalized);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      collectValue(node.getFullText(sourceFile));
    } else if (ts.isStringLiteralLike(node) && shouldIncludeStringLiteral(node)) {
      collectValue(node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return collectedValues;
}

export async function getStaticTextCatalog() {
  const files = (await Promise.all(sourceDirectories.map(collectSourceFiles))).flat();
  const catalogValues = new Set<string>();

  for (const filePath of files) {
    const fileValues = await extractVisibleTextCandidates(filePath);

    fileValues.forEach((value) => {
      catalogValues.add(value);
    });
  }

  return [...catalogValues].sort((left, right) => left.localeCompare(right));
}
