import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const sourceDirectories = ["app", "components", "lib", "data", "types"];
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
const outputDirectory = path.join(projectRoot, "docs", "generated");
const markdownOutputPath = path.join(outputDirectory, "scm-app-architecture-report.md");
const htmlOutputPath = path.join(outputDirectory, "scm-app-architecture-report.html");

const domainDefinitions = [
  {
    title: "Authentication And Session Control",
    summary:
      "The platform and the staff app both use file-backed session stores. Platform auth can also elevate approved staff accounts into temporary gig-manager sessions when linked gig access exists.",
    paths: [
      "app/auth-actions.ts",
      "app/login/page.tsx",
      "app/staff-app/actions.ts",
      "app/staff-app/login/page.tsx",
      "lib/auth-session.ts",
      "lib/staff-app-session.ts",
      "lib/scm-staff-store.ts",
      "lib/staff-app-store.ts",
      "lib/password-utils.ts",
      "data/auth-sessions.json",
      "data/staff-app-sessions.json",
      "data/scm-staff-store.json",
      "data/staff-app-account-store.json",
    ],
  },
  {
    title: "Gig And Shift Operations",
    summary:
      "Gigs are the central operational entity. Gig routes fan out into overview editing, file management, shift planning, report documents, closeout, and temporary manager sharing. Shift state automatically syncs against gig creation and teardown.",
    paths: [
      "app/(platform)/gigs/page.tsx",
      "app/(platform)/gigs/new/page.tsx",
      "app/(platform)/gigs/new/actions.ts",
      "app/(platform)/gigs/[gigId]/page.tsx",
      "app/(platform)/gigs/[gigId]/shifts/[shiftId]/page.tsx",
      "components/gig-overview-editor.tsx",
      "components/gig-files-manager.tsx",
      "components/gig-shifts-panel.tsx",
      "components/gig-report-documents.tsx",
      "components/gig-report-closeout-panel.tsx",
      "lib/gig-store.ts",
      "lib/shift-store.ts",
      "lib/gig-time-report-store.ts",
      "lib/gig-closeout.ts",
      "lib/gig-file-storage.ts",
      "lib/shift-communication-store.ts",
      "data/gig-store.json",
      "data/shift-store.json",
      "data/shift-communication-store.json",
      "data/gig-file-attachments",
    ],
  },
  {
    title: "People, Profiles, And SCM Staff Administration",
    summary:
      "The admin platform keeps two distinct people models: operational staff profiles in the People directory and internal SCM platform users in the SCM Staff area. Access control, search visibility, and scope rules are layered on top of those two stores.",
    paths: [
      "app/(platform)/people/page.tsx",
      "app/(platform)/people/new/page.tsx",
      "app/(platform)/people/new/actions.ts",
      "app/(platform)/people/[personId]/page.tsx",
      "app/(platform)/profile/page.tsx",
      "app/(platform)/scm-staff/page.tsx",
      "app/(platform)/scm-staff/new/page.tsx",
      "app/(platform)/scm-staff/new/actions.ts",
      "app/(platform)/scm-staff/[personId]/page.tsx",
      "components/staff-profile-editor.tsx",
      "components/scm-staff-profile-editor.tsx",
      "components/staff-documents-panel.tsx",
      "components/scm-role-permission-guide.tsx",
      "lib/staff-store.ts",
      "lib/staff-document-store.ts",
      "lib/scm-staff-store.ts",
      "lib/platform-access.ts",
      "types/scm-rbac.ts",
      "types/staff-role.ts",
      "data/staff-store.json",
      "data/staff-document-store.json",
      "data/scm-staff-store.json",
      "data/old-staff-documents.json",
    ],
  },
  {
    title: "Staff App Experience",
    summary:
      "The standalone mobile staff app is a second product surface inside the same Next.js project. It pulls from shared gig and staff data, then layers its own account, attendance, application, and guide stores on top.",
    paths: [
      "app/staff-app/(protected)/layout.tsx",
      "app/staff-app/(protected)/home/page.tsx",
      "app/staff-app/(protected)/gigs/page.tsx",
      "app/staff-app/(protected)/schedule/page.tsx",
      "app/staff-app/(protected)/documents/page.tsx",
      "app/staff-app/(protected)/messages/page.tsx",
      "app/staff-app/(protected)/profile/page.tsx",
      "components/staff-app/mobile-shell.tsx",
      "components/staff-app/gig-flow.tsx",
      "components/staff-app/documents-browser.tsx",
      "components/staff-app/colleague-directory.tsx",
      "lib/staff-app-data.ts",
      "lib/staff-app-store.ts",
      "lib/staff-app-session.ts",
      "lib/staff-app-attendance-store.ts",
      "lib/staff-app-gig-application-store.ts",
      "lib/staff-app-guides.ts",
      "data/staff-app-account-store.json",
      "data/staff-app-sessions.json",
      "data/staff-app-attendance-store.json",
      "data/staff-app-gig-application-store.json",
    ],
  },
  {
    title: "System Settings, Search, And PDF Generation",
    summary:
      "Search, policy content, SCM info, and generated PDFs are all configurable from within the app. The system-settings area updates JSON-backed templates that are then consumed by API routes and PDF builders.",
    paths: [
      "app/(platform)/system-settings/page.tsx",
      "components/global-search.tsx",
      "components/system-settings-policy-uploader.tsx",
      "components/system-settings-scm-info-editor.tsx",
      "components/system-settings-template-editor.tsx",
      "app/api/search/route.ts",
      "app/api/staff-app/policy-pdf/route.ts",
      "app/api/system-settings/policy/route.ts",
      "app/api/system-settings/scm-info/route.ts",
      "app/api/system-settings/scm-info-pdfs/route.ts",
      "app/api/system-settings/templates/route.ts",
      "lib/global-search.ts",
      "lib/system-policy-store.ts",
      "lib/system-scm-info-store.ts",
      "lib/system-scm-info-pdf-store.ts",
      "lib/system-template-store.ts",
      "lib/staff-document-pdf.ts",
      "lib/staff-app-policy-pdf.ts",
      "data/system-policy-store.json",
      "data/system-scm-info-store.json",
      "data/system-scm-info-pdf-store.json",
      "data/system-template-store.json",
    ],
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(relativeDirectory) {
  const absoluteDirectory = path.join(projectRoot, relativeDirectory);
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const relativePath = toPosixPath(path.relative(projectRoot, absolutePath));

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relativePath)));
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function splitRouteSegments(relativePath) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .slice(1)
    .filter((segment) => !segment.startsWith("(") || !segment.endsWith(")"));
}

