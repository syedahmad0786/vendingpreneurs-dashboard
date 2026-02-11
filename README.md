# Vendingpreneurs Live Monitoring Dashboard

Real-time operational dashboard for monitoring vending machine business operations across the Vendingpreneurs program. Tracks quality audits, leads, onboarding, client health, national expansion, and revenue — all powered by Airtable data.

**Live:** [dashboard-seven-chi-30.vercel.app](https://dashboard-seven-chi-30.vercel.app)

---

## Pages

| Page | Description |
|------|-------------|
| **Overview** | KPI cards, activity feed, alert cards, trend sparklines |
| **Quality** | CRM audit scores, missed leads tracking, error analysis |
| **Leads** | Lead pipeline, temperature gauges, conversion funnel |
| **Onboarding** | Student onboarding errors, status tracking, resolution rates |
| **Clients** | Client health heatmap, stage funnel, refund analysis |
| **National** | National expansion pipeline, stage distribution, property groups |
| **Revenue** | Revenue by membership tier, status breakdown, financial KPIs |

## Tech Stack

- **Next.js 16.1.6** — App Router with server-side caching (2-min TTL)
- **React 19.2.3** — Latest React with concurrent features
- **TypeScript 5** — Full type safety
- **Tailwind CSS v4** — Dark glassmorphism theme (`@theme inline`)
- **Framer Motion 12** — Page transitions and staggered animations
- **Recharts 3.7** — Bar, line, area, pie, donut, funnel charts
- **Lucide React** — Icon system
- **Airtable API** — 12 tables, ~7,600 records

## Getting Started

### Prerequisites

- Node.js 18+
- An Airtable base with the required tables

### Environment Variables

Create `.env.local` in the project root:

```env
AIRTABLE_PAT=your_airtable_personal_access_token
AIRTABLE_BASE_ID=your_airtable_base_id
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build & Deploy

```bash
npm run build        # Production build
npx vercel --prod    # Deploy to Vercel
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Overview dashboard
│   ├── quality/page.tsx      # Quality audits
│   ├── leads/page.tsx        # Lead pipeline
│   ├── onboarding/page.tsx   # Onboarding tracking
│   ├── clients/page.tsx      # Client health
│   ├── national/page.tsx     # National expansion
│   ├── revenue/page.tsx      # Revenue analytics
│   ├── api/
│   │   ├── airtable/route.ts # Airtable proxy with caching
│   │   └── stats/route.ts    # Aggregated stats endpoint
│   ├── layout.tsx            # Root layout with header
│   └── globals.css           # Theme & glass card styles
├── components/
│   ├── layout/Header.tsx     # Horizontal nav header
│   ├── cards/                # MetricCard, TrendCard, AlertCard
│   ├── charts/               # GaugeChart, FunnelChart, DonutChart, etc.
│   ├── tables/DataTable.tsx  # Reusable sortable/searchable table
│   └── actions/              # ActionButtons component
└── lib/
    └── useStats.ts           # Stats API hook
```

## License

Private project — all rights reserved.
