# Task: Sellora Admin Dashboard

## Summary
Built a complete admin dashboard at `/admin` route for the Sellora project. The admin section is a standalone area with its own layout, sidebar, and 9 pages, all using JavaScript (.js), custom CSS with CSS variables, and the existing admin API routes.

## Files Created

### 1. `/src/app/admin/admin.css`
- Admin-specific styles with red/orange accent for ADMIN branding
- Admin badge with pulse animation
- Admin chart bar styles (red/orange gradient)
- Admin action buttons (upgrade, suspend, demote)
- KPI grid and cards
- Distribution bars for multi-segment data
- Slide-out panel for conversation messages
- Health indicator with pulse animation
- Broadcast textarea and send button styles
- Custom select styles
- Responsive breakpoints

### 2. `/src/app/admin/layout.js`
- Admin layout with left sidebar navigation
- 9 nav links grouped into Admin, Commerce, Platform sections
- Topbar with "Sellora Admin" branding and ADMIN badge
- Admin access check using Supabase auth (verifies user ID === e6a38229-7fd2-47a4-a28e-415dc76bfb46)
- Redirects non-admin users to /dashboard
- Loading state while verifying admin access
- "Back to Dashboard" link in sidebar footer
- Admin mode indicator in sidebar footer

### 3. `/src/app/admin/page.js` - Overview Dashboard
- 6 KPI cards: Total Accounts, Active Accounts, Total Messages, Total Orders, Total Revenue, AI Replies Today
- Plan distribution breakdown (starter/professional/business) with progress bars
- Channel distribution (IG/FB/WA) with icons and progress bars
- Messages chart (30-day CSS bar chart)
- Revenue chart (30-day CSS bar chart - green gradient)
- Account growth chart (30-day CSS bar chart - purple gradient)
- Fetches from `/api/admin/overview`

### 4. `/src/app/admin/accounts/page.js` - Accounts Management
- Full table with Business Name, Plan, Email, Channels, AI, Customers, Orders, Revenue, Created
- Search bar and Plan filter (All/Starter/Professional/Business)
- Expandable row for account details (ID, owner, industry, country, AI config)
- Action buttons: Upgrade Plan, Downgrade Plan, Suspend/Reactivate
- Pagination support

### 5. `/src/app/admin/conversations/page.js` - All Conversations
- Table: Customer, Account, Channel, Status, Last Message, Unread, Messages, Created
- Channel filter tabs, Status filter tabs, Search
- Click to view messages in a slide-out panel (480px right-side panel)
- Channel badges (IG/FB/WA) and status indicators
- Pagination support

### 6. `/src/app/admin/messages/page.js` - All Messages
- Table: Content, Direction, AI, Intent, Sentiment, Account, Customer, Channel, Time
- Filter tabs: Direction (All/Incoming/Outgoing), AI (All/AI/Human), Channel (All/IG/FB/WA)
- Search functionality
- Sentiment color-coded badges
- Intent badges with purple styling
- Pagination support

### 7. `/src/app/admin/orders/page.js` - Orders & Revenue
- Revenue KPI cards at top: Total Revenue, Avg Order Value, Total Orders, Pending Orders
- Table: Order #, Account, Customer, Items, Total, Payment, Status, Date
- Status filter tabs (pending/confirmed/shipped/delivered/cancelled)
- Search functionality
- Status badges and payment status indicators
- Pagination support

### 8. `/src/app/admin/products/page.js` - Products Catalog
- Table: Product (with image thumbnail), Account, Price, Category, Stock, Status, Created
- Search and Status filter (All/Active/Draft/Archived)
- Stock level indicators (Out of Stock/Low Stock/In Stock)
- Product image thumbnails
- Pagination support

### 9. `/src/app/admin/ai-performance/page.js` - AI Performance
- 4 KPI cards: Total AI Replies, Avg Response Time, Error Rate, AI Resolution Rate
- Intent distribution bar chart (color-coded)
- Sentiment analysis with multi-segment distribution bar and breakdown
- Tool calls breakdown (top 15 tools)
- Daily AI usage chart (30-day CSS bar chart)
- Additional stats: Handoff Rate, FAQ Match Rate, Keyword Match Rate

### 10. `/src/app/admin/system/page.js` - System Health
- Overall health status indicator with animated pulse dot
- 4 KPI cards: Webhook Success Rate, Errors (24h), Rate Limit Hits (24h), DB Total Records
- Webhook delivery stats (delivered/failed/triggered today/delivery rate)
- Error log summary with type breakdown and recent errors
- Rate limit hits by action
- Database table sizes with relative bar visualization
- Active connections and audit events summary

### 11. `/src/app/admin/broadcast/page.js` - Platform Broadcast
- Message textarea
- Channel selector with toggle buttons (IG/FB/WA)
- Target audience selector (All Users, Starter/Professional/Business Plan)
- Audience preview (eligible account count)
- Send button with loading state
- Result display (campaigns created, eligible accounts, errors)
- Recent broadcasts list
- POST to `/api/admin/broadcast`

## Key Patterns
- All pages use `"use client"` directive
- All API calls use `x-account-id: e6a38229-7fd2-47a4-a28e-415dc76bfb46` header
- CSS follows existing dashboard.css patterns (stat-card, stats-grid, data-table, etc.)
- CSS bar charts using `chart-bars` / `chart-bar` patterns from dashboard.css
- lucide-react icons throughout
- Loading states with spinner animations
- Pagination on all table pages
- Admin-specific red/orange accent color scheme (#E84327, #F8A532)
