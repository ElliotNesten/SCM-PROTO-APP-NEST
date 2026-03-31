# SCM App Architecture Report

Generated: 30 Mar 2026, 20:04

Workspace: `C:\Users\Anton\OneDrive\Desktop\SCM PLATFORM PROTOTYP`

## Executive Summary

- This workspace is a single Next.js App Router application that contains two product surfaces: an SCM admin platform and a standalone mobile staff app.
- Persistence is file-backed. Business data, sessions, templates, and settings are stored under `data/` and wrapped by service-style modules in `lib/`.
- The most connected layer is `lib/`, which acts as the boundary between routes/components and JSON stores, PDFs, attachment folders, and access-control logic.
- The gig domain is the central integration point. Gigs connect to shifts, time reports, closeout, files, temporary managers, search indexing, and staff-app visibility windows.
- System settings drive downstream behavior. Updated policy/template/SCM-info stores are read again by API routes, PDF builders, and staff-app guide surfaces.

## At A Glance

| Metric | Value |
| --- | --- |
| Source files analysed | 179 |
| Platform pages | 15 |
| Staff-app pages | 28 |
| API routes | 24 |
| Server action files | 5 |
| Reusable components | 42 |
| Service/store libs | 31 |
| JSON-backed data stores | 17 |

## Layer Model

```text
App Router pages/layouts/actions
        ↓
Shared UI components
        ↓
lib/ service + policy + store wrappers
        ↓
data/*.json, public assets, generated PDF buffers, attachment folders
```

## Domain Connections

### Authentication And Session Control

The platform and the staff app both use file-backed session stores. Platform auth can also elevate approved staff accounts into temporary gig-manager sessions when linked gig access exists.

Connected files and stores:

- `app/auth-actions.ts`
- `app/login/page.tsx`
- `app/staff-app/actions.ts`
- `app/staff-app/login/page.tsx`
- `lib/auth-session.ts`
- `lib/staff-app-session.ts`
- `lib/scm-staff-store.ts`
- `lib/staff-app-store.ts`
- `lib/password-utils.ts`
- `data/auth-sessions.json`
- `data/staff-app-sessions.json`
- `data/scm-staff-store.json`
- `data/staff-app-account-store.json`

### Gig And Shift Operations

Gigs are the central operational entity. Gig routes fan out into overview editing, file management, shift planning, report documents, closeout, and temporary manager sharing. Shift state automatically syncs against gig creation and teardown.

Connected files and stores:

- `app/(platform)/gigs/page.tsx`
- `app/(platform)/gigs/new/page.tsx`
- `app/(platform)/gigs/new/actions.ts`
- `app/(platform)/gigs/[gigId]/page.tsx`
- `app/(platform)/gigs/[gigId]/shifts/[shiftId]/page.tsx`
- `components/gig-overview-editor.tsx`
- `components/gig-files-manager.tsx`
- `components/gig-shifts-panel.tsx`
- `components/gig-report-documents.tsx`
- `components/gig-report-closeout-panel.tsx`
- `lib/gig-store.ts`
- `lib/shift-store.ts`
- `lib/gig-time-report-store.ts`
- `lib/gig-closeout.ts`
- `lib/gig-file-storage.ts`
- `lib/shift-communication-store.ts`
- `data/gig-store.json`
- `data/shift-store.json`
- `data/shift-communication-store.json`
- `data/gig-file-attachments`

### People, Profiles, And SCM Staff Administration

The admin platform keeps two distinct people models: operational staff profiles in the People directory and internal SCM platform users in the SCM Staff area. Access control, search visibility, and scope rules are layered on top of those two stores.

Connected files and stores:

