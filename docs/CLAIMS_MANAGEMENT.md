# Claims Management Feature Documentation

## 1. Introduction

The Claims Management system allows brand teams to define, manage, and preview claims associated with their brands, products, and ingredients. This system supports global (default) claims and country-specific claims, enabling fine-grained control over marketing assertions.

The core objectives are:
- To provide a centralized repository for all marketing claims.
- To ensure products are associated with accurate and approved claims based on their ingredients and market.
- To allow users to preview the complete set of claims applicable to a specific product in a given country.

## 2. Database Schema

The following new tables will be added to the database to support Claims Management.

### `products` Table
Stores information about individual products.

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (brand_id, name) -- A product name should be unique within a brand
);

COMMENT ON TABLE products IS 'Stores information about individual products, linked to a brand.';
COMMENT ON COLUMN products.brand_id IS 'Foreign key referencing the brand this product belongs to.';
```

### `ingredients` Table
Stores information about ingredients that can be part of products.

```sql
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ingredients IS 'Stores information about ingredients that can be used in products.';
```

### `product_ingredients` Table
A join table to establish a many-to-many relationship between products and ingredients.

```sql
CREATE TABLE product_ingredients (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, ingredient_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_ingredients IS 'Join table linking products to their ingredients.';
```

### `claims` Table
Stores the actual claims, their type, level (brand, product, ingredient), and country specificity.

```sql
-- Define ENUM types for claim_type and claim_level if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_type_enum') THEN
        CREATE TYPE claim_type_enum AS ENUM ('allowed', 'disallowed', 'mandatory');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_level_enum') THEN
        CREATE TYPE claim_level_enum AS ENUM ('brand', 'product', 'ingredient');
    END IF;
END$$;

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_text TEXT NOT NULL,
    claim_type claim_type_enum NOT NULL,
    level claim_level_enum NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    country_code TEXT, -- ISO 3166-1 alpha-2 country code, e.g., 'GB', 'US', 'IN'. Use '__GLOBAL__' for default/global claims.
    description TEXT, -- Optional notes or context for the claim
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_claim_level_reference CHECK (
        (level = 'brand' AND brand_id IS NOT NULL AND product_id IS NULL AND ingredient_id IS NULL) OR
        (level = 'product' AND product_id IS NOT NULL AND brand_id IS NULL AND ingredient_id IS NULL) OR
        (level = 'ingredient' AND ingredient_id IS NOT NULL AND brand_id IS NULL AND product_id IS NULL)
    ),
    UNIQUE (claim_text, claim_type, level, brand_id, product_id, ingredient_id, country_code) -- Prevents exact duplicate claims
);

