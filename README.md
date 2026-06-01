# NextOffer.AI 🚀

**AI-Powered Job Hunting Platform** — Find your dream job in minutes with personalized resumes, cover letters, and cold emails.

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Cost](https://img.shields.io/badge/Startup%20Cost-$0-green)

---

## ✨ Features

### For Users
- 🔐 **Google OAuth Login** — Sign in securely with your Google account
- 📄 **AI Resume Parser** — Upload resume, Claude Vision reads it instantly
- 🔍 **Smart Job Search** — Find top 10 matching jobs from LinkedIn & Indeed (last 24 hours)
- 🎯 **Personalized Documents** — Auto-generate resume, cover letter & cold email per job
- 💰 **Freemium Model** — 1 search/month free, upgrade for $9.99/month unlimited
- 🌍 **Global Regions** — Filter jobs by location (US, UK, India, Canada, etc.)
- 💵 **Multi-Currency** — Price in USD, EUR, GBP, INR, CAD, AUD, SGD, AED
- 🎨 **Professional UI** — Dark mode, clean design, mobile-first

### For You (The Business)
- ✓ **Zero Startup Costs** — Firebase free tier + use user's OpenAI credits
- ✓ **Profitable at Scale** — Break even at ~100 Pro users
- ✓ **Fully Serverless** — No servers to manage, auto-scaling
- ✓ **Easy to Deploy** — Vercel or Firebase hosting (1 click)
- ✓ **Recurring Revenue** — $9.99/month per Pro user = 50 users = $500/month
- ✓ **White-Label Ready** — Can be resold to schools, bootcamps, recruiters

---

## 🏗️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 | Fast, reactive, easy to deploy |
| **Auth** | Firebase Auth + Google OAuth | Instant user creation, no password management |
| **Database** | Firebase Firestore | Real-time, serverless, scales automatically |
| **Backend** | Firebase Cloud Functions | Serverless, pay-per-use, auto-scaling |
| **AI** | Claude API (Anthropic) | Better than OpenAI for text, cheaper Haiku model |
| **Payments** | Stripe | Industry standard, reliable, PCI compliant |
| **Job Data** | JSearch API (RapidAPI) | Real jobs from LinkedIn & Indeed |
| **Hosting** | Vercel + Firebase | Fast, reliable, zero-config |

---

## 💰 Business Model

### Revenue Tiers

**FREE TIER**
- 1 resume upload/month
- 1 job search/month
- Uses Claude Haiku (cheap model)
- You pay: ~$0.01/user/month
- Goal: Get them hooked, convert to Pro

**PRO TIER ($9.99/month)**
- Unlimited searches
- Unlimited resumes
- Same Claude Haiku model as free (unlimited usage)
- You pay: ~$0.10/user/month
- You profit: $9.89/user/month

### Financial Projections

| Users | Free | Pro (5%) | Revenue | Costs | Profit |
|---|---|---|---|---|---|
| 1,000 | 950 | 50 | $499 | $50 | **$449** |
| 10,000 | 9,500 | 500 | $4,991 | $500 | **$4,491** |
| 100,000 | 95,000 | 5,000 | $49,950 | $5,000 | **$44,950** |

**Assumptions:**
- 5% Pro conversion rate (conservative)
- Free users cost $0.01/month (Claude Haiku)
- Pro users cost more mainly from volume (unlimited searches/generations), same Haiku model
- Firebase hosting: included (free tier at scale)
- JSearch API: $30-50/month (shared across all users)

---

## 🚀 Getting Started (5 minutes)

### Prerequisites
- Node.js 16+
- npm or yarn
- Google account (for OAuth)
- OpenAI API key (free)
- Stripe account (free)
- Firebase project (free)

### Quick Start

```bash
# 1. Clone or download this project
git clone <repo>
cd jobcraft-ai

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys (5 minutes)

# 4. Deploy Cloud Functions
firebase deploy --only functions

# 5. Start development server
npm start

# Your app is running at http://localhost:3000!
```

**That's it!** You now have a fully functional job hunting platform.

### Deploy to Production

```bash
# Option A: Vercel (Easiest)
npm install -g vercel
vercel

# Option B: Firebase Hosting
npm run build
firebase deploy

# Your app is live! 🎉
```

---

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** — Step-by-step setup with troubleshooting
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** — Detailed Firebase, Stripe, and Cloud Functions setup
- **[cloud-functions.js](./cloud-functions.js)** — Backend code (deploy to Firebase)
- **.env.local.example** — Environment variables template

---

## 🏗️ Architecture

```
┌─────────────┐
│   React     │ User interface (mobile-first)
│   Frontend  │
└──────┬──────┘
       │ HTTPS
┌──────▼─────────────────┐
│  Firebase              │
│  ├─ Auth (Google)      │ Handles login
│  ├─ Firestore (DB)     │ Stores users, resumes, jobs, documents
│  ├─ Cloud Functions    │ Runs backend logic
│  └─ Hosting            │ Serves frontend
└──────┬─────────────────┘
       │
   ┌───┴─────┬──────────┬──────────┐
   │          │          │          │
┌──▼──┐  ┌───▼───┐  ┌──▼───┐  ┌──▼────┐
│Claude│ │Stripe │ │JSearch│ │Google │
│ API  │ │       │ │ API   │ │OAuth  │
└──────┘ └───────┘ └───────┘ └───────┘
```

---

## 📊 Monthly Costs at Different Scales

| Component | 100 Users | 1k Users | 10k Users | 100k Users |
|---|---|---|---|---|
| Firebase (Hosting + DB) | $0 | $10 | $50 | $200 |
| Cloud Functions | $0 | $2 | $20 | $100 |
| OpenAI API (Free tier limit) | $1 | $10 | $100 | $1,000 |
| JSearch API | $30 | $30 | $30 | $50 |
| Stripe (2.9% + $0.30) | $15 | $150 | $1,500 | $15,000 |
| **Total** | **$46** | **$202** | **$1,700** | **$16,350** |

**At 5% Pro conversion:**
- 100 users: 5 paying × $9.99 = $49/mo → **$3 profit** 📊
- 1k users: 50 paying × $9.99 = $499/mo → **$297 profit** 💰
- 10k users: 500 paying × $9.99 = $4,995/mo → **$3,295 profit** 🤑
- 100k users: 5,000 paying × $9.99 = $49,950/mo → **$33,600 profit** 🚀

---

## 🔒 Security

- ✓ Firebase security rules (see SETUP_GUIDE.md)
- ✓ Google OAuth (no password storage)
- ✓ API keys encrypted in Firebase Secrets Manager
- ✓ Stripe PCI compliance
- ✓ HTTPS everywhere
- ✓ Rate limiting on Cloud Functions
- ✓ Input validation on all endpoints

---

## 🎯 Roadmap

### Phase 1 (Current)
- ✓ Core platform (search, documents, payments)
- ✓ Free + Pro tiers
- ✓ Production-ready

### Phase 2 (Next)
- Interview prep module
- Email outreach tracking
- Job application history
- Analytics dashboard

### Phase 3 (Future)
- LinkedIn automation
- Salary negotiation AI
- Career coaching
- B2B white-label

---

## 📱 Screenshots

(Your app will look like the design in the React code — dark mode, modern UI)

- **Login**: Google OAuth with clean design
- **Resume Upload**: Claude Vision reads your resume instantly
- **Job Search**: Filter by region, salary, workplace type
- **Job Results**: 10 matching jobs with match scores
- **Document Generation**: AI-generated resume, cover letter, cold email
- **Upgrade Modal**: Simple $9.99/month upgrade with Stripe

---

## 💬 FAQ

**Q: Can I use my own OpenAI key?**  
A: Free users need to, Pro users can use your shared key or their own.

**Q: How do I get real jobs (not AI-generated)?**  
A: Add JSearch API (RapidAPI) to get real LinkedIn & Indeed jobs. See SETUP_GUIDE.md.

**Q: Can I white-label this?**  
A: Yes! Remove "JobCraft" branding, change colors, resell to schools/recruiters.

**Q: Is this production-ready?**  
A: Yes. 100% serverless, auto-scaling, secure. Just add your API keys and deploy.

**Q: What happens if I get 100k users?**  
A: Firebase and Cloud Functions auto-scale. Costs go up proportionally but so does revenue.

**Q: Can I sell this as a SaaS?**  
A: Yes. The business model supports it. See pricing recommendations in SETUP_GUIDE.md.

---

## 🤝 Contributing

This is your personal project! Modify as needed. Some ideas:
- Add LinkedIn direct apply
- Build interview prep module
- Add salary negotiation AI
- Create mobile app (React Native)

---

## 📝 License

MIT — Use for any purpose

---

## 🎉 You're Ready!

You have everything you need to launch a profitable SaaS:
- ✓ Zero startup cost
- ✓ Production-ready code
- ✓ Scalable architecture
- ✓ Profitable business model
- ✓ Complete documentation

**Next steps:**
1. Follow QUICK_START.md
2. Deploy to Firebase Hosting (5 minutes): `npm run build && firebase deploy`
3. Share with friends/Twitter
4. Get first Pro users
5. Celebrate your first revenue 🎉

---

**Built with ❤️ using React, Firebase, Claude AI, and Stripe**

Questions? Check SETUP_GUIDE.md or QUICK_START.md.

Happy launching! 🚀