- `app/(platform)/people/page.tsx`
- `app/(platform)/people/new/page.tsx`
- `app/(platform)/people/new/actions.ts`
- `app/(platform)/people/[personId]/page.tsx`
- `app/(platform)/profile/page.tsx`
- `app/(platform)/scm-staff/page.tsx`
- `app/(platform)/scm-staff/new/page.tsx`
- `app/(platform)/scm-staff/new/actions.ts`
- `app/(platform)/scm-staff/[personId]/page.tsx`
- `components/staff-profile-editor.tsx`
- `components/scm-staff-profile-editor.tsx`
- `components/staff-documents-panel.tsx`
- `components/scm-role-permission-guide.tsx`
- `lib/staff-store.ts`
- `lib/staff-document-store.ts`
- `lib/scm-staff-store.ts`
- `lib/platform-access.ts`
- `types/scm-rbac.ts`
- `types/staff-role.ts`
- `data/staff-store.json`
- `data/staff-document-store.json`
- `data/scm-staff-store.json`
- `data/old-staff-documents.json`

### Staff App Experience

The standalone mobile staff app is a second product surface inside the same Next.js project. It pulls from shared gig and staff data, then layers its own account, attendance, application, and guide stores on top.

Connected files and stores:

- `app/staff-app/(protected)/layout.tsx`
- `app/staff-app/(protected)/home/page.tsx`
- `app/staff-app/(protected)/gigs/page.tsx`
- `app/staff-app/(protected)/schedule/page.tsx`
- `app/staff-app/(protected)/documents/page.tsx`
- `app/staff-app/(protected)/messages/page.tsx`
- `app/staff-app/(protected)/profile/page.tsx`
- `components/staff-app/mobile-shell.tsx`
- `components/staff-app/gig-flow.tsx`
- `components/staff-app/documents-browser.tsx`
- `components/staff-app/colleague-directory.tsx`
- `lib/staff-app-data.ts`
- `lib/staff-app-store.ts`
- `lib/staff-app-session.ts`
- `lib/staff-app-attendance-store.ts`
- `lib/staff-app-gig-application-store.ts`
- `lib/staff-app-guides.ts`
- `data/staff-app-account-store.json`
- `data/staff-app-sessions.json`
- `data/staff-app-attendance-store.json`
- `data/staff-app-gig-application-store.json`

### System Settings, Search, And PDF Generation

Search, policy content, SCM info, and generated PDFs are all configurable from within the app. The system-settings area updates JSON-backed templates that are then consumed by API routes and PDF builders.

Connected files and stores:

- `app/(platform)/system-settings/page.tsx`
- `components/global-search.tsx`
- `components/system-settings-policy-uploader.tsx`
- `components/system-settings-scm-info-editor.tsx`
- `components/system-settings-template-editor.tsx`
- `app/api/search/route.ts`
- `app/api/staff-app/policy-pdf/route.ts`
- `app/api/system-settings/policy/route.ts`
- `app/api/system-settings/scm-info/route.ts`
- `app/api/system-settings/scm-info-pdfs/route.ts`
- `app/api/system-settings/templates/route.ts`
- `lib/global-search.ts`
- `lib/system-policy-store.ts`
- `lib/system-scm-info-store.ts`
- `lib/system-scm-info-pdf-store.ts`
- `lib/system-template-store.ts`
- `lib/staff-document-pdf.ts`
- `lib/staff-app-policy-pdf.ts`
- `data/system-policy-store.json`
- `data/system-scm-info-store.json`
- `data/system-scm-info-pdf-store.json`
- `data/system-template-store.json`

## Platform Route Inventory