COMMENT ON TABLE claims IS 'Stores marketing claims related to brands, products, or ingredients.';
COMMENT ON COLUMN claims.claim_type IS 'Type of claim (e.g., allowed, disallowed, mandatory).';
COMMENT ON COLUMN claims.level IS 'The level at which the claim applies (brand, product, or ingredient).';
COMMENT ON COLUMN claims.brand_id IS 'FK to brands table if claim is at brand level.';
COMMENT ON COLUMN claims.product_id IS 'FK to products table if claim is at product level.';
COMMENT ON COLUMN claims.ingredient_id IS 'FK to ingredients table if claim is at ingredient level.';
COMMENT ON COLUMN claims.country_code IS 'ISO 3166-1 alpha-2 country code for country-specific claims. Use '__GLOBAL__' for default/global.';
COMMENT ON COLUMN claims.description IS 'Optional internal notes or context about the claim.';
```

## 3. Claim Hierarchy and Logic

Claims are aggregated based on the product, its ingredients, its brand, and the target country.

### Claim Levels:
1.  **Brand Claims**: Apply to all products under a brand.
    - Identified by `claims.level = 'brand'` and a `claims.brand_id`.
2.  **Ingredient Claims**: Apply to any product containing a specific ingredient.
    - Identified by `claims.level = 'ingredient'` and a `claims.ingredient_id`.
3.  **Product Claims**: Apply specifically to one product.
    - Identified by `claims.level = 'product'` and a `claims.product_id`.

### Country Specificity:
-   Each claim can optionally have a `country_code`.
-   If `country_code` is set to a specific value (e.g., '__GLOBAL__'), the claim is a **default** or **global** claim.
-   If `country_code` is specified with an ISO 3166-1 alpha-2 code (e.g., 'IN' for India), the claim applies only to that country.

### Aggregation for Preview (Stacking Logic):
When previewing claims for a selected product and a target country (where "Global" can be selected as the target context):

1.  **Collect Base Claims**:
    *   **Product-Level**:
        *   Fetch product-specific claims matching the `product_id` and the target `country_code` (or '__GLOBAL__' if "Global" is selected).
        *   If no country-specific product claims are found for a specific country, fetch default product-specific claims for that `product_id` (where `country_code` IS '__GLOBAL__').
    *   **Ingredient-Level**:
        *   Identify all ingredients associated with the selected product via the `product_ingredients` table.
        *   For each ingredient:
            *   Fetch ingredient-specific claims matching the `ingredient_id` and the target `country_code` (or '__GLOBAL__').
            *   If no country-specific ingredient claims are found for an ingredient for a specific country, fetch its default ingredient-specific claims (where `country_code` IS '__GLOBAL__').
    *   **Brand-Level**:
        *   Identify the brand of the selected product.
        *   Fetch brand-specific claims matching the `brand_id` and the target `country_code` (or '__GLOBAL__').
        *   If no country-specific brand claims are found for a specific country, fetch default brand-specific claims for that `brand_id` (where `country_code` IS '__GLOBAL__').

2.  **Consolidation**:
    *   The "stack" of claims will be the union of all claims gathered in step 1.
    *   A country-specific claim for a given item (product, ingredient, or brand) **replaces** the default claim for that **same item and level**. It does not automatically override claims from other levels (e.g., a product-specific claim doesn't inherently override a brand-specific claim unless it's a direct contradiction, which the user would see).
    *   The UI will present these claims, possibly grouped by level (Brand, Product, Ingredient) or type (Allowed, Disallowed, Mandatory), to give a clear picture.

**Example**:
- Product P1 (Brand B, Ingredient I1, Ingredient I2)
- Target Country: India ('IN')

Claims fetched:
- Product P1 claims for 'IN' (if none, then P1 default claims).
- Ingredient I1 claims for 'IN' (if none, then I1 default claims).
- Ingredient I2 claims for 'IN' (if none, then I2 default claims).
- Brand B claims for 'IN' (if none, then B default claims).

All these collected claims form the preview.

## 4. High-Level UI Flow

A new "Claims Management" section will be added to the dashboard.

### A. Managing Core Entities:
1.  **Products Management**:
    *   View, Create, Edit, Delete products.
    *   When creating/editing a product:
        *   Associate it with a Brand.
        *   Assign Ingredients to it using a multi-select interface.
2.  **Ingredients Management**:
    *   View, Create, Edit, Delete ingredients.

### B. Defining and Managing Claims:
A dedicated UI for claims:
1.  **View Claims**:
    *   A filterable list of all claims. Filters could include: level, brand, product, ingredient, country, claim type.
2.  **Create/Edit Claim**:
    *   Select `level`: Brand, Product, or Ingredient.
    *   Based on level, select the specific Brand, Product, or Ingredient entity.
    *   Enter `claim_text`.
    *   Select `claim_type` (e.g., 'allowed', 'disallowed', 'mandatory').
    *   Optionally, specify a `country_code` from a predefined, comprehensive list of all countries. Select "Global" for a default/global claim (which will store '__GLOBAL__' in the database).
    *   Add an optional `description` for internal notes.

### C. Previewing Claims:
A dedicated page or modal for preview:
1.  **Inputs**:
    *   Dropdown to select a Product.
    *   Dropdown to select a Country from a predefined, comprehensive list, including a "Global" option.
2.  **Display**:
    *   Show a clear, "stacked" list of all applicable claims, derived using the logic in Section 3.
    *   Claims could be grouped by source (Brand, Product-Specific, Ingredient-Specific) and/or by type (Allowed, Disallowed, Mandatory) to help users understand their combined effect.
    *   **AI-Powered Analysis (Preview-Time)**: An AI-generated summary will be displayed below the stacked claims. This summary will highlight potential ambiguities, direct contradictions (especially between 'allowed' and 'disallowed' claims for the same or similar statements), or areas where claims might be unclear when read together. It will provide textual suggestions for the user to consider for refinement.

## 5. AI-Powered Review and Assistance

To further help users maintain accurate and consistent claims, the system will incorporate AI-driven review functionalities:

### A. Preview-Time AI Analysis
As mentioned in the UI Flow for Previewing Claims, whenever a user previews the "stack" for a product/country combination, an AI will:
- Analyze the collected set of brand, product, and ingredient claims.
- Identify potential conflicts (e.g., a brand claim is "disallowed" but a product claim is "allowed" for a similar assertion).
- Point out redundancies or areas where claims could be harmonized.
- Generate a textual summary of its findings and suggest specific changes or areas for user review to enhance clarity and remove ambiguity.
- Pay special attention to "disallowed" claims at higher levels (e.g., brand) and flag if lower-level "allowed" claims seem to contradict their intent.

### B. Brand-Wide AI Claims Review
A dedicated "AI Review All Claims for Brand" button will be available (e.g., within the main Claims Management section or associated with a brand's settings). When triggered:
- The AI will fetch and analyze *all* claims associated with the selected brand. This includes:
    - All global and country-specific brand-level claims.
    - All global and country-specific product-level claims for every product under that brand.
    - All global and country-specific ingredient-level claims for every ingredient used in those products.
- The AI will then generate a comprehensive report with suggestions. This report will focus on:
    - Ensuring consistency across the entire brand portfolio.
    - Identifying broader patterns of conflict or ambiguity.
    - Suggesting opportunities to simplify or strengthen claims.
    - Highlighting any "disallowed" claims that might be inadvertently undermined by other claims.
- The output will be a set of actionable, textual recommendations for the brand team.

These AI features aim to act as an intelligent assistant, helping users to proactively manage their claims landscape rather than just reacting to issues.

## 6. Future Considerations
-   **Advanced Conflict Resolution Rules**: Beyond AI suggestions, future enhancements might involve user-definable rules for automatically prioritizing or resolving certain types of claim conflicts.
-   **Versioning/History**: Tracking changes to claims for audit and rollback purposes.
-   **User Roles & Permissions**: More granular control over who can create, edit, and approve claims (beyond the initial navigation visibility).
-   **Bulk Import/Export**: For managing large sets of claims via CSV or other formats.

## 7. Integration with Existing System (Discovery Findings)

Based on a review of the existing codebase, the Claims Management feature will integrate as follows:

*   **API Routes**:
    *   New API routes will be created under `src/app/api/` for `products`, `ingredients`, and `claims` (e.g., `src/app/api/products/route.ts`, `src/app/api/claims/route.ts`).
    *   These routes will follow existing patterns: use `withAuth` for authentication, leverage `createSupabaseAdminClient()` for database interactions, implement standard error handling with `handleApiError`, and use `NextResponse.json` for responses.
    *   `export const dynamic = "force-dynamic";` will be used.
    *   Fallback data for build phases will be considered.
*   **Database Interactions**:
    *   The primary method for database interaction will be the Supabase client via `createSupabaseAdminClient()`.
    *   For complex claim aggregation and stacking logic, direct SQL queries using the `query()` function from `src/lib/db.ts` (which uses the `pg` Pool) may be employed if performance or complexity warrants it. This will be a secondary consideration after attempting Supabase client methods.
    *   New database migration scripts will be created in the `migrations/` directory for the `products`, `ingredients`, `product_ingredients`, and `claims` tables, including the `claim_type_enum` and `claim_level_enum` ENUM types.
*   **AI Integration**:
    *   The AI-powered review features will use the `generateTextCompletion()` function from `src/lib/azure/openai.ts`.
    *   Specific system and user prompts will be developed for:
        *   Analyzing stacked claims at preview time.
        *   Performing brand-wide claims reviews.
    *   The existing `getAzureOpenAIClient()` and `getModelName()` utilities will be used.
*   **UI Components & Pages**:
    *   New pages for managing products, ingredients, and claims, as well as the claims previewer, will be located under `src/app/dashboard/claims/` (e.g., `src/app/dashboard/claims/products/page.tsx`).
    *   These pages will adopt existing UI patterns, fetching data client-side via `useEffect` and `fetch` that call the new API routes.
    *   Standard loading, error, and empty states will be implemented.
    *   Existing `shadcn/ui` components (`Button`, `Card`, `Table`, `Input`, `AlertDialog`, `Select`, etc.) from `src/components/ui/` will be used extensively.
    *   React `useState` will be the primary method for local state management.
*   **Shared Code & Constants**:
    *   A constant for the global claim identifier (e.g., `CLAIM_COUNTRY_GLOBAL = '__GLOBAL__'`) will be added to `src/lib/constants.ts`.
    *   The `COUNTRIES` list in `src/lib/constants.ts` will be reviewed to ensure it's comprehensive for the predefined country selection dropdowns.
    *   Utility functions specific to claims management may be added to `src/lib/utils/` or a new `src/lib/claims-utils.ts`.
*   **Navigation**:
    *   A new navigation item for "Claims Management" will be added to `src/components/layout/unified-navigation.tsx` (or the relevant navigation component), respecting the permissions defined in `docs/navigation_permissions_matrix.md` (visible to Global Admins and Brand Admins only).

## 8. Phased Implementation Plan

The development of the Claims Management feature will proceed in the following phases, with database schema implementation deferred to allow for insights from API and UI development:

**Phase 1: API Design & Core Logic Development (Products, Ingredients, Claims) - In Progress**

*   **Objective**: Define API contracts, develop route handlers (initially against the planned schema, without live DB interaction or running migrations yet), and implement core business logic.
*   **Status**: Stubbed API route handlers and initial core logic for claim stacking (with mock data) have been created.
*   **Tasks**:
    1.  **Define API Signatures**: For all CRUD operations on Products, Ingredients, and Claims, as well as the Claims Preview functionality. - ✅ **DONE (as stubs)**
    2.  **Constants**:
        *   Add `CLAIM_COUNTRY_GLOBAL = '__GLOBAL__'` (or similar) to `src/lib/constants.ts`. - ✅ **DONE**
        *   Review and ensure `COUNTRIES` in `src/lib/constants.ts` is comprehensive. - ✅ **REVIEWED** (Current list deemed sufficient for initial development)
    3.  **Develop API Route Handlers (Stubbed/Mocked DB initially)**:
        *   `src/app/api/products/route.ts` (`POST`, `GET` list). - ✅ **STUBBED**
        *   `src/app/api/products/[id]/route.ts` (`GET` single, `PUT`, `DELETE`). - ✅ **STUBBED**
        *   `src/app/api/ingredients/route.ts` (`POST`, `GET` list). - ✅ **STUBBED**
        *   `src/app/api/ingredients/[id]/route.ts` (`GET` single, `PUT`, `DELETE`). - ✅ **STUBBED**
        *   `src/app/api/claims/route.ts` (`POST`, `GET` list). - ✅ **STUBBED**
        *   `src/app/api/claims/[id]/route.ts` (`GET` single, `PUT`, `DELETE`). - ✅ **STUBBED**
        *   `src/app/api/claims/preview/route.ts` (or similar). - ✅ **STUBBED**
        *   Implement authentication and authorization logic within these handlers. - Initial `withAuth` wrapper added; detailed RLS-based auth for Phase 4.
    4.  **Claims Stacking/Aggregation Logic**:
        *   Develop a robust function (e.g., in `src/lib/claims-utils.ts`) for claim collection logic based on `productId` and `targetCountryCode`. This function will operate on data structures matching the planned schema. - ✅ **DEFINED with mock logic in `src/lib/claims-utils.ts`** (DB interaction in Phase 4)
    5.  **Product-Ingredients Association Logic**:
        *   Design how product-ingredient links will be managed via API (e.g., as part of Product PUT, or dedicated endpoints). - Initial design included in Product PUT stub.

**Phase 2: UI for Core Entities & Claims Management - In Progress**

*   **Objective**: Create the user interface for managing products, ingredients, and claims. Initially, this UI may interact with stubbed API responses or use mock data if the database is not yet live.
*   **Status**: Navigation link added. Initial versions of Products, Ingredients, and Claims management pages, and the 'Add New Product' page have been created. Add/Edit modals/forms for Ingredients and Claims are pending.
*   **Tasks**:
    1.  **Navigation**: Add "Claims Management" link to `src/components/layout/unified-navigation.tsx` (visible to Global Admins, Brand Admins). - ✅ **DONE**
    2.  **Products Management Page** (`src/app/dashboard/claims/products/page.tsx`):
        *   List, create, edit, delete products. - ✅ **List created. Create page done. Edit/Delete stubs present.**
        *   Interface to associate ingredients with products. - ✅ **Done on 'Add New Product' page.**
    3.  **Ingredients Management Page** (`src/app/dashboard/claims/ingredients/page.tsx`):
        *   List, create, edit, delete ingredients. - ✅ **List created. Add/Edit functionality implemented via modal. Delete implemented.**
    4.  **Claims Management Page** (`src/app/dashboard/claims/manage/page.tsx` or integrated):
        *   Filterable list of all claims. - ✅ **List with filters created.**
        *   Claim Creation/Edit Form/Modal (Level, Entity selection, Text, Type, Country, Description). - ✅ **Add/Edit functionality implemented via modal using a dedicated form component. Delete implemented.**

**Phase 3: Claims Preview UI & AI Integration - In Progress**

*   **Objective**: Implement the UI for previewing stacked claims and integrate AI review features, using stubbed/mocked data as necessary.
*   **Status**: Initial Claims Preview page created. AI integration is pending.
*   **Tasks**:
    1.  **Claims Preview Page/Modal** (`src/app/dashboard/claims/preview/page.tsx` or modal):
        *   Inputs: Product and Country selection (including "Global"). - ✅ **DONE**
        *   Display: Stacked list of claims (initially from mocked stacking logic or stubbed API). - ✅ **DONE**
    2.  **AI Analysis API Endpoints & Logic**:
        *   Create `/api/ai/analyze-claims-stack`: Takes a list of claims, uses `generateTextCompletion()` for analysis. - ✅ **DONE (Stubbed AI Call)**
        *   Create `/api/ai/brands/[brandId]/review-all-claims`: Fetches (mocked) claims data for a brand, uses `generateTextCompletion()` for holistic review. - ✅ **DONE (Stubbed AI Call, Mock Data Fetching)**
    3.  **UI for AI Feedback**:
        *   Display AI feedback from `/api/ai/analyze-claims-stack` in the preview UI. - ✅ **DONE**
        *   Add "AI Review All Claims for Brand" button and UI to display the report from `/api/ai/brands/[brandId]/review-all-claims`. - ✅ **DONE (Modal display with Brand Selector)**

**Phase 4: Database Implementation & API Connection - Up Next**

*   **Objective**: Finalize the database schema based on any insights from previous phases, create and run migrations, and connect the developed API routes to the live database.
*   **Tasks**:
    1.  **Finalize Database Schema**: Review the planned schema in `docs/CLAIMS_MANAGEMENT.md` and make any necessary adjustments identified during API and UI development.
    2.  **Database Migrations**:
        *   Create definitive SQL migration scripts in `migrations/` for:
            *   `CREATE TYPE claim_type_enum AS ENUM ('allowed', 'disallowed', 'mandatory');`
            *   `CREATE TYPE claim_level_enum AS ENUM ('brand', 'product', 'ingredient');`
            *   `CREATE TABLE products (...)`
            *   `CREATE TABLE ingredients (...)`
            *   `CREATE TABLE product_ingredients (...)`
            *   `CREATE TABLE claims (...)` (including `chk_claim_level_reference` constraint and `UNIQUE` constraint)
        *   Run migrations to apply schema changes to the development database.
    3.  **Connect APIs to Database**:
        *   Update all API route handlers developed in Phase 1 to interact with the live Supabase database using `createSupabaseAdminClient()` or direct queries via `src/lib/db.ts` as planned.
        *   Ensure all data fetching, creation, update, and deletion operations correctly target the database.
    4.  **Test API-DB Integration**: Thoroughly test each API endpoint to ensure it correctly interacts with the database and that data integrity is maintained.

**Phase 5: Testing, Refinement, and Documentation Finalization**

*   **Objective**: Thoroughly test the entire integrated feature, refine based on feedback, and ensure all documentation is complete and accurate.
*   **Tasks**:
    1.  End-to-End Testing (UI, API, DB, AI, roles, with live data).
    2.  Performance Testing (claim stacking, brand-wide review with live data).
    3.  User Acceptance Testing (UAT) (if applicable).
    4.  Refinement (address bugs, usability issues).
    5.  Documentation Update (all relevant documents, code comments, ensuring `CLAIMS_MANAGEMENT.md` reflects the final state).

This reordered plan prioritizes API and UI development, allowing for schema adjustments before database implementation, and concludes with comprehensive testing. 