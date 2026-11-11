# Live Big Bear — build plan

livebigbear.com: a mobile-first, installable live conditions dashboard for the whole
Big Bear Valley (Big Bear Lake, Big Bear City, Sugarloaf, Baldwin Lake, Fawnskin).
Stack: Next.js on Vercel, Neon Postgres, GitHub.

## Principles
- The home screen answers one question first: can I get up the hill, and which way?
- Roads, chain control, cameras and alerts are the hook. Weather supports them.
- Runs on free public data. Revenue comes from self-service ad slots (no sales calls).
- Year-round value: winter roads and snow, summer lake, events and fire season.

## Phases
0. Setup — GitHub repo, Vercel project, Neon database, domain. (done)
1. Roads — Caltrans District 8 chain control feed for Hwy 330, Hwy 18 (via Crestline, front side,
   back side) and Hwy 38;
   home screen with verdict and routes; route detail page; status saved to Neon on a schedule.
2. Weather — National Weather Service tiles, per-community picker, airport station readings.
3. Launch — installable to the home screen as a PWA (app manifest, icons, install hint),
   search basics, live on livebigbear.com.
4. Alerts — see the Alerts section below. Built in two steps: free email first, paid text second.
5. Map, cameras and history — interactive road map with status colors and pins;
   Cams tab; seven-day history; per-community pages.
6. Self-service ads — Advertise page, Stripe subscription checkout, one-click approval,
   slots that empty themselves when a subscription ends.
Later — lake level, events, aircraft overhead for fire season.

## Alerts
Two different products, not one product at two prices.

**4a. Free email (build first, to grow the list this winter)**
- Sign up with an email address and confirm it by link.
- A morning summary on storm days, plus major closures. Not instant, not customizable.
- Every email carries an unsubscribe link and can carry one sponsor line (ad space, phase 6).

**4b. Paid alerts, $12 a year, pitched as "$1 a month"**
- Instant alerts by text and email when a chosen road's status changes.
- Subscriber picks the routes, the hours (quiet hours respected) and an optional morning summary.
- Sign in with a phone number and a texted code. No passwords.
- Billed yearly through Stripe: one card fee a year instead of twelve.
- Texts are capped per subscriber so a long storm cannot cost more than the subscription.
- Clear opt-in wording at signup and a working STOP on every text.

**Before 4b can launch**
- Confirm the Twilio number's registration covers Live Big Bear alerts. A number approved for a
  different business or message type should not be reused; register this use if needed and allow
  time for approval.
- Recheck Stripe and Twilio fees, then set the text cap.
- Decide the price only after seeing how many people take the free email.

## Cameras
Grouped by decision: Getting there (Caltrans highway cameras; Veterans Park, Big Bear Blvd),
On the mountain (Snow Summit, Bear Mountain, Snow Valley), Around the valley (airport, eagle nest).
Each uses the owner's own player with credit, or links out. The camera list lives in the
database so any camera can be switched off without a code change.

## Data sources
- Caltrans CWWP2: chain control, lane closures, road cameras (https://cwwp2.dot.ca.gov)
- National Weather Service API (https://api.weather.gov), needs a contact in the User-Agent
- Big Bear Municipal Water District lake level (no feed found; later)

## Settings
- DATABASE_URL — provided by the Vercel Neon integration
- NWS_CONTACT_EMAIL — contact address sent with weather requests

Never commit real secrets. `.env.example` must only ever hold blank placeholders.