| Route | Page File | Direct UI | Direct Services / Actions | Transitive Stores | API Usage |
| --- | --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` | None | `lib/auth-session.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | None |
| `/dashboard` | `app/(platform)/dashboard/page.tsx` | None | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | None |
| `/gigs` | `app/(platform)/gigs/page.tsx` | `components/gig-register-client.tsx` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | `/api/gigs/` |
| `/gigs/[gigId]` | `app/(platform)/gigs/[gigId]/page.tsx` | `components/detail-tabs.tsx`, `components/gig-delete-action.tsx`, `components/gig-files-m… | `lib/auth-session.ts`, `lib/gig-archive.ts`, `lib/gig-closeout.ts`, `lib/gig-store.ts`, `… | `data/auth-sessions.json`, `data/gig-file-attachments`, `data/gig-store.json`, `data/old-… | `/api/gigs/`, `/api/staff/` |
| `/gigs/[gigId]/shifts/[shiftId]` | `app/(platform)/gigs/[gigId]/shifts/[shiftId]/page.tsx` | `components/detail-tabs.tsx`, `components/page-header.tsx`, `components/shift-overview-ed… | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/shift-store.ts`… | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | `/api/gigs/` |
| `/gigs/new` | `app/(platform)/gigs/new/page.tsx` | `components/equipment-section.tsx`, `components/gig-document-boxes.tsx`, `components/note… | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/scandinavian-co… | `data/auth-sessions.json`, `data/gig-file-attachments`, `data/gig-store.json`, `data/old-… | `/api/gigs/` |
| `/login` | `app/login/page.tsx` | `components/login-password-field.tsx` | `lib/auth-session.ts`, `lib/brand-store.ts`, `app/auth-actions.ts` | `data/auth-sessions.json`, `data/brand-store.json`, `data/gig-store.json`, `data/old-staf… | None |
| `/people` | `app/(platform)/people/page.tsx` | `components/page-header.tsx`, `components/staff-region-edit-filter.tsx`, `components/stat… | `lib/auth-session.ts`, `lib/platform-access.ts`, `lib/staff-store.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | None |
| `/people/[personId]` | `app/(platform)/people/[personId]/page.tsx` | `components/staff-profile-editor.tsx` | `lib/auth-session.ts`, `lib/platform-access.ts`, `lib/staff-app-store.ts`, `lib/staff-doc… | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | `/api/staff/` |
| `/people/new` | `app/(platform)/people/new/page.tsx` | `components/page-header.tsx` | `lib/auth-session.ts`, `lib/platform-access.ts`, `app/(platform)/people/new/actions.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | None |
| `/profile` | `app/(platform)/profile/page.tsx` | `components/page-header.tsx`, `components/scm-staff-profile-editor.tsx` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | `/api/scm-staff/` |
| `/scm-staff` | `app/(platform)/scm-staff/page.tsx` | `components/page-header.tsx`, `components/scm-role-permission-guide.tsx`, `components/sta… | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/scm-staff-store… | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | None |
| `/scm-staff/[personId]` | `app/(platform)/scm-staff/[personId]/page.tsx` | `components/scm-staff-profile-editor.tsx` | `lib/auth-session.ts`, `lib/scm-staff-store.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | `/api/scm-staff/` |
| `/scm-staff/new` | `app/(platform)/scm-staff/new/page.tsx` | `components/page-header.tsx` | `lib/auth-session.ts`, `app/(platform)/scm-staff/new/actions.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | None |
| `/system-settings` | `app/(platform)/system-settings/page.tsx` | `components/page-header.tsx`, `components/system-settings-policy-uploader.tsx`, `componen… | `lib/auth-session.ts`, `lib/system-policy-store.ts`, `lib/system-scm-info-pdf-store.ts`, … | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/… | `/api/staff-app/policy-pdf`, `/api/system-settings/policy`, `/api/sys… |

## Staff-App Route Inventory

| Route | Page File | Direct UI | Direct Services / Actions | Transitive Stores | API Usage |
| --- | --- | --- | --- | --- | --- |
| `/staff-app` | `app/staff-app/page.tsx` | None | `lib/staff-app-session.ts` | `data/staff-app-account-store.json`, `data/staff-app-sessions.json` | None |
| `/staff-app/check-in` | `app/staff-app/(protected)/check-in/page.tsx` | None | `lib/staff-app-attendance-store.ts`, `lib/staff-app-data.ts`, `lib/staff-app-session.ts`,… | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/colleagues` | `app/staff-app/(protected)/colleagues/page.tsx` | `components/staff-app/colleague-directory.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/colleagues/[colleagueId]` | `app/staff-app/(protected)/colleagues/[colleagueId]/page.tsx` | None | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/documents` | `app/staff-app/(protected)/documents/page.tsx` | `components/staff-app/documents-browser.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/documents/payslips/[payslipId]` | `app/staff-app/(protected)/documents/payslips/[payslipId]/page.tsx` | None | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/gigs` | `app/staff-app/(protected)/gigs/page.tsx` | `components/staff-app/gig-flow.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/gigs/[passId]` | `app/staff-app/(protected)/gigs/[passId]/page.tsx` | `components/staff-app/gig-flow.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-gig-application-store.ts`, `lib/staff-app-session… | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/gigs/managed` | `app/staff-app/(protected)/gigs/managed/page.tsx` | `components/staff-app/gig-flow.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/gigs/open` | `app/staff-app/(protected)/gigs/open/page.tsx` | `components/staff-app/gig-flow.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/gigs/standby` | `app/staff-app/(protected)/gigs/standby/page.tsx` | `components/staff-app/gig-flow.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/gigs/unassigned` | `app/staff-app/(protected)/gigs/unassigned/page.tsx` | `components/staff-app/gig-flow.tsx` | `lib/staff-app-data.ts`, `lib/staff-app-session.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/home` | `app/staff-app/(protected)/home/page.tsx` | None | `lib/staff-app-attendance-store.ts`, `lib/staff-app-data.ts`, `lib/staff-app-scope.ts`, `… | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/login` | `app/staff-app/login/page.tsx` | None | `app/staff-app/actions.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/messages` | `app/staff-app/(protected)/messages/page.tsx` | None | `lib/staff-app-data.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/messages/[threadId]` | `app/staff-app/(protected)/messages/[threadId]/page.tsx` | None | `lib/staff-app-data.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/passes` | `app/staff-app/(protected)/passes/page.tsx` | None | None | None | None |
| `/staff-app/profile` | `app/staff-app/(protected)/profile/page.tsx` | None | `lib/staff-app-scope.ts`, `lib/staff-app-session.ts`, `app/staff-app/actions.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/profile/bank-info` | `app/staff-app/(protected)/profile/bank-info/page.tsx` | None | `lib/staff-app-session.ts`, `lib/staff-store.ts`, `app/staff-app/actions.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/profile/personal-details` | `app/staff-app/(protected)/profile/personal-details/page.tsx` | None | `lib/staff-app-session.ts`, `lib/staff-store.ts`, `app/staff-app/actions.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/schedule` | `app/staff-app/(protected)/schedule/page.tsx` | None | `lib/staff-app-data.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |
| `/staff-app/scm-info` | `app/staff-app/(protected)/scm-info/page.tsx` | None | `lib/system-policy-store.ts`, `lib/system-scm-info-pdf-store.ts`, `lib/system-scm-info-st… | `data/system-policy-store.json`, `data/system-scm-info-pdf-store.json`, `data/system-scm-… | `/api/staff-app/policy-pdf` |
| `/staff-app/scm-info/arena-info` | `app/staff-app/(protected)/scm-info/arena-info/page.tsx` | `components/staff-app/arena-directory.tsx`, `components/staff-app/guide-pdf-link.tsx`, `c… | `lib/gig-store.ts`, `lib/staff-app-session.ts`, `lib/system-scm-info-pdf-shared.ts`, `lib… | `data/gig-store.json`, `data/staff-app-account-store.json`, `data/staff-app-sessions.json… | None |
| `/staff-app/scm-info/cash-card` | `app/staff-app/(protected)/scm-info/cash-card/page.tsx` | `components/staff-app/guide-disclosure-list.tsx`, `components/staff-app/guide-pdf-link.ts… | `lib/system-scm-info-pdf-shared.ts`, `lib/system-scm-info-pdf-store.ts`, `lib/system-scm-… | `data/system-scm-info-pdf-store.json`, `data/system-scm-info-store.json` | None |
| `/staff-app/scm-info/checklists` | `app/staff-app/(protected)/scm-info/checklists/page.tsx` | `components/staff-app/guide-disclosure-list.tsx`, `components/staff-app/guide-pdf-link.ts… | `lib/system-scm-info-pdf-shared.ts`, `lib/system-scm-info-pdf-store.ts`, `lib/system-scm-… | `data/system-scm-info-pdf-store.json`, `data/system-scm-info-store.json` | None |
| `/staff-app/scm-info/platform-info` | `app/staff-app/(protected)/scm-info/platform-info/page.tsx` | `components/staff-app/guide-disclosure-list.tsx`, `components/staff-app/guide-pdf-link.ts… | `lib/system-scm-info-pdf-shared.ts`, `lib/system-scm-info-pdf-store.ts`, `lib/system-scm-… | `data/system-scm-info-pdf-store.json`, `data/system-scm-info-store.json` | None |
| `/staff-app/scm-info/roles-training` | `app/staff-app/(protected)/scm-info/roles-training/page.tsx` | `components/staff-app/guide-disclosure-list.tsx`, `components/staff-app/guide-pdf-link.ts… | `lib/staff-app-scope.ts`, `lib/staff-app-session.ts`, `lib/system-scm-info-pdf-shared.ts`… | `data/staff-app-account-store.json`, `data/staff-app-sessions.json`, `data/system-scm-inf… | None |
| `/staff-app/shifts/[shiftId]` | `app/staff-app/(protected)/shifts/[shiftId]/page.tsx` | None | `lib/staff-app-attendance-store.ts`, `lib/staff-app-data.ts` | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/st… | `/api/staff/` |

