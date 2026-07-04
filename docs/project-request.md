# Full-Stack Inventory Management System for a Donation Center

## 1. Project Overview

The goal of this project is to build a **mobile-first inventory management system** for a donation center. The system will help the organization register, track, manage, and distribute donated items stored inside numbered boxes or storage slots.

Currently, the donation center uses an Excel spreadsheet to manually record the contents of each box. Multiple people count and update dozens of boxes manually, and then an administrator centralizes all the information into one master Excel file.

The current process is slow, error-prone, difficult to audit, and does not provide a real-time view of the available inventory.

The location does not have reliable internet access. However, there is mobile signal available, likely 3G or 4G. Because of this, the application should be designed to work well in low-connectivity environments and should ideally support offline or poor-network scenarios in the future.

---

## 2. Current Excel Structure

The existing Excel sheet has the following columns:

| Field | Description |
|---|---|
| Caja # | Box or slot number |
| Clasificación | Category or classification of the donated item |
| Descripción | Item description |
| Presentación | Presentation or packaging format |
| Cant. | Quantity |
| Und. Medida | Unit of measurement |
| Datos de salida | Exit or distribution data, likely date-related |

The system should initially support this structure, but improve it by making the data searchable, filterable, auditable, and connected to orders and inventory transactions.

---

## 3. Proposed Solution

Build a **mobile-first web application** connected to a cloud-hosted database and backend service. The system should be simple, affordable, secure, and easy to maintain.

The application should allow users to:

- Register donated items inside boxes or slots.
- View the current inventory by box, category, product, or quantity.
- Search and filter inventory quickly.
- Create donation requests or orders.
- Suggest which boxes/slots should be used to fulfill each order.
- Register inventory movements, exits, relocations, and order fulfillment.
- Keep a transaction history for audit purposes.
- Export inventory, orders, and reports to Excel or PDF.
- Manage users and roles.
- Work efficiently on mobile devices and desktop screens.

The system should be designed with the possibility of future offline support or local-first behavior, since the donation center may not always have stable internet.

---

## 4. Core Concepts

### 4.1 Slot / Box

A slot represents a numbered box or storage location inside the donation center.

The center currently uses numbered boxes, but it is not yet confirmed whether the boxes are only used for internal storage or if they may also be shipped or delivered as part of an order.

The system should allow boxes to be activated, deactivated, viewed, searched, and associated with donations and transactions.

### 4.2 Donation Item

A donation item represents a product donated to the center.

Examples:

- Medicine
- Food
- Clothing
- Hygiene products
- Baby products
- Medical supplies
- Other general donations

Donation items may exist in multiple boxes or slots. The system should be able to show both:

- The total quantity available for a donation item.
- The quantity available in each specific slot.

### 4.3 Order / Donation Request

An order represents a request for donated items.

The order should include the requester’s information, the requested items, the quantities needed, the status of the request, and the users involved in registering, preparing, and completing the order.

### 4.4 Transaction

A transaction represents any inventory movement.

Examples:

- New donation added to a slot.
- Donation removed from a slot to fulfill an order.
- Donation moved from one slot to another.
- Slot deactivated.
- Entire slot assigned or sent to a destination.
- Inventory correction or adjustment.

Transactions are important because they create an audit trail and allow the organization to understand how the inventory changed over time.

---

## 5. Proposed Data Models

### 5.1 User

Represents a system user.

#### Fields

- `id`
- `name`
- `email`
- `password_hash` or external auth provider id
- `role`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

#### Notes

Soft delete may be useful to keep historical accountability for orders and transactions created by users who are later removed from the system.

---

### 5.2 Slot

Represents a box or storage location.

#### Fields

- `id`
- `name`
- `number`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

#### Status examples

- `active`
- `inactive`
- `archived`
- `shipped`
- `reserved`

#### Notes

The box number may be different from the database `id`. It is better to keep both:

- `id`: internal database identifier.
- `number` or `name`: visible box number used by the donation center.

---

### 5.3 Donation Item

Represents the general definition of a donated product.

