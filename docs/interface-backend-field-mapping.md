# Interface to Backend Field Mapping

Den har genomgangen ar baserad pa nuvarande frontend i denna workspace och backend-koden i `scm-dashboard-main/backend`.

## Backend som redan finns

- Auth:
  - `POST /api/auth/login`
- User:
  - `POST /api/user/create`
  - `POST /api/user/create/admin`
  - `GET /api/user/me`
  - `GET /api/user/all`
  - `GET /api/user/all/{status}`
  - `GET /api/user/{email}`
  - flera statusandringar via `approve`, `reject`, `block`, `deactivate`
- Modeller som finns:
  - `User`
  - `UserAwaitingConfirmation`
  - `EmployeeProfile`
  - `UserEmployeeRole`
  - `EmployeeRole`
  - `ProfileComment`
  - `Document`
  - `Country`
  - `Region`

## Viktig slutsats

Backenden har idag tydligt stod for:

- anvandare och inloggning
- land och region
- roller och approvals
- profilmetadata och dokument

Backenden har idag inte nagon tydlig modell for:

- gig
- shift
- booking
- contracts
- payslips
- payroll
- messages
- attendance/time entries

Det betyder att `People` och `Profile` redan kan kopplas ganska naturligt mot backend, medan `Gigs`, `Gig detail`, `Shift detail` och storre delen av `New Gig` fortfarande ar frontend/prototypdata.

## Mapping: top bar / current user

| Interface | Frontend idag | Backend-falt |
| --- | --- | --- |
| Profilnamn uppe till hoger | `Edwin Jones` | `UserResponse.firstName` + `UserResponse.lastName` |
| Profilroll uppe till hoger | `Admin` | `UserEmployeeRole.employeeRole` / `EmployeeRole.name` / `EmployeeRoleCode` |
| Hamta aktuell anvandare | profilchip | `GET /api/user/me` |

## Mapping: People-sidan

Kalla i frontend:

- `app/(platform)/people/page.tsx`
- `data/scm-data.ts`
- `types/scm.ts`

Mappning:

| Interface-falt | Backend-falt / modell | Kommentar |
| --- | --- | --- |
| `name` | `User.firstName` + `User.lastName` | UI har ett sammanslaget namn, backend lagrar separat fornamn/efternamn |
| `email` | `User.email` | Finns i backend men visas inte just nu i People-listan |
| `phone` | `User.phoneNumber` | Vid create byggs den fran `phoneLanguageCode` + `phoneNumber` i `UserRequest` |
| `country` | `UserRequest.countryId`, `UserAwaitingConfirmation.pendingCountryId`, `EmployeeProfile.mainCountry` | Skapa user anvander `countryId`; senare profil kan peka pa `mainCountry` |
| `region` | `UserRequest.regionId`, `UserAwaitingConfirmation.pendingRegionId`, `EmployeeProfile.mainRegion` | Samma monster som ovan fast region |
| `roles` | `UserEmployeeRole.employeeRole` | Kan mappas till `EmployeeRole.name` eller `EmployeeRoleCode` |
| `approvalStatus` | `User.status` | UI-status maste oversattas fran backendstatus |
| `Approved` | `APPROVED` | Direkt match |
| `Applicant` | `PENDING` | Rimlig matchning for People-vyn |
| `Archived` | ingen exakt 1:1 | Trolig UX-mappning blir `DEACTIVATED`, alternativt `BLOCKED` eller `REJECTED` beroende pa vad ni menar med archived |
| `Pending approvals` | `GET /api/user/all/PENDING` | Matchar applicants efter att emailbekraftelse ar klar |
| `priority` | ingen backendmodell hittad | Finns bara i frontend just nu |
| `availability` | ingen backendmodell hittad | Finns bara i frontend just nu |

## Mapping: Profile-sidan

Kalla i frontend:

- `app/(platform)/profile/page.tsx`

Mappning:

| Interface-del | Backend-falt / modell | Kommentar |
| --- | --- | --- |
| `Profile image` | `EmployeeProfile.profilePhotoDoc` -> `Document` | Direkt match |
| `Contact details` | `User.email`, `User.firstName`, `User.lastName`, `User.phoneNumber` | Direkt match for basuppgifter |
| `Country / Region` | `EmployeeProfile.mainCountry`, `EmployeeProfile.mainRegion` | Finns i backend men visas inte explicit pa profilsidan an |
| `Bank details` | `EmployeeProfile.bankAccountClearingNumberEncrypted`, `EmployeeProfile.bankAccountNumberEncrypted` | Direkt match pa entitetsniva |
| `Bank account name` | finns i migration `V13`, men saknas i `EmployeeProfile`-entiteten | Bra kandidat for backend-justering senare |
| `Bank name` | finns i migration `V13`, men saknas i `EmployeeProfile`-entiteten | Bra kandidat for backend-justering senare |
| `Personal number` | `EmployeeProfile.personalNumberEncrypted` | Finns i backend men syns inte i UI an |
| `Profile approved` | `EmployeeProfile.profileApproved` | Bra for admin/approval-UI senare |
| `Profile comments` | `ProfileComment.comment` | Bra for intern granskningsyta |
| `History and documents` | `Document` | Generic dokumentmodell finns |
| `Own bookings` | ingen backendmodell hittad | Saknas an |
| `Own contracts` | ingen backendmodell hittad | Saknas an |
| `Own payslips` | ingen backendmodell hittad | Saknas an |
| `Own completed gigs` | ingen backendmodell hittad | Saknas an |
| `Driver license` | ingen backendmodell hittad | Saknas an |
| `Allergies` | ingen backendmodell hittad | Saknas an |
| `Policy confirmations` | ingen backendmodell hittad | Saknas an |

## Mapping: New Gig-sidan

Kalla i frontend:

- `app/(platform)/gigs/new/page.tsx`

Nuvarande lage:

- Jag hittade inga backendmodeller, DTO:er eller migreringar for gig eller shift.
- Det betyder att nastan alla falt pa `New Gig` fortfarande ar utan riktig backendmotsvarighet.

Falt som redan kan knytas till nagot i backend:

| Interface-falt | Backend-falt / modell | Kommentar |
| --- | --- | --- |
| `Country` | `Country` | Kan fyllas fran backendlista av lander nar en endpoint finns |
| `City` | ingen direkt modell | Eventuellt fri text tills egen venue/gig-modell finns |
| `SCM representative` | `User` + `UserEmployeeRole` | Kan sannolikt valjas bland interna users senare |
| `Merch representative` | `User` eller separat framtida kontaktmodell | Inte tydligt definierat i backend an |

Falt utan backendstod idag:

- Artist
- Arena
- Date
- Promoter
- Merch company
- Tickets sold
- Estimated spend per visitor
- Arena notes
- Security setup
- General comments
- utrustningsrutorna som `Card terminals`, `Registers`, `Tents`, `Tables`, `Hotel`, `Transport`

## Mapping: Gig- och Shift-detaljer

Kallor i frontend:

- `app/(platform)/gigs/[gigId]/page.tsx`
- `app/(platform)/gigs/[gigId]/shifts/[shiftId]/page.tsx`
- `types/scm.ts`

Status just nu:

- `Gig`
- `Shift`
- `Assignment`
- `BookingStatus`
- `GigStatus`

finns bara i frontendprototypen och i `data/scm-data.ts`.

Det finns ingen tydlig backendmotsvarighet an for:

- gig overview
- shift overview
- assigned staff per gig
- waitlist
- time tracking
- contract status
- reports / closeout
- sales estimate

Det enda som redan kan ateranvandas nar dessa delar byggs pa riktigt ar person- och rollinformationen:

- staff/person -> `User`
- role -> `EmployeeRole` / `UserEmployeeRole`
- country/region-filtering -> `Country`, `Region`, `EmployeeProfile.mainCountry`, `EmployeeProfile.mainRegion`

## Rekommenderad praktisk mappning framover

Nar vi borjar koppla frontend mot backend hade jag utgatt fran detta:

1. `People` kopplas forst till `UserResponse` och `RegistrationStatus`.
2. `Profile` kopplas sedan till `User`, `EmployeeProfile`, `Document` och `ProfileComment`.
3. `New Gig`, `Gig detail` och `Shift detail` far tills vidare ligga kvar pa mockdata tills en riktig gig/shift-domans finns i backend.

## Notering om en backend-avvikelse

`EmployeeProfile`-entiteten och databasmigreringen verkar inte vara helt synkade.

Migreringen `V13__create_document_employee_profile_and_profile_comment_tables.sql` innehaller:

- `bank_account_name_encrypted`
- `bank_account_bank_name_encrypted`

men dessa falt finns inte i nuvarande `EmployeeProfile.java`.

Det ar inte blockerande for frontend-mappningen just nu, men det ar bra att kanna till innan vi bygger profile/bank-formular pa riktigt.