## API Route Inventory

| Endpoint | Handler File | Direct Lib Dependencies | Direct Types | Transitive Stores | Exported Handlers |
| --- | --- | --- | --- | --- | --- |
| `/api/brand/logo` | `app/api/brand/logo/route.ts` | `lib/auth-session.ts`, `lib/brand-store.ts` | None | `data/auth-sessions.json`, `data/brand-store.json`, `data/gig-store.json`, `data/NextResponse.json`… | `POST` |
| `/api/gigs/[gigId]` | `app/api/gigs/[gigId]/route.ts` | `lib/auth-session.ts`, `lib/gig-archive.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/sca… | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `PATCH` |
| `/api/gigs/[gigId]/closeout` | `app/api/gigs/[gigId]/closeout/route.ts` | `lib/auth-session.ts`, `lib/gig-closeout.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `PATCH`, `POST` |
| `/api/gigs/[gigId]/equipment` | `app/api/gigs/[gigId]/equipment/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | `types/scm.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `POST` |
| `/api/gigs/[gigId]/files` | `app/api/gigs/[gigId]/files/route.ts` | `lib/auth-session.ts`, `lib/gig-document-boxes.ts`, `lib/gig-file-storage.ts`, `lib/gig-store.ts`, … | `types/scm.ts` | `data/auth-sessions.json`, `data/gig-file-attachments`, `data/gig-store.json`, `data/NextResponse.j… | `DELETE`, `POST` |
| `/api/gigs/[gigId]/files/[fileId]/content` | `app/api/gigs/[gigId]/files/[fileId]/content/route.ts` | `lib/auth-session.ts`, `lib/gig-file-storage.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | None | `data/auth-sessions.json`, `data/gig-file-attachments`, `data/gig-store.json`, `data/NextResponse.j… | `GET` |
| `/api/gigs/[gigId]/folders` | `app/api/gigs/[gigId]/folders/route.ts` | `lib/auth-session.ts`, `lib/gig-document-boxes.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `POST` |
| `/api/gigs/[gigId]/image` | `app/api/gigs/[gigId]/image/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `POST` |
| `/api/gigs/[gigId]/shift-communications` | `app/api/gigs/[gigId]/shift-communications/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/shift-communication-store… | `types/scm.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `GET`, `POST` |
| `/api/gigs/[gigId]/shifts` | `app/api/gigs/[gigId]/shifts/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/shift-store.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `POST` |
| `/api/gigs/[gigId]/shifts/[shiftId]` | `app/api/gigs/[gigId]/shifts/[shiftId]/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/gig-time-report-store.ts`, `lib/platform-access.ts`… | `types/scm.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `PATCH` |
| `/api/gigs/[gigId]/temporary-managers` | `app/api/gigs/[gigId]/temporary-managers/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/platform-access.ts`, `lib/staff-app-store.ts`, `lib… | `types/scm.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `POST` |
| `/api/gigs/[gigId]/time-report` | `app/api/gigs/[gigId]/time-report/route.ts` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/gig-time-report-store.ts`, `lib/platform-access.ts`… | `types/scm.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `POST` |
| `/api/scm-staff/[personId]` | `app/api/scm-staff/[personId]/route.ts` | `lib/auth-session.ts`, `lib/password-utils.ts`, `lib/scm-staff-store.ts` | `types/scm-rbac.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `PATCH` |
| `/api/scm-staff/[personId]/image` | `app/api/scm-staff/[personId]/image/route.ts` | `lib/scm-staff-store.ts` | None | `data/NextResponse.json`, `data/scm-staff-store.json` | `POST` |
| `/api/search` | `app/api/search/route.ts` | `lib/auth-session.ts`, `lib/global-search.ts`, `lib/platform-access.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `GET` |
| `/api/staff-app/policy-pdf` | `app/api/staff-app/policy-pdf/route.ts` | `lib/staff-app-policy-pdf.ts`, `lib/system-policy-store.ts` | None | `data/system-policy-store.json` | `GET` |
| `/api/staff/[personId]` | `app/api/staff/[personId]/route.ts` | `lib/staff-app-store.ts`, `lib/staff-store.ts` | `types/backend.ts`, `types/scm.ts`, `types/staff-role.ts` | `data/NextResponse.json`, `data/old-staff-documents.json`, `data/request.json`, `data/staff-app-acc… | `DELETE`, `PATCH` |
| `/api/staff/[personId]/documents/[documentId]` | `app/api/staff/[personId]/documents/[documentId]/route.ts` | `lib/staff-document-pdf.ts`, `lib/staff-document-store.ts` | None | `data/NextResponse.json`, `data/staff-document-store.json`, `data/system-template-store.json` | `GET` |
| `/api/staff/[personId]/image` | `app/api/staff/[personId]/image/route.ts` | `lib/staff-store.ts` | None | `data/NextResponse.json`, `data/old-staff-documents.json`, `data/staff-document-store.json`, `data/… | `POST` |
| `/api/system-settings/policy` | `app/api/system-settings/policy/route.ts` | `lib/auth-session.ts`, `lib/system-policy-store.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `GET`, `POST` |
| `/api/system-settings/scm-info` | `app/api/system-settings/scm-info/route.ts` | `lib/auth-session.ts`, `lib/system-scm-info-store.ts` | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `GET`, `PATCH` |
| `/api/system-settings/scm-info-pdfs` | `app/api/system-settings/scm-info-pdfs/route.ts` | `lib/auth-session.ts`, `lib/system-scm-info-pdf-shared.ts`, `lib/system-scm-info-pdf-store.ts`, `li… | None | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `DELETE`, `GET`, `PATCH`, `POST` |
| `/api/system-settings/templates` | `app/api/system-settings/templates/route.ts` | `lib/auth-session.ts`, `lib/system-template-store.ts` | `types/system-settings.ts` | `data/auth-sessions.json`, `data/gig-store.json`, `data/NextResponse.json`, `data/old-staff-documen… | `GET`, `PATCH` |