function buildPageRoute(relativePath) {
  const segments = splitRouteSegments(relativePath);

  if (segments.at(-1) === "page.tsx" || segments.at(-1) === "page.ts") {
    segments.pop();
  }

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function buildApiRoute(relativePath) {
  const segments = splitRouteSegments(relativePath);

  if (segments.at(-1) === "route.ts" || segments.at(-1) === "route.tsx") {
    segments.pop();
  }

  return `/${segments.join("/")}`;
}

function classifySourceFile(relativePath, content) {
  if (relativePath.startsWith("app/api/") && /\/route\.tsx?$/.test(relativePath)) {
    return "apiRoute";
  }

  if (relativePath.startsWith("app/") && /\/page\.tsx?$/.test(relativePath)) {
    return "page";
  }

  if (relativePath.startsWith("app/") && /\/layout\.tsx?$/.test(relativePath)) {
    return "layout";
  }

  if (relativePath.startsWith("app/") && /actions?\.tsx?$/.test(path.posix.basename(relativePath))) {
    return "action";
  }

  if (relativePath.startsWith("components/")) {
    return "component";
  }

  if (relativePath.startsWith("lib/")) {
    return "lib";
  }

  if (relativePath.startsWith("types/")) {
    return "type";
  }

  if (relativePath.startsWith("data/")) {
    return relativePath.endsWith(".json") ? "jsonData" : "dataModule";
  }

  if (relativePath.startsWith("docs/")) {
    return "doc";
  }

  if (/^['"]use server['"]/.test(content.trimStart()) || /^["']use server["']/.test(content.trimStart())) {
    return "action";
  }

  return "other";
}

function extractModuleSpecifiers(content) {
  const specs = new Set();
  const patterns = [
    /import\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g,
    /export\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      specs.add(match[1]);
    }
  }

  return [...specs];
}

async function resolveModuleSpecifier(fromRelativePath, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) {
    return null;
  }

  const baseRelativePath = specifier.startsWith("@/")
    ? specifier.slice(2)
    : toPosixPath(
        path.posix.normalize(path.posix.join(path.posix.dirname(fromRelativePath), specifier)),
      );

  const candidates = [
    baseRelativePath,
    `${baseRelativePath}.ts`,
    `${baseRelativePath}.tsx`,
    `${baseRelativePath}.js`,
    `${baseRelativePath}.jsx`,
    `${baseRelativePath}.json`,
    `${baseRelativePath}/index.ts`,
    `${baseRelativePath}/index.tsx`,
    `${baseRelativePath}/index.js`,
    `${baseRelativePath}/index.jsx`,
    `${baseRelativePath}/index.json`,
  ];

  for (const candidate of candidates) {
    if (await pathExists(path.join(projectRoot, candidate))) {
      return toPosixPath(candidate);
    }
  }

  return null;
}

