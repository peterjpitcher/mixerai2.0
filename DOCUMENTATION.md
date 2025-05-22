# MixerAI 2.0 Documentation

## Project Overview

MixerAI 2.0 is an application for creating AI-generated content with Azure OpenAI for digital marketing. The application allows users to create and manage content for different brands using customizable workflows.

### Core Technology Stack

- **Frontend**: Next.js 14 with App Router, React, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL via Supabase. For details see [Database Documentation](./docs/database.md).
- **Authentication**: Supabase Auth. For details see [Authentication and User Management](./docs/authentication.md).
- **AI**: Azure OpenAI. For details see [Azure OpenAI Integration](./docs/azure_openai_integration.md).

### Brand Colors
- **Primary Colour**: #14599f
- **Secondary Colour**: #cf0d2a

## Core Features

### 1. Brands Management
Brands are central entities, with features for profile creation, AI-powered identity generation, content vetting agency management, and visual customization (colors, icons).
For detailed information, see [Brand Management](./docs/brand_management.md).

### 2. User Management with RBAC
Users can access multiple brands with different permission levels (Admin, Editor, Viewer). Authentication is handled by Supabase.
For detailed information on authentication, user management, roles, and permissions, see [Authentication and User Management](./docs/authentication.md).

### 3. Workflow Management
Custom configurable workflows for content approval with:
- Multi-step processes
- Role-based approvals
- Content status tracking
- Email notifications

### 4. Content Generation
AI-generated content using Azure OpenAI, supporting generation via customizable Content Templates.
- Includes meta title and description (often defined within templates).
- Structured to industry best practices (guided by template structure).
For detailed information on Azure OpenAI integration, see [Azure OpenAI Integration](./docs/azure_openai_integration.md).

**New: Brand-Aware Template Prompts**
- Content Templates can now be associated with a specific Brand via a `brand_id`.
- When editing a template field's AI prompt (specifically for output fields with AI Auto-Complete), users can now insert placeholders for the associated brand's:
    - Name (`{{brand.name}}`)
    - Identity (`{{brand.identity}}`)
    - Tone of Voice (`{{brand.tone_of_voice}}`)
    - Guardrails (`{{brand.guardrails}}`)
- This allows AI prompts to be more context-aware and aligned with specific brand guidelines.
- **Database Change:** The `content_templates` table requires a new nullable `brand_id UUID` column that references `brands(id)`. A migration script should be run:
  ```sql
  ALTER TABLE content_templates
  ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
  
  -- Optional: Add an index if you expect to query by brand_id frequently
  -- CREATE INDEX idx_content_templates_brand_id ON content_templates(brand_id);
  ```
- **API Updates:**
    - `POST /api/content-templates`: Now accepts and stores `brand_id`.
    - `PUT /api/content-templates/{id}`: Now accepts and updates `brand_id`.
- **Frontend Updates:**
    - `TemplateForm` (`src/components/template/template-form.tsx`) now fetches and displays details of the associated brand if `brand_id` is present.
    - `FieldDesigner` (`src/components/template/field-designer.tsx`) modal, when editing an output field's AI prompt, provides buttons to insert the above brand-specific placeholders if a brand is associated with the template.

### 5. Tool Run History
Users can view a history of their past runs for AI-powered tools (Alt Text Generator, Metadata Generator, Content Trans-creator). This allows them to track usage, review previous inputs/outputs, and see the status of each run.
- **Features:**
    - History logged for each tool run, including inputs, outputs, status, and timestamp.
    - Dedicated history list on each tool page showing recent runs.
    - Detailed view for each history record.
- **Technical Details:**
    - Stored in the `tool_run_history` database table.
    - Accessible via `/api/me/tool-run-history` API endpoints.
- For detailed information, see [Tool Run History Feature Plan](./docs/tool_run_history_feature_plan.md).

### 6. Claims Management
Provides a system for brand teams to define, manage, and preview marketing claims associated with brands, products, and their ingredients. Supports global and country-specific claims.
For detailed information, see [Claims Management](./docs/CLAIMS_MANAGEMENT.md).

## Recent Updates and Feature Details

# MixerAI 2.0 - UI and Authentication Updates

## Changes Made

### 1. Dashboard UI Update
- Removed the Analytics tab from the root dashboard page
- Simplified the tab interface to only include the Overview tab
- Changed the TabsList grid from grid-cols-2 to grid-cols-1

### 2. User Authentication & Management
Details on user authentication, Supabase integration, user data structures, API updates for users, Row Level Security, user profiles, and the invitation system have been moved to [Authentication and User Management](./docs/authentication.md).

### 3. Missing Pages Documentation
- Created comprehensive documentation for pages that have been removed or relocated
- Developed detailed implementation guides for recreating high-priority pages
- Established a tracking system for monitoring implementation progress
- Identified dependencies and blockers for the implementation process
- Documentation available in the `/docs/missing-pages/` directory:
  - `README.md` - Overview and plan for missing pages
  - `implementation-guide.md` - Detailed implementation instructions
  - `tracking.md` - Progress tracking document

### 4. Missing Workflow Pages Implementation
- Implemented all workflow-related missing pages:
  - `/dashboard/workflows/[id]/page.tsx` - Workflow detail view
  - `/dashboard/workflows/[id]/edit/page.tsx` - Workflow edit page 
  - `/dashboard/workflows/new/page.tsx` - Workflow creation page
- Added comprehensive UI components for workflow management:
  - Step reordering functionality
  - Role and approval management
  - Assignee email management
  - Workflow validation
- Implementation currently uses mock data, with planned API integration
- Updated tracking documentation to reflect progress
- **UI Alignment**: Ensured the "Workflow Steps" section in `/dashboard/workflows/new/page.tsx` now visually and functionally mirrors the corresponding section in `/dashboard/workflows/[id]/edit/page.tsx`. This includes consistent step card layout, header controls (step number, name input, move/delete buttons), role selection UI, step description textarea with AI generation, "optional step" switch, and assignee input/display logic.

## Implementation Details

### API Route Update
The `/api/users` route now:
1. Fetches all users from Supabase Auth Admin API
2. Retrieves associated profile data from the profiles table
3. Merges the data to provide complete user information
4. Determines the highest role for each user based on permissions

### User Data Structure
```typescript
{
  id: string,
  full_name: string,
  email: string,
  avatar_url: string,
  role: string,
  created_at: string,
  last_sign_in_at: string,
  brand_permissions: Array<{
    id: string,
    brand_id: string,
    role: 'admin' | 'editor' | 'viewer'
  }>
}
```

### Routing Structure Issues Fix
- Fixed route conflicts between the `/dashboard/*` routes and the `/(dashboard)/*` route group
- Implemented proper redirects to maintain backward compatibility 