#### Fields

- `id`
- `category`
- `subcategory`
- `description`
- `presentation`
- `unit_of_measurement`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

#### Status examples

- `active`
- `out_of_stock`
- `needed`
- `archived`

#### Notes

In the current Excel sheet, the `Clasificación` column may be used as either a category or subcategory.

For example, in medicines, the classification may be the type of medicine, while the broader category is implicitly “Medicine”.

The system should support both `category` and `subcategory` to make the data cleaner and easier to filter.

---

### 5.4 Inventory

Represents the quantity of a donation item inside a specific slot.

#### Fields

- `id`
- `slot_id`
- `donation_item_id`
- `quantity`
- `created_at`
- `updated_at`

#### Notes

This model prevents duplicated product definitions.

Example:

A donation item such as `Acetaminophen 500mg tablets` may exist in:

- Slot 1: 10 units
- Slot 5: 25 units
- Slot 9: 3 units

The total available quantity would be 38 units.

---

### 5.5 Order

Represents a donation request.

#### Fields

- `id`
- `order_number`
- `requester_name`
- `requester_phone`
- `requester_email`
- `requester_address`
- `requester_city`
- `requester_state`
- `requester_notes`
- `status`
- `created_by_user_id`
- `prepared_by_user_id`
- `completed_by_user_id`
- `created_at`
- `updated_at`
- `prepared_at`
- `completed_at`
- `cancelled_at`

#### Status examples

- `draft`
- `pending`
- `in_progress`
- `ready_for_pickup`
- `completed`
- `cancelled`

#### Notes

The system can use a hardcoded list of Venezuelan states for the requester address field.

---

### 5.6 Order Item

Represents each item requested inside an order.

#### Fields

- `id`
- `order_id`
- `donation_item_id`
- `requested_quantity`
- `fulfilled_quantity`
- `status`
- `created_at`
- `updated_at`

#### Status examples

- `pending`
- `partially_fulfilled`
- `fulfilled`
- `unavailable`
- `cancelled`

#### Notes

An order can contain multiple requested donation items.

A donation item must ideally already exist in the database before being added to an order. However, if the requested item does not exist or is not currently available, the system should allow registering it with a `needed` status. This would allow the organization to generate a list of items currently needed.

---

### 5.7 Inventory Transaction

Represents all inventory changes.

#### Fields

- `id`
- `type`
- `donation_item_id`
- `from_slot_id`
- `to_slot_id`
- `order_id`
- `quantity`
- `created_by_user_id`
- `notes`
- `created_at`

#### Transaction types

- `inbound`
- `outbound`
- `relocation`
- `adjustment`
- `order_fulfillment`
- `slot_deactivation`
- `slot_shipment`

#### Notes

For an inbound donation, `from_slot_id` can be null and `to_slot_id` should be the destination slot.

For an outbound donation, `from_slot_id` should be the source slot and `to_slot_id` can be null.

For a relocation, both `from_slot_id` and `to_slot_id` should be present.

For an order fulfillment transaction, the transaction should be associated with an `order_id`.

A single order may generate multiple transactions for the same donation item if the item must be taken from different slots.

---

### 5.8 Slot Status History

Represents changes in slot status.

#### Fields

- `id`
- `slot_id`
- `old_status`
- `new_status`
- `changed_by_user_id`
- `reason`
- `created_at`

#### Notes

This can be useful when a box is deactivated, shipped, archived, or reserved for a specific request.

---

## 6. User Roles and Permissions

### 6.1 Admin

Admins have full access to the system.

#### Permissions

- Create, edit, and delete users.
- Assign roles.
- Create, edit, and deactivate slots.
- Add, edit, and manage donation items.
- View all inventory.
- Create and manage orders.
- Process and complete orders.
- View transaction history.
- Export reports.
- Access dashboard and analytics.
- Manage system settings.

---

### 6.2 Staff

Staff users can manage most operational tasks but cannot manage users or critical system settings.

#### Permissions