## Server Actions

| Action File | Exported Functions | Direct Lib Dependencies | Transitive Stores |
| --- | --- | --- | --- |
| `app/(platform)/gigs/new/actions.ts` | `saveProjectManagerStep`, `submitNewGig` | `lib/gig-store.ts`, `lib/scandinavian-countries.ts` | `data/gig-store.json` |
| `app/(platform)/people/new/actions.ts` | `submitNewStaff` | `lib/staff-app-store.ts`, `lib/staff-store.ts` | `data/old-staff-documents.json`, `data/staff-app-account-store.json`, `data/staff-document-store.js… |
| `app/(platform)/scm-staff/new/actions.ts` | `submitNewScmStaff` | `lib/password-utils.ts`, `lib/scm-staff-store.ts` | `data/scm-staff-store.json` |
| `app/auth-actions.ts` | `loginWithScmStaff`, `logoutCurrentUser`, `switchScmStaffSession` | `lib/auth-session.ts`, `lib/gig-store.ts`, `lib/password-utils.ts`, `lib/scm-staff-store.ts`, `lib/… | `data/auth-sessions.json`, `data/gig-store.json`, `data/old-staff-documents.json`, `data/scm-staff-… |
| `app/staff-app/actions.ts` | `applyToStaffAppGigPass`, `changeStaffAppPassword`, `checkInToStaffAp… | `lib/staff-app-attendance-store.ts`, `lib/staff-app-data.ts`, `lib/staff-app-gig-application-store.… | `data/gig-store.json`, `data/old-staff-documents.json`, `data/shift-store.json`, `data/staff-app-ac… |