## Benefits
- Live authentication data is now visible in the Users interface
- Simplified dashboard UI focuses on the most important content
- More complete user information for better user management
- Consistent user experience between local and production environments
- Fixed routing structure prevents duplicate layouts and navigation elements
- Restored workflow management functionality with improved UI

## Requirements
- Requires SUPABASE_SERVICE_ROLE_KEY to be set in environment variables
- Needs the auth.admin.listUsers permission for the service role

## Authentication & User Management

For comprehensive details on user authentication, Supabase integration, API protection, Row Level Security, user roles, permissions, profile fields, and the user invitation system, please refer to the [Authentication and User Management](./docs/authentication.md) documentation.

# MixerAI 2.0 Documentation

## Recent Updates

### Root Page Redirect

We've implemented a smart redirection from the root page to enhance user experience:

1. **Authentication-Aware Redirection**
   - Added redirect from the root path (`/`) to either `/dashboard` or `/auth/login` based on authentication status
   - Uses server-side authentication check to determine the appropriate destination
   - Provides a seamless experience for both logged-in and anonymous users

2. **Improved User Flow**
   - Logged-in users are directed straight to the dashboard without additional clicks
   - New or unauthenticated users go directly to the login page
   - Eliminates the need for a separate landing page when working in the application

3. **Technical Implementation**
   - Implemented using Next.js App Router's redirect function
   - Server-side authentication check with Supabase
   - Ensures proper authorization before accessing protected content

### Metadata Generator Simplification
We've streamlined the Metadata Generator tool to improve its clarity and effectiveness. It now focuses exclusively on URL-based metadata generation, with an improved UI and robust Azure OpenAI integration.
For more details on its AI integration, see [Azure OpenAI Integration](./docs/azure_openai_integration.md).

### Azure OpenAI Integration Fix

We've improved the Azure OpenAI integration to ensure reliable operation across all AI-powered tools:

1. **Consistent API Endpoint Structure**
   - Standardized the API call pattern across all OpenAI functions
   - Implemented direct fetch calls with specific deployment endpoints
   - Ensured all tools use the same URL structure and authentication method

2. **Fixed Model Deployment**
   - Hardcoded the model name to "gpt-4o" which is confirmed to be working
   - Removed dependency on environment variables for model selection
   - Added comprehensive error handling and logging

3. **Enhanced Error Reporting**
   - Improved error messages with detailed API response information
   - Added request/response logging for easier debugging
   - Implemented proper error propagation to the frontend

### API Route Optimization

We've improved the build process with proper route configuration:

1. **Dynamic Route Handling**
   - Added the `dynamic = "force-dynamic"` directive to all API routes using authentication
   - Fixed build warnings related to cookie usage in static routes
   - Created an automated script (`scripts/fix-dynamic-routes.sh`) to ensure all API routes are properly configured

2. **Build Performance**
   - Improved build times by correctly marking routes as dynamic or static
   - Fixed issues with cookies and authentication in static exports
   - Reduced the number of build warnings and errors

3. **Authentication Consistency**
   - Ensured all authenticated API routes properly mark themselves as dynamic
   - Maintained consistent behavior between development and production
   - Improved error handling for authentication failures

### Brand Page Fixes

We've fixed and enhanced the brand detail and edit pages to provide comprehensive brand management functionality:

1. **Fixed Broken Redirects**
   - Resolved issues where the brand detail page was incorrectly redirecting to a non-existent route (`/brands/[id]`)
   - Fixed the brand edit page that was incorrectly redirecting to a non-existent route (`/brands/[id]/edit`)
   - Implemented proper brand pages at `/dashboard/brands/[id]` and `/dashboard/brands/[id]/edit`

2. **Enhanced Brand Detail UI**
   - Created a tabbed interface with Overview, Brand Identity, Content, and Workflows sections
   - Added brand statistics including content count and workflow count
   - Implemented proper loading, error, and not-found states
   - Responsive design that works on all device sizes

3. **Comprehensive Brand Edit Interface**
   - Implemented a complete brand editing experience with Basic Details and Brand Identity tabs
   - Added brand identity generation functionality with AI support
   - Created a side panel with brand preview and recommendations
   - Added proper form validation and error handling

4. **API Enhancements**
   - Updated the GET `/api/brands/[id]` endpoint to include content and workflow counts
   - Improved brand identity generation with country and language support
   - Added better error handling and fallback data for unreliable connections
   - Improved performance with optimized database queries

5. **Navigation Integration**
   - Added proper links between view, edit and list pages
   - Consistent with overall application navigation structure
   - Intuitive user flow for brand management

### Unified Navigation System

We've implemented a comprehensive navigation system update to improve the user experience:

1. **Framework-Level Redirects**
   - Added Next.js redirects in next.config.js for better performance
   - Replaced client-side redirects with server-side redirects
   - Improved routing for content type pages (/dashboard/content/{type})

2. **Unified Navigation Component**
   - Created a new UnifiedNavigation component that replaces multiple competing navigation systems
   - Implemented expandable content type submenu for better organization
   - Uses Next.js useSelectedLayoutSegments() for accurate active state tracking
   - Supports automatic section expansion based on current route

3. **Dashboard Home Page**
   - Added a proper dashboard home page with quick access cards
   - Direct links to different content types
   - Improved organization of key features
   - Quick action buttons for common tasks

4. **Detailed Documentation**
   - Added comprehensive documentation in docs/NAVIGATION_SYSTEM.md
   - Guidelines for adding new navigation items
   - Best practices for future enhancements
   - Plans for automated testing

For more details, see the full documentation in [docs/NAVIGATION_SYSTEM.md](docs/NAVIGATION_SYSTEM.md).

### AI Suggestion Feature Update (Content Templates & Generator)

We have updated the AI-powered suggestion feature for input fields within content templates and the content generator:

1.  **Template Editor (`/dashboard/templates/[id]/edit`)**:
    *   The button to directly test/generate suggestions from within the template field editor (FieldDesigner component) has been **removed**. This simplifies the template creation interface, focusing it on defining the structure and AI prompts rather than immediate testing of suggestions.

2.  **Content Generator (`/dashboard/content/new?template=[templateId]`)**:
    *   When using a template to generate content, input fields that are configured with "AI Suggestions" enabled and have an AI prompt will now display a **"Suggest" button** directly next to the input field.
    *   Clicking this button will trigger an API call to get an AI-generated suggestion for that specific field, based on its configured prompt and any other relevant input field values (if the prompt uses placeholders).
    *   The input field will be populated with the suggestion upon successful generation.