- Register donation items.
- View inventory.
- Create donation requests/orders.
- Prepare orders.
- Complete orders.
- View order history.
- View transaction history.
- Export basic reports.
- Create inventory relocation transactions.

---

### 6.3 Collaborator

Collaborators have restricted access. This role is intended for users who only help count inventory, register box contents, or prepare donation orders.

#### Permissions

- View assigned or available slots.
- Register items inside boxes.
- Update quantities during counting.
- Process assigned orders.
- Mark items as prepared.
- View limited inventory details.

#### Restrictions

- Cannot create users.
- Cannot edit user roles.
- Cannot delete records.
- Cannot access advanced reports.
- Cannot modify system settings.

---

## 7. Main Features and Screens

## 7.1 Authentication

### Screens

- Login screen
- Forgot password screen
- Reset password screen
- Account settings screen

### Requirements

Authentication can be implemented using:

- Email and password
- SSO
- OTP
- Another simple and secure authentication provider

The final method should be decided during technical planning.

The session should remain active until the user logs out or the session expires according to the chosen authentication strategy.

Users should be able to recover access or change their password if email/password authentication is used.

---

## 7.2 Dashboard Screen

The dashboard should provide a general overview of the system and act as the main entry point for navigation.

### Possible dashboard data

- Total active slots
- Total donation items
- Total available units
- Low-stock or out-of-stock items
- Pending orders
- Orders in progress
- Completed orders
- Recent transactions
- Recently added donations

### Role-based visibility

Different roles should see different dashboard information depending on their permissions.

---

## 7.3 Slots Screen

The slots screen should show all boxes or storage locations.

### Requirements

- Display slots as cards or icons, not only as a table.
- Each slot should show its number/name and status.
- Include search by slot number.
- Include filters by status.
- Include a CTA to create a new slot.
- Use a responsive layout with flex/wrap or grid behavior.
- Should work especially well on mobile.

### Slot Detail Screen

When the user selects a slot, the app should navigate to the slot detail screen.

The slot detail screen should show:

- Slot number/name.
- Slot status.
- List of donation items inside the slot.
- Quantity of each item.
- Basic item details.
- Recent transactions related to this slot.
- CTA to add a new donation item to this slot.
- CTA to relocate items from this slot.
- CTA to deactivate or archive the slot, based on permissions.

---

## 7.4 Donation Items Screen

This screen should show all donation items registered in the system.

### Requirements

- Display items in a searchable and filterable data table.
- Filter by category.
- Filter by subcategory.
- Filter by presentation.
- Filter by unit of measurement.
- Filter by quantity.
- Filter by date added.
- Out-of-stock items should appear at the end by default.
- Items with status `needed` should be clearly marked.
- Clicking an item should navigate to the item detail screen.

### Donation Item Detail Screen

The donation item detail screen should show:

- Basic item information.
- Total quantity available.
- Slots where this item exists.
- Quantity available per slot.
- Transactions related to this item.
- Orders associated with this item.
- Current status.
- CTA to edit item details.
- CTA to adjust inventory.
- CTA to add quantity to a slot.

Transactions may be displayed in one table or grouped by order.

---

## 7.5 Add Donation Flow

The app should include a fast and mobile-friendly flow to register new donations.

### Entry points

- Floating `+` CTA.
- Dashboard CTA.
- Slot detail screen CTA.

### Step 1: Select or Create Slot

The user should first select the slot where the donation will be stored.

Requirements:

- Show slots as cards or icons.
- Include search by slot number.
- Trim spaces from the input.
- If the slot does not exist, allow creating it.
- After selecting or creating a slot, continue to the donation form.

### Step 2: Donation Form

The form should include:

- Category
- Subcategory
- Description
- Presentation
- Quantity
- Unit of measurement

### Smart Inputs

Inputs should help users avoid duplicated records.

For example:

- When typing a category, suggest similar existing categories.
- When typing a subcategory, suggest similar existing subcategories.
- When typing a presentation, suggest existing presentations.
- When typing a unit of measurement, suggest existing units.

If the value does not exist, the user should be able to create it.

### Quantity Input