function extractApiPaths(content) {
  const matches = content.match(/\/api\/[a-z0-9\-_/[\]]+/gi) ?? [];
  return uniqueSorted(matches.map((match) => match.trim()));
}

function extractExportedFunctionNames(content) {
  const matches = content.matchAll(
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
  );
  return uniqueSorted([...matches].map((match) => match[1]));
}

function extractStoreReferences(relativePath, content) {
  const storeRefs = [];
  const dataFolderRefs = uniqueSorted([
    ...(content.match(/[\w-]+\.json/g) ?? []),
    ...(content.match(/gig-file-attachments/g) ?? []),
  ]);

  for (const ref of dataFolderRefs) {
    if (ref === "package-lock.json") {
      continue;
    }

    if (ref === "gig-file-attachments") {
      storeRefs.push("data/gig-file-attachments");
      continue;
    }

    if (relativePath.startsWith("data/")) {
      continue;
    }

    const candidate = `data/${ref}`;
    storeRefs.push(candidate);
  }

  return uniqueSorted(storeRefs.filter((ref) => ref.startsWith("data/")));
}

function trimLabel(value, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatModuleLinks(relativePaths) {
  if (relativePaths.length === 0) {
    return "None";
  }

  return relativePaths.map((relativePath) => `\`${relativePath}\``).join(", ");
}

function formatStoreLinks(relativePaths) {
  if (relativePaths.length === 0) {
    return "None";
  }

  return relativePaths.map((relativePath) => `\`${relativePath}\``).join(", ");
}

function asTable(rows, headers) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const dataLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separatorLine, ...dataLines].join("\n");
}

