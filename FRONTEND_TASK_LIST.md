# EduFlow Frontend Task List & Backend Integration Audit (`Tution-saas-FE`)

> **Scope:** Complete codebase audit of `Tution-saas-FE` mapped against the verified `Tution-saas-BE` REST API contracts (`/api`, default `http://localhost:4000/api`) across all **16 assigned tasks** (`~40+ hrs` estimated).

---

## 1. Executive Codebase Audit

### Current Architecture Summary
| Layer | Current State in `Tution-saas-FE` | Readiness vs. `Tution-saas-BE` |
|---|---|---|
| **Routing** | `src/App.tsx` uses `HashRouter` with `/dashboard/*` routes under `DashboardLayout`. | No auth guard / login gate yet; `Sidebar.tsx` (`L100`) & `Topbar.tsx` (`L184`) show demo logout toasts. |
| **HTTP / API Client** | **Does not exist.** `src/lib/repository.ts` (`L1-15`) is an unused generic interface comment. `vite.config.ts` has no `/api` proxy. | **Missing:** Base URL config (`VITE_API_BASE_URL`), `credentials: 'include'` + `Authorization: Bearer` support, `{ success, message, data }` unwrapping, and `{ success: false, message, details }` validation error parsing. |
| **State & Persistence** | `src/hooks/useAppData.tsx` (`L65-214`) holds all 7 domains (`students`, `teachers`, `modules`, `attendance`, `transactions`, `classes`, `notices`) in local `useState` seeded from `src/data/mock/index.ts`. | **Mock-only:** Synchronous local mutations, zero loading/error states, zero server pagination, and client-side cross-entity calculations (`feeMap`, `paidMap`, `outstanding`). |
| **Domain Constants** | `BATCHES`, `INCOME_CATEGORIES`, `EXPENSE_CATEGORIES`, `PAYMENT_METHODS` live inside `src/data/mock/index.ts` (`L13-24`). | Categories & payment methods match backend constants verbatim, but must be moved out of `mock/` into `src/lib/constants.ts`. |
| **Types** | `src/types/index.ts` (`L1-92`) defines basic entities (`Student`, `Teacher`, `Module`, `AttendanceRecord`, `Transaction`, `OnlineClass`, `Notice`). | **Gaps/Mismatches:** Missing `pending` on `StudentStatus`, missing `qrPayload`/`qrRotatedAt`/profile sub-objects, missing enriched `Module` fields (`teacher`, `enrolledCount`, `revenuePotential`, `enrolledStudents`), missing `Notification` types, missing API/pagination envelopes. |
| **Table & Overlay Primitives** | `src/components/ui/data-table.tsx` (`L37-47`) uses TanStack Table with client-side sorting/pagination only. `src/components/ui/overlays.tsx` (`L106-154`) `ConfirmDialog` closes synchronously on confirm. | Must extend `DataTable` for server-side (`manualPagination`, `manualSorting`, `pageCount`, `total`, loading state) and `ConfirmDialog` for async delete loading/error handling. |

---

## 2. Critical FE ↔ BE Contract Mismatches Found

| # | Area | Current FE Code | Backend Contract (`Tution-saas-BE`) | Action Required |
|---|---|---|---|---|
| 1 | **Response Envelope** | Expects raw arrays/objects synchronously | Every response is `{ success, message, data, timestamp, path }`; errors are `{ success: false, message, details?: [{ field, message }] }` | Build central `apiFetch` interceptor/unwrapper + `ApiError` class with `details` field mapping. |
| 2 | **Record Payment Field** | `src/components/finance/RecordPaymentModal.tsx` (`L16, L29, L80`) & `src/hooks/useAppData.tsx` (`L23, L174-182`) use **`note`** | `POST /api/finance/student-payments` expects **`description`** (plus optional `category`) | Rename payload property `note` → `description` and align modal/DTO types. |
| 3 | **Student `pending` Status** | `src/types/index.ts` (`L3`), `StudentFormModal.tsx` (`L24, L40, L61-65`), `StudentsPage.tsx` (`L128-132`), and `StatusBadge` (`src/components/ui/primitives.tsx` `L70-76`) only support `active \| inactive \| graduated` | `GET /api/students` accepts `pending`; `POST /api/students` defaults to `status: "pending"` | Add `"pending"` to `StudentStatus`, form select (default `"pending"` on create), filter select, and `STATUS_TONE` (`pending: "amber"`). |
| 4 | **Server Pagination & Sorting** | `DataTable` (`src/components/ui/data-table.tsx`), `StudentsPage.tsx` (`L38-47`), `FinancePage.tsx` (`L39-45, L189, L194-195, L201`) filter/paginate/sort full arrays in memory | `GET /api/students`, `GET /api/finance/transactions`, and `GET /api/finance/student-payments` return `{ items, pagination: { total, page, limit, totalPages }, ... }` | Add manual pagination/sorting mode to `DataTable`, wire `page`/`limit`/`sortBy`/`sortOrder`, and map UI column IDs to backend `sortBy` enum. |
| 5 | **Student QR Reference & Rotation** | `StudentQRCard.tsx` (`L32`) generates `qrPayload(student.ref)` locally; no rotation UI exists | `GET /api/students/:id` returns `qrPayload` & `qrRotatedAt`; `POST /api/students/:id/rotate-qr` invalidates old QR | Render `student.qrPayload ?? qrPayload(student.ref)`, display `qrRotatedAt`, and add "Rotate QR" flow with confirmation. |
| 6 | **Finance Student Payments & Debtors** | `FinancePage.tsx` (`L45, L50, L197-217`) filters `transactions` by `category === "Tuition fees"` and slices top 20 computed debtors from mock `students` | `GET /api/finance/student-payments` supports `q`, `batch`, `status`, `debtorsOnly`, `includeGraduated`, `page`, `limit` and returns `{ items, pagination, summary }` | Replace local debtor computation with `GET /api/finance/student-payments` (filters, search, pagination, summary totals). |
| 7 | **Finance Excel Export** | `FinancePage.tsx` (`L83-94`) exports in-memory `filtered` rows | Once paginated (`GET /api/finance/transactions`), `filtered` only contains 1 page | On export, request all matching transactions for the active filter/period (e.g., dedicated unpaginated/high-`limit` fetch). |
| 8 | **PATCH Payload Leakage** | `TransactionFormModal.tsx` (`L36`) spreads `{ ...item, ...v }`; `ModulesPage.tsx` (`L188, L194`) spreads `{ ...detail, ... }`; `ModuleFormModal.tsx` (`L34`) spreads `{ ...item }` | `PATCH` endpoints expect DTO fields only (not enriched `teacher`, `enrolledCount`, `revenuePotential`, `enrolledStudents`, `id`, timestamps) | Construct explicit, clean DTO payloads for all `POST` and `PATCH` calls. |
| 9 | **`POST /api/modules` vs `GET /api/modules` Shape** | `ModulesPage.tsx` assumes every module resolves `getTeacher(m.teacherId)` & `enrolled(m.id)` locally | `GET /api/modules` includes `teacher: { id, fullName } \| null` and `enrolledCount`; `POST /api/modules` returns `teacherId` with **no nested `teacher` object** | Read `m.teacher?.fullName` / `m.enrolledCount` when present, and normalize or refetch list after `POST`/`PATCH`. |
| 10 | **Overview `timeline` & Div-by-Zero** | `OverviewPage.tsx` (`L68`) computes `activeStudents / students.length` (yields `NaN%` if `0`), ignores `timeline`, and computes all KPIs/charts client-side | `GET /api/overview` (or `/kpis-trends` & `/activity-feeds`) returns `summary`, `kpis`, `trends`, and `activityFeeds` including **`timeline`** | Switch to backend overview payload, guard zero denominators, and add the `timeline` activity feed UI. |
| 11 | **Online Classes Drag/Resize & Details** | `OnlineClassesPage.tsx` (`L48-52`) mutates optimistically with no revert; lacks `status`/`q`/`from`/`to` queries and read-only detail view | `GET /api/online-classes` supports `teacherId`, `moduleId`, `batch`, `status`, `from`, `to`, `q`; `GET /api/online-classes/:id`; `PATCH /api/online-classes/:id` | Add `info.revert()` on `PATCH` failure, add `status` + `q` + calendar `datesSet` `from`/`to` querying, and add Class Details drawer/modal. |
| 12 | **Notifications System** | `Topbar.tsx` (`L67-118`) fakes items from local `notices`/`classes`/`students`, always renders red dot (`L91`), always links to `/dashboard/notices` (`L103`), has no read/delete/create UI | Full CRUD + read state: `GET /api/notifications`, `POST /api/notifications`, `PATCH /api/notifications/read-all`, `PATCH /api/notifications/:id/read`, `DELETE /api/notifications/:id` | Replace mock memo with API state, render real `unreadCount` badge, type-based icons, `item.link` navigation, read/delete controls, and a notification creation/management view. |
| 13 | **Date Format Normalization** | Forms bind `YYYY-MM-DD` directly to `<Input type="date" />` (`StudentFormModal.tsx`, `TransactionFormModal.tsx`) | Mongo/NestJS APIs may return ISO-8601 timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`) for `dob`, `enrollmentDate`, `date` | Normalize date strings via `.slice(0, 10)` helper before setting `<Input type="date" />` defaults. |
| 14 | **Cross-Feature `Teachers` Lookup** | `ModuleFormModal.tsx` (`L24`), `ModulesPage.tsx` (`L52`), `ClassFormModal.tsx` (`L38`), `OnlineClassesPage.tsx` (`L22`) read `teachers` from mock `useAppData()` | Teacher dropdowns in Modules & Online Classes require live teacher IDs/names | Add lightweight `GET /api/teachers` lookup helper/hook so Module and Class filters/forms are not stuck on mock teacher IDs (`TCH-001`). |

---

## 3. Shared Foundation Prerequisites (Do Before / Alongside API Tasks)

Before wiring individual domain APIs, set up these shared building blocks so all 16 tasks remain consistent and free of duplicate fetch/error code:

- [ ] **Create Environment & Vite Proxy Config**
  - Create `.env.example` with `VITE_API_BASE_URL=http://localhost:4000/api`.
  - Update `vite.config.ts` (dev server `proxy: { '/api': 'http://localhost:4000' }`) while honoring `import.meta.env.VITE_API_BASE_URL` for `vite-plugin-singlefile` / standalone builds.
- [ ] **Create HTTP Client (`src/lib/api.ts`)**
  - Configure `credentials: "include"` on all requests + attach `Authorization: Bearer <token>` header when an auth token is present.
  - Unwrap `{ success: true, message, data, timestamp, path }` automatically and return `data` (with helper `apiRequestWithMeta` if `message` is needed for toasts).
  - Throw a typed `ApiError` (`status`, `message`, `details?: { field: string; message: string }[]`) on non-2xx or `success === false`.
  - Provide helper `applyApiValidationErrors(err, setError)` for `react-hook-form` + toast fallback.
- [ ] **Extract Domain Constants (`src/lib/constants.ts`)**
  - Move `BATCHES`, `INCOME_CATEGORIES`, `EXPENSE_CATEGORIES`, and `PAYMENT_METHODS` out of `src/data/mock/index.ts`.
  - Update imports across `StudentsPage.tsx`, `StudentFormModal.tsx`, `ModulesPage.tsx`, `ModuleFormModal.tsx`, `FinancePage.tsx`, `TransactionFormModal.tsx`, `RecordPaymentModal.tsx`, `OnlineClassesPage.tsx`, `ClassFormModal.tsx`, `NoticesPage.tsx`, `NoticeFormModal.tsx`, `AttendancePage.tsx`, `TeachersPage.tsx`, `TeacherFormModal.tsx`.
- [ ] **Update Shared Types (`src/types/index.ts`)**
  - Add `ApiResponse<T>`, `ApiErrorResponse`, `PaginationMeta`, `PaginatedResult<T>`.
  - Update `StudentStatus` to `"pending" | "active" | "inactive" | "graduated"` and `Student` / `StudentDetailResponse` (`qrPayload`, `qrRotatedAt`, `modules`, `feeTotal`, `paidTotal`, `outstanding`, `attendanceSummary`, `attendanceRecords`, `payments`).
  - Update `Module` / `ModuleListItem` / `ModuleDetailResponse` (`teacher?: { id: string; fullName: string } | null`, `enrolledCount?: number`, `revenuePotential`, `enrolledStudents`).
  - Add `OverviewResponse`, `FinanceKpis`, `FinanceChartsResponse`, `StudentPaymentSummary`, `StudentPaymentsListResponse`, `NotificationType`, `NotificationItem`, `NotificationsResponse`.
- [ ] **Upgrade Shared UI Primitives**
  - `src/components/ui/primitives.tsx` (`L70-76`): Add `pending: "amber"` to `STATUS_TONE` in `StatusBadge`; add reusable `Skeleton` / loading card helper if needed.
  - `src/components/ui/data-table.tsx` (`L18-126`): Add optional server-side props (`manualPagination`, `manualSorting`, `page`, `pageSize`, `total`, `totalPages`, `sorting`, `onPageChange`, `onSortingChange`, `loading`) without breaking existing client-side callers (`AttendancePage.tsx`).
  - `src/components/ui/overlays.tsx` (`L106-154`): Update `ConfirmDialog` to support `async onConfirm` + `loading` state so failed API deletes keep the dialog open or show feedback cleanly.
  - `src/lib/utils.ts`: Add `toDateInput(iso?: string)` (`iso ? iso.slice(0, 10) : ""`) and query-string builder `buildQuery(params)`.
- [ ] **Teacher Lookup Helper (`src/api/teachers.ts`)** *(dependency for Tasks 6 & 11–13)*
  - Provide `fetchTeachers()` (`GET /api/teachers`) so `ModulesPage`, `ModuleFormModal`, `OnlineClassesPage`, and `ClassFormModal` populate live teachers instead of mock `TCH-*` IDs.

---

## 4. Detailed Breakdown of Assigned Tasks (1–16)

---

### Task 1: Overview — Dashboard KPIs, charts, activity feed & API integration (3hrs)
**Target Endpoints:** `GET /api/overview` (and optional `GET /api/overview/kpis-trends`, `GET /api/overview/activity-feeds`)  
**Existing Files:**
- `src/pages/dashboard/OverviewPage.tsx` (`L1-217`)
- `src/components/dashboard/StatCard.tsx` (`L1-68`)
- `src/components/analytics/chartParts.tsx` (`L1-59`)

**Files to Create / Modify:**
- **Create:** `src/api/overview.ts` (typed `fetchOverview`, optional `fetchOverviewKpisTrends`, `fetchOverviewActivityFeeds`)
- **Modify:** `src/types/index.ts`, `src/pages/dashboard/OverviewPage.tsx`, `src/components/dashboard/StatCard.tsx`

**Actionable Subtasks:**
1. Remove `useAppData()` aggregation dependencies (`students`, `teachers`, `modules`, `attendance`, `transactions`, `classes`, `notices`, `outstanding`, `getStudent`, `getTeacher`) from `src/pages/dashboard/OverviewPage.tsx` (`L20-54`).
2. Wire `GET /api/overview` on mount (with option to refresh after quick-action payment or split-fetch `kpis-trends` + `activity-feeds` in parallel if preferred for progressive rendering).
3. Map `data.summary` (`classesToday`, `attendanceMarkedToday`, `studentsWithPendingFees`) into the Hero section (`OverviewPage.tsx:85-87`). Replace hardcoded `"Amara"` greeting (`L84`) with current user name if/when auth context exists, or keep clean configurable fallback.
4. Map `data.kpis` (`totalStudents`, `activeStudents`, `totalTeachers`, `activeModules`, `todayAttendance`, `monthlyIncome`, `monthlyExpenses`, `outstandingPayments`) into the 8 `StatCard`s (`L66-75`). Handle both scalar values and enriched `{ value, delta, ... }` backend objects, and guard zero-division (`students.length === 0` bug on `L68`) and empty sparkline arrays (`StatCard.tsx:50`).
5. Bind `data.trends.incomeVsExpenses`, `data.trends.studentEnrollment`, and `data.trends.attendancePercentage` directly to the Recharts `BarChart` (`L111`), `AreaChart` (`L147`), and `LineChart` (`L160`), replacing `monthly`, `enrollMonthly`, and `att14` client computations. Ensure empty-chart fallback states render cleanly when arrays are empty.
6. Bind `data.activityFeeds`:
   - `upcomingClasses` (`L121-139`) — verify teacher name field vs ID, keep join link (`c.link`).
   - `recentRegistrations` (`L171-182`) — link to `/dashboard/students?q=${s.id}`.
   - `recentPayments` (`L183-197`) — render student name directly from feed item instead of `getStudent(p.studentId)`.
   - `activeNotices` (`L198-211`) — render priority, expiry, batches (`All batches` when empty).
   - **`timeline` (NEW):** Add an Activity Timeline section/card in `OverviewPage.tsx` to render `activityFeeds.timeline` (which is returned by `GET /api/overview` and currently missing from the UI).
7. Pass `onDone={() => refetchOverview()}` to `<RecordPaymentModal />` (`L214`) so recording a payment from Hero Quick Actions immediately updates KPIs and `recentPayments`.
8. Add loading skeletons (KPI grid, charts, activity cards) and an error banner with Retry button.

**Verification Checklist:**
- [ ] `GET /api/overview` called once on load; zero reads from mock `useAppData()` in `OverviewPage.tsx`.
- [ ] All 8 KPI cards, 3 charts, Hero counters, and all 5 `activityFeeds` (`upcomingClasses`, `recentRegistrations`, `recentPayments`, `activeNotices`, `timeline`) render with real backend values.
- [ ] Empty dataset (`0` students / `0` classes / `0` attendance) renders `0` / `—` without `NaN%` or chart crashes.
- [ ] Recording a payment via Hero Quick Action refreshes `monthlyIncome`, `outstandingPayments`, and `recentPayments`.

---

### Task 2: Students — Student listing, search, filtering & pagination (2hrs)
**Target Endpoints:** `GET /api/students`  
**Existing Files:**
- `src/pages/dashboard/StudentsPage.tsx` (`L1-161`)
- `src/components/ui/data-table.tsx` (`L1-126`)

**Files to Create / Modify:**
- **Modify:** `src/pages/dashboard/StudentsPage.tsx`, `src/components/ui/data-table.tsx`, `src/components/ui/primitives.tsx`

**Actionable Subtasks:**
1. Replace client-side `useMemo` filtering (`StudentsPage.tsx:38-47`) with server-driven state: `q` (debounced ~300ms), `batch`, `moduleId`, `status`, `page` (1-based), `limit` (e.g., `8` or `10`), `sortBy`, `sortOrder`.
2. Sync initial `q` with URL query param `?q=` (`StudentsPage.tsx:20, 29-36`) so links from `OverviewPage` (`/dashboard/students?q=STU-...`) work automatically; reset `page = 1` whenever `q`, `batch`, `moduleId`, `status`, or sorting changes.
3. Add `"pending"` option to the Status filter `<Select>` (`StudentsPage.tsx:127-132`) and add `pending: "amber"` to `STATUS_TONE` in `src/components/ui/primitives.tsx` (`L70-76`).
4. Populate the Module filter `<Select>` (`L123-126`) from `GET /api/modules` instead of mock `useAppData().modules`.
5. Upgrade `DataTable` (`src/components/ui/data-table.tsx`) to support server-side pagination and sorting (`manualPagination`, `manualSorting`, `total`, `totalPages`, `pageIndex`, `onPaginationChange`, `onSortingChange`, `loading` state).
6. Map column definitions (`StudentsPage.tsx:49-104`) to backend `sortBy` enum (`fullName | id | batch | enrollmentDate | status | createdAt | feeTotal | paidTotal | outstanding`):
   - Set `id: "fullName"` (mapped to `fullName`), `accessorKey: "batch"`, `id: "enrollmentDate"`, `id: "outstanding"`, `accessorKey: "status"`.
   - Disable sorting (`enableSorting: false`) on `modules` and `actions` columns (not in backend `sortBy` enum).
   - Read `row.original.outstanding` directly from backend item (fallback `0`) instead of `useAppData().outstanding(s.id)`.
7. Update header counter (`StudentsPage.tsx:113`) to use `summary.total`, `summary.activeCount`, and `summary.filteredTotal` from `GET /api/students`.
8. Add loading state/skeleton and error state with retry inside the table card.

**Verification Checklist:**
- [ ] Typing in search, changing batch/module/status, clicking column headers, and changing pages trigger `GET /api/students` with exact query params (`q`, `batch`, `moduleId`, `status`, `page`, `limit`, `sortBy`, `sortOrder`).
- [ ] `pending` students appear in the list with an amber status badge and can be filtered via Status dropdown.
- [ ] Pagination bar shows accurate `Showing X–Y of summary.filteredTotal` and `page / totalPages` from server metadata.
- [ ] Navigating to `/dashboard/students?q=STU-2025-001` automatically runs the filtered API query.

---

### Task 3: Students — Student profile, create & edit workflows (3hrs)
**Target Endpoints:** `GET /api/students/:id`, `POST /api/students`, `PATCH /api/students/:id`  
**Existing Files:**
- `src/components/students/StudentDetail.tsx` (`L1-149`)
- `src/components/students/StudentFormModal.tsx` (`L1-92`)
- `src/pages/dashboard/StudentsPage.tsx` (`L137-144`)

**Files to Create / Modify:**
- **Modify:** `src/components/students/StudentDetail.tsx`, `src/components/students/StudentFormModal.tsx`, `src/pages/dashboard/StudentsPage.tsx`, `src/types/index.ts`

**Actionable Subtasks:**
1. **`StudentDetail.tsx` (Profile Drawer):**
   - Fetch full student profile via `GET /api/students/:id` whenever `studentId` opens/changes (with loading skeleton and error fallback + retry).
   - Reset active `tab` back to `"overview"` when `studentId` changes.
   - Render backend `modules` array (fallback to module map if only IDs are returned), `feeTotal`, `paidTotal`, and `outstanding` directly from the profile response (`L88-93`, `L127`) instead of `useAppData()`.
   - Render `attendanceSummary` (Rate, Present, Late, Absent) and `attendanceRecords` (`L98-121`), and `payments` (`L123-142`) directly from `GET /api/students/:id`.
   - Expose a `refreshKey` / `onRefresh` callback so recording a payment, editing the student, or rotating QR re-fetches `GET /api/students/:id`.
2. **`StudentFormModal.tsx` (Create & Edit Modal):**
   - Add `"pending"` to Zod `status` enum (`L24`), to the Status `<Select>` (`L61-65`), and set default create `status` to `"pending"` (`L40`) to match backend `POST /api/students`.
   - Add `key={item?.id ?? "new"}` (or `useEffect` `reset()`) on `<Inner />` and normalize date fields (`toDateInput(item.dob)`, `toDateInput(item.enrollmentDate)`) so switching between edit targets never leaves stale fields.
   - Load live module options from `GET /api/modules` instead of `useAppData().modules` (`L29`).
   - Replace `saveStudent()` (`L43`) with async `POST /api/students` (create) and `PATCH /api/students/:id` (edit) using exact DTO: `{ fullName, email, phone, dob, address, guardianName, guardianPhone, batch, moduleIds, enrollmentDate?, status? }`.
   - Add loading/disabled state on submit button, parse `ApiError.details` via `setError(field, { message })` onto form fields, and toast backend error messages on failure.
   - In `StudentsPage.tsx` (`L141`), when clicking Edit from `StudentDetail`, pass the fetched `StudentDetail` object (not `getStudent(id)` from current table page) so all fields are guaranteed present.
   - On save success, trigger `onSaved()` callback to refresh both `StudentsPage` list and `StudentDetail` if open.

**Verification Checklist:**
- [ ] Opening any row fetches `GET /api/students/:id` and displays live modules, fee totals, attendance summary/records, payment history, and QR tab.
- [ ] Creating a student defaults `status` to `"pending"`, calls `POST /api/students`, handles field validation errors from backend `details[]`, and refreshes the table.
- [ ] Editing a student calls `PATCH /api/students/:id` with clean DTO fields and updates both the table row and open profile drawer.
- [ ] Direct navigation to `/dashboard/students?new=1` loads live modules into `StudentFormModal` without empty module checkboxes.

---

### Task 4: Students — Student deletion, record payment, QR reference & email notification workflows (4hrs)
**Target Endpoints:** `DELETE /api/students/:id`, `POST /api/finance/student-payments`, `POST /api/students/:id/rotate-qr` (+ `POST /api/students` registration email feedback)  
**Existing Files:**
- `src/pages/dashboard/StudentsPage.tsx` (`L145-158`)
- `src/components/finance/RecordPaymentModal.tsx` (`L1-104`)
- `src/components/qr/StudentQRCard.tsx` (`L1-46`)
- `src/lib/qrcard.ts` (`L1-102`)
- `src/components/qr/ScanResult.tsx` (`L1-63`)

**Files to Create / Modify:**
- **Modify:** `src/pages/dashboard/StudentsPage.tsx`, `src/components/students/StudentDetail.tsx`, `src/components/finance/RecordPaymentModal.tsx`, `src/components/qr/StudentQRCard.tsx`, `src/lib/qrcard.ts`, `src/components/qr/ScanResult.tsx`, `src/components/students/StudentFormModal.tsx`

**Actionable Subtasks:**
1. **Student Deletion (`StudentsPage.tsx:146-158`):**
   - Wire `ConfirmDialog` `onConfirm` to `DELETE /api/students/:id` with async loading state (disable Cancel/Delete while deleting; keep dialog open or show error toast if request fails).
   - Update dialog copy (`L150`) to remove `"from the demo data"` and accurately state that attendance records are deleted while finance transactions are preserved.
   - On success, close `StudentDetail` if `detailId === delId`, and refetch the students list (if the last item on `page > 1` was deleted, step back to `page - 1`).
2. **Record Payment Workflow (`RecordPaymentModal.tsx`):**
   - **Fix field mismatch:** Replace `note` state/payload (`L16, L29, L80`) with **`description`** to match `POST /api/finance/student-payments` (`{ studentId, amount, method, category?, date?, description? }`).
   - Add optional `category` select defaulting to `"Tuition fees"` (from `INCOME_CATEGORIES`) if needed by front desk.
   - Remove `useAppData()` mock lookups (`L10, L18-20`). When opened with `studentId` (from `StudentDetail` or `FinancePage`), accept `studentSummary` prop or fetch `GET /api/students/:id` / `GET /api/finance/student-payments` so `feeTotal`, `paidTotal`, `outstanding`, and student dropdown options reflect live server balances!
   - Remove `<MockNote>` (`L82`) and `"demo entry"` toast copy (`L30`).
   - Submit via `POST /api/finance/student-payments`, handle loading/validation errors, and invoke `onDone(result)` so `StudentDetail`, `StudentsPage`, `OverviewPage`, and `FinancePage` refresh live balances.
3. **QR Reference, Card Export & Rotation (`StudentQRCard.tsx` & `qrcard.ts`):**
   - Update `StudentQRCard.tsx` (`L32`) to render `student.qrPayload ?? qrPayload(student.ref)` instead of always constructing `EDUFLOW:${ref}` locally, and display `qrRotatedAt` formatted date/time if available.
   - Add a **"Rotate QR"** button + confirmation dialog ("Rotating invalidates the student's existing printed/PDF QR card immediately") that calls `POST /api/students/:id/rotate-qr`, updates `qrPayload`/`qrRotatedAt`, and refreshes the QR canvas & student detail state.
   - Remove `<MockNote>` (`L41-43`) mentioning mock backend validation later.
   - Verify `downloadCardPng`, `downloadCardPdf`, `printCard` in `src/lib/qrcard.ts` draw from the updated `<QRCodeCanvas>` ref after QR rotation.
4. **Email Notification Workflow:**
   - Update `StudentFormModal.tsx` (`L44`) create success toast/banner to inform admin that the student was registered (status `pending`, QR generated) and a **registration email was sent** to `s.email` (or surface backend `message` from `POST /api/students` response).
   - Where payment or QR rotation triggers notifications/emails or status visibility, surface clear confirmation feedback in `StudentDetail.tsx` / `RecordPaymentModal.tsx` (and optionally post an activity notification or rely on backend-emitted notification refresh).

**Verification Checklist:**
- [ ] Deleting a student calls `DELETE /api/students/:id`, closes drawer if open, updates pagination, and preserves finance history.
- [ ] `RecordPaymentModal` sends `description` (never `note`) to `POST /api/finance/student-payments`, updates `outstanding` balance immediately in `StudentDetail` & `StudentsPage`.
- [ ] `StudentQRCard` encodes backend `qrPayload`, shows `qrRotatedAt`, and **"Rotate QR"** calls `POST /api/students/:id/rotate-qr` and immediately updates PNG/PDF/Print outputs.
- [ ] Creating a student reflects backend registration email delivery in UI confirmation feedback.

---

### Task 5: Students — Student API integration (2hrs)
**Target Endpoints:** All 7 `/api/students*` routes  
**Existing Files:**
- `src/lib/repository.ts` (`L1-15`)
- `src/hooks/useAppData.tsx` (`L104-120`)

**Files to Create / Modify:**
- **Create:** `src/api/students.ts` (and optionally `src/hooks/useStudents.ts`)
- **Modify:** `src/types/index.ts`, `src/pages/dashboard/StudentsPage.tsx`, `src/components/students/StudentDetail.tsx`, `src/components/students/StudentFormModal.tsx`

**Actionable Subtasks:**
1. Implement typed API functions in `src/api/students.ts`:
   - `listStudents(params: StudentQueryParams)` → `GET /api/students`
   - `lookupStudent(code: string)` → `GET /api/students/lookup?code=...` (ready for QR scanner / quick lookup reuse)
   - `getStudentById(id: string)` → `GET /api/students/:id`
   - `createStudent(payload: CreateStudentDto)` → `POST /api/students`
   - `updateStudent(id: string, payload: UpdateStudentDto)` → `PATCH /api/students/:id`
   - `deleteStudent(id: string)` → `DELETE /api/students/:id`
   - `rotateStudentQr(id: string)` → `POST /api/students/:id/rotate-qr`
2. Define request/response TypeScript interfaces (`StudentQueryParams`, `StudentListItem`, `StudentListResponse`, `StudentDetail`, `CreateStudentDto`, `UpdateStudentDto`, `RotateQrResponse`) matching `Tution-saas-BE`.
3. Create `useStudents` / `useStudentDetail` hook(s) managing loading, error, abort/race-condition cancellation (`AbortController`) on rapid filter/search typing, and clean refetch triggers.
4. Remove all student-page dependencies on `useAppData()` mock arrays (`students`, `saveStudent`, `deleteStudent`, `outstanding`, `feeTotal`, `paidTotal`).

**Verification Checklist:**
- [ ] TypeScript compiles cleanly (`tsc --noEmit`) with strict DTO types for all 7 endpoints.
- [ ] Rapid typing in search cancels or ignores stale in-flight requests (no out-of-order table flicker).
- [ ] Zero references to `useAppData()` remain in `StudentsPage.tsx`, `StudentDetail.tsx`, `StudentFormModal.tsx`, or `StudentQRCard.tsx`.

---

### Task 6: Modules — Module listing, details & create/edit workflows
**Target Endpoints:** `GET /api/modules`, `GET /api/modules/:id`, `POST /api/modules`, `PATCH /api/modules/:id`, `DELETE /api/modules/:id`  
**Existing Files:**
- `src/pages/dashboard/ModulesPage.tsx` (`L51-233`)
- `src/components/modules/ModuleFormModal.tsx` (`L1-87`)

**Files to Create / Modify:**
- **Modify:** `src/pages/dashboard/ModulesPage.tsx`, `src/components/modules/ModuleFormModal.tsx`, `src/types/index.ts`

**Actionable Subtasks:**
1. Replace mock filtering (`ModulesPage.tsx:71-80`) with `GET /api/modules` passing `q` (debounced), `status`, `teacherId`, `batch`.
2. Populate Teacher filter (`L123`) and `ModuleFormModal` Teacher select (`ModuleFormModal.tsx:50-53`) from `GET /api/teachers` (`src/api/teachers.ts`) instead of mock `useAppData().teachers`.
3. Update Grid cards (`L133-167`) and List `DataTable` columns (`L82-102`) to read `m.teacher?.fullName` (fallback `getTeacher` or `"No teacher assigned"`) and `m.enrolledCount ?? 0` directly from the API instead of scanning `students` in memory (`L70`).
4. Update Module Detail Drawer (`L174-222`) to fetch `GET /api/modules/:id` on open (with loading skeleton & error state), displaying live `teacher`, `enrolledCount`, `revenuePotential`, and `enrolledStudents`.
5. Fix inline drawer mutations (`L187-195`):
   - Teacher change calls `PATCH /api/modules/:id` with `{ teacherId: value || null }` only (**do not spread `...detail`**).
   - Batch chips change calls `PATCH /api/modules/:id` with `{ batches: v }` only (while preserving validation that at least 1 batch is selected).
   - Disable inline controls while patching and revert on failure.
6. Update `ModuleFormModal.tsx`:
   - Pick only clean DTO fields `{ code, name, description, fee, duration, teacherId, batches, status }` for `defaultValues` (do not spread `...item` which may contain `teacher`, `enrolledCount`, `enrolledStudents`).
   - Add `key={item?.id ?? "new"}` (or `useEffect` `reset()`) to prevent stale edit values.
   - Submit asynchronously via `POST /api/modules` (which returns `teacherId` without nested `teacher`) and `PATCH /api/modules/:id`, map backend `details` validation errors (e.g., duplicate module `code`), and refetch `GET /api/modules` (plus `GET /api/modules/:id` if drawer is open) so `teacher` and `enrolledCount` stay consistent.
7. Wire delete confirmation (`L224-230`) to `DELETE /api/modules/:id` with async loading, error handling, closing drawer if open, and list refresh.

**Verification Checklist:**
- [ ] Grid and List views render `teacher.fullName` and `enrolledCount` from `GET /api/modules` with working `q`, `status`, `teacherId`, `batch` filters.
- [ ] Creating a module via `POST /api/modules` properly displays the assigned teacher on the card/row after save (despite `POST` returning `teacherId` without nested `teacher`).
- [ ] Drawer opens `GET /api/modules/:id`, displays `revenuePotential` & `enrolledStudents`, and inline teacher/batch updates send minimal `PATCH` bodies.
- [ ] Deleting a module calls `DELETE /api/modules/:id` and refreshes the listing cleanly.

---

### Task 7: Modules — Student enrollment management & API integration (2hrs)
**Target Endpoints:** `PUT /api/modules/:id/enrollments` + full `/api/modules*` service layer  
**Existing Files:**
- `src/pages/dashboard/ModulesPage.tsx` (`L17-49`, `L196-215`)

**Files to Create / Modify:**
- **Create:** `src/api/modules.ts` (and optionally `src/hooks/useModules.ts`)
- **Modify:** `src/pages/dashboard/ModulesPage.tsx` (or extract `src/components/modules/RegisterStudentsModal.tsx`), `src/types/index.ts`

**Actionable Subtasks:**
1. Create `src/api/modules.ts` covering all 6 endpoints:
   - `listModules(params?: ModuleQueryParams)` → `GET /api/modules`
   - `getModuleById(id: string)` → `GET /api/modules/:id`
   - `createModule(payload: CreateModuleDto)` → `POST /api/modules`
   - `updateModule(id: string, payload: UpdateModuleDto)` → `PATCH /api/modules/:id`
   - `setModuleEnrollments(id: string, studentIds: string[])` → `PUT /api/modules/:id/enrollments`
   - `deleteModule(id: string)` → `DELETE /api/modules/:id`
2. Refactor `RegisterStudents` modal (`ModulesPage.tsx:17-49`):
   - Initialize selected IDs (`sel`) from `GET /api/modules/:id` (`enrolledStudents.map(s => s.id)`) — fetch `getModuleById(module.id)` if `enrolledStudents` isn't already loaded when opening directly from a module card (`L160`)!
   - Fetch eligible students from `GET /api/students` (supporting server-side search `q` and sufficient `limit` or paginated load, filtering/disabling `status === "graduated"` and showing status badges for `pending`/`inactive`).
   - Submit `{ studentIds: sel }` to `PUT /api/modules/:id/enrollments`, disable save button while loading, and display backend error (e.g., if a `graduated` student was rejected).
   - On success, update the module detail state & list card `enrolledCount` from the returned `{ moduleId, enrolledCount, enrolledStudents }`.
3. Update inline single-student removal in Drawer (`ModulesPage.tsx:210`):
   - Clicking `X` computes `nextIds` from `detail.enrolledStudents` and calls `PUT /api/modules/:id/enrollments` with `{ studentIds: nextIds }` (with per-row pending state and error toast, no silent mock mutation).
4. Remove all `useAppData()` usage from `ModulesPage.tsx` and `ModuleFormModal.tsx`.

**Verification Checklist:**
- [ ] Opening "Register" from either a module card or the detail drawer accurately pre-selects all currently enrolled students from the backend.
- [ ] Searching students in the Register modal queries backend students and excludes/prevents enrolling `graduated` students.
- [ ] Saving enrollment calls `PUT /api/modules/:id/enrollments` with `{ studentIds }` and updates `enrolledCount`, `enrolledStudents`, and `revenuePotential`.
- [ ] Removing an individual student via the drawer `X` button persists via `PUT /api/modules/:id/enrollments`.

---

### Task 8: Finance — Transaction listing & create/edit/delete workflows (4hrs)
**Target Endpoints:** `GET /api/finance/transactions`, `GET /api/finance/kpis`, `GET /api/finance/charts`, `POST /api/finance/transactions`, `PATCH /api/finance/transactions/:id`, `DELETE /api/finance/transactions/:id`  
**Existing Files:**
- `src/pages/dashboard/FinancePage.tsx` (`L1-196`, `L219-230`)
- `src/components/finance/TransactionFormModal.tsx` (`L1-75`)
- `src/components/ui/PeriodFilter.tsx` (`L1-27`)

**Files to Create / Modify:**
- **Modify:** `src/pages/dashboard/FinancePage.tsx`, `src/components/finance/TransactionFormModal.tsx`, `src/types/index.ts`

**Actionable Subtasks:**
1. Replace client-side `filtered`, `income`, `expenses`, `totalIncome`, `totalExpense`, `totalOutstanding`, `series`, `donut` (`FinancePage.tsx:39-50, 103`) with API queries driven by `period.period`, `period.range.from`, `period.range.to`, and `category`:
   - KPI cards (`L96-101`): populate from `GET /api/finance/kpis` (or `transactions.kpis`).
   - Overview charts (`L153-186`): populate `ComposedChart` from `charts.series` and the two `PieChart` donuts from `charts.incomeByCategory` and `charts.expenseByCategory` via `GET /api/finance/charts`.
2. Wire server-side paginated transaction tables using `GET /api/finance/transactions`:
   - Overview tab `Latest transactions` (`L187-190`): `page`, `limit: 8` (no `type` filter).
   - Income tab (`L194`): `type: "income"`, `page`, `limit: 10`.
   - Expenses tab (`L195`): `type: "expense"`, `page`, `limit: 10`.
   - Reset `page = 1` when `tab`, `period`, `custom range`, or `category` changes; pass `pagination.total` and `pagination.totalPages` to `DataTable`.
   - Use `kpis.totalCount` / `pagination.total` for the filter bar count (`L141`) and tab headers (`L194-195`).
3. Fix Excel Export (`FinancePage.tsx:83-94`):
   - Do **not** export only the current page of 10 rows! Fetch all matching transactions for the active `period`/`from`/`to`/`category`/`type` before generating the `.xlsx` workbook, with loading state on the "Export Excel" button.
4. Refactor `TransactionFormModal.tsx`:
   - Remove `{ ...item, ...v, type }` spread (`L36`); construct explicit DTO `{ type, category, amount, date, description, method }` (preserving `studentId` only if editing a student transaction or omitting if undefined).
   - Normalize `item.date` with `toDateInput(item.date)` (`L32`) and add `key={item?.id ?? type}` so form resets cleanly.
   - Remove `"demo entry"` / `"Demo ledger entry"` copy (`L37, L64`).
   - Wire `POST /api/finance/transactions` and `PATCH /api/finance/transactions/:id` with loading state, `details` field error mapping, and `onSaved()` callback to refresh KPIs, charts, and active table.
5. Wire `ConfirmDialog` (`FinancePage.tsx:221-227`) to `DELETE /api/finance/transactions/:id`, refreshing KPIs, charts, and active table on success (and stepping back `page` if last item deleted).

**Verification Checklist:**
- [ ] Switching `PeriodFilter` (`week`, `month`, `year`, `custom`) and `category` re-queries `kpis`, `charts`, and `transactions` with `period`, `from`, `to`, `category`.
- [ ] Overview charts render `series`, `incomeByCategory`, and `expenseByCategory` from `/api/finance/charts`.
- [ ] Income, Expenses, and Overview tables paginate via server `page` & `limit`.
- [ ] Adding, editing, and deleting a transaction updates the table, KPIs, and charts without sending read-only fields on `PATCH`.
- [ ] Excel export includes all filtered transactions across pages (not just page 1).

---

### Task 9: Finance — Student payments, debtors & payment history (2hrs)
**Target Endpoints:** `GET /api/finance/student-payments`, `POST /api/finance/student-payments`, `GET /api/finance/transactions` (for payment history)  
**Existing Files:**
- `src/pages/dashboard/FinancePage.tsx` (`L45, L50, L72-81, L197-217`)
- `src/components/finance/RecordPaymentModal.tsx` (`L1-104`)

**Files to Create / Modify:**
- **Modify:** `src/pages/dashboard/FinancePage.tsx`, `src/components/finance/RecordPaymentModal.tsx`

**Actionable Subtasks:**
1. **Student Payments / Debtors Panel (`FinancePage.tsx:203-215`):**
   - Replace `owing` client computation (`L50`) and `.slice(0, 20)` (`L206`) with live `GET /api/finance/student-payments` integration.
   - Add controls in the Student Payments / Debtors section for:
     - Search input (`q`, debounced)
     - `batch` filter, `status` filter (`pending|active|inactive|graduated`)
     - `debtorsOnly` toggle (default `true` for Debtors view, toggleable to see all students + settlement status)
     - `includeGraduated` toggle (default `false`)
     - Pagination (`page`, `limit`)
   - Display `summary.debtorCount`, `summary.totalOutstanding`, and per-student `feeTotal`, `paidTotal`, `outstanding`, `paymentStatus` (`paid`/`partial`/`unpaid`), `lastPaymentDate`, `lastPaymentAmount`, plus "Collect" button (`setPay({ open: true, student: item })`).
   - Remove `<MockNote>` (`L214`).
2. **Payment History Table (`FinancePage.tsx:199-202`):**
   - Query `GET /api/finance/transactions` filtered to student payments (e.g., `type: "income"`, `category: "Tuition fees"` — or filter `studentId` if backend provides student info on transactions; verify whether student name/ID comes attached on transaction items or cross-reference cleanly without mock `getStudent`).
   - Server-paginate Payment History (`page`, `limit: 8`) and ensure edit/delete refreshes both Payment History and Student Payments summary/debtors list.
3. **`RecordPaymentModal.tsx` Alignment:**
   - Ensure opening from Finance (`Collect` button or `Record payment` button) passes selected student summary or loads students via `GET /api/finance/student-payments` (not `useAppData().students`).
   - Ensure `POST /api/finance/student-payments` sends `description` (NOT `note`) and consumes `{ transaction, studentSummary }` response to refresh Finance KPIs, charts, Payment History, and Debtors list.

**Verification Checklist:**
- [ ] Debtors / Student Payments panel loads from `GET /api/finance/student-payments` with working search, batch, status, `debtorsOnly`, `includeGraduated`, and pagination.
- [ ] Clicking **Collect** pre-selects the student with accurate `feeTotal`, `paidTotal`, and `outstanding` from backend.
- [ ] Submitting payment via `POST /api/finance/student-payments` uses `{ studentId, amount, method, category?, date?, description? }` and refreshes debtors, payment history, and Finance KPIs.
- [ ] Editing or deleting a payment in Payment History recalculates outstanding balances and KPIs.

---

### Task 10: Finance — Finance API integration (2hrs)
**Target Endpoints:** All 8 `/api/finance/*` routes  
**Existing Files:**
- `src/hooks/useAppData.tsx` (`L75-85, L167-188`)
- `src/pages/dashboard/FinancePage.tsx`
- `src/components/finance/TransactionFormModal.tsx`
- `src/components/finance/RecordPaymentModal.tsx`

**Files to Create / Modify:**
- **Create:** `src/api/finance.ts` (and optionally `src/hooks/useFinance.ts`)
- **Modify:** `src/types/index.ts`, `src/lib/constants.ts`, `src/pages/dashboard/FinancePage.tsx`, `src/components/finance/TransactionFormModal.tsx`, `src/components/finance/RecordPaymentModal.tsx`, `src/components/qr/ScanResult.tsx`

**Actionable Subtasks:**
1. Create `src/api/finance.ts` implementing all 8 typed API calls:
   - `listTransactions(params: TransactionQueryParams)` → `GET /api/finance/transactions`
   - `getFinanceKpis(params: FinanceFilterParams)` → `GET /api/finance/kpis`
   - `getFinanceCharts(params: FinanceFilterParams)` → `GET /api/finance/charts`
   - `createTransaction(payload: CreateTransactionDto)` → `POST /api/finance/transactions`
   - `updateTransaction(id: string, payload: UpdateTransactionDto)` → `PATCH /api/finance/transactions/:id`
   - `deleteTransaction(id: string)` → `DELETE /api/finance/transactions/:id`
   - `listStudentPayments(params: StudentPaymentQueryParams)` → `GET /api/finance/student-payments`
   - `recordStudentPayment(payload: RecordStudentPaymentDto)` → `POST /api/finance/student-payments`
2. Ensure `INCOME_CATEGORIES`, `EXPENSE_CATEGORIES`, and `PAYMENT_METHODS` in `src/lib/constants.ts` match backend constants byte-for-byte.
3. Update `ScanResult.tsx` (`L60`) where `<RecordPaymentModal />` is reused so recording a payment from QR scan also uses the live API and refreshes the scanned student's outstanding balance!
4. Add independent loading/error states for KPIs, charts, transaction tables, and student payments panel, and eliminate all `useAppData()` calls from `FinancePage.tsx`, `TransactionFormModal.tsx`, and `RecordPaymentModal.tsx`.

**Verification Checklist:**
- [ ] All 8 endpoints in `src/api/finance.ts` match `Tution-saas-BE` query params, DTO fields, and response shapes.
- [ ] Zero references to `useAppData()` remain in Finance components/page.
- [ ] Recording a payment from `QrScannerPage` (`ScanResult.tsx`) also persists to `POST /api/finance/student-payments` and updates the displayed balance.

---

### Task 11: Classes — Online classes list, calendar & class details (4hrs)
**Target Endpoints:** `GET /api/online-classes`, `GET /api/online-classes/:id`  
**Existing Files:**
- `src/pages/dashboard/OnlineClassesPage.tsx` (`L1-134`)
- `src/index.css` (`L126-197`)

**Files to Create / Modify:**
- **Create:** `src/components/calendar/ClassDetailDrawer.tsx` (or modal for read-only Class Details)
- **Modify:** `src/pages/dashboard/OnlineClassesPage.tsx`, `src/index.css`

**Actionable Subtasks:**
1. Wire `GET /api/online-classes` to `OnlineClassesPage.tsx` passing filter params: `teacherId`, `moduleId`, `batch`, `status` (`scheduled | completed | cancelled`), `q` (debounced search), and visible calendar date range (`from`, `to` captured via FullCalendar `datesSet` callback, or full upcoming window for List view).
2. Add missing filter controls to the filter bar (`OnlineClassesPage.tsx:67-71`):
   - **Search (`q`)** input (title/description/topic search)
   - **Status** `<Select>` (`all`, `scheduled`, `completed`, `cancelled`)
   - Load Teacher & Module filter dropdown options from `GET /api/teachers` and `GET /api/modules` instead of `useAppData()`.
3. Add explicit **Calendar vs. List** view mode (or enhance `OnlineClassesPage` with a `Tabs` toggle: Calendar / List `DataTable` showing all filtered classes with date/time, module badge, teacher, batch, status badge, join link, and row actions) alongside the FullCalendar `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `listWeek` views and Upcoming Classes sidebar (`L99-121`).
4. Build **Class Details** Drawer/Modal (`ClassDetailDrawer.tsx`):
   - Clicking a calendar event (`L93`), list row, or upcoming class card (`L106`) fetches `GET /api/online-classes/:id` and displays full details: title, status badge, module (`code` + `name`), teacher, batch, date + start/end time, description, clickable meeting link + copy-to-clipboard button, and action buttons (**Edit / Reschedule**, **Cancel / Complete** quick status update, **Delete**).
5. Ensure module color legend (`L117-119`) maps dynamically to live fetched `modules` rather than mock `useAppData().modules`.

**Verification Checklist:**
- [ ] `GET /api/online-classes` passes `teacherId`, `moduleId`, `batch`, `status`, `q`, `from`, `to`.
- [ ] Both FullCalendar views (Month/Week/Day/List) and dedicated Class List view render backend classes accurately.
- [ ] Clicking any class opens Class Details populated via `GET /api/online-classes/:id`, with working Join link, Copy link, Edit, and Delete actions.

---

### Task 12: Classes — Schedule, edit/reschedule & delete online classes (2hrs)
**Target Endpoints:** `POST /api/online-classes`, `PATCH /api/online-classes/:id` (or `PUT`), `DELETE /api/online-classes/:id`  
**Existing Files:**
- `src/components/calendar/ClassFormModal.tsx` (`L1-123`)
- `src/pages/dashboard/OnlineClassesPage.tsx` (`L47-60, L94-95, L124-131`)

**Files to Create / Modify:**
- **Modify:** `src/components/calendar/ClassFormModal.tsx`, `src/pages/dashboard/OnlineClassesPage.tsx`

**Actionable Subtasks:**
1. **`ClassFormModal.tsx` Fixes & Integration:**
   - Add `key={item?.id ?? `${draft.date ?? ""}-${draft.startTime ?? ""}`}` on `<Inner />` (`L120`) or `useEffect(() => reset(...))` so opening Create after Edit or clicking different calendar slots always initializes fresh `defaultValues`.
   - Populate Module and Teacher selects from live `GET /api/modules` and `GET /api/teachers` (keep auto-filling `teacherId`, `batch`, and `title` when choosing a module on create, `L53-61`).
   - Replace `saveClass()` (`L64`) with async `POST /api/online-classes` (create) and `PATCH /api/online-classes/:id` (edit) sending `{ title, moduleId, teacherId, batch, start, end, link, description, status }` where `start` and `end` are `YYYY-MM-DDTHH:mm`.
   - Disable submit while saving, map `ApiError.details` to fields, and refetch classes + detail drawer on success.
2. **Drag-and-Drop / Resize Rescheduling (`OnlineClassesPage.tsx:48-52`):**
   - Update `onDrop` (`EventDropArg | EventResizeDoneArg`) to guard `if (!info.event.start) return;`, compute floating local `start` & `end` (`YYYY-MM-DDTHH:mm`), and `await` `PATCH /api/online-classes/:id`.
   - On API failure, call `info.revert()` so the calendar visually rolls back to the original slot and display an error toast.
3. **Delete Class (`OnlineClassesPage.tsx:125-131`):**
   - Wire `ConfirmDialog` `onConfirm` to `DELETE /api/online-classes/:id`, close edit modal & detail drawer, show loading state, and refresh class list.

**Verification Checklist:**
- [ ] Clicking "Schedule class" or clicking an empty date/time slot on FullCalendar opens `ClassFormModal` pre-filled with that date/time and creates via `POST /api/online-classes`.
- [ ] Editing via modal calls `PATCH /api/online-classes/:id` and updates calendar, list, and detail drawer.
- [ ] Dragging or resizing an event calls `PATCH /api/online-classes/:id`; simulated API errors trigger `info.revert()`.
- [ ] Deleting a class calls `DELETE /api/online-classes/:id` and removes it from calendar and upcoming list.

---

### Task 13: Classes — Classes API integration (2hrs)
**Target Endpoints:** All `/api/online-classes*` routes  
**Existing Files:**
- `src/hooks/useAppData.tsx` (`L190-196`)
- `src/pages/dashboard/OnlineClassesPage.tsx`
- `src/components/calendar/ClassFormModal.tsx`

**Files to Create / Modify:**
- **Create:** `src/api/onlineClasses.ts` (and optionally `src/hooks/useOnlineClasses.ts`)
- **Modify:** `src/types/index.ts`, `src/pages/dashboard/OnlineClassesPage.tsx`, `src/components/calendar/ClassFormModal.tsx`

**Actionable Subtasks:**
1. Implement `src/api/onlineClasses.ts`:
   - `listOnlineClasses(params?: OnlineClassQueryParams)` → `GET /api/online-classes`
   - `getOnlineClassById(id: string)` → `GET /api/online-classes/:id`
   - `createOnlineClass(payload: CreateOnlineClassDto)` → `POST /api/online-classes`
   - `updateOnlineClass(id: string, payload: UpdateOnlineClassDto)` → `PATCH /api/online-classes/:id`
   - `deleteOnlineClass(id: string)` → `DELETE /api/online-classes/:id`
2. Define TypeScript DTOs (`OnlineClassQueryParams`, `CreateOnlineClassDto`, `UpdateOnlineClassDto`, enriched `OnlineClass` if backend includes optional `module`/`teacher` summaries).
3. Add loading overlay/skeletons on calendar & upcoming panel, error retry banner, and remove all `useAppData()` calls from `OnlineClassesPage.tsx` and `ClassFormModal.tsx`.

**Verification Checklist:**
- [ ] All 5 endpoints use `/api/online-classes` cleanly with `{ success, data }` unwrapping.
- [ ] Zero `useAppData()` references remain in `OnlineClassesPage.tsx` or `ClassFormModal.tsx`.
- [ ] Calendar loading/error states never crash FullCalendar on empty or failed fetches.

---

### Task 14: Responsiveness & Scrolling — All devices scrolling & responsiveness (4hrs)
**Existing Files Inspected (Concrete Issues Found):**
- `src/index.css` (`L49-60`, `L126-197`)
- `src/components/layout/DashboardLayout.tsx` (`L30-42`)
- `src/components/layout/Sidebar.tsx` (`L42`, `L122-135`)
- `src/components/layout/Topbar.tsx` (`L127-199`)
- `src/components/ui/overlays.tsx` (`L8-20`, `L47`, `L85`, `L190`)
- `src/components/ui/PeriodFilter.tsx` (`L18-24`)
- `src/components/ui/data-table.tsx` (`L61-62`, `L107-123`)
- `src/components/ui/primitives.tsx` (`L206`, `L245-255`)
- `src/pages/dashboard/OnlineClassesPage.tsx` (`L61`, `L73-97`)
- `src/pages/dashboard/FinancePage.tsx` (`L131-142`, `L167-186`, `L198`)
- `src/pages/dashboard/OverviewPage.tsx` (`L80-100`, `L106`, `L142`, `L170`)
- `src/pages/dashboard/AnalyticsPage.tsx` (`L135`, `L158`, `L188`)
- `src/pages/dashboard/AttendancePage.tsx` (`L243`, `L265`)
- `src/pages/dashboard/NoticesPage.tsx` (`L53-60`)
- `src/pages/dashboard/QrScannerPage.tsx` (`L106`, `L130`, `L158`)

**Actionable Subtasks:**
1. **Viewport & Root Scroll Shell (`src/index.css`, `DashboardLayout.tsx`, `Sidebar.tsx`):**
   - Prevent accidental horizontal page overflow (`overflow-x-clip` on root layout wrapper in `DashboardLayout.tsx:31-33` without breaking `position: sticky` on `Topbar`).
   - Add `min-w-0` on `DashboardLayout` main wrapper and **every CSS Grid parent** (`OverviewPage`, `FinancePage`, `AttendancePage`, `QrScannerPage`, `AnalyticsPage`) that contains `DataTable`, Recharts, or FullCalendar so horizontal scroll stays localized inside tables/charts instead of expanding the whole viewport.
   - Ensure mobile sidebar drawer (`Sidebar.tsx:126`) uses `h-dvh` and smooth touch scrolling on short viewports (`<nav className="flex-1 overflow-y-auto overscroll-contain">`).
2. **Modals, Drawers & Dropdowns (`src/components/ui/overlays.tsx`):**
   - Switch `Modal` (`L47`) from `max-h-[92vh]` to `max-h-[92dvh]` and add `overscroll-contain` on modal/drawer scrollable bodies (`L60, L96`) so mobile virtual keyboards and Safari toolbars don't trap scroll or cut off footers.
   - Guard scroll lock (`useLock`, `L8-20`) against layout shift (`scrollbar-gutter: stable` or compensation) and ensure nested modals/drawers (e.g., `ConfirmDialog` over `StudentDetail` Drawer or `ClassFormModal`) don't prematurely unlock `body.style.overflow` when the inner modal closes while the outer drawer is still open! *(Real bug in current `useLock`!)*
   - Verify `Dropdown` (`L190`) positioning on `320px–375px` viewports so `Notifications` & `Profile` menus never clip off the left edge.
3. **Specific Responsive Breakages Found in Components/Pages:**
   - **`PeriodFilter.tsx` (`L18-24`):** Wrap custom date inputs (`flex-wrap`, `w-full sm:w-40`) — currently two `w-40` inputs + `"to"` overflow `320px–375px` screens.
   - **`NoticesPage.tsx` (`L56-58`):** Replace fixed `w-52`, `w-36`, `w-44` with responsive `w-full sm:w-52`, `w-full sm:w-36`, `w-full sm:w-44` (or CSS grid).
   - **`QrScannerPage.tsx` (`L130`):** Allow manual lookup `<form>` to stack/wrap gracefully on `< 360px` (`flex-col sm:flex-row`).
   - **`OnlineClassesPage.tsx` (`L61, L73-96` & `index.css:192-197`):** Add responsive FullCalendar toolbar sizing/wrapping so the 4 view buttons (`Month/Week/Day/List`) fit on `< 400px` without overflowing, adjust `contentHeight` on mobile, and adapt view cleanly on viewport breakpoint resize.
   - **`AnalyticsPage.tsx` (`L135`):** Reduce/responsive `Pie` `outerRadius` or hide external labels on small mobile screens so `Module enrollment` donut doesn't clip horizontally.
   - **`StudentDetail.tsx` (`L53-62`) & `Tabs` (`primitives.tsx:206`):** Verify horizontal tab scrolling (`Overview / Attendance / Payments / QR Code`, Finance 4 tabs, Attendance 4 tabs) with comfortable touch targets and subtle scroll behavior on narrow phones.
   - **`ToastProvider` (`toast.tsx:40`):** Add safe-area bottom inset padding on mobile.

**Verification Checklist:**
- [ ] Zero horizontal page scroll (`document.documentElement.scrollWidth <= window.innerWidth`) across all 11 dashboard pages at `320px`, `375px`, `768px`, `1024px`, `1280px`, `1440px`.
- [ ] Nested overlay scenario (open `StudentDetail` Drawer -> open `ConfirmDialog` -> cancel `ConfirmDialog`) preserves body scroll lock while Drawer remains open, and restores body scroll when Drawer closes.
- [ ] All tables (`DataTable`), tabs, `PeriodFilter` custom dates, FullCalendar, and charts scroll/fit cleanly on mobile touch viewports.
- [ ] Sidebar mobile drawer, topbar sticky header, and modal/drawer footers remain accessible on short landscape screens (`360px` height) and with mobile keyboard open.

---

### Task 15: Header — Remove the global search bar from the header (1hr)
**Existing Files:**
- `src/components/layout/Topbar.tsx` (`L1-201`)

**Files to Create / Modify:**
- **Modify:** `src/components/layout/Topbar.tsx`

**Actionable Subtasks:**
1. Delete the `GlobalSearch` component (`Topbar.tsx:12-65`).
2. Remove desktop `<GlobalSearch className="hidden w-72 md:block xl:w-96" />` (`L149`).
3. Remove mobile search toggle button (`L150-152`), `searchOpen` state (`L124`), and mobile collapsible search drawer (`L194-198`).
4. Clean up unused imports (`Topbar.tsx:1-3`: `useMemo`, `useNavigate`, `BookOpen`, `GraduationCap`, `Search`, `Users`) — critical because `tsconfig.json` enforces `"noUnusedLocals": true`.
5. Verify header layout & spacing on mobile, tablet, and desktop (`Menu`/`PanelLeft`, Page title + breadcrumb `flex-1`, `Notifications`, Theme toggle, Profile dropdown).

**Verification Checklist:**
- [ ] Global search input (desktop) and search icon button (mobile) are completely gone from the header.
- [ ] `npm run build` / `tsc --noEmit` passes with zero unused variable/import errors.
- [ ] Header items align cleanly from `320px` up to `1500px+` without awkward gaps or truncation.

---

### Task 16: Notification — Notification UI development, backend API integration & notification management (3hrs)
**Target Endpoints:** `GET /api/notifications`, `POST /api/notifications`, `PATCH /api/notifications/read-all`, `PATCH /api/notifications/:id/read`, `DELETE /api/notifications/:id`  
**Existing Files:**
- `src/components/layout/Topbar.tsx` (`L67-118`)
- `src/pages/dashboard/SettingsPage.tsx` (`L8-14, L23-24, L107-127` — UI-only notification preferences; clarify separation)

**Files to Create / Modify:**
- **Create:** `src/api/notifications.ts`, `src/hooks/useNotifications.ts`, `src/components/notifications/NotificationsMenu.tsx`, `src/components/notifications/NotificationManagerModal.tsx` (or `src/pages/dashboard/NotificationsPage.tsx` + route in `src/App.tsx` if full-page management is desired)
- **Modify:** `src/types/index.ts`, `src/components/layout/Topbar.tsx`

**Actionable Subtasks:**
1. **API Layer (`src/api/notifications.ts` & `src/hooks/useNotifications.ts`):**
   - Implement `listNotifications()` (`GET /api/notifications` → `{ items, unreadCount }`), `createNotification(dto)` (`POST /api/notifications`), `markAllNotificationsRead()` (`PATCH /api/notifications/read-all`), `markNotificationRead(id)` (`PATCH /api/notifications/:id/read`), `deleteNotification(id)` (`DELETE /api/notifications/:id`).
   - Fetch notifications on mount, support manual refresh + periodic/window-focus refresh, and keep `unreadCount` synchronized across header bell & management panel.
2. **Header Notification Dropdown (`NotificationsMenu.tsx` replacing `Topbar.tsx:67-118`):**
   - Replace hardcoded red dot (`Topbar.tsx:91`) with conditional unread indicator / count badge (`unreadCount > 0` only).
   - Replace `{items.length} new` (`L99`) with `{unreadCount} unread` + **"Mark all read"** action button (`PATCH /api/notifications/read-all`, disabled when `unreadCount === 0`).
   - Map all 5 backend types (`notice`, `class`, `payment`, `student`, `system`) to distinct icons and color tones.
   - Style unread vs read items distinctly (subtle primary tint + unread dot on `!item.read`).
   - Clicking an item: mark read via `PATCH /api/notifications/:id/read` (optimistic/live update of `unreadCount`), navigate to `item.link` (instead of hardcoded `/dashboard/notices` on `L103`), and close dropdown.
   - Add per-item quick actions (hover/visible **Mark read** and **Delete** via `DELETE /api/notifications/:id` with `e.stopPropagation()`).
   - Add loading, error + retry, and empty state ("You're all caught up").
   - Add footer action buttons: **"+ New notification"** / **"Manage all"** to open Notification Management UI.
3. **Notification Management UI (`NotificationManagerModal.tsx` / Drawer or Page):**
   - Filterable list of all notifications (`All` / `Unread` + filter by `type`: `notice | class | payment | student | system`).
   - Bulk **"Mark all as read"** button (`PATCH /api/notifications/read-all`) and per-item mark-read / delete (`DELETE /api/notifications/:id`, handling `persisted` status cleanly).
   - **"Create notification"** form (`POST /api/notifications` with `type`, `title`, `subtitle`, `link` validation & loading state) so admins can post custom system/dashboard notifications.
4. Remove remaining `useAppData()` import from `Topbar.tsx` (`L5`) once `Notifications` no longer reads mock `notices`/`classes`/`students`.

**Verification Checklist:**
- [ ] Header bell loads real items and `unreadCount` from `GET /api/notifications`; badge disappears when `unreadCount === 0`.
- [ ] Clicking a notification calls `PATCH /api/notifications/:id/read`, decrements `unreadCount`, and navigates to `item.link`.
- [ ] "Mark all read" calls `PATCH /api/notifications/read-all` and sets all items read + `unreadCount = 0`.
- [ ] Deleting a notification calls `DELETE /api/notifications/:id` and removes it from the list.
- [ ] Notification Management UI successfully creates a notification via `POST /api/notifications` and immediately reflects it in the header bell dropdown.
- [ ] `Topbar.tsx` has zero dependency on `useAppData()`.

---

## 5. Recommended Execution Order

Follow this sequence to minimize blocked work, avoid merge/UI churn, and verify against real backend state cleanly:

1. **Step 0 — Shared Foundation (Prerequisites)**
   - `.env.example`, `vite.config.ts` proxy, `src/lib/api.ts`, `src/lib/constants.ts`, `src/types/index.ts`, `StatusBadge` (`pending`), `DataTable` server mode, `ConfirmDialog` async mode, `src/api/teachers.ts`.
2. **Step 1 — Task 15: Header Search Removal (1hr)**
   - Clean up `Topbar.tsx` first so Task 16 starts from a clean header component.
3. **Step 2 — Tasks 7 & 6: Modules API, Details, Create/Edit & Enrollments**
   - Build `src/api/modules.ts` first because **Students** (module assignment) and **Online Classes** (module selection & colors) depend on live Module IDs.
4. **Step 3 — Tasks 5, 2, 3, 4: Students API, Listing, Profile/CRUD, Payment/QR/Delete/Email (11hrs)**
   - Build `src/api/students.ts` (Task 5) → Server-paginated `StudentsPage` (Task 2) → `StudentDetail` & `StudentFormModal` with `pending` status (Task 3) → Delete, `RecordPaymentModal` (`description` fix), `StudentQRCard` + `rotate-qr`, email feedback (Task 4).
5. **Step 4 — Tasks 10, 8, 9: Finance API, Transactions & Student Payments/Debtors (8hrs)**
   - Build `src/api/finance.ts` (Task 10) → Transactions KPIs/charts/CRUD/Excel export (Task 8) → `GET /api/finance/student-payments` debtors & payment history (Task 9).
6. **Step 5 — Tasks 13, 11, 12: Online Classes API, Calendar/Details & Reschedule/CRUD (8hrs)**
   - Build `src/api/onlineClasses.ts` (Task 13) → Calendar/List/Details + filters (Task 11) → Create/Edit modal + Drag/Resize revert + Delete (Task 12).
7. **Step 6 — Task 1: Overview Dashboard (3hrs)**
   - Wire `GET /api/overview` (or split endpoints) + `timeline` feed after Students, Modules, Finance, and Classes have real seeded/created data in `Tution-saas-BE`.
8. **Step 7 — Task 16: Notification UI, API & Management (3hrs)**
   - Wire `/api/notifications`, `NotificationsMenu`, and Notification Management modal/drawer/page; verify notifications triggered by student/payment/class/notice flows.
9. **Step 8 — Task 14: Full Responsiveness & Scrolling Pass (4hrs)**
   - Perform final cross-device responsive & scroll audit across all completed UI (including new Class Details drawer, Notification Manager, Debtors filter panel, and server pagination footers) + run `npm run build`.

---

## 6. Global Pre-PR Verification Checklist

- [ ] `npm run build` (`vite build`) and `npx tsc --noEmit` succeed with zero TypeScript errors (`strict`, `noUnusedLocals`, `noUnusedParameters`).
- [ ] Every modified page (`OverviewPage`, `StudentsPage`, `ModulesPage`, `FinancePage`, `OnlineClassesPage`, `Topbar`) has **zero** imports or calls to `useAppData()` mock data or `src/data/mock`.
- [ ] All error states surface backend `message` / `details` gracefully via inline form errors or toast notifications (no silent failures).
- [ ] All `<MockNote>` banners and `"demo entry"` toast texts in `RecordPaymentModal.tsx`, `TransactionFormModal.tsx`, `StudentQRCard.tsx`, `StudentsPage.tsx`, and `FinancePage.tsx` are removed/updated.
- [ ] Network tab confirms `credentials: 'include'` (and/or `Authorization: Bearer ...`) and clean `{ success, data }` unwrapping on every endpoint.