Quantity should use a number input with:

- Manual input
- Increment control
- Decrement control
- Validation to avoid negative quantities

### After Submit

After adding a donation, show two CTAs:

- Add another donation
- Continue to dashboard or slot detail screen

---

## 7.6 Create Donation Order Flow

The system should allow users to create donation requests/orders.

### Step 1: Requester Information

The form should collect:

- Requester name
- Phone
- Email
- Address
- City
- State
- Notes

The state field can use a hardcoded list of Venezuelan states.

### Step 2: Add Requested Items

The user should be able to add multiple requested items to the order.

The search input should allow searching by:

- Category
- Subcategory
- Description
- Presentation
- Unit of measurement

When an item is selected, the system should show:

- Total available quantity
- Slots where it is available
- Quantity per slot

The requested quantity must be less than or equal to the available quantity, unless the item is being registered as a needed item.

### Handling Unavailable Items

If the requested item does not exist in the database, the user should be able to register it with status `needed`.

If the item exists but has quantity `0`, the user should be able to add it to the order as unavailable or needed.

This will help generate reports of items the center needs to request from donors.

### Step 3: Review Order

Before submitting, show a summary of:

- Requester information
- Requested items
- Quantities requested
- Available quantities
- Unavailable or needed items
- Suggested slots to fulfill the order

### Step 4: Submit Order

After submitting, the order should be created with status `pending`.

---

## 7.7 Order Management Flow

The system should allow users to view, start, prepare, complete, or cancel orders.

### Orders Screen

The orders screen should show:

- Order number
- Requester name
- Status
- Created date
- Prepared by
- Completed by
- Number of items
- CTA to view details

### Order Detail Screen

The order detail screen should show:

- Requester information
- Requested items
- Available items
- Needed or unavailable items
- Suggested slots
- Fulfillment status
- Assigned/prepared by user
- Transaction history
- Notes

### Order Fulfillment

When preparing an order, the system should indicate from which slot each item should be taken.

Example:

- Acetaminophen 500mg, requested quantity: 20
  - Take 10 from Slot 1
  - Take 10 from Slot 5

When the order is completed, the system should:

- Deduct the quantities from inventory.
- Create inventory transactions.
- Save who prepared the order.
- Save who completed the order.
- Save the completion date and time.

---

## 7.8 Inventory Relocation Flow

The system should allow moving donated items from one slot to another.

### Requirements

The relocation flow should allow the user to select:

- Donation item
- Source slot
- Destination slot
- Quantity to move
- Notes

After submission, the system should:

- Decrease quantity from the source slot.
- Increase quantity in the destination slot.
- Create a relocation transaction.
- Update inventory totals.

---

## 7.9 User Management Flow

Admins should be able to manage users.

### Requirements

- Create users.
- Edit users.
- Deactivate users.
- Assign roles.
- Reset password or trigger password reset, depending on authentication method.
- View user status.
- View created date and last updated date.

---

## 7.10 Reports and Exports

The system should allow exporting data to Excel and PDF.

### Possible reports

- Full inventory report
- Inventory by slot
- Inventory by category
- Out-of-stock items
- Needed items
- Order history
- Completed orders
- Transaction history
- Slot status history

### Export formats

- `.xlsx`
- `.pdf`

---

## 8. Security Requirements

The application should be secure enough for production use while remaining simple and affordable.

### Requirements

- Authentication required for all protected screens.
- Role-based access control.
- Passwords must never be stored as plain text.
- Use a trusted authentication provider or secure password hashing.
- Validate all forms on the client and server.
- Protect API routes.
- Prevent unauthorized data access.
- Keep audit logs through transaction tables.
- Use HTTPS in production.
- Avoid exposing sensitive environment variables.
- Maintain user sessions securely.
- Support logout.

The security approach does not need to be overly complex, but it should be reliable, practical, and appropriate for a real production environment.

---

## 9. Design Requirements

The application should be:

- Mobile-first
- Responsive
- User-friendly
- Fast for data entry
- Easy to read
- Clean and modern
- Accessible for older users
- Professional and trustworthy