function htmlList(items, className = "") {
  if (items.length === 0) {
    return `<p class="${className} empty">None</p>`;
  }

  return `<ul class="${className}">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function htmlBadges(items) {
  if (items.length === 0) {
    return '<span class="muted">None</span>';
  }

  return items
    .map((item) => `<span class="badge">${escapeHtml(item)}</span>`)
    .join("");
}

const allFiles = uniqueSorted(
  (
    await Promise.all(
      sourceDirectories.map(async (relativeDirectory) => {
        if (!(await pathExists(path.join(projectRoot, relativeDirectory)))) {
          return [];
        }

        return collectFiles(relativeDirectory);
      }),
    )
  ).flat(),
);

const sourceFiles = allFiles.filter((relativePath) =>
  sourceExtensions.includes(path.posix.extname(relativePath)),
);

const fileEntries = [];

for (const relativePath of sourceFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  const content = await fs.readFile(absolutePath, "utf8");
  const className = classifySourceFile(relativePath, content);
  const specifiers = extractModuleSpecifiers(content);
  const internalImports = uniqueSorted(
    (
      await Promise.all(
        specifiers.map((specifier) => resolveModuleSpecifier(relativePath, specifier)),
      )
    ).filter(Boolean),
  );

  fileEntries.push({
    relativePath,
    absolutePath,
    content,
    className,
    route:
      className === "page"
        ? buildPageRoute(relativePath)
        : className === "apiRoute"
          ? buildApiRoute(relativePath)
          : "",
    apiPaths: extractApiPaths(content),
    exportedFunctions: extractExportedFunctionNames(content),
    directStoreRefs: extractStoreReferences(relativePath, content),
    internalImports,
  });
}

const fileMap = new Map(fileEntries.map((entry) => [entry.relativePath, entry]));

function gatherTransitive(relativePath, visitor, seen = new Set()) {
  if (seen.has(relativePath)) {
    return;
  }

  seen.add(relativePath);
  const entry = fileMap.get(relativePath);

  if (!entry) {
    return;
  }

  visitor(entry);

  for (const importedPath of entry.internalImports) {
    gatherTransitive(importedPath, visitor, seen);
  }
}

for (const entry of fileEntries) {
  const transitiveStores = new Set(entry.directStoreRefs);
  const transitiveApiPaths = new Set(entry.apiPaths);
  const transitiveLibs = new Set();
  const transitiveComponents = new Set();
  const transitiveDataModules = new Set();
  const transitiveTypes = new Set();

  gatherTransitive(entry.relativePath, (dependency) => {
    for (const storeRef of dependency.directStoreRefs) {
      transitiveStores.add(storeRef);
    }

    for (const apiPath of dependency.apiPaths) {
      transitiveApiPaths.add(apiPath);
    }

    if (dependency.relativePath !== entry.relativePath) {
      if (dependency.className === "lib") {
        transitiveLibs.add(dependency.relativePath);
      }

      if (dependency.className === "component") {
        transitiveComponents.add(dependency.relativePath);
      }

      if (dependency.className === "dataModule" || dependency.className === "jsonData") {
        transitiveDataModules.add(dependency.relativePath);
      }

      if (dependency.className === "type") {
        transitiveTypes.add(dependency.relativePath);
      }
    }
  });

  entry.transitiveStoreRefs = uniqueSorted([...transitiveStores]);
  entry.transitiveApiPaths = uniqueSorted([...transitiveApiPaths]);
  entry.transitiveLibs = uniqueSorted([...transitiveLibs]);
  entry.transitiveComponents = uniqueSorted([...transitiveComponents]);
  entry.transitiveDataModules = uniqueSorted([...transitiveDataModules]);
  entry.transitiveTypes = uniqueSorted([...transitiveTypes]);
}

const inboundDependents = new Map();
for (const entry of fileEntries) {
  for (const importedPath of entry.internalImports) {
    if (!inboundDependents.has(importedPath)) {
      inboundDependents.set(importedPath, new Set());
    }

    inboundDependents.get(importedPath).add(entry.relativePath);
  }
}

const pageEntries = fileEntries.filter((entry) => entry.className === "page");
const platformPages = pageEntries.filter(
  (entry) =>
    entry.relativePath.startsWith("app/(platform)/") ||
    entry.relativePath === "app/page.tsx" ||
    entry.relativePath === "app/login/page.tsx",
);
const staffAppPages = pageEntries.filter((entry) => entry.relativePath.startsWith("app/staff-app/"));
const apiEntries = fileEntries.filter((entry) => entry.className === "apiRoute");
const actionEntries = fileEntries.filter((entry) => entry.className === "action");
const libEntries = fileEntries.filter((entry) => entry.className === "lib");
const componentEntries = fileEntries.filter((entry) => entry.className === "component");
const jsonDataEntries = fileEntries.filter((entry) => entry.className === "jsonData");

const topConnectedEntries = [...fileEntries]
  .map((entry) => ({
    relativePath: entry.relativePath,
    className: entry.className,
    inboundCount: inboundDependents.get(entry.relativePath)?.size ?? 0,
    outboundCount: entry.internalImports.length,
  }))
  .filter((entry) => entry.inboundCount > 0)
  .sort((left, right) => {
    if (right.inboundCount !== left.inboundCount) {
      return right.inboundCount - left.inboundCount;
    }

    if (right.outboundCount !== left.outboundCount) {
      return right.outboundCount - left.outboundCount;
    }

    return left.relativePath.localeCompare(right.relativePath);
  })
  .slice(0, 20);

const apiCallSites = fileEntries
  .filter((entry) => entry.apiPaths.length > 0)
  .map((entry) => ({
    relativePath: entry.relativePath,
    apiPaths: entry.apiPaths,
  }))
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

const dataStoreInventory = uniqueSorted([
  ...jsonDataEntries.map((entry) => entry.relativePath),
  ...libEntries.flatMap((entry) => entry.directStoreRefs),
  ...libEntries.flatMap((entry) => entry.transitiveStoreRefs),
]).map((storePath) => {
  const owningLibs = libEntries
    .filter((entry) => entry.directStoreRefs.includes(storePath))
    .map((entry) => entry.relativePath);
  const consumers = fileEntries
    .filter((entry) => entry.transitiveStoreRefs.includes(storePath))
    .map((entry) => entry.relativePath);

  return {
    storePath,
    owningLibs: uniqueSorted(owningLibs),
    consumerCount: consumers.length,
    representativeConsumers: consumers.slice(0, 6),
  };
});

const routeRows = (entries) =>
  entries
    .sort((left, right) => left.route.localeCompare(right.route))
    .map((entry) => ({
      route: entry.route,
      file: entry.relativePath,
      directComponents: entry.internalImports.filter((item) => item.startsWith("components/")),
      directLibs: entry.internalImports.filter((item) => item.startsWith("lib/")),
      actions: entry.internalImports.filter((item) => item.startsWith("app/") && /actions?\.tsx?$/.test(path.posix.basename(item))),
      stores: entry.transitiveStoreRefs,
      apiPaths: entry.transitiveApiPaths,
    }));

const apiRows = apiEntries
  .sort((left, right) => left.route.localeCompare(right.route))
  .map((entry) => ({
    route: entry.route,
    file: entry.relativePath,
    directLibs: entry.internalImports.filter((item) => item.startsWith("lib/")),
    directTypes: entry.internalImports.filter((item) => item.startsWith("types/")),
    stores: entry.transitiveStoreRefs,
    exportedFunctions: entry.exportedFunctions,
  }));

const actionRows = actionEntries
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  .map((entry) => ({
    file: entry.relativePath,
    exportedFunctions: entry.exportedFunctions,
    directLibs: entry.internalImports.filter((item) => item.startsWith("lib/")),
    stores: entry.transitiveStoreRefs,
  }));

const generatedAt = new Date().toLocaleString("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

const summaryStats = [
  { label: "Source files analysed", value: String(sourceFiles.length) },
  { label: "Platform pages", value: String(platformPages.length) },
  { label: "Staff-app pages", value: String(staffAppPages.length) },
  { label: "API routes", value: String(apiEntries.length) },
  { label: "Server action files", value: String(actionEntries.length) },
  { label: "Reusable components", value: String(componentEntries.length) },
  { label: "Service/store libs", value: String(libEntries.length) },
  { label: "JSON-backed data stores", value: String(jsonDataEntries.length) },
];

const highLevelFindings = [
  "This workspace is a single Next.js App Router application that contains two product surfaces: an SCM admin platform and a standalone mobile staff app.",
  "Persistence is file-backed. Business data, sessions, templates, and settings are stored under `data/` and wrapped by service-style modules in `lib/`.",
  "The most connected layer is `lib/`, which acts as the boundary between routes/components and JSON stores, PDFs, attachment folders, and access-control logic.",
  "The gig domain is the central integration point. Gigs connect to shifts, time reports, closeout, files, temporary managers, search indexing, and staff-app visibility windows.",
  "System settings drive downstream behavior. Updated policy/template/SCM-info stores are read again by API routes, PDF builders, and staff-app guide surfaces.",
];

const markdownSections = [];

markdownSections.push("# SCM App Architecture Report");
markdownSections.push("");
markdownSections.push(`Generated: ${generatedAt}`);
markdownSections.push("");
markdownSections.push(`Workspace: \`${projectRoot}\``);
markdownSections.push("");
markdownSections.push("## Executive Summary");
markdownSections.push("");
for (const finding of highLevelFindings) {
  markdownSections.push(`- ${finding}`);
}