## JSON Store Inventory

| Store | Owning Libs | Consumer Count | Representative Consumers |
| --- | --- | --- | --- |
| `data/auth-sessions.json` | `lib/auth-session.ts` | 38 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |
| `data/brand-store.json` | `lib/brand-store.ts` | 5 | `app/(platform)/layout.tsx`, `app/api/brand/logo/route.ts`, `app/login/page.tsx`, `components/platf… |
| `data/gig-file-attachments` | `lib/gig-file-storage.ts` | 8 | `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/new/page.tsx`, `app/api/gigs/[gigId]/f… |
| `data/gig-store.json` | `lib/gig-store.ts` | 70 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |
| `data/old-staff-documents.json` | `lib/staff-store.ts` | 72 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |
| `data/scm-staff-store.json` | `lib/scm-staff-store.ts` | 41 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |
| `data/shift-communication-store.json` | `lib/shift-communication-store.ts` | 4 | `app/(platform)/gigs/[gigId]/page.tsx`, `app/api/gigs/[gigId]/route.ts`, `app/api/gigs/[gigId]/shif… |
| `data/shift-store.json` | `lib/shift-store.ts` | 34 | `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[gigId]/shifts/[shiftId]/page.tsx`, `a… |
| `data/staff-app-account-store.json` | `lib/staff-app-store.ts` | 36 | `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/layout.tsx`, `app/(platform)/people/[person… |
| `data/staff-app-attendance-store.json` | `lib/staff-app-attendance-store.ts` | 14 | `app/(platform)/gigs/[gigId]/page.tsx`, `app/api/gigs/[gigId]/shifts/[shiftId]/route.ts`, `app/api/… |
| `data/staff-app-gig-application-store.json` | `lib/staff-app-gig-application-store.ts` | 8 | `app/staff-app/(protected)/check-in/page.tsx`, `app/staff-app/(protected)/gigs/[passId]/page.tsx`, … |
| `data/staff-app-sessions.json` | `lib/staff-app-session.ts` | 22 | `app/staff-app/(protected)/check-in/page.tsx`, `app/staff-app/(protected)/colleagues/[colleagueId]/… |
| `data/staff-document-store.json` | `lib/staff-document-store.ts` | 74 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |
| `data/staff-store.json` | `lib/staff-store.ts` | 72 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |
| `data/system-policy-store.json` | `lib/system-policy-store.ts` | 5 | `app/(platform)/system-settings/page.tsx`, `app/api/staff-app/policy-pdf/route.ts`, `app/api/system… |
| `data/system-scm-info-pdf-store.json` | `lib/system-scm-info-pdf-store.ts` | 9 | `app/(platform)/system-settings/page.tsx`, `app/api/system-settings/scm-info-pdfs/route.ts`, `app/s… |
| `data/system-scm-info-store.json` | `lib/system-scm-info-store.ts` | 14 | `app/(platform)/system-settings/page.tsx`, `app/api/system-settings/scm-info-pdfs/route.ts`, `app/a… |
| `data/system-template-store.json` | `lib/system-template-store.ts` | 76 | `app/(platform)/dashboard/page.tsx`, `app/(platform)/gigs/[gigId]/page.tsx`, `app/(platform)/gigs/[… |

## Most Connected Internal Modules

| Module | Category | Imported By | Direct Imports |
| --- | --- | --- | --- |
| `types/scm.ts` | type | 40 | 0 |
| `lib/auth-session.ts` | lib | 37 | 5 |
| `lib/gig-store.ts` | lib | 26 | 3 |
| `lib/platform-access.ts` | lib | 24 | 2 |
| `lib/staff-app-data.ts` | lib | 21 | 7 |
| `lib/staff-app-session.ts` | lib | 20 | 1 |
| `lib/staff-store.ts` | lib | 19 | 5 |
| `data/scm-data.ts` | dataModule | 14 | 2 |
| `lib/system-scm-info-store.ts` | lib | 12 | 2 |
| `components/page-header.tsx` | component | 11 | 0 |
| `types/scm-rbac.ts` | type | 10 | 0 |
| `types/staff-app.ts` | type | 10 | 0 |
| `components/status-badge.tsx` | component | 9 | 1 |
| `lib/system-scm-info-pdf-shared.ts` | lib | 9 | 1 |
| `lib/staff-app-store.ts` | lib | 8 | 4 |
| `lib/system-scm-info-pdf-store.ts` | lib | 8 | 2 |
| `lib/shift-store.ts` | lib | 7 | 6 |
| `lib/scm-staff-store.ts` | lib | 7 | 3 |
| `app/staff-app/actions.ts` | action | 6 | 6 |
| `components/staff-app/gig-flow.tsx` | component | 6 | 2 |

## Internal API Call Sites

| Source File | Referenced /api Paths |
| --- | --- |
| `app/staff-app/(protected)/scm-info/page.tsx` | `/api/staff-app/policy-pdf` |
| `components/brand-logo-uploader.tsx` | `/api/brand/logo` |
| `components/gig-delete-action.tsx` | `/api/gigs/` |
| `components/gig-document-boxes.tsx` | `/api/gigs/` |
| `components/gig-equipment-editor.tsx` | `/api/gigs/` |
| `components/gig-image-uploader.tsx` | `/api/gigs/` |
| `components/gig-overview-editor.tsx` | `/api/gigs/` |
| `components/gig-register-client.tsx` | `/api/gigs/` |
| `components/gig-report-closeout-panel.tsx` | `/api/gigs/` |
| `components/gig-shifts-panel.tsx` | `/api/gigs/` |
| `components/gig-time-report-panel.tsx` | `/api/gigs/` |
| `components/global-search.tsx` | `/api/search` |
| `components/scm-staff-profile-editor.tsx` | `/api/scm-staff/` |
| `components/shift-booking-manager.tsx` | `/api/gigs/` |
| `components/shift-overview-editor.tsx` | `/api/gigs/` |
| `components/staff-documents-panel.tsx` | `/api/staff/` |
| `components/staff-profile-editor.tsx` | `/api/staff/` |
| `components/system-settings-policy-uploader.tsx` | `/api/staff-app/policy-pdf`, `/api/system-settings/policy` |
| `components/system-settings-scm-info-editor.tsx` | `/api/staff-app/policy-pdf`, `/api/system-settings/scm-info`, `/api/system-settings/scm-info-pdfs` |
| `components/system-settings-template-editor.tsx` | `/api/system-settings/templates` |
| `lib/gig-file-storage.ts` | `/api/gigs/` |
| `lib/staff-app-data.ts` | `/api/staff/` |

## Observations

- The route tree has grown beyond the original README summary; the current app includes a richer admin platform, a staff app, and many API endpoints.
- Several domains are intentionally prototype-first. The frontend is operationally detailed, but persistence is still local JSON rather than a database or external backend.
- The same staff profile data is reused in multiple contexts: People, shift assignment, temporary gig-manager sharing, staff-app accounts, attendance, and document generation.
- PDF generation is local and template-driven. System settings update template JSON, then route handlers and PDF utilities regenerate document payloads on demand.