### UI Requirements

- Use Tailwind CSS.
- Use Shadcn UI for components.
- Support light mode and dark mode.
- Use a simple black-and-white base theme with Tailwind colors if needed.
- Use large, readable typography.
- Use clear CTAs.
- Use simple forms.
- Use clean tables and cards.
- Avoid cluttered screens.
- Make touch targets comfortable for mobile users.

---

## 10. Suggested Technologies

The project should be easy and affordable to build, maintain, and scale.

The developer has experience with:

- React
- Astro
- Next.js
- TypeScript
- JavaScript
- HTML
- CSS
- Python

### Recommended Stack Option

A practical stack could be:

- **Frontend:** Next.js or React with Vite
- **Language:** TypeScript
- **UI:** Tailwind CSS + Shadcn UI
- **Forms:** React Hook Form + Zod
- **Server state:** TanStack Query
- **Routing:** Next.js App Router or TanStack Router, depending on the selected architecture
- **Database:** PostgreSQL
- **ORM:** Prisma or Drizzle
- **Authentication:** Supabase Auth, Clerk, Auth.js, or custom email/password auth
- **Backend:** Next.js API routes, Supabase, or a small Node/Express/FastAPI backend
- **File export:** XLSX and PDF generation libraries
- **Deployment:** Vercel, Render, Railway, Supabase, or another low-cost cloud provider

### Architecture Option 1: Next.js Full-Stack App

This is a good option if the goal is to keep the project in one codebase.

Possible stack:

- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI
- PostgreSQL
- Prisma or Drizzle
- Auth.js, Supabase Auth, or Clerk
- TanStack Query where useful
- React Hook Form + Zod

Pros:

- One project for frontend and backend.
- Easy deployment.
- Good TypeScript support.
- Good ecosystem.
- Easy to add protected routes and APIs.

Cons:

- Offline-first support may require extra planning.
- Requires careful handling of server/client boundaries.

---

### Architecture Option 2: React + API Backend

This is a good option if the frontend and backend should be separated.

Possible stack:

- Vite React
- TypeScript
- Tailwind CSS
- Shadcn UI
- TanStack Router
- TanStack Query
- React Hook Form + Zod
- FastAPI or Express backend
- PostgreSQL
- JWT or provider-based authentication

Pros:

- Clear separation between frontend and backend.
- Good for API-first development.
- Easier to later create a mobile app using the same backend.

Cons:

- Two deployments or services to manage.
- More setup.

---

### Architecture Option 3: Supabase-Based App

This is a good option if the goal is to move quickly with auth, database, and backend services.

Possible stack:

- Vite React or Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- TanStack Query
- React Hook Form + Zod

Pros:

- Fast to build.
- Built-in authentication.
- PostgreSQL included.
- Affordable for small projects.
- Row Level Security can help protect data.

Cons:

- Requires understanding Supabase RLS.
- Offline support still requires extra work.
- Some backend logic may eventually need Edge Functions or a separate backend.

---

## 11. Offline and Low-Connectivity Considerations

Because the donation center may not have stable internet, the app should be designed with low-connectivity usage in mind.

### Initial MVP

For the first version, the app can require internet access, but should:

- Minimize unnecessary API calls.
- Use loading and saving states clearly.
- Cache data where possible.
- Avoid losing form data if the connection is slow.
- Show clear error messages if saving fails.
- Allow retrying failed requests.

### Future Offline Support

In a future version, the app could support:

- Local storage or IndexedDB.
- Offline draft creation.
- Sync queue for pending transactions.
- Conflict resolution.
- PWA installation.
- Background sync when connection returns.

---

## 12. Deployment Requirements

The deployment should be simple, reliable, and affordable.

### Requirements

- Production environment.
- Staging or preview environment if possible.
- Environment variables properly configured.
- Database backups.
- HTTPS enabled.
- Simple deploy workflow.
- Easy rollback if something breaks.

### Possible deployment options

