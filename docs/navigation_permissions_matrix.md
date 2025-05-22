# Navigation Permissions Matrix (User-Defined Roles)

This document outlines the target visibility of main navigation items based on user-defined roles.
**Note:** This matrix reflects the desired permissions. The actual implementation in `src/components/layout/unified-navigation.tsx` may require review and updates to fully align with these definitions if they are to be the source of truth.

## Role Definitions:

*   **Global Admin**:
    *   **Source:** User has `role: 'admin'` in Supabase `user_metadata`.
    *   **Access:** Full access to all features and settings.

*   **Brand Admin (Non-Global)**:
    *   **Source:** User does *not* have `role: 'admin'` in `user_metadata`. Instead, they have a specific assignment granting them 'admin' privileges for one or more brands (e.g., via a `user_brand_permissions` table).
    *   **Access:** Can view/manage their assigned brand(s) and associated workflows. Access to other administrative or content creation sections is restricted.

*   **Editor (Brand-Assigned, Non-Admin)**:
    *   **Source:** User typically has `role: 'editor'` in `user_metadata`. They are assigned to one or more brands but *not* with 'admin' privileges for those brands, nor are they a Global Admin.
    *   **Access:** Can create and manage content for their assigned brands but has restricted access to administrative sections like Brand, Template, and Workflow management pages.

*   **Viewer (Brand-Assigned, Non-Admin)**:
    *   **Source:** User typically has `role: 'viewer'` in `user_metadata`. Assigned to one or more brands but not with 'admin' privileges.
    *   **Access:** Primarily read-only access to view content for their assigned brands.

## Permissions Matrix:

| Navigation Item          | Global Admin | Brand Admin (Non-Global) | Editor (Brand-Assigned, Non-Admin) | Viewer (Brand-Assigned, Non-Admin) | Notes                                                                                                                                                 |
|--------------------------|--------------|--------------------------|------------------------------------|------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Dashboard**            | Yes          | Yes                      | Yes                                | Yes                                | General overview, visible to all authenticated users with brand assignments.                                                                          |
| **My Tasks**             | Yes          | Yes                      | Yes                                | Yes (if applicable)                | Tasks assigned to the user. Viewers might not have tasks.                                                                                             |
| **Brands (List/Mgmt)**   | Yes          | Yes                      | No                                 | No                                 | Global Admins see all. Brand Admins see/manage their assigned brand(s). Editors/Viewers do not see this top-level link.                             |
| **Content Templates**    | Yes          | No                       | No                                 | No                                 | Only Global Admins can view and manage Content Templates.                                                                                             |
| **Workflows**            | Yes          | Yes                      | No                                 | No                                 | Global Admins manage all. Brand Admins manage workflows for their brand(s). Editors/Viewers do not access this section.                             |
| **All Content (List)**   | Yes          | Yes                      | Yes                                | Yes                                | Access to view content listings, typically filtered by brand permissions.                                                                             |
| **Create Content (Group)** | Yes          | No                       | Yes                                | No                                 | Global Admins and Editors can create content. Brand Admins use workflows/brands, Viewers typically do not create.                                       |
| **Tools (Group)**        | Yes          | No                       | Yes                                | No                                 | Global Admins and Editors have access to tools. Brand Admins focus on brand/workflow management. Viewers typically do not use these.                 |
| **View Feedback**        | Yes          | Yes                      | Yes                                | Yes                                | All authenticated users can view submitted feedback.                                                                                                  |
| **Submit Feedback**      | Yes          | Yes                      | Yes                                | Yes                                | All authenticated users can submit feedback.                                                                                                          |
| **Users (Management)**   | Yes          | No                       | No                                 | No                                 | User management is restricted to Global Admins.                                                                                                       |
| **Account**              | Yes          | Yes                      | Yes                                | Yes                                | All authenticated users can manage their own account settings.                                                                                        |
| **Help**                 | Yes          | Yes                      | Yes                                | Yes                                | Access to help resources for all authenticated users.                                                                                                 |
| **Claims Management**    | Yes          | Yes                      | No                                 | No                                 | Allows management of product, ingredient, and brand claims.                                                                                           |