markdownSections.push("");
markdownSections.push("## At A Glance");
markdownSections.push("");
markdownSections.push(
  asTable(
    summaryStats.map((stat) => [stat.label, stat.value]),
    ["Metric", "Value"],
  ),
);

markdownSections.push("");
markdownSections.push("## Layer Model");
markdownSections.push("");
markdownSections.push("```text");
markdownSections.push("App Router pages/layouts/actions");
markdownSections.push("        ↓");
markdownSections.push("Shared UI components");
markdownSections.push("        ↓");
markdownSections.push("lib/ service + policy + store wrappers");
markdownSections.push("        ↓");
markdownSections.push("data/*.json, public assets, generated PDF buffers, attachment folders");
markdownSections.push("```");

markdownSections.push("");
markdownSections.push("## Domain Connections");
markdownSections.push("");
for (const domain of domainDefinitions) {
  const existingPaths = domain.paths.filter((relativePath) =>
    fileMap.has(relativePath) || pathExists(path.join(projectRoot, relativePath)),
  );

  markdownSections.push(`### ${domain.title}`);
  markdownSections.push("");
  markdownSections.push(domain.summary);
  markdownSections.push("");
  markdownSections.push("Connected files and stores:");
  markdownSections.push("");
  for (const relativePath of existingPaths) {
    markdownSections.push(`- \`${relativePath}\``);
  }
  markdownSections.push("");
}

markdownSections.push("## Platform Route Inventory");
markdownSections.push("");
markdownSections.push(
  asTable(
    routeRows(platformPages).map((row) => [
      `\`${row.route}\``,
      `\`${row.file}\``,
      trimLabel(formatModuleLinks(row.directComponents), 90),
      trimLabel(formatModuleLinks(row.directLibs.concat(row.actions)), 90),
      trimLabel(formatStoreLinks(row.stores), 90),
      trimLabel(formatModuleLinks(row.apiPaths), 70),
    ]),
    ["Route", "Page File", "Direct UI", "Direct Services / Actions", "Transitive Stores", "API Usage"],
  ),
);