- Vercel for frontend or full-stack Next.js.
- Supabase for database and authentication.
- Railway or Render for backend services.
- Neon or Supabase for PostgreSQL.
- Cloudflare Pages if using a static frontend.
- GitHub Actions for CI/CD if needed.

---

## 13. Testing Requirements

The project should include enough testing to make the app reliable without overcomplicating the first version.

### Recommended testing approach

- Unit tests for utility functions.
- Validation tests for forms and schemas.
- Basic integration tests for critical flows.
- End-to-end tests for main user flows if time allows.

### Critical flows to test

- Login.
- Create slot.
- Add donation to slot.
- View inventory.
- Create order.
- Fulfill order.
- Deduct inventory after order completion.
- Relocate inventory between slots.
- User role permissions.
- Export inventory.

### Suggested tools

- Vitest
- React Testing Library
- Playwright
- Zod validation tests

---

## 14. Documentation Requirements

The project should include clear documentation so it can be maintained easily.

### Documentation should include

- Project overview.
- Setup instructions.
- Environment variables.
- Database schema.
- User roles and permissions.
- Main flows.
- Deployment instructions.
- Testing instructions.
- Known limitations.
- Future improvements.

### Suggested docs files

- `README.md`
- `docs/project-overview.md`
- `docs/database-schema.md`
- `docs/user-flows.md`
- `docs/deployment.md`
- `docs/testing.md`

---

## 15. Support and Maintenance

The system should be easy to maintain and update.

### Maintenance considerations

- Use TypeScript across the project.
- Keep code modular.
- Use reusable components.
- Keep forms and validation schemas organized.
- Use clear naming conventions.
- Keep database migrations documented.
- Keep environment variables documented.
- Use simple deployment steps.
- Monitor errors if possible.
- Keep dependencies updated.

---

## 16. Suggested MVP Scope

The first version should focus on the most important operational needs.

### MVP Features

- Authentication
- Role-based access
- Dashboard
- Slot management
- Add donation flow
- Inventory list
- Donation item detail
- Create order
- Fulfill order
- Inventory transactions
- Basic reports
- Excel export
- User management for admins

### Not required for MVP

- Full offline support
- Advanced analytics
- Complex PDF generation
- Barcode scanning
- Multi-location support
- Notifications
- Public donor portal

---

## 17. Future Improvements

Possible features for later versions:

- Offline-first PWA support.
- Barcode or QR code scanning for boxes.
- Printable labels for boxes.
- Advanced reporting.
- Donation needs public page.
- Donor management.
- Multi-location inventory.
- Delivery tracking.
- Notifications.
- Image uploads for donated items.
- Audit approval workflows.
- Bulk import from Excel.
- Bulk export templates.
- AI-assisted classification suggestions.

---

## 18. Important Planning Questions

Before development starts, the following questions should be clarified:

1. Will the boxes only be used for storage, or can an entire box be delivered/shipped?
2. Should inventory be tracked only by quantity, or also by expiration date for medicines and food?
3. Are there controlled or sensitive donation categories that require stricter tracking?
4. Should the system support expiration dates?
5. Should the system support barcode or QR code labels in the future?
6. Should multiple users be able to edit the same box at the same time?
7. Should users be able to work offline and sync later?
8. Who approves an order before it is completed?
9. Can collaborators see all inventory or only assigned boxes/orders?
10. Should deleted data be soft-deleted instead of permanently removed?
11. What reports are most important for the administrators?
12. What is the expected number of boxes, items, users, and orders?
13. Should the system import the existing Excel data during setup?
14. Should every inventory change require a transaction record?
15. Should the app support Spanish only or Spanish and English?

---

## 19. Development Goal

Build a clean, modern, mobile-first inventory system that improves the donation center’s current Excel-based workflow.

The final application should make it easier to:

- Count donations.
- Register box contents.
- Search inventory.
- Prepare donation orders.
- Track what leaves the center.
- Know what is available.
- Know what is needed.
- Export useful reports.
- Maintain a reliable history of inventory movements.

The system should be simple enough for non-technical users, clear enough for older users, and structured enough to be safely used in a real production environment.