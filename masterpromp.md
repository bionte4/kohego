Act as a Principal Full-Stack Architect and UI/UX Director. Read the .cursorrules file in this workspace. I am building "KoheGo" ([https://github.com/bionte4/kohego](https://github.com/bionte4/kohego)), a production-ready, multi-platform Sales & Distribution web application for organic fertilizers (Kohe / Kotoran Hewan) featuring multiple product variants (Kohe Kambing, Kohe Sapi, Kohe Ayam, and Liquid Organic Fertilizer / POC).

Please generate the complete core structure and implementation for the following modules:

1. **Responsive App Shell & Navigation:**
   - Desktop & Tablet: Sidebar navigation with collapsible menus, breadcrumbs, and a comprehensive dashboard view.
   - Mobile (< 768px): Bottom navigation bar optimized for field sales agents (Quick Order, Inventory, Partners, Profile) with large touch targets (min 44x44px).
2. **Multi-Variant Inventory Tracker:**
   - Manage stock levels across different categories: Kambing (Retail 5kg/10kg & Bulk 25kg), Sapi (Soil Conditioner), Ayam (Nitrogen Booster), and POC.
   - Track warehouse locations, incoming stock from local breeder partners, and dispatch logs.
3. **Field Sales Order Entry Form (Mobile-Optimized):**
   - Fast, touch-friendly order taking for sales reps visiting Toko Tani or Kelompok Tani in the field.
   - Select Customer (Toko Tani / Poktan), select Product Variant & Packaging Size, input quantity, calculate automatic totals, set payment method (Cash, Transfer, Consignment), and include a GPS/Location tag placeholder.
4. **Partner Directory (CRM Lite):**
   - Manage B2B and B2C clients (Toko Tani, Perkebunan, Urban Farmers) with contact info, credit terms, and purchase history.

Tech Stack Requirements:

- Next.js (App Router) with TypeScript & Tailwind CSS.
- Lucide React icons with a natural agrarian color palette (Forest Green #166534, Earth Brown #78350f, clean off-white background).
- Clean component separation and modular architecture.

Please start by building the main layout, TypeScript interfaces for multi-variant products, and the dashboard overview page.