markdownSections.push("");
markdownSections.push("## Staff-App Route Inventory");
markdownSections.push("");
markdownSections.push(
  asTable(
    routeRows(staffAppPages).map((row) => [
      `\`${row.route}\``,
      `\`${row.file}\``,
      trimLabel(formatModuleLinks(row.directComponents), 90),
      trimLabel(formatModuleLinks(row.directLibs.concat(row.actions)), 90),
      trimLabel(formatStoreLinks(row.stores), 90),
      trimLabel(formatModuleLinks(row.apiPaths), 70),
    ]),
    ["Route", "Page File", "Direct UI", "Direct Services / Actions", "Transitive Stores", "API Usage"],
  ),
);

markdownSections.push("");
markdownSections.push("## API Route Inventory");
markdownSections.push("");
markdownSections.push(
  asTable(
    apiRows.map((row) => [
      `\`${row.route}\``,
      `\`${row.file}\``,
      trimLabel(formatModuleLinks(row.directLibs), 100),
      trimLabel(formatModuleLinks(row.directTypes), 80),
      trimLabel(formatStoreLinks(row.stores), 100),
      trimLabel(formatModuleLinks(row.exportedFunctions), 60),
    ]),
    ["Endpoint", "Handler File", "Direct Lib Dependencies", "Direct Types", "Transitive Stores", "Exported Handlers"],
  ),
);

markdownSections.push("");
markdownSections.push("## Server Actions");
markdownSections.push("");
markdownSections.push(
  asTable(
    actionRows.map((row) => [
      `\`${row.file}\``,
      trimLabel(formatModuleLinks(row.exportedFunctions), 70),
      trimLabel(formatModuleLinks(row.directLibs), 100),
      trimLabel(formatStoreLinks(row.stores), 100),
    ]),
    ["Action File", "Exported Functions", "Direct Lib Dependencies", "Transitive Stores"],
  ),
);

markdownSections.push("");
markdownSections.push("## JSON Store Inventory");
markdownSections.push("");
markdownSections.push(
  asTable(
    dataStoreInventory.map((row) => [
      `\`${row.storePath}\``,
      trimLabel(formatModuleLinks(row.owningLibs), 90),
      String(row.consumerCount),
      trimLabel(formatModuleLinks(row.representativeConsumers), 100),
    ]),
    ["Store", "Owning Libs", "Consumer Count", "Representative Consumers"],
  ),
);

markdownSections.push("");
markdownSections.push("## Most Connected Internal Modules");
markdownSections.push("");
markdownSections.push(
  asTable(
    topConnectedEntries.map((row) => [
      `\`${row.relativePath}\``,
      row.className,
      String(row.inboundCount),
      String(row.outboundCount),
    ]),
    ["Module", "Category", "Imported By", "Direct Imports"],
  ),
);

markdownSections.push("");
markdownSections.push("## Internal API Call Sites");
markdownSections.push("");
markdownSections.push(
  asTable(
    apiCallSites.map((row) => [
      `\`${row.relativePath}\``,
      trimLabel(formatModuleLinks(row.apiPaths), 120),
    ]),
    ["Source File", "Referenced /api Paths"],
  ),
);

markdownSections.push("");
markdownSections.push("## Observations");
markdownSections.push("");
markdownSections.push("- The route tree has grown beyond the original README summary; the current app includes a richer admin platform, a staff app, and many API endpoints.");
markdownSections.push("- Several domains are intentionally prototype-first. The frontend is operationally detailed, but persistence is still local JSON rather than a database or external backend.");
markdownSections.push("- The same staff profile data is reused in multiple contexts: People, shift assignment, temporary gig-manager sharing, staff-app accounts, attendance, and document generation.");
markdownSections.push("- PDF generation is local and template-driven. System settings update template JSON, then route handlers and PDF utilities regenerate document payloads on demand.");

const markdown = markdownSections.join("\n");

function buildStatsGrid() {
  return summaryStats
    .map(
      (stat) => `
        <div class="stat-card">
          <div class="stat-value">${escapeHtml(stat.value)}</div>
          <div class="stat-label">${escapeHtml(stat.label)}</div>
        </div>
      `,
    )
    .join("");
}