3.  **New API Endpoint (`/api/ai/suggest`)**:
    *   A new POST API endpoint has been created to handle these on-demand suggestions.
    *   It accepts a `prompt` (and optionally `brand_id` for future context).
    *   It utilizes the `generateTextCompletion` function from the Azure OpenAI library to generate a concise suggestion.
    *   This provides a dedicated and streamlined way to get quick suggestions for individual fields without performing a full content generation pass.

This change aims to improve the user workflow by providing AI assistance directly where it's needed during content creation, while keeping the template definition process focused.

## Side Navigation User-Specific Visibility

As of the last review, the side navigation components (`src/components/layout/side-navigation.tsx` and `src/components/layout/side-navigation-v2.tsx`) **do not** implement any logic to hide or show navigation items based on user roles or permissions.

All navigation links defined within these components are statically rendered and will be visible to all users who have access to the dashboard. There is no conditional rendering of navigation items based on user attributes. If user-specific navigation is a requirement, this functionality will need to be implemented.

## Brand UI Enhancements

We've implemented significant UI improvements to the brand creation and editing interfaces:

1. **Two-Column Layout**
   - Brand edit and new pages now use a responsive two-column layout
   - Left column contains form fields and controls
   - Right column shows brand preview and helpful information
   - Stacks vertically on mobile, side-by-side on desktop

2. **Card-Based Content Type Selection**
   - Improved content type selection with card-based interface
   - Each card shows the content type name and description
   - Visual indicators for selected content types
   - AI Taskforce managed indicator for governance

3. **Enhanced Brand Identity Generation**
   - Improved URL input for brand identity generation
   - Storage of input URLs for future reference
   - British English usage throughout the UI
   - Better field explanations for each section

4. **Agency Prioritization**
   - Color-coded badges for agency priority (high/medium/low)
   - Ability to adjust priority levels
   - Support for adding custom agencies
   - Proper storage of user-added agencies

5. **Missing API Routes**
   - Added the scrape-url API endpoint for web content extraction
   - Implemented build-time detection to provide mock data during builds

6. **Error Pages**
   - Added error.tsx and global-error.tsx for proper error handling
   - Consistent styling with the rest of the application

7. **Database Schema Updates**
   - Added website_urls column to brands table
   - Added user_added_agencies column to brands table

## Running, Building, and Deploying the Application

For details on how to run the application in development, build it for production, understand deployment optimizations (like dynamic API routes), and configure it for a custom domain, please refer to the [Deployment and Operations Guide](./docs/deployment.md).

## API Reference

For a detailed list of API endpoints, including those for user management, brands, content, workflows, and AI tools, please refer to the [API Reference](./docs/api_reference.md).

## Component Structure

1. **Layout Components**
   - `TwoColumnLayout` - Responsive two-column layout component

2. **Brand Components**
   - Brand edit page - `/brands/[id]/edit/page.tsx`
   - Brand new page - `/brands/new/page.tsx`
   - Brand detail page - `/brands/[id]/page.tsx`

3. **UI Components**
   - Card-based content type selection
   - Agency priority management
   - Custom agency dialog

## Database Schema

The brands table schema has been updated to include:

```sql
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS website_urls TEXT,
ADD COLUMN IF NOT EXISTS user_added_agencies JSONB;
```

These columns store:
- `website_urls` - The URLs used for brand identity generation
- `user_added_agencies` - Custom agencies added by users

## Future Enhancements

Planned improvements include:

1. Better integration with content workflows
2. Enhanced brand identity generation with more AI options
3. Improved user management and permissions
4. Additional content vetting features

## Azure OpenAI Integration & AI Tools

MixerAI 2.0 extensively uses Azure OpenAI for various features including brand identity generation, content creation through templates, workflow description auto-generation, and several technical tools like Metadata Generator, Alt Text Generator, and Content Trans-Creator.

For comprehensive details on the Azure OpenAI setup, core principles (including the strict "No Fallback Generation" policy), client configuration, error handling, brand context integration, specific AI tool functionalities, prompt strategies, and testing/debugging methods, please refer to the dedicated [Azure OpenAI Integration](./docs/azure_openai_integration.md) documentation.

### Technical Tools

MixerAI 2.0 includes several technical tools to enhance content creation workflows, primarily powered by Azure OpenAI:

-   **Metadata Generator**: Generates SEO-optimised meta titles and descriptions from webpage URLs.
-   **Alt Text Generator**: Creates accessible alt text for images.
-   **Content Trans-Creator**: Trans-creates content across languages and cultures.

Details on their AI integration and specific functionalities can be found in the [Azure OpenAI Integration](./docs/azure_openai_integration.md) document.

## Brand Management Features

MixerAI 2.0 provides robust features for managing brands, including UI enhancements for brand creation/editing, AI-driven brand identity generation (utilizing URL analysis, regional adaptation, and multi-language support), management of content vetting agencies, and brand-specific visual elements like colors and icons.

- Create and edit brands with basic information
- Generate comprehensive brand identity using AI from website URLs
- Country-specific content vetting agencies suggestions
- Tabbed interface separating basic details from AI-generated content

## Content Vetting Agencies

Content vetting agencies are displayed as a selectable list of checkboxes under the "Suggested Agencies for [Country]" section. When a brand identity is generated via AI, the system will suggest 10 relevant vetting agencies specific to the brand's country, industry, and content needs. These agencies are dynamically generated by the AI based on its analysis of the brand's website content and the selected country.

Users can select from these AI-generated suggested agencies to comply with relevant content regulations. The selected agencies are stored as a comma-separated list in the `content_vetting_agencies` field in the database.

## Brand Color Generation

The system now uses AI to analyze a brand's website and automatically generate an appropriate color that reflects the brand's visual identity. This color is:

- Generated when creating a new brand or regenerating brand identity information
- Stored as a HEX color code in the `brand_color` field in the database
- Used visually in the UI to identify the brand
- Editable via a color picker by the user if they wish to change it
- Customized specifically for each brand based on AI analysis of their website colors and design elements

The brand color enhances visual recognition and consistency throughout the application, making it easier for users to quickly identify and work with different brands.

## User Interface Components

### Brand Visualization Components

#### BrandIcon Component

A consistent way to display brand avatars throughout the application using the brand's color:

```typescript
// src/components/brand-icon.tsx
export function BrandIcon({ 
  name, 
  color = "#3498db", 
  size = "md", 
  className 
}: BrandIconProps) {
  // Implementation details
}
```