This matrix aims to provide a clear guide for the intended navigation structure based on the specified user roles.

---

## Implementation Plan to Align with This Matrix

### Discovery Phase: Assessing Necessary Changes

**1. UI - `UnifiedNavigation.tsx` Review:**

*   **Role Definitions Need Refinement:**
    *   Current code uses `isAdmin`, `isPlatformAdmin`, `isScopedAdmin`, `isEditor`, `isViewer`.
    *   Need to introduce/clarify:
        *   `isGlobalAdmin` (current `isAdmin` should suffice: `userRole === 'admin'`).
        *   `isBrandAdmin_NonGlobal` (e.g., `userRole !== 'admin' && hasBrandAdminPermission`).
        *   `isEditor_BrandAssigned_NonAdmin` (e.g., `userRole === 'editor' && !hasBrandAdminPermission`).
        *   `isViewer_BrandAssigned_NonAdmin` (e.g., `userRole === 'viewer' && !hasBrandAdminPermission`).
*   **Brands Link Logic:** Update from `(isPlatformAdmin || isAdmin || userBrandPermissions.length > 0)` to `(isGlobalAdmin || isBrandAdmin_NonGlobal)`.
*   **Content Templates Link Logic:** Update from `(isPlatformAdmin || isAdmin || isEditor)` to `(isGlobalAdmin)`.
*   **Workflows Link Logic:** Update from `(isPlatformAdmin || isAdmin || (isEditor && hasBrandAdminPermission))` to `(isGlobalAdmin || isBrandAdmin_NonGlobal)`.
*   **Create Content (Group) Logic:** Update from `(isPlatformAdmin || isAdmin || isEditor)` to `((isGlobalAdmin || isEditor_BrandAssigned_NonAdmin) && contentItems.length > 0)`.
*   **Tools (Group) Logic:** Update from `(isPlatformAdmin || isAdmin || isEditor)` to `(isGlobalAdmin || isEditor_BrandAssigned_NonAdmin)`.
*   **Users Link Logic:** Current `(isPlatformAdmin || isAdmin)` aligns with `(isGlobalAdmin)` and is correct.

**2. Backend (API) Considerations:**

*   **`/api/me` Endpoint:** Verify it reliably provides `user_metadata.role` and `brand_permissions` array (with brand-specific roles) for all users.
*   **Authorization in Other API Endpoints:** Enforce role checks based on the matrix for:
    *   `Content Templates` (e.g., `/api/content-templates`): Global Admins only.
    *   `Brands` (e.g., `/api/brands`, `/api/brands/[id]`): Global Admins (all), Brand Admins (assigned brands).
    *   `Workflows` (e.g., `/api/workflows`, `/api/workflows/[id]`): Global Admins (all), Brand Admins (assigned brands).
    *   `Users` (e.g., `/api/users`): Global Admins only.
    *   `Tools` (e.g., `/api/tools/...`): Global Admins and Editors (Brand-Assigned, Non-Admin).

**3. Database Considerations:**

*   **`user_brand_permissions` Table:** Confirm structure (`user_id`, `brand_id`, `role`) and consistent use of role names ('admin', 'editor', 'viewer').
*   **Row Level Security (RLS):** Crucial for enforcement.
    *   Implement/Update RLS on `brands`, `content_templates`, `workflows`, and `content` tables to match matrix access rights.
    *   *Example RLS for `content_templates` (Global Admin):* `USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin')`.
    *   *Example RLS for `brands` (Brand Admin access):* `USING (EXISTS (SELECT 1 FROM user_brand_permissions WHERE user_brand_permissions.brand_id = brands.id AND user_brand_permissions.user_id = auth.uid() AND user_brand_permissions.role = 'admin'))` for SELECT, and similar for other operations if they can edit.