function buildDomainCards() {
  return domainDefinitions
    .map((domain) => {
      const items = domain.paths.filter((relativePath) =>
        fileMap.has(relativePath) || relativePath === "data/gig-file-attachments",
      );

      return `
        <section class="domain-card">
          <h3>${escapeHtml(domain.title)}</h3>
          <p>${escapeHtml(domain.summary)}</p>
          ${htmlList(items.map((item) => `<code>${escapeHtml(item)}</code>`), "compact-list")}
        </section>
      `;
    })
    .join("");
}

function buildRouteTable(rows, title) {
  return `
    <section class="report-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Route</th>
              <th>File</th>
              <th>Direct UI</th>
              <th>Direct Services / Actions</th>
              <th>Transitive Stores</th>
              <th>API Usage</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><code>${escapeHtml(row.route)}</code></td>
                    <td><code>${escapeHtml(row.file)}</code></td>
                    <td>${htmlBadges(row.directComponents)}</td>
                    <td>${htmlBadges([...row.directLibs, ...row.actions])}</td>
                    <td>${htmlBadges(row.stores)}</td>
                    <td>${htmlBadges(row.apiPaths)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function buildSimpleTable(title, columns, rows) {
  return `
    <section class="report-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    ${row
                      .map((cell) => `<td>${cell}</td>`)
                      .join("")}
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SCM App Architecture Report</title>
    <style>
      :root { color-scheme: light; --ink: #172033; --muted: #5e687e; --line: #d5dce8; --soft: #eef3f9; --brand: #0f5d73; --brand-2: #e3f1f4; --paper: #ffffff; }
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: var(--ink); background: linear-gradient(180deg, #f7fbfd 0%, #ffffff 16%); font-size: 11px; line-height: 1.45; }
      code { font-family: Consolas, "Courier New", monospace; font-size: 0.94em; }
      .page { padding: 10px 0 24px; }
      .hero { border: 1px solid var(--line); background: radial-gradient(circle at top right, rgba(15, 93, 115, 0.12), transparent 32%), linear-gradient(135deg, rgba(227, 241, 244, 0.75), rgba(255, 255, 255, 0.98)); border-radius: 18px; padding: 22px 24px; margin-bottom: 18px; }
      .eyebrow { margin: 0 0 8px; color: var(--brand); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.05; }
      h2 { margin: 0 0 10px; font-size: 18px; }
      h3 { margin: 0 0 8px; font-size: 14px; }
      p { margin: 0 0 10px; }
      .meta { display: flex; gap: 16px; flex-wrap: wrap; color: var(--muted); }
      .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
      .stat-card { border: 1px solid var(--line); background: var(--paper); border-radius: 14px; padding: 14px 12px; }
      .stat-value { font-size: 22px; font-weight: 700; color: var(--brand); }
      .stat-label { margin-top: 4px; color: var(--muted); }
      .report-section { margin-bottom: 18px; }
      .callout { border-left: 4px solid var(--brand); background: var(--soft); padding: 12px 14px; border-radius: 0 14px 14px 0; }
      .layer-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
      .layer-box { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: var(--paper); }
      .layer-box strong { display: block; margin-bottom: 4px; color: var(--brand); }
      .domain-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .domain-card { border: 1px solid var(--line); border-radius: 14px; background: var(--paper); padding: 14px; }
      .compact-list { margin: 8px 0 0; padding-left: 18px; }
      .compact-list li { margin-bottom: 4px; }
      .table-wrap { overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; padding: 8px 9px; }
      th { background: #f5f8fc; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
      tr:last-child td { border-bottom: none; }
      .badge { display: inline-block; margin: 0 4px 4px 0; padding: 3px 7px; border-radius: 999px; background: var(--brand-2); color: var(--brand); font-size: 10px; word-break: break-word; }
      .muted, .empty { color: var(--muted); }
      .findings { margin: 0; padding-left: 18px; }
      .findings li { margin-bottom: 6px; }
      .footer-note { margin-top: 8px; color: var(--muted); font-size: 10px; }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <p class="eyebrow">SCM Platform Prototype</p>
        <h1>Internal Connections And App Structure</h1>
        <p>This report inventories the current workspace, maps the major module connections, and summarizes how routes, components, APIs, stores, and generated documents work together.</p>
        <div class="meta">
          <span><strong>Generated:</strong> ${escapeHtml(generatedAt)}</span>
          <span><strong>Workspace:</strong> ${escapeHtml(projectRoot)}</span>
        </div>
      </section>
      <section class="report-section">
        <h2>Executive Summary</h2>
        <div class="callout">
          <ul class="findings">${highLevelFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>
        </div>
      </section>
      <section class="report-section"><h2>At A Glance</h2><div class="stats-grid">${buildStatsGrid()}</div></section>
      <section class="report-section">
        <h2>Layer Model</h2>
        <div class="layer-strip">
          <div class="layer-box"><strong>Route Surface</strong><span>App Router pages, layouts, route handlers, and server actions in <code>app/</code>.</span></div>
          <div class="layer-box"><strong>Reusable UI</strong><span>Shared platform and staff-app components in <code>components/</code>.</span></div>
          <div class="layer-box"><strong>Business Services</strong><span>Session, policy, storage, access, and domain helpers in <code>lib/</code>.</span></div>
          <div class="layer-box"><strong>Persistence + Assets</strong><span>JSON stores in <code>data/</code>, attachment folders, public files, and on-demand PDF buffers.</span></div>
        </div>
      </section>
      <section class="report-section"><h2>Domain Connections</h2><div class="domain-grid">${buildDomainCards()}</div></section>
      ${buildRouteTable(routeRows(platformPages), "Platform Route Inventory")}
      ${buildRouteTable(routeRows(staffAppPages), "Staff-App Route Inventory")}
      ${buildSimpleTable("API Route Inventory", ["Endpoint", "Handler File", "Direct Lib Dependencies", "Direct Types", "Transitive Stores", "Exported Handlers"], apiRows.map((row) => [`<code>${escapeHtml(row.route)}</code>`, `<code>${escapeHtml(row.file)}</code>`, htmlBadges(row.directLibs), htmlBadges(row.directTypes), htmlBadges(row.stores), htmlBadges(row.exportedFunctions)]))}
      ${buildSimpleTable("Server Actions", ["Action File", "Exported Functions", "Direct Lib Dependencies", "Transitive Stores"], actionRows.map((row) => [`<code>${escapeHtml(row.file)}</code>`, htmlBadges(row.exportedFunctions), htmlBadges(row.directLibs), htmlBadges(row.stores)]))}
      ${buildSimpleTable("JSON Store Inventory", ["Store", "Owning Libs", "Consumer Count", "Representative Consumers"], dataStoreInventory.map((row) => [`<code>${escapeHtml(row.storePath)}</code>`, htmlBadges(row.owningLibs), `<strong>${escapeHtml(String(row.consumerCount))}</strong>`, htmlBadges(row.representativeConsumers)]))}
      ${buildSimpleTable("Most Connected Internal Modules", ["Module", "Category", "Imported By", "Direct Imports"], topConnectedEntries.map((row) => [`<code>${escapeHtml(row.relativePath)}</code>`, escapeHtml(row.className), `<strong>${escapeHtml(String(row.inboundCount))}</strong>`, escapeHtml(String(row.outboundCount))]))}
      ${buildSimpleTable("Internal API Call Sites", ["Source File", "Referenced /api Paths"], apiCallSites.map((row) => [`<code>${escapeHtml(row.relativePath)}</code>`, htmlBadges(row.apiPaths)]))}
      <section class="report-section">
        <h2>Observations</h2>
        <div class="callout">
          <ul class="findings">
            <li>The current app structure is considerably broader than the original README route list: the workspace now includes admin operations, staff self-service, document generation, and configurable system settings.</li>
            <li>Most critical state flows through <code>lib/</code> first, which makes that folder the clearest integration boundary if the app is later migrated from JSON stores to a backend service.</li>
            <li>The same gig data appears in several downstream systems: search results, shift staffing, time-report generation, closeout, temporary-manager visibility, and staff-app managed gig cards.</li>
            <li>Several routes are protected by role-aware wrappers in <code>lib/auth-session.ts</code> and <code>lib/platform-access.ts</code>, so authorization is not only page-based but also domain-object based.</li>
          </ul>
        </div>
        <p class="footer-note">This report is generated from the current workspace by scanning routes, modules, direct imports, transitive store usage, and internal <code>/api</code> references.</p>
      </section>
    </main>
  </body>
</html>
`;

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(markdownOutputPath, markdown, "utf8");
await fs.writeFile(htmlOutputPath, html, "utf8");

console.log(JSON.stringify({
  markdownOutputPath,
  htmlOutputPath,
  sourceFileCount: sourceFiles.length,
  pageCount: pageEntries.length,
  apiRouteCount: apiEntries.length,
}, null, 2));