- **Features**:
  - Displays the first letter of the brand name in a circular avatar
  - Uses the brand's color for text and background (with opacity)
  - Supports different sizes (sm, md, lg)
  - Fully customizable through className prop
  - Falls back to default blue (#3498db) if no color is provided

- **Usage Examples**:
  - Brand cards in dashboard and brand listing
  - Brand selection dropdowns
  - Content listing where brand is displayed
  - Anywhere a brand needs visual identification

This component enhances visual recognition and consistency throughout the application, making it easier for users to quickly identify and work with different brands.

### User Invitation Page - Brand Assignment Update

The user invitation page (`/dashboard/users/invite`) has been updated to improve flexibility in assigning new users to brands.

- **Previous Behaviour**: Users could be assigned to a single brand via a dropdown menu during the invitation process.
- **New Behaviour**: The brand assignment UI has been changed from a single-select dropdown to a list of checkboxes. This allows administrators to assign a new user to multiple brands simultaneously when sending an invitation.
- **Technical Changes**:
    - The frontend state management in `src/app/dashboard/users/invite/page.tsx` was updated to handle an array of `brand_ids` instead of a single `brand_id`.
    - The UI now renders checkboxes for each available brand.
    - The API endpoint `/api/users/invite` will need to be (or has been) updated to accept an array of `brand_ids` in the request payload to support this multi-brand assignment.

This change streamlines the onboarding process for users who need access to several brands from the outset.

## Future Improvements

Potential future improvements include:

- Implementing retry logic for transient Azure OpenAI API errors
- Adding more detailed validation for environment variables at startup
- Enhancing the AI-generated content with additional examples and references 

## Workflow User Assignment

The MixerAI 2.0 application now supports assigning users to workflow stages during the workflow creation and editing process.

### Key Features

- **User Assignment by Email**: Users can be assigned to workflow stages by email addresses
- **Existing Users Recognition**: If an email belongs to an existing user, they are automatically assigned
- **User Invitation**: If an email doesn't match an existing user, an invitation is created
- **Role-Based Access**: Each workflow stage has an associated role (editor, admin, etc.)
- **Multiple Assignees**: Each workflow stage can have multiple assignees

### Technical Implementation

#### Database Schema

The workflow schema uses a JSONB column to store steps with assignees:

```json
{
  "steps": [
    {
      "id": 1,
      "name": "Draft Review",
      "description": "Initial review by the content author",
      "role": "editor",
      "approvalRequired": true,
      "assignees": [
        {"email": "user1@example.com", "id": "user-uuid-if-exists"},
        {"email": "user2@example.com", "id": "user-uuid-if-exists"}
      ]
    }
  ]
}
```

A separate `workflow_invitations` table tracks invitations for users not yet in the system:

```sql
CREATE TABLE workflow_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(workflow_id, step_id, email)
);
```

#### User Interface

The workflow creation and editing pages include:

- Input field for entering assignee emails
- List of current assignees with removal option
- Email validation to ensure correct format
- Prevention of duplicate email assignments

#### API Implementation

The API handles:
1. Checking if an assignee email belongs to an existing user
2. Creating invitations for new users
3. Tracking assignee status in the workflow steps
4. Managing invitation lifecycle (pending, accepted, declined)

### Usage

1. Create or edit a workflow
2. Add steps as needed
3. For each step, enter email addresses to assign users
4. Save the workflow
5. Users will either:
   - See their assignments directly (if already in the system)
   - Receive an invitation email (if not yet a user)

### Future Enhancements

- Email notification system integration
- User invitation acceptance flow
- Assignment history tracking
- Reassignment capabilities 

## Workflow Management Enhancements

The workflow management in MixerAI 2.0 has been enhanced with several usability improvements:

### Key Features

#### Improved Role Selection
- **Role Checkboxes with Descriptions**: Replaced dropdown menu with visual checkbox cards
- **Role Context**: Each role now displays a description of its responsibilities
- **Visual Clarity**: Selected roles are highlighted with a border and background color

#### Step Reordering
- **Up/Down Controls**: Added buttons to move steps up or down in the workflow
- **Step Numbering**: Clear visual indicators of step order with numbered badges
- **Drag Handles**: Intuitive controls for adjusting workflow sequence

#### Optional Steps
- **Clearer Terminology**: Changed "Require approval" to "Optional step" for better clarity
- **Enhanced Description**: Added explanation of what optional steps mean in the workflow
- **Toggle Interface**: Simple checkbox toggle with descriptive label

#### Assignee Management
- **Improved Styling**: Assignee emails now use badges for better visibility
- **Easier Removal**: One-click removal of assignees from workflow steps
- **Simplified Addition**: Enter key support for quickly adding multiple assignees

#### Auto-generate Description
- **Brand Context Awareness**: Descriptions now consider brand language and geography
- **Improved Error Handling**: Better feedback when description generation fails
- **Optimized State Updates**: Prevents UI refreshes that could cause user position loss

### Technical Improvements

#### Azure OpenAI Integration
- **Fixed Client Configuration**: Proper endpoint construction for Azure OpenAI
- **Error Handling**: Detailed error information for troubleshooting
- **API Versioning**: Updated to use the latest API version for better compatibility

#### User Interface Enhancements
- **Consistent Styling**: Harmonized UI elements across new and edit workflow pages
- **Improved Layout**: Better spacing and visual hierarchy for workflow steps
- **Responsive Design**: Layout adjustments for different screen sizes

### Usage

1. Create or edit a workflow
2. Use the step reordering buttons to arrange workflow steps in the desired sequence
3. Select the appropriate role for each step using the descriptive checkbox cards
4. Toggle "Optional step" for steps that can be skipped in certain cases
5. Use the "Auto-generate" button to quickly create professional step descriptions
6. Add assignees by email to each step in the workflow
7. Remove assignees with a single click if needed

The enhanced workflow management provides a more intuitive, user-friendly interface that makes creating and managing complex content workflows simpler and more efficient.

## Workflow API `user_role` Enum Fix (YYYY-MM-DD)

An error was identified in the `POST /api/workflows` endpoint when creating new workflows with step assignees.

### Problem
- The API endpoint was attempting to use the role "brand" when creating workflow invitations for step assignees.
- The `user_role` enum in the database is defined as `('admin', 'editor', 'viewer')` and does not include "brand".
- This mismatch caused a PostgreSQL error: `invalid input value for enum user_role: "brand"` when the `create_workflow_and_log_invitations` RPC function was called.

### Solution Implemented
- Modified `src/app/api/workflows/route.ts` in the `POST` handler.
- The logic for populating `invitationItems` for the RPC call was updated.
- The `role` assigned to an invitation item is now explicitly checked against the valid enum values (`'admin'`, `'editor'`, `'viewer'`).
  ```typescript
  // In src/app/api/workflows/route.ts, inside the POST handler:
  invitationItems.push({
    // ... other properties
    role: ['admin', 'editor', 'viewer'].includes(step.role) ? step.role : 'editor',
    // ... other properties
  });
  ```
- If `step.role` (coming from the frontend request) is one of the valid roles, it is used. Otherwise, it defaults to `'editor'`.
- This ensures that only valid roles are passed to the database function, preventing the enum error.

## Testing and Debugging Tools

### OpenAI Testing Tools

MixerAI 2.0 includes a dedicated page for testing and debugging the Azure OpenAI integration at `/openai-test`. This page provides various tools to help developers:

- Test brand identity generation
- Test content generation
- Test Azure OpenAI connectivity
- View environment configuration
- Detect whether content is truly AI-generated or uses fallback templates

These tools are essential for diagnosing issues with AI content generation and verifying that Azure OpenAI is properly configured and working. For detailed information on using these tools, see [OPENAI_TESTING_TOOLS.md](docs/OPENAI_TESTING_TOOLS.md).

Key features:
- AI versus template detection through heuristic analysis
- Timing information for performance monitoring
- Raw API response inspection
- Direct API testing for any endpoint
- Environment configuration display 

## UI Components

### Footer and Release Notes

The application now includes a footer component with links to important pages:

- **Implementation**: The footer is implemented in `src/components/layout/root-layout-wrapper.tsx` and appears on all main pages
- **Release Notes**: A dedicated page at `/release-notes` displays version history and changes
- **Other Pages**: Links to Privacy Policy, Terms of Service and GitHub repository

The footer provides users with easy access to key information and helps maintain a professional appearance across the application.

Release notes are structured with:
- Version numbering (following semantic versioning)
- Release dates
- Categorized changes (new features, improvements, bug fixes)

See `docs/RELEASE_NOTES.md` for details on how to update the release notes for future versions.

## Recent Changes

### UI and Layout Improvements (June 2023)

- **Accordion-style Grouping**: Implemented accordion UI for grouping workflows by brand
- **Auto-generate Feature**: Added workflow step description generation on both new and edit workflow pages
- **Culinary Role**: Added Culinary reviewer role for food content review
- **Footer and Release Notes**: Added application footer with release notes, privacy policy, and terms of service pages

## Brand Identity Generation

The application features a brand identity generation system that uses Azure OpenAI to analyze website URLs and generate comprehensive brand profiles.

### Brand Identity Generation Process

1. **URL Collection**: Users provide one or more URLs related to their brand
2. **AI Analysis**: The system analyzes the URLs to extract brand-related information
3. **Profile Generation**: A comprehensive brand profile is generated with:
   - Brand identity description
   - Tone of voice
   - Content guardrails
   - Recommended vetting agencies (with priority levels)
   - Suggested brand color (in hex format)

### Implementation Details

#### API Endpoints

- `/api/brands/identity` - Accepts brand name and URLs, returns generated brand identity content
- `/api/scrape-url` - Extracts content from URLs for analysis

#### Database Schema

The brands table includes these fields for storing brand identity information:

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website_url TEXT,
  website_urls TEXT, -- Stores multiple URLs as newline-separated strings
  country TEXT,
  language TEXT,
  brand_identity TEXT,
  tone_of_voice TEXT,
  guardrails TEXT,
  content_vetting_agencies TEXT,
  user_added_agencies JSONB, -- Stores custom agencies as JSON
  brand_color TEXT,
  approved_content_types JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Error Handling

The brand identity generation system includes several layers of error handling:

1. **Input Validation**: Validates brand name and URLs before processing
2. **API Fallbacks**: Falls back to template-based generation if OpenAI API fails
3. **JSON Parsing**: Robust parsing of AI responses with fallback mechanisms
4. **Default Values**: Provides sensible defaults for all fields if specific values can't be generated

### Regional Content Adaptation

A major enhancement to the brand identity generation system is the ability to adapt content based on regional context:

#### Country and Language Awareness

1. **Regional Context Parameters**:
   - The API now accepts `country` and `language` parameters
   - These parameters are used to generate region-specific content
   - Country codes are mapped to full country names for better context

2. **Localized Content Generation**:
   - Brand identity descriptions include country-specific references
   - Tone of voice recommendations adapt to regional communication styles
   - Content guardrails incorporate regional compliance considerations

3. **Country-Specific Vetting Agencies**:
   - The system provides relevant regulatory agencies based on country
   - Each country has its own set of recommended agencies
   - Agency priorities are adjusted based on brand industry and country
   - The Advertising Standards Authority (ASA) is always set as high priority for UK brands

4. **Fallback Templates with Regional Context**:
   - When AI generation fails, fallback templates include regional references
   - Different industry templates are available (food, technology, health, fashion, general)
   - Each template incorporates country-specific elements when available

#### Technical Implementation

1. **Build-Time Detection**:
   - The API includes sophisticated build-time detection
   - During builds, mock data is returned to prevent API calls
   - This ensures successful builds even when external services are unavailable

2. **Enhanced Debugging**:
   - Comprehensive logging throughout the generation process
   - Detailed error reporting for troubleshooting
   - Test script (`scripts/test-brand-identity.js`) for validating functionality

3. **URL Content Extraction**:
   - The `/api/scrape-url` endpoint extracts relevant content from brand websites
   - Extracts titles, descriptions, headings, and body content
   - Provides this information to the AI for more accurate brand analysis

### Recent Updates (August 2023)

- Enhanced brand identity generation with country and language context
- Fixed agency prioritization to ensure ASA always appears as high priority
- Implemented improved fallback templates with regional references
- Added comprehensive testing and debugging tools
- Created a dedicated URL scraping endpoint for website content extraction
- Improved error handling and logging throughout the generation process

## Brand Identity Multi-Language Support

The MixerAI 2.0 application now supports generating brand identity content in multiple languages based on the brand's country and language settings.

### Key Features

- **Language-Specific Generation**: Brand identity content is generated in the language specified in the brand settings
- **Explicit Language Instructions**: The OpenAI prompt now includes clear instructions to generate content in the specified language
- **Country-Language Awareness**: The system combines country and language information for more accurate localized content
- **UI Language Indicators**: The interface displays which language is being used for generation
- **Fallback Content Translation**: Even fallback templates now attempt to respect language preferences

### Technical Implementation

The language support is implemented through several components:

#### 1. API Prompt Enhancement

The `src/app/api/brands/identity/route.ts` now includes explicit language instructions in the OpenAI prompt:

```typescript
const userMessage = `Create a comprehensive brand identity profile for "${name}" based on the following website content:
    
${contents.map((content, i) => `URL ${i+1}: ${validUrls[i]}\n${content.substring(0, 500)}...\n`).join('\n')}

The brand operates in ${countryName} and communicates in ${language}.

IMPORTANT: Generate ALL content in the "${language}" language. The entire response must be written in this language.

// ... remaining prompt ...
```

#### 2. UI Language Indicators

The brand identity generation UI now shows which country and language the content will be generated for:

```tsx
<div className="text-xs text-muted-foreground mb-4 flex items-center">
  <Info className="h-3 w-3 mr-1" />
  <span>
    Content will be generated for {countryName} in {languageName}.
  </span>
</div>
```

#### 3. Response Handling

The response handling code has been updated to properly process content in any language:

```typescript
// Set brand with generated content
const updatedBrand = {
  ...brand,
  brand_identity: data.data.brandIdentity || '',
  tone_of_voice: data.data.toneOfVoice || '',
  guardrails: guardrailsContent,
  // ... other fields ...
};
```

### Benefits

- **Global Brand Support**: Better support for brands operating in non-English markets
- **Authentic Local Content**: Generated content that truly reflects local language and culture
- **Consistent Language Experience**: All brand identity elements (identity, tone, guardrails) in the same language
- **Improved AI Response Quality**: More accurate content by explicitly instructing the AI about language requirements

### Supported Languages

The system supports all languages available in the LANGUAGES constant, including but not limited to:

- English (various locales)
- Spanish
- French
- German
- Italian
- Portuguese
- Dutch
- And many more

The language selection is directly tied to the brand's language setting in the basic details tab.

## UI Consistency Between Brand Pages

We've ensured consistency between the brand creation and editing experiences:

### Standardized Layout
- Both `/brands/new` and `/brands/[id]/edit` pages now share identical layouts
- The same two-tab interface (Basic Details and Brand Identity)
- Consistent two-column layout in the Brand Identity tab

### Custom Agency Support
- Both pages now support adding, editing, and removing custom regulatory agencies
- Custom agencies include name, description, and priority settings
- Visual distinction between standard and custom agencies

### Error Handling Improvements
- Consistent handling of different response formats from the API
- Better fallback content generation with appropriate user notifications
- Clear validation messages for URL inputs
- Type-safe handling of guardrails content (array vs string)

## Application Structure: Routing and Navigation

MixerAI 2.0 uses a unified routing structure centered around the `/dashboard` prefix for authenticated pages. A comprehensive navigation system, including a primary sidebar, facilitates user interaction within the dashboard.

For detailed information on:
- The current application route structure (including dashboard, auth, and API routes).
- Handling of legacy routes via redirects.
- The `UnifiedNavigation` component and overall navigation system (linking to `docs/NAVIGATION_SYSTEM.md`).
- The history and technical details of the Route Cleanup and Consolidation Initiative (linking to relevant planning and report documents).

Please refer to the main [Routing and Navigation Guide](./docs/routing_and_navigation.md).

## 🛠️ Technical Tools

MixerAI 2.0 includes several technical tools to enhance content creation workflows:

### Metadata Generator
- **Purpose**: Generates SEO-optimised meta titles and descriptions from webpage URLs
- **Features**:
  - Scrapes webpage content and analyzes it with Azure OpenAI
  - Creates language-specific and country-specific metadata
  - Follows SEO best practices for title and description length
  - Easy copy-to-clipboard functionality
- **API**: `POST /api/tools/metadata-generator`
- **UI**: `/dashboard/tools/metadata-generator`
- **Update**: Now exclusively supports URL-based metadata generation (content-based option removed)

### Alt Text Generator
- **Purpose**: Creates accessible alt text for images to improve accessibility and SEO
- **Features**:
  - Analyzes image content using Azure OpenAI's image understanding
  - Generates concise, descriptive alt text following accessibility best practices
  - Supports multiple languages based on brand settings
  - Image preview and copy-to-clipboard functionality
- **API**: `POST /api/tools/alt-text-generator`
- **UI**: `/dashboard/tools/alt-text-generator`

### Content Trans-Creator
- **Purpose**: Trans-creates content across languages and cultures (beyond simple translation)
- **Features**:
  - Adapts content to be culturally relevant, not just linguistically accurate
  - Preserves original meaning while making it natural to native speakers
  - Supports multiple language and country combinations
  - Maintains tone and brand voice across languages
- **API**: `POST /api/tools/content-transcreator`
- **UI**: `/dashboard/tools/content-transcreator`

## Content and Workflow Management

MixerAI 2.0 features a flexible Content Template System for creating diverse content types with AI assistance. Content then moves through configurable workflows for review and approval, with features like role-based assignments, user invitations for workflow steps, and AI-powered step description generation.

For comprehensive details, see:
- [Content Creation and Workflow Management Guide](./docs/content_and_workflows.md)
- [Content Template System Documentation](./docs/CONTENT_TEMPLATE_SYSTEM.md)
- [User Flows Documentation](./docs/user_flows.md)

## Navigation and Workflow Page Error Fix (YYYY-MM-DD)

A recent issue was identified where the content templates were not loading in the sidebar navigation's "Content" menu, and a related "Unknown error" was appearing on the `/dashboard/workflows` page.

### Problem
- The `unified-navigation.tsx` component was expecting an API response with a `templates` key when fetching content templates from `/api/content-templates`.
- The `/api/content-templates/route.ts` was returning the list of templates under a `data` key instead of `templates`.
- This mismatch caused the `fetchTemplates` function in `unified-navigation.tsx` to fail silently for the list, leading to an empty "Content" submenu and an "Unknown error" log when `data.error` was also undefined.

### Solution Implemented
- Modified `src/app/api/content-templates/route.ts` to change the response key from `data` to `templates` when returning all content templates.
  ```typescript
  // In src/app/api/content-templates/route.ts
  return NextResponse.json({ 
    success: true, 
    templates: templatesData // Changed from 'data: templatesData'
  });
  ```
- This change ensures that the frontend component `unified-navigation.tsx` receives the data in the expected format, allowing it to correctly populate the navigation and resolving the associated error on the workflows page.

## AI Integration Testing

MixerAI 2.0a includes a comprehensive suite of tools for testing and debugging the Azure OpenAI integration:

- **Quick OpenAI Test**: A streamlined interface for testing Azure OpenAI with minimal configuration
- **System Status Panel**: Real-time connection status for all system components
- **Environment Configuration**: Detailed information about your environment setup
- **Advanced Testing Tools**: Specialized tools for testing different aspects of the AI integration

For detailed information about these tools, see [OpenAI Test Tool Documentation](docs/OPENAI_TEST_TOOL.md).

Key features:
- AI versus template detection through heuristic analysis
- Timing information for performance monitoring
- Raw API response inspection
- Direct API testing for any endpoint
- Environment configuration display 

## User Invitation System Enhancements

### Enhanced Error Handling

The `inviteNewUserWithAppMetadata` function has been enhanced to handle metadata update failures more robustly. If the metadata update fails, the function now attempts to delete the user to maintain security. If the deletion also fails, it logs the error for manual review and returns a critical error message.

### Testing Setup

Jest has been set up as the testing framework for the project. Test cases have been written for the `inviteNewUserWithAppMetadata` function to verify its functionality. These tests cover:

1. **Successful Invitation and Metadata Update:**
   - Verifies that a new user is invited and their `app_metadata` is updated successfully.

2. **Handling Metadata Update Failure:**
   - Tests the scenario where the metadata update fails, ensuring the user is deleted to maintain security.

The tests have been executed successfully, confirming the function's robustness.

### Project Documentation

The project documentation has been updated to reflect the current state of the user invitation system and related components. This includes details about the enhanced error handling and the testing setup.

## Database and Migrations

For comprehensive details on database connection methods, the full schema (including tables like `profiles`, `brands`, `content`, `workflows`, `user_brand_permissions`, `workflow_invitations`, etc.), Row Level Security (RLS) policies, and the migration strategy, please refer to the [Database Documentation](./docs/database.md).

## Content Lifecycle & Workflow Management

MixerAI 2.0 provides a comprehensive Content Lifecycle & Workflow Management system, enabling users to create, review, and publish content efficiently.

### Key Features

- **Content Templates**: Define the structure and fields for various content types (blog posts, social media updates, product descriptions, etc.)
- **Workflow Templates**: Create customizable workflows for content approval, including multi-step processes, role-based approvals, and content status tracking
- **Content Creation**: Utilize AI to generate content based on templates, with the ability to customize and refine the output
- **Workflow Assignment**: Assign content to workflows, with each workflow step having a specific role (editor, admin, etc.) and optional approval requirement
- **User Tasks**: Automatically create tasks for users assigned to workflow steps, allowing them to review and approve content
- **Email Notifications**: Send email notifications to users for task assignments, approvals, and rejections
- **Content Status Tracking**: Track the status of content throughout the workflow (draft, in review, approved, rejected, published)
- **Version History**: Maintain a version history for content, allowing users to revert to previous versions if needed
- **Content Archiving**: Archive content that is no longer needed, while keeping its version history for reference

### Workflow Initialization for New Content

When new content is created and associated with a workflow, its `current_step` is initialized to `0` (the index of the first step in the workflow's `steps` array) by the content creation UI.

A database trigger (`handle_new_content_workflow_assignment` on the `content` table) automatically creates tasks in the `user_tasks` table for all users assigned to this initial step (index 0) of the workflow.

(Actual content fields and lifecycle stages are defined by the `content` table, the chosen `content_template`, and the assigned `workflow`.)

### Workflow Management & Key Features

#### Improved Role Selection
- **Role Checkboxes with Descriptions**: Replaced dropdown menu with visual checkbox cards
- **Role Context**: Each role now displays a description of its responsibilities
- **Visual Clarity**: Selected roles are highlighted with a border and background color

#### Step Reordering
- **Up/Down Controls**: Added buttons to move steps up or down in the workflow
- **Step Numbering**: Clear visual indicators of step order with numbered badges
- **Drag Handles**: Intuitive controls for adjusting workflow sequence

#### Optional Steps
- **Clearer Terminology**: Changed "Require approval" to "Optional step" for better clarity
- **Enhanced Description**: Added explanation of what optional steps mean in the workflow
- **Toggle Interface**: Simple checkbox toggle with descriptive label

#### Assignee Management
- **Improved Styling**: Assignee emails now use badges for better visibility
- **Easier Removal**: One-click removal of assignees from workflow steps
- **Simplified Addition**: Enter key support for quickly adding multiple assignees

#### Auto-generate Description
- **Brand Context Awareness**: Descriptions now consider brand language and geography
- **Improved Error Handling**: Better feedback when description generation fails
- **Optimized State Updates**: Prevents UI refreshes that could cause user position loss

### Technical Improvements

#### Azure OpenAI Integration
- **Fixed Client Configuration**: Proper endpoint construction for Azure OpenAI
- **Error Handling**: Detailed error information for troubleshooting
- **API Versioning**: Updated to use the latest API version for better compatibility

#### User Interface Enhancements
- **Consistent Styling**: Harmonized UI elements across new and edit workflow pages
- **Improved Layout**: Better spacing and visual hierarchy for workflow steps
- **Responsive Design**: Layout adjustments for different screen sizes

### Usage

1. Create or edit a workflow
2. Use the step reordering buttons to arrange workflow steps in the desired sequence
3. Select the appropriate role for each step using the descriptive checkbox cards
4. Toggle "Optional step" for steps that can be skipped in certain cases
5. Use the "Auto-generate" button to quickly create professional step descriptions
6. Add assignees by email to each step in the workflow
7. Remove assignees with a single click if needed

The enhanced workflow management provides a more intuitive, user-friendly interface that makes creating and managing complex content workflows simpler and more efficient.

## Session Summary: Multi-Issue Resolution (Date of Session)

This session addressed several key issues and feature enhancements within the MixerAI 2.0a project:

**1. Global Admin Edit Permissions & Sidebar Navigation:**
    *   **Authorization Fix**: Modified `src/app/api/brands/[id]/route.ts` to allow users with a global 'admin' role to edit brand profiles without explicit brand admin rights. The `isBrandAdmin` function was updated to bypass brand-specific permission checks for global admins.
    *   **Sidebar Fix**: Resolved sidebar navigation duplication by consolidating links within `unified-navigation.tsx`.

**2. Workflow Assignee Changes Not Saving:**
    *   **Problem**: Changes to workflow assignees were not being saved correctly to the database.
    *   **Initial Approach**: Simplified logic for handling new/temporary assignees, focusing on resolving existing users by email.
    *   **Refinement**: Removed the feature to invite new users directly from the workflow edit page, setting `p_new_invitation_items` to `null` in the relevant RPC call.
    *   **Debugging & Resolution**: Added logging to trace email lookup issues. Resolved the problem by implementing email normalization (trimming whitespace, converting to lowercase) before database queries in `src/app/api/workflows/[id]/route.ts` (within the `update_workflow_and_handle_invites` RPC call logic, specifically for processing `p_assignee_emails`).

**3. Build and Deployment:**
    *   Successfully executed `npm run build`.
    *   Committed changes to the `main` branch with the message "Fix authorization logic for global admin users and streamline workflow assignee handling."
    *   Pushed changes to the remote repository.
    *   Created and pushed a new branch `minor-adjustments` for subsequent work.

**4. Automatic Workflow Description Generation Not Working:**
    *   **Problem**: Workflow descriptions were not being automatically generated upon creation or editing of workflows.
    *   **Investigation**: Discovered a mock `callOpenAI` function in `src/app/api/ai/generate-workflow-description/route.ts` instead of a real AI call.
    *   **Fix Implementation**:
        *   Added a new generic text completion function `generateTextCompletion(systemPrompt, userPrompt, maxTokens, temperature)` to `src/lib/azure/openai.ts`, utilizing `getAzureOpenAIClient()` and `getModelName()` for actual Azure OpenAI calls.
        *   Updated `src/app/api/ai/generate-workflow-description/route.ts` to remove the mock function and use the new `generateTextCompletion` with appropriate prompts for generating workflow descriptions.
        *   Verified that `src/app/api/workflows/route.ts` (create workflow) and `src/app/api/workflows/[id]/route.ts` (update workflow) correctly call the `/api/ai/generate-workflow-description` endpoint and save the returned description.

**5. Content Filtering and UI Adjustments on Various Pages:**
    *   **Requirement**: Modify content display based on status ('draft', 'pending_review', 'approved', 'rejected') across multiple pages.
        *   Default view: Show only 'active' content (draft, pending_review) on `/content`, `/dashboard`, and `/my-tasks`.
        *   Filter UI: Add status filters ('Active', 'Approved', 'Rejected', 'All') to `/content`. No filter UI for `/dashboard` & `/my-tasks` (always active).
    *   **Implementation**:
        *   **API Update (`src/app/api/content/route.ts`)**: Modified the `GET` handler to accept a `status` query parameter. Implemented filtering logic for 'active' (default), specific statuses, or 'all'. Ensured type safety for status values using `Enums<"content_status">`.
        *   **Content Page UI (`src/app/dashboard/content/content-page-client.tsx`)**:
            *   Added `statusFilter` state and updated data fetching to include this filter.
            *   Added `Button` components for status filtering.
            *   Fixed linter errors related to `updated_at` in `ContentItem` and `BrandIcon` props (added `updated_at` and reverted icon to generic `FileText`).
        *   **Dashboard Page (`src/app/dashboard/page.tsx`)**: Updated `fetchMetrics` to call `fetch('/api/content?status=active')` to ensure the "Total Content" metric reflects only active items.
        *   **My Tasks API (`src/app/api/me/tasks/route.ts`)**: Changed the existing status filter from `['pending_review', 'rejected', 'draft']` to `['draft', 'pending_review']` to only include active content.
        *   **My Tasks Page (`src/app/dashboard/my-tasks/page.tsx`)**:
            *   Updated data fetching to use `/api/me/tasks`.
            *   Removed client-side status and assignment filtering.
            *   Updated UI text and fixed a linter error for button size.

**6. Column Removal and Edit Button Logic on `/content` Page:**
    *   **Requirement**: On `src/app/dashboard/content/content-page-client.tsx`:
        1.  Remove "Brand" and "Created By" columns.
        2.  Restore logic to show the "Edit" button only to assigned users.
    *   **Implementation**:
        *   Modified `src/app/dashboard/content/content-page-client.tsx`:
            *   Removed table headers and data cells for "Brand" and "Created By".
            *   Ensured `ContentItem` interface included `assigned_to: string[] | null;`.
            *   Updated `fetchContentData` to correctly map `item.assigned_to`.
            *   Modified `isUserAssigned` to check `item.assigned_to` against `currentUser.id`.
            *   Wrapped the "Edit" button in a conditional check: `(currentUser && isUserAssigned(item, currentUser.id))`.

This session successfully addressed multiple bugs and implemented requested feature enhancements, improving overall application stability and user experience.

## API Rate Limiting

To prevent abuse and ensure service stability, rate limiting has been implemented on certain AI-intensive API endpoints.

### Implemented Rate Limits

-   **Alt Text Generator**: `src/app/api/tools/alt-text-generator/route.ts`
    -   Limit: 10 requests per IP address per minute.
    -   Mechanism: In-memory counter.
    -   Response on exceeding limit: HTTP 429 "Rate limit exceeded. Please try again in a minute."

-   **Metadata Generator**: `src/app/api/tools/metadata-generator/route.ts`
    -   Limit: 10 requests per IP address per minute.
    -   Mechanism: In-memory counter.
    -   Response on exceeding limit: HTTP 429 "Rate limit exceeded. Please try again in a minute."

This in-memory approach is suitable for single-instance deployments. For scaled environments, a distributed rate-limiting solution (e.g., using Redis) would be recommended.

### Per-URL AI Call Delay
To help manage token consumption rates with the AI service and improve stability when processing batches of URLs, a 5-second delay has been introduced *before* each individual call to the AI generation functions (`generateAltText`, `generateMetadata`) within a single batch request. Console log messages indicate when these delays occur and when the AI call proceeds.

## Recent Updates

### Removed CSV Download from Tools
- Removed the "Download CSV" functionality from the Metadata Generator tool (`/dashboard/tools/metadata-generator`).
- Removed the "Download CSV" functionality from the Alt-Text Generator tool (`/dashboard/tools/alt-text-generator`).
- This change was made to simplify the UI for these tools, as the primary interaction is focused on generating and copying text directly.
- The `downloadCSV` function, associated buttons, and `Download` icon imports were removed from the respective page components.

### Feedback Logging and Viewing System
- Implemented a new system for logging and viewing feedback items (bugs and enhancement requests).
- **Database**:
    - Created a new table `public.feedback_items` with columns for type, title, description, priority, status, affected area, steps to reproduce, expected/actual behavior, app version, and user impact.
    - Added ENUM types: `feedback_type`, `feedback_priority`, `feedback_status`.
    - Implemented Row Level Security:
        - Any authenticated user can INSERT new feedback items.
        - Admins have UPDATE and DELETE access.
        - Authenticated users can read all feedback items.
    - Migration script: `migrations/20250516000000_create_feedback_system.sql`.
- **API Endpoint**:
    - Created `src/app/api/feedback/route.ts`.
    - `POST /api/feedback`: Allows authenticated users to create new feedback items. Validates for `type` and `priority`.
    - `GET /api/feedback`: Allows authenticated users to retrieve feedback items with pagination and filtering (type, status, priority).
- **Feedback Submission Page**:
    - Path: `src/app/dashboard/admin/feedback-log/page.tsx` (Note: path contains "admin" for historical reasons).
    - Authenticated users can submit new feedback items via a form.
    - Users can view a table of all logged feedback items on this page as well (current implementation combines submission and viewing for the user who is submitting, though the primary view-only page is separate).
    - Access is for all authenticated users.
- **User View Page (Feedback List)**:
    - Created `src/app/dashboard/feedback/page.tsx`.
    - All authenticated users can view a table of logged feedback items.
    - Includes filtering (type, priority, status) and client-side text search.
    - Pagination is implemented for the list.
- **Navigation**:
    - Added "View Feedback" link to the sidebar for all authenticated users, linking to `/dashboard/feedback`.
    - Added "Submit Feedback" link to the sidebar for all authenticated users, linking to `/dashboard/admin/feedback-log`.
- **Documentation**:
    - Detailed documentation for the feedback system is available at [docs/feedback_system.md](docs/feedback_system.md).