### Phased Implementation Plan

**Phase 0: Preparation & Refined Role Definitions in Code** - ✅ **DONE**

1.  **Objective:** Solidify role checking functions/constants in `UnifiedNavigation.tsx`.
2.  **Tasks:**
    *   In `UnifiedNavigation.tsx`, implement explicit boolean constants for the new roles: `isGlobalAdmin`, `isBrandAdmin_NonGlobal`, `isEditor_BrandAssigned_NonAdmin`, `isViewer_BrandAssigned_NonAdmin`. - ✅ **DONE**
    *   Base these on `user_metadata.role` and the `brand_permissions` array (specifically `hasBrandAdminPermission`). - ✅ **DONE**

**Phase 1: Backend - API Authorization & RLS (Critical for Security)** - ✅ **DONE**

1.  **Objective:** Secure data access at the API and database level according to the matrix.
2.  **Tasks:**
    *   **RLS Policies:** Define and apply RLS policies on `brands`, `content_templates`, `workflows`, and `content` tables. - ✅ **DONE** (Includes schema migration for `user_brand_permissions.role` to use `user_brand_role_enum`)
    *   **API Endpoint Authorization:** Modify API route handlers to perform role checks and return 403 Forbidden for unauthorized access attempts.
        *   `/api/brands/route.ts` & `/api/brands/[id]/route.ts`: ✅ **DONE**
        *   `/api/content/route.ts` & `/api/content/[id]/route.ts`: ✅ **DONE** (GET, POST, PUT, DELETE)
        *   `/api/content-types/route.ts`: ✅ **DONE** (Reviewed, no changes needed)
        *   `/api/content-templates/route.ts` & `/api/content-templates/[id]/route.ts` (Global Admins only): ✅ **DONE**
        *   `/api/workflows/route.ts` & `/api/workflows/[id]/route.ts` (Global Admins all, Brand Admins assigned): ✅ **DONE** (RLS in place. Write operations verified. GET `/[id]` allows broader read for users with any brand permission, relying on RLS.)
        *   `/api/users/...` (e.g., `route.ts`, `[id]/route.ts`, `invite/route.ts`, `search/route.ts`) (Global Admins only): ✅ **DONE**
        *   `/api/tools/...` (e.g., `alt-text-generator/route.ts`, `content-transcreator/route.ts`, `metadata-generator/route.ts`) (Global Admins & Editors): ✅ **DONE**

**Phase 2: Frontend - Update `UnifiedNavigation.tsx`** - ✅ **DONE**

1.  **Objective:** Align sidebar link visibility with the permissions matrix.
2.  **Tasks:**
    *   Modify the conditional logic for constructing `finalNavItems` in `UnifiedNavigation.tsx` using the refined role constants from Phase 0. - ✅ **DONE**
    *   Ensure each navigation item's visibility condition precisely matches the matrix. - ✅ **DONE**

**Phase 3: Frontend - Page-Level & Component-Level Authorization** - ✅ **DONE**

1.  **Objective:** Prevent direct URL access to restricted pages and manage UI elements within pages based on role.
2.  **Tasks:**
    *   Implement client-side checks on page load for all restricted pages. Redirect or show "Access Denied" if the user role from `/api/me` does not permit access according to the matrix.
        *   **Progress:**
            *   `src/app/dashboard/brands/[id]/edit/page.tsx` (`BrandEditPage`): ✅ **DONE**
            *   `src/app/dashboard/brands/new/page.tsx` (`NewBrandPage`): ✅ **DONE**
            *   `src/app/dashboard/brands/[id]/page.tsx` (`BrandDetailsPage`): ✅ **DONE** (Conditional UI elements)
            *   `src/app/dashboard/templates/page.tsx` (`TemplatesPage` - List): ✅ **DONE**
            *   `src/app/dashboard/templates/new/page.tsx` (`NewTemplatePage`): ✅ **DONE**
            *   `src/app/dashboard/templates/[id]/page.tsx` (`TemplateEditPage`): ✅ **DONE**
            *   `src/app/dashboard/workflows/page.tsx` (`WorkflowsPage` - List): ✅ **DONE**
            *   `src/app/dashboard/workflows/new/page.tsx` (`NewWorkflowPage`): ✅ **DONE**
            *   `src/app/dashboard/workflows/[id]/edit/page.tsx` (`WorkflowEditPage`): ✅ **DONE**
            *   `src/app/dashboard/content/new/page.tsx` (and `src/app/content/new/page.tsx` if different) (Global Admins & Editors): ✅ **DONE**
            *   `src/app/dashboard/content/[id]/edit/page.tsx` (`ContentEditPage`) (Global Admin, Brand Admin for brand, Editor for brand): ✅ **DONE**
            *   `src/app/dashboard/content/page.tsx` (`ContentListPage`):
                *   Page Access (All roles, data filtered by RLS): ✅ **VERIFIED**
                *   Component-level actions (e.g., Delete button): ✅ **DONE** (Global Admin or Brand Admin of content's brand)
            *   `src/app/dashboard/tools/alt-text-generator/page.tsx` (Global Admins & Editors): ✅ **DONE**
            *   `src/app/dashboard/tools/content-transcreator/page.tsx` (Global Admins & Editors): ✅ **DONE**
            *   `src/app/dashboard/tools/metadata-generator/page.tsx` (Global Admins & Editors): ✅ **DONE**
            *   `src/app/dashboard/users/page.tsx` (Users List) (Global Admins only): ✅ **DONE**
            *   `src/app/dashboard/users/[id]/edit/page.tsx` (User Edit) (Global Admins only): ✅ **DONE**
            *   `src/app/dashboard/users/invite/page.tsx` (User Invite) (Global Admins only): ✅ **DONE**
            *   `src/app/dashboard/my-tasks/page.tsx` (All roles, data self-scoped): ✅ **VERIFIED** (No role-gated actions on page; Edit action defers to target page)
            *   `src/app/dashboard/account/page.tsx` (All roles, self-management): ✅ **VERIFIED** (No admin-level features observed)
            *   `src/app/dashboard/feedback/page.tsx`:
                *   Page Access (View Feedback - All roles): ✅ **VERIFIED**
                *   Submit Feedback (All roles via modal): ✅ **IMPLEMENTED & VERIFIED**
            *   `src/app/dashboard/admin/feedback-log/page.tsx` (Global Admin only access): ✅ **DONE** (Global Admin only access implemented; includes feedback submission via modal for admins)
    *   Review UI components on pages to hide/disable features (e.g., edit buttons) not available to the current user's role. - Ongoing with page-level tasks, largely completed.

**Phase 4: Testing & Refinement** - 🔳 **OUTSTANDING**

1.  **Objective:** Thoroughly verify the implemented permissions across all defined roles.
2.  **Tasks:**
    *   Create test user accounts for each role: Global Admin, Brand Admin (Non-Global) for a specific brand, Editor (Brand-Assigned, Non-Admin), Viewer (Brand-Assigned, Non-Admin).
    *   Log in as each test user and meticulously check:
        *   Correct visibility of navigation links.
        *   Blocking of direct URL access to unauthorized pages.
        *   Correct enablement/disablement of in-page actions and UI elements.
        *   Correct data scoping in API responses (e.g., Brand Admins only see data for their brands).
    *   Address any discrepancies found through fixes in the relevant code (UI, API, RLS).

**Phase 5: Documentation Update** - 🔳 **OUTSTANDING**

1.  **Objective:** Ensure all project documentation accurately reflects the implemented permissions model.
2.  **Tasks:**
    *   Review and update main `DOCUMENTATION.md` (sections on User Management, Roles, API access).
    *   Confirm `docs/navigation_permissions_matrix.md` precisely matches the final implementation logic (this task itself!).
    *   Update relevant code comments